/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
 (C) 2011-2012 Alibaba Group Holding Limited.
 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU General Public License
 version 2 as published by the Free Software Foundation.

 File: request_queue.js
 Author: xuyi (xuyi.zl@taobao.com)
 Description: 
 Last Modified: 2012-03-30
*/

/*{{{ request_queue()*/
var request_queue = function () {
  this.queue = {};
  this.len = 0;
};
/*}}}*/

/*{{{ request_queue.push()*/
request_queue.prototype.push = function (query) {
  var exist = false; 
  if(!this.queue[query.key]) {
    this.queue[query.key] = [query];
  } else {
    exist = true;
    this.queue[query.key].push(query);
  }
  this.len ++;
  return exist;
};
/*}}}*/

/*{{{ request_queue.end()*/
request_queue.prototype.end = function(query, callback) {
  var _self = this;
  var ele = null;
  while(ele = _self.queue[query.key].pop()) {
    _self.len --;
    callback(ele);
  }
  delete _self.queue[query.key];
};
/*}}}*/

exports.queue = request_queue; 


