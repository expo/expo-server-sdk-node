import { isExponentPushToken, sendPushNotificationAsync } from '../';
jest.mock('node-fetch');

it('Should return false when not passing a valid exponentPushToken', () => {
    expect(isExponentPushToken('notanexponentpushtoken')).toBe(false);
});

it('Should return true when passing a valid exponentPushToken', () => {
    expect(isExponentPushToken('ExponentPushToken[Re4MeUKjYWNd0FXSj8Eppi]')).toBe(true);
})

it('Should throw error when passing an invalid exponentPushToken', async () => {
    // Setup
    const fetchSpy = jest.fn();
    let fetch = require('node-fetch');
    fetch.setCallback(fetchSpy);
    fetch.setReturnStatus(200);
    const opts = { exponentPushToken: 'invalidtoken' };

    // Test
    try {
        await sendPushNotificationAsync(opts)
    }
    catch(error) {
        expect(error.message).toBe(
            "Missing `exponentPushToken`. Should be something like "  +
            "`ExponentPushToken[Re4MeUKjYWNd0FXSj8Eppi]` but instead got `invalidtoken`"
        );
        expect(fetchSpy).not.toBeCalled();
    }
})

it('Should call api with fetch when valid exponentPushToken is passed with a message', async () => {
    // Setup
    const fetchSpy = jest.fn();
    let fetch = require('node-fetch');
    fetch.setCallback(fetchSpy);
    fetch.setReturnStatus(200);
    const options = {
        exponentPushToken: 'ExponentPushToken[Re4MeUKjYWNd0FXSj8Eppi]',
        data: { aNumber: 1 },
        message: 'A notification message'
    };

    // Test
    await sendPushNotificationAsync(options);
    expect(fetchSpy).toBeCalledWith(
        'https://exp.host/--/api/notify',
        {
            "body": "{\"aNumber\":1,\"exponentPushToken\":\"ExponentPushToken[Re4MeUKjYWNd0FXSj8Eppi]\",\"message\":\"A notification message\"}", 
            "headers": {}, 
            "method": "POST"
        }
    )
})

it('Should call api with fetch when valid exponentPushToken is passed and no message', async () => {
    // Setup
    const fetchSpy = jest.fn();
    let fetch = require('node-fetch');
    fetch.setCallback(fetchSpy);
    fetch.setReturnStatus(200);
    const options = {
        exponentPushToken: 'ExponentPushToken[Re4MeUKjYWNd0FXSj8Eppi]',
        data: { aNumber: 1 },
        message: false
    };

    // Test
    await sendPushNotificationAsync(options);
    expect(fetchSpy).toBeCalledWith(
        'https://exp.host/--/api/notify',
        {
            "body": "{\"aNumber\":1,\"exponentPushToken\":\"ExponentPushToken[Re4MeUKjYWNd0FXSj8Eppi]\"}", 
            "headers": {}, 
            "method": "POST"
        }
    )
})

it('Should throw an error when status code of 400 is returned', async () => {
    // Setup
    const fetchSpy = jest.fn();
    let fetch = require('node-fetch');
    fetch.setCallback(fetchSpy);
    fetch.setReturnStatus(400);
    const options = {
        exponentPushToken: 'ExponentPushToken[Re4MeUKjYWNd0FXSj8Eppi]',
        data: { aNumber: 1 },
        message: 'A notification message'
    };

    // Test
    try {
        await sendPushNotificationAsync(options);
    }
    catch(error) {
        expect(error.message).toBe('Invalid Exponent Push Token: ExponentPushToken[Re4MeUKjYWNd0FXSj8Eppi]');
        expect(fetchSpy).toBeCalledWith(
            'https://exp.host/--/api/notify',
            {
                "body": "{\"aNumber\":1,\"exponentPushToken\":\"ExponentPushToken[Re4MeUKjYWNd0FXSj8Eppi]\",\"message\":\"A notification message\"}", 
                "headers": {}, 
                "method": "POST"
            }
        )
    }

})

it('Should throw an error when status code other than 200 or 400 is returned', async () => {
    // Setup
    const spy = jest.fn();
    let fetch = require('node-fetch');
    fetch.setCallback(spy);
    fetch.setReturnStatus(300);
    const options = {
        exponentPushToken: 'ExponentPushToken[Re4MeUKjYWNd0FXSj8Eppi]',
        data: { aNumber: 1 },
        message: 'A notification message'
    };

    // Test
    try {
        await sendPushNotificationAsync(options);
    }
    catch(error) {
       expect(error.message).toBe('Error sending push notification: some error');
       expect(spy).toBeCalledWith(
            'https://exp.host/--/api/notify',
            {
                "body": "{\"aNumber\":1,\"exponentPushToken\":\"ExponentPushToken[Re4MeUKjYWNd0FXSj8Eppi]\",\"message\":\"A notification message\"}", 
                "headers": {}, 
                "method": "POST"
            }
        );
    }

})