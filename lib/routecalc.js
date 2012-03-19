/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
  (C) 2011-2012 Alibaba Group Holding Limited.
  This program is free software; you can redistribute it and/or
  modify it under the terms of the GNU General Public License 
  version 2 as published by the Free Software Foundation.

  File: routecalc.js
  Author: yixuan (yixuan.zzq@taobao.com)
  Description: 路由计算类
  Last Modified: 2012-02-037
*/

require('./env.js');
var Hash = require('./hash');
var hash = require('./rules/hashes')
var mirror = require('./rules/mirror');
var numsplit = require('./rules/numsplit');
var LCache = require('./cache/lcache');
var dataloader = factory.getDataLoader();

if(!Conf){
  var Conf = {lcacheLength:1000}
}

var lcache = LCache.create(Conf.lcacheLength);

var ROUTE = {
  MIRROR: 0,
  HASH: 1,
  SPLIT: 2
}

/*{{{ routeValue() */
/**
 * 拼合路由值
 * @param {Object} table 表对象
 * @param {Object} field 路由值Map
 * @return {String} 路由值组合结果
 */
function routeValue(table,field){
  switch(table.tableInfo.route_type){
    case ROUTE.MIRROR:
      return mirror.route();
    case ROUTE.HASH:
      return hash.route(field);
    case ROUTE.SPLIT:
      return numsplit.route(field);
    default:
      break;
  } 
}
/*}}}*/

/*{{{ findNodes() */
/**
 * 查询路由节点
 * @param {Object} table 表对象
 * @param {Object} field 路由值Map
 * @param {Function} cb 回调函数
 * @return void
 */
function findNodes(reqObj,table,field,cb){
  var route = routeValue(table,field);
  var key = table.tableInfo.table_name + "|" + route;
  var get = lcache.get(key);
  if(get !== false){
    cb(null,get); 
  }else{
    var sql = "SELECT hosts_list,real_table,modtime FROM $$v1 WHERE route_sign = $$v2 AND table_name = $$v3 AND route_text=$$v4 AND route_flag >= 300 AND route_flag < 400";
    var r_sign = sign(route,table.tableInfo.table_name);
    if(!dataLoaderConf.routeTable.useSuffix){
      sql = sql.replace('$$v1', dataLoaderConf.routeTable.dbname + "." + dataLoaderConf.routeTable.table_prefix + dataLoaderConf.routeTable.table_name);
    }else{
      sql = sql.replace('$$v1', dataLoaderConf.routeTable.dbname + "." + dataLoaderConf.routeTable.table_prefix + dataLoaderConf.routeTable.table_name + "_" + r_sign.toString(16).substr(0,1).toLowerCase());
    }
    sql = sql.replace('$$v2', r_sign);
    sql = sql.replace('$$v3', "'" + table.tableInfo.table_name + "'");
    sql = sql.replace('$$v4', "'" + route + "'"); 

    dataloader.query(sql,reqObj,function(err,data){
      if(err){
        cb(err,data);
        return;
      }
     
      var fields = {};
      for(var i in field){
        fields[i] = field[i];
      }
      for(var nodeidx in data){
        data[nodeidx]["route_val"] = fields;
      }

      lcache.set(key,data);
      cb(err,data);
    });
  }
}
/*}}}*/

/*{{{ sign() */
/**
 * route_sign签名计算
 * @param {String} str 拼合好的路由值字符串
 * @param {String} tbname 表名
 * @return {int} 签名结果
 */
function sign(str,tbname){
  return Hash.crc32(trim(str) + "|" + tbname);
}
/*}}}*/

/*{{{ trim()*/
/**
 * 过滤字符
 * @param {String} str 需要过滤的字符串
 * @return {String} 过滤后的字符串
 */
function trim(str){
  return str.replace(/(^[\\s]*)|([\\s]*$)/g, "");
}
/*}}}*/

exports.findNodes = findNodes;
exports.ROUTE = ROUTE;
exports.cleanRouteInfo = function(){
  lcache.clean();
}
