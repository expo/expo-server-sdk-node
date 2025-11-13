import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { MockAgent, setGlobalDispatcher } from 'undici';

import ExpoClient, { type ExpoPushMessage } from '../ExpoClient.ts';
import { getReceiptsApiUrl, sendApiUrl } from '../ExpoClientValues.ts';

const apiBaseUrl = 'https://exp.host';
const accessToken = 'foobar';
const mockTickets = [{ status: 'ok', id: randomUUID() }];
const mockReceipts = {};

let mockAgent: MockAgent;

beforeEach(() => {
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
});

afterEach(async () => {
  await mockAgent.close();
});

describe('sending push notification messages', () => {
  test('resolves with the data from the server response', async () => {
    const mockPool = mockAgent.get(apiBaseUrl);
    mockPool.intercept({ path: sendApiUrl, method: 'POST' }).reply(200, { data: mockTickets });

    assert.deepEqual(await client().sendPushNotificationsAsync([{ to: 'one' }]), mockTickets);
  });

  test('throws an error if the bearer token is invalid', async () => {
    const mockPool = mockAgent.get(apiBaseUrl);
    mockPool
      .intercept({ path: sendApiUrl, method: 'POST' })
      .reply(401, { error: 'invalid_token', error_description: 'The bearer token is invalid' });

    await assert.rejects(
      client().sendPushNotificationsAsync([{ to: 'one' }]),
      /The bearer token is invalid/,
    );
  });

  test('compresses request bodies over 1 KiB', async () => {
    const messages = [{ to: 'a', body: new Array(1500).join('?') }];
    const messageLength = JSON.stringify(messages).length;
    assert(messageLength > 1024);

    const mockPool = mockAgent.get(apiBaseUrl);
    mockPool
      .intercept({
        path: sendApiUrl,
        method: 'POST',
        headers: {
          'Content-Encoding': 'gzip',
        },
        body: (body) => {
          const uncompressed = gunzipSync(Buffer.from(body, 'hex')).toString();
          return uncompressed === JSON.stringify(messages);
        },
      })
      .reply(200, { data: mockTickets });

    assert.deepEqual(await client().sendPushNotificationsAsync(messages), mockTickets);
  });

  test('uses the httpAgent when provided', async () => {
    const httpAgent = new MockAgent();
    httpAgent.disableNetConnect();
    setGlobalDispatcher(httpAgent);
    const mockPool = httpAgent.get(apiBaseUrl);
    mockPool.intercept({ path: sendApiUrl, method: 'POST' }).reply(200, { data: mockTickets });

    const clientWithAgent = client({ httpAgent });
    assert.deepEqual(
      await clientWithAgent.sendPushNotificationsAsync([{ to: 'one' }]),
      mockTickets,
    );
    await httpAgent.close();
  });
  test(`throws an error when the number of tickets doesn't match the number of messages`, async () => {
    const mockPool = mockAgent.get(apiBaseUrl);
    mockPool.intercept({ path: sendApiUrl, method: 'POST' }).reply(200, { data: [{}, {}] });

    await assert.rejects(client().sendPushNotificationsAsync([{ to: 'a' }]), {
      message: 'Expected Expo to respond with 1 ticket but got 2',
    });

    mockPool.intercept({ path: sendApiUrl, method: 'POST' }).reply(200, { data: [{}, {}] });

    await assert.rejects(client().sendPushNotificationsAsync(Array(3).fill({ to: 'a' })), {
      message: 'Expected Expo to respond with 3 tickets but got 2',
    });
  });

  describe('200 response with well-formed API errors', () => {
    const code = 'TEST_API_ERROR';
    const message = 'This is a test error';
    beforeEach(() => {
      const mockPool = mockAgent.get(apiBaseUrl);
      mockPool
        .intercept({ path: sendApiUrl, method: 'POST' })
        .reply(200, { errors: [{ code, message }] });
    });

    test('rejects with the error message', async () => {
      await assert.rejects(client().sendPushNotificationsAsync([]), { message });
    });
    test('rejects with the error code', async () => {
      await assert.rejects(client().sendPushNotificationsAsync([]), { code });
    });
  });

  test('handles 200 HTTP responses with malformed JSON', async () => {
    const mockPool = mockAgent.get(apiBaseUrl);
    mockPool
      .intercept({ path: sendApiUrl, method: 'POST' })
      .reply(200, '<!DOCTYPE html><body>Not JSON</body>');

    await assert.rejects(client().sendPushNotificationsAsync([]), /Expo responded with an error/);
  });

  describe('non-200 response with well-formed API errors', () => {
    const code = 'TEST_API_ERROR';
    const message = 'This is a test error';
    beforeEach(() => {
      const mockPool = mockAgent.get(apiBaseUrl);
      mockPool
        .intercept({ path: sendApiUrl, method: 'POST' })
        .reply(400, { errors: [{ code, message }] });
    });

    test('rejects with the error message', async () => {
      await assert.rejects(client().sendPushNotificationsAsync([]), { message });
    });
    test('rejects with the error code', async () => {
      await assert.rejects(client().sendPushNotificationsAsync([]), { code });
    });
  });

  test('handles non-200 HTTP responses with arbitrary JSON', async () => {
    const mockPool = mockAgent.get(apiBaseUrl);
    mockPool.intercept({ path: sendApiUrl, method: 'POST' }).reply(400, { clowntown: true });

    await assert.rejects(client().sendPushNotificationsAsync([]), /Expo responded with an error/);
  });

  test('handles non-200 HTTP responses with arbitrary text', async () => {
    const mockPool = mockAgent.get(apiBaseUrl);
    mockPool
      .intercept({ path: sendApiUrl, method: 'POST' })
      .reply(400, '<!DOCTYPE html><body>Not JSON</body>');

    await assert.rejects(client().sendPushNotificationsAsync([]), /Expo responded with an error/);
  });

  describe('well-formed API responses with multiple errors and extra details', () => {
    const errors = [
      {
        code: 'TEST_API_ERROR',
        message: `This is a test error`,
        details: { __debug: 'test debug information' },
        stack:
          'Error: This is a test error\n' +
          '    at SomeServerModule.method (SomeServerModule.js:131:20)',
      },
      {
        code: 'SYSTEM_ERROR',
        message: `This is another error`,
      },
    ];
    beforeEach(() => {
      const mockPool = mockAgent.get(apiBaseUrl);
      mockPool.intercept({ path: sendApiUrl, method: 'POST' }).reply(400, { errors });
    });

    test("throws the first error's message", async () => {
      await assert.rejects(client().sendPushNotificationsAsync([]), {
        message: errors[0]?.message,
      });
    });

    test('rejects with the code of the first error', async () => {
      await assert.rejects(client().sendPushNotificationsAsync([]), {
        code: errors[0]?.code,
      });
    });

    test('rejects with the details of the first error', async () => {
      await assert.rejects(client().sendPushNotificationsAsync([]), {
        details: errors[0]?.details,
      });
    });

    test('rejects with the stack of the the first error as "serverStack"', async () => {
      await assert.rejects(client().sendPushNotificationsAsync([]), {
        serverStack: errors[0]?.stack,
      });
    });

    test('rejects with additional errors messages as "others"', async () => {
      await assert.rejects(
        client().sendPushNotificationsAsync([]),
        (e: any) => e.others[0].message === errors[1]?.message,
      );
    });
  });

  describe('429 Too Many Requests', () => {
    const code = 'RATE_LIMIT_ERROR';
    const message = 'Rate limit exceeded';
    const errors = [{ code, message }];
    const fastClient = client({ retryMinTimeout: 1 });

    describe('when all retries fail', () => {
      beforeEach(() => {
        const mockPool = mockAgent.get(apiBaseUrl);
        mockPool.intercept({ path: sendApiUrl, method: 'POST' }).reply(429, { errors }).times(3);
      });
      test('rejects with the error message', async () => {
        await assert.rejects(fastClient.sendPushNotificationsAsync([]), { message });
      });

      test('rejects with the error code', async () => {
        await assert.rejects(fastClient.sendPushNotificationsAsync([]), { code });
      });
    });
    describe('when the second retry succeeds', () => {
      const data = ['one', 'another'];
      beforeEach(() => {
        const mockPool = mockAgent.get(apiBaseUrl);
        mockPool.intercept({ path: sendApiUrl, method: 'POST' }).reply(429, { errors });
        mockPool.intercept({ path: sendApiUrl, method: 'POST' }).reply(200, { data });
      });
      test('resolves with the data response', async () => {
        await assert.deepEqual(
          await fastClient.sendPushNotificationsAsync([{ to: 'a' }, { to: 'b' }]),
          data,
        );
      });
    });
  });
});

