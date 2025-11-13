import { expect } from 'expect';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import { gunzipSync } from 'node:zlib';

import ExpoClient, { type ExpoPushMessage } from '../ExpoClient.ts';
import { getReceiptsApiUrl, sendApiUrl } from '../ExpoClientValues.ts';

const accessToken = 'foobar';
const mockTickets = [{ status: 'ok', id: randomUUID() }];
const mockReceipts = {};
const validationError = HttpResponse.json(
  { errors: [{ code: 'VALIDATION_ERROR' }] },
  { status: 400 },
);

const server = setupServer(
  http.post(sendApiUrl, async ({ request }) => {
    // The `useFcmV1` parameter can now only be true or absent
    const url = new URL(request.url);
    switch (url.searchParams.get('useFcmV1')) {
      case 'true':
        break;
      case null:
        break;
      default:
        return validationError;
    }
    if (request.headers.get('Content-Type') !== 'application/json') {
      return validationError;
    }
    if (request.headers.get('Authorization') !== `Bearer ${accessToken}`) {
      return HttpResponse.json(
        { error: 'invalid_token', error_description: 'The bearer token is invalid' },
        { status: 401 },
      );
    }
    let body;
    if (request.headers.get('Content-Encoding') === 'gzip') {
      body = JSON.parse(gunzipSync(await request.arrayBuffer()).toString());
    } else {
      body = await request.json();
    }

    if (typeof body != 'object') {
      return HttpResponse.text('Not Found', { status: 404 });
    }
    if (!body || !(body['to'] || Array.isArray(body))) {
      return validationError;
    }

    return HttpResponse.json({ data: mockTickets });
  }),
  http.post(getReceiptsApiUrl, async ({ request }) => {
    if (request.headers.get('Content-Type') !== 'application/json') {
      return validationError;
    }
    const body = await request.json();

    if (typeof body != 'object') {
      return HttpResponse.text('Not Found', { status: 404 });
    }
    if (!body || !(body['ids'] || Array.isArray(body))) {
      return validationError;
    }
    return HttpResponse.json({ data: mockReceipts });
  }),
);

