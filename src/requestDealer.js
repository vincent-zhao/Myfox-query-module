/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
 (C) 2011-2012 Alibaba Group Holding Limited.
 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU General Public License
 version 2 as published by the Free Software Foundation.

 File: requestDealer.js
 Author: yixuan (yixuan.zzq@taobao.com)
 Description: sql解析及路由计算
 Last Modified: 2012-02-20
*/

require(__dirname + '/../lib/env.js')
var events      = require('events');
var util        = require('util');

var lexterTypes = require(__dirname + '/../lib/parser/lexter').types;
var Select      = require(__dirname + '/../lib/parser/select');
var Reform      = require(__dirname + '/../lib/reform');
var dataloader  = factory.getDataLoader();
var conf        = require(__dirname + '/../conf/dataloader_config.js');

var render      = require(__dirname + '/../lib/render');
var Hashes      = require(__dirname + '/../lib/rules/hashes');
var Mirror      = require(__dirname + '/../lib/rules/mirror');
var Numsplit    = require(__dirname + '/../lib/rules/numsplit');
var Decare      = require(__dirname + '/../lib/decare');
var routecalc   = require(__dirname + '/../lib/routecalc');

var NumType     = lexterTypes.NUMBER;
var StringType  = lexterTypes.STRING;

var NUMBER= 0;
var DATE = 1;
var STRING = 2;

var TYPE = {
  "date" : DATE,
  "int" : NUMBER 
}

var alphIdx = {a:0,b:1,c:2,d:3,e:4,f:5,g:6,h:7,i:8,j:9,k:10,l:11,m:12,n:13,o:14,p:15,q:16,r:17,s:18,t:19,u:20,v:21,w:22,x:23,y:24,z:25};
var alphArr = ['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z'];

/*{{{ dealRequest() */
/**
 * 请求处理入口
 * @param {Object} reqObj 请求对象
 * @param {Function} cb 回调函数
 * @return void
 */
function dealRequest(reqObj,cb){
  var sql = reqObj.sql;
  if(reqObj.mode == "sqlMode"){
    try{
      var query = Select.create(sql);
      var parts = query.get();
    }catch(e){
      cb("'" + sql + "' is wrong during being parsed");
      return;
    }
    var hasTable = false;
    for(var i in parts.tables){
      hasTable = true;
      break;
    }
    if(!hasTable){
      cb("'" + sql + "' doesn't contain any table");
      return;
    }
    var mergedTable = [];
    for(var i in parts.tables){mergedTable[i] = parts.tables[i];}
    for(var i in parts.joinmap){mergedTable[i] = parts.joinmap[i];}
    var tables = {
      mirror:[],
      hashes:[]
    };
    for(var alias in mergedTable){
      var table = mergedTable[alias];
      var tableInfo = dataloader.getTableInfo(table.table);
      if(!tableInfo){
        cb("Undefined table \""+table.table+"\"");
        return;
      }
      if(tableInfo.route_type == routecalc.ROUTE.MIRROR || tableInfo.routeFields === undefined || tableInfo.routeFields.length === 0){
        tables.mirror.push(tableInfo);
      }else{
        tables.hashes.push({alias:alias,tableInfo:tableInfo});
      }
    }
    getTableNodes(tables,parts,reqObj,cb);
  }
}
/*}}}*/

/*{{{ getTableNodes() */
/**
 * 分析路由并且获得具体路由信息
 * @param {Object} tables sql中各个表信息
 * @param {Object} parts sql解析对象
 * @param {Object} reqObj 请求对象
 * @param {Function} cb 回调函数
 * @return void
 */
