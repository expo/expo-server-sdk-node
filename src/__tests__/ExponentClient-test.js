import ExponentClient from '../ExponentClient';

it('chunks lists of push notification messages', () => {
  let client = new ExponentClient();
  let messages = new Array(1000).fill({ to: '?' });
  let chunks = client.chunkPushNotifications(messages);
  let totalMessageCount = 0;
  for (let chunk of chunks) {
    totalMessageCount += chunk.length;
  }
  expect(totalMessageCount).toBe(messages.length);
});
