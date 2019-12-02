"use strict";

module.exports = class Store{

	constructor(model, utils, conf){
		this.model = model;
		this.utils = utils;
		this.dbConf = conf;
	}
	
	do(doFunc){
		var self = this;

		if(typeof doFunc != 'function'){
			return false;
		}

		return connect(self).then(doFunc);
	}

	find(filters, options, toArray){
		var self = this;

		return connect(self).then(self.utils.do(async (dbh) => {
			return dbh.list(self.model, filters || {}, options || {}, toArray);
		}));
	}

	listBy(filters, options, toArray){
		return this.find(filters, options, toArray);
	}

	count(filters, options){
		var self = this;

		return connect(self).then(self.utils.do(async (dbh) => {
			return dbh.count(self.model, filters || {}, options || {});
		}));
	}

	findById(id){
		var self = this;
		
		return connect(self).then(self.utils.do(async (dbh) => {
			return dbh.findById(self.model, id);
		}));
	}

	save(object){
		var self = this;

		return connect(self).then(self.utils.do(async (dbh) => {
			return dbh.saveOne(self.model, object);
		}));
	}

	update(query, updat, opts, batch){
		var self = this;

		return connect(self).then(self.utils.do(async (dbh) => {
			return dbh.update(self.model, query, updat, opts, !!batch);
		}));
	}

	delete(cond, batch){
		var self = this;

		return connect(self).then(self.utils.do(async (dbh) => {
			return dbh.delete(self.model, cond, batch);
		}));
	}

	clear(){//dangerous test only
		var self = this;

		return connect(self).then(self.utils.do(async (dbh) => {
			return dbh.clear(self.model);
		}));
	}
};

function connect(inst){
	return inst.utils.connect(inst.dbConf.url, inst.dbConf.connectOptions);
}
