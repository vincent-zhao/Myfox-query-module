/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
 (C) 2011-2012 Alibaba Group Holding Limited.
 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU General Public License
 version 2 as published by the Free Software Foundation.

 File: factory.js
 Author: xuyi (xuyi.zl@taobao.com)
 Description: 工厂类
 Last Modified: 2012-02-20
*/

require('./env.js');
var iniPool = [];

var dataLoader = null;
var mysqlLoader = null;

var memcache = null;

/* {{{ function getMcache()*/
/**
 * 成产Memcache实例
 * @return {Object}
 */
exports.getMcache = function() {
  if(!memcache){
    var Mcache = require('./cache/mcache.js');
    memcache = Mcache.create(memCacheConf.opt);
    memCacheConf.serverList.forEach(function(host){
      memcache.addServer(host.split(':')[0],host.split(':')[1]);
    });
  }
  return memcache;
}
/*}}}*/

/* {{{ function getDataLoader()*/
/**
 * 生产DataLoader实例
 * @return {Object}
 */
exports.getDataLoader = function() {
  if (!dataLoader) {
    dataLoader = require('./dataloader.js');
    dataLoader.init(dataLoaderConf);
  }
  return dataLoader;
}
/*}}}*/

/* {{{ function getMysqlLoader()*/
/**
 * 生产MysqlLoader实例
 * @return {Object}
 */
exports.getMysqlLoader = function() {
  if (!mysqlLoader) {
    mysqlLoader = require('../lib/mysqlloader.js');
  }
  return mysqlLoader;
}
/*}}}*/

/* {{{ function getIni()*/
/**
 * 生产配置文件
 * @param  {String} ini 配置文件路径
 * @return {Object}
 */
exports.getIni = function(ini) {
  if (!iniPool[ini]) {
    iniPool[ini] = require(ini);
  }
  return iniPool[ini];
}
/*}}}*/

