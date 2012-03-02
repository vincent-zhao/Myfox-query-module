/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
  (C) 2011-2012 Alibaba Group Holding Limited.
  This program is free software; you can redistribute it and/or
  modify it under the terms of the GNU General Public License 
  version 2 as published by the Free Software Foundation.
  
  File: worker.js
  Author: yixuan,xuyi (yixuan.zzq@taobao.com,xuyi.zl@taobao.com)
  Description: myfox请求处理主程序
  Last Modified: 2012-02-03
*/

require('../lib/env');

var net    = require('net');
var http   = require('http');
var Calc   = require('../src/calculate');
var Hash   = require('../lib/hash');
var parse  = require('../lib/parse')
var render = require('../lib/render');
var Mcache = require('../lib/cache/mcache.js');
var requestDealer = require('../src/requestDealer');

var cache = factory.getMcache();

/* {{{ cacheKey()*/
/**
 * 生成cache键
 * @param {String} str 原始的键
 * @return {String} 
 */
function cacheKey(str) {
  workerConf.mcachePrefix = 'workerCache';
	str = workerConf.mcachePrefix + ':data:' + encodeURI(str);
  if(str.length > 250){
    str = 'Hash{' + Hash.md5(str) + Hash.fnv(str) + '}';
  }
	return str;
}
/* }}}*/

/*{{{ cacheShell()*/
/**
 * cache壳，判断cache是否有效或者存在
 * @param {String} str 需要查询的字符串
 * @return void
 */
var cacheShell = function(str){
  Events.EventEmitter.call(this);
  var _self = this;
  var canEmit = true;
  var timeout = setTimeout(function(){
    canEmit = false;
    _self.emit('noData');
  },1000);
  cache.get(cacheKey(str),function(res){

    var wrong = false;
    try{
      var res = JSON.parse(unescape(res));
    }catch(e){
      wrong = true;
    }
    //console.log(res);

    if ( !wrong && res && res.data && res.data.length > 0) {
      if(canEmit){
        clearTimeout(timeout);
        _self.emit('getData', res);
      }
    }else{
      if(canEmit){
        clearTimeout(timeout);
        _self.emit('noData');
      }
    }
  });
}
Util.inherits(cacheShell, Events.EventEmitter);
/*}}}*/

/*{{{ setCache()*/
/**
 * 设置缓存
 * @param {String} key cache原始键
 * @param {Object} data 需要缓存的数据
 * @param {int} ttl 缓存超时时间
 * @return void
 */
function setCache(key,data,ttl){
    cache.set(cacheKey(key), escape(JSON.stringify(data)), ttl);
}
/*}}} */

var pipe            = null;
var server          = null;
var exit_timer      = null;
var child_req_count = 0;
var cached_req_count = 0;
var now_req_count = 0;
var period_count = 0;
var period_interval_minute = 30;
var allUseTime = 0;
var queryQueue = [];
var period_situation = [];
var period_situation_length = 24;

/*{{{ onhandle()*/
/**
 * 处理tcp连接
 * @param {Object} self 绑定的服务
 * @param {Object} handle tcp连接句柄
 * @return void
 */
function onhandle(self, handle){
  var socket = new net.Socket({
    handle : handle,
    allowHalfOpen : self.allowHalfOpen 
  });
  socket.readable = socket.writable = true;
  socket.resume();
  self.connections++;
  socket.server = self;
  self.emit("connection", socket);
  socket.emit("connect");
}
/*}}}*/

/*{{{ createServer()*/
/**
 * 创建服务
 * @param {Function} function(req,res){} 回调函数
 * return void
 */
server = http.createServer(function(req, res){
  if(req.method == "GET"){
    res.end();
  }else if(req.method == "POST"){
    var data = "";
    req.on("data",function(chunk){
      data += chunk;
    });
    req.on("end",function(){
      period_count++;
      child_req_count++;
      now_req_count++;

      var start = Date.now();
      var parseData = parse(data);
      var key = parseData.sql.replace(/ /g, '') + JSON.stringify(parseData.params);

      if(queryQueue[key]){
        queryQueue[key].push({res:res,startTime:start});
        workerLogger.notice('QueryMerged' + process.pid + '[' + req.connection.remoteAddress + ']',JSON.stringify(parseData));
        return;
      }else{
        queryQueue[key] = [{res:res,startTime:start}];
      }

      workerLogger.notice( 'getQuery_' + process.pid + '[' + req.connection.remoteAddress + ']',JSON.stringify(parseData));

      if(USECACHE && parseData.useCache){
        var cacheGeter = new cacheShell(key); 
        cacheGeter.on('getData',function(d){
          cached_req_count++;
          writeBack(key, JSON.stringify(d));
        });
        cacheGeter.on('noData',function(){
          requestDealer.dealRequest(parseData,function(err,route){
            if(err){
              workerLogger.warning("ROUTE_WRONG",err);
              writeBack(key, JSON.stringify({msg:err, data:[]}));
              return;
            }
            route.routeTime = (Date.now() - start) / 1000;
            calc(route,key);
          });
        });
      }else{
        requestDealer.dealRequest(parseData,function(err,route){
          if(err){
            workerLogger.warning("ROUTE_WRONG",err);
            writeBack(key, JSON.stringify({msg:err, data:[]}));
            return;
          }
          route.routeTime = (Date.now() - start) / 1000;
          calc(route, key);
        });
      }
    });
  }
});
/*}}}*/

/*{{{ writeBack()*/
/**
 * 写回数据给用户
 * @param {String} key 请求key，用于削峰策略 
 * @param {String} data 写回的数据
 * @return void
 */
function writeBack(key, data){
  queryQueue[key].forEach(function(res){
    now_req_count--;
    allUseTime += (Date.now() - res.startTime);
    workerLogger.notice('RES', JSON.stringify({timeUse:Date.now() - res.startTime,length:data.length,key:key}));
    res.res.end(data); 
  });
  delete queryQueue[key];
}
/*}}}*/

/*{{{ calc()*/
/**
 * 分片数据获取及处理主入口函数
 * @param {Object} route 路由结果
 * @param {String} cKey 请求的key
 * @return void
 */
function calc(route, cKey){
  var getRes = Calc.create(route,function(err,res,debugInfo){
    if(err){
      //errHandle(err);
    }
    if(route.reqObj.isDebug){
      res = {
        data        : res,
        msg         : err.toString(),
        route       : route.res.route,
        columns     : route.res.columns,
        routeTime   : route.routeTime,
        getResDebug : debugInfo,
      };
    }else{
      res = { data : res , msg : err};
    }
    workerLogger.debug('DebugRes', JSON.stringify({
      data      : res,
      msg       : err.toString(),
      route     : route.res.route,
      columns   : route.res.columns,
      routeTime : route.routeTime,
    }));
    setCache(cKey, {data : res.data, msg : res.msg}, 86400);
    writeBack(cKey, JSON.stringify(res));
  });
  getRes.exec();
}
/*}}}*/

/*{{{ heartbeat*/
/**
 * 心跳函数，向master发送心跳
 */
setInterval(function(){
  var info = {
    type : "hb",
    handleNum : server.connections,
    pid : process.pid
  }
  process.send(info);
},workerConf.hbInterval);
/*}}}*/

/*{{{ process.on("message")*/
/**
 * 处理master发来的信息
 */
process.on("message",function(m ,handle){
  if(handle){
    onhandle(server, handle);
  }
  if(m.status == "update"){
    process.send({"status" : process.memoryUsage()});
  }
});
/*}}}*/

console.log("worker is running...");
