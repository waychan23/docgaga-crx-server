const Router = require('koa-router');
const path = require('path');
const templateRenderer = require('../renderers/template-renderer');

const ERRORS = {
	'denied': '授权请求被拒绝',
	'invalid_state': '请求已过期，为了您的信息安全，正在为您刷新页面...',
	'login_timeout': '登录超时，请重新请求登录',
	'retry': '重新请求'
};

function getViewRouter(app, options = { prefix: '' }){
    var viewRouter = new Router(options);

    viewRouter.get('/redirect', async (ctx, next) => {
        var reqData = ctx.request.query || {},
            redirectUri = reqData.redirect_uri,
            msg = reqData.msg;

        msg = ERRORS[msg] || '正在跳转...';

        ctx.state.viewName = 'redirect';
        ctx.state.viewModel = {
            msg: msg,
            redirectUri: redirectUri,
            waitSeconds: 1.3,
        };

        await next();
    });

    viewRouter.get('/error', async (ctx, next) => {
        var reqData = ctx.request.query || {},
            error = reqData.error,
            ticket = reqData.ticket,
            retry = (error == 'retry');

        if(retry){
            if(ticket){
                ctx.redirect(`/docgagacrx/auth?ticket=${encodeURIComponent(ticket)}`);
                return;
            }else{
                error = 'unknown';
            }
        }

        error = ERRORS[error] || '授权请求失败';
        
        ctx.state.viewName = 'error';
        ctx.state.viewModel = {
            'error': error,
            'links': null
        };

        if(ticket){
            ctx.state.viewModel.links = [
                { name: '重新请求授权', href: `/docgagacrx/auth?ticket=${encodeURIComponent(ticket)}` },
                { name: '关闭页面', onclick: 'window.close()' }
            ];
        }

        await next();
    });

    viewRouter.use(templateRenderer({
        'basePath': path.resolve(`${__dirname}/../views`),
        'ext': 'html'
    }));

    return viewRouter;
}

module.exports = getViewRouter;
