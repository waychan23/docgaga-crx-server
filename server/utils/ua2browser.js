const BROWSER_ID = {
    BROWSER_CHROME: 'chrome',
    BROWSER_CHROMIUM: 'chromium',
    BROWSER_MS_IE: 'ie',
    BROWSER_MS_EDGE: 'edge',
    BROWSER_FIREFOX: 'firefox',
    BROWSER_SAFARI: 'safari',
    BROWSER_QQ: 'qq',
    BROWSER_WECHAT: 'wechat',
    BROWSER_360: '360',
    BROWSER_BAIDU: 'baidu',
    BROWSER_LIEBAO: 'liebao',
    BROWSER_SOGOU: 'sogou',
    BROWSER_OPERA: 'opera'
};

const BROWSER = {
    [BROWSER_ID.BROWSER_WECHAT]: { name: '微信内置浏览器', 'match': / MicroMessenger\/|WeChat\//i, order: 2 },    
    [BROWSER_ID.BROWSER_QQ]: { name: 'QQ浏览器', 'match': /QQBrowser\/| QQ\//i, order: 3 },    
    [BROWSER_ID.BROWSER_SOGOU]: { name: '搜狗浏览器', 'match': / MetaSr /i, order: 4 },
    [BROWSER_ID.BROWSER_360]: { name: '360浏览器', 'match': /360SE/i, order: 5 },    
    [BROWSER_ID.BROWSER_SAFARI]: { name: 'Safari浏览器', 'match': / Safari\//i, 'notmatch': / Chrome\/| Chromium/i, order: 6 },
    [BROWSER_ID.BROWSER_BAIDU]: { name: '百度浏览器', 'match': /ba?idu(browser)?/i, order: 7 },
    [BROWSER_ID.BROWSER_CHROMIUM]: { name: 'Chromium浏览器', 'match': / Chromium\/[^ ]+/i, order: 8 },
    [BROWSER_ID.BROWSER_FIREFOX]: { name: '火狐浏览器', 'match': / Firefox\//i, 'notmatch': /Seamonkey\//i, order: 9 },
    [BROWSER_ID.BROWSER_LIEBAO]: { name: '猎豹浏览器', 'match': /LBBROWSER/i, order: 10 },
    [BROWSER_ID.BROWSER_OPERA]: { name: '欧朋(Opera)浏览器', 'match': / OPR\/| Opera\//i, order: 11 },
    [BROWSER_ID.BROWSER_MS_IE]: { name: 'IE浏览器', 'match': /; ?MSIE [^;]+;|; ?Trident\/7/i, order: 12 },
    [BROWSER_ID.BROWSER_MS_EDGE]: { name: '微软Edge浏览器', 'match': / Edge\//i, order: 13 },
    [BROWSER_ID.BROWSER_CHROME]: { name: '谷歌(Chrome)浏览器', 'match': / Chrome\/[^ ]+ /i, 'notmatch': / Chromium/i, order: 14 }
};

const browsers = (() => {
    var arr = [], id;

    for(id in BROWSER){
        if(BROWSER.hasOwnProperty(id)){
            BROWSER[id].id = id;
            arr.push(BROWSER[id]);
        }
    }

    return arr.sort((a, b) => a.order - b.order);
})();

function isBrowser(ua, browser){
    var m = browser.match, 
        nm = browser.notmatch;

    if(nm instanceof RegExp && nm.test(ua)){
        return false;
    }else if(typeof nm == 'string' && ua.indexOf(nm) >= 0){
        return false;
    }

    if(m instanceof RegExp && m.test(ua)){
        return true;
    }else if(typeof m == 'string' && ua.indexOf(m) >= 0){
        return true;
    }

    return false;
}

function tell(ua){
    var found, i, brs;

    if(!ua.trim()){
        return null;
    }

    ua = ua.trim().toLowerCase();

    for(i=0;i<browsers.length;i++){
        brs = browsers[i];
        if(isBrowser(ua, brs)){
            found = { id, name } = brs;
            break;
        }
    }

    return found || null;
}

module.exports = {
    BROWSER_ID: BROWSER_ID,
    BROWSERS: Object.assign({}, browsers),
    tell: tell
};