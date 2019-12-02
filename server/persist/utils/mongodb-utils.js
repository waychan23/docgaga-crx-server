"use strict";

const ObjectID = require('mongodb').ObjectID,
	  client = require('mongodb').MongoClient,
	  reUtils = require('regex-utils'),
	  deleteEmptyFields = require('../../utils/object-utils').deleteEmptyFields;

const CUSTOM_OPERATORS = [ '$contains', '$startWith', '$endWith', '$pkIn' ];

module.exports = class MongoDBUtils{
	constructor(dbh){
		this.dbh = dbh;
	}

	static connect(url, opts){
		return client.connect(url, opts || {});
	}

	static do(cb){
		return async (db) => {
			var ret = cb;
			if(typeof cb == 'function'){
				try{
					ret = await cb(MongoDBUtils.newHandler(db));
				}catch(e){
					throw e;
				}finally{
					db.close();
				}
			}
			
			return ret;
		};
	}

	static newHandler(dbh){
		return new MongoDBUtils(dbh);
	}

	async saveOne(model, object){
		if(!object){
			return false;
		}

		deleteEmptyFields(object, 'deep');

		var self = this,
			dbh = self.dbh,
			r = await dbh.collection(model.modelName)
				.insertOne(object);

		if(r.insertedCount){
			object._id = r.insertedId;
			return model(object);
		}
		return false;
	}

	async delete(model, query, batch){
		var self = this,
			dbh = self.dbh,
			r = await dbh.collection(model.modelName);
		
		query = query || {};

		parseQueryDocument(query);

		r = await (batch?r.deleteMany(query):r.deleteOne(query));

		if(r.result.ok === 1){
			return true;
		}

		return false;
	}

	async findById(model, id){
		var self = this,
			dbh = self.dbh,
			r;

		if(!id){
			return false;
		}

		id = parseID(id);

		r = await dbh.collection(model.modelName).findOne({ '_id': id });

		return r? model(r): false;
	}

	async count(model, query, options){
		var self = this,
			dbh = self.dbh,
			pagination = false,
			cOptions = {},
			r, p;

		query = query || {};
		options = options || {};

		parseQueryDocument(query);

		if(options.pagination){
			pagination = true;

			p = options.pagination;
		}

		if(pagination){
			cOptions.skip = (p.pageNo - 1) * p.pageSize;
			cOptions.limit = p.pageSize;
		}
		
		r = dbh.collection(model.modelName);
		
		return r.count(query, cOptions);
	}

	async list(model, query, options, toArray){
		var self = this,
			dbh = self.dbh,
			sort = false,
			pagination = false,
			r, p, f, prj;

		query = query || {};
		options = options || {};

		parseQueryDocument(query);

		if(Array.isArray(options.sort)){
			options.sort = options.sort.map(f => f && f.length && [ f[0], f[1] >= 0? 1: -1 ]).filter(Boolean);
			sort = !!options.sort.length;
		}else if(typeof options.sort == 'object'){
			for(f in options.sort){
				if(options.sort.hasOwnProperty(f)){
					options.sort[f] = options.sort[f] >= 0? 1: -1;
					sort = true;
				}
			}
		}

		if(options.pagination){
			pagination = true;

			p = options.pagination;
		}

		prj = {};

		if(options.project){
			prj = Object.assign(prj, options.project || {});
			for(f in prj){
				if(prj.hasOwnProperty(f)){
					if(prj[f] <= 0 || prj[f] === false){
						prj[f] = 0;
					}else if(prj[f] > 0 || prj[f] === true){
						prj[f] = 1;
					}
				}
			}
		}

		r = dbh.collection(model.modelName);

		r = r.find(query, prj);

		if(sort){
			r.sort(options.sort);
		}

		if(pagination){
			r.skip((p.pageNo - 1) * p.pageSize);
			r.limit(p.pageSize);
		}

		if(toArray){
			return (await r.toArray()).map(doc => model(doc));
		}

		return r.stream({ transform: doc => model(doc) });
	}

	async update(model, query, up, opts, batch){
		var self = this,
			dbh = self.dbh,
			rs;

		query = query || {};
		up = up || {};
		opts = opts || {};

		parseQueryDocument(query);
		parseUpdateDocument(up);

		deleteEmptyFields(up, 'deep');

		rs = await dbh.collection(model.modelName);

		if(batch){
			rs = await rs.updateMany(query, up, opts);
		}else{
			rs = await rs.updateOne(query, up, opts);
		}

		if(rs.upsertedId){
			return rs.upsertedId;
		}else if(rs.matchedCount === rs.modifiedCount){
			return true;
		}

		return false;
	}

	async clear(model){
		var self = this,
			dbh = self.dbh;

		return dbh.collection(model.modelName).deleteMany({ _id: { $ne: "" } });
	}
};

function parseID(id){
	if(typeof id == 'string' && id.length === 24){
		id = ObjectID.createFromHexString(id);
	}else if(typeof id == 'object' && id.$eq){
		id._id.$eq = parseID(id._id.$eq);
	}else if(typeof id == 'object' && Array.isArray(id.$in)){
		id.$in = id.$in.map(i => parseID(i));
	}
	return id;
}

function parseCustomOperator(op, oprand, opts){
	var rep = null;

	if(!oprand){
		return null;
	}

	opts = opts || {};

	switch(op){
	case '$pkIn': 
		if(Array.isArray(oprand) && oprand.length){
			rep = { $in: [].concat(oprand).map() };
		}
		break;
	case '$contains':
		rep = { $regex: reUtils.contains(oprand) };
		break;
	case '$startWith':
		rep = { $regex: '^' + reUtils.contains(oprand) };
		break;
	case '$endWith':
		rep = { $regex: reUtils.contains(oprand) + '$' };
		break;
	}

	(rep && opts.ignoreCases) && (rep.$options = 'i');

	return rep;
}

function parseQueryDocument(query, depth){
	query = query || {};

	depth = depth || 1;

	if(depth > 5){
		throw "query document embed too deep.";
	}

	if(query._id){
		query._id = parseID(query._id);
	}

	for(let f in query){
		if(query.hasOwnProperty(f) && !/^\$/.test(f) && typeof query[f] == 'object'){
			let op, rep;

			for(let i= 0; i < CUSTOM_OPERATORS.length; op = CUSTOM_OPERATORS[i++]){
				if(!rep && query[f][op]){
					rep = parseCustomOperator(op, query[f][op], query[f].$opts);
					if(rep){
						Object.assign(query[f], rep);
					}
				}
				delete query[f][op];
			}

			delete query[f].$opts;
		}
	}

	if(query.$or){
		[].concat(query.$or).filter(Boolean).forEach(query => {
			parseQueryDocument(query, depth + 1);
		});
	}
}

function parseUpdateDocument(doc){
	if(doc){
		doc._id = parseID(doc._id);
		if(!doc._id){
			delete doc._id;
		}
	}

	return doc;
}
