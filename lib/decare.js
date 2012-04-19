/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
  (C) 2011-2012 Alibaba Group Holding Limited.
  This program is free software; you can redistribute it and/or
  modify it under the terms of the GNU General Public License 
  version 2 as published by the Free Software Foundation.

  File: decare.js
  Author: yixuan.zzq (yixuan.zzq@taobao.com)
  Description: 笛卡尔积计算类
  Last Modified: 2012-02-07
*/

/*{{{ Decare constructor*/
/**
 * Decare对象构造函数
 * @param empty
 * @return void
 */
var Decare = function(){
  this.params = [];
  this.result = [];
}
/*}}}*/

/*{{{ register()*/
/**
 * decare计算项注册
 * @param {String} key 注册项的键
 * @param {Object} val 注册项的值
 * @return {Object}
 */
Decare.prototype.register = function(key,val){
  this.params[key+""] = val;
  this.result = [];
  return this;
}
/*}}}*/

/*{{{ unregister()*/
/**
 * decare注册项取消
 * @param {String} key 注册项的键
 * @return {Object}
 */
Decare.prototype.unregister = function(key){
  delete this.params[key+""];
  this.result = [];
  return this;
}
/*}}}*/

/*{{{ cal()*/
/**
 * 做笛卡尔积
 * @param empty
 * @return {Object}
 */
Decare.prototype.cal = function(){
  if(this.result.length == 0){
    var chunk = [];
    var parts = arrayChunk(this.params,2,true);
    var len = parts.length;
    for(var i = 0;i<len;i++){
      var c = 0;
      for(p in parts[i]){c++;}
      if(c == 1){
        var key1;
        for( j in parts[i]){key1 = j;}
        chunk.push(this.permutation(key1,parts[i][key1],null,null));
      }else{
        var key1 = null;
        var key2 = null;
        for( j in parts[i]){
          if(key1){key2 = j;}
          else{key1 = j;}
        }
        chunk.push(this.permutation(key1,parts[i][key1],key2,parts[i][key2]));
      }
    }
    while(chunk.length > 1){
      var temp = [];
      var parts = arrayChunk(chunk,2,false);
      var len = parts.length;
      for(var i = 0;i<len;i++){
        if(parts[i].length<2){
          temp = parts[i][0];
        }else{
          temp.push(this.decaremerge(parts[i][0],parts[i][1]));
        }
      }
      chunk = temp;
    }
    this.result = chunk[0];
  }
  return this.result;
}
/*}}}*/

/*{{{ permutation()*/
Decare.prototype.permutation = function(key1,arr1,key2,arr2){
  var res = [];
  var len = arr1.length;
  for(var i = 0;i<len;i++){
    if(!key2 || arr2.length==0){
      var t = [];
      t[key1] = arr1[i];
      res.push(t);
    }else{
      var len2 = arr2.length;
      for(var j = 0;j<len2;j++){
        var t = [];
        t[key1] = arr1[i]
          t[key2] = arr2[j];
        res.push(t);
      }
    }
  }
  return res;
}
/*}}}*/

/*{{{ decaremerge()*/
Decare.prototype.decaremerge = function(arr1,arr2){
  var res = [];
  var len1 = arr1.length;
  var len2 = arr2.length;
  for(var i = 0;i<len1;i++){
    for(var j = 0;j<len2;j++){
      var t = [];
      for(e in arr1[i]){t[e]=arr1[i][e];}
      for(e in arr2[j]){t[e]=arr2[j][e];}
      res.push(t);
    }
  }
  return res;
}
/*}}}*/

/*{{{ arrayChunk()*/
function arrayChunk(arr,num,op){
  var res = [];
  var tmp = [];
  var pos = 0;
  var count = 0;
  for(i in arr){
    if(count==num){
      res.push(tmp);
      tmp = [];
      count = 0;
    }
    if(op){
      tmp[i] = arr[i];
      count++;
    }else{
      tmp[tmp.length] = arr[i];
      count++;
    }
  }
  res.push(tmp);
  return res;
}
/*}}}*/

exports.create = function(){
  return new Decare();
}
