/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
 File: worker.js
 Author: xuyi (xuyi.zl@taobao.com)
 Description: 
 Last Modified: 2012-03-29
*/
require(__dirname + '/../lib/env');
var Http    = require('http');
var fs      = require('fs');
var Worker  = require('node-cluster').Worker;
var Query   = require(__dirname + '/../lib/query');
var parse   = require(__dirname + '/../lib/parse');
var requestDealer = require(__dirname + '/../src/requestDealer');
var request_queue = require(__dirname + '/../lib/request_queue').queue;

var fWallClient = require(__dirname + '/../lib/daemon/fireWallClient.js');
var fireWall = fWallClient.create(fireWallConf.client);

var REQUEST_QUEUE = new request_queue();

var TYPE = {
  'CONTROL' : 30, 
};

var ACTION = {
  'GET_INFO'    : 1,
  'LOG_LEVEL'   : 30,
  'CLEAN_CACHE' : 20,
};

var last_count = 0;  /* 记录时间间隔内请求数  **/
var trend_length = 24; /* 内存中维护队列长度  **/
var trend = [];  /* 固定时间内请求数记录队列  **/

setInterval(updateTrend, 30 * 60 * 1000);

var admin  = new Worker();

/*{{{ server()*/
var server  = Http.createServer(function (req, res) {
  switch (req.method) {
    case 'GET' :
      get_handle(req, res);
      break;
    case 'POST' :
      __STAT__.totalReqs ++;
      __STAT__.nowReqs ++;
      post_handle(req, res);
      break;
    default :
      res.end();
  }
});

admin.ready(function (socket) {
  server.emit('connection', socket);
});
/*}}}*/

/*{{{ function checkIp()*/
function checkIp(req, res){
  var ip = req.connection.remoteAddress;
  var response = fireWall.banIp(req.connection.remoteAddress);
  if( !!response ){
    fireWallLogger.warning('IP_BANNED', ip);
    res.end(response);
    return true;
    //return false;
  }
  return false;
}
/*}}}*/

/*{{{ msg_handle*/
var msg_handle = function (data) {
  if(TYPE.CONTROL !== data.type) {
    return;
  }
  var result = {
    id   : data.id,
    type : TYPE.CONTROL,
    data : null
  };
  if(ACTION.GET_INFO == data.action) {
    result.data = __STAT__;
    result.memUse = (process.memoryUsage().rss/1000000).toFixed(2); 
    result.data.trend = trend;

  }else if (ACTION.LOG_LEVEL == data.action) {
    var cmd = data.command.split('|');
    if(cmd[0] == "add"){
      workerLogger.addLevel(parseInt(cmd[1]));
    }else{
      workerLogger.removeLevel(parseInt(cmd[1]));
    }
    result.data = { res : 'ok' };

  }else if (ACTION.CLEAN_CACHE == data.action) {
    switch (data.command) {
      case 'tableCache' :
        requestDealer.cleanTable();
        break;
      case 'routeInfoCache' :
        requestDealer.cleanRouteInfo();
        break;
      default: break;
    }
    result.data = { res : 'ok' };
  }
  process.send(result);
};
/*}}}*/

/*{{{ get_handle*/
var get_handle = function (req, res) {
  res.end('ok');
}
/*}}}*/

/*{{{ post_handle*/
var post_handle = function (req, res) {
  if(checkIp(req, res)) {
    return;
  }
  var data = '';
  req.on('data', function (trunk) {
    data += trunk;
  });
  req.on('end', function () { 
    admin.transact();
    var parseData = parse(data);
    if(!parseData) {
      res.end();
      admin.release();
      return;
    }
    var query = Query.create(parseData);
    query.ip  = req.connection.remoteAddress;
    query.appIp = req.headers['x-itier-myfox-appip']; 
    query.req = req;
    query.res = res;
    workerLogger.notice( 'getQuery|token:' + query.token + '[' + query.ip + '(' + req.appIp + ')' + ']',JSON.stringify(parseData));
    if(!REQUEST_QUEUE.push(query)) { /* 若queryQueue中不存在，插入queryQueue，并且执行后续请求动作;若存在则到此为止 **/
      query.getData(function(query){
        REQUEST_QUEUE.end(query, function(query){
          if(__STAT__) {
            __STAT__.allUseTime += Date.now() - query.start;
            __STAT__.nowReqs --;
          }
          var result = formatResult(query);
          query.res.end(result);
          workerLogger.notice('RES|token:'+query.token, JSON.stringify({timeUse:Date.now() - query.start,length:result.length}));
          admin.release();
        });
      });
    } 
  });
}
/*}}}*/

/*{{{ formatResult()*/
var formatResult = function (query) {
  if(query.error && query.error.toString) {
    query.error = query.error.toString();
  }
  if(query.parseData.isDebug) {
    var ret = {
      data        : query.result || [],
      msg         : query.error,
      route       : query.route ? query.route.res.route : null ,
      columns     : query.route ? query.route.res.columns : null ,
      routeTime   : query.routeTime,
      getResDebug : query.debugInfo,
      explain     : query.explain,
      expire      : query.expire
    };
    workerLogger.debug('DebugRes', JSON.stringify(ret));
  } else {
    var ret = { data : query.result || [], msg : query.error, expire : query.expire};
  }
  return JSON.stringify(ret);
};
/*}}}*/

/*{{{ updateTrend()*/
function updateTrend(){
  if(trend.length >= trend_length) {
    trend.shift();
  }
  trend.push({d:Date.now(), queryNum:__STAT__.totalReqs - last_count });
  last_count = __STAT__.totalReqs;
};
/*}}}*/

process.on('message', msg_handle);

/*{{{ readStatesFile()*/
function readStatesFile (file) {
  var data = fs.readFileSync(file).toString();
  try {
    var get = JSON.parse(data);
    keyVersion = get["sqlCacheVersion"];
  }catch(e) {}
}

readStatesFile(masterConf.statesFile);

fs.watchFile(masterConf.statesFile, function (curr,prev) {
  if(curr.mtime.getTime() !== prev.mtime.getTime()) {
    readStatesFile(masterConf.statesFile);
  }
});
/*}}}*/
