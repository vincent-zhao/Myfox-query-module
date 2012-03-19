/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
 (C) 2011-2012 Alibaba Group Holding Limited.
 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU General Public License
 version 2 as published by the Free Software Foundation.

 File: mcache.js
 Author: xuyi (xuyi.zl@taobao.com)
 Description: memcache操作类
 Last Modified: 2012-02-20
*/

var Net = require('net');
var Pool = require('../pool.js');
var Hash = require('../hash.js');
var Util = require('util');

var define = {
	"MAX_KEY_LEN"  : 200,
	/**<    KEY的最大长度, 超过后进行md5签名存储 */
	"ZIP_THRESHOLD": 200,
	/**<    VALUE压缩阈值 */
  "MAX_VALUE_LEN":1024*1023,
	/**<    VALUE最大值 */
};

var errors = {
	"SUCCESS" : 0,
	"STORED"  : 0,
	"DELETED" : 0,
	"UNKNOWN" : - 1,
};

/* {{{ void function writeSocket() */
var writeSocket = function(who, key, cmd, callback) {
	if (0 === who.pools.length) {
		throw "None memcache servers.";
	}
	var obj = who.pools[Math.abs(Hash.bernstein(key)) % who.pools.length];
	obj.get(function(conn, pos) {
    if(!conn || !conn.writable || !conn._handle){
      obj.reconnect(pos); 
      callback('');
      return;
    }
    try{
      conn.write(cmd);
    }catch(e){
      obj.reconnect(pos); 
      callback('');
      return;
    }
    var isTimeout = false;
    var connTimeout = setTimeout(function(){
      isTimeout = true;
      Util.log('timeout & reconnect');
      console.log(conn.lastData);
      obj.reconnect(pos);
      callback('');
    },who.option.timeout);
    conn.removeAllListeners('Data');
    conn.once('Data', function(data) {
      if(isTimeout) return;
      clearTimeout(connTimeout);
      obj.release(pos);
      !!callback && callback(data);
    });	

	});
}
/* }}} */

/* {{{ mixture function Parser() */
var Parser = function(buf, obj) {
	var ret = null;
	if(!buf){
		return;
	}
	var set = buf.toString().trim().split(' ');
	var msg = set.shift().trim().toUpperCase();
	switch (msg) {
	case 'END':
		msg = 'NOT_FOUND';
		ret = null;
		break;

	case 'NOT_FOUND':
		ret = null;
		break;

	case 'STORED':
	case 'DELETED':
		ret = true;
		break;

	case 'NOT_STORED':
		ret = false;
		break;

	case 'VALUE':
		set = set[2].split("\r\n");
		ret = set.slice(1, - 1).join("\r\n");
		msg = errors.SUCCESS;
		break;

	case 'ERROR':
	case 'CLIENT_ERROR':
	case 'SERVER_ERROR':
		ret = false;
		break;

	default:
		msg = 'UNKNOWN';
		break;
	}

	obj.error = msg;

	return ret;
}
/* }}} */

/* {{{ public void __construct() */
var Mcache = function(option) {
	this.pools = [];
	this.error = errors.SUCCESS;
	this.option = {
		'poolsize': 10,
		/**<    连接池大小 */
		'timeout': 1000
		/**<    超时 */
	};

	for (var key in option) {
		this.option[key] = option[key];
	}
}
/* }}} */

/* {{{ public void addServer() */
Mcache.prototype.addServer = function(host, port, callback) {
	var _self = this;
	_self.pools.push(Pool.create(
	_self.option.poolsize, {
		'conn': function() {
			var connect = createConn(host, port);
			return connect;
		},
		'close': function(res) {
			try {
				res.destroy();
			} catch(e) {
				console.log('memcache conn destory error');
      }
		},
	}));
}
/* }}} */

/* {{{ flashMap */
var Flash = {
  'ND\r\n':'NOT_FOUND,END',
  'ED\r\n':'NOT_STORED,STORED,DELETED',
  'OR\r\n':'ERROR,CLIENT_ERROR,SERVER_ERROR',
  'OK\r\n':'OK',
  'TS\r\n':'EXISTS',
};
/* }}}*/

/*{{{ private createConn()*/
function createConn(host, port) {
	var conn = Net.createConnection(port, host);

	conn.setTimeout(0);
	conn.setKeepAlive(true);
  conn.setNoDelay();
	conn.lastData = false;

  conn.on('error', function(err){
    Util.log('memcache conn error');
    Util.log(err);
  });

	conn.on('data', function(data) {
	    if(conn.lastData){
	      var newData = new Buffer(conn.lastData.length + data.length);
	      conn.lastData.copy(newData, 0 , 0 );
	      data.copy(newData, conn.lastData.length, 0 );
	      data = newData;
	    }

	    var tag = 0;
	    var len = data.length;

	    for(var i = 0; i < len; i++){
	      if(10 == data[i]){ // match '\n'
	        if(Flash[data.slice(i-3,i+1).toString()]){
	          conn.emit('Data',data.slice(tag,i+1));
	          tag = i;
	        }
	      }
	    }
	    if(tag !== (data.length - 1) ){
	      conn.lastData = data.slice(tag,data.length);
	    }else{
	      conn.lastData = false;
	    }
	    
    });
	return conn;
}
/*}}}*/

/* {{{ public void get() */
Mcache.prototype.get = function(key, callback) {
	var obj = this;
	writeSocket(obj, key, "get " + key + "\r\n", function(data) {
		data = Parser(data, obj);
		if (callback) {
			callback(data);
		}
	});
}
/* }}} */

/* {{{ public void set() */
Mcache.prototype.set = function(key, value, ttl, callback) {
	var obj = this;
  if(value.length > define.MAX_VALUE_LEN){  /* value超长丢弃*/
    !!callback && callback(false);
    return;
  }
	var cmd = "set " + key + " 0 " + ttl + " " + value.length + "\r\n" + value + "\r\n";
	writeSocket(obj, key, cmd, function(data) {
		data = Parser(data, obj);
		if (callback) {
			callback(data);
		}
	});
}
/* }}} */

/* {{{ public void add() */
Mcache.prototype.add = function(key, value, ttl, callback) {
	var obj = this;
	var cmd = "add " + key + " 0 " + ttl + " " + value.length + "\r\n" + value + "\r\n";
	writeSocket(obj, key, cmd, function(data) {
		data = Parser(data, obj);
		if (callback) {
			callback(data);
		}
	});
}
/* }}} */

/* {{{ public void delete() */
Mcache.prototype.delete = function(key, callback) {
	var obj = this;
	writeSocket(obj, key, "delete " + key + " 0\r\n", function(data) {
		data = Parser(data, obj);
		if (callback) {
			callback(data);
		}
	});
}
/* }}} */

/* {{{ public void close() */
Mcache.prototype.close = function(callback) {
	var len = this.pools.length;
	for (var i = 0; i < len; i++) {
		this.pools[i].close(function() {
			if ((--len) <= 0 && callback) {
				this.pools = [];
				callback();
			}
		});
	}
}
/* }}} */

/* {{{ public integer getResultCode() */
Mcache.prototype.getResultCode = function() {
	if (undefined === errors[this.error]) {
		return errors.UNKNOWN;
	}

	return errors[this.error];
}
/* }}} */

/* {{{ public string  getResultMessage() */
Mcache.prototype.getResultMessage = function() {
	return this.error;
}
/* }}} */

exports.create = function(option) {
	return new Mcache(option);
}

