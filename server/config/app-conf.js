
const crxServerInfo = require('./runtime-conf').crxServerInfo;
const oauthServerInfo = require('./runtime-conf').oauthServerInfo;
const oauthClientInfo = require('./runtime-conf').oauthClientInfo;
const keys = require('./runtime-conf').keys;

const oauthStateSignKey = keys.oauthStateSignKey;
const ticketSignKey = keys.loginTicketSignKey;

const apiTicketTTL = 1000 * 60 * 60 * 24;
const loginTicketTTL = 1000 * 60 * 15;

const docgagaServerInfo = {
	'apiPathPrefix': `${oauthServerInfo.host}${oauthServerInfo.contextPath}/api`
};

const docgagaAPIs = {
    'getUser': `${oauthServerInfo.host}${oauthServerInfo.contextPath}/api/getUser`
};

module.exports = {
	contextPath: crxServerInfo.contextPath,
	staticPath: crxServerInfo.staticPath,
    serverInfo: crxServerInfo,
    clientInfo: oauthClientInfo,
    oauthServerInfo: oauthServerInfo,
	docgagaServerInfo: docgagaServerInfo,
    oauthStateSignKey: oauthStateSignKey,
    ticketSignKey: ticketSignKey,
    docgagaAPIs: docgagaAPIs,
	loginTicketTTL: loginTicketTTL,
	apiTicketTTL: apiTicketTTL
};