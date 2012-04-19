/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
 (C) 2011-2012 Alibaba Group Holding Limited.
 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU General Public License
 version 2 as published by the Free Software Foundation.

 File: sqlCount.js
 Author: xuyi (xuyi.zl@taobao.com)
 Description: sql归一统计
 Last Modified: 2012-03-13
*/

var Mysql   = require('mysql-libmysqlclient');
var fs      = require('fs');
var exec    = require('child_process').exec;
var util = require('util');
var hash = require(__dirname + '/hash.js');
var config = require(__dirname + '/../conf/sqlcount_config.js');
var sqlNormal = require(__dirname + '/daemon/sqlNormalize.js').create(); 

/*{{{ mysql()*/
var mysql = function(config){
  var conn = Mysql.createConnectionSync();
  conn.initSync();
  conn.setOptionSync(conn.MYSQL_OPT_CONNECT_TIMEOUT, 2);
  conn.setOptionSync(conn.MYSQL_OPT_READ_TIMEOUT, config.readTimeout);
  conn.setOptionSync(conn.MYSQL_OPT_WRITE_TIMEOUT, config.writeTimeout);
  conn.setOptionSync(conn.MYSQL_OPT_RECONNECT, 1); //自动重连
  conn.realConnectSync(config.host, config.user, config.pass, config.db, config.port);
  conn.setCharsetSync('utf8');
  this.conn = conn;
}
/*}}}*/

/*{{{ mysql.set()*/
mysql.prototype.set = function (obj, callback) {
  var _self = this;
  var sql = util.format("SELECT * FROM sql_format_stat_v2 WHERE sql_sign = %d AND sql_format = '%s'",
                        obj.sqlSign,
                        addslashes(obj.sqlFmat)
                       );
  _self.conn.query(sql,function(err, res) { 
    if( err ) {
      callback(err);
      return;
    }
    res.fetchAll(function(err, res) {
      if( err ) {
        console.log(err);
        callback(err);
        return;
      } else if( !res.length ) {
        _self.insert(obj, callback);
      } else {
        _self.update(obj, callback);
      }
    });
  });
}
/*}}}*/

/*{{{ mysql.update()*/
mysql.prototype.update = function (obj, callback) {
  var _self = this;
  var sql = util.format(
  "UPDATE sql_format_stat_v2 SET query_nums = query_nums + %d , last_visit = %d , modtime = NOW() WHERE sql_sign = %d AND sql_format = '%s'",
  obj.queryNums, obj.lastVisit, obj.sqlSign, addslashes(obj.sqlFmat)
  );
  _self.conn.query(sql, callback);
}
/*}}}*/

/*{{{ mysql.insert()*/
mysql.prototype.insert = function (obj, callback) {
  var _self = this;
  var sql = util.format(
  "INSERT INTO sql_format_stat_v2 VALUES('', '', %d, %d, '', %d, NOW(), NOW(), '%s', '', '%s', '%s')",
  obj.queryNums, obj.lastVisit, obj.sqlSign, obj.refTables, addslashes(obj.sqlFmat), addslashes(obj.sqlSamp)  
  );
  _self.conn.query(sql, callback);
}
/*}}}*/

/* {{{ sqlCount()*/
var sqlCount = function(config) {
  this.path = config.logPath;
  this.retry = config.retry;
  this.sqlCt = {};
  this.mysql = new mysql(config.mysql);
  this.num = 0;
  var _self = this;
  process.on('exit', function () {
    _self.mysql.conn.closeSync();
  });
}
exports.sqlCount = sqlCount;
/* }}}*/

/* {{{ sqlCount.run()*/
sqlCount.prototype.run = function (callback) {
  var _self = this;
  var path = _self.path + yesterday();
  var newPath = path + '_tmp';
  formatInput(path, newPath, function (err, stdout, stderr) {
    if (err || stderr) {
      console.log(err);
      fs.unlink(newPath);
      return;
    }
    var reader = read(newPath);
    reader.on('line', function(data){
      _self.dealLine(data);
    });
    var re = 0;
    reader.on('end', function() {
      re ++;
      _self.dealReq(function() {
        if( re < _self.retry && hasNoDealed(_self.sqlCt) ) {
          reader.emit('end');
        } else { 
          fs.unlink(newPath, function (err) {
            if ( err ) {
              console.log(err);
            }
            !!callback && callback();
          });
        }
      });
    });
  });
}
/* }}}*/

