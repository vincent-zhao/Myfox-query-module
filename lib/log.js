/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
  (C) 2011-2012 Alibaba Group Holding Limited.
  This program is free software; you can redistribute it and/or
  modify it under the terms of the GNU General Public License 
  version 2 as published by the Free Software Foundation.

 File: log.js
 Author: yixuan (yixuan.zzq@taobao.com)
 Description: 日志类
 Last Modified: 2012-02-07
*/

var fs = require('fs');
 
var cwd = process.cwd() + '/',
	INFO = 1,
	DEBUG = 2,
	NOTICE = 4,
	WARNING = 8,
	ERROR = 16,
	type = ['INFO','DEBUG','NOTICE','WARNING','ERROR'],
	bufferSize = 1,
	writeSize = 1;

exports.INFO = INFO;
exports.DEBUG = DEBUG;
exports.NOTICE = NOTICE;
exports.WARNING = WARNING;
exports.ERROR = ERROR;
 
/*{{{ pad2()*/
/**
 * 数字位数统一，将一位数和两位数统一格式化为两位数
 * @param {int} num 需要被格式化的数字
 * @return {String}
 */
function pad2(num) {
	return num > 9 ? num : '0' + num;
}
/*}}}*/
 
/*{{{ getTime()*/
/**
 * 获得当前时间
 * @param empty
 * @return {String}
 */
function getTime() {
	var t = new Date();
	return [t.getFullYear(), '-', pad2(t.getMonth() + 1) , '-', pad2(t.getDate()), ' ',
		pad2(t.getHours()), ':', pad2(t.getMinutes()), ':', pad2(t.getSeconds())].join('');
}
/*}}}*/

/*{{{ getDate()*/
/**
 * 获得当前日期
 * @param empty
 * @return {String}
 */
function getDate(){
	var t = new Date();
	return t.getFullYear()+"-"+pad2(t.getMonth()+1)+"-"+pad2(t.getDate());
}
/*}}}*/
 
/*{{{ formatLog()*/
/**
 * 输出内容格式化
 * @param {Object} log 输出日志的各部分内容和级别
 * @return {String} 输出的内容
 */
function formatLog(log) {
	var pos;
	if(log.type & 1){pos=0;}
	else if(log.type & 2){pos=1;}
	else if(log.type & 4){pos=2;}
	else if(log.type & 8){pos=3;}
	else{pos=4;}
	return [log.time, '\t[', type[pos], ']','\tTag:',log.tag,'\tMsg:', log.msg,"\n"].join('');
}
/*}}}*/

/*{{{ create()*/
/**
 * 创建日志对象
 * @param {int} levelNum 日志级别
 * @param {String} dict 日志目录
 * @param {String} fileName 日志名字
 * @return {Object} 日志对象可操作方法
 */
exports.create = function(levelNum, dict , fileName) {
  var lastDate = getDate();
  try{
    fs.mkdirSync(dict,0755);
  }catch(e){}
  var file = dict+"/"+fileName+lastDate;
  var buffer = new Buffer(bufferSize);
  var pos = 0;
  var fd = fs.openSync(file, 'a');
  process.on('exit', function(){
    fs.writeSync(fd, buffer, 0, pos, null);
  });
  function log(type, tag, msg) {
    try{
      msg = msg.toString();
      if(!(type & levelNum)){return;}
      var d = getDate();
      if(d!=lastDate){
        lastDate = d;
        fs.writeSync(fd,buffer,0,pos,null);
        fs.closeSync(fd);
        pos = 0;
        file = dict+"/"+fileName+lastDate;
        fd = fs.openSync(file,'a');
      }
      var log = {type:type, tag:tag, msg:msg.replace("\n",";").replace("\t","_"), time:getTime()};
      if (pos >= writeSize) {
        fs.writeSync(fd, buffer, 0, pos, null);
        pos = 0;
      }
      var logContent = formatLog(log);

      var bl = Buffer.byteLength(logContent);
      if( bl+pos > buffer.length){
        fs.writeSync(fd,buffer,0,pos,null);
        fs.writeSync(fd,new Buffer(logContent),0,bl,null);
      }else{
        pos += buffer.write(logContent,pos);
      }
    }catch(e){}
  }
  function addLev(type){
    if(!(levelNum & type)){
      levelNum += type;
    }
  }
  function removeLev(type){
    if(levelNum & type){
      levelNum -= type;
    }
  }
  function getLev(){
    return levelNum;
  }
  return {
    info : function(tag,msg) {log(INFO,tag, msg);},
    debug : function(tag,msg) {log(DEBUG,tag, msg);},
    warning : function(tag,msg) {log(WARNING,tag, msg);},
    error : function(tag,msg) {log(ERROR,tag, msg);},
    notice : function(tag,msg) {log(NOTICE,tag, msg);},
    addLevel : function(type) {addLev(type);},
    removeLevel : function(type) {removeLev(type);},
    getLevel : function(){return getLev();}
  };
}
/*}}}*/
