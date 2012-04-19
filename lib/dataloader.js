/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
 (C) 2011-2012 Alibaba Group Holding Limited.
 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU General Public License
 version 2 as published by the Free Software Foundation.

 File: dataloader.js
 Author: xuyi (xuyi.zl@taobao.com)
 Description: 路由数据加载类
 Last Modified: 2012-02-03
*/

require(__dirname + '/env.js');
var Mysql  = require(__dirname + '/mysql.js');
var Hash   = require(__dirname + '/hash.js');
var dns    = require('dns');

var SERVER = {
  ONLINE : 0,
  IMPORT : 1,
  ISDOWN : 9
}

var config = null;
var table  = {};

var master = []; 
var slave  = []; 

/*{{{ function init()*/
/**
 * 初始化dataloader
 * @param  {Object} conf 配置文件对象
 * @return {None}
 */
exports.init = function(conf) {
  conf = tool.objectClone(conf);
  config = conf;
  while(conf.mysql.master.length > 0){
    master.push(Mysql.create(conf.mysql.master.pop())); 
  }
  while(conf.mysql.slave.length > 0){
    slave.push(Mysql.create(conf.mysql.slave.pop())); 
  }
  _loadTable();
}
/*}}}*/

/*{{{ function query()*/
/**
 * 执行sql语句
 * @param  {String}   sql 需要执行的sql
 * @param  {Function} cb  回调函数
 * @return {None}
 */
var query = function(sql, reqObj, cb){
  var req = slave[parseInt(Math.random() * 100) % slave.length]
                .query(sql,reqObj);

  req.on('err',function(err){
    master[parseInt(Math.random() * 100) % master.length]
         .query(sql,reqObj,function(err, res){

      cb(err, res); 

    });
  });
  req.on('res',function(res){
    cb('', res);
  });
}
exports.query = query;
/*}}}*/

/*{{{ function _loadTable()*/
/**
 * 加载表信息到内存，(此方法为阻塞式，供初始化用)
 * @return {None}
 */
function _loadTable(){
  workerLogger.notice("loadTable","loadTable From Server");

  // load hostlist
	var sql = Util.format('SELECT host_id,conn_host,conn_port,read_user,read_pass FROM %s.%shost_list WHERE host_stat = %s', config.routeTable.dbname, config.routeTable.table_prefix, SERVER.ONLINE);
  table['hostList'] = slave[0].querySync(sql);

  // load tableInfo
	var sql = Util.format("SELECT table_name,route_type FROM %s.%stable_list", config.routeTable.dbname, config.routeTable.table_prefix);
  table['tableInfo'] = slave[0].querySync(sql);

  // get routeValue for each table
  table['tableInfo'].forEach(function(t, index){
    var sql = Util.format("SELECT column_name,tidy_return FROM %s.%stable_route WHERE table_name='%s'", config.routeTable.dbname, config.routeTable.table_prefix, t.table_name);
    table['tableInfo'][index]['routeFields'] = slave[0].querySync(sql);

    // sort routeFields from db according to key 'column_name'
    var routeFields = table['tableInfo'][index]["routeFields"];
    for(var i = 0;i < routeFields.length; i++){
      for(var j = routeFields.length - 1;j > i;j--){
        if(routeFields[j].column_name < routeFields[j-1].column_name){
          var tmp = routeFields[j];
          routeFields[j] = routeFields[j-1];
          routeFields[j-1] = tmp;
        }
      }
    }

  });
}
exports.reLoadTable = _loadTable;
/*}}}*/

/*{{{ function getRouteTable()*/
/**
 * 获取路由表名
 * @param  {String} value 路由值
 * @return {String}
 */
var getRouteTable = function(value) {
	return config.routeTable.dbname + '.myfox_route_info_' + value.substr(0,1);
}
exports.getRouteTable = getRouteTable;
/*}}}*/

/*{{{ function getHostList()*/
/**
 * 获取机器列表
 * @return {Array}
 */
var getHostList = function() {
  if(table['hostList']){
    return table['hostList'];
  }
  return '';
}
exports.getHostList = getHostList;
/*}}}*/

/*{{{ function getTableInfo()*/
/**
 * 获取表信息
 * @param  {String} tbname 表名
 * @return {Object}
 */
var getTableInfo = function(tbname) {
  return _getTableInfo(table['tableInfo'],tbname);
}

function _getTableInfo(tableInfo, tbname){
  for(var i = 0; i < tableInfo.length; i++){
    if(tableInfo[i].table_name === tbname){
      return tableInfo[i];
      break;
    }
  }
  return '';
}
exports.getTableInfo = getTableInfo;
/*}}}*/

process.on('exit',function(){
  master.forEach(function(m){
    m.close(); 
  });
  slave.forEach(function(s){
    s.close(); 
  });
});

