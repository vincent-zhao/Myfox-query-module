/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
  File: datamerge.js
  Author: yixuan,xuyi (yixuan.zzq@taobao.com,xuyi.zl@taobao.com)
  Description: 分片数据整合类
  Last Modified: 2012-02-07
*/

require('./env');
var QuickEval = require("./quickeval");

var ORDER_DESC = -1;
var ORDER_ASC  = 1;

var REFORM_MAX    = 2;
var REFORM_MIN    = 4;
var REFORM_SUM    = 8;
var REFORM_COUNT  = 16;
var REFORM_CONCAT = 32;
/**
 * DataMerge 构造函数
 */
var DataMerge = function(){
  this.evals      = [];
  this.hidden     = [];
  this.sortArr    = [];
  this.sortKey    = [];
  this.groupBy    = [];
  this.groupUse   = [];
  this.types      = [];
  this.distinct   = false;
  this.limitStart = 0;
  this.length     = -1;
}

/*{{{ function emptyAll()*/
/**
 * 清空排序结果
 * @return {None}
 */
DataMerge.prototype.emptyAll = function(){
  this.sortArr = [];
}
/**}}}/

/*{{{ function setDistinct()*/
/**
 * 设置distinct 	
 * @param {string} distinct
 */
DataMerge.prototype.setDistinct = function(distinct){
  if(arguments.length == 0){
    distinct = false;
  }
  this.distinct = distinct;
}
/*}}}*/

/*{{{ function setEvals()*/
/**
 * 设置Evals
 * @param {String} evals 
 */
DataMerge.prototype.setEvals = function(evals){
  this.evals = [];
  for(var key in evals){
    var expr = evals[key];
    this.evals[key] = QuickEval.create(expr);
  }
}
/*}}}*/

/*{{{ function setSortKey()*/
DataMerge.prototype.setSortKey = function(sortKey){
  for(var key in sortKey){
    if('string' == typeof(sortKey[key]) && sortKey[key].trim() == 'DESC'){
      sortKey[key] = -1;
    }else{
      sortKey[key] = 1;
    }
  }
  this.sortKey = sortKey;
}
/*}}}*/

/*{{{ function setLimit()*/
DataMerge.prototype.setLimit = function(limitStart,length){
  if(limitStart <= 0){
    limitStart = 0;
  }
  this.limitStart = limitStart;
  this.length = length;
}
/*}}}*/

/*{{{function setGroupBy()*/
DataMerge.prototype.setGroupBy = function(groupBy){
  this.groupBy = groupBy;
}
/*}}}*/

/*{{{ function setMerge()*/
DataMerge.prototype.setMerge = function(groupUse){
  this.groupUse = groupUse;
}
/*}}}*/

/*{{{ function setHidden()*/
DataMerge.prototype.setHidden = function(hidden){
  this.hidden = hidden;
}
/*}}}*/

/*{{{ function filterEvals()*/
/**
 * 表达式求值
 * @param  {Object} data 
 * @return {Object}
 */
DataMerge.prototype.filterEvals = function(data){
  var _self = this;
  if( empty(_self.evals) ){
    return data;
  }
  for(var i in data){
    var row = data[i];
    for(var key in _self.evals){
      row[key] = _self.evals[key].execute(row);
    }
  }
  return data;
}
/*}}}*/

/*{{{ filterHidden()*/
/**
 * 过滤结果集隐藏字段
 * @param  {Object} data 
 * @return {Object}
 */
DataMerge.prototype.filterHidden = function(data){
  var _self = this;
  if(_self.hidden.length == 0){
    return data;
  }
  for(var i in data){
    var row = data[i];
    for(var j in _self.hidden){
      var key = _self.hidden[j];
      delete row[key];
    }
  }
  return data;
}
/*}}}*/

/*{{{function filterLimit()*/
/**
 * 按Limit过滤结果集
 * @param  {Object} data 
 * @return {Object}
 */
DataMerge.prototype.filterLimit = function(data){
  var _self = this;
  if(_self.length < 0){
    return data;
  }
  return data.slice(_self.limitStart,_self.limitStart+_self.length);
}
/*}}}*/

/*{{{function push()*/
DataMerge.prototype.push = function(arr){
  this.sortArr.push(arr);
}
/*}}}*/

/*{{{ getData()*/
/**
 * 取得Merge结果
 * @return {Object}
 */
DataMerge.prototype.getData = function(){
  var _self = this;
  if( !empty(_self.groupUse) ){
    return _self.filterHidden(_self.polymerize());
  }
  var data = _self.mergeSort2();
  if(data.length == 0){
    return [];
  }
  return _self.filterHidden(_self.filterEvals(_self.filterLimit(data)));
}
/*}}}*/

/*{{{ mergeSort2()*/
/**
 * Merge结果集排序
 * @return {Object}
 */
DataMerge.prototype.mergeSort2 = function(){
  var _self = this;
  var arr = format(_self.sortArr);
  var keys = _self.sortKey;
  for(var key in keys){
    arr = kSort(arr,keys);
  }
  if(_self.distinct){
    return distinct(arr);
  }
  return arr;
}
/*}}}*/

/*{{{ function polymerize()*/	
/**
 * 进行merge计算	
 * @return {Object}
 */