before(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

after(() => {
  server.close();
});

afterEach(() => {
  server.resetHandlers();
});

describe('sending push notification messages', () => {
  test('resolves with the data from the server response', () =>
    expect(client().sendPushNotificationsAsync([{ to: 'one' }])).resolves.toEqual(mockTickets));

  describe('the useFcmV1 option', () => {
    test('omits the parameter when set to true', () =>
      expect(client({ useFcmV1: true }).sendPushNotificationsAsync([{ to: '' }])).resolves.toEqual(
        mockTickets,
      ));

    test('includes the parameter when set to false', () =>
      expect(
        client({ useFcmV1: false }).sendPushNotificationsAsync([{ to: '' }]),
      ).rejects.toThrow());
  });

  test('compresses request bodies over 1 KiB', () => {
    const messages = [{ to: 'a', body: new Array(1500).join('?') }];
    const messageLength = JSON.stringify(messages).length;
    expect(messageLength).toBeGreaterThan(1024);

    return expect(client().sendPushNotificationsAsync(messages)).resolves.toEqual(mockTickets);
  });

  test(`throws an error when the number of tickets doesn't match the number of messages`, async () => {
    server.use(http.post(sendApiUrl, () => HttpResponse.json({ data: Array(2) })));

    await expect(client().sendPushNotificationsAsync([{ to: 'a' }])).rejects.toThrow(
      `Expected Expo to respond with 1 ticket but got 2`,
    );
    await expect(client().sendPushNotificationsAsync(Array(3).fill({ to: 'a' }))).rejects.toThrow(
      `Expected Expo to respond with 3 tickets but got 2`,
    );
  });

  describe('200 response with well-formed API errors', () => {
    const code = 'TEST_API_ERROR';
    const message = 'This is a test error';
    beforeEach(() => {
      server.use(http.post(sendApiUrl, () => HttpResponse.json({ errors: [{ code, message }] })));
    });
    test('rejects with the error message', () =>
      expect(client().sendPushNotificationsAsync([])).rejects.toThrow(message));
    test('rejects with the error code', () =>
      expect(client().sendPushNotificationsAsync([])).rejects.toMatchObject({ code }));
  });

  test('handles 200 HTTP responses with malformed JSON', async () => {
    server.use(
      http.post(sendApiUrl, () => HttpResponse.text('<!DOCTYPE html><body>Not JSON</body>')),
    );

    await expect(client().sendPushNotificationsAsync([])).rejects.toThrow(
      `Expo responded with an error`,
    );
  });

  describe('non-200 response with well-formed API errors', () => {
    const code = 'TEST_API_ERROR';
    const message = 'This is a test error';
    beforeEach(() => {
      server.use(
        http.post(sendApiUrl, () =>
          HttpResponse.json({ errors: [{ code, message }] }, { status: 400 }),
        ),
      );
    });
    test('rejects with the error message', () =>
      expect(client().sendPushNotificationsAsync([])).rejects.toThrow(message));
    test('rejects with the error code', () =>
      expect(client().sendPushNotificationsAsync([])).rejects.toMatchObject({ code }));
  });

  test('handles non-200 HTTP responses with arbitrary JSON', () => {
    server.use(
      http.post(sendApiUrl, () => HttpResponse.json({ clowntown: true }, { status: 400 })),
    );

    return expect(client().sendPushNotificationsAsync([])).rejects.toThrow(
      `Expo responded with an error`,
    );
  });

  test('handles non-200 HTTP responses with arbitrary text', () => {
    server.use(
      http.post(sendApiUrl, () =>
        HttpResponse.text('<!DOCTYPE html><body>Not JSON</body>', { status: 400 }),
      ),
    );

    return expect(client().sendPushNotificationsAsync([])).rejects.toThrow(
      `Expo responded with an error`,
    );
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
      server.use(http.post(sendApiUrl, () => HttpResponse.json({ errors }, { status: 400 })));
    });

    test("throws the first error's message", () =>
      expect(client().sendPushNotificationsAsync([])).rejects.toThrow(errors[0]?.message));

    test('rejects with the code of the first error', () =>
      expect(client().sendPushNotificationsAsync([])).rejects.toMatchObject({
        code: errors[0]?.code,
      }));

    test('rejects with the details of the first error', () =>
      expect(client().sendPushNotificationsAsync([])).rejects.toMatchObject({
        details: errors[0]?.details,
      }));

    test('rejects with the stack of the the first error as "serverStack"', () =>
      expect(client().sendPushNotificationsAsync([])).rejects.toMatchObject({
        serverStack: errors[0]?.stack,
      }));

    test('rejects with additional errors messages as "others"', () =>
      expect(client().sendPushNotificationsAsync([])).rejects.toMatchObject({
        others: [Error(errors[1]?.message)],
      }));
  });

  describe('429 Too Many Requests', () => {
    const code = 'RATE_LIMIT_ERROR';
    const message = 'Rate limit exceeded';
    const errors = [{ code, message }];
    const fastClient = client({ retryMinTimeout: 1 });

    describe('when all retries fail', () => {
      beforeEach(() => {
        server.use(
          http.post(sendApiUrl, () => HttpResponse.json({ errors }, { status: 429 }), {
            once: true,
          }),
        );
        server.use(
          http.post(sendApiUrl, () => HttpResponse.json({ errors }, { status: 429 }), {
            once: true,
          }),
        );
        server.use(
          http.post(sendApiUrl, () => HttpResponse.json({ errors }, { status: 429 }), {
            once: true,
          }),
        );
      });

      test('rejects with the error message', () =>
        expect(fastClient.sendPushNotificationsAsync([])).rejects.toThrow(message));

      test('rejects with the error code', () =>
        expect(fastClient.sendPushNotificationsAsync([])).rejects.toMatchObject({ code }));
    });
    describe('when the second retry succeeds', () => {
      const data = ['one', 'another'];
      beforeEach(() => {
        server.use(
          http.post(sendApiUrl, () => HttpResponse.json({ errors }, { status: 429 }), {
            once: true,
          }),
        );
        server.use(
          http.post(sendApiUrl, () => HttpResponse.json({ errors }, { status: 429 }), {
            once: true,
          }),
        );
        server.use(http.post(sendApiUrl, () => HttpResponse.json({ data }), { once: true }));
      });
      test('resolves with the data response', () =>
        expect(fastClient.sendPushNotificationsAsync([{ to: 'a' }, { to: 'b' }])).resolves.toEqual(
          data,
        ));
    });
  });
});

