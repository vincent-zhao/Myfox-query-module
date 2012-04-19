/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
 File: master.js
 Author: xuyi (xuyi.zl@taobao.com)
 Description: 
 Last Modified: 2012-03-29
*/

require(__dirname + '/../lib/env.js');
var Master  = require('node-cluster').Master;
var config  = require(__dirname + '/../conf/master_config.js');
var fs      = require('fs');
//var echo    = require('eyes').inspector();

var TYPE = {
  'CONTROL' : 30, 
};

var real = fs.realpathSync;

var control_queue = {};

var app  = new Master({
    'max_fatal_restart'     : 2,
    'restart_time_window'   : 60,
});

app.register(masterConf.port, real(__dirname + '/worker.js'), {'cnum' : masterConf.workerNum});
app.register(masterConf.userPort, real(__dirname + '/ui.js'), {'cnum' : 1});
app.register('daemon', real(__dirname + '/daemon.js'), {'cnum' : 1});

app.dispatch();

/*{{{ listen*/
/* heared form ui*/
for( var key in app.heartmsg[masterConf.userPort]) {
  app.children[key].on('message', function(data){
    if(TYPE.CONTROL == data.type) {
      send2worker(data);
    }
  });
}

/* hear form worker*/
for( var key in app.heartmsg[masterConf.port]) {
  app.children[key].on('message', function(data){
    if(TYPE.CONTROL == data.type) {
      send2ui(data);
    }
  });
}
/*}}}*/

/*{{{ send2worker()*/
var send2worker = function (data) {
  control_queue[data.id] = {
    type : TYPE.CONTROL,
    id   : data.id,
    request : data,
    results : []
  };
  for( var key in app.heartmsg[masterConf.port]) {
    app.children[key].send(data);
  }
}
/*}}}*/

/*{{{ send2ui()*/
var send2ui = function (data) {
  control_queue[data.id].results.push(data);
  if(control_queue[data.id].results.length == masterConf.workerNum ) {
    for( var key in app.heartmsg[masterConf.userPort]) {
      app.children[key].send(control_queue[data.id]);
      delete control_queue[data.id];
    }
  }
}
/*}}}*/
