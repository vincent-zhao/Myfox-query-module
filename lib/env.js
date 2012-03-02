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
global.Log     = require('./log.js');
global.factory = require('./factory');

global.DEBUG       = true;
global.CLOSING     = false;
global.USECACHE    = true;
global.SPLIT_TIMES = 0;

global.splitReqNum    = 0;
global.splitCachedNum = 0;

global.workerConf      = require('../etc/worker_config.js');
global.memCacheConf    = require('../etc/memcache_config.js');
global.dataLoaderConf  = require('../etc/dataloader_config.js');
global.mysqlLoaderConf = require('../etc/mysqlloader_config.js');



global.workerLogger = Log.create(workerConf.logLevel, workerConf.logPath, "worker");
global.mysqlLogger  = Log.create(workerConf.logLevel, workerConf.logPath, "mysql");
global.slowLogger   = Log.create(workerConf.logLevel, workerConf.logPath, "slow");

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
/* }}}*/

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
/* }}}*/

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
/* }}}*/

