/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
 (C) 2011-2012 Alibaba Group Holding Limited.
 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU General Public License
 version 2 as published by the Free Software Foundation.

 File: mysqlloader.js
 Author: xuyi,yixuan (xuyi.zl@taobao.com,yixuan.zzq@taobao.com)
 Description: Mysql加载类 
 Last Modified: 2012-02-20
*/

require(__dirname + '/env');

var Mysql = require(__dirname + '/mysql.js');
var Hash  = require(__dirname + '/hash.js');

var cache      = factory.getMcache();
var DataLoader = factory.getDataLoader();

var node   = {};
var server = {};

/*{{{ function cacheKey()*/
/**
 * 制造memcache mey
 * @param  {String} str 
 * @return {String}
 */
function cacheKey(str) {
  str = mysqlLoaderConf.mcachePrefix + ':data:' + encodeURI(str.replace(/ /g, ''));
  if (str.length > 250) {
    str = 'Hash{' + Hash.md5(str) + Hash.fnv(str) + '}';
  }
  return str;
}
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
//}}}

/*{{{ function getData()*/
/**
 * 获取数据
 * @param  {Object}   route    路由信息
 * @param  {Function} cb       回调
 * @param  {Boolean}  debug    debug开关
 * @param  {Boolean}  usecache Usecache开关
 * @return {None}
 */
var getData = function(route, cb, reqObj) {
  route = route.route;
  var debugInfo = {};
  route.forEach(function(r) {
    if(__STAT__) {
      __STAT__.totalSplits ++;
    }
    if (READCACHE && reqObj.readCache) {  
      cache.get(cacheKey(r.sql), function(res) {
        var wrong = false;
        try{
          res = JSON.parse(unescape(res));
        }catch(e){
          wrong = true;
        }
        memcacheLogger.debug('CACHE_INFO|token:'+reqObj.token, JSON.stringify({'k':r.sql,'h':cacheKey(r.sql),'v':res}));
        if (!wrong && res && res.d && res.d.length > 0 && res.t && r.time <= res.t) {
          if(__STAT__) {
            __STAT__.cachedSplits ++;
          }
          cb('',res.d);
        } else {
          queryMysql(r, cb, 0, reqObj);
        }
      });
    } else {
      queryMysql(r, cb, 0, reqObj);
    }
  });
}
exports.getData = getData;
//}}}

/*{{{ function getExplain()*/
/**
 * 获取sql语句explain信息
 * @param {Object} r 用来查询explain的某个分片对象
 * @param {Function} cb 回调函数
 * @return void
 */
var getExplain = function(r,cb){
  var explainRoute = tool.objectClone(r);
  explainRoute.sql = "explain (" + explainRoute.sql + ")";
  //只是为了复用queryMysql伪造的reqObj
  var reqObj = {
    readCache : false,
    writeCache : false,
    isDebug : false,
    explain : false
  }
  queryMysql(explainRoute,cb,0,reqObj);
}
exports.getExplain = getExplain;
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
function queryMysql(route, cb, index, reqObj) {
  SPLIT_TIMES ++;
  index = index || 0;
  //route.node like this "6,8"
  serverIds = route.host.split(",");
  var num = index;
  if(num === 0){
    num = SPLIT_TIMES % serverIds.length;
  }
  if (reqObj.isDebug) {
    var debugInfo = {};
    debugInfo.serverId = serverIds[index];
    debugInfo.servers = serverIds;
    debugInfo.splitSql = route.sql;
    var begin = Date.now();
  }
  var query = server[parseInt(serverIds[num],10)].query(route.sql,reqObj);
  query.on('err', function(err) {
    mysqlLogger.error('MysqlQueryError|token:'+reqObj.token,JSON.stringify({err : err.toString(), route : route,num : serverIds[num]}));
    if (reqObj.isDebug) {
      debugInfo.queryTime = Date.now() - begin;
    }
    if (index < serverIds.length - 1) {
      index++;
      queryMysql(route, cb, index, reqObj);
    } else {
      cb(err, '', debugInfo,route);
    }
  });
  query.on('res', function(res) {
    if (reqObj.isDebug) {
      debugInfo.queryTime = Date.now() - begin;
    }
    res = format(res);
    if (reqObj.writeCache) {
      setCache(route.sql, { t: route.time, d: res }, 0);
    }
    cb('', res, debugInfo,route);
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
      if ('string' === typeof(row[tk][tkk]) ) {
        if(/^(-)?(\d)*\.(\d)*$/.test(row[tk][tkk])){
          if( row[tk-1] && /^(-)?(\d)*\.(\d)*$/.test(row[tk-1][tkk])){ /*匹配前一个或后一个，若都为同样格式则转换*/
            row[tk][tkk] = parseFloat(row[tk][tkk]);
          }else if( row[tk+1] && /^(-)?(\d)*\.(\d)*$/.test(row[tk+1][tkk])){
            row[tk][tkk] = parseFloat(row[tk][tkk]);
          }
        }
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
    'January'   : '01',
    'February'  : '02',
    'March'     : '03',
    'April'     : '04',
    'May'       : '05',
    'June'      : '06',
    'July'      : '07',
    'August'    : '08',
    'September' : '09',
    'October'   : '10',
    'November'  : '11',
    'December'  : '12'
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
  for(var id in server){
    server[id].close();
  }
});
/*}}}*/

