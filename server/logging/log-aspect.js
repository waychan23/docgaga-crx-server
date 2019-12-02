const logger = require('./logger');
const uuid = require('uuid');
function LogAspect(){
    return aspect;
}

async function aspect(ctx, next){
    const startTime = new Date().getTime();
    let success = true;
    ctx.state.logging = {
        traceId: uuid.v1()
    }
    try {
        await next();
    } catch(e) {
        logger.error(e);
        success = false;
        throw e;
    } finally {
        const costTime = new Date().getTime() - startTime;
        logger.info('api,%s,%s,%dms,%s,%s,request.body=%s,response.body=%s', ctx.state.logging.traceId, (success?'T':'F'), costTime, ctx.method, ctx.url, serializeBody(ctx.request.body), serializeBody(ctx.body));
        ctx.state.logging = null;
    }
};

function serializeBody(body){
    if(!body){
        return body;
    }
    return JSON.stringify(body);
}

module.exports = LogAspect;