function getTableNodes(tables,parts,reqObj,cb){
  var mirrorTable = tables.mirror;
  var hashesTable = tables.hashes;
  var tableNum = mirrorTable.length;
  var tbnodes = [];
  var hashes = [];

  /*{{{ 统计每个hash表的路由值对应的类型*/
  for(var i = 0;i < hashesTable.length; i++){
    var hashTableAlias = hashesTable[i].alias;
    hashes[hashTableAlias] = [];
    var routeFields = hashesTable[i].tableInfo.routeFields;
    for(var j = 0;j < routeFields.length;j++){
      hashes[hashTableAlias][routeFields[j].column_name] = routeFields[j].tidy_return;
    }
  }
  /*}}}*/

  /*{{{ 枚举每个表的路由组合*/
  var usefulFields = getFields(parts.where,hashes);
  var routeMap = [];
  var tb,decare,alias,tableInfo,cols,decareRes;
  var hashesTableLen = hashesTable.length;
  for(var i = 0;i < hashesTableLen; i++){
    tb = hashesTable[i];
    decare = Decare.create();
    alias = tb.alias;
    tableInfo = tb.tableInfo;
    cols = hashes[alias];
    var type,min,max,ins,dt,get;
    for(var col in cols){
      type = TYPE[cols[col].toLowerCase()];
      if(!usefulFields[alias] || !usefulFields[alias][col]){
        cb("Field \""+col+"\" is required for table \""+alias+"\"");
        return;
      }
      try{
        get = demarcate(usefulFields[alias][col],type,col);
      }catch(e){
        cb(e.message);
        return;
      }
      min = get[0];
      max = get[1];
      ins = get[2];
      if(ins.length == 0 && (min == null || max == null)){
        cb("Closed interval must be given for route field \""+col+"\" in table \""+alias+"\"");
        return;
      }
      dt = exhaust(min,max,ins,type);
      if(!dt || dt.length === 0){
        cb("no data");
        return;
      }
      decare.register(col,dt);
    }
    decareRes = decare.cal();
    routeMap.push({tableInfo:tableInfo,decareRes:decareRes});
    tableNum += decareRes.length;
  }
  /*}}}*/

  for(var i = 0;i < mirrorTable.length; i++){
    routeMap.push({tableInfo:mirrorTable[i]});
  }

  var tbnode = [];

  /*{{{ 路由数据全部获取后调用reform*/
  var counter = new Counter(tableNum);
  counter.on("all_reached",function(err,data){
    if(err){
      cb(err);
      return;
    }
    if(!counter.succeed){
      cb("get routeInfo wrong");
      return;
    }
    var exist = false;
    for(var i in tbnode){
      exist = true;
      break;
    }
    if(!exist){
      cb("no any routeinfo for certain route val");
      return;
    }
    reformAll(reqObj,parts,tbnode,cb);
  });
  /*}}}*/

  /*{{{ 根据每个路由字段去获取具体路由信息*/
  for(var i = 0;i < routeMap.length; i++){
    if(routeMap[i].tableInfo.route_type === routecalc.ROUTE.MIRROR || routeMap[i].tableInfo.routeFields === undefined || routeMap[i].tableInfo.routeFields.length === 0){
      (function(){
        var tbn = routeMap[i].tableInfo.table_name;
        routecalc.findNodes(reqObj,routeMap[i],null,function(err,data){
          if(err){
            counter.succeed = false;
          }else{
            tbnode[tbn] = (!data || data.length === 0) ? [] : [data];
          }
          counter.emit("reached");
        });
      })();
    }else{
      var len = routeMap[i].decareRes.length;
      for(var j = 0;j < len; j++){
        (function(){
          var tbn = routeMap[i].tableInfo.table_name;
          routecalc.findNodes(reqObj,routeMap[i],routeMap[i].decareRes[j],function(err,data){
            if(err){
              counter.succeed = false;
            }else{
              if(data.length != 0){
                if(tbnode[tbn] === undefined){
                tbnode[tbn] = [];
              }
                tbnode[tbn].push(data);
              }
            }
            counter.emit("reached");
          });
        })();
      }
    }
  }
  /*}}}*/

}
/*}}}*/

/*{{{ reformAll() */
/**
 * 路由信息整合
 * @param {Object} reqObj 请求对象
 * @param {Object} parts sql解析对象
 * @param {Object} tbnode 每个表的具体表路由信息
 * @param {Function} cb 回调函数
 * @return void
 */
function reformAll(reqObj,parts,tbnode,cb){
  var reform = Reform.create(parts,tbnode,reqObj);
  var res = reform.result();
  if(typeof(res) == 'string'){
    cb(reqObj.sql+":"+res);
    return;
  }
  cb(null,{res:res,reqObj:reqObj});
}
/*}}}*/

/*{{{ getFields() */
/**
 * 根据where字段中筛选有用路由字段
 * @param {Object} where sql中where字段部分
 * @param {Object} fields 路由字段类型信息
 * @return {Object} 各个表有用路由字段组成对象
 */