/* {{{ sqlCount.dealLine()*/
sqlCount.prototype.dealLine = function(data) {
  var _self = this;
  _self.num ++;
  var obj = format(data);
  if(!obj) {
    return;
  }
  if ( !_self.sqlCt[obj.fmtSql] ) {
    _self.sqlCt[obj.fmtSql] = {
      deal : false,
      fstTime : obj.dateTm,
      lstTime : obj.dateTm,
      sqlSamp : obj.oldSql,
      sqlFmat : obj.fmtSql,
      sqlSign : hash.crc32(obj.fmtSql),
      refTables : getTable(obj.fmtSql),
      queryNums : 1,
      lastVisit : Math.round(Date.parse(obj.dateTm) / 1000),
    };
  } else {
    _self.sqlCt[obj.fmtSql].queryNums ++;
    _self.sqlCt[obj.fmtSql].lstTime  = obj.dateTm;
    _self.sqlCt[obj.fmtSql].lastVisit= Math.round(Date.parse(obj.dateTm) / 1000);
  }
};
/* }}}*/

/* {{{ sqlCount.dealReq()*/
sqlCount.prototype.dealReq = function(callback) {
  var _self = this;
  var len = dlength(_self.sqlCt);

  for (var key in _self.sqlCt) {
    (function(key) {
      if ( !_self.sqlCt[key].deal ) {
        _self.mysql.set(_self.sqlCt[key], function(err, res) {
          if (!err) {
            _self.sqlCt[key].deal = true;
          }else{
            console.log(err);
          }
          len --;
          if( !len ) {
            callback();
          }
        });
      }
    })(key);
  }
};
/* }}}*/


/*{{{ function dlength()*/
function dlength (obj) {
  var count = 0;
  for(var i in obj) {
    if( !obj[i].deal ) {
      count ++;
    }
  }
  return count;
}
/*}}}*/

/* {{{ function hasNoDealed()*/
function hasNoDealed ( obj ) {
  for( var key in obj) {
    if( !obj[key].deal ) {
      return true;
    }
  }
  return false;
}
/* }}}*/

/* {{{ function format()*/
function format (data) {
  data = data.replace('\n', '');
  var datal = data;
  data = data.split('\t');
  var dateTime = data[0];
  try{
  var res = data[3].split('Msg:')[1];
    res = JSON.parse(res);
  }catch(e){
    return null;
  }
  return {
    dateTm : dateTime,
    oldSql : res.sql,
    fmtSql : sqlNormal.execute(res.sql) 
  };
} 
exports.format = format;
/* }}}*/

/* {{{ function read()*/
var read = function(path) {
  var rstream = fs.createReadStream(path);
  var ldata = null;
  rstream.on('data', function(data) {
    if (ldata) {
      var nbuf = new Buffer(ldata.length + data.length);
      ldata.copy(nbuf, 0, 0);
      data.copy(nbuf, ldata.length, 0);
      data = nbuf;
    }
    var begin = 0;
    for(var i = 0; i < data.length; i++) {
      if(10 == data[i]) {
        rstream.emit('line', data.slice(begin, i).toString());
        begin = i + 1;
      }
    }
    if(begin !== data.length - 1) {
      ldata = data.slice(begin, data.length);
    } else {
      ldata = null;
    }
  });
  return rstream;
}
exports.read = read;
/* }}}*/

/* {{{ function formatInput()*/
function formatInput (oldPath, newPath, callback) {
  exec('grep getQuery ' + oldPath + ' >' + newPath, callback);
}
exports.formatInput = formatInput;
/* }}}*/

/*{{{ function getTable()*/
function getTable(sql) {
  var res = [];
  sql = sql.replace(/ +/g, ' ');
  var token = sql.split(/FROM/i).pop();
  token = token.split(/WHERE/i).shift();
  token = token.split(/JOIN/i);
  for(var i = 0; i < token.length; i++) {
    res.push(token[i].trim().split(' ').shift());
  }
  return res.join(',');
}
exports.getTable = getTable;
/*}}}*/

/*{{{ function addslashes()*/
function addslashes(data){
  data = data.replace(/[\0\n\r\b\t\\\'\"\x1a]/g, function(s) {
    switch(s) {
      case "\0": return "\\0";
      case "\n": return "\\n";
      case "\r": return "\\r";
      case "\b": return "\\b";
      case "\t": return "\\t";
      case "\x1a": return "\\Z";
      default: return "\\"+s;
    }
  });
  return data;
}
/*}}}*/

/*{{{ function yesterday()*/
function yesterday () {
  var now = Date.now();
  var tom = new Date(now - ( 24 * 3600 * 1000 ));

	var datestr = tom.toLocaleString();
	var res = [];
	var map = {
		'Jan'  : '01',
		'Feb'  : '02',
		'Mar'  : '03',
		'Apr'  : '04',
		'May'  : '05',
		'Jun'  : '06',
		'Jul'  : '07',
		'Aug'  : '08',
		'Sept' : '09',
		'Oct'  : '10',
		'Nov'  : '11',
		'Dec'  : '12'
	};
	datestr = datestr.split(' ');
	var date = [datestr[3], map[datestr[1]], datestr[2]].join('-');
	return date;
}
exports.yesterday = yesterday;
/*}}}*/

/*
var c = new sqlCount(config);
c.run();
*/
exports.create = function (config) {
  return new sqlCount(config);
}
