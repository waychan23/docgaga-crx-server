const request = require('request');

//因为是自家应用，所以使用本地地址调用，如果是第三方开发的应用应该使用外网地址
const RESOURCE_PATH_PREFIX = 'https://api.docgaga.club:8443/docgaga/api';

module.exports = apiList;

function apiList(resourcePathPrefix=RESOURCE_PATH_PREFIX, options={ continueMiddleware: false }){
    var apis = {},
        list;

    var n = makePrefixer('/note'),
        k = makePrefixer('/keyword'),
        h = makeHandler.bind(null, resourcePathPrefix, options);

    apis.user = {};
    apis.note = {};
    apis.keyword = {};
    
    list = []
        .concat(apis.note.findById = h('get', n('/findById')))
        .concat(apis.note.delete = h('get', n('/delete')))
        .concat(apis.note.add = h('post', n('/add'), 'json'))
        .concat(apis.note.update = h('post', n('/update'), 'json'))
        .concat(apis.note.search = h('post', n('/search'), 'json'))
        .concat(apis.note.findByMark = h('post', n('/findByMark'), 'json'))
        .concat(apis.note.count = h('get', n('/count'), 'json'))
        .concat(apis.keyword.findById = h('get', k('/findById')))
        .concat(apis.keyword.add = h('post', k('/add'), 'json'))
        .concat(apis.keyword.search = h('post', k('/search'), 'json'))
        .concat(apis.keyword.getSuggestions = h('post', k('/getSuggestions'), 'json'));

    return {
        apis: apis,
        apiList: list
    };
}

/**
 * @param {String} resourcePathPrefix - 
 * @param {String} method - HTTP method, case insensitive
 * @param {String} path - 
 * @param {String} requestDataType -
 * @return {Object} - 
 */
function makeHandler(resourcePathPrefix, options={}, method, path, requestDataType){
    method = method.toLowerCase();

    if(method != 'get' && method != 'post'){
        throw new Error(`unsupported method ${method}`);
    }

    var url = `${resourcePathPrefix}${path}`;

    async function handler(ctx, next){
        var token = ctx.state.docgaga && ctx.state.docgaga.token,
            resp, data;
        
        if(!token || !token.accessToken || token.tokenType != 'Bearer'){
            ctx.status = 401;

            if(options.continueMiddleware){
                await next();
            }

            return;
        }

        try{
            if(method == 'get'){
                resp = await httpGet(url, ctx.query, token);
            }else if(method = 'post'){
                resp = await httpPost(url, ctx.request.body, requestDataType, token);
            }

            if(isInt(resp)){
                ctx.status = resp;
            }else{
                ctx.body = resp;
            }

        }catch(e){
            console.error(e);
            ctx.status = 500;
        }

        if(options.continueMiddleware){
            await next();
        }
    }

    return {
        'method': method,
        'path': path,
        'handler': handler
    };
}

function isInt(o){
    return typeof o !== 'object' && !isNaN(parseInt(o));
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

function httpGet(uri, query, token){
    var url = composeUri(uri, query);

    return new Promise(function(resolve, reject){
        request({
            'url': url,
            'headers': { 'Authorization': `${token.tokenType} ${token.accessToken}` },
            'rejectUnauthorized': false
        }, function(error, response, body){
            if(error){
                console.error(error);
            }

            if(!response){
                return resolve(500);
            }

            if(response.statusCode != 200){
                return resolve(response.statusCode);
            }

            if(typeof body == 'string'){
                body = JSON.parse(body);
            }

            return resolve(body);
        });
    });
}

function httpPost(url, data, dataType, token){
    var opts = {
        'url': url,
        'method': 'POST',
        'rejectUnauthorized': false,
        'headers': { 'Authorization': `${token.tokenType} ${token.accessToken}` },        
    };

    if(dataType == 'json'){
        opts.body = data;
        opts.json = true;
    }else if(dataType == 'form'){
        opts.form = data;
    }else{
        throw new Error(`unsupported dataType ${dataType}`);
    }

    return new Promise(function(resolve, reject){
        request(opts, function(error, response, body){
            if(error){
                return reject(error);
            }
            if(response.statusCode != 200){
                return resolve(response.statusCode);
            }

            if(typeof body == 'string'){
                body = JSON.parse(body);
            }

            return resolve(body);
        });
    });
}

function makePrefixer(prefix){
    return function(path){
        return prefix + path;
    }
}
