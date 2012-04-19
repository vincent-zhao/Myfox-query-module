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

require(__dirname + '/env.js');
var Select = require(__dirname + "/parser/select");
var Log    = require(__dirname + "/log");
var Decare = require(__dirname + "/decare");
var Column = require(__dirname + "/column");
var Lexter = require(__dirname + "/parser/lexter");
var util   = require('util');

var nodeMap = [];

exports.CACHE_PREFIX = "#myfox#reform#node#";

var relateMap = [];
relateMap[Select.WHERE.EQ]      = "=";
relateMap[Select.WHERE.GT]      = ">";
relateMap[Select.WHERE.GE]      = ">=";
relateMap[Select.WHERE.LT]      = "<";
relateMap[Select.WHERE.LE]      = "<=";
relateMap[Select.WHERE.NE]      = "!=";
relateMap[Select.WHERE.BETWEEN] = "BETWEEN";
relateMap[Select.WHERE.IN]      = "IN";
relateMap[Select.WHERE.NOTIN]   = "NOT IN";
relateMap[Select.WHERE.LIKE]    = "LIKE";
relateMap[Select.WHERE.NOTLIKE] = "NOT LIKE";
relateMap[Select.WHERE.ISNULL]  = "IS NULL";
relateMap[Select.WHERE.NOTNULL] = "IS NOT NULL";

var Reform = function(query,tbnode,reqObj){
  this.query    = query;
  this.distinct = null;
  this.tbnode   = tbnode;
  this.reqObj   = reqObj;
  this.output   = [];
  this.column   = [];
  this.groups   = [];
  this.orders   = [];
  this.limits   = null;
  this.colmap   = [];
  this.wheres   = [];
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
  var stack     = this.query;
  var merged    = [];
  var existJoin = false;

  for(var i in stack["tables"]){
    merged[i] = stack["tables"][i];
  }
  for(var i in stack["joinmap"]){
    existJoin = true;
    merged[i] = stack["joinmap"][i];
  }
  existJoin = existJoin | (!ANALYSIZE_UNIQUEKEY);

  var tables = this.reformTable(merged,existJoin);
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

  var normalPattern,uniquePattern;
  if(orders.length === 0){
    normalPattern = "SELECT "+this.column.join(",")+" FROM {TABLES}{WHERES}"+gb+this.reformLimits(stack["limits"]);
    uniquePattern = "SELECT "+removeFunc(this.column.join(","))+" FROM {TABLES}{WHERES}"+gb+this.reformLimits(stack["limits"]);
  }else{
    normalPattern = "SELECT "+this.column.join(",")+" FROM {TABLES}{WHERES}"+gb+" ORDER BY "+orders.join(",")+this.reformLimits(stack["limits"]);
    uniquePattern = "SELECT "+removeFunc(this.column.join(","))+" FROM {TABLES}{WHERES}"+gb+" ORDER BY "+removeFunc(orders.join(","))+this.reformLimits(stack["limits"]);
  }

  var tabColMap = [];
  if(!existJoin){
    tabColMap = getColumnMap();
  }

  var reform = [];
  var table,where,tw,getSrvs;
  for(var i = 0;i < tables.length; i++){
    table = tables[i];
    where = [];
    tw = table.where ? table.where : "";
    if(tw!=""){where.push(tw);}
    if(wheres.length !== 0){where.push(wheres);}

    var uni = false;
    if(!existJoin){
      uni = isUnique(tabColMap,table);
    }

    if(uni){
      var originalSql = (normalPattern.replace(/{TABLES}/,table.table).replace(/{WHERES}/,where.length == 0 ? "" : " WHERE "+where.join(" AND "))).trim();
      var changedSql  = (uniquePattern.replace(/{TABLES}/,table.table).replace(/{WHERES}/,where.length == 0 ? "" : " WHERE "+where.join(" AND "))).trim();
      workerLogger.warning("UNIQUE_KEY|token:"+this.reqObj.token,"original:"+originalSql+"|changed:"+changedSql);

      reform.push({
        host : table.hosts.join(","),
        time : table.time,
        sql  : USE_UNIQUEKEY ? changedSql : originalSql
      });
    }else{
      reform.push({
        host : table.hosts.join(","),
        time : table.time,
        sql  : (normalPattern.replace(/{TABLES}/,table.table).replace(/{WHERES}/,where.length == 0 ? "" : " WHERE "+where.join(" AND "))).trim()
      });
    }
  }

  return {
    'distinct' : this.dist(),
    'columns'  : this.output,
    'groups'   : this.groups,
    'orders'   : this.orders,
    'limits'   : this.limits,
    'route'    : reform
  }
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
  var colmap  = Column.maps();
  var res     = [];

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

  return res;
}
/*}}}*/

/*{{{ reformTable()*/
/**
 * 整合分片sql的表字段和部分where字段（部分是指只是where字段中的路由字段）
 * @param {Object} tables 查询牵涉到的各个表
 * @return {Array} 每个表的具体路由节点等信息
 */
