/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
 (C) 2011-2012 Alibaba Group Holding Limited.
 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU General Public License
 version 2 as published by the Free Software Foundation.

 File: mysqlloader.js
 Author: xuyi (xuyi.zl@taobao.com)
 Description: Mysql加载类 
 Last Modified: 2012-02-20
*/


require('./env');

var Mysql = require('./mysql.js');
var Hash = require('./hash.js');

var cache = factory.getMcache();
var DataLoader = factory.getDataLoader();

var node = {};
var server = {};

/*{{{ function cacheKey()*/
/**
 * 制造memcache mey
 * @param  {String} str 
 * @return {String}
 */
function cacheKey(str) {
	str = str.replace(/ /g, '');
	var mcachePrefix = 'SplitCache';

	str = mcachePrefix + ':data:' + encodeURI(str);
	if (str.length > 250) {
		str = 'Hash{' + Hash.md5(str) + Hash.fnv(str) + '}';
	}
	return str;
}
/*}}}*/

/*{{{ Object cacheShell()*/
/**
 * cache事件化封装
 * @param  {Object} route 
 * @return {None}
 */
var cacheShell = function(route) {

	Events.EventEmitter.call(this);

	var str = route.sql;
	var _self = this;
	var canEmit = true;
	var timeout = setTimeout(function() {
		canEmit = false;
		_self.emit('noData');
	}, 1000);

	cache.get(cacheKey(str), function(res) {

		var wrong = false;

		try {
			var res = JSON.parse(unescape(res));
		} catch(e) {
			wrong = true;
		}

		if (!wrong && res && res.d && res.d.length > 0 && res.t && route.time <= res.t) {
			if (canEmit) {
				clearTimeout(timeout);
				_self.emit('getData', res.d);
			}
		} else {
			if (canEmit) {
				clearTimeout(timeout);
				_self.emit('noData');
			}
		}
	});
}
Util.inherits(cacheShell, Events.EventEmitter);
/*}}}*/

/*{{{ function setCache()*/
/**
 * 设置缓存
 * @param {String} key  缓存Key
 * @param {Object} data 缓存Value
 * @param {Integer} ttl 有效时间
 */
function setCache(key, data, ttl) {
	cache.set(cacheKey(key), escape(JSON.stringify(data)), ttl);
}
/*}}}*/

/*{{{ function init()*/
/**
 * 初始化DataLoader
 * @return {None}
 */
function init() {
	DataLoader.getHostList().forEach(function(host) {
    console.log(mysqlConfWraper(host));
		server[host.host_id] = Mysql.create(mysqlConfWraper(host));
	});
}

init();
/*}}}*/

/*{{{ function mysqlConfWraper()*/
/**
 * 格式化Config Object
 * @param  {Object} conf 配置文件
 * @return {Object}
 */
function mysqlConfWraper(conf) {
	return {
		poolSize: mysqlLoaderConf.poolSize,
		timeout: mysqlLoaderConf.timeout,
		slow: mysqlLoaderConf.slow,
		connInfo: {
			conn_host: conf.conn_host,
			conn_user: conf.read_user,
			conn_port: conf.conn_port,
			conn_pass: conf.read_pass.toString(),
		}
	};
}
/*}}}*/

/*{{{ function getData()*/
/**
 * 获取数据
 * @param  {Object}   route    路由信息
 * @param  {Function} cb       回调
 * @param  {Boolean}  debug    debug开关
 * @param  {Boolean}  usecache Usecache开关
 * @return {None}
 */
var getData = function(route, cb, debug, usecache) {

	var debugInfo = {};
	route = route.route;
	route.forEach(function(r) {
		splitReqNum++;
		if (USECACHE && usecache) {
			var cacheGeter = new cacheShell(r);
			cacheGeter.on('getData', function(data) {
				mysqlLogger.debug('getSplitFromCache', JSON.stringify(r));
				splitCachedNum++;
				cb('', data, debugInfo);
			});
			cacheGeter.on('noData', function() {
				mysqlLogger.debug('getSplitFromCache(noData)', JSON.stringify(r));
				queryMysql(r, cb, 0, debug);
			});
		} else {
			queryMysql(r, cb, 0, debug);
		}
	});
}
exports.getData = getData;
/*}}}*/

/*{{{ function queryMysql()*/
/**
 * 请求Mysql
 * @param  {Object}   route 路由信息
 * @param  {Function} cb    
 * @param  {Integer}  index 标志位
 * @param  {Boolean}  debug debug开关
 * @return {None}
 */
function queryMysql(route, cb, index, debug) {
	SPLIT_TIMES++;
	index = index || 0;
	//route.node like this "6,8"
  serverIds = route.host.split(",");
	var num = index;
	if (num === 0) {
		num = SPLIT_TIMES % serverIds.length;
	}
	if (debug) {
		var debugInfo = {};
		debugInfo.serverId = serverIds[index];
		debugInfo.servers = serverIds;
		debugInfo.splitSql = route.sql;
		var begin = Date.now();
	}
	var query = server[parseInt(serverIds[num],10)].query(route.sql);
	query.on('err', function(err) {
		mysqlLogger.error('MysqlQueryError', JSON.stringify(err));
		if (debug) {
			debugInfo.queryTime = Date.now() - begin;
		}
		if (index < serverIds.length - 1) {
			index++;
			queryMysql(route, cb, index, debug);
		} else {
			cb(err, '', debugInfo);
		}
	});
	query.on('res', function(res) {
		if (debug) {
			debugInfo.queryTime = Date.now() - begin;
		}
		res = format(res);
		setCache(route.sql, {t: route.time, d: res }, 0);
		cb('', res, debugInfo);
	});
}
/*}}}*/

/*{{{ function format()*/
/**
 * 格式化mysql query 结果
 * @param  {Array} row 结果集
 * @return {Array}
 */
function format(row) {
	for (var tk in row) {
		for (var tkk in row[tk]) {
			if ('object' === typeof(row[tk][tkk]) && row[tk][tkk] instanceof Buffer) {
				row[tk][tkk] = row[tk][tkk].toString();
			}
			if ('string' === typeof(row[tk][tkk])) {
				/^(-)?(\d)*\.(\d)*$/.test(row[tk][tkk]) && (row[tk][tkk] = parseFloat(row[tk][tkk]));
			}
			if ('object' === typeof(row[tk][tkk]) && row[tk][tkk] instanceof Date) {
				row[tk][tkk] = formatDate(row[tk][tkk]);
			}
		}
	}
	return row;
}
/*}}}*/

/*{{{ function formatDate()*/
/**
 * 日期格式化
 * @param  {Date} date 
 * @return {String}
 */
function formatDate(date) {
	var datestr = date.toLocaleDateString();
	var res = [];
	var map = {
		'January': '01',
		'February': '02',
		'March': '03',
		'April': '04',
		'May': '05',
		'June': '06',
		'July': '07',
		'August': '08',
		'September': '09',
		'October': '10',
		'November': '11',
		'December': '12'
	};
	datestr = datestr.split(',');

	(function() {
		for (var i = 1; i < datestr.length; i++) {
			if (i === 1) {
				var tmp = datestr[i].trim().split(' ');
				res.push(map[tmp[0].trim()]);
				res.push(tmp[1]);
			} else {
				res.unshift(datestr[i].trim());
			}
		}
	})();

	return res.join('-');
}
/*}}}*/

/*{{{ process.on('exit');*/
process.on('exit', function() {
	for (var id in server) {
		server[id].close();
	}
});
/*}}}*/

