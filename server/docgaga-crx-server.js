
const koa = require('koa');
const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');

const staticServer = require('koa-static');
const mount = require('koa-mount');

const LogAspect = require('./logging/log-aspect.js');
const appConfig = require('./config/app-conf');

const session = require('./session/session-conf');

const ViewRouter = require('./routers/view-router');
const AuthRouter = require('./routers/auth-router');
const ApiRouter = require('./routers/api-router');

var app = new koa(),
	rootRouter = new Router({ prefix: '/docgagacrx' }),
	authRouter = new AuthRouter(app, { prefix: '/auth' }),
	apiRouter = new ApiRouter(app, { prefix: '/api' }),
	viewRouter = new ViewRouter(app, { prefix: '' });
	
	rootRouter.use(authRouter.routes());
	rootRouter.use(viewRouter.routes());
	rootRouter.use('/api/*', authRouter.authorize());
	rootRouter.use(apiRouter.routes());
	rootRouter.use('/api/*', authRouter.postApiCall());
	
	app.use(mount(`${appConfig.contextPath}/static`, staticServer(`${__dirname}/../static`)));
	
app.use(new LogAspect());
app.use(session(app));
app.use(bodyParser());
app.use(rootRouter.routes());

module.exports = app;