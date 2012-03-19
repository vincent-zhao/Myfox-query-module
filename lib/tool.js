/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
 (C) 2011-2012 Alibaba Group Holding Limited.
 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU General Public License
 version 2 as published by the Free Software Foundation.

 File: tool.js
 Author: yixuan (yixuan.zzq@taobao.com)
 Description: 工具类
 Last Modified: 2012-02-20
*/

/*{{{ objectClone()*/
/**
 * 复制对象
 * @param {Object} obj 需要复制的对象
 * @param {String} preventName 需要屏蔽复制的字段名字
 * @return {Object} 返回的复制对象
 */
function objectClone(obj,preventName){
  if((typeof obj) == 'object' && obj !== null){
    var res = (!obj.sort)?{}:[];
    for(var i in obj){
      if(i != preventName)
        res[i] = objectClone(obj[i],preventName);
    }
    return res;
  }else if((typeof obj) == 'function'){
    return (new obj()).constructor;
  }
  return obj;
}
exports.objectClone = objectClone;
/*}}}*/

