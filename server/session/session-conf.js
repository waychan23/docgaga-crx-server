"use strict";

const keys = require('../config/runtime-conf').keys;
const session = require('koa-session');

const CONFIG = {
	key: 'DGGCRXSESS',
	maxAge: 1000 * 60 * 30,
	overwrite: true,
	httpOnly: true,
	signed: true,
	rolling: false,
	path: '/docgagacrx'
};

module.exports = function(app){
	app.keys = [ keys.sessionKey ];
	return session(CONFIG, app);
};