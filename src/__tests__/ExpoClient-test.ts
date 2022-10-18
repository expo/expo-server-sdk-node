import fetch from 'node-fetch';

import ExpoClient, { ExpoPushMessage } from '../ExpoClient';

jest.mock('../ExpoClientValues', () => ({
  requestRetryMinTimeout: 1,
}));

afterEach(() => {
  (fetch as any).reset();
});

describe('sending push notification messages', () => {
  test('sends requests to the Expo API server without a supplied access token', async () => {
    const mockTickets = [
      { status: 'ok', id: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX' },
      { status: 'ok', id: 'YYYYYYYY-YYYY-YYYY-YYYY-YYYYYYYYYYYY' },
    ];
    (fetch as any).mock('https://exp.host/--/api/v2/push/send', { data: mockTickets });

    const client = new ExpoClient();
    const tickets = await client.sendPushNotificationsAsync([{ to: 'a' }, { to: 'b' }]);
    expect(tickets).toEqual(mockTickets);

    const [, options] = (fetch as any).lastCall('https://exp.host/--/api/v2/push/send');
    expect(options.headers.get('accept')).toContain('application/json');
    expect(options.headers.get('accept-encoding')).toContain('gzip');
    expect(options.headers.get('content-type')).toContain('application/json');
    expect(options.headers.get('user-agent')).toMatch(/^expo-server-sdk-node\//);
    expect(options.headers.get('Authorization')).toBeNull();
  });

  test('sends requests to the Expo API server with a supplied access token', async () => {
    const mockTickets = [
      { status: 'ok', id: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX' },
      { status: 'ok', id: 'YYYYYYYY-YYYY-YYYY-YYYY-YYYYYYYYYYYY' },
    ];
    (fetch as any).mock('https://exp.host/--/api/v2/push/send', { data: mockTickets });

    const client = new ExpoClient({ accessToken: 'foobar' });
    const tickets = await client.sendPushNotificationsAsync([{ to: 'a' }, { to: 'b' }]);
    expect(tickets).toEqual(mockTickets);

    const [, options] = (fetch as any).lastCall('https://exp.host/--/api/v2/push/send');
    expect(options.headers.get('accept')).toContain('application/json');
    expect(options.headers.get('accept-encoding')).toContain('gzip');
    expect(options.headers.get('content-type')).toContain('application/json');
    expect(options.headers.get('user-agent')).toMatch(/^expo-server-sdk-node\//);
    expect(options.headers.get('Authorization')).toContain('Bearer foobar');
  });

  test('compresses request bodies over 1 KiB', async () => {
    const mockTickets = [{ status: 'ok', id: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX' }];
    (fetch as any).mock('https://exp.host/--/api/v2/push/send', { data: mockTickets });

    const client = new ExpoClient();

    const messages = [{ to: 'a', body: new Array(1500).join('?') }];
    expect(JSON.stringify(messages).length).toBeGreaterThan(1024);
    const tickets = await client.sendPushNotificationsAsync(messages);
    expect(tickets).toEqual(mockTickets);

    // Ensure the request body was compressed
    const [, options] = (fetch as any).lastCall('https://exp.host/--/api/v2/push/send');
    expect(options.body.length).toBeLessThan(JSON.stringify(messages).length);
    expect(options.headers.get('content-encoding')).toContain('gzip');
  });

  test(`throws an error when the number of tickets doesn't match the number of messages`, async () => {
    const mockTickets = [
      { status: 'ok', id: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX' },
      { status: 'ok', id: 'YYYYYYYY-YYYY-YYYY-YYYY-YYYYYYYYYYYY' },
    ];
    (fetch as any).mock('https://exp.host/--/api/v2/push/send', { data: mockTickets });

    const client = new ExpoClient();
    await expect(client.sendPushNotificationsAsync([{ to: 'a' }])).rejects.toThrowError(
      `Expected Expo to respond with 1 ticket but got 2`
    );

    await expect(
      client.sendPushNotificationsAsync([{ to: 'a' }, { to: 'b' }, { to: 'c' }])
    ).rejects.toThrowError(`Expected Expo to respond with 3 tickets but got 2`);
  });

  test('handles 200 HTTP responses with well-formed API errors', async () => {
    (fetch as any).mock('https://exp.host/--/api/v2/push/send', {
      status: 200,
      errors: [{ code: 'TEST_API_ERROR', message: `This is a test error` }],
    });

    const client = new ExpoClient();
    const rejection = expect(client.sendPushNotificationsAsync([])).rejects;
    await rejection.toThrowError(`This is a test error`);
    await rejection.toMatchObject({ code: 'TEST_API_ERROR' });
  });

  test('handles 200 HTTP responses with malformed JSON', async () => {
    (fetch as any).mock('https://exp.host/--/api/v2/push/send', {
      status: 200,
      body: '<!DOCTYPE html><body>Not JSON</body>',
    });

    const client = new ExpoClient();
    await expect(client.sendPushNotificationsAsync([])).rejects.toThrowError(
      `Expo responded with an error`
    );
  });

  test('handles non-200 HTTP responses with well-formed API errors', async () => {
    (fetch as any).mock('https://exp.host/--/api/v2/push/send', {
      status: 400,
      body: {
        errors: [{ code: 'TEST_API_ERROR', message: `This is a test error` }],
      },
    });

    const client = new ExpoClient();
    const rejection = expect(client.sendPushNotificationsAsync([])).rejects;
    await rejection.toThrowError(`This is a test error`);
    await rejection.toMatchObject({ code: 'TEST_API_ERROR' });
  });

  test('handles non-200 HTTP responses with arbitrary JSON', async () => {
    (fetch as any).mock('https://exp.host/--/api/v2/push/send', {
      status: 400,
      body: { clowntown: true },
    });

    const client = new ExpoClient();
    await expect(client.sendPushNotificationsAsync([])).rejects.toThrowError(
      `Expo responded with an error`
    );
  });

  test('handles non-200 HTTP responses with arbitrary text', async () => {
    (fetch as any).mock('https://exp.host/--/api/v2/push/send', {
      status: 400,
      body: '<!DOCTYPE html><body>Not JSON</body>',
    });

    const client = new ExpoClient();
    await expect(client.sendPushNotificationsAsync([])).rejects.toThrowError(
      `Expo responded with an error`
    );
  });

  test('handles well-formed API responses with multiple errors and extra details', async () => {
    (fetch as any).mock('https://exp.host/--/api/v2/push/send', {
      status: 400,
      body: {
        errors: [
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
        ],
      },
    });

    const client = new ExpoClient();
    const rejection = expect(client.sendPushNotificationsAsync([])).rejects;
    await rejection.toThrowError(`This is a test error`);
    await rejection.toMatchObject({
      code: 'TEST_API_ERROR',
      details: { __debug: 'test debug information' },
      serverStack: expect.any(String),
      others: expect.arrayContaining([expect.any(Error)]),
    });
  });

  test('handles 429 Too Many Requests by applying exponential backoff', async () => {
    (fetch as any).mock(
      'https://exp.host/--/api/v2/push/send',
      {
        status: 429,
        body: {
          errors: [{ code: 'RATE_LIMIT_ERROR', message: `Rate limit exceeded` }],
        },
      },
      { repeat: 3 }
    );

    const client = new ExpoClient();
    const ticketPromise = client.sendPushNotificationsAsync([]);

    const rejection = expect(ticketPromise).rejects;
    await rejection.toThrowError(`Rate limit exceeded`);
    await rejection.toMatchObject({ code: 'RATE_LIMIT_ERROR' });

    expect((fetch as any).done()).toBeTruthy();
  });

  test('handles 429 Too Many Requests and succeeds when a retry succeeds', async () => {
    const mockTickets = [
      { status: 'ok', id: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX' },
      { status: 'ok', id: 'YYYYYYYY-YYYY-YYYY-YYYY-YYYYYYYYYYYY' },
    ];
    (fetch as any)
      .mock(
        'https://exp.host/--/api/v2/push/send',
        {
          status: 429,
          body: {
            errors: [{ code: 'RATE_LIMIT_ERROR', message: `Rate limit exceeded` }],
          },
        },
        { repeat: 2 }
      )
      .mock(
        'https://exp.host/--/api/v2/push/send',
        { data: mockTickets },
        { overwriteRoutes: false }
      );

    const client = new ExpoClient();
    await expect(client.sendPushNotificationsAsync([{ to: 'a' }, { to: 'b' }])).resolves.toEqual(
      mockTickets
    );

    expect((fetch as any).done()).toBeTruthy();
  });
});

describe('retrieving push notification receipts', () => {
  test('gets receipts from the Expo API server', async () => {
    const mockReceipts = {
      'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX': { status: 'ok' },
      'YYYYYYYY-YYYY-YYYY-YYYY-YYYYYYYYYYYY': { status: 'ok' },
    };
    (fetch as any).mock('https://exp.host/--/api/v2/push/getReceipts', { data: mockReceipts });

    const client = new ExpoClient();
    const receipts = await client.getPushNotificationReceiptsAsync([
      'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX',
      'YYYYYYYY-YYYY-YYYY-YYYY-YYYYYYYYYYYY',
    ]);
    expect(receipts).toEqual(mockReceipts);

    const [, options] = (fetch as any).lastCall('https://exp.host/--/api/v2/push/getReceipts');
    expect(options.headers.get('accept')).toContain('application/json');
    expect(options.headers.get('accept-encoding')).toContain('gzip');
    expect(options.headers.get('content-type')).toContain('application/json');
  });

  test('throws an error if the response is not a map', async () => {
    const mockReceipts = [{ status: 'ok' }];
    (fetch as any).mock('https://exp.host/--/api/v2/push/getReceipts', { data: mockReceipts });

    const client = new ExpoClient();
    const rejection = expect(
      client.getPushNotificationReceiptsAsync(['XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX'])
    ).rejects;
    await rejection.toThrowError(`Expected Expo to respond with a map`);
    await rejection.toMatchObject({ data: mockReceipts });
  });
});

describe('chunking push notification messages', () => {
  test('defines the push notification chunk size', () => {
    expect(ExpoClient.pushNotificationChunkSizeLimit).toBeDefined();
  });

  test('chunks lists of push notification messages', () => {
    const client = new ExpoClient();
    const messages = new Array(999).fill({ to: '?' });
    const chunks = client.chunkPushNotifications(messages);
    let totalMessageCount = 0;
    for (const chunk of chunks) {
      totalMessageCount += chunk.length;
    }
    expect(totalMessageCount).toBe(messages.length);
  });

  test('can chunk small lists of push notification messages', () => {
    const client = new ExpoClient();
    const messages = new Array(10).fill({ to: '?' });
    const chunks = client.chunkPushNotifications(messages);
    expect(chunks.length).toBe(1);
    expect(chunks[0].length).toBe(10);
  });

  test('chunks single push notification message with lists of recipients', () => {
    const messagesLength = 999;

    const client = new ExpoClient();
    const messages = [{ to: new Array(messagesLength).fill('?') }];
    const chunks = client.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      // Each chunk should only contain a single message with 100 recipients
      expect(chunk.length).toBe(1);
    }
    const totalMessageCount = countAndValidateMessages(chunks);
    expect(totalMessageCount).toBe(messagesLength);
  });

  test('can chunk single push notification message with small lists of recipients', () => {
    const messagesLength = 10;

    const client = new ExpoClient();
    const messages = [{ to: new Array(messagesLength).fill('?') }];
    const chunks = client.chunkPushNotifications(messages);
    expect(chunks.length).toBe(1);
    expect(chunks[0].length).toBe(1);
    expect(chunks[0][0].to.length).toBe(messagesLength);
  });

  test('chunks push notification messages mixed with lists of recipients and single recipient', () => {
    const client = new ExpoClient();
    const messages = [
      { to: new Array(888).fill('?') },
      ...new Array(999).fill({
        to: '?',
      }),
      { to: new Array(90).fill('?') },
      ...new Array(10).fill({ to: '?' }),
    ];
    const chunks = client.chunkPushNotifications(messages);
    const totalMessageCount = countAndValidateMessages(chunks);
    expect(totalMessageCount).toBe(888 + 999 + 90 + 10);
  });
});

describe('chunking a single push notification message with multiple recipients', () => {
  const client = new ExpoClient();

  test('one message with 100 recipients', () => {
    const messages = [{ to: new Array(100).fill('?') }];
    const chunks = client.chunkPushNotifications(messages);
    expect(chunks.length).toBe(1);
    expect(chunks[0].length).toBe(1);
    expect(chunks[0][0].to.length).toBe(100);
  });

  test('one message with 101 recipients', () => {
    const messages = [{ to: new Array(101).fill('?') }];
    const chunks = client.chunkPushNotifications(messages);
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(1);
    expect(chunks[1].length).toBe(1);
    const totalMessageCount = countAndValidateMessages(chunks);
    expect(totalMessageCount).toBe(101);
  });

  test('one message with 99 recipients and two additional messages', () => {
    const messages = [{ to: new Array(99).fill('?') }, ...new Array(2).fill({ to: '?' })];
    const chunks = client.chunkPushNotifications(messages);
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(2);
    expect(chunks[1].length).toBe(1);
    const totalMessageCount = countAndValidateMessages(chunks);
    expect(totalMessageCount).toBe(99 + 2);
  });

  test('one message with 100 recipients and two additional messages', () => {
    const messages = [{ to: new Array(100).fill('?') }, ...new Array(2).fill({ to: '?' })];
    const chunks = client.chunkPushNotifications(messages);
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(1);
    expect(chunks[1].length).toBe(2);
    const totalMessageCount = countAndValidateMessages(chunks);
    expect(totalMessageCount).toBe(100 + 2);
  });

  test('99 messages and one additional message with with two recipients', () => {
    const messages = [...new Array(99).fill({ to: '?' }), { to: new Array(2).fill('?') }];
    const chunks = client.chunkPushNotifications(messages);
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(100);
    expect(chunks[1].length).toBe(1);
    const totalMessageCount = countAndValidateMessages(chunks);
    expect(totalMessageCount).toBe(99 + 2);
  });

  test('no message', () => {
    const messages: ExpoPushMessage[] = [];
    const chunks = client.chunkPushNotifications(messages);
    expect(chunks.length).toBe(0);
  });

  test('one message with no recipient', () => {
    const messages = [{ to: [] }];
    const chunks = client.chunkPushNotifications(messages);
    expect(chunks.length).toBe(0);
  });

  test('two messages and one additional message with no recipient', () => {
    const messages = [...new Array(2).fill({ to: '?' }), { to: [] }];
    const chunks = client.chunkPushNotifications(messages);
    expect(chunks.length).toBe(1);
    // The message with no recipient should be removed.
    expect(chunks[0].length).toBe(2);
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

test('can detect an Expo push token', () => {
  expect(ExpoClient.isExpoPushToken('ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]')).toBe(true);
  expect(ExpoClient.isExpoPushToken('ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]')).toBe(true);

  expect(ExpoClient.isExpoPushToken('F5741A13-BCDA-434B-A316-5DC0E6FFA94F')).toBe(true);

  // FCM
  expect(
    ExpoClient.isExpoPushToken(
      'dOKpuo4qbsM:APA91bHkSmF84ROx7Y-2eMGxc0lmpQeN33ZwDMG763dkjd8yjKK-rhPtiR1OoIWNG5ZshlL8oyxsTnQ5XtahyBNS9mJAvfeE6aHzv_mOF_Ve4vL2po4clMIYYV2-Iea_sZVJF7xFLXih4Y0y88JNYULxFfz-XXXXX'
    )
  ).toBe(false);
  // APNs
  expect(
    ExpoClient.isExpoPushToken('5fa729c6e535eb568g18fdabd35785fc60f41c161d9d7cf4b0bbb0d92437fda0')
  ).toBe(false);
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