DataMerge.prototype.polymerize = function(){
  var _self = this;
  var group = [];
  (function(){
  for(var i in _self.sortArr){
    var twoArr = _self.sortArr[i];
    for(var j in twoArr){
      var oneArr = twoArr[j];
      var groupKey = _self.getKey(oneArr);
      if(!group[groupKey]){
        group[groupKey] = {};
        for(var key in oneArr){
          group[groupKey][key] = oneArr[key];
        }
      }else{
        for(var key in _self.groupUse){
          var type = _self.groupUse[key];
          if(type == REFORM_MAX){
            if(oneArr[key] !== null){
              if(group[groupKey][key] === null){
                group[groupKey][key] = oneArr[key];
              }else{
                group[groupKey][key] = oneArr[key] > group[groupKey][key] ? oneArr[key] : group[groupKey][key];
              }
            }
          }else if(type == REFORM_MIN){
            if(oneArr[key] !== null){
              if(group[groupKey][key] === null){
                group[groupKey][key] = oneArr[key];
              }else{
                group[groupKey][key] = oneArr[key] < group[groupKey][key] ? oneArr[key] : group[groupKey][key];
              }
            }
          }else if(type == REFORM_SUM){
            if(oneArr[key] !== null){
              if(group[groupKey][key] === null){
                group[groupKey][key] = oneArr[key];
              }else{
                group[groupKey][key] = Math.round((parseFloat(oneArr[key]) + parseFloat(group[groupKey][key])) * 100) / 100;
              }
            }
          }else if(type == REFORM_CONCAT){
            group[groupKey][key] = (group[groupKey][key] === null ? "":group[groupKey][key]); 
            if(oneArr[key] === null){
              oneArr[key] = "";
            }
            group[groupKey][key] = group[groupKey][key]+","+oneArr[key];
          }else{}
        }
      }
    }
  }
  for(var i in group){
    for(var j in group[i]){
      group[i][j] = (group[i][j] === null ? 0:group[i][j]);
    }
  }
  })();
  return _self.heapSort2(group);
}
/*}}}*/

/*{{{ function kSort() */
/**
 * 排序函数，主要运用js内置sort
 * 
 * @param  {Array} arr  需要排序的结果集
 * @param  {Array} keys 按照keys中key的顺序排序
 * @return {Array}
 */
function kSort(arr,keys){
  arr = arr.sort(function(a,b){
    for(var key in keys){
      if(a[key] == b[key]){
        continue ;
      }
      if(a[key] > b[key]){
        return keys[key];
      }else{
        return keys[key] * -1;
      }
      break;
    }
    return 0;
  });
  return arr;
}
/*}}}*/

/*{{{ function format() */
/**
 * 结果集格式化
 * @param  {Array} arr 
 * @return {Array}
 */
function format(arr){
  var res = [];
  var alen = arr.length;
  for(var i = 0; i< alen; i++){
    res = res.concat(arr[i]);
  }
  return res;
}
/*}}}*/

/*{{{  distinct()*/
/**
 * 对结果集进行distinct处理
 * @param  {Array} arr 
 * @return {Array}
 */
function distinct(arr){
  var tmp = [];
  var alen = arr.length;
  for (var i = 0 ; i< alen; i++){
    var ele = arr[i];
    if(tmp.length == 0){
      tmp.push(ele);
      continue;
    }
    var push = true;
    var tlen = tmp.length;
    for(var a = 0 ; a < tlen ; a++){
      if(objCompare(tmp[a],ele)){
        push = false;
        break;
      }else{
        continue;
      }
    }
    if(push){
      tmp.push(ele);
    }
  }
  return tmp;
}
/*}}} */

/*{{{ function objCompare()*/
/**
 * 对象比较函数
 * @param  {Object} obj1 
 * @param  {Object} obj2 
 * @return {Boolean}
 */
function objCompare(obj1,obj2){
  if(obj1 == null || obj2 == null){
    return false;
  }
  for(var i in obj1){
    if(obj2[i] != obj1[i]){ return false; }
  }
  for(var i in obj2){
    if(obj2[i] != obj1[i]){return false;}
  }
  return true;
}
/*}}}*/

/*{{{ compare()*/
DataMerge.prototype.compare = function(row1,row2){
  var _self = this;
  for(var key in _self.sortKey){
    var val = _self.sortKey[key];
    var cmp1 = row1[key] ? row1[key] : null;
    var cmp2 = row2[key] ? row2[key] : null;
    if(cmp1 == cmp2){
      continue;
    }
    var ret = cmp1 > cmp2;
    if((ret && val == ORDER_DESC) || (!ret && val == ORDER_ASC)){
      return 1;
    }
    if((!ret && val == ORDER_DESC) || (ret && val == ORDER_ASC)){
      return -1;
    }
  }
  return 0;
}
/*}}}*/

/*{{{ getKey()*/
/**
 * 生成用于merge的group key
 * @param  {Object} row 
 * @return {String}
 */
DataMerge.prototype.getKey = function(row){
  var _self = this;
  var res = [];
  for(var i in _self.groupBy){
    var column = _self.groupBy[i];
    res.push(column+","+row[column]);
  }
  return res.join(",");
}
/*}}}*/

/*{{{ function heapSort2()*/
/**
 * 结果集排序函数，基于ksort
 * @param  {Array} data 
 * @return {Array}
 */
DataMerge.prototype.heapSort2 = function(data){
  var _self = this;
  var arr = [];
  for(var key in data){
    arr.push(data[key]);
  }
  arr = _self.filterEvals(arr);
  for(var key in _self.sortKey){
    arr = kSort(arr,_self.sortKey);
  }
  return _self.filterLimit(arr);
}
/*}}}*/

/*{{{ exports*/
exports.ORDER_DESC = ORDER_DESC;
exports.ORDER_ASC = ORDER_ASC;
exports.REFORM_MAX = REFORM_MAX;
exports.REFORM_MIN = REFORM_MIN;
exports.REFORM_SUM = REFORM_SUM;
exports.REFORM_COUNT = REFORM_COUNT;
exports.REFORM_CONCAT = REFORM_CONCAT;
/*}}}*/

/*{{{ create()*/
exports.create = function(){
  return new DataMerge();
}
/*}}}*/

