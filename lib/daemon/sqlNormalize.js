/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
 (C) 2011-2012 Alibaba Group Holding Limited.
 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU General Public License
 version 2 as published by the Free Software Foundation.

 File: sqlNormalize.js
 Author: xuyi (xuyi.zl@taobao.com)
 Description: sql归一化
 Last Modified: 2012-02-23
*/

var normalizer = function(){
  this.replaces = [
    {
      'regular'  : /[^\x00-\x7f]/g,
      'replace' : ''
    }, 
    {
      'regular'  : /\s*,\s*/g,
      'replace' : ','
    }, 
    {
      'regular'  : /\s+/g,
      'replace' : ' '
    }, 
    {
      'regular'  : /-?\d+(,\-?\d+)+/g,
      'replace' : '?'
    }, 
    {
      'regular'  : /\'.*?\'/g,
      'replace' : '\'?\''
    }, 
    {
      'regular'  : /".*?"/g,
      'replace' : '\'?\'',
    }, 
    {
      'regular'  : /([^\w]+)\-?\d+([^\w]+)*/g,
      'replace' : "$1?$2",
    }, 
    {
      'regular'  : /\s+in\s*\([\'"].*?\)/ig,
      'replace' : ' IN (\'?\')',
    }, 
  ];
}

normalizer.prototype.register = function(reg, replace) {
  this.replaces.push({'regular' : reg, 'replace' : replace});
};

normalizer.prototype.execute = function(sql){
  sql = sql.toString().trim();

  for(var i in this.replaces){
    var reg = this.replaces[i];
    sql = sql.replace(reg.regular, reg.replace);
  }

  return sql;
}

exports.create = function(){
  return new normalizer();
}
