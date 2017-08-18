# expo-server-sdk-node [![CircleCI](https://circleci.com/gh/expo/exponent-server-sdk-node.svg?style=svg)](https://circleci.com/gh/expo/exponent-server-sdk-node) [![codecov](https://codecov.io/gh/expo/exponent-server-sdk-node/branch/master/graph/badge.svg)](https://codecov.io/gh/expo/exponent-server-sdk-node)
Server side library for working with Expo using Node.js

## Usage

```bash
yarn add expo-server-sdk
```

```js
import Expo from 'expo-server-sdk';

// Create a new Expo SDK client
let expo = new Expo();

// Create the messages that you want to send to clents
let messages = [];
for (let pushToken of somePushTokens) {
  // Each push token looks like ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]

  // Check that all your push tokens appear to be valid Expo push tokens
  if (!Expo.isExpoPushToken(pushToken)) {
    console.error(`Push token ${pushToken} is not a valid Expo push token`);
    continue;
  }

  // Construct a message (see https://docs.expo.io/versions/latest/guides/push-notifications.html)
  messages.push({
    to: pushToken,
    sound: 'default',
    body: 'This is a test notification',
    data: { withSome: 'data' },
  })
}

// The Expo push notification service accepts batches of notifications so
// that you don't need to send 1000 requests to send 1000 notifications. We
// recommend you batch your notifications to reduce the number of requests
// and to compress them (notifications with similar content will get
// compressed).
let chunks = expo.chunkPushNotifications(messages);

(async () => {
  // Send the chunks to the Expo push notification service. There are
  // different strategies you could use. A simple one is to send one chunk at a
  // time, which nicely spreads the load out over time:
  for (let chunk of chunks) {
    try {
      let receipts = await expo.sendPushNotificationsAsync(chunk);
      console.log(receipts);
    } catch (error) {
      console.error(error);
    }
  }
})();
```

## Developing

The source code is in the `src/` directory and babel is used to turn it into ES5 that goes in the `build/` directory.

To build, `npm run build`.

To build and watch for changes, `npm run watch`.

## TODO

  * Need to add tests

## See Also

  * https://github.com/expo/expo-server-sdk-ruby
  * https://github.com/expo/expo-server-sdk-python
