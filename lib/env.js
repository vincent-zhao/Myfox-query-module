/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
 (C) 2011-2012 Alibaba Group Holding Limited.
 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU General Public License
 version 2 as published by the Free Software Foundation.

 File: env.js
 Author: xuyi (xuyi.zl@taobao.com)
 Description: 环境配置
 Last Modified: 2012-02-20
*/


global.Util    = require('util');
global.Events  = require("events");
global.tool    = require(__dirname + '/tool.js');
global.Log     = require(__dirname + '/log.js');
global.factory = require(__dirname + '/factory');

global.DEBUG       = true;
global.CLOSING     = false;
global.READCACHE    = true;
global.ANALYSIZE_UNIQUEKEY = true;
global.USE_UNIQUEKEY = true;
global.SPLIT_TIMES = 0;

global.splitReqNum    = 0;
global.splitCachedNum = 0;

global.masterConf      = require(__dirname + '/../conf/master_config.js');
global.workerConf      = require(__dirname + '/../conf/worker_config.js');
global.fireWallConf    = require(__dirname + '/../conf/firewall_config.js');
global.memCacheConf    = require(__dirname + '/../conf/memcache_config.js');
global.dataLoaderConf  = require(__dirname + '/../conf/dataloader_config.js');
global.mysqlLoaderConf = require(__dirname + '/../conf/mysqlloader_config.js');

global.keyVersion  = "";


global.workerLogger   = Log.create(workerConf.logLevel, workerConf.logPath, "worker");
global.masterLogger   = Log.create(workerConf.logLevel, workerConf.logPath, "master");
global.mysqlLogger    = Log.create(workerConf.logLevel, workerConf.logPath, "mysql");
global.slowLogger     = Log.create(workerConf.logLevel, workerConf.logPath, "slow");
global.memcacheLogger = Log.create(workerConf.logLevel, workerConf.logPath, "memcache");
global.fireWallLogger = Log.create(workerConf.logLevel, workerConf.logPath, "fireWall");

global.__STAT__ = {
  totalReqs    : 0,
  cachedReqs   : 0,
  totalSplits  : 0,
  nowReqs      : 0,
  cachedSplits : 0,
  allUseTime   : 0,
  logLevel     : workerLogger.getLevel(),
};

/* {{{ function length()*/
/**
 * 全局方法 得到数组或对象的长度
 * @param  {Array|Object} obj 
 * @return {Integer}
 */
global.length = function(obj){
  var num = 0, i;
  for (i in obj) {
    num++;
  }
  return num;
}
/*}}}*/

/* {{{ function empty()*/
/**
 * 全局方法 验证数组|对象是否为空
 * @param  {Array|Object} obj 
 * @return {Boolean}
 */
global.empty = function(obj){
  var i;
  for (i in obj) {
    return false;
  }
  return true;
}
/*}}}*/

/* {{{ function debug()*/
/**
 * 全局方法 debug信息输出
 * @param  {String} str debug字符串
 * @return {None}
 */
global.debug = function(str){
  if(global.DEBUG){
    console.log(str);
  }
}
/*}}}*/

var exec = require('child_process').exec;

/*{{{ function getLocalIp()*/
/**
 * 获得本机ip
 * @return void
 */
global.getLocalIp = function(){
  exec('hostname -i',function(err, stdout, stderr){
    if(!err){
      global.localIp = stdout;
    }
  });
}

getLocalIp();


