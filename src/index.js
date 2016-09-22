/**
 * exponent-server-sdk
 *
 * Use this if you are running Node on your server backend when you are working with Exponent
 * https://getexponent.com/
 *
 */

import fetch, { Headers } from 'node-fetch';

const BASE_URL = 'https://exp.host/';
const BASE_API_URL = `${BASE_URL}--/api`;

/**
 * Returns `true` if the token is an Exponent push token
 *
 */
export function isExponentPushToken(token) {
  return ((typeof(token) === 'string') && /^ExponentPushToken.+/.test(token));
}


/**
 * Sends a push notification with the given options and data
 *
 */
export async function sendPushNotificationAsync(opts) {
  let exponentPushToken = opts.exponentPushToken;

  if (!isExponentPushToken(exponentPushToken)) {
    throw new Error(`Missing \`exponentPushToken\`. Should be something like \
\`ExponentPushToken[Re4MeUKjYWNd0FXSj8Eppi]\` but instead got \
\`${exponentPushToken}\``);
  }

  let message = opts.message || undefined;
  const body = {
    ...opts.data,
    exponentPushToken,
    message,
  };

  let response = await fetch(`${BASE_API_URL}/notify`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: new Headers({
      'Content-Type': 'application/json',
    }),
  });

  if (response.status === 400) {
    throw new Error(`Invalid Exponent Push Token: ${exponentPushToken}`);
  }

  if (response.status === 200) {
    return undefined;
  } else {
    let json = await response.json();
    throw new Error(`Error sending push notification: ${json.err}`);
  }
}