describe('retrieving push notification receipts', () => {
  test('resolves with the data response from the Expo API server', () => {
    return expect(client().getPushNotificationReceiptsAsync([])).resolves.toEqual(mockReceipts);
  });

  describe('if the response is not a map', () => {
    const data = [{ status: 'ok' }];
    beforeEach(() => {
      server.use(http.post(getReceiptsApiUrl, () => HttpResponse.json({ data })));
    });
    test('throws an error', () =>
      expect(client().getPushNotificationReceiptsAsync([])).rejects.toThrow(
        `Expected Expo to respond with a map`,
      ));
    test('rejects with the response', () =>
      expect(client().getPushNotificationReceiptsAsync([])).rejects.toMatchObject({ data }));
  });
});

describe('chunking push notification messages', () => {
  test('defines the push notification chunk size', () => {
    expect(ExpoClient.pushNotificationChunkSizeLimit).toBeDefined();
  });

  test('chunks lists of push notification messages', () => {
    const messages = new Array(999).fill({ to: '?' });
    const chunks = client().chunkPushNotifications(messages);
    let totalMessageCount = 0;
    for (const chunk of chunks) {
      totalMessageCount += chunk.length;
    }
    expect(totalMessageCount).toBe(messages.length);
  });

  test('can chunk small lists of push notification messages', () => {
    const messages = new Array(10).fill({ to: '?' });
    const chunks = client().chunkPushNotifications(messages);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(10);
  });

  test('chunks single push notification message with lists of recipients', () => {
    const messagesLength = 999;

    const messages = [{ to: new Array(messagesLength).fill('?') }];
    const chunks = client().chunkPushNotifications(messages);
    for (const chunk of chunks) {
      // Each chunk should only contain a single message with 100 recipients
      expect(chunk).toHaveLength(1);
    }
    const totalMessageCount = countAndValidateMessages(chunks);
    expect(totalMessageCount).toBe(messagesLength);
  });

  test('can chunk single push notification message with small lists of recipients', () => {
    const messagesLength = 10;

    const messages = [{ to: new Array(messagesLength).fill('?') }];
    const chunks = client().chunkPushNotifications(messages);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(1);
    assert.ok(chunks[0]);
    expect(chunks[0][0]?.to).toHaveLength(messagesLength);
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
    const totalMessageCount = countAndValidateMessages(chunks);
    expect(totalMessageCount).toBe(888 + 999 + 90 + 10);
  });
});

