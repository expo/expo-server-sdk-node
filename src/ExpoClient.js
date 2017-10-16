/**
 * expo-server-sdk
 *
 * Use this if you are running Node on your server backend when you are working with Expo
 * https://expo.io
 *
 * @flow
 */
import invariant from 'invariant';
import fetch, { Headers, Response as FetchResponse } from 'node-fetch';
import zlib from 'zlib';

const BASE_URL = 'https://exp.host';
const BASE_API_URL = `${BASE_URL}/--/api/v2`;

/**
 * The max number of push notifications to be sent at once. Since we can't automatically upgrade
 * everyone using this library, we should strongly try not to decrease it.
 */
const PUSH_NOTIFICATION_CHUNK_LIMIT = 100;

// TODO: Eventually we'll want to have developers authenticate. Right now it's not necessary because
// push notifications are the only API we have and the push tokens are secret anyway.
export default class ExpoClient {
  static pushNotificationChunkSizeLimit = PUSH_NOTIFICATION_CHUNK_LIMIT;

  _httpAgent: ?HttpAgent;

  constructor(options: ExpoClientOptions = {}) {
    this._httpAgent = options.httpAgent;
  }

  /**
   * Returns `true` if the token is an Expo push token
   */
  static isExpoPushToken(token: ExpoPushToken): boolean {
    return (
      typeof token === 'string' &&
      (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')) &&
      token.endsWith(']')
    );
  }

  /**
   * Legacy alias for isExpoPushToken
   */
  static isExponentPushToken(token: ExpoPushToken): boolean {
    return ExpoClient.isExpoPushToken(token);
  }

  /**
   * Sends the given message to its recipient via a push notification
   */
  async sendPushNotificationAsync(message: ExpoPushMessage): Promise<ExpoPushReceipt> {
    let receipts = await this.sendPushNotificationsAsync([message]);
    invariant(receipts.length === 1, `Expected exactly one push receipt`);
    return receipts[0];
  }

  /**
   * Sends the given messages to their recipients via push notifications and returns an array of
   * push receipts. Each receipt corresponds to the message at its respective index (the nth receipt
   * is for the nth message).
   *
   * There is a limit on the number of push notifications you can send at once. Use
   * `chunkPushNotifications` to divide an array of push notification messages into appropriately
   * sized chunks.
   */
  async sendPushNotificationsAsync(messages: ExpoPushMessage[]): Promise<ExpoPushReceipt[]> {
    let data = await this._requestAsync(`${BASE_API_URL}/push/send`, {
      httpMethod: 'post',
      body: messages,
      shouldCompress(body) {
        return body.length > 1024;
      },
    });

    if (!Array.isArray(data) || data.length !== messages.length) {
      let apiError: Object = new Error(
        `Expected Exponent to respond with ${messages.length} ` +
          `${messages.length === 1 ? 'receipt' : 'receipts'} but got ` +
          `${data.length}`
      );
      apiError.data = data;
      throw apiError;
    }

    return data;
  }

  chunkPushNotifications(messages: ExpoPushMessage[]): ExpoPushMessage[][] {
    let chunks = [];
    let chunk = [];
    for (let message of messages) {
      chunk.push(message);
      if (chunk.length >= PUSH_NOTIFICATION_CHUNK_LIMIT) {
        chunks.push(chunk);
        chunk = [];
      }
    }

    if (chunk.length) {
      chunks.push(chunk);
    }

    return chunks;
  }

  async _requestAsync(url: string, options: RequestOptions): Promise<*> {
    let sdkVersion = require('../package.json').version;
    let fetchOptions = {
      method: options.httpMethod,
      body: JSON.stringify(options.body),
      headers: new Headers({
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'User-Agent': `expo-server-sdk-node/${sdkVersion}`,
      }),
      agent: this._httpAgent,
    };
    if (options.body != null) {
      let json = JSON.stringify(options.body);
      invariant(json != null, `JSON request body must not be null`);
      if (options.shouldCompress(json)) {
        fetchOptions.body = await _gzipAsync(Buffer.from(json));
        fetchOptions.headers.set('Content-Encoding', 'gzip');
      } else {
        fetchOptions.body = json;
      }

      fetchOptions.headers.set('Content-Type', 'application/json');
    }

    let response = await fetch(url, fetchOptions);

    if (response.status !== 200) {
      let apiError = await this._parseErrorResponseAsync(response);
      throw apiError;
    }

    let textBody = await response.text();
    // We expect the API response body to be JSON
    let result: ApiResult;
    try {
      result = JSON.parse(textBody);
    } catch (e) {
      let apiError = await this._getTextResponseErrorAsync(response, textBody);
      throw apiError;
    }

    if (result.errors) {
      let apiError = this._getErrorFromResult(result);
      throw apiError;
    }

    return result.data;
  }

  async _parseErrorResponseAsync(response: FetchResponse): Promise<Error> {
    let textBody = await response.text();
    let result: ApiResult;
    try {
      result = JSON.parse(textBody);
    } catch (e) {
      return await this._getTextResponseErrorAsync(response, textBody);
    }

    if (!result.errors || !Array.isArray(result.errors) || !result.errors.length) {
      let apiError: Object = await this._getTextResponseErrorAsync(response, textBody);
      apiError.errorData = result;
      return apiError;
    }

    return this._getErrorFromResult(result);
  }

  async _getTextResponseErrorAsync(response: FetchResponse, text: string): Promise<Error> {
    let apiError: Object = new Error(
      `Expo responded with an error with status code ${response.status}: ` + text
    );
    apiError.statusCode = response.status;
    apiError.errorText = text;
    return apiError;
  }

  /**
   * Returns an error for the first API error in the result, with an optional `others` field that
   * contains any other errors.
   */
  _getErrorFromResult(result: ApiResult): Error {
    invariant(
      result.errors && result.errors.length > 0,
      `Expected at least one error from Expo`
    );
    let [errorData, ...otherErrorData] = result.errors;
    let error: Object = this._getErrorFromResultError(errorData);
    if (otherErrorData.length) {
      error.others = otherErrorData.map(data => this._getErrorFromResultError(data));
    }
    return error;
  }

  /**
   * Returns an error for a single API error
   */
  _getErrorFromResultError(errorData: ApiResultError): Error {
    let error: Object = new Error(errorData.message);
    error.code = errorData.code;

    if (errorData.details != null) {
      error.details = errorData.details;
    }

    if (errorData.stack != null) {
      error.serverStack = errorData.stack;
    }

    return error;
  }
}

function _gzipAsync(data: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zlib.gzip(data, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

export type ExpoClientOptions = {
  httpAgent?: HttpAgent,
};

type HttpAgent = Object;

export type ExpoPushToken = string;

export type ExpoPushMessage = {
  to: ExpoPushToken,
  data?: Object,
  title?: string,
  body?: string,
  sound?: 'default' | null,
  ttl?: number,
  expiration?: number,
  priority?: 'default' | 'normal' | 'high',
  badge?: number,
};

export type ExpoPushReceipt = {
  status: 'ok' | 'error',
  details?: {
    error?: 'DeviceNotRegistered' | 'MessageTooBig' | 'MessageRateExceeded',
  },
  // Internal field used only by developers working on Expo
  __debug?: any,
};

type RequestOptions = {
  httpMethod: 'get' | 'post',
  body?: any,
  shouldCompress: (body: string) => boolean,
};

type ApiResult = {
  errors?: ApiResultError[],
  data?: any,
};

type ApiResultError = {
  message: string,
  code: string,
  details?: any,
  stack?: string,
};
