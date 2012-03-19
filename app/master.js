/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
  (C) 2011-2012 Alibaba Group Holding Limited.
  This program is free software; you can redistribute it and/or
  modify it under the terms of the GNU General Public License 
  version 2 as published by the Free Software Foundation.
  
  File: worker.js
  Author: yixuan,xuyi (yixuan.zzq@taobao.com,xuyi.zl@taobao.com)
  Description: myfox请求处理主程序
  Last Modified: 2012-02-03
*/

var TCP  = process.binding("tcp_wrap").TCP;
var cp   = require("child_process");
var Conf = require("../etc/master_config");
var WorkerConf = require("../etc/worker_config");
var Log  = require("../lib/log");
var http = require("http");
var fs   = require("fs");
var qs   = require("querystring");
var sep  = String.fromCharCode('\x01');
var crypto = require("crypto");

var PORT        = Conf.port;
var ADDRESS     = Conf.address;
var WORKER_PATH = Conf.workerPath;

var server;
var userSrv;
var page;
var workers = [];
var logger = Log.create(Conf.logLevel, Conf.logPath, "master");

var waitToConnectWorker = 1000;
var pos = 0;

var monitorUserMap = {};
var monitorToken = 0;

var startServerTime = new Date().getTime();

/*{{{ readFile() */
/**
 * 载入调试界面
 * @param {Array} files 保存需要被加载文件的文件名数组
 * @return {Buffer} 加载文件的二进制形式
 */
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

/*{{{ writeFile()*/
/**
 * 写state文件
 * @param {String} filePath state文件路径
 * @param {String} key 写入state文件的具体字段名
 * @param {String} content 写入内容
 * @return void
 */
function writeFile(filePath,key,content){
  var get = fs.readFileSync(filePath).toString();
  var obj;
  if(get === ""){obj = {};}
  else{obj = JSON.parse(get);}
  obj[key] = content;
  fs.writeFileSync(filePath,JSON.stringify(obj));
}
/*}}}*/

/* {{{read and write init states into statefile*/
try{
  var get = fs.readFileSync(Conf.statesFile).toString();
  if(!get || get === ""){
    throw new Error();
  }
}catch(e){
  fs.writeFileSync(Conf.statesFile,"");
  var dat = new Date();
  var year = dat.getFullYear().toString();
  var month = dat.getMonth()+1;
  month = month < 10 ? "0" + month.toString() : month.toString();
  var d = dat.getDate();
  d = d < 10 ? "0" + d.toString() : d.toString();
  writeFile(Conf.statesFile,"sqlCacheVersion",year + month + d);
}
/*}}}*/

/*{{{ chooseWorker()*/
/**
 * 选择worker转发tcp连接
 * @param empty
 * @return {Object} worker进程
 */
function chooseWorker() {
  if (workers.length == 0) {
    logger.error("No worker", "No worker to choose");
    return false;
  }
  var min = - 1;
  var choice;
  for (var i in workers) {
    if (min == - 1) {
      min = workers[i].handleNum;
      choice = workers[i];
    }
    if (workers[i].handleNum < min) {
      min = workers[i].handleNum;
      choice = workers[i];
    }
  }
  return choice;
}
/*}}}*/

/*{{{ onconnection()*/
/**
 * 获得TCP连接后的处理函数
 * @param {Object} handle tcp连接句柄
 * @return void
 */
function onconnection(handle) {
  //  console.log('onconnection'+new Date().getTime());
  var getWorker = chooseWorker();
  getWorker.send({
    "handle": true
  },
  handle);
  getWorker.handleNum++;
  handle.close();
}
/*}}}*/

/*{{{ startWorker()*/
/**
 * 启动worker
 * @param {int} num worker数量
 * @return void
 */
function startWorker(num) {
  for (var i = 0; i < num; i++) { 
  (function() {
    var w = cp.fork(WORKER_PATH);
    w.handleNum = 0;
    workers[w.pid] = w;
    w.on("message", workerListener);
    w.on("exit", function(code) {
      logger.error("worker down", "worker" + w.pid + " falls down with code " + code);
      delete workers[w.pid];
      startWorker(1);
    });
  })();
  }
}
/*}}}*/

/*{{{ startServer()*/
/**
 * 启动myfox服务
 * @param empty
 * @return void
 */
function startServer() {
  server = new TCP();
  server.bind(ADDRESS, PORT);
  server.onconnection = onconnection;
  server.listen(128);
}
/*}}}*/

/*{{{ startUserInterface()*/
/**
 * 用户接口（获得debug页面）
 * @param {int} port 端口
 * @return void
 */
function startUserInterface(port){
  userSrv = http.createServer(function(req,res){
    if(req.method == "GET"){
      if (/^(\/)$/.test(req.url)) {
        var p = page[__dirname + "/pages/nodefox.html"];
        res.writeHeader(200, {
          'Content-Type': p['type'],
          'Content-Length': p.length
        });
        res.end(p);
      }else{
        res.end();
      }
    }else{
      var body = "";
      req.on("data",function(data){
        body += data;
      });
      req.on("end",function(){
        var get = qs.parse(body); 
        var options = {
          host : 'localhost',
          port : PORT,
          path : '/',
          method : 'POST'
        };
        var req = http.request(options,function(response){
          var d = "";
          response.on("data",function(chunk){
            d += chunk;
          });
          response.on("end",function(){
            res.end(d);
          });
        });
        req.write(encodeURIComponent(get.readCache + sep + get.writeCache + sep + get.isDebug + sep + get.explain + "\r\nsqlMode\r\n"+get.sql+"\r\n"));
        req.end();
      });
    }
  });
  userSrv.listen(port);
}
/*}}}*/

/*{{{ workerListener()*/
/**
 * 监听worker函数
 * @param {Object} m worker获得的信息对象
 * @return void
 */
function workerListener(m){
  if (m.type == "hb") {
    logger.notice("workerHB","pid:"+m.pid+"|handleNum:"+m.handleNum);
    workers[m.pid].handleNum = m.handleNum;
  }
}
/*}}}*/

startServer();
startWorker(Conf.workerNum);
startUserInterface(Conf.userPort);

