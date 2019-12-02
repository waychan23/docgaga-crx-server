const assert = require('assert');

const OauthToken = require('../model/oauthtoken');
const appConfig = require('../config/app-conf');
const crypto = require('../utils/crypto');
const httpUtils = require('../utils/http-utils');

const store = {
	'oauthtoken': require('../persist/oauthtoken-store').getInstance()
};

const logger = require('../logging/logger');

var singleton;

/**
 * @constructor
 */
function OauthService(options = {}){

    options = Object.assign({
        stores: store,
        config: appConfig
    }, options);

    if(!(this instanceof OauthService)){
        return new OauthService(options);
    }

    var self = this;

    self.store = options.stores;
    self.config = options.config;
}

module.exports = OauthService;

/**
 * @return {OauthService}
 */
OauthService.getInstance = function(){
    if(!singleton){
        singleton = new OauthService();
    }
    return singleton;
};

/**
 * @return {OAuthToken}
 */
OauthService.prototype.requestForLoginTicket = async function(extraInfo){
    var self = this,
        store = self.store,
        conf = self.config,
        ticketSignKey = conf.ticketSignKey,
        loginTicketTTL = conf.loginTicketTTL,
        loginTicket = genLoginTicket(ticketSignKey, extraInfo),
        token = OauthToken({
            'loginTicket': loginTicket,
            'ltkExpiresAt': new Date(Date.now() + loginTicketTTL)
        });

    token = await store.oauthtoken.save(token);

    return token;
};

/**
 * @param {Object} params
 * @param {String} params.loginTicket
 * @param {String} params.code - OAuth Authorization Code
 * @param {String} [params.override=false] - Indicating whether to override if token with the loginTicket already exists
 * @param {String} [params.upsert=false] - Indicating whether to insert a new document when the one with the loginTicket not exists
 * @return {OauthToken} 
 */
OauthService.prototype.requestForToken = async function(params={}){
    params = Object.assign({ override: false, upsert: false }, params);

    if(!params.loginTicket || !params.code){
        throw "parameters 'loginTicket' and 'token' are required";
    }

    var self = this,
        store = self.store,
        conf = self.config,
        oauthServerInfo = conf.oauthServerInfo,
        clientInfo = conf.clientInfo,
        apiTicketTTL = conf.apiTicketTTL,
        ticketSignKey = conf.ticketSignKey,
        url = `${oauthServerInfo.host}${oauthServerInfo.contextPath}${oauthServerInfo.endpoint.token}`,
        token, resp, user, req, update, opts, rs;

    try{
        token = await store.oauthtoken.find({ loginTicket: params.loginTicket }, null, 'toArray');
        
        if(token){
            token = token.length? token[0]: null;
        }

        if(token && token.accessToken && !params.override){
            return false;
        }

        if(!token && !params.upsert){
            return false;
        }

        req = httpUtils.postForm(url, {
            'grant_type': clientInfo.grantType,
            'client_id': clientInfo.clientId,
            'client_secret': clientInfo.clientSecret,
            'redirect_uri': clientInfo.redirectUri,
            'scope': clientInfo.scope,
            'code': params.code
        });

        resp = await req;

        if(resp && resp.body && resp.body.access_token){
            resp = resp.body;

            user = await httpUtils.getWithToken(conf.docgagaAPIs.getUser, {
                'type': resp.token_type,
                'token': resp.access_token
            });

            if(user && user.body && user.body.success && user.body.result){
                user = user.body.result;
            }else{
                user = null;
            }

            if(!user){
                return false;
            }

            update = {
                'apiTicket': genApiTicket(ticketSignKey, params.loginTicket),
                'atkExpiresAt': new Date(Date.now() + apiTicketTTL),
                'refreshTicket': genRefreshTicket(ticketSignKey, params.loginTicket),
                'tokenType': resp.token_type,
                'accessToken': resp.access_token,
                'refreshToken': resp.refresh_token,
                'atExpiresAt': new Date(Date.now() + (resp.expires_in - 60 * 5) * 1000),
                'user': user
            };

            if(!token){
                update = Object.assign(update, {
                    loginTicket: params.loginTicket,
                    ltkExpiresAt: new Date(Date.now()),
                });

                opts = { upsert: true };
            }else{
                update = { $set: update };
            }

            rs = await store.oauthtoken.update({ loginTicket: params.loginTicket }, update, opts, false);

            if(rs){
                token = await store.oauthtoken.find({ loginTicket: params.loginTicket }, null, 'toArray');

                if(token){
                    return token.length? token[0]: false;
                }
            }
        }
        
    }catch(e){
        logger.error(e);
    }

    return false;
};

/**
 * @param {Object} params
 * @param {String} [params.loginTicket]
 * @param {String} [params.apiTicket]
 * @param {String} [params.accessToken]
 * @param {String} [params.refreshToken]
 * @param {String} [params.username]
 * @param {Boolean} [params.logicOr=false]
 * @param {Boolean} [singleResult=false]
 * @return {Array<OauthToken>}
 */