describe('retrieving push notification receipts', () => {
  test('resolves with the data response from the Expo API server', async () => {
    const mockPool = mockAgent.get(apiBaseUrl);
    mockPool
      .intercept({ path: getReceiptsApiUrl, method: 'POST' })
      .reply(200, { data: mockReceipts });
    assert.deepEqual(await client().getPushNotificationReceiptsAsync([]), mockReceipts);
  });

  describe('if the response is not a map', () => {
    const data = [{ status: 'ok' }];
    beforeEach(() => {
      const mockPool = mockAgent.get(apiBaseUrl);
      mockPool.intercept({ path: getReceiptsApiUrl, method: 'POST' }).reply(200, { data });
    });
    test('throws an error', async () => {
      await assert.rejects(
        client().getPushNotificationReceiptsAsync([]),
        /Expected Expo to respond with a map/,
      );
    });
    test('rejects with the response', async () => {
      await assert.rejects(client().getPushNotificationReceiptsAsync([]), { data });
    });
  });
});

describe('chunking push notification messages', () => {
  test('defines the push notification chunk size', () => {
    assert.ok(ExpoClient.pushNotificationChunkSizeLimit);
  });

  test('chunks lists of push notification messages', () => {
    const messages = new Array(999).fill({ to: '?' });
    const chunks = client().chunkPushNotifications(messages);
    let totalMessageCount = 0;
    for (const chunk of chunks) {
      totalMessageCount += chunk.length;
    }
    assert.equal(totalMessageCount, messages.length);
  });

  test('can chunk small lists of push notification messages', () => {
    const messages = new Array(10).fill({ to: '?' });
    const chunks = client().chunkPushNotifications(messages);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0]?.length, 10);
  });

  test('chunks single push notification message with lists of recipients', () => {
    const messagesLength = 999;

    const messages = [{ to: new Array(messagesLength).fill('?') }];
    const chunks = client().chunkPushNotifications(messages);
    for (const chunk of chunks) {
      // Each chunk should only contain a single message with 100 recipients
      assert.equal(chunk.length, 1);
    }
    assert.equal(countAndValidateMessages(chunks), messagesLength);
  });

  test('can chunk single push notification message with small lists of recipients', () => {
    const messagesLength = 10;

    const messages = [{ to: new Array(messagesLength).fill('?') }];
    const chunks = client().chunkPushNotifications(messages);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0]?.length, 1);
    assert.ok(chunks[0]);
    assert.equal(chunks[0][0]?.to.length, messagesLength);
  });

  test('chunks push notification messages mixed with lists of recipients and single recipient', () => {
    const messages = [
      { to: new Array(888).fill('?') },
      ...new Array(999).fill({
        to: '?',
      }),
      { to: new Array(90).fill('?') },
      ...new Array(10).fill({ to: '?' }),
    ];
    const chunks = client().chunkPushNotifications(messages);
    assert.equal(countAndValidateMessages(chunks), 888 + 999 + 90 + 10);
  });
});

