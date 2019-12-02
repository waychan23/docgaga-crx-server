"use strict";

const mongoConfig = require('./runtime-conf').mongoConfig;

module.exports = {
	'url': mongoConfig.url,
	'connectOptions': {
		'autoReconnect': true,
		'reconnectTries': 3,
		'poolSize': 10
	},
	'utils': '/persist/utils/mongodb-utils',
	'models': [
		{ 'name': 'oauthtoken', 'model': '/init/model/oauthtoken' }
	]
};
