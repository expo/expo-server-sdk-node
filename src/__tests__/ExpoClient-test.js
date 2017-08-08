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

it('can detect an Expo push token', () => {
  expect(ExpoClient.isExpoPushToken('ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]')).toBe(true);
  expect(ExpoClient.isExpoPushToken('ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]')).toBe(true);
  expect(ExpoClient.isExponentPushToken('ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]')).toBe(true);
  expect(ExpoClient.isExponentPushToken('ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]')).toBe(true);

  expect(ExpoClient.isExpoPushToken('F5741A13-BCDA-434B-A316-5DC0E6FF6B69')).toBe(false);
  expect(ExpoClient.isExpoPushToken('F5741A13-BCDA-434B-A316-5DC0E6FF6B69')).toBe(false);
  expect(ExpoClient.isExponentPushToken('F5741A13-BCDA-434B-A316-5DC0E6FF6B69')).toBe(false);
  expect(ExpoClient.isExponentPushToken('F5741A13-BCDA-434B-A316-5DC0E6FF6B69')).toBe(false);
});
