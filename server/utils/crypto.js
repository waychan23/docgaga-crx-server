"use strict";

const crypto = require('crypto');
const csprng = require('csprng');
const bcrypt = require('bcrypt');

module.exports.toBase64 = function(str){
	return Buffer.from(str, 'utf-8').toString('base64');
};

module.exports.fromBase64 = function(str){
	return Buffer.from(str, 'base64').toString('utf-8')
}

module.exports.sha256 = function(msg){
	var hash = crypto.createHash('sha256');

	hash.update(msg);

	return hash.digest('hex');
};

module.exports.md5 = function(msg){
	var hash = crypto.createHash('md5');

	hash.update(msg);

	return hash.digest('hex');
};

module.exports.hmac = function(algo, key, msg){
	return crypto.createHmac(algo, key).update(msg).digest();
};

module.exports.hmac_sha1 = function(key, msg){
	return module.exports.hmac('sha1', key, msg);
};

module.exports.hmac_sha256 = function(key, msg){
	return module.exports.hmac('sha256', key, msg);
};

/*
 * @param {Number} [bits] Number of characters that consist of the string.
 * @param {Number} [radix] Integer in range [2, 36].
 * @return {String}
 */
module.exports.randStr = function(bits, radix){
	return csprng(bits, radix);
};


module.exports.bcrypt_hash = async function(str, saltRounds){
	return await bcrypt.hash(str, saltRounds);
};

module.exports.bcrypt_compare = async function(str, hash){
	return await bcrypt.compare(str, hash);
};
