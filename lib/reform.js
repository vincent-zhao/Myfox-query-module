/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
  (C) 2011-2012 Alibaba Group Holding Limited.
  This program is free software; you can redistribute it and/or
  modify it under the terms of the GNU General Public License 
  version 2 as published by the Free Software Foundation.

  File: reform.js
  Author: yixuan.zzq (yixuan.zzq@taobao.com)
  Description: sql重组类
  Last Modified: 2012-02-07
*/

var Select = require("./parser/select");
var Log = require("./log");
var Decare = require("./decare");
var Column = require("./column");
var Lexter = require("./parser/lexter");
var util = require('util');

var nodeMap = [];

exports.CACHE_PREFIX = "#myfox#reform#node#";

var relateMap = [];
relateMap[Select.WHERE.EQ] = "=";
relateMap[Select.WHERE.GT] = ">";
relateMap[Select.WHERE.GE] = ">=";
relateMap[Select.WHERE.LT] = "<";
relateMap[Select.WHERE.LE] = "<=";
relateMap[Select.WHERE.NE] = "!=";
relateMap[Select.WHERE.BETWEEN] = "BETWEEN";
relateMap[Select.WHERE.IN] = "IN";
relateMap[Select.WHERE.NOTIN] = "NOT IN";
relateMap[Select.WHERE.LIKE] = "LIKE";
relateMap[Select.WHERE.NOTLIKE] = "NOT LIKE";
relateMap[Select.WHERE.ISNULL] = "IS NULL";
relateMap[Select.WHERE.NOTNULL] = "IS NOT NULL";

var serverList = [];

var Reform = function(query,tbnode){
	this.query = query;
	this.distinct = null;
	this.tbnode = tbnode;
	this.output = [];
	this.column = [];
	this.groups = [];
	this.orders = [];
	this.limits = null;
	this.colmap = [];
	this.wheres = [];
}

/*{{{ distinct()*/
/**
 * 是否带有distinct
 * @param empty
 * @return {boolean}
 */
Reform.prototype.dist = function(){
	if(this.distinct && this.distinct.text.toUpperCase()=="DISTINCT"){
		return true;
	}
	return false;
}
/*}}}*/

/*{{{ result()*/
/**
 * 生成分片路由信息主方法
 * @param empty
 * @return {Object} 路由结果对象 
 */
Reform.prototype.result = function(){
	var stack = this.query;
	var merged = [];
	for(var i in stack["tables"]){merged[i] = stack["tables"][i];}
	for(var i in stack["joinmap"]){merged[i] = stack["joinmap"][i];}
	var tables = this.reformTable(merged);
  if(typeof(tables) == 'string'){
      return tables;
  }
	var wheres = this.reformWhere(stack["where"]);
	var orders = this.buildColumn(stack["columns"],stack["orderby"]);
	var gb;
	if(this.groups.length == 0){
		gb = "";
	}else{
		gb = " GROUP BY "+this.groups.join(",");
	}
	var query = "SELECT "+this.column.join(",")+" FROM {TABLES}{WHERES}"+gb+orders+this.reformLimits(stack["limits"]);
	var reform = [];
  var table,where,tw,getSrvs;
  for(var i = 0;i < tables.length; i++){
  table = tables[i];
  where = [];
  tw = table.where ? table.where : "";
  if(tw!=""){where.push(tw);}
  if(wheres.length!=0){where.push(wheres);}
    reform.push({
      host : table.hosts.join(","),
      time : table.time,
      sql : (query.replace(/{TABLES}/,table.table).replace(/{WHERES}/,where.length == 0 ? "" : " WHERE "+where.join(" AND "))).trim()
    });
	}
  var re = {};
  re.distinct = this.dist();
  re.columns = this.output;
  re.groups = this.groups;
  re.orders = this.orders;
  re.limits = this.limits;
  re.route = reform;
  return re;
}
/*}}}*/

/*{{{ buildColumn()*/
/**
 * 重组分片sql中的列，并且重组分片sql中的orderby字段
 * @param {Object} stack 原始sql语句中的column部分内容
 * @param {Object} orders 原始sql中的orderby字段内容
 * @return {String}
 */
Reform.prototype.buildColumn = function(stack,orders){
  var dist = false;
  var s;
  for(var name in stack){
    s = stack[name];
    dist = dist ? dist : s.dist;
    Column.build(s.expr,name,s.dist);
  }
  this.output = Column.transform();
  this.orders = {};
  var colmap = Column.maps();
  var res = [];
  var order,cl,al,value;
  var orderLen = orders.length;
  var op = this.output;
  for(var i = 0;i < orderLen;i++){
    order = orders[i];
    cl = Lexter.text(order.expr).join("");
    al = cl;
    if(!op[cl] && !op["*"]){
      if(!colmap[cl]){
        Column.build(order.expr,cl,"",true);
      }else{
        al = colmap[cl];
      }
    }

    value = order.type == Select.ORDER.DESC ? "DESC" : "ASC";
    this.orders[al] = value;
    res.push(cl+" "+value);
  }
  this.distinct = dist;
  this.column = Column.getAll(this.groups);
  this.output = Column.transform();
  return res.length == 0 ? "" : " ORDER BY "+res.join(",");
}
/*}}}*/

/*{{{ reformTable()*/
/**
 * 整合分片sql的表字段和部分where字段（部分是指只是where字段中的路由字段）
 * @param {Object} tables 查询牵涉到的各个表
 * @return {Array} 每个表的具体路由节点等信息
 */
