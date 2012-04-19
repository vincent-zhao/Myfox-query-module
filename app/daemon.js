/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
   (C) 2011-2012 Alibaba Group Holding Limited.
   This program is free software; you can redistribute it and/or
   modify it under the terms of the GNU General Public License
   version 2 as published by the Free Software Foundation.

   File: daemon.js
   Author: xuyi (xuyi.zl@taobao.com)
   Description: 守护进程
   Last Modified: 2012-02-27
   */

require(__dirname + '/../lib/env.js');

var DataLoader = factory.getDataLoader();

var exec = require('child_process').exec;

var util = require('util');

var Mysql = require('mysql-libmysqlclient');

var config = require(__dirname + '/../conf/firewall_config.js');

var sc_config = require(__dirname + '/../conf/sqlcount_config.js');

var fs = require('fs');

var sqlNormalizer = require(__dirname + '/../lib/daemon/sqlNormalize.js').create();

var sqlCounter = require(__dirname + '/../lib/sqlCount.js').create(sc_config); 

/* {{{ fireWall()*/
var fireWall = function() {
  var _self = this;
  _self.servers     = [];
  _self.sqlCount    = [];
  _self.blacklist   = {};
  _self.processList = [];

  _self.filters = [
    function(data) {
      return !! data.Info;
    },
    function(data) {
      return /^SELECT/.test(data.Info);
    },
    function(data) {
      return data.Command === config.process_Query;
    },
    function(data) {
      return data.Time > config.process_Time;
    },
    function(data) {
      return _inArray(data.Host.split(':')[0].trim(), config.servers);
    }];
  setInterval(function() {
    _self.refresh();
  },
  1000 * 60);
}
/* }}}*/

/* {{{ function getProcessList()*/
fireWall.prototype.getProcessList = function(server) {
  var sql = "SHOW FULL PROCESSLIST";
  var _self = this;
  if (!server.conn) {
    return;
  }
  server.conn.query(sql, function(err, res) {
    if (err) {
      console.log(err);
      setTimeout(function(){
        _self.getProcessList(server);
      }, config.getListInterval);
      return;
    }
    res.fetchAll(function(err, res) {
      if (err) {
        console.log(err);
        setTimeout(function(){
          _self.getProcessList(server);
        }, config.getListInterval);
        return;
      }
      res = _self.filter(res);
      for (var i = 0; i < res.length; i++) {
        res[i].server_id = server.server_id;
        res[i].fmtSql = sqlNormalizer.execute(res[i].Info);
      }
      _self.testBad(res, function(processes) {
        processes.forEach(function(pcs) {
          _self.update(pcs);
          if(config.slowQueryAutoKill) {
            if(pcs.Time > config.forKillTm) {
              _self.kill(pcs);
            }
          }
        });
        setTimeout(function(){
          _self.getProcessList(server);
        }, config.getListInterval);
      });
    });
  });
}
/* }}}*/

/* {{{ function writeBlackList()*/
fireWall.prototype.writeBlackList = function() {
  var _self = this;
  for (var i = 0; i < _self.sqlCount.length; i++) {
    var count = _self.sqlCount[i].count;
    var sql = _self.sqlCount[i].sql;
    var minutes = _getBanMinute(count);

    if (count > config.maxCountForWrite) {
      if (_self.blacklist[sql]) {
        _self.blacklist[sql].minutes += minutes;
      } else {
        _self.blacklist[sql] = {
          sql: sql,
          minutes: minutes
        };
        fireWallLogger.warning('WRITE_BLACK', JSON.stringify(_self.blacklist[sql]));
      }
    }

  }

  var tmpPath = config.blackListFile + process.pid;
  fs.writeFile(tmpPath, _self.format(), function(err) {
    if (err) {
      console.log(err);
      return;
    }
    fs.rename(tmpPath, config.blackListFile, function(err) {
      if (err) {
        console.log(err);
      }
    });
  });
  _self.sqlCount = [];
}
/* }}}*/

/* {{{ function filter()*/
fireWall.prototype.filter = function(data) {
  for (var i = 0; i < this.filters.length; i++) {
    data = data.filter(this.filters[i]);
  }
  return data;
}
/* }}}*/

/* {{{ function kill()*/
fireWall.prototype.kill = function(forKill) {
  var sql = 'kill query ' + forKill.Id;
  this.servers[forKill.server_id].conn.query(sql, function(err, res) {
    if (err) {
      console.log(err);
    } else {
      fireWallLogger.warning('KILL', JSON.stringify(forKill)); 
    }
  });
}
/* }}}*/

/* {{{ function update()*/
fireWall.prototype.update = function(pcs) {
  var _self = this;

  var index = _locate(_self.sqlCount, pcs.fmtSql);
  if (index >= 0) {
    _self.sqlCount[index].count++;
  } else {
    _self.sqlCount.push({
      sql: pcs.fmtSql,
      count: 1,
    });
  }
}
/* }}}*/

/* {{{ function format()*/
fireWall.prototype.format = function() {
  var blacklist = this.blacklist;
  var res = [];
  for (var key in blacklist) {
    var datetime = _formatDate(new Date(Date.now() + (blacklist[key].minutes * 60 * 1000)));
    res.push(blacklist[key].sql + "\t" + datetime);
  }
  return res.join("\n");
}
/* }}}*/

/* {{{ function refresh()*/
fireWall.prototype.refresh = function() {
  var blacklist = this.blacklist;
  for (var key in blacklist) {
    blacklist[key].minutes--;
    if (blacklist[key].minutes <= 0) {
      delete blacklist[key];
    }
  }
}
/* }}}*/

