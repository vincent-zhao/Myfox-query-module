/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
  (C) 2011-2012 Alibaba Group Holding Limited.
  This program is free software; you can redistribute it and/or
  modify it under the terms of the GNU General Public License 
  version 2 as published by the Free Software Foundation.

  File: numsplit.js
  Author: yixuan (yixuan.zzq@taobao.com)
  Description: numsplit策略
  Last Modified: 2012-02-07
*/

var hashes = require('./hashes');

/*{{{ route()*/
/**
 * numsplit策略的路由值计算组合
 * @param empty
 * @return void
 */
exports.route = hashes.route;
/*}}}*/