function getFields(where,fields){
  var res = [];
  var allTab = [];
  for(var i in fields){allTab.push(i);}
  for(var configidx in where){
    var config = where[configidx];
    var elements = config["column"].text.split(".");
    var dn = null;
    var tn = null;
    var cn = null;
    if(elements.length == 3){dn = elements.shift();}
    if(elements.length == 2){tn = elements.shift();}
    if(elements.length == 1){cn = elements.shift();}
    if(tn && !fields[tn]){continue;}
    if(!is_static(cn)){continue;}
    var tb = tn ? [tn] : allTab;
    for(alias in tb){
      var tbn = tb[alias];
      if(fields[tbn][cn]!==0 && !fields[tbn][cn]){continue;}
      if(!res[tbn]){res[tbn] = [];}
      if(!res[tbn][cn]){res[tbn][cn] = [];}
      res[tbn][cn].push({
        relate : config["relate"],
        values : config["values"]
      });
    }
  }
  return res;
}
/*}}}*/

/*{{{ demarcate() */
/**
 * 分析where中字段，得出某个字段的min，max和枚举值
 * @param {Array} routeKey 路由字段的某个条件，例如大于某个值或者小于某个值等
 * @param {int} type 路由字段类型
 * @param {String} f 路由字段名字
 * @param {Array} [min,max,ins]
 */
function demarcate(routeKey,type,f){
  var ins = [];
  var max = null;
  var min = null;
  var limit,limitRelate,limitVals;
  var routeKeyLen = routeKey.length;
  for(var i = 0;i < routeKeyLen; i++){
    limit = routeKey[i];
    limitRelate = limit["relate"];
    limitVals = limit["values"];
    for(var j = 0;j < limitVals.length;j++){
      if(limitVals[j].type !== NumType && limitVals[j].type !== StringType){
        throw new Error("Route field \""+f+"\" must be a static value")
      }
    }
    switch(limitRelate){
      case Select.WHERE.IN:
        var tmp = getArray(limitVals,"text",type);
        if(ins.length == 0){ins = tmp;}
        else{
          var t = [];
          for(var j = 0;j < ins.length;j++){
            for(var k = 0;k < tmp.length;k++){
              if(ins[j] === tmp[k]){t.push(ins[j]);}
            }
          }
          ins = t;
        }
        break;

      case Select.WHERE.EQ:
        var txt = increase(limitVals[0].text,0,type);
        if(ins.length == 0){ins = [txt];}
        else{
          var t = [];
          for(var j = 0;j < ins.length;j++){
            if(ins[j] === txt){t.push(txt);}
          }
          ins = t;
        }
        break;

      case Select.WHERE.GT:
      case Select.WHERE.GE:
        var off = (limitRelate == Select.WHERE.GT) ? 1 : 0;
        var tmp = increase(limitVals[0].text,off,type);
        min = min===null ? tmp : ((min > tmp) ? min : tmp);
        break;

      case Select.WHERE.LT:
      case Select.WHERE.LE:
        var off = (limitRelate == Select.WHERE.LT) ? -1 : 0;
        var tmp = increase(limitVals[0].text,off,type);
        max = max===null ? tmp : ((max > tmp) ? tmp : max);
        break;

      case Select.WHERE.BETWEEN:
        var tmp = getArray(limitVals,"text",type);
        var minTmp = tmp[0] < tmp[1] ? tmp[0] : tmp[1];
        var maxTmp = tmp[0] < tmp[1] ? tmp[1] : tmp[0];
        min = min===null ? minTmp : ((min > minTmp) ? min : minTmp);
        max = max===null ? maxTmp : ((max > maxTmp) ? max : maxTmp);
        break;

      default:
        throw new Error("Unsupported condition relate \""+limitRelate+"\" for route field \""+f+"\"");
    }
  }
  return [min,max,ins];
}
/*}}}*/

/*{{{ exhaust() */
/**
 * 枚举所有满足多个条件的值
 * @param {String || int} min 最小值
 * @param {String || int} max 最大值
 * @param {String || int} ins 具体枚举值
 * @param {int} type 最小值
 * @return {Array || false} 有数据返回Array，没有返回false
 */
function exhaust(min,max,ins,type){
  if(!type){type = NUMBER;}
  var v = (ins.length === 0) ? false : ins;
  var tmp,r;
  if(min !== null && max !== null){
    tmp = range(min,max,type,1);
    if(v === false){return tmp;}
    r = [];
    var tmpLen = tmp.length;
    var vLen = v.length;
    for(var i = 0;i < tmpLen; i++){
      for(var j = 0;j < vLen; j++){
        if(tmp[i] === v[j]){r.push(tmp[i]);}
      }
    }
    return r;
  }

  if(max !== null && v.length != 0){
    var res = [];
    var insLen = ins.length;
    for(var i = 0;i < insLen; i++){
      var insVal = ins[i];
      if(insVal <= max){res.push(insVal);}
    }
    return res;
  }

  if(min !== null && v.length != 0){
    var res = [];
    var insLen = ins.length;
    for(var i = 0;i < insLen; i++){
      var insVal = ins[i];
      if(insVal >= min){res.push(insVal);}
    }
    return res;
  }
  return v;
}
/*}}}*/

