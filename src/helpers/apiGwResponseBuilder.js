// @flow
function responseBuilder(statusCode: number, body: any, headers: any) {
    const t = typeof body === 'string' ? body : JSON.stringify(body);
    return {
        statusCode,
        body: t,
        headers,
    };
}

export function buildBadRequest() {
    return responseBuilder(400, 'Custom bad request');
}

export function buildNotFound() {
    return responseBuilder(404, 'Custom not found');
}

export function buildOk(response: any) {
    return responseBuilder(200, response);
}

export function buildServerError(error: any) {
    return responseBuilder(500, error);
}
