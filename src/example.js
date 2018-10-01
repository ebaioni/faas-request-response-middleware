// @flow
import { FaasMiddleware } from './index';

const lambdaHandler = (event, context, callback) => {
    const fakePayload = {
        temp1: true,
        temp2: 'hello',
        temp3: {
            enrico: true,
        },
    };
    return callback(null, fakePayload);
};
const paramValidation = (event, context) => false;
const options = {
    responseToBeAPIGWComplaint: 'yes'
};
const fmw = new FaasMiddleware(lambdaHandler, null, null, paramValidation, paramValidation, options);

module.exports.handler = fmw.faasMwValidateThenTransform();
