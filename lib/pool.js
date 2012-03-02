/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
 (C) 2011-2012 Alibaba Group Holding Limited.
 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU General Public License
 version 2 as published by the Free Software Foundation.

 File: pool.js
 Author: xuyi (xuyi.zl@taobao.com)
 Description: 通用连接池类 
 Last Modified: 2012-02-20
*/

/**
 * 创建连接池
 * @param  {Integer}   size     连接池大小
 * @param  {Function} callback  回调
 * @return {None}
 */
exports.create = function(size, callback) {
  var size = size;
  var calls = {
    conn: function() {
      return true;
    },
    close: function(rs) {},
  }

  for (var key in callback) {
    calls[key] = callback[key];
  }

  var me = {
    conn: [],
    queue: [],
    stack: [],
    tm: null,
    mt: null,
    stoped: false,
    onclose: null,
    /**
     * 取一个连接
     * @param  {Function} callback 
     * @return {None}
     */
    get: function(callback) {
      if (this.stoped) {
        return;
      }
      this.queue.push(callback);
      check();
    },
    /**
     * 释放一个连接
     * @param  {Integer} id 连接id
     * @return {None}
     */
    release: function(id) {
      this.stack.push(id);
      check();
    },
    /**
     * 重连
     * @param  {Integer} id 连接id
     * @return {None}
     */
    reconnect: function(id) {
      if(! CLOSING ){
        calls.close(me.conn[id]);
        me.conn[id] = calls.conn();
        this.release(id);
      }
    },
    /**
     * 关闭连接池
     * @param  {Function} callback 
     * @return {None}
     */
    close: function(callback) {
      this.stoped = true;
      if (callback) {
        this.onclose = callback;
      }
    }
  }
  /**
   * 初始化连接池
   */
  for (var i = 0; i < size; i++) {
    var res = calls.conn();
    if (!res) {
      throw new Error('Connect Failed!');
    }
    me.conn[i] = res;
    me.stack[i] = i;
  }
  /**
   * 检查，处理
   * @return {None}
   */
  function check() {
    while (me.queue.length > 0 && me.stack.length > 0) {
      var id = me.stack.pop();
      var cb = me.queue.shift();
      cb(me.conn[id], id);
    }

    if (!me.stoped) {
      return;
    }

    for (var i = 0; i < me.conn.length; i++) {
      calls.close(me.conn[i]);
      delete me.conn[i];
    }
    me.stack = [];

    if (me.onclose) {
      me.onclose();
      me.onclose = null;
    }
  }

  check();
  return me;
}