OauthService.prototype.getTokens = async function(params = {}, singleResult=false){

    params = Object.assign({ logicOr: false }, params);

    var ks = ['loginTicket', 'apiTicket', 'accessToken', 'refreshToken', 'username'].filter(k => params[k]);

    assert.equal(true, ks.length > 0);

    var self = this, 
        store = self.store,
        query = {},
        opts,
        tokens;
    
    params['user.username'] = params.username;

    ks = ks.map(k => k == 'username'? 'user.username': k);

    if(params.logicOr){
        query.$or = ks.map(k => { var o = {}; o[k] = params[k]; return o; });
    }else{//use logic 'and'
        ks.forEach(k => query[k] = params[k]);
    }

    if(singleResult){
        opts = { pagination: { pageNo: 1, pageSize: 1 } };
    }

    tokens = await store.oauthtoken.find(query, opts, 'toArray');

    if(tokens && tokens.length){
        return singleResult? tokens[0]: tokens;
    }

    return singleResult? null: [];
}

/**
 * @param {Object} params
 * @param {String} [params.loginTicket]
 * @param {String} [params.apiTicket]
 * @param {String} [params.accessToken]
 * @param {String} [params.refreshToken]
 * @param {String} [param.username]
 * @param {Boolean} [params.logicOr=false]
 * @param {Boolean} [params.batch=true]
 * @return {Boolean}
 */
OauthService.prototype.removeTokens = async function(params={}){
    params = Object.assign({ logicOr: false, batch: true }, params);

    var ks = ['loginTicket', 'apiTicket', 'accessToken', 'refreshToken', 'username'].filter(k => params[k]);

    assert.equal(true, ks.length > 0);

    var self = this,
        store = self.store,
        query = {},
        tokens, rs;

    params['user.username'] = params.username;

    ks = ks.map(k => k == 'username'? 'user.username': k);

    if(params.logicOr){
        query.$or = ks.map(k => { var o = {}; o[k] = params[k]; return o; });
    }else{//use logic 'and'
        ks.forEach(k => query[k] = params[k]);
    }

    tokens = await store.oauthtoken.find(query, { project: { accessToken: 1, refreshToken: 1 } }, 'toArray');

    rs = await store.oauthtoken.delete(query, params.batch);

    tokens = (params.batch?tokens:[].concat(tokens[0]).filter(Boolean))
                .filter(p => p.refreshToken)
                .map(p => ({ accessToken: p.accessToken, refreshToken: p.refreshToken }));

    if(tokens.length){
        self.revokeTokens(tokens);
    }

    return rs;
};

/**
 * @param {OauthToken} token - 
 * @param {OauthToken} [token.apiTicket] - generate if not exists
 * @return {OauthToken}
 */
OauthService.prototype.saveToken = async function (token){
    var self = this,
        store = self.store;

    if(!token){
        throw "'token' is required";
    }

    if(!token.loginTicket){
        throw "'ticket.loginTicket' is required";
    }

    if(!(token instanceof OauthToken)){
        token = OauthToken(token);
    }

    return await store.oauthtoken.save(token);
};

/**
 * @param {String} loginTicket - 
 * @return {OauthToken}
 */
OauthService.prototype.refreshApiTicket = async function(loginTicket, refreshTicket){
    var self = this,
        conf = self.config,
        apiTicketTTL = conf.apiTicketTTL,
        ticketSignKey = conf.ticketSignKey,
        store = self.store,
        apiTicket, token, update, rs;
    
    if(!loginTicket || !refreshTicket){
        throw "'loginTicket' and 'refreshTicket' is required";
    }

    token = await store.oauthtoken.count({ loginTicket: loginTicket, refreshTicket: refreshTicket });

    if(!token){
        logger.debug(`no token found for loginTicket: ${loginTicket} and refresh Ticket: ${refreshTicket}`);
        return false;
    }

    rs = await store.oauthtoken.update({ loginTicket: loginTicket, refreshTicket: refreshTicket }, {
        $set: {
            apiTicket: genApiTicket(ticketSignKey, loginTicket),
            atkExpiresAt: new Date(Date.now() + apiTicketTTL)
        }
    }, false);

    if(!rs){
        return false;
    }

    token = await store.oauthtoken.find({ loginTicket: loginTicket, refreshTicket: refreshTicket }, null, 'toArray');

    if(!token || !token.length){
        return false;
    }

    return token[0];
};

/**
 * @param {Object} token - 
 * @param {String} token.loginTicket -
 * @param {String} token.apiTicket - 
 * @param {String} token.refreshToken -
 * @return {OauthToken}
 */
