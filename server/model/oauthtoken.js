module.exports = OauthToken;

function OauthToken(mx){
	if(!(this instanceof OauthToken)){
		return new OauthToken(mx);
	}

	var self = this;

	self = Object.assign(self, mx || {});

	return OauthToken.parse(self);
}

OauthToken.modelName = 'oauthtoken';

OauthToken.parse = function(self){

    if(self.atExpiresAt && !(self.atExpiresAt instanceof Date)){
        self.atExpiresAt = new Date(self.atExpiresAt);
    }
    if(self.ltkExpiresAt && !(self.ltkExpiresAt instanceof Date)){
        self.ltkExpiresAt = new Date(self.ltkExpiresAt);
    }
    if(self.atkExpiresAt && !(self.atkExpiresAt instanceof Date)){
        self.atkExpiresAt = new Date(self.atkExpiresAt);
    }

    if(typeof self.user == 'string'){
        self.user = { 'username': self.user };
    }

	return self;
};

OauthToken.prototype = {
    //_id: String
    //loginTicket: String
    //apiTicket: String
    //accessToken: String
    //refreshToken: String
    //atExpiresAt: Date
    //atkExpiresAt: Date
    //ltkExpiresAt: Date
    //user: Object
    //user.username: String
    //user.avatar: String
    //provider: String
};