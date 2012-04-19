/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
 (C) 2011-2012 Alibaba Group Holding Limited.
 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU General Public License
 version 2 as published by the Free Software Foundation.

 File: ui.js
 Author: xuyi (xuyi.zl@taobao.com)
 Description:userInterface 
 Last Modified: 2012-03-30
*/
require(__dirname + '/../lib/env.js');

var Http = require('http');
var fs   = require('fs');
var qs   = require('querystring');
var sep  = String.fromCharCode('\x01');
var hash = require(__dirname + '/../lib/hash');

var Worker  = require('node-cluster').Worker;

var ui = new Worker();

var msg_queue = {};

var token = 0;

var TYPE = {
  'CONTROL' : 30, 
};

var ACTION = {
  'GET_INFO'    : 1,
  'LOG_LEVEL'   : 30,
  'CLEAN_CACHE' : 20,
};

var START_TIME = Date.now();

/*{{{ readFile() */
var readFile = function(files) {
	var buffers = {};
	// sync read
	var fread = function(file, cb) {
		fs.readFile(file, 'binary', function(err, data) {
			if (err) {
				throw err;
			}
			buffers[file] = new Buffer(data, 'binary');
			console.log('load', file);
		});
	};
	// watch changes
	var watch = function watch(file) {
		fs.watchFile(file, {
			persistent: true,
			interval: 100
		},
		function(curr, prev) {
			if (curr.mtime.getTime() !== prev.mtime.getTime()) {
				fread(file);
			}
		});
	};
	var i;
	// run all files
	for (i = 0; i < files.length; i++) {
		watch(files[i]);
		fread(files[i]);
	}
	return buffers;
};

page = readFile([__dirname + "/pages/nodefox.html"]);
/*}}}*/

/*{{{ writeStateFile*/
function writeFile(filePath,key,content){
  var get = fs.readFileSync(filePath).toString();
  var obj;
  if(get === ""){obj = {};}
  else{obj = JSON.parse(get);}
  obj[key] = content;
  fs.writeFileSync(filePath,JSON.stringify(obj));
} 
/*}}}*/

/*{{{ init stateFile*/
try{
  var get = fs.readFileSync(masterConf.statesFile).toString();
  if(!get || get === ""){
    throw new Error();
  }
}catch(e){
  fs.writeFileSync(masterConf.statesFile,"");
  var dat = new Date();
  var year = dat.getFullYear().toString();
  var month = dat.getMonth()+1;
  month = month < 10 ? "0" + month.toString() : month.toString();
  var d = dat.getDate();
  d = d < 10 ? "0" + d.toString() : d.toString();
  writeFile(masterConf.statesFile,"sqlCacheVersion",year + month + d);
}
/*}}}*/

/*{{{ server()*/
var server  = Http.createServer(function (req, res) {
  token ++;
  switch (req.method) {
    case 'GET' :
      get_handle(req, res);
      break;
    case 'POST' :
      post_handle(req, res);
      break;
    default :
      break;
  }
});

ui.ready(function (socket) {
  server.emit('connection', socket);
});
/*}}}*/

/*{{{ get_handle()*/
var get_handle = function (req, res) {
  if (/^(\/)$/.test(req.url)) {
    var p = page[__dirname + "/pages/nodefox.html"];
    res.writeHeader(200, {
      'Content-Type': p['type'],
      'Content-Length': p.length
    });
    res.end(p);
  }else if(/^(\/test)/.test(req.url)){
    res.end('success');
  }else if(/^(\/getInfos)$/.test(req.url)){
    getWorkersInfo(res);
  }else if(/^(\/changeLogLevel)/.test(req.url)){
    var get = req.url.split("/");
    if(!checkPhrase(get[4])) {
      res.end(JSON.stringify({result:"pwdWrong"}));
      return;
    }
    changeLogLevel(get[2],get[3],res);
  }else if(/^(\/cleanCache)/.test(req.url)){
    var get = req.url.split("/");
    if(!checkPhrase(get[3])){
      res.end(JSON.stringify({result:"pwdWrong"}));
      return;
    }
    cleanCache(get[2],res);
  }else{
    res.end();
  }
};
/*}}}*/

/*{{{ post_handle()*/
var post_handle = function (req, res) {
  var body = "";
  req.on("data",function(data){
    body += data;
  });
  req.on("end",function(){
    var get = qs.parse(body); 
    var options = {
      host : 'localhost',
      port : masterConf.port,
      path : '/',
      method : 'POST'
    };
    var request = Http.request(options,function(response){
      var d = "";
      response.on("data",function(chunk){
        d += chunk;
      });
      response.on("end",function(){
        res.end(d);
      });
    });
    request.write(encodeURIComponent(get.readCache + sep + get.writeCache + sep + get.isDebug + sep + get.explain + "\r\nsqlMode\r\n"+get.sql+"\r\n"));
    request.end();
  });

};
/*}}}*/

/*{{{ checkPhrase()*/
function checkPhrase (str) {
  return (hash.md5(str) == masterConf.adminPwd);
}
/*}}}*/

/*{{{ getWorkersInfo()*/
function getWorkersInfo(res){
  masterLogger.notice("getMonitorOrder-getWorkerInfo","token:"+token);
  var data = {
    id       : token,
    type     : TYPE.CONTROL,
    action   : ACTION.GET_INFO,
    command  : null,
    callback : function(d){
      var result = {
        st    : START_TIME,
        data  : [],
      };
      for (var i = 0; i < d.results.length; i++) {
        result.data.push(d.results[i].data);
      }
      res.end(JSON.stringify(result));
    },
  };
  send(data);
}
/*}}}*/

/*{{{ changeLogLevel()*/
function changeLogLevel(action,level,res){
  masterLogger.notice("getMonitorOrder-changeLogLevel","action:"+action+"|level:"+parseInt(level)+"|token:"+token);
  var data = {
    id       : token,
    type     : TYPE.CONTROL,
    action   : ACTION.LOG_LEVEL,
    command  : action + '|' + parseInt(level),
    callback : function(d){
      res.end(JSON.stringify({result: 'ok'}));
    },
  };
  send(data);
}
/*}}}*/

/*{{{ cleanCache()*/
function cleanCache(which,res){
    if(/^sqlcache/i.test(which)){
      var get = which.split(":");
      masterLogger.notice("getMonitorOrder-cleanCache","clean sqlcache|keyVersion:"+get[1]);
      writeFile(masterConf.statesFile,"sqlCacheVersion",get[1]);
      res.end(JSON.stringify({result:"ok"}));
      return;
    }
    var data = {
      id       : token,
      type     : TYPE.CONTROL,
      action   : ACTION.CLEAN_CACHE,
      command  : which,
      callback : function(d){
        res.end(JSON.stringify({result: 'ok'}));
      },
    };
    masterLogger.notice("getMonitorOrder-cleanCache","which:"+which+"|token:"+token);
    send(data);
}
/*}}}*/

/*{{{ function send()*/
function send (data) {
  msg_queue[data.id] = data;
  process.send(data);
}
/*}}}*/

/*{{{ receive*/
process.on('message', function(data) {
  if(data.id && msg_queue[data.id] && msg_queue[data.id].callback) {
    msg_queue[data.id].callback(data);
    delete msg_queue[data.id];
  }
});
/*}}}*/

