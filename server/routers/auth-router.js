const Router = require('koa-router');

const appConfig = require('../config/app-conf');
const logger = require('../logging/logger');
const defaultOauthService = require('../services/oauth-service').getInstance();
const ua2browser = require('../utils/ua2browser');

const HEADER_USERNAME = 'x-username';
const HEADER_REFRESH_TICKET = 'x-refresh-ticket';
const HEADER_API_TICKET = 'x-api-ticket';

function getAuthRouter(app, options = {}){

    options = Object.assign({ config: appConfig, oauthService: defaultOauthService, prefix: '' }, options);
            
    var authRouter = new Router({ prefix: options.prefix }),
        oauthService = options.oauthService,
        { oauthServerInfo, staticPath, contextPath, clientInfo } = options.config,
        routerPrefix = options.prefix;
    
    /**
     * @header {String} x-username - 
     * @header {String} x-api-ticket - 
     */
    authRouter.authorize = () => (async (ctx, next) => {
        var ua = ctx.get('user-agent'),
            username = ctx.get(HEADER_USERNAME),
            apiTicket = ctx.get(HEADER_API_TICKET),
            token;

        if(!ua2browser.tell(ua)){
            return ctx.status = 403;
        }

        if(!username || !apiTicket){
            return ctx.status = 403;
        }

        token = await oauthService.getTokens({ apiTicket: apiTicket, username: username }, 'singleResult');

        if(!token){
            ctx.status = 401;
            return ctx.body = { error: 'need_login' };
        }

        if(isExpired(token.atExpiresAt)){
            token = await oauthService.refreshToken(token);
            if(!token){
                return ctx.body = { error: 'need_login' };
            }
        }

        if(isExpired(token.atkExpiresAt)){
            ctx.status = 401
            return ctx.body = { error: 'need_refresh_ticket' };
        }

        ctx.state.docgaga = ctx.state.docgaga || {};
        ctx.state.docgaga.token = {
            loginTicket: token.loginTicket,
            apiTicket: token.apiTicket,
            tokenType: token.tokenType,
            accessToken: token.accessToken,
            refreshToken: token.refreshToken
        };

        await next();
    });

    authRouter.postApiCall = () => (async (ctx, next) => {
        var token = ctx.state.docgaga && ctx.state.docgaga.token;

        if(token && ctx.status === 401){
            token = await oauthService.refreshToken(token);
            if(!token){
                return ctx.body = { error: 'need_login' };
            }
        }
    });

    /**
     * @requestHeader {String} [x-api-ticket] - 
     * @queryParam {String} [ticket] - 
     * @return {application/json|403} - { loginInfo } | { ticket } | { error }
     */
    authRouter.get('/login', async (ctx, next) => {
        var q = ctx.request.query,
            ticket = q.ticket,
            apiTicket = ctx.get(HEADER_API_TICKET),
            ua = ctx.get('user-agent'),
            loginTicket = ctx.session.loginTicket,
            token, newToken;

        if(!ua2browser.tell(ua)){
            return ctx.status = 403;
        }

        if(ticket && apiTicket){
            token = await oauthService.getTokens({ apiTicket: apiTicket, loginTicket: ticket }, 'singleResult');
            if(!token){
                //coverred
                return await sendNewLoginTicket(ctx, ua);
            }
            if(isExpired(token.atkExpiresAt)){
                //coverred
                return sendError(ctx, 'api_ticket_expired');
            }else if(isExpired(token.atExpiresAt)){
                newToken = await oauthService.refreshToken(token);
                if(newToken){
                    //coverred
                    return sendLoginInfo(ctx, newToken, true);
                }else{
                    //coverred
                    await revokeLoginTicket(ctx, token.loginTicket);
                    return await sendNewLoginTicket(ctx, ua);
                }
            }else{
                //coverred
                return sendLoginInfo(ctx, token, true);
            }
        }else if(ticket && loginTicket && loginTicket.ticket == ticket){
            token = await oauthService.getTokens({ loginTicket: ticket }, 'singleResult');

            if(!token){
                //coverred
                return await sendNewLoginTicket(ctx, ua);
            }
            if(isExpired(token.ltkExpiresAt)){
                //coverred
                await revokeLoginTicket(ctx, ticket);
                return await sendNewLoginTicket(ctx, ua);
            }else if(token.apiTicket){
                return sendLoginInfo(ctx, token, true);
            }else{
                //coverred
                return sendLoginTicket(ctx, ticket);
            }
        }else if(ticket && loginTicket && loginTicket.ticket != ticket){
            //coverred
            await revokeLoginTicket(ctx, loginTicket.ticket);
            return await sendNewLoginTicket(ctx, ua);
        }else if(!ticket && loginTicket){
            //coverred
            await revokeLoginTicket(ctx, loginTicket.ticket);
            return await sendNewLoginTicket(ctx, ua);
        }else{
            //coverred
            return await sendNewLoginTicket(ctx, ua);
        }
    });

    /**
     * @queryParam {String} [ticket] - 
     * @return {302|403} - view:error | oauthserver:view:login | oauthserver:view:authorize
     */
    authRouter.get('/', async (ctx, next) => {
        var ticket = ctx.query.ticket,
            loginTicket = ctx.session.loginTicket,
            ua = ctx.get('user-agent'),
            t, state;
        
        if(!ua2browser.tell(ua)){
            //coverred
            return ctx.status = 403;
        }

        if(!ticket){
            //coverred
            return ctx.status = 403;
        }

        if(!loginTicket || loginTicket.ticket != ticket){
            //coverred
            return redirectToError(ctx, 'invalid_login_ticket');
        }

        t = await oauthService.getTokens({ loginTicket: ticket }, 'singleResult');

        if(!t || isExpired(t.ltkExpiresAt)){
            //coverred
            return redirectToError(ctx, 'login_ticket_expired');
        }

        //coverred
        state = oauthService.genSignedState(ticket);

        redirect(ctx, `${oauthServerInfo.host}${oauthServerInfo.contextPath}${oauthServerInfo.endpoint.authorize}`, {
            'client_id': clientInfo.clientId,
            'scope': clientInfo.scope,
            'response_type': clientInfo.responseType,
            'redirect_uri': clientInfo.redirectUri,
            'state': state
        });
    });

    /**
     * @queryParam {String} code - 
     * @queryParam {String} state - 
     * @return {302|403} - view:error | view:login-success
     */
    authRouter.get('/receiveGrant', async (ctx, next) => {
        var { code, state, error } = ctx.query,
            ua = ctx.get('user-agent'),
            v, token;

        if(!ua2browser.tell(ua)){
            return ctx.status = 403;
        }
        
        if(!state || !(v = oauthService.verifySignedState(state)) || v.error || !v.ticket){
            if(error){
                //coverred
                redirectToError(ctx, error, v && v.ticket);
            }else if(v && v.ticket){
                //coverred
                redirectWithWaiting(ctx, `${contextPath}${routerPrefix}/`, { 'ticket': v.ticket }, 'invalid_state');
            }else{
                //coverred
                redirectToError(ctx, v && v.error);
            }
            return;
        }

        ticket = v.ticket;

        if(error){
            //coverred
            return redirectToError(ctx, error, ticket);
        }

        token = false;

        if(code){
            //coverred
            token = await oauthService.requestForToken({ code: code, loginTicket: ticket });
        }else{
            //coverred
            return ctx.status = 403;
        }
        
        if(token){
            //coverred
            redirect(ctx, `${staticPath}/login-success.html`);
        }else{
            //coverred
            redirectToError(ctx, 'error_request_for_token', ticket);
        }
    });

    /**
     * @queryParam {String} ticket - 
     * @return {403|500|application/json} - { state }
     */
    authRouter.get('/check', async (ctx, next) => {
        var { ticket } = ctx.query,
            { loginTicket } = ctx.session,
            ua = ctx.get('user-agent'),
            token;

        if(!ua2browser.tell(ua)){
            //coverred
            return ctx.status = 403;
        }

        if(!ticket || !loginTicket || ticket != loginTicket.ticket){
            //coverred
            return ctx.status = 403;
        }

        token = await oauthService.getTokens({ loginTicket: ticket }, 'singleResult');

        if(!token){
            //coverred
            return ctx.status = 500;
        }

        if(isExpired(token.ltkExpiresAt)){
            //coverred
            return ctx.body = { 'state': 'expired' };
        }else if(token.apiTicket){
            //coverred
            return ctx.body = { 'state': 'login' };
        }else{
            
            return ctx.body = { 'state': 'pending' };
        }
    });

    /**
     * @queryParam {String} ticket -
     * @header {String} x-api-ticket -
     * @return {403|application/json} - { success }
     */
    authRouter.get('/logout', async (ctx, next) => {
        var { ticket } = ctx.query,
            { loginTicket } = ctx.session,
            apiTicket = ctx.get(HEADER_API_TICKET),
            ua = ctx.get('user-agent'),
            token, rs;

        if(!ua2browser.tell(ua)){
            //coverred
            return ctx.status = 403;
        }

        if(!ticket){
            //coverred
            return ctx.status = 403;
        }

        token = null;

        if(apiTicket){
            //coverred
            token = await oauthService.getTokens({ loginTicket: ticket, apiTicket: apiTicket }, 'singleResult');
        }//else coverred

        if(token){
            //coverred
            await oauthService.removeTokens({ loginTicket: ticket });
        }//else coverred

        if(token && loginTicket && loginTicket.ticket != ticket ||
            !token && loginTicket && loginTicket.ticket == ticket){
            //coverred                
            await oauthService.removeTokens({ loginTicket: loginTicket.ticket });
        }//else coverred

        ctx.session.loginTicket = null;

        return ctx.body = { success: true };
    });

    /**
     * @queryParam {String} ticket -
     * @header {String} x-refresh-ticket -
     * @return {403|application/json} - { ticket, expiresIn }
     */
    authRouter.get('/refreshTicket', async (ctx, next) => {
        var { ticket } = ctx.query,
            { loginTicket } = ctx.session,
            refreshTicket = ctx.get(HEADER_REFRESH_TICKET),
            ua = ctx.get('user-agent'),
            token;

        if(!ua2browser.tell(ua)){
            //coverred
            return ctx.status = 403;
        }
        
        if(!ticket || !refreshTicket){
            //coverred
            return ctx.status = 403;
        }

        if(loginTicket && loginTicket.ticket != ticket){
            //coverred
            return ctx.status = 403;
        }

        token = await oauthService.refreshApiTicket(ticket, refreshTicket);

        if(!token){
            //coverred
            return ctx.body = {
                'error': 'error'
            };
        }//else coverred

        sendApiTicket(ctx, token);
    });

    return authRouter;

    function isExpired(exp){
        if(exp instanceof Date){
            return Date.now() >= exp.getTime();
        }else if(!isNaN(exp = (parseInt(exp)))){
            return Date.now() >= exp;
        }
        
        return true;
    }

    async function revokeLoginTicket(ctx, ticket){
        try{
            if(ctx.session.loginTicket && ctx.session.loginTicket == ticket){
                ctx.session.loginTicket = null;
            }
            await oauthService.removeTokens({ loginTicket: ticket });
        }catch(e){
            logger.error(e);
        }
    }

    async function sendNewLoginTicket(ctx, extraInfo){
        var token, rs;
        try{
            token = await oauthService.requestForLoginTicket(extraInfo);

            if(token){
                ctx.session.loginTicket = {
                    ticket: token.loginTicket,
                    expiresAt: token.ltkExpiresAt
                };

                return sendLoginTicket(ctx, token.loginTicket);
            }
        }catch(e){
            logger.error(e);
        }

        return ctx.status = 500;
    }

    function sendLoginTicket(ctx, ticket){
        ctx.status = 200;
        ctx.body = { 'ticket': ticket };
    }

    function sendApiTicket(ctx, token){
        ctx.body = {
            'apiTicket': token.apiTicket,
            'expiresIn': token.atkExpiresAt.getTime() - Date.now()
        };
    }

    function sendError(ctx, error='error'){
        ctx.body = { 'error': error };
    }

    function sendLoginInfo(ctx, token, sendRefreshTicket){
        ctx.body = {
            'loginInfo': {
                'apiTicket': token.apiTicket,
                'refreshTicket': sendRefreshTicket? token.refreshTicket: undefined,
                'expiresIn': token.atkExpiresAt.getTime() - Date.now(),
                'user': {
                    'username': token.user.username,
                    'avatar': token.user.avatar
                }
            } 
        };
    }

    function redirectToError(ctx, error='unknown', ticket){
        var q = { 'error': error };

        if(ticket){
            q.ticket = ticket;
        }

        redirect(ctx, `${contextPath}/error`, q);
    }

    function redirectWithWaiting(ctx, uri, query={}, msg){
        var redirectUri = composeUri(uri, query);
        redirect(ctx, `${contextPath}/redirect`, {
            'msg': msg,
            'redirect_uri': redirectUri
        });
    }

    function redirect(ctx, uri, query = {}){
        ctx.redirect(composeUri(uri, query));
    }

    function composeUri(uri, query){
        var f, s, arr;

        arr = [];

        for(f in query){
            if(typeof query.hasOwnProperty != 'function' || query.hasOwnProperty(f)){
                arr.push(`${f}=${encodeURIComponent(query[f])}`);
            }
        }

        s = arr.join('&');

        if(s && !/\?$/.test(uri)){
            s = '?'+s;
        }

        return `${uri}${s}`;
    }
}

module.exports = getAuthRouter;