/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
  (C) 2011-2012 Alibaba Group Holding Limited.
  This program is free software; you can redistribute it and/or
  modify it under the terms of the GNU General Public License 
  version 2 as published by the Free Software Foundation.

  File: parse.js
  Author: yixuan (yixuan.zzq@taobao.com)
  Description: 请求解析类
  Last Modified: 2012-02-07
*/

var sep = String.fromCharCode('\x01');
var qs = require('querystring');

/*{{{ parse()*/
/**
 * 请求解析函数
 * @param {String} content 前端传入的请求
 * @return {Object} 转换后的请求对象
 */
function parse(content){
  var res = {};
  var get = qs.parse(content);
  if(get.sql !== undefined){
    res.useCache = true;
    res.isDebug = false;
    res.mode = "sqlMode";
    res.sql = get.sql;
    res.sql = res.sql.trim().replace(/ +/g," ");
    res.params = "";
    return res;
  }else{
    for(var i in get){
      get = (get[i] == "") ? i : i + "=" +get[i];
      break;
    }
    var splits = get.split('\r\n');
    var controls = splits[0].split(sep);
    if(typeof(controls[0]) == "string"){
      if(controls[0] == "false"){
        res.useCache = false;
      }else{
        res.useCache = true;
      }
    }else{
      res.useCache = controls[0];
    }
    if(typeof(controls[1]) == "string"){
      if(controls[1] == "false"){
        res.isDebug = false;
      }else{
        res.isDebug = true;
      }
    }else{
      res.isDebug = controls[1];
    }
    res.mode = splits[1];
    res.sql = splits[2];
    res.sql = res.sql.trim().replace(/ +/g," ");
    res.params = splits[3];
    return res;
  }
}
/*}}}*/

module.exports = parse;
