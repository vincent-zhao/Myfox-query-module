/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
 (C) 2011-2012 Alibaba Group Holding Limited.
 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU General Public License
 version 2 as published by the Free Software Foundation.

 File: calculate.js
 Author: xuyi (xuyi.zl@taobao.com)
 Description: 数据加载及计算
 Last Modified: 2012-02-20
*/

require('../lib/env.js');
var DataMerge  = require('../lib/datamerge.js');
var MysqlLoader = factory.getMysqlLoader();

/*{{{ function calc()*/
/**
 * calc 构造函数  
 * @param  {Object}   req 请求对象
 * @param  {Function} cb  回调
 * @return {None}
 */
var calc = function(req, cb){
  this.route = req.res; 
  this.control = req.reqObj;
  this.merge = _mergeInit(req.res); 
  this.cb = cb;
  this.debugInfo = {}; /*debug信息*/
}
/*}}}*/

/* {{{ function calc.exec()*/
/**
 * 
 *数据加载&整合计算 主函数
 * @return {None}
 */
calc.prototype.exec = function(){
  var _self = this;
  var res = '';
  _self.getData(function(err,res){
    if(err){
      _self.cb(err, '');
      return;
    }
    res = _getMerge(_self.merge, res);
    _self.cb('', _self.format(res), _self.debugInfo);
  });
}
/*}}}*/

/*{{{ function calc.format()*/
/**
 * 过滤结果集
 * @param  {Object} data 结果集
 * @return {Object}
 */
calc.prototype.format = function(data){
  var _self = this;
  var ret = [];
  var columns = _self.route.columns;
  if (columns['*']) {
    ret = data;
  } else {
    ret = data.map(function(d){
      var n = {};
      for (var key in columns) {
        if (!columns[key]["hide"]) {
          n[key] = d[key];
        }
      }
      return n;
    });
  }
  return ret;
}
/*}}}*/

/*{{{ function _getMerge()*/
/**
 * 获取Merge结果
 * @param  {Object} merge merge对象
 * @param  {Object} data  需要merge的结果集
 * @return {Object}
 */
function _getMerge(merge, data){
  while (data.length !== 0) {
    merge.push(data.shift());
  }
  return merge.getData();
}
/*}}}*/

/*{{{ function getData()*/
/**
 * 获取数据
 * @param  {Function} cb 
 * @return {None}
 */
calc.prototype.getData = function(cb){
  var _self = this;
  var route = _self.route;
  var num = route.route.length;
  var ret = [];
  var isReturned = false;
  _self.debugInfo.splitData = [];
  MysqlLoader.getData(route,function(err, res , debug){
    num --;
    if(isReturned){
      return;
    }
    if(err){
      cb(err, '');
      isReturned = true;
      return;
    }
    if(_self.control.isDebug){
      _self.debugInfo.splitData.push({info:debug,data:res});
    }
    ret.push(res);
    if( !num ){
      isReturned = true;
      cb('', ret);
    }
  },_self.control.isDebug,_self.control.useCache);
}
/*}}}*/

/*{{{ function _mergeInit()*/
/**
 * Merge 初始化
 * @param  {Object} info 配置
 * @return {Object}
 */
function _mergeInit(info){
  var merge = DataMerge.create();
  if (info.distinct){
    merge.setDistinct(info.distinct);
  }
  if (info.limits) {
    merge.setLimit(info.limits['offset'], info.limits['length']);
  }
  if (!empty(info.groups)) {
    merge.setGroupBy(info.groups);
  }
  if (!empty(info.orders)) {
    merge.setSortKey(info.orders);
  }
  var output = info.columns;
  var evals  = [];
  var groups = [];
  var hidden = [];
  for (var key in output) {
    var opt = output[key];
    opt.expr  && (evals[key] = opt.expr);
    opt.merge && (groups[key] = opt.merge);
    opt.hide  && (hidden[key] = opt.hide);
  }
  merge.setEvals(evals);
  merge.setMerge(groups);
  merge.setHidden(hidden);
  return merge;
}
/*}}}*/

exports.create = function(route, cb){
  return new calc(route, cb);
}
