"use strict";

const OauthToken = require('../model/oauthtoken');
const Store = require('./store');
const mongoUtils = require('./utils/mongodb-utils');
const mongoConf = require('../config/mongodb-conf');

var singleton;

class OauthTokenStore extends Store{
	constructor(params={}){
		params = Object.assign({ config: mongoConf }, params);
		super(OauthToken, mongoUtils, params.config);
	}

	/**
	 * @return {OauthTokenStore}
	 */
	static getInstance(){
		singleton = singleton || new OauthTokenStore();
		return singleton;
	}
}

module.exports = OauthTokenStore;