describe('chunking a single push notification message with multiple recipients', () => {
  test('one message with 100 recipients', () => {
    const messages = [{ to: new Array(100).fill('?') }];
    const chunks = client().chunkPushNotifications(messages);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(1);
    assert.ok(chunks[0]);
    expect(chunks[0][0]?.to).toHaveLength(100);
  });

  test('one message with 101 recipients', () => {
    const messages = [{ to: new Array(101).fill('?') }];
    const chunks = client().chunkPushNotifications(messages);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(1);
    expect(chunks[1]).toHaveLength(1);
    const totalMessageCount = countAndValidateMessages(chunks);
    expect(totalMessageCount).toBe(101);
  });

  test('one message with 99 recipients and two additional messages', () => {
    const messages = [{ to: new Array(99).fill('?') }, ...new Array(2).fill({ to: '?' })];
    const chunks = client().chunkPushNotifications(messages);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(2);
    expect(chunks[1]).toHaveLength(1);
    const totalMessageCount = countAndValidateMessages(chunks);
    expect(totalMessageCount).toBe(99 + 2);
  });

  test('one message with 100 recipients and two additional messages', () => {
    const messages = [{ to: new Array(100).fill('?') }, ...new Array(2).fill({ to: '?' })];
    const chunks = client().chunkPushNotifications(messages);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(1);
    expect(chunks[1]).toHaveLength(2);
    const totalMessageCount = countAndValidateMessages(chunks);
    expect(totalMessageCount).toBe(100 + 2);
  });

  test('99 messages and one additional message with with two recipients', () => {
    const messages = [...new Array(99).fill({ to: '?' }), { to: new Array(2).fill('?') }];
    const chunks = client().chunkPushNotifications(messages);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(100);
    expect(chunks[1]).toHaveLength(1);
    const totalMessageCount = countAndValidateMessages(chunks);
    expect(totalMessageCount).toBe(99 + 2);
  });

  test('no message', () => {
    expect(client().chunkPushNotifications([])).toHaveLength(0);
  });

  test('one message with no recipient', () => {
    expect(client().chunkPushNotifications([{ to: [] }])).toHaveLength(0);
  });

  test('two messages and one additional message with no recipient', () => {
    const messages = [...new Array(2).fill({ to: '?' }), { to: [] }];
    const chunks = client().chunkPushNotifications(messages);
    expect(chunks).toHaveLength(1);
    // The message with no recipient should be removed.
    expect(chunks[0]).toHaveLength(2);
    const totalMessageCount = countAndValidateMessages(chunks);
    expect(totalMessageCount).toBe(2);
  });
});

describe('chunking push notification receipt IDs', () => {
  test('defines the push notification receipt ID chunk size', () => {
    expect(ExpoClient.pushNotificationReceiptChunkSizeLimit).toBeDefined();
  });

  test('chunks lists of push notification receipt IDs', () => {
    const client = new ExpoClient();
    const receiptIds = new Array(2999).fill('F5741A13-BCDA-434B-A316-5DC0E6FFA94F');
    const chunks = client.chunkPushNotificationReceiptIds(receiptIds);
    let totalReceiptIdCount = 0;
    for (const chunk of chunks) {
      totalReceiptIdCount += chunk.length;
    }
    expect(totalReceiptIdCount).toBe(receiptIds.length);
  });
});

describe('.isExpoPushToken', () => {
  test('returns true for ExpoPushToken[.*]', () => {
    expect(ExpoClient.isExpoPushToken('ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]')).toBe(true);
  });
  test('returns true for ExponentPushToken[.*]', () => {
    expect(ExpoClient.isExpoPushToken('ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]')).toBe(true);
  });
  test('returns true for UUIDs', () => {
    expect(ExpoClient.isExpoPushToken('F5741A13-BCDA-434B-A316-5DC0E6FFA94F')).toBe(true);
  });
  test('returns false for FCM tokens', () => {
    expect(
      ExpoClient.isExpoPushToken(
        'dOKpuo4qbsM:APA91bHkSmF84ROx7Y-2eMGxc0lmpQeN33ZwDMG763dkjd8yjKK-rhPtiR1OoIWNG5ZshlL8oyxsTnQ5XtahyBNS9mJAvfeE6aHzv_mOF_Ve4vL2po4clMIYYV2-Iea_sZVJF7xFLXih4Y0y88JNYULxFfz-XXXXX',
      ),
    ).toBe(false);
  });
  test('returns false for APNS tokens', () => {
    expect(
      ExpoClient.isExpoPushToken(
        '5fa729c6e535eb568g18fdabd35785fc60f41c161d9d7cf4b0bbb0d92437fda0',
      ),
    ).toBe(false);
  });
});

function countAndValidateMessages(chunks: ExpoPushMessage[][]): number {
  let totalMessageCount = 0;
  for (const chunk of chunks) {
    const chunkMessagesCount = ExpoClient._getActualMessageCount(chunk);
    expect(chunkMessagesCount).toBeLessThanOrEqual(ExpoClient.pushNotificationChunkSizeLimit);
    totalMessageCount += chunkMessagesCount;
  }
  return totalMessageCount;
}

function client(options: object = {}) {
  return new ExpoClient({ accessToken, ...options });
}
