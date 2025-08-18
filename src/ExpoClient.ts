/**
 * expo-server-sdk
 *
 * Use this if you are running Node on your server backend when you are working with Expo
 * Application Services
 * https://expo.dev
 */
import fetch, { Headers, Response as FetchResponse } from 'node-fetch';
import assert from 'node:assert';
import { Agent } from 'node:http';
import { gzipSync } from 'node:zlib';
import promiseLimit from 'promise-limit';
import promiseRetry from 'promise-retry';

import {
  defaultConcurrentRequestLimit,
  getReceiptsApiUrl,
  pushNotificationChunkLimit,
  pushNotificationReceiptChunkLimit,
  requestRetryMinTimeout,
  sendApiUrl,
} from './ExpoClientValues';

export class Expo {
  static pushNotificationChunkSizeLimit = pushNotificationChunkLimit;
  static pushNotificationReceiptChunkSizeLimit = pushNotificationReceiptChunkLimit;

  private httpAgent: Agent | undefined;
  private limitConcurrentRequests: <T>(thunk: () => Promise<T>) => Promise<T>;
  private accessToken: string | undefined;
  private useFcmV1: boolean | undefined;
  private retryMinTimeout: number;

  constructor(options: Partial<ExpoClientOptions> = {}) {
    this.httpAgent = options.httpAgent;
    this.limitConcurrentRequests = promiseLimit(
      options.maxConcurrentRequests ?? defaultConcurrentRequestLimit,
    );
    this.retryMinTimeout = options.retryMinTimeout ?? requestRetryMinTimeout;
    this.accessToken = options.accessToken;
    this.useFcmV1 = options.useFcmV1;
  }

  /**
   * Returns `true` if the token is an Expo push token
   */
  static isExpoPushToken(token: unknown): token is ExpoPushToken {
    return (
      typeof token === 'string' &&
      (((token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')) &&
        token.endsWith(']')) ||
        /^[a-z\d]{8}-[a-z\d]{4}-[a-z\d]{4}-[a-z\d]{4}-[a-z\d]{12}$/i.test(token))
    );
  }

  /**
   * Sends the given messages to their recipients via push notifications and returns an array of
   * push tickets. Each ticket corresponds to the message at its respective index (the nth receipt
   * is for the nth message) and contains a receipt ID. Later, after Expo attempts to deliver the
   * messages to the underlying push notification services, the receipts with those IDs will be
   * available for a period of time (approximately a day).
   *
   * There is a limit on the number of push notifications you can send at once. Use
   * `chunkPushNotifications` to divide an array of push notification messages into appropriately
   * sized chunks.
   */
  async sendPushNotificationsAsync(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
    const url = new URL(sendApiUrl);
    // Only append the useFcmV1 option if the option is set to false
    if (this.useFcmV1 === false) {
      url.searchParams.append('useFcmV1', String(this.useFcmV1));
    }
    const actualMessagesCount = Expo._getActualMessageCount(messages);
    const data = await this.limitConcurrentRequests(async () => {
      return await promiseRetry(
        async (retry): Promise<any> => {
          try {
            return await this.requestAsync(url.toString(), {
              httpMethod: 'post',
              body: messages,
              shouldCompress(body) {
                return body.length > 1024;
              },
            });
          } catch (e: any) {
            // if Expo servers rate limit, retry with exponential backoff
            if (e.statusCode === 429) {
              return retry(e);
            }
            throw e;
          }
        },
        {
          retries: 2,
          factor: 2,
          minTimeout: this.retryMinTimeout,
        },
      );
    });

    if (!Array.isArray(data) || data.length !== actualMessagesCount) {
      const apiError: ExtensibleError = new Error(
        `Expected Expo to respond with ${actualMessagesCount} ${
          actualMessagesCount === 1 ? 'ticket' : 'tickets'
        } but got ${data.length}`,
      );
      apiError['data'] = data;
      throw apiError;
    }

    return data;
  }

  async getPushNotificationReceiptsAsync(
    receiptIds: ExpoPushReceiptId[],
  ): Promise<{ [id: string]: ExpoPushReceipt }> {
    const data = await this.requestAsync(getReceiptsApiUrl, {
      httpMethod: 'post',
      body: { ids: receiptIds },
      shouldCompress(body) {
        return body.length > 1024;
      },
    });

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      const apiError: ExtensibleError = new Error(
        `Expected Expo to respond with a map from receipt IDs to receipts but received data of another type`,
      );
      apiError['data'] = data;
      throw apiError;
    }

    return data;
  }

