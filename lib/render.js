/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
  (C) 2011-2012 Alibaba Group Holding Limited.
  This program is free software; you can redistribute it and/or
  modify it under the terms of the GNU General Public License 
  version 2 as published by the Free Software Foundation.

  File: render.js
  Author: yixuan (yixuan.zzq@taobao.com)
  Description: 输出数据格式化类（暂时没用）
  Last Modified: 2012-02-07
*/

var sep = String.fromCharCode('\x01');

/*{{{ render()*/
/**
 * 输出数据格式化
 * @param {Object} obj 输出数据对象
 * @return {String} 格式化后数据
 */
function render(obj){
  var res = "";
  var version = (obj.version !== undefined) ? obj.version : "2.0";
  var code = (obj.code !== undefined) ? obj.code : 506;
  var msg = (obj.msg !== undefined) ? obj.msg : "";
  var data = (obj.data !== undefined) ? obj.data : [];
  res += (version + sep + code + sep + msg + sep + data.length + "\r\n");
  if(data.length == 0){return res;}
  for(var i in data[0]){
    res += (i + sep);
  }
  res = (res.substr(0,res.length-1) + "\r\n");
  for(var i = 0; i < data.length; i++){
    for(j in data[i]){
      res += (data[i][j] + sep);
    } 
    res = (res.substr(0,res.length-1) + "\r\n");
  }
  return res;
}
/*}}}*/

module.exports = render;
