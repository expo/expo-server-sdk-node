# exponent-server-sdk-node
Server side library for working with Exponent using Node.js

## Usage

```bash
npm install --save exponent-server-sdk
```

```js
import {
  isExponentPushToken,
  sendPushNotificationAsync,
} from 'exponent-server-sdk';

// To check if something is a push token
let isPushToken = isExponentPushToken(somePushToken);

// To send a push notification
(async function () {
  await sendPushNotificationAsync({
    exponentPushToken: 'ExponentPushToken[Re4MeUKjYWNd0FXSj8Eppr]', // The push token for the app user you want to send the notification to
    message: "This is a test notification",
    data: {withSome: 'data'},
  });
})();

```

## Developing

The source code is in the `src/` directory and babel is used to turn it into ES5 that goes in the `lib/` directory.

To build, `npm run build`.

To build and watch for changes, `npm run watch`.

## TODO

  * Need to add tests

## See Also

  * https://github.com/exponentjs/exponent-server-sdk-ruby
  * https://github.com/exponentjs/exponent-server-sdk-python
