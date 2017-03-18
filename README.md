# exponent-server-sdk-node
Server side library for working with Exponent using Node.js

## Usage

```bash
yarn add exponent-server-sdk
```

```js
import Expo from 'exponent-server-sdk';

// To check if something is a push token
let isPushToken = Expo.isExponentPushToken(somePushToken);

// Create a new Expo SDK client
let expo = new Expo();

// To send push notifications -- note that there is a limit on the number of
// notifications you can send at once, use expo.chunkPushNotifications()
(async function() {
  try {
    let receipts = await expo.sendPushNotificationsAsync([{
      // The push token for the app user to whom you want to send the notification
      to: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
      sound: 'default',
      body: 'This is a test notification',
      data: {withSome: 'data'},
    }]);
    console.log(receipts);
  } catch (error) {
    console.error(error);
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

  * https://github.com/exponent/exponent-server-sdk-ruby
  * https://github.com/exponent/exponent-server-sdk-python
