const Router = require('koa-router');

const appConfig = require('../config/app-conf');
const docgagaApiSdk = require('../sdk/docgaga-api-sdk');

module.exports = getApiRouter;

function getApiRouter(app, options={}){

    options = Object.assign({ prefix: '', config: appConfig }, options);

    var config = options.config,
        apiRouter = new Router({ prefix: options.prefix }),
        sdk = docgagaApiSdk(config.docgagaServerInfo.apiPathPrefix, { continueMiddleware: true });

    sdk.apiList.forEach(api => {
        apiRouter[api.method](api.path, api.handler);
    });

    return apiRouter;
}