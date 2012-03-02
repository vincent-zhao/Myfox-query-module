/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
  (C) 2011-2012 Alibaba Group Holding Limited.
  This program is free software; you can redistribute it and/or
  modify it under the terms of the GNU General Public License 
  version 2 as published by the Free Software Foundation.

  File: column.js
  Author: yixuan.zzq (yixuan.zzq@taobao.com)
  Description: sql列操作类
  Last Modified: 2012-02-07
*/

var Lexter = require("./parser/lexter");

var R_MAX = 2;
var R_MIN = 4;
var R_SUM = 8;
var R_COUNT = 16;
var R_CONCAT = 32;
var N_COLUMN_PREFIX = "i_am_virtual_";

exports.REFORM_MAX = R_MAX;
exports.REFORM_MIN = R_MIN;
exports.REFORM_SUM = R_SUM;
exports.REFORM_COUNT = R_COUNT;
exports.REFORM_CONCAT = R_CONCAT;
exports.NEW_COLUMN_PREFIX = N_COLUMN_PREFIX;

var groupFunctions = ["SUM","AVG","COUNT","MAX","MIN","GROUP_CONCAT"];
var l = groupFunctions.length;
var mergeMaps = {
  "SUM" : R_SUM,
  "MAX" : R_MAX,
  "MIN" : R_MIN,
  "AVG" : R_SUM,
  "COUNT" : R_SUM,
  "GROUP_CONCAT" : R_CONCAT
};

var columnCounter = 1;
var columnAlias = [];
var selectColumn = [];

function init(){
	columnCounter = 1;
	columnAlias = [];
	selectColumn = [];
}

/*{{{ public build()*/
/**
 * 重构sql列,保存在全局变量中
 * @param {Object} token 词法解析结果
 * @param {String} name 列名字
 * @param {String} dist distinct类型
 * @param {boolean} hide 是否隐藏该列
 * @return void 
 */
function build(token,name,dist,hide){
  dist = dist ? dist : "";
  hide = hide ? hide : false;
  name = name.trim();

  var chars = [];
  var myfox = [];
  var len = token.length;
  var ch;
  for(var i = 0;i < len;i++){
    ch = token[i];
    if(ch.type == Lexter.types.STRING){
      chars[i] = "\'"+ch.text+"\'";
    }else{
      chars[i] = ch.text;
    }
    if(ch.type != Lexter.types.FUNCTION){
      continue;
    }
    for(var j = 0;j < l;j++){
      if(groupFunctions[j] == ch.text.toUpperCase()){
        myfox.push(i);
      }
    }
  }
  if(myfox.length == 0){
    var column = chars.join("");
    var alias = getName(column,name);
    if(!selectColumn[alias]){
      selectColumn[alias] = {
        expr : column,
        dist : dist,
        fetch : true,
        hide : hide,
        merge : null
      };
    }
    if(alias != name){
      selectColumn[name] = {
        expr : alias,
        fetch : false,
        hide : hide
      };
    }
    return;
  }
  var offset = 0;
  var output = [];
  len = myfox.length;
  var text,getChild,clen,expr,elen,funame,funObj,alias;
  for(var i = 0;i<len;i++){
    text = ["("];
    getChild = Lexter.vars(myfox[i],token,false);
    clen = getChild.length;
    for(var j = 0;j < clen;j++){
      expr = getChild[j];
      elen = expr.length;
      for(var k = 0;k < elen;k++){
        text.push(expr[k].text);
      }
    }
    text.push(")");
    var myfoxIdx = myfox[i];
    output.push(chars.slice(offset,myfoxIdx).join(""));
    offset = myfoxIdx + text.length+1;
    funame = chars[myfoxIdx].toUpperCase();
    funobj = text.join("");
    if(funame == "AVG"){
      var t1 = "SUM" + funobj;
      var t2 = "COUNT" + funobj;
      var column1 = getName(t1);
      var column2 = getName(t2);
      selectColumn[column1] = {
        expr : t1,
        group : true,
        fetch : true,
        hide : true,
        merge : R_SUM
      };
      selectColumn[column2] = {
        expr : t2,
        group : true,
        fetch : true,
        hide : true,
        merge : R_SUM
      };
      output.push(column1+" / "+column2);
    }else{
      var t1 = funame + funobj;
      var column1 = getName(t1);
      selectColumn[column1] = {
        expr : t1,
        group : true,
        fetch :true,
        hide : true,
        merge : mergeMaps[funame]
      }
      output.push(column1);
    }
  }
  output.push(chars.slice(offset,chars.length).join(""));
  column = output.join("");
  alias = getName(column,name);
  if(!selectColumn[alias]){
    selectColumn[alias] = {
      expr : column,
      fetch : false,
      hide : hide
    };
  }
  if(alias != name){
    selectColumn[name] = {
      expr : alias,
      fetch : false,
      hide : hide
    };
  }
}
/*}}}*/

/*{{{ public getAll()*/
/**
 * 获得存放处理好的列的数组，处理好意为重命名等
 * @param {Array} groups 存放聚合列（暂无用）
 * @return 处理好的类组成的数组
 */
function getAll(groups){
  var select = [];
  var flate = true;
  var option;
  for(var alias in selectColumn){
    option = selectColumn[alias];
    if(!option.fetch){
      continue;
    }
    var dist = option.dist ? option.dist.text.toUpperCase() : "";
    if(alias == option.expr){
      select.push((dist+" "+option.expr).trim());
    }else{
      select.push((dist+" "+option.expr+" AS "+alias).trim());
    }
    if(!option.group){
      groups.push(alias);
    }else{flate = false;}
  }
  if(flate){
    while(groups.length != 0){
      groups.pop();
    }
  }
  return select;
}
/*}}}*/

/*{{{ public transform()*/
/**
 * 将已经保存的column相关信息组合成适当结构输出
 * @param empty
 * @return {Object}
 */
function transform(){
  var column = {};
  var option;
  for(var alias in selectColumn){
    option = selectColumn[alias];
    column[alias] = {
      expr : option.fetch ? "" : option.expr,
      merge : option.merge ? option.merge : null,
      hide : option.hide ? true : false
    }
  }
  return column;
}
/*}}}*/

/*{{{ public maps()*/
/**
 * 返回别名Map
 ＊@param empty
 * @return {Object}
 */
function maps(){
  return columnAlias;
}
/*}}}*/

/*{{{ private getName()*/
/**
 * 获得列名字
 * @param {String} expr 列表达式
 * @param {String} alias 别名
 * @return {String}
 */
function getName(expr,alias){
  if(!alias){alias = null;}
  expr = expr.trim();
  if(alias){alias = alias.trim();}
  if(!columnAlias[expr]){
    alias = alias ? alias : N_COLUMN_PREFIX+columnCounter++;
    columnAlias[expr] = alias;
  }
  return columnAlias[expr];
}
/*}}}*/

exports.name = getName;
exports.maps = maps;
exports.build = build;
exports.getAll = getAll;
exports.transform = transform;
exports.init = init;
