let callBack;
let returnStatus = 200;

export const Headers = function(){}
export const setCallback = cb => callBack = cb;
export const setReturnStatus = status => returnStatus = status;

export default function(url, options) {
    if(callBack) {
        callBack(url, options);
    }
    return new Promise((resolve, reject) => {
        resolve({ status: returnStatus, json: () => ({ err: 'some error' }) });
    }) 
};