OauthService.prototype.refreshToken = async function (token){
    var self = this,
        conf = self.config,
        oauthServerInfo = conf.oauthServerInfo,
        clientInfo = conf.clientInfo,
        store = self.store,
        resp, newToken, rs;
    
    if(!token){
        throw "'token' is required";
    }

    if(!token.loginTicket || !token.refreshToken || !token.apiTicket){
        throw "'token.loginTicket' and 'token.refreshToken' and 'token.apiTicket' are required";
    }

    try{
        resp = await httpUtils.postForm(`${oauthServerInfo.host}${oauthServerInfo.contextPath}${oauthServerInfo.endpoint.token}`, {
            'grant_type': 'refresh_token',
            'refresh_token': token.refreshToken,
            'scope': clientInfo.scope,
            'client_id': clientInfo.clientId,
            'client_secret': clientInfo.clientSecret,
            'redirect_uri': clientInfo.redirectUri
        });

        resp = resp.body;

        if(resp && resp.access_token){
            newToken = {};
            newToken.accessToken = resp.access_token;
            newToken.atExpiresAt = new Date(Date.now() + (resp.expires_in - 5 * 60) * 1000);
            newToken.refreshToken = resp.refresh_token || token.refreshToken;

            rs = await store.oauthtoken.update({ loginTicket: token.loginTicket }, { $set: newToken }, null, false);

            newToken = await store.oauthtoken.find({ loginTicket: token.loginTicket }, null, 'toArray');

            newToken = (newToken && newToken.length)? newToken[0]: null;
        }

    }catch(e){
        logger.error(e);
        newToken = null;
    }

    if(!newToken){
        await self.removeTokens({ loginTicket: token.loginTicket, refreshToken: token.refreshToken });
    }

    return newToken || false;
}

/**
 * @param {String} ticket - 
 * @param {Number} [t] - time in milli
 * @return {String}
 */
OauthService.prototype.genSignedState = function(ticket, t){
    var self = this,
        clientInfo = self.config.clientInfo,
        stateSignKey = self.config.oauthStateSignKey,
        t = t || new Date().getTime() + clientInfo.stateTTL,
        msg = `${clientInfo.clientId}&${clientInfo.grantType}&${clientInfo.redirectUri}&${clientInfo.scope}&${t}&{ticket}`;

    return crypto.toBase64(`${t}&${ticket}&${crypto.hmac_sha256(stateSignKey, msg).toString('base64')}`);
};

/**
 * @param {String} state - 
 * @return {Object|false}
 */
OauthService.prototype.verifySignedState = function(state){
    var self = this,
        text = crypto.fromBase64(state),
        p, ticket, t, signed;

    p = text.split('&');

    if(!p || p.length !== 3){
        return false;
    }

    t = parseInt(p[0]);

    if(isNaN(t)){
        return false;
    }

    ticket = p[1];

    signed = self.genSignedState(ticket, t);

    if(signed != state){
        return false;
    }

    if(t <= Date.now()){
        return {
            ticket: ticket,
            error: 'state_timeout'
        };
    }

    return {
        ticket: ticket
    };
};

/**
 * @param {Array<Object{accessToken, refreshToken}>} tokens - 
 */
OauthService.prototype.revokeTokens = async function(tokens){
    var self = this,
        { oauthServerInfo, clientInfo } = self.config,
        url = `${oauthServerInfo.host}${oauthServerInfo.endpoint.revoke}`,
        clientCred = { client_id:  clientInfo.clientId, client_secret: clientInfo.clientSecret },
        reqs;
    try{
        var reqs = tokens.map(p => ({ 'x-access-token': p.accessToken, 'x-refresh-token': p.refreshToken }))
                        .map(h => httpUtils.postForm(url, clientCred, h));
        
        await Promise.all(reqs);
    }catch(e){
        console.error(e);
        //suppress error
    }
}

function genLoginTicket(signKey, extraInfo){
    var t = Date.now(),
        r = Math.random(),
        msg = `loginTicket.t=${t}&loginTicket.r=${r}&loginTicket.ua=${extraInfo}`;

    return crypto.toBase64(crypto.hmac_sha256(signKey, msg).toString('base64'));
}

function genRefreshTicket(signKey, extraInfo){
    var t = Date.now(),
		r = Math.random(),
        r2 = Math.random();
		msg = `refreshTicket.t=${t}&refreshTicket.r=${r}&refreshTicket.lt=${extraInfo}&refreshTicket.r2=${r2}`;
	
	return crypto.toBase64(crypto.hmac_sha256(signKey, msg).toString('base64'));
}

function genApiTicket(signKey, extraInfo){
    var t = Date.now(),
		r = Math.random(),
		msg = `apiticket.t=${t}&apiticket.r=${r}&apiticket.lt=${extraInfo}`;
	
	return crypto.toBase64(crypto.hmac_sha256(signKey, msg).toString('base64'));
}

