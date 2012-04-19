/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
 (C) 2011-2012 Alibaba Group Holding Limited.
 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU General Public License
 version 2 as published by the Free Software Foundation.

 File: fireWallClient.js
 Author: xuyi (xuyi.zl@taobao.com)
 Description: 防火墙客户端
 Last Modified: 2012-02-29
*/
var fs = require('fs');
var os = require('os');
var util = require('util');
var normal = require(__dirname + '/sqlNormalize.js').create();

normal.register(/(\w+)_\d+\.\w+/g,"$1");
var isArray = Array.isArray;
var response = {
  SQL   : JSON.stringify({data:[],code:500,expire:'%d'}),
  IP    : JSON.stringify({data:[],code:501,expire:-1}),
  ALL   : JSON.stringify({data:[],code:502,expire:-1}),
};
var MIN_COUNT_USE_PRECENT = 100;

/* {{{ function _parse()*/
function _parse(data){
  var ret = {};
  data = data.toString().split("\n");
  if(isArray(data)) {
    for(var i = 0; i < data.length; i++){
      if(data[i]){
        var arr = data[i].split("\t");
        ret[arr[0].trim()] = Date.parse(arr[1]);
      }
    }
  }
  return ret;
}
/* }}}*/

/* {{{ function _empty()*/
function _empty(obj){
  for(var key in obj){
    return false;
  }
  return true;
}
/* }}}*/

/* {{{ fireWall()*/
var fireWall = function(config){
  this.bannedSql = {};
  this.bannedIp = {};
  this.recordIp = {};
  this.banAll = false;
  this.config = config;
  var _self = this;
  _self._read();
  fs.watchFile(_self.config.blackListFile, function(curr, prev) {
    if (curr.mtime.getTime() !== prev.mtime.getTime()) {
      _self._read();
    }
  });
  
  var times = 0;
  //周期执行
  setInterval(function() {
    times ++;
    _self.sysCheck();
    if(times % 60 === 0){
      _self.fresh();
    }
    if(times === 60 * 30) { /* 30 minutes */
      times = 0;
      _self.empty();
    }
  }, 1000);

}
/* }}}*/

/*{{{ function _read()*/
fireWall.prototype._read = function () {
  var _self = this;
  fs.readFile(_self.config.blackListFile,function(err, data) {
    if(err){
      console.log(err);
    }
    if (data) {
      _self.bannedSql = _parse(data);
    }
  });
}
/*}}}*/

/* {{{ function sysCheck()*/
fireWall.prototype.sysCheck = function(){
  var load = os.loadavg();
  if(load[0] > this.config.sysLoadMax){
    this.banAll = true;
  }else{
    this.banAll = false;
  }
}
/* }}}*/

/* {{{ function banIp()*/
fireWall.prototype.banIp = function (ip) {
  if(this.recordIp[ip]){
    this.recordIp[ip].total ++;
    var minPercentage =  this.config.slowQueryPercentage / 2;
    if(this.bannedIp[ip] && ((this.recordIp[ip].banned / this.recordIp[ip].total) < minPercentage)){
      delete this.bannedIp[ip];
    }
  }
  if(this.banAll){
    //return true;
    return response.ALL;
  }
  if(this.bannedIp[ip]){
    //return true;
    return response.IP;
  }
  return false;
}
/* }}}*/

/* {{{ function banSql()*/
fireWall.prototype.banSql = function (sql, ip) {
  var _self = this;
  if(_empty(this.bannedSql)) { /*黑名单为空不进行检查*/
    return false;
  }
  sql = normal.execute(sql);
  ip  = ip.trim();
  if(this.bannedSql[sql]){
    /*开始记录Ip*/
    if(this.recordIp[ip]){
      this.recordIp[ip].banned ++;
      if((this.recordIp[ip].total > MIN_COUNT_USE_PRECENT) && 
         ((this.recordIp[ip].banned / this.recordIp[ip].total) > this.config.slowQueryPercentage)){
        this.bannedIp[ip] = true;
      }
    }else{
      this.recordIp[ip] = {total : 1, banned : 1};
    }
    //return true;
    var now = Date.now();
    return util.format(response.SQL, Math.round((_self.bannedSql[sql] - now)/1000) );
  }
  return false;
}
/* }}}*/

/* {{{ function getBannedSql()*/
fireWall.prototype.getBannedSql = function(){
  return this.bannedSql;
}
/* }}}*/

/* {{{ function getBannedIp()*/
fireWall.prototype.getBannedIp = function(){
  return this.bannedIp;
}
/* }}}*/

/* {{{ function fresh()*/
fireWall.prototype.fresh = function(){
  //this.bannedIp = {};
  //this.ips = {};
  //更新sql黑名单
  for(var sql in this.bannedSql){
    if(this.bannedSql[sql] < Date.now()){
      delete this.bannedSql[sql];
    }
  }
}
/* }}}*/

/* {{{ function empty()*/
fireWall.prototype.empty = function(){
  this.bannedIp = {};
  this.recordIp = {};
}
/* }}}*/

exports.create = function(config){
  return new fireWall(config);
}