Reform.prototype.reformTable = function(tables){
	var routes = {};
  var tab,tbname,tabNodeInfo,len,tmp,tmpLen,table,run;
	for(var alias in tables){
		routes[alias] = [];
    tab = tables[alias];
		tbname = tab.table;
		if(!this.tbnode[tbname]){
      return "Undefined table named as "+tbname;
    }
    tabNodeInfo = this.tbnode[tbname];
    len = tabNodeInfo.length;
    table = routes[alias];
    for(var i = 0;i < len; i++){
      tmp = tabNodeInfo[i];
      tmpLen = tmp.length;
      for(var j = 0;j < tmpLen; j++){
				run = tmp[j];
				table.push({
					table : run.real_table,
					time : run.addtime ? run.addtime : 0,
					hosts : trim(run.hosts_list.split(",")),
					route : run.route_val ? run.route_val : null,
					joins : tab.method ? tab.method : null,
					where : tab.where ? tab.where : null
				});
			}
		}
	}
	var decare = Decare.create();
	for(var alias in routes){
		decare.register(alias,routes[alias]);
	}
	var res = [];
	var result = decare.cal();
    var len = result.length;
    var run,hosts,mtime,table,joins,where,configRoute;
    for(var i = 0;i < len; i++){
		run = result[i];
		if(!run){continue;}
		hosts = [];
		mtime = 0;
		table = [];
		joins = [];
		where = [];
/*{{{*/
    var config,nodeLen;
		for(var alias in run){
			config = run[alias];
      nodeLen = hosts.length;
      var tmp;
			if(nodeLen != 0){
				tmp = [];
        var cn = config.hosts;
        var cnLen = cn.length;
        for(var j = 0;j < nodeLen; j++){
					for(var k = 0;k < cnLen;k++){
						if(hosts[j] == cn[k]){
							tmp.push(hosts[j]);
							break;
						}
					}
				}
				hosts = tmp;
			}else{
				hosts = config.hosts ? config.hosts : [];
			}
			if(hosts.length == 0){console.log("Crossing hosts between joined tables");}
			if(config.time){
				mtime = mtime > config.time ? mtime : config.time;
			}
      configRoute = config.route;
			if(configRoute){
        var t,configRouteVal;
				for(var key in configRoute){
					t = alias+"."+key;
          configRouteVal = configRoute[key];
					where.push(t + " = "+configRouteVal);
					this.wheres[t] = configRouteVal;
					this.wheres[key] = configRouteVal;
				}
			}
			if(!config.joins){
				table.push(config.table+" AS "+alias);
			}else{
				joins.push(config.joins+" "+config.table+" AS "+alias+" ON "+config.where);
			}
		}
/*}}}*/
		res.push({
			hosts : hosts,
			time : mtime,
			table : (table.join(",")+" "+joins.join(" ")).trim(),
			where : where.join(" AND ")
		});
	}
	return res;
}
/*}}}*/

/*{{{ reformWhere()*/
/**
 * 整合分片sql中非路由字段的where字段
 * @param {Array} stack 原始sql语句的where字段内容
 * @return {String} 分片sql的部分where
 */
Reform.prototype.reformWhere = function(stack){
	var wheres = [];
    var op,t,col,values;
    var whereLen = stack.length;
    for(var i  = 0;i < whereLen;i++){
		op = stack[i];
		t = [];
		if(op.dbname){t.push(op.dbname);}
		if(op.tbname){t.push(op.tbname);}
		if(op.column){t.push(op.column.text);}
		col = t.join(".");
		if(this.wheres[col]){continue;}

		switch(op.relate){
		case Select.WHERE.BETWEEN:
			values = Lexter.text(op.values," AND ");
			break;
		case Select.WHERE.IN:
		case Select.WHERE.NOTIN:
			values = Lexter.text(op.values,",");
			values.unshift("(");
			values.push(")");
			break;
		default:
			values = Lexter.text(op.values);
			break;
		}
		wheres.push(col+" "+relateMap[op.relate]+" "+values.join(""));
	}
	if(wheres.length == 0){
		return "";
	}
	return wheres.join(" AND ");
}
/*}}}*/

/*{{{ reformLimits()*/
/**
 * 整合分片sql中的limit字段
 * @param {Array} stack 原始sql中的limit字段内容
 * @param {String}
 */
Reform.prototype.reformLimits = function(stack){
	if(!stack || stack.length == 0){
		this.limits = null;
		return "";
	}
	this.limits = {
		offset : stack[0].text,
		length : stack[1].text
	};
	return " LIMIT 0, "+(stack[0].text+stack[1].text);
}
/*}}}*/

/*{{{ trim()*/
/**
 * 过滤host列表中非数字部分
 * @param {Array} arr 含有host节点的数组
 * @return {Array} 过滤后的host节点数组
 */
function trim(arr){
	var res = []
  var len = arr.length;
  var exist;
	for(var i = 0;i < len;i++){
    if(isNaN(arr[i])){continue;}
		exist = false;
		for(var j = 0;j < i;j++){
			if(arr[i] == arr[j]){exist = true;break;}
		}
		if(!exist){res.push(arr[i]);}
	}
	return res;
}
/*}}}*/

/*{{{ create()*/
/**
 * 创建Reform对象方法
 * @param {Array} query sql解析后的token
 * @param {Object} tbnode 每个表的路由信息
 * @return {Object} Reform类对象
 */
exports.create = function(query,tbnode){
	Column.init();
	return new Reform(query,tbnode);
}
/*}}}*/

exports.init = function(){
	serverList = [];
}
exports.cleanNodeMap = function(){
    nodeMap = [];
}