describe('chunking a single push notification message with multiple recipients', () => {
  test('one message with 100 recipients', () => {
    const messages = [{ to: new Array(100).fill('?') }];
    const chunks = client().chunkPushNotifications(messages);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0]?.length, 1);
    assert.ok(chunks[0]);
    assert.equal(chunks[0][0]?.to.length, 100);
  });

  test('one message with 101 recipients', () => {
    const messages = [{ to: new Array(101).fill('?') }];
    const chunks = client().chunkPushNotifications(messages);
    assert.equal(chunks.length, 2);
    assert.equal(chunks[0]?.length, 1);
    assert.equal(chunks[1]?.length, 1);
    assert.equal(countAndValidateMessages(chunks), 101);
  });

  test('one message with 99 recipients and two additional messages', () => {
    const messages = [{ to: new Array(99).fill('?') }, ...new Array(2).fill({ to: '?' })];
    const chunks = client().chunkPushNotifications(messages);
    assert.equal(chunks.length, 2);
    assert.equal(chunks[0]?.length, 2);
    assert.equal(chunks[1]?.length, 1);
    assert.equal(countAndValidateMessages(chunks), 99 + 2);
  });

  test('one message with 100 recipients and two additional messages', () => {
    const messages = [{ to: new Array(100).fill('?') }, ...new Array(2).fill({ to: '?' })];
    const chunks = client().chunkPushNotifications(messages);
    assert.equal(chunks.length, 2);
    assert.equal(chunks[0]?.length, 1);
    assert.equal(chunks[1]?.length, 2);
    assert.equal(countAndValidateMessages(chunks), 100 + 2);
  });

  test('99 messages and one additional message with with two recipients', () => {
    const messages = [...new Array(99).fill({ to: '?' }), { to: new Array(2).fill('?') }];
    const chunks = client().chunkPushNotifications(messages);
    assert.equal(chunks.length, 2);
    assert.equal(chunks[0]?.length, 100);
    assert.equal(chunks[1]?.length, 1);
    assert.equal(countAndValidateMessages(chunks), 99 + 2);
  });

  test('no message', () => {
    assert.equal(client().chunkPushNotifications([]).length, 0);
  });

  test('one message with no recipient', () => {
    assert.equal(client().chunkPushNotifications([{ to: [] }]).length, 0);
  });

  test('two messages and one additional message with no recipient', () => {
    const messages = [...new Array(2).fill({ to: '?' }), { to: [] }];
    const chunks = client().chunkPushNotifications(messages);
    assert.equal(chunks.length, 1);
    // The message with no recipient should be removed.
    assert.equal(chunks[0]?.length, 2);
    assert.equal(countAndValidateMessages(chunks), 2);
  });
});