/*{{{ range() */
/**
 * 返回范围内的值
 * @param {String || int} min 最小值
 * @param {String || int} max 最大值
 * @param {int} type 类型
 * @param {int} step 枚举间隔
 * @return {Array}
 */
function range(min,max,type,step){
  var res = [];
  if(!type){type = 0;}
  else{type = parseInt(type);}
  if(type == NUMBER){
    if(min > max){return [];}
    res = [];
    for(var i = min;i<=max;i+=step){
      res.push(i);
    }
    return res;
  }
  if(type == STRING){
    var begIdx = alphIdx[min];
    var endIdx = alphIdx[max];
    if(begIdx > endIdx){return [];}
    for(var i = begIdx;i <= endIdx;i++){
      res.push(alphArr[i]);
    }
    return res;
  }

  if(type == DATE){
    min = new Date(min.substring(0,4),parseInt(min.substring(4,6),10)-1,parseInt(min.substring(6,8),10));
    max = new Date(max.substring(0,4),parseInt(max.substring(4,6),10)-1,parseInt(max.substring(6,8),10));
    if(max < min){return [];}
    var beg = min; 
    var end = max;
    while(beg <= end){
      res.push(dateFormat(beg));
      beg.setDate(beg.getDate()+1);
    }
    return res;
  }
}
/*}}}*/

/*{{{ getArray() */
/**
 * 将一个数组中的某一个字段都提出来放到另一个数组中返回
 * @param {Array} data 需要处理的数据
 * @param {String} key 筛选字段
 * @param {int} type 类型
 * @return {Array}
 */
function getArray(data,key,type){
  var _self = this;
  var ret = [];
  var row,get,rowVal;
  var dataLen = data.length;
  for(var i = 0;i < dataLen; i++){
    row = data[i];
    rowVal = row[key];
    if(!rowVal){continue;}
    get = increase(rowVal,0,type);
    if(get === false){return null;}
    ret.push(get);
  }
  return ret;
}
/*}}}*/

/*{{{ increase() */
/**
 * 返回一个数值加上一定增量后的结果（支持整型和日期类型）
 * @param {String || int} data 需要处理的数据
 * @param {int} step 增量
 * @param {int} type 类型
 * @return {String || int} 处理后数据
 */
function increase(data,step,type){
  if(type == DATE){
    data += "";
    if(data.length<8){
      data = "19700101";
    }
    if(data.match(/\d{4}-\d{1,2}-\d{1,2}/ig) != null){
      var d = data.split("-");
      var dat = new Date(d[0],parseInt(d[1],10)-1,parseInt(d[2],10)+step);
      return dateFormat(dat); 
    }else{
      var y = data.substring(0,4);
      var m = data.substring(4,6);
      var d = data.substring(6,8);
      var dat = new Date(y,parseInt(m,10)-1,parseInt(d,10)+step);	
      return dateFormat(dat); 
    }
  }
  return parseInt(data)+step;
}
/*}}}*/

/*{{{ dateFormat() */
/**
 * 格式化日期输出
 * @param {Date} d 日期
 * @return {String}
 */
function dateFormat(d){
  var y = d.getFullYear();
  var tmp  = d.getMonth()+1;
  var m = tmp < 10 ? "0" + tmp : tmp;
  tmp = d.getDate();
  var dat = tmp < 10 ? "0" + tmp : tmp;
  return ""+y+m+dat;
}
/*}}}*/

/*{{{ is_static()*/
/**
 * 判断是不是有效token
 * @param {String} token 需要判断的内容
 * @return {boolean}
 */
function is_static(token){
  if(token.match(/^[a-z_]/i) === null){
    return false;
  }
  return true;
}
/*}}}*/

/*{{{ Class Counter*/
/**
 * 计数器构造类
 * @param {int} totalNum 计数总数
 */
function Counter(totalNum){
  var self = this;
  this.succeed = true;
  events.EventEmitter.call(self);
  self.totalNum = totalNum;
  self.on("reached",function(){
    if(--self.totalNum === 0){
      self.emit("all_reached");
    }
  });
}
/*}}}*/

util.inherits(Counter, events.EventEmitter);

exports.dealRequest = dealRequest;
exports.cleanTable = function(){
  dataloader.reLoadTable();
}
exports.cleanRouteInfo = function(){
  routecalc.cleanRouteInfo();
}