  chunkPushNotifications(messages: ExpoPushMessage[]): ExpoPushMessage[][] {
    const chunks: ExpoPushMessage[][] = [];
    let chunk: ExpoPushMessage[] = [];

    let chunkMessagesCount = 0;
    for (const message of messages) {
      if (Array.isArray(message.to)) {
        let partialTo: ExpoPushToken[] = [];
        for (const recipient of message.to) {
          partialTo.push(recipient);
          chunkMessagesCount++;
          if (chunkMessagesCount >= pushNotificationChunkLimit) {
            // Cap this chunk here if it already exceeds PUSH_NOTIFICATION_CHUNK_LIMIT.
            // Then create a new chunk to continue on the remaining recipients for this message.
            chunk.push({ ...message, to: partialTo });
            chunks.push(chunk);
            chunk = [];
            chunkMessagesCount = 0;
            partialTo = [];
          }
        }
        if (partialTo.length) {
          // Add remaining `partialTo` to the chunk.
          chunk.push({ ...message, to: partialTo });
        }
      } else {
        chunk.push(message);
        chunkMessagesCount++;
      }

      if (chunkMessagesCount >= pushNotificationChunkLimit) {
        // Cap this chunk if it exceeds PUSH_NOTIFICATION_CHUNK_LIMIT.
        // Then create a new chunk to continue on the remaining messages.
        chunks.push(chunk);
        chunk = [];
        chunkMessagesCount = 0;
      }
    }
    if (chunkMessagesCount) {
      // Add the remaining chunk to the chunks.
      chunks.push(chunk);
    }

    return chunks;
  }

  chunkPushNotificationReceiptIds(receiptIds: ExpoPushReceiptId[]): ExpoPushReceiptId[][] {
    return this.chunkItems(receiptIds, pushNotificationReceiptChunkLimit);
  }

  private chunkItems<T>(items: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    let chunk: T[] = [];
    for (const item of items) {
      chunk.push(item);
      if (chunk.length >= chunkSize) {
        chunks.push(chunk);
        chunk = [];
      }
    }

    if (chunk.length) {
      chunks.push(chunk);
    }

    return chunks;
  }

  private async requestAsync(url: string, options: RequestOptions): Promise<any> {
    let requestBody: string | Buffer | undefined;

    // Hardcode version to avoid require() issues in Deno/Edge Functions
    const sdkVersion = '3.15.0';
    const requestHeaders = new Headers({
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'User-Agent': `expo-server-sdk-node/${sdkVersion}`,
    });
    if (this.accessToken) {
      requestHeaders.set('Authorization', `Bearer ${this.accessToken}`);
    }

    if (options.body != null) {
      const json = JSON.stringify(options.body);
      assert(json != null, `JSON request body must not be null`);
      if (options.shouldCompress(json)) {
        requestBody = gzipSync(Buffer.from(json));
        requestHeaders.set('Content-Encoding', 'gzip');
      } else {
        requestBody = json;
      }

      requestHeaders.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, {
      method: options.httpMethod,
      body: requestBody,
      headers: requestHeaders,
      agent: this.httpAgent,
    });

    if (response.status !== 200) {
      const apiError = await this.parseErrorResponseAsync(response);
      throw apiError;
    }

    const textBody = await response.text();
    // We expect the API response body to be JSON
    let result: ApiResult;
    try {
      result = JSON.parse(textBody);
    } catch {
      const apiError = await this.getTextResponseErrorAsync(response, textBody);
      throw apiError;
    }

    if (result.errors) {
      const apiError = this.getErrorFromResult(response, result);
      throw apiError;
    }

    return result.data;
  }

  private async parseErrorResponseAsync(response: FetchResponse): Promise<Error> {
    const textBody = await response.text();
    let result: ApiResult;
    try {
      result = JSON.parse(textBody);
    } catch {
      return await this.getTextResponseErrorAsync(response, textBody);
    }

    if (!result.errors || !Array.isArray(result.errors) || !result.errors.length) {
      const apiError: ExtensibleError = await this.getTextResponseErrorAsync(response, textBody);
      apiError['errorData'] = result;
      return apiError;
    }

    return this.getErrorFromResult(response, result);
  }

