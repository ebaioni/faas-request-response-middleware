// @flow
import {
    buildBadRequest, buildOk, buildServerError,
} from './helpers/apiGwResponseBuilder';

// eslint-disable-next-line no-unused-vars
const alwaysTrue = (e: any, ctx: any): boolean => true;
// eslint-disable-next-line no-unused-vars
const identity = (e: any, ctx: any): any => e;

type FaasMWOptions = {
    responseToBeAPIGWComplaint?: 'yes' | 'no' | 'auto',
    validateFrom?: 'apigw' | 'other' | 'both' | 'none'
}

const defaultOptions: FaasMWOptions = {
    responseToBeAPIGWComplaint: 'auto',
    validateFrom: 'both',
};

export class FaasMiddleware {
    reqV: Function;

    reqT: Function;

    resV: Function;

    resT: Function;

    originalHandler: Function;

    options: FaasMWOptions;

    constructor(
        originalHandler: Function,
        reqValidator: ?Function,
        reqTransform: ?Function,
        resValidator: ?Function,
        resTransform: ?Function,
        options: ?FaasMWOptions
    ) {
        this.originalHandler = originalHandler;
        this.reqV = alwaysTrue;
        this.reqT = identity;
        this.resV = alwaysTrue;
        this.resT = identity;

        if (reqValidator) {
            this.reqV = reqValidator;
        }
        if (reqTransform) {
            this.reqT = reqTransform;
        }
        if (resValidator) {
            this.resV = resValidator;
        }
        if (resTransform) {
            this.resT = resTransform;
        }

        this.options = Object.assign({}, defaultOptions, options || {});
    }

    /**
     * Determines whether an API Gateway response is required
     * @param {Object} event
     * @returns {boolean}
     */
    shouldPrepareApiGatewayResponse(event: any): boolean {
        if (this.options.responseToBeAPIGWComplaint === 'yes') {
            return true;
        }
        if (this.options.responseToBeAPIGWComplaint === 'no') {
            return false;
        }
        return this.isApiGwRequest(event);
    }

    /**
     * Guess whether request is coming from ApiGateway
     * @param {Object} event
     * @returns {boolean}
     */
    isApiGwRequest(event: any): boolean {
        return event && event.requestContext && event.requestContext.resourceId;
    }

    /**
     * Determines whether both request and response should be validated
     * @param {Object} event
     * @returns {boolean}
     */
    shouldUseValidator(event: any): boolean {
        if (this.options.validateFrom === 'both') {
            return true;
        }
        if (this.options.validateFrom === 'apigw' && this.isApiGwRequest(event)) {
            return true;
        }
        if (this.options.validateFrom === 'other' && !this.isApiGwRequest(event)) {
            return true;
        }
        return false;
    }

    /**
     * Behaviour applied: Validate first, then transform
     * @returns {Function}
     */
    faasMwValidateThenTransform() {
        return (event: any, context: any, callback: Function) => {
            const buildApiResponse = this.shouldPrepareApiGatewayResponse(event);
            const useValidator = this.shouldUseValidator(event);
            if (useValidator && !this.reqV(event)) {
                return buildApiResponse ? callback(null, buildBadRequest()) : callback({ message: 'invalid request' });
            }
            const transformedEvent = this.reqT(event, context);
            this.originalHandler(transformedEvent, context, (err, res) => {
                if (err) {
                    return buildApiResponse ? callback(null, buildServerError(err)) : callback(err);
                }
                if (useValidator && !this.resV(res)) {
                    const message = {
                        message: 'invalid response',
                        response: res,
                    };
                    return buildApiResponse ? callback(null, buildServerError(message)) : callback(message);
                }
                try {
                    const transformedResponse = this.resT(res, context);
                    return callback(null, buildApiResponse ? buildOk(transformedResponse) : transformedResponse);
                } catch (e) {
                    console.error(e);
                    return buildApiResponse ? callback(null, buildServerError(e)) : callback(e);
                }
            });
        };
    }

    /**
     * Behaviour applied: Transform first, then validate
     * @returns {Function}
     */
    faasMwTransformThenValidate() {
        return (event: any, context: any, callback: Function) => {
            const buildApiResponse = this.shouldPrepareApiGatewayResponse(event);
            const useValidator = this.shouldUseValidator(event);
            const transformedEvent = this.reqT(event, context);
            if (useValidator && !this.reqV(transformedEvent)) {
                return buildApiResponse ? callback(null, buildBadRequest()) : callback({ message: 'invalid request' });
            }
            this.originalHandler(transformedEvent, context, (err, res) => {
                if (err) {
                    return buildApiResponse ? callback(null, buildServerError(err)) : callback(err);
                }
                try {
                    const transformedResponse = this.resT(res, context);
                    if (useValidator && !this.resV(transformedResponse)) {
                        const message = {
                            message: 'invalid response',
                            response: transformedResponse,
                        };
                        return buildApiResponse ? callback(null, buildServerError(message)) : callback(message);
                    }
                    return callback(null, buildApiResponse ? buildOk(transformedResponse) : transformedResponse);
                } catch (e) {
                    console.error(e);
                    return buildApiResponse ? callback(null, buildServerError(e)) : callback(e);
                }
            });
        };
    }
}
