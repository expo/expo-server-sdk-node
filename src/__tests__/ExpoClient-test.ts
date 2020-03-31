import ExpoClient, { ExpoPushMessage } from '../ExpoClient';

test('chunks lists of push notification messages', () => {
  let client = new ExpoClient();
  let messages = new Array(999).fill({ to: '?' });
  let chunks = client.chunkPushNotifications(messages);
  let totalMessageCount = 0;
  for (let chunk of chunks) {
    totalMessageCount += chunk.length;
  }
  expect(totalMessageCount).toBe(messages.length);
});

test('can chunk small lists of push notification messages', () => {
  let client = new ExpoClient();
  let messages = new Array(10).fill({ to: '?' });
  let chunks = client.chunkPushNotifications(messages);
  expect(chunks.length).toBe(1);
  expect(chunks[0].length).toBe(10);
});

test('chunks single push notification message with lists of recipients', () => {
  const messagesLength = 999;

  let client = new ExpoClient();
  let messages = [{ to: new Array(messagesLength).fill('?') }];
  let chunks = client.chunkPushNotifications(messages);
  for (let chunk of chunks) {
    // Each chunk should only contain a single message with 100 recipients
    expect(chunk.length).toBe(1);
  }
  let totalMessageCount = countAndValidateMessages(chunks);
  expect(totalMessageCount).toBe(messagesLength);
});

test('can chunk single push notification message with small lists of recipients', () => {
  const messagesLength = 10;

  let client = new ExpoClient();
  let messages = [{ to: new Array(messagesLength).fill('?') }];
  let chunks = client.chunkPushNotifications(messages);
  expect(chunks.length).toBe(1);
  expect(chunks[0].length).toBe(1);
  expect(chunks[0][0].to.length).toBe(messagesLength);
});

test('chunks push notification messages mixed with lists of recipients and single recipient', () => {
  let client = new ExpoClient();
  let messages = [
    { to: new Array(888).fill('?') },
    ...new Array(999).fill({
      to: '?',
    }),
    { to: new Array(90).fill('?') },
    ...new Array(10).fill({ to: '?' }),
  ];
  let chunks = client.chunkPushNotifications(messages);
  let totalMessageCount = countAndValidateMessages(chunks);
  expect(totalMessageCount).toBe(888 + 999 + 90 + 10);
});

describe('chunking a single push notification message with multiple recipients', () => {
  let client = new ExpoClient();

  test('one message with 100 recipients', () => {
    let messages = [{ to: new Array(100).fill('?') }];
    let chunks = client.chunkPushNotifications(messages);
    expect(chunks.length).toBe(1);
    expect(chunks[0].length).toBe(1);
    expect(chunks[0][0].to.length).toBe(100);
  });

  test('one message with 101 recipients', () => {
    let messages = [{ to: new Array(101).fill('?') }];
    let chunks = client.chunkPushNotifications(messages);
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(1);
    expect(chunks[1].length).toBe(1);
    let totalMessageCount = countAndValidateMessages(chunks);
    expect(totalMessageCount).toBe(101);
  });

  test('one message with 99 recipients and two additional messages', () => {
    let messages = [{ to: new Array(99).fill('?') }, ...new Array(2).fill({ to: '?' })];
    let chunks = client.chunkPushNotifications(messages);
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(2);
    expect(chunks[1].length).toBe(1);
    let totalMessageCount = countAndValidateMessages(chunks);
    expect(totalMessageCount).toBe(99 + 2);
  });

  test('one message with 100 recipients and two additional messages', () => {
    let messages = [{ to: new Array(100).fill('?') }, ...new Array(2).fill({ to: '?' })];
    let chunks = client.chunkPushNotifications(messages);
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(1);
    expect(chunks[1].length).toBe(2);
    let totalMessageCount = countAndValidateMessages(chunks);
    expect(totalMessageCount).toBe(100 + 2);
  });

  test('99 messages and one additional message with with two recipients', () => {
    let messages = [...new Array(99).fill({ to: '?' }), { to: new Array(2).fill('?') }];
    let chunks = client.chunkPushNotifications(messages);
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(100);
    expect(chunks[1].length).toBe(1);
    let totalMessageCount = countAndValidateMessages(chunks);
    expect(totalMessageCount).toBe(99 + 2);
  });

  test('no message', () => {
    let messages: ExpoPushMessage[] = [];
    let chunks = client.chunkPushNotifications(messages);
    expect(chunks.length).toBe(0);
  });

  test('one message with no recipient', () => {
    let messages = [{ to: [] }];
    let chunks = client.chunkPushNotifications(messages);
    expect(chunks.length).toBe(0);
  });

  test('two message and one additional message with no recipient', () => {
    let messages = [...new Array(2).fill({ to: '?' }), { to: [] }];
    let chunks = client.chunkPushNotifications(messages);
    expect(chunks.length).toBe(1);
    // The message with no recipient should be removed.
    expect(chunks[0].length).toBe(2);
    let totalMessageCount = countAndValidateMessages(chunks);
    expect(totalMessageCount).toBe(2);
  });
});

test('defines the push notification chunk size', () => {
  expect(ExpoClient.pushNotificationChunkSizeLimit).toBeDefined();
});

test('chunks lists of push notification receipt IDs', () => {
  let client = new ExpoClient();
  let receiptIds = new Array(2999).fill('F5741A13-BCDA-434B-A316-5DC0E6FFA94F');
  let chunks = client.chunkPushNotificationReceiptIds(receiptIds);
  let totalReceiptIdCount = 0;
  for (let chunk of chunks) {
    totalReceiptIdCount += chunk.length;
  }
  expect(totalReceiptIdCount).toBe(receiptIds.length);
});

test('defines the push notification receipt ID chunk size', () => {
  expect(ExpoClient.pushNotificationReceiptChunkSizeLimit).toBeDefined();
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

function countAndValidateMessages(chunks: ExpoPushMessage[][]) {
  let totalMessageCount = 0;
  for (let chunk of chunks) {
    let chunkMessagesCount = ExpoClient._getActualMessageCount(chunk);
    expect(chunkMessagesCount).toBeLessThanOrEqual(ExpoClient.pushNotificationChunkSizeLimit);
    totalMessageCount += chunkMessagesCount;
  }
  return totalMessageCount;
}
