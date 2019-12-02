
const logger = require('./logging/logger');

require('./docgaga-crx-server').listen(3334, function(){
	logger.info('汤圆笔记插件浏览器启动成功，端口：3334');
});