# expo-server-sdk-node [![Tests](https://github.com/expo/expo-server-sdk-node/workflows/Tests/badge.svg)](https://github.com/expo/expo-server-sdk-node/actions/workflows/tests.yml) [![codecov](https://codecov.io/gh/expo/expo-server-sdk-node/branch/master/graph/badge.svg)](https://codecov.io/gh/expo/expo-server-sdk-node)

Server-side library for working with Expo Push Service using Node.js.

If you have problems with the code in this repository, please file issues & bug reports at https://github.com/expo/expo. Thanks!

## Usage

```bash
yarn add expo-server-sdk
```

```ts
// Create a new Expo SDK client
// optionally provide an access token if you have enabled push security
const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN,
});

const targetPushTokens: string[] = [];

// Create the messages that you want to send to clients
const messages = targetPushTokens.map((pushToken) => {
  // Each push token looks like "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
  // Check that all push tokens have valid Expo push token format
  if (!Expo.isExpoPushToken(pushToken)) {
    throw new Error(`Push token ${pushToken} is not a valid Expo push token`);
  }
  return {
    to: pushToken,
    body: 'This is a test notification',
    badge: 2,
    data: { withSome: 'data' },
    richContent: {
      image: 'https://example.com/statics/some-image-here-if-you-want.jpg'
    },
  })
}

// The Expo push notification service accepts batches of notifications so
// that you don't need to send 1000 requests to send 1000 notifications. We
// recommend you batch your notifications to reduce the number of requests
// and to compress them (notifications with similar content will get
// compressed).
const chunks = expo.chunkPushNotifications(messages);
let tickets = [];
// Send the chunks to the Expo push notification service. There are
// different strategies you could use. A simple one is to send one chunk at a
// time, which nicely spreads the load out over time:
for (const chunk of chunks) {
  try {
    const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
    console.log('result of sending push messages to Expo:', ticketChunk);
    tickets.push(...ticketChunk);
    // NOTE: If a ticket contains an error code in ticket.details.error, you
    // must handle it appropriately. The error codes are listed in the Expo
    // documentation:
    // https://docs.expo.io/push-notifications/sending-notifications/#individual-errors
  } catch (error) {
    console.error(error);
  }
}
```

Later, after the Expo push notification service has delivered the
notifications to Apple or Google (usually quickly, but allow the service
up to 30 minutes when under load), a "receipt" for each notification is
created. The receipts will be available for at least a day; stale receipts
are deleted.

The ID of each receipt is sent back in the response "ticket" for each
notification. In summary, sending a notification produces a ticket, which
contains a receipt ID you later use to get the receipt.

The receipts may contain error codes to which you must respond. In
particular, Apple or Google may block apps that continue to send
notifications to devices that have blocked notifications or have uninstalled
your app. Expo does not control this policy and sends back the feedback from
Apple and Google so you can handle it appropriately.

```ts
// NOTE: Not all tickets have IDs; for example, tickets for notifications
// that could not be enqueued will have error information and no receipt ID.
const receiptIds = tickets.filter((ticket) => ticket.status === 'ok').map((ticket) => ticket.id);

const receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);

// Like sending notifications, there are different strategies you could use
// to retrieve batches of receipts from the Expo service.
for (let chunk of receiptIdChunks) {
  try {
    const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
    console.log({ chunk, receipts });

    // The receipts specify whether Apple or Google successfully received the
    // notification and information about an error, if one occurred.
    const failedReceipts = Object.values(receipts).filter((receipt) => receipt.status !== 'ok');

    failedReceipts.forEach(({ message, details }) => {
      console.error(`There was an error sending a notification: ${message}`);
      if (details && details.error) {
        // The error codes are listed in the Expo documentation:
        // https://docs.expo.io/push-notifications/sending-notifications/#individual-errors
        // You must handle the errors appropriately.
        console.error(`The error code is ${details.error}`);
      }
    });
  } catch (error) {
    console.error(error);
  }
}
```

## Developing

The `mise.toml` file lets you run the full CI pipeline with [mise](https://mise.jdx.dev) and the command `mise run ci`. Each task in the pipeline can also be run separately.

`mise install` or `mise en .` will also install tools for your current interactive shell, including [yarn](https://yarnpkg.com/).

Scripts in the `package.json` file can be run with either `yarn <name>` or `node --run <name>`.

The source code is in the `src/` directory and the build output is emitted in the `build/` directory. To build, run `yarn build`.

To typecheck continuously, run `yarn tsc --watch`.

To run tests, run `yarn test`.

## See Also

- https://github.com/expo-community/expo-server-sdk-ruby
- https://github.com/expo-community/expo-server-sdk-python
- https://github.com/katayama8000/expo-push-notification-client-rust
