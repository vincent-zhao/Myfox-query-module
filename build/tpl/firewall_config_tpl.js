/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
 (C) 2011-2012 Alibaba Group Holding Limited.
 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU General Public License
 version 2 as published by the Free Software Foundation.

 File: firewall_config.js
 Author: xuyi (xuyi.zl@taobao.com)
 Description: firewall配置文件
 Last Modified: 2012-02-27
*/

module.exports = {
  slowQueryAutoKill : false,
  forKillTm : 5,
  getListInterval : 1000,
  maxCountForWrite : 5,
  blackListFile :__dirname + '/../run/blackList',
  writeBlackTimes : 3, /*统计次数，写黑名单*/
  process_Query : 'Query',
  process_Time : 2,
  maxRowsByExplain : 10000,
  servers : [
    ##online_servers##,
    ],
  client : {
    blackListFile :__dirname + '/../run/blackList',
    sysLoadMax : 6,
    slowQueryPercentage : 0.5,
  },
}
