const crypto = require('./crypto');

module.exports.genSignedState = genSignedState;

function genSignedState(ticket, t, clientInfo, stateSignKey){
    var t = t || new Date().getTime() + clientInfo.stateTTL,
        msg = `${clientInfo.clientId}&${clientInfo.grantType}&${clientInfo.redirectUri}&${clientInfo.scope}&${t}&{ticket}`;

    return crypto.toBase64(`${t}&${ticket}&${crypto.hmac_sha256(stateSignKey, msg).toString('base64')}`);
}

module.exports.verifySignedState = verifySignedState;

function verifySignedState(state, clientInfo, stateSignKey){
    var text = crypto.fromBase64(state),
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

    signed = genSignedState(ticket, t, clientInfo, stateSignKey);

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
}