const FATAL = 'fatal',
      ERROR = 'error',
      WARN = 'warn',
      INFO = 'info',
      DEBUG = 'debug',
      TRACE = 'trace';

const LOG_LEVEL = {
    [FATAL]: { [FATAL]: true },
    [ERROR]: { [FATAL]: true, [ERROR]: true },
    [WARN]: { [FATAL]: true, [ERROR]: true, [WARN]: true },
    [INFO]: { [FATAL]: true, [ERROR]: true, [WARN]: true, [INFO]: true },
    [DEBUG]: { [FATAL]: true, [ERROR]: true, [WARN]: true, [INFO]: true, [DEBUG]: true },
    [TRACE]: { [FATAL]: true, [ERROR]: true, [WARN]: true, [INFO]: true, [DEBUG]: true, [TRACE]: true }
};

function getLogger(name, options){
    return {
        [FATAL]: logger([FATAL], name),
        [ERROR]: logger([ERROR], name),
        [WARN]: logger([WARN], name),
        [INFO]: logger([INFO], name),
        [DEBUG]: logger([DEBUG], name),
        [TRACE]: logger([TRACE], name)
    };
}

function getShortFileName(filename){
    return (filename || '').replace(/^.*\//, '');
}

function logger(type, mod){
    return function(msg){
        var level = process.env.DOCGAGA_LOG_LEVEL || INFO,
            name;
        if(LOG_LEVEL[level][type]){
            name = getShortFileName(mod.filename || mod || '');
            (console[type] || console.log)(`[${type}] ${name} (${new Date()}) - `, msg);
        }
    };
}

module.exports = getLogger;
