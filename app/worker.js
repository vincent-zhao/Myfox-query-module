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
var net         = require('net');
var http        = require('http');
var fs          = require('fs');
var Calc        = require('../src/calculate');
var Hash        = require('../lib/hash');
var parse       = require('../lib/parse')
var Mcache      = require('../lib/cache/mcache.js');
var requestDealer = require('../src/requestDealer');
var masterConf  = require('../etc/master_config.js');
var util = require('util');


var cache = factory.getMcache();
var keyVersion  = "";

/*{{{ cacheKey()*/
/**
 * 生成cache键
 * @param {String} str 原始的键
 * @return {String} 
 */
function cacheKey(str) {
	str = workerConf.mcachePrefix + keyVersion + ':data:' + encodeURI(str);
  if(str.length > 250){
    str = 'Hash{' + Hash.md5(str) + Hash.fnv(str) + '}';
  }
	return str;
}
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
var queryQueue = [];

/*{{{ readStatesFile()*/
/**
 * 读取state文件并设置统一缓存key前缀（run目录下）
 * @param {String} file state文件名
 * @return void
 */
function readStatesFile(file){
  var get = JSON.parse(fs.readFileSync(file).toString());
  keyVersion = get["sqlCacheVersion"];
}
readStatesFile(masterConf.statesFile);
fs.watchFile(masterConf.statesFile,function(curr,prev){
  if(curr.mtime.getTime() !== prev.mtime.getTime()){
    readStatesFile(masterConf.statesFile);
  }
});
/*}}}*/

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
//  console.log("get a connection");
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
      child_req_count++;
      now_req_count++;

      var parseData = parse(data);
      parseData.pid = process.pid;
      parseData.token = process.pid.toString() + "&" + child_req_count.toString();

      workerLogger.notice( 'getQuery|token:' + parseData.token + '[' + req.connection.remoteAddress + ']',JSON.stringify(parseData));

      var key = parseData.sql.replace(/ /g, '') + JSON.stringify(parseData.params);
      parseData.key = key;
      parseData.res = res;
      parseData.start = Date.now();

      if(queryQueue[key]){
        queryQueue[key].push(parseData);
        return;
      }else{
        queryQueue[key] = [parseData];
      }

      if(READCACHE && parseData.readCache){
      //if(false){
        cache.get(cacheKey(key),function(res){
            var wrong = false;
            try{
              res = JSON.parse(unescape(res));
            }catch(e){
              wrong = true;
            }
            if ( !wrong && res && res.data && res.data.length > 0) {
              cached_req_count++;
              writeBack(parseData, JSON.stringify(res));
            }else{
              requestDealer.dealRequest(parseData,function(err,route){
                if(err){
                  workerLogger.warning("ROUTE_WRONG|token:"+parseData.token,err);
                  writeBack(parseData, JSON.stringify({msg:err, data:[]}));
                  return;
                }
                route.routeTime = (Date.now() - parseData.start) / 1000;
                calc(route,res);
              });
            }
        });
      }else{
        requestDealer.dealRequest(parseData,function(err,route){
          if(err){
            workerLogger.warning("ROUTE_WRONG|token:"+parseData.token,err);
            writeBack(parseData, JSON.stringify({msg:err, data:[]}));
            return;
          }
          route.routeTime = (Date.now() - parseData.start) / 1000;
          calc(route, res);
        });
      }
    });
  }
});
/*}}}*/

/*{{{ writeBack()*/
/**
 * 写回数据给用户
 * @param {String} parseData 请求对象，用于削峰策略 
 * @param {String} data 写回的数据
 * @return void
 */
function writeBack(parseData, data){
  queryQueue[parseData.key].forEach(function(res){
    now_req_count--;
    workerLogger.notice('RES|token:'+res.token, JSON.stringify({timeUse:Date.now() - res.start,length:data.length}));
    res.res.end(data); 
  });
  delete queryQueue[parseData.key];
}
/*}}}*/

/*{{{ calc()*/
/**
 * 分片数据获取及处理主入口函数
 * @param {Object} route 路由和路由结果(包含路由对象和路由结果)
 * @return void
 */
function calc(route){
  var getRes = Calc.create(route,function(err,res,debugInfo,explainData, expire){
    if(err){
    }
    if(route.reqObj.isDebug){
      res = {
          data        : res,
          msg         : err.toString(),
          route       : route.res.route,
          columns     : route.res.columns,
          routeTime   : route.routeTime,
          getResDebug : debugInfo,
          explain     : explainData
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
      explain   : explainData
    }));
    if(route.reqObj.writeCache){
      setCache(route.reqObj.key, {data : res.data, msg : res.msg}, expire || 86400);
    }
    writeBack(route.reqObj, JSON.stringify(res));
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
