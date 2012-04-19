/*
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
	bufferSize = 1;

exports.INFO = INFO;
exports.DEBUG = DEBUG;
exports.NOTICE = NOTICE;
exports.WARNING = WARNING;
exports.ERROR = ERROR;
 
function pad2(num) {
	return num > 9 ? num : '0' + num;
}
 
function getTime() {
	var t = new Date();
	return [t.getFullYear(), '-', pad2(t.getMonth() + 1) , '-', pad2(t.getDate()), ' ',
		pad2(t.getHours()), ':', pad2(t.getMinutes()), ':', pad2(t.getSeconds())].join('');
}

function getDate(){
	var t = new Date();
	return t.getFullYear()+"-"+pad2(t.getMonth()+1)+"-"+pad2(t.getDate());
}
 
function formatLog(log) {
	var pos;
	if(log.type & 1){pos=0;}
	else if(log.type & 2){pos=1;}
	else if(log.type & 4){pos=2;}
	else if(log.type & 8){pos=3;}
	else{pos=4;}
	return [log.time, '\t[', type[pos], ']','\tTag:',log.tag,'\tMsg:', log.msg,"\n"].join('');
}

exports.create = function(levelNum, dict , fileName) {
  try{
    fs.mkdirSync(dict,0755);
  }catch(e){}
  var file = dict+"/"+fileName;
  var buffer = new Buffer(bufferSize);
  var pos = 0;
  var fd = fs.openSync(file, 'a');
  var dat = fs.statSync(file).atime;
  process.on('exit', function(){
    fs.writeSync(fd, buffer, 0, pos, null);
  });
  function log(type, tag, msg) {
    try{
      msg = msg.toString();
      if(!(type & levelNum)){return;}
      var log = {type:type, tag:tag, msg:msg.replace("\n",";").replace("\t","_"), time:getTime()};
      var logContent = formatLog(log);
      var bl = Buffer.byteLength(logContent);
      if( bl+pos > buffer.length){
        try{
          if(fs.statSync(file).atime > dat){
            fs.closeSync(fd);
            fd = fs.openSync(file,'a');
            dat = fs.statSync(file).atime;
          };
        }catch(e){
          if(e.errno == 34){
            fs.closeSync(fd);
            fd = fs.openSync(file,'a');
            dat = fs.statSync(file).atime;
          }else{
            throw new Error(e);
          }
        }
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