  private async getTextResponseErrorAsync(response: FetchResponse, text: string): Promise<Error> {
    const apiError: ExtensibleError = new Error(
      `Expo responded with an error with status code ${response.status}: ` + text,
    );
    apiError['statusCode'] = response.status;
    apiError['errorText'] = text;
    return apiError;
  }

  /**
   * Returns an error for the first API error in the result, with an optional `others` field that
   * contains any other errors.
   */
  private getErrorFromResult(response: FetchResponse, result: ApiResult): Error {
    const noErrorsMessage = `Expected at least one error from Expo`;
    assert(result.errors, noErrorsMessage);
    const [errorData, ...otherErrorData] = result.errors;
    assert.ok(errorData, noErrorsMessage);
    const error = this.getErrorFromResultError(errorData);
    if (otherErrorData.length) {
      error['others'] = otherErrorData.map((data) => this.getErrorFromResultError(data));
    }
    error['statusCode'] = response.status;
    return error;
  }

  /**
   * Returns an error for a single API error
   */
  private getErrorFromResultError(errorData: ApiResultError): ExtensibleError {
    const error: ExtensibleError = new Error(errorData.message);
    error['code'] = errorData.code;

    if (errorData.details != null) {
      error['details'] = errorData.details;
    }

    if (errorData.stack != null) {
      error['serverStack'] = errorData.stack;
    }

    return error;
  }

  static _getActualMessageCount(messages: ExpoPushMessage[]): number {
    return messages.reduce((total, message) => {
      if (Array.isArray(message.to)) {
        total += message.to.length;
      } else {
        total++;
      }
      return total;
    }, 0);
  }
}

export default Expo;

export type ExpoClientOptions = {
  httpAgent: Agent;
  maxConcurrentRequests: number;
  retryMinTimeout: number;
  accessToken: string;
  useFcmV1: boolean;
};

export type ExpoPushToken = string;

// see "Message request format" at https://docs.expo.dev/push-notifications/sending-notifications/#message-request-format
export type ExpoPushMessage = {
  to: ExpoPushToken | ExpoPushToken[];
  data?: Record<string, unknown>;
  title?: string;
  subtitle?: string;
  body?: string;
  sound?:
    | string
    | null
    | {
        critical?: boolean;
        name?: string | null;
        volume?: number;
      };
  ttl?: number;
  expiration?: number;
  priority?: 'default' | 'normal' | 'high';
  interruptionLevel?: 'active' | 'critical' | 'passive' | 'time-sensitive';
  badge?: number;
  channelId?: string;
  icon?: string;
  richContent?: {
    image?: string;
  };
  categoryId?: string;
  mutableContent?: boolean;
  _contentAvailable?: boolean;
};

export type ExpoPushReceiptId = string;

export type ExpoPushSuccessTicket = {
  status: 'ok';
  id: ExpoPushReceiptId;
};

export type ExpoPushErrorTicket = ExpoPushErrorReceipt;

export type ExpoPushTicket = ExpoPushSuccessTicket | ExpoPushErrorTicket;

export type ExpoPushSuccessReceipt = {
  status: 'ok';
  details?: object;
  // Internal field used only by developers working on Expo
  __debug?: any;
};

export type ExpoPushErrorReceipt = {
  status: 'error';
  message: string;
  details?: {
    error?:
      | 'DeveloperError'
      | 'DeviceNotRegistered'
      | 'ExpoError'
      | 'InvalidCredentials'
      | 'MessageRateExceeded'
      | 'MessageTooBig'
      | 'ProviderError';
    expoPushToken?: string;
  };
  // Internal field used only by developers working on Expo
  __debug?: any;
};

export type ExpoPushReceipt = ExpoPushSuccessReceipt | ExpoPushErrorReceipt;

type RequestOptions = {
  httpMethod: 'get' | 'post';
  body?: any;
  shouldCompress: (body: string) => boolean;
};

type ApiResult = {
  errors?: ApiResultError[];
  data?: any;
};

type ApiResultError = {
  message: string;
  code: string;
  details?: any;
  stack?: string;
};

class ExtensibleError extends Error {
  [key: string]: any;
}
