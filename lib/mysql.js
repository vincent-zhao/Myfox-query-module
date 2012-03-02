/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
 (C) 2011-2012 Alibaba Group Holding Limited.
 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU General Public License
 version 2 as published by the Free Software Foundation.

 File: mysql.js
 Author: xuyi (xuyi.zl@taobao.com)
 Description: mysql操作类
 Last Modified: 2012-02-20
*/


require('./env.js');

var Mysql   = require('mysql-libmysqlclient');
var Pool    = require('./pool.js');

/*{{{  Object Query()*/
/**
 * 封装事件式query实例
 * @param {Object}   who Mysql实例
 * @param {String}   sql 需执行的sql
 * @param {Function} cb  回调
 */
function Query(who, sql, cb){
  Events.EventEmitter.call(this);
  var _self = this;
  var debugInfo = {
      sql : sql,
    };
  var isTimeout = false;
  var start = Date.now();
  who.client.get(function(conn, pos){
    debugInfo.connInfo = who.opt.connInfo;
    var getConnTm = Date.now();
    debugInfo.getConnTm = getConnTm - start; 

    conn.query(sql,function(err,row){
      
      debugInfo.poolPos = pos;
      var getRowTm = Date.now();
      debugInfo.getRowTm = getRowTm - getConnTm;

      who.client.release(pos);
      if(err){
        if(cb){
          cb(err,'');
          return;
        }
        _self.emit('err',err);
        return;
      }
      row.fetchAll(function(err,res){

        var fetchAllTm = Date.now();
        debugInfo.fetchAllTm = fetchAllTm - getRowTm;
        debugInfo.queryTm = fetchAllTm - start;
        mysqlLogger.debug('QueryInfo',JSON.stringify(debugInfo));

        if(debugInfo.queryTm > who.opt.slow){
          slowLogger.warning('SLOW', JSON.stringify(debugInfo));
        }
        //row.freeSync();
        if(err){
          if(cb){
            cb(err, '');
            return;
          }
          _self.emit('err',err);
          return;
        }
        if(cb){
          cb('', res);
          return;
        }
        _self.emit('res',res);
      });
    }); 
  });
}
Util.inherits(Query, Events.EventEmitter);

/*}}}*/

/*{{{ function mysql()*/
/**
 * Mysql
 * @param  {Object} opt 配置对象
 * @return {None}
 */
var mysql = function(opt) {
  var _self = this;
  this.opt = opt;
  try{
  this.client = Pool.create(opt.poolSize, {
    'conn' : function(){
      var conn = Mysql.createConnectionSync();
      conn.initSync();
      //conn.setOptionSync(conn.MYSQL_INIT_COMMAND, "SET NAMES utf8;");
      conn.setOptionSync(conn.MYSQL_OPT_CONNECT_TIMEOUT, 2);
      conn.setOptionSync(conn.MYSQL_OPT_READ_TIMEOUT, opt.timeout); // *3 retry
      conn.setOptionSync(conn.MYSQL_OPT_RECONNECT, 1); //自动重连
      conn.realConnectSync(
        opt.connInfo.conn_host,
        opt.connInfo.conn_user,
        opt.connInfo.conn_pass,
        opt.connInfo.conn_db,
        opt.connInfo.conn_port
      );
      conn.setCharsetSync('utf8');
      return conn;
    },
    'close' : function(conn){
      try{
        conn.closeSync();
      }catch(e){
        mysqlLogger.warning('CloserError',e);
      }
    }
  });
  }catch(e){
    console.log('mysql make connpool error');
    console.log(opt);
    console.log(e); 
  }
}
/*}}}*/

/*{{{ function query()*/
/**
 * 执行sql
 * @param  {String}   sql 
 * @param  {Function} cb  
 * @return {None}
 */
mysql.prototype.query = function(sql, cb) {
  return new Query(this,sql,cb);
}
/*}}}*/

/*{{{ function querySync()*/
/**
 * 阻塞式query
 * @param  {String} sql 
 * @return {Object}
 */
mysql.prototype.querySync = function(sql){
  var conn = Mysql.createConnectionSync(
        this.opt.connInfo.conn_host,
        this.opt.connInfo.conn_user,
        this.opt.connInfo.conn_pass,
        this.opt.connInfo.conn_db,
        this.opt.connInfo.conn_port
  );
  conn.setCharsetSync('utf8');
  var row = conn.querySync(sql);
  var res = row.fetchAllSync();
  conn.closeSync();
  return res;
}
/*}}}*/

/*{{{ function close()*/
/**
 * 关闭连接
 * @return {None}
 */
mysql.prototype.close = function(){
  this.client.conn.forEach(function(conn){
    try{
      conn.closeSync(); 
    }catch(e){
      console.log(e);
    }
  });
}
/*}}}*/

/* {{{ create()*/
exports.create = function(opt) {
	return new mysql(opt);
}
/* }}}*/
