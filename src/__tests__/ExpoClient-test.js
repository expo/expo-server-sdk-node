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