/* {{{ function run()*/
fireWall.prototype.run = function() {
  sqlNormalizer.register(/(\w+)_\d+\.\w+/g, "$1");
  var _self = this;

  DataLoader.getHostList().forEach(function(host) {
    host.conn = _getConn(host.conn_host, host.conn_user, host.conn_pass, host.conn_port);
    _self.servers[host.server_id] = host;
    _self.getProcessList(host);
  });

  var getListTimes = 0;
  var processListHandle = function() {
    getListTimes++;
    if (getListTimes >= config.writeBlackTimes + 1) {
      getListTimes = 0;
      _self.writeBlackList();
    }
  };
  setInterval(processListHandle, config.getListInterval);
}
/* }}}*/

/* {{{ function testBad()*/
fireWall.prototype.testBad = function(arr, callback) {
  var _self = this;
  var length = _length(arr);
  if (!length) {
    callback([]);
    return;
  }
  var result = [];
  var count = 0;
  for (var i in arr) {
    (function(i) {
      var pcs = arr[i];
      var sql = 'explain ' + pcs.Info;
      var conn = _self.servers[pcs.server_id].conn;
      conn.query(sql, function(err, res) {
        if (err) {
          console.log(err);
          count++;
          return;
        }
        res.fetchAll(function(err, exp) {
          count++;
          if (err) {
            console.log(err);
            if (count == length) {
              callback(result);
            }
            return;
          }
          if (_isBad(exp)) {
            fireWallLogger.warning('BAD_SQL', JSON.stringify({pcs:pcs,exp:exp})); 
            result.push(pcs);
          }
          if (count == length) {
            callback(result);
          }
        });
      });
    })(i);
  }
}
/* }}}*/

/* {{{ function _isBad()*/
function _isBad(arr) {
  var weightMap = {
    /*各种特征权重*/
    type: {
            'ALL': 60,
          },
    Extra: {
             'temporary': 30,
             'filesort': 30,
           },
    key: {
           '': 30,
         }
  };

  var length = arr.length;
  var weights = [];

  for (var i = 0; i < arr.length; i++) {
    var wt = 0;
    var exp = arr[i];
    if (exp.rows > config.maxRowsByExplain) {
      /* wt += weightMap.rows.overMax; */
      /*
       * _f2(10000) = 0;
       * _f2(80000) = 50;
       */
      wt += _f2(exp.rows);
    }
    for (var k in weightMap.type) {
      if (exp.type === k) {
        wt += weightMap.type[k];
      }
    }
    for (var k in weightMap.Extra) {
      if (exp.Extra.indexOf(k) >= 0) {
        wt += weightMap.Extra[k];
      }
    }
    for (var k in weightMap.key) {
      if (exp.key == k) {
        wt += weightMap.key[k];
      }
    }
    weights.push(wt);
  }
  var res = weights.reduce(function(a, b) {
    return a + b;
  });
  if (res >= 80) {
    return true;
  }
  return false;
}
/* }}}*/

/* {{{ function _getBanMinute()*/
//获得sql被封禁的时间
//sql 在规定的时间内被count的次数*比例
//最大封禁时长30min
function _getBanMinute(count) {
  return Math.min(30, Math.round(count * 0.1));
}
/* }}}*/

/* {{{ function _getConn()*/
function _getConn(host, user, pass, port) {
  try {
    var conn = Mysql.createConnectionSync();
    conn.initSync();
    conn.setOptionSync(conn.MYSQL_OPT_CONNECT_TIMEOUT, 1);
    conn.setOptionSync(conn.MYSQL_OPT_READ_TIMEOUT, 2); // *3 retry
    conn.setOptionSync(conn.MYSQL_OPT_RECONNECT, 1); //自动重连
    conn.realConnectSync(host, user, pass, '', port);
    conn.setCharsetSync('utf8');
  } catch(e) {
    return null;
  }
  return conn;
}
/* }}}*/

/* {{{ function _locate()*/
function _locate(arr, find) {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].sql === find) {
      return i;
    }
  }
  return -1;
}
/* }}}*/

/* {{{ function _length()*/
function _length(obj) {
  var count = 0;
  for (var i in obj) {
    count++;
  }
  return count;
}
/* }}}*/

/* {{{ function _inArray()*/
function _inArray(tag, arr) {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] === tag) return true;
  }
  return false;
}
/* }}}*/

/* {{{ function _formatDate()*/
function _formatDate(date) {
  //var datestr = date.toLocaleDateString();
  var datestr = date.toLocaleString();
  var res = [];
  var map = {
    'Jan': '01',
    'Feb': '02',
    'Mar': '03',
    'Apr': '04',
    'May': '05',
    'Jun': '06',
    'Jul': '07',
    'Aug': '08',
    'Sept': '09',
    'Oct': '10',
    'Nov': '11',
    'Dec': '12'
  };
  datestr = datestr.split(' ');
  var date = [datestr[3], map[datestr[1]], datestr[2]].join('-');
  var time = datestr[4];
  return date + ' ' + time;
}
/* }}}*/

/*{{{ _f2()*/
function _f2 (x) {
  var k = 50 / Math.pow(80000 - 10000, 2);
  return k * Math.pow(Math.max(0, (x - 10000)), 2); 
}
/*}}}*/

exports.fireWall = fireWall;
exports._isBad = _isBad;

var f = new fireWall();
f.run();
setInterval(function () {
  var now = new Date;
  var str = now.toLocaleTimeString();
  var hour = str.split(':')[0];
  if ( hour == 1) {
    sqlCounter.run();
  }
},  3600 * 1000);