Reform.prototype.reformTable = function(tables,existJoin){
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
      tmp    = tabNodeInfo[i];
      tmpLen = tmp.length;
      for(var j = 0;j < tmpLen; j++){
        run = tmp[j];
        table.push({
          table     : run.real_table,
          time      : run.modtime ? run.modtime : 0,
          hosts     : hostSplit(run.hosts_list),
          route     : run.route_val ? run.route_val : null,
          uniqueKey : run.unique_key,
          joins     : tab.method ? tab.method : null,
          where     : tab.where ? tab.where : null
        });
      }
    }
  }
  var decare = Decare.create();
  for(var alias in routes){
    decare.register(alias,routes[alias]);
  }
  var res    = [];
  var result = decare.cal();
  var len    = result.length;
  var run,hosts,mtime,table,joins,where,configRoute;
  for(var i = 0;i < len; i++){
    run = result[i];
    if(!run){continue;}
    hosts  = [];
    mtime  = 0;
    table  = [];
    joins  = [];
    where  = [];
    unique = [];
    /*{{{*/
    var config,nodeLen;
    for(var alias in run){
      config  = run[alias];
      nodeLen = hosts.length;
      var tmp;
      if(nodeLen != 0){
        tmp       = [];
        var cn    = config.hosts;
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
      if(hosts.length == 0){console.log("Crossing nodes between joined tables");}
      if(config.time){
        mtime = mtime > config.time ? mtime : config.time;
      }
      configRoute = config.route;
      if(configRoute){
        var t,configRouteVal;
        for(var key in configRoute){
          t = alias+"."+key;
          configRouteVal = configRoute[key];
          where.push(t+" = "+configRouteVal);
          this.wheres[t] = configRouteVal;
          this.wheres[key] = configRouteVal;
        }
      }
      if(!config.joins){
        table.push(config.table+" AS "+alias);
        if(!existJoin){
          unique[alias] = config.uniqueKey.split(";");
          if(unique[alias].length !== 0){
            var last = unique[alias].pop();
            if(last.charAt(last.length-1) === "$"){
              unique[alias].push(last.substr(0,last.length-1));
            }
          }
        }
      }else{
        joins.push(config.joins+" "+config.table+" AS "+alias+" ON "+config.where);
      }
    }
    /*}}}*/
    res.push({
      hosts     : hosts,
      time      : mtime,
      uniqueKey : unique,
      table     : (table.join(",")+" "+joins.join(" ")).trim(),
      where     : where.join(" AND ")
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

/*{{{ hostSplit()*/
/**
 * 过滤host列表是否溢出
 * @param {String} str 含有host节点的string
 * @return {Array} 过滤后的host节点数组
 */
function hostSplit(str){
  var res = [];
  if(str.charAt(str.length-1) === "$"){
    var get = str.substr(0,str.length-1).split(",");
    for(var i = 0;i < get.length; i++){
      if(!isNaN(get[i])){res.push(get[i]);}
    }
  }else{
    var get = str.substr(0,str.length).pop();
    for(var i = 0;i < get.length; i++){
      if(!isNaN(get[i])){res.push(get[i]);}
    }
  }
  return res;
}
/*}}}*/

/*{{{ removeFunc()*/
/**
 * 去除SUM等方法
 * @param {String} str 需要处理的字符串
 * @return {String} 过滤好后的字符串
 */
function removeFunc(str){
  var exp = new RegExp("((SUM)|(AVG)|(MAX)|(MIN))\\(","i");
  var res = "";

  while(true){
    var pos = str.search(exp);
    if(pos === -1){
      return res+str;
    }
    if(str.charAt(pos-1) !== undefined && str.charAt(pos-1).match(/\w/i)){
      continue;
    }
    var lev = 0;
    for(var i = pos;i < str.length;i++){
      if(str.charAt(i) === "("){
        lev++;
        continue;
      }
      if(str.charAt(i) === ")" && --lev === 0){
        res += str.substr(0,pos) + str.substr(pos+4,i-pos-4);
        str = str.substr(i+1);
        break;
      }
    }
  }
}
/*}}}*/

/*{{{ getColumnMap()*/
/**
 * 生成一张表名对应字段名的map
 * @return Array
 */
function getColumnMap(){
  var tabColMap    = [];
  var selectColumn = Column.getSelectColumn();

  for(var i in selectColumn){
    if(selectColumn[i].dist !== undefined){
      var split = selectColumn[i].expr.split(".");
      if(split.length === 2){
        if(tabColMap[split[0]] === undefined){
          tabColMap[split[0]] = [];
        }
        tabColMap[split[0]].push(split[1]);
      }else{
        if(tabColMap[""] === undefined){
          tabColMap[""] = [];
        }
        tabColMap[""].push(split[0]);
      }
    }
  }

  return tabColMap;
}
/*}}}*/

/*{{{ isUnique()*/
function isUnique(tabColMap,table){
  if(tabColMap[''] !== undefined){
    var count = 0;
    for(var i in tabColMap){
      if(++count > 1){
        return false;
      }
    }
    for(var j in table["uniqueKey"]){
      var tmp = table["uniqueKey"][j];
      for(var k in tabColMap[""]){
        if(isInArray(tmp,tabColMap[""][k])){
          return true;
        }
      }
    }
  }else{
    for(var j in table["uniqueKey"]){
      var tmp = table["uniqueKey"][j];
      for(var k in tabColMap[j]){
        if(isInArray(tmp,tabColMap[j][k])){
          return true;
        }
      }
    }
  } 
  return false;
}
/*}}}*/

/*{{{ isInArray()*/
/**
 * 判断元素是否在数组中
 * @param {Array} arr 数组
 * @param {string|int} element 所要判断元素
 * @return {boolean} 是否存在
 */
function isInArray(arr,element){
  for(var i in arr){
    if(arr[i] === element){return true;}
  }
  return false;
}
/*}}}*/

/*{{{ create()*/
/**
 * 创建Reform对象方法
 * @param {Array} query sql解析后的token
 * @param {Object} tbnode 每个表的路由信息
 * @return {Object} Reform类对象
 */
exports.create = function(query,tbnode,reqObj){
  Column.init();
  return new Reform(query,tbnode,reqObj);
}
/*}}}*/

exports.cleanNodeMap = function(){
  nodeMap = [];
}
