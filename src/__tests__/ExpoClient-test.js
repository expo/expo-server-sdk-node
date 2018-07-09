import ExpoClient from '../ExpoClient';

it('chunks lists of push notification messages', () => {
  let client = new ExpoClient();
  let messages = new Array(999).fill({ to: '?' });
  let chunks = client.chunkPushNotifications(messages);
  let totalMessageCount = 0;
  for (let chunk of chunks) {
    totalMessageCount += chunk.length;
  }
  expect(totalMessageCount).toBe(messages.length);
});

it('can chunk small lists of push notification messages', () => {
  let client = new ExpoClient();
  let messages = new Array(10).fill({ to: '?' });
  let chunks = client.chunkPushNotifications(messages);
  expect(chunks.length).toBe(1);
  expect(chunks[0].length).toBe(10);
});

it('defines the push notification chunk size', () => {
  expect(ExpoClient.pushNotificationChunkSizeLimit).toBeDefined();
});

it('chunks lists of push notification receipt IDs', () => {
  let client = new ExpoClient();
  let receiptIds = new Array(2999).fill('F5741A13-BCDA-434B-A316-5DC0E6FFA94F');
  let chunks = client.chunkPushNotificationReceiptIds(receiptIds);
  let totalReceiptIdCount = 0;
  for (let chunk of chunks) {
    totalReceiptIdCount += chunk.length;
  }
  expect(totalReceiptIdCount).toBe(receiptIds.length);
});

it('defines the push notification receipt ID chunk size', () => {
  expect(ExpoClient.pushNotificationReceiptChunkSizeLimit).toBeDefined();
});

it('can detect an Expo push token', () => {
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
