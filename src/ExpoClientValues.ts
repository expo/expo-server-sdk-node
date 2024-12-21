/**
 * The URLs for the Expo push service endpoints.
 *
 * The EXPO_BASE_URL environment variable is only for internal Expo use
 * when testing the push service locally.
 */
const baseUrl = process.env['EXPO_BASE_URL'] ?? 'https://exp.host';

export const sendApiUrl = `${baseUrl}/--/api/v2/push/send`;

export const getReceiptsApiUrl = `${baseUrl}/--/api/v2/push/getReceipts`;

/**
 * The max number of push notifications to be sent at once. Since we can't automatically upgrade
 * everyone using this library, we should strongly try not to decrease it.
 */
export const pushNotificationChunkLimit = 100;

/**
 * The max number of push notification receipts to request at once.
 */
export const pushNotificationReceiptChunkLimit = 300;

/**
 * The default max number of concurrent HTTP requests to send at once and spread out the load,
 * increasing the reliability of notification delivery.
 */
export const defaultConcurrentRequestLimit = 6;

/**
 * Minimum timeout in ms for request retries.
 */
export const requestRetryMinTimeout = 1000;
