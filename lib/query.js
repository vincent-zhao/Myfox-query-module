/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
 File: query.js
 Author: xuyi (xuyi.zl@taobao.com)
 Description: 
 Last Modified: 2012-03-30
*/

require(__dirname + '/../lib/env');

var Hash          = require(__dirname + '/hash');
var Mcache        = require(__dirname + '/cache/mcache.js');
var requestDealer = require(__dirname + '/../src/requestDealer');
var Calc          = require(__dirname + '/../src/calculate');
var fWallClient   = require(__dirname + '/daemon/fireWallClient.js');

var cache = factory.getMcache();
var fireWall = fWallClient.create(fireWallConf.client);

var CACHE_ERROR = {
  'NO_USE'      : 1,
  'NO_DATA'     : 2,
  'TIMEOUT'     : 4,
  'PARSE_WRONG' : 8,
};
var EXPIRE_TIME = {
  'NORMAL' : 86400,
  'GRAY'   : 300,
};


/*{{{ function cacheKey()*/
function cacheKey(str) {
	str = workerConf.mcachePrefix + keyVersion + ':data:' + encodeURI(str);
  if(str.length > 250){
    str = 'Hash{' + Hash.md5(str) + Hash.fnv(str) + '}';
  }
	return str;
}
/*}}}*/

/*{{{ function setCache()*/
function setCache(key,data,ttl){
    cache.set(cacheKey(key), escape(JSON.stringify({t:Date.now(),d:data,e:ttl})), ttl);
}
/*}}} */

/*{{{ function checkSql()*/
function checkSql(route, ip) { 
  var routes = route.res.route;
  var sqlFortest = routes[0].sql;
  if(!ip || !sqlFortest){
    return false;
  }
  var res = fireWall.banSql(sqlFortest, ip);

  if( !!res ){
    fireWallLogger.warning('SQL_BANNED', JSON.stringify(routes[0]));
    return res;
  }
  return false;
}
/*}}}*/

/*{{{ query()*/
var query = function(parseData) {
  this.key = parseData.sql.replace(/ /g, '') + JSON.stringify(parseData.params);
  this.token = process.pid + "&" + __STAT__.totalReqs;
  this.start = Date.now();
  this.parseData = parseData;
  this.route = null;
  this.error = null;
  this.result = null;
  this.ip = null;
  this.expire = 86400;
};
/*}}}*/

/*{{{ query.getData()*/
query.prototype.getData = function (callback) {
  var _self = this;
  var start = Date.now();

  var cacheDone = function (err, res) {
    if(err) {
      requestDealer.dealRequest(_self.parseData, routeDone);
    }else {
      if(__STAT__) {
        __STAT__.cachedReqs ++;
      }
      _self.result    = res.data;
      _self.explain   = res.explainData;
      _self.debugInfo = res.debugInfo;
      callback(_self);
    }
  };

  var routeDone = function (err, route) {
    if (err) {
      _self.error = err;
      callback(_self);
      return;
    }
    _self.route = route;
    _self.routeTime = (Date.now() - start) /1000;
    /*sql封禁检查*/
    var checkRes = checkSql(route, _self.ip); 
    if(checkRes) {
      _self.error = checkRes;
      callback(_self);
      return;
    }
    Calc.create(route, calcDone).exec();
  };

  var calcDone = function (err, res, debugInfo, explainData, expire) {
    if (err || !res || !res.length) {
      _self.error = err;
      expire = EXPIRE_TIME.GRAY;
    }
    if(parseInt(expire) >= 0) {
      _self.expire = expire;
    }
    if(_self.parseData.writeCache){
      setCache(_self.key, {data : res, explain : explainData, debugInfo : debugInfo}, _self.expire);
    }
    _self.result    = res;
    _self.explain   = explainData;
    _self.debugInfo = debugInfo;
    callback(_self);
  }; 

  _self.cacheGet(_self.key, cacheDone);
};
/*}}}*/

/*{{{ query.cacheGet()*/
query.prototype.cacheGet = function (key, callback) {
  var _self = this;
  var error = null;
  var result = null;
  if(!READCACHE || !_self.parseData.readCache) {
    error = CACHE_ERROR['NO_USE'];
    callback(error, result);
    return;
  }
  cache.get(cacheKey(key), function (res) {
    if(!res) {
      error = CACHE_ERROR['NO_DATA'];
      callback(error, result);
      return;
    }
    try{
      res = JSON.parse(unescape(res));
    }catch(e){
      error = CACHE_ERROR['PARSE_WRONG'];
      callback(error, result);
      return;
    }
    if(!res.d || !res.t ) {
      error = CACHE_ERROR['NO_DATA'];
      callback(error, result);
      return;
    }
    _self.expire = res.e - Math.round((Date.now() - res.t) / 1000);
    if(_self.expire < 0) {
      _self.expire = 0;
    }
    result = res.d;
    callback(error, result);
  });
}
/*}}}*/

exports.create = function (parseData) {
  return new query(parseData);
}
