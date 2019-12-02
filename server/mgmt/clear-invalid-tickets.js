/**
 * 该脚本用于清除:
 *  1) 那些过期的，没有被及时删除的 login ticket
 *  2) 那些过期超过两天仍没有被刷新的 api ticket，说明至少两天没有使用
 */

const MongoClient = require('mongodb').MongoClient;
const config = require('../config/mongodb-conf');

const COLLECTION = 'oauthtoken';

const TWO_DAYS = 1000 * 60 * 60 * 24 * 2;

function c(){
    return MongoClient.connect(config.url, config.connectOptions);
}

function bootstrap(){
    Promise.resolve().then(() => {
        return clearLoginTickets();
    }).then(() => {
        return clearTokens();
    }).catch((e) => {
        console.error(e);
    });
}

async function clearLoginTickets(h){
    var t = new Date(),
        b, a;

    try{
        b = await c().then(count);

        await c().then(async h => {
            await h.collection(COLLECTION).deleteMany({ ltkExpiresAt: { $lte: t }, apiTicket: { $exists: false } });
            h.close();
        });

        a = await c().then(count);
        console.log(`clear expired login tickets - before: ${b}, after: ${a}, deleted: ${b - a}`);        
    }catch(e){
        console.error(e);
    }
}

async function clearTokens(h){
    var t = new Date(Date.now() - TWO_DAYS),
        b, a;

    try{
        b = await c().then(count);

        await c().then(async h => {
            await h.collection(COLLECTION).deleteMany({ atExpiresAt: { $lte: t } });
            h.close();
        });

        a = await c().then(count);

        console.log(`clear expired tokens - before: ${b}, after: ${a}, deleted: ${b - a}`);
    }catch(e){
        console.error(e);
    }
}

async function count(h){
    var rs = await h.collection(COLLECTION).count({});
    h.close();
    return rs;
}

bootstrap();