/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
  (C) 2011-2012 Alibaba Group Holding Limited.
  This program is free software; you can redistribute it and/or
  modify it under the terms of the GNU General Public License 
  version 2 as published by the Free Software Foundation.

  File: hash.js
  Author: yixuan (yixuan.zzq@taobao.com)
  Description: hash路由策略
  Last Modified: 2012-02-07
*/

/*{{{ route()*/
/**
 * hash策略的路由值计算组合
 * @param {Object} fields 路由值
 * @return {String}
 */
exports.route = function(fields){
  var ret = "";
  for(var i in fields){
    ret += (i + ":" + fields[i] + ",");
  }
  return ret.substr(0,ret.length - 1);
}
/*}}}*/
