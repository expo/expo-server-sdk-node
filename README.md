# exponent-server-sdk-node
Server side library for working with Exponent using Node.js

## Usage

```bash
yarn add exponent-server-sdk
```

```js
import Exponent from 'exponent-server-sdk';

// To check if something is a push token
let isPushToken = Exponent.isExponentPushToken(somePushToken);

// Create a new Exponent SDK client
let exponent = new Exponent();

// To send push notifications
(async function() {
  try {
    let receipts = await exponent.sendPushNotificationsAsync([{
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