describe('chunking push notification receipt IDs', () => {
  test('defines the push notification receipt ID chunk size', () => {
    assert.ok(ExpoClient.pushNotificationReceiptChunkSizeLimit);
  });

  test('chunks lists of push notification receipt IDs', () => {
    const client = new ExpoClient();
    const receiptIds = new Array(2999).fill('F5741A13-BCDA-434B-A316-5DC0E6FFA94F');
    const chunks = client.chunkPushNotificationReceiptIds(receiptIds);
    let totalReceiptIdCount = 0;
    for (const chunk of chunks) {
      totalReceiptIdCount += chunk.length;
    }
    assert.equal(totalReceiptIdCount, receiptIds.length);
  });
});

describe('.isExpoPushToken', () => {
  test('returns true for ExpoPushToken[.*]', () => {
    assert.equal(ExpoClient.isExpoPushToken('ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]'), true);
  });
  test('returns true for ExponentPushToken[.*]', () => {
    assert.equal(ExpoClient.isExpoPushToken('ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'), true);
  });
  test('returns true for UUIDs', () => {
    assert.equal(ExpoClient.isExpoPushToken('F5741A13-BCDA-434B-A316-5DC0E6FFA94F'), true);
  });
  test('returns false for FCM tokens', () => {
    assert.equal(
      ExpoClient.isExpoPushToken(
        'dOKpuo4qbsM:APA91bHkSmF84ROx7Y-2eMGxc0lmpQeN33ZwDMG763dkjd8yjKK-rhPtiR1OoIWNG5ZshlL8oyxsTnQ5XtahyBNS9mJAvfeE6aHzv_mOF_Ve4vL2po4clMIYYV2-Iea_sZVJF7xFLXih4Y0y88JNYULxFfz-XXXXX',
      ),
      false,
    );
  });
  test('returns false for APNS tokens', () => {
    assert.equal(
      ExpoClient.isExpoPushToken(
        '5fa729c6e535eb568g18fdabd35785fc60f41c161d9d7cf4b0bbb0d92437fda0',
      ),
      false,
    );
  });
});

function countAndValidateMessages(chunks: ExpoPushMessage[][]): number {
  let totalMessageCount = 0;
  for (const chunk of chunks) {
    const chunkMessagesCount = ExpoClient._getActualMessageCount(chunk);
    assert(chunkMessagesCount <= ExpoClient.pushNotificationChunkSizeLimit);
    totalMessageCount += chunkMessagesCount;
  }
  return totalMessageCount;
}

function client(options: object = {}) {
  return new ExpoClient({ accessToken, ...options });
}
