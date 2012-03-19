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
DEBUG = false;

var Mysql   = require('mysql-libmysqlclient');
var Pool    = require('./pool.js');
var inQuery = [];

var queryStatus = {
  'QUERYING' : 1,
  'KILLED'   : -1
};

/* {{{ _back()*/
/**
 * 处理返回抽象
 * @param  {Error}    err      错误信息对象
 * @param  {Object}   res      返回结果集
 * @param  {this}     self     运行环境this 
 * @param  {Function} callback 运行环境callback
 * @return {None}
 */
function _back(err, res, self, callback){
  if(err){
    if(callback){
      callback(err, '');
      return;
    }
    self.emit('err',err);
    return;
  }
  if(callback){
    callback('', res);
    return;
  }
  self.emit('res',res);
}
/* }}}*/

/*{{{  Object Query()*/
/**
 * 封装事件式query实例
 * @param {Object}   who Mysql实例
 * @param {Object}   reqObj 请求对象
 * @param {String}   sql 需执行的sql
 * @param {Function} cb  回调
 */
function Query(who, sql, reqObj, cb){
  Events.EventEmitter.call(this);
  var _self = this;

  var key = sql.toLowerCase();

  /* 若有相同请求在运行，则将此次请求合并*/
  if(inQuery[key]){
    //console.log('query Merged');
    inQuery[key].scopes.push({'callback' : cb, 'self' : _self});
    return;
  }
  inQuery[key] = {
    'status' : queryStatus.QUERYING, 
    'scopes' : [{'callback' : cb, 'self' : _self}]
  };

  var debugInfo = {
      sql : sql,
  };
  var isTimeout = false;
  var start = Date.now();
  /* 连接池利用率大于阈值，进行sql kill */
  if(who.client.stack.length / who.client.conn.length < 0.3){
    connRecover(who);
  }

  who.client.get(function(conn, pos){
    /*{{{ debug-- */
    debugInfo.connInfo = who.opt.connInfo;
    var getConnTm = Date.now();
    debugInfo.getConnTm = getConnTm - start; 
    /*-- }}}debug */
    conn.query(sql,function(err,row){
      /*{{{ debug-- */
      debugInfo.poolPos = pos;
      var getRowTm = Date.now();
      debugInfo.getRowTm = getRowTm - getConnTm;
      /*-- }}}debug */
      who.client.release(pos);
      if(err){
        var fetchAllTm = Date.now();
        debugInfo.fetchAllTm = fetchAllTm - getRowTm;
        debugInfo.queryTm = fetchAllTm - start;
        mysqlLogger.debug('QueryInfo|token:'+reqObj.token,JSON.stringify(debugInfo));
        if(debugInfo.queryTm > who.opt.slow){
          var cloneInfo = tool.objectClone(debugInfo);
          var connectInfo = cloneInfo.connInfo;
          connectInfo.conn_user = connectInfo.conn_user.charAt(0) + "******" + connectInfo.conn_user.charAt(connectInfo.conn_user.length-1);
          connectInfo.conn_pass = connectInfo.conn_pass.charAt(0) + "******" + connectInfo.conn_pass.charAt(connectInfo.conn_pass.length-1);
          slowLogger.warning('SLOW|token:'+reqObj.token, JSON.stringify(cloneInfo));
        }
        var sc = null;
        while(sc = inQuery[key].scopes.pop ? inQuery[key].scopes.pop() : null){
          _back(err, '', sc.self, sc.callback);
        }
        delete inQuery[key];
        return;

      }else if (inQuery[key].status === queryStatus.KILLED){
        var sc = null;
        while(sc = inQuery[key].scopes.pop ? inQuery[key].scopes.pop() : null){
          _back('SLOW QUERY KILLED', '', sc.self, sc.callback);
        }
        delete inQuery[key];
        return;

      }else {
        row.fetchAll(function(err,res){
          /*{{{ debug-- */
          var fetchAllTm = Date.now();
          debugInfo.fetchAllTm = fetchAllTm - getRowTm;
          debugInfo.queryTm = fetchAllTm - start;
          mysqlLogger.debug('QueryInfo|token:'+reqObj.token,JSON.stringify(debugInfo));
          if(debugInfo.queryTm > who.opt.slow){
            var cloneInfo = tool.objectClone(debugInfo);
            var connectInfo = cloneInfo.connInfo;
            connectInfo.conn_user = connectInfo.conn_user.charAt(0) + "******" + connectInfo.conn_user.charAt(connectInfo.conn_user.length-1);
            connectInfo.conn_pass = connectInfo.conn_pass.charAt(0) + "******" + connectInfo.conn_pass.charAt(connectInfo.conn_pass.length-1);
            slowLogger.warning('SLOW|token:'+reqObj.token, JSON.stringify(cloneInfo));
          }
          /* --}}}debug */

          var sc = null;
          while(sc = inQuery[key].scopes.pop ? inQuery[key].scopes.pop() : null){
            _back(err, res, sc.self, sc.callback);
          }
          delete inQuery[key];
        });
      }
    }); 
  });
}
Util.inherits(Query, Events.EventEmitter);

/*}}}*/

/* {{{ connRecover()*/
/**
 * 连接满时，杀掉数据库处慢连接
 * @param {Object} who 与具体某台mysql服务器对应的对象
 * @return void
 */
var pTimeout = 2;

function connRecover(who){
  var sql = "show full processlist";

  who.client.get(function(conn, pos){
    conn.query(sql,function(err,row){
      if(row){
        row.fetchAll(function(err,processList){
          var forKill = [];
          for(var k in processList){
            var pcs = processList[k];
            if(pcs.User === who.opt.connInfo.conn_user &&
               (pcs.Host.indexOf(localIp.toString().trim()) > -1) &&
               pcs.Command === 'Query' &&
               pcs.Time >= pTimeout &&
               pcs.Info &&
               inQuery[pcs.Info.toString().toLowerCase()]
            ){
              var killsql = "kill query " + pcs.Id;
              forKill.push(killsql);
              mysqlLogger.warning('KILL_QUERY',JSON.stringify(pcs));
              inQuery[pcs.Info.toLowerCase()].status = queryStatus.KILLED;
            }
          }
          var klen = forKill.length;
          if(!klen){
            who.client.release(pos);
            return;
          }
          var counter = 0;
          for(var killid = 0; killid < klen; killid++ ){
            conn.query(forKill[killid],function(err, res){
              counter ++;
              if(counter === klen){
                who.client.release(pos);
              }
            });
          }
        });
      }
      if(err){
        who.client.release(pos);
      }
    });
  });
}
/* }}}*/

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
 * @param  {String} sql  sql语句 
 * @param  {Object} reqObj  请求对象
 * @param  {Function} cb  回调函数
 * @return {None}
 */
mysql.prototype.query = function(sql,reqObj,cb) {
  return new Query(this,sql,reqObj,cb);
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
  if(!row.fetchAllSync ){
    return row;
  }
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
  if(this.client === undefined){return;}
  this.client.conn.forEach(function(conn){
    try{
      conn.closeSync(); 
    }catch(e){
      console.log(e);
    }
  });
}
/*}}}*/

/*{{{ create()*/
exports.create = function(opt) {
	return new mysql(opt);
}
/*}}}*/
