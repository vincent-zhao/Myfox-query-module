/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
  (C) 2011-2012 Alibaba Group Holding Limited.
  This program is free software; you can redistribute it and/or
  modify it under the terms of the GNU General Public License 
  version 2 as published by the Free Software Foundation.

  File: quickeval.js
  Author: yixuan (yixuan.zzq@taobao.com)
  Description: 表达式计算模块
  Last Modified: 2012-02-07
*/

var Lexter = require(__dirname + "/parser/lexter");
var Hash = require(__dirname + "/../lib/hash");
var util = require("util");

/*{{{ consts*/
var consts = {
	"PI" : Math.PI,
	"E"  : Math.E,
	"KB" : 1024,
	"MB" : 1048576,
	"GB" : 1073741824,
	"TB" : 1099511627776,
};
/*}}}*/

/*{{{ function consts*/
var functions = {
  "ABS"    : {"call":function(arg){return arg[0]===null ? 0:Math.abs(parseFloat(arg[0]));},"args":1,"cache":true},
  "CEIL"   : {"call":function(arg){return arg[0]===null ? 0:Math.ceil(parseFloat(arg[0]));},"args":1,"cache":true},
  "FLOOR"  : {"call":function(arg){return arg[0]===null ? 0:Math.floor(parseFloat(arg[0]));},"args":1,"cache":true},
  "POW"    : {"call":function(arg){return arg[0]===null ? 0:Math.pow(parseFloat(arg[0]),parseFloat(arg[1]));},"args":2,"cache":true},
  "EXP"    : {"call":function(arg){return arg[0]===null ? 0:Math.exp(parseFloat(arg[0]));},"args":1,"cache":true},
  "LOG"    : {"call":function(arg){return arg[0]===null ? 0:Math.log(parseFloat(arg[0]))/parseFloat(Math.log(10));},"args":1,"cache":true},
  "LN"     : {"call":function(arg){return arg[0]===null ? 0:Math.log(parseFloat(arg[0]));},"args":1,"cache":true},
  "SQRT"   : {"call":function(arg){return arg[0]===null ? 0:Math.sqrt(parseFloat(arg[0]));},"args":1,"cache":true},
  "SIN"    : {"call":function(arg){return arg[0]===null ? 0:Math.sin(parseFloat(arg[0]));},"args":1,"cache":true},
  "COS"    : {"call":function(arg){return arg[0]===null ? 0:Math.cos(parseFloat(arg[0]));},"args":1,"cache":true},
  "MD5"    : {"call":function(arg){return Hash.md5(arg[0]);},"args":1,"cache":true},
  "INT"    : {"call":function(arg){return parseInt(arg[0]);},"args":1,"cache":true},
  "LENGTH" : {"call":function(arg){return arg[0].length;},"args":1,"cache":true},
  "ROUND"  : {"call":round,"args":1,"cache":true},
  "OPERATE": {"call":operate,"args":3,"cache":true},
  "STATIC": {"call":function(arg){return arg[0];},"args":1,"cache":true},
  "IF" : {"call":function(arg){return arg[0] ? arg[1]:arg[2]},"args":3,"cache":true}
};
/*}}}*/

/*{{{ operator consts*/
var operators = {
  "*"  : 2,
  "/"  : 2,
  "%"  : 2,
  "+"  : 3,
  "-"  : 3,
  ">>" : 10,
  "<<" : 10,
  ">"  : 20,
  ">=" : 20,
  "<"  : 20,
  "<=" : 20,
  "==" : 21,
  "!=" : 21,
  "&"  : 30,
  "^"  : 31,
  "|"  : 32,
  "&&" : 40,
  "||" : 41
}
/*}}}*/

/*{{{ QuickEval constructor*/
/**
 * QuickEval对象的构造函数
 * @param {String} expression 表达式字符串
 * @param {String} charset 字符集
 * @return void
 */
var QuickEval = function(expression,charset){
  var _self = this;
  _self.token = [];
  _self.stack = [];
  if(expression instanceof Array){
    _self.token = expression;
  }else{
    var lexter = Lexter.create("("+expression+")");
    _self.token = lexter.getAll();
  }
  _self.patch();
  _self.prepare();
  _self.optimize();
}
/*}}}*/

/*{{{ execute()*/
/**
 * 执行计算
 * @param {Object} variable 表达式中相应变量的变量值
 * @return {int} 计算结果
 */
QuickEval.prototype.execute = function(variable){
  var _self = this;
  var res = [];
  for(key in _self.stack){
    var stack = _self.stack[key];
    var call = stack["call"].toUpperCase();
    if(call == null || !functions[call]){
      throw new Error("Undefined function named as \""+stack["call"]+"\"");
    }
    call = functions[call];
    args = [];
    for(argidx in stack["args"]){
      var arg = stack["args"][argidx];
      switch(arg["type"]){
        case Lexter.types.MEMORY:
          args.push(res[arg["text"]]);
          break;
        case Lexter.types.NUMBER:
        case Lexter.types.STRING:
        case Lexter.types.OPERATOR:
          args.push(arg["text"]);
          break;

        default:
          var t = (variable[arg["text"]] === null || variable[arg["text"]] === undefined) ? null : variable[arg["text"]];
          args.push(t);
          break;
      }
    }
    if(args.length < call["args"]){
      throw new Error("Function "+stack["call"]+" needs "+call["args"]+" args at least,given "+args.length);
    }
    res[key] = call["call"](args);
  }
  return res.pop();
}
/*}}}*/

/*{{{ patch()*/
QuickEval.prototype.patch = function(){
  var _self = this;
  var tokens = [];
  var last = Lexter.types.OPERATOR;
  var text = "";
  for(tokenidx in _self.token){
    var token = _self.token[tokenidx];
    if(token["type"] == Lexter.types.COMMENT){
      continue;
    }
    if(token["type"] == Lexter.types.NUMBER && token["text"]<0){
      if(text == "(" || text == ","){
      }else{
        tokens.push({type:Lexter.types.OPERATOR,text:"+"});
      }
    }
    tokens.push(token);
    last = token["type"];
    text = token["text"];
  }
  for(tidx in tokens){
    tokens[tidx]["mark"] = -1;
  }
  _self.token = tokens;
}
/*}}}*/

/*{{{ prepare() */
/**
 * 表达式分析
 * @param empty
 * @return void 
 */
QuickEval.prototype.prepare = function(){
  var _self = this;
  var count = _self.token.length;
  var left = count;
  var right = 0;
  var index = 0;
  while(left > 0){

    /*{{{ find the innest parenthesses*/
    var find = false;
    var pos = 0;
    for(var i = right + 1;i < count;i++){
      var token = _self.token[i];
      if(token["mark"] != -1){
        continue;
      }
      if(token["type"] == Lexter.types.COMMAS && token["text"] == ")"){
        pos = i;
        break;
      }
    }
    right = pos;
    left = (left == count) ? right : left;

    pos = 0;
    for(var i  = right - 1;i >= 0;i--){
      var token = _self.token[i];
      if(token["mark"] != -1){
        continue;
      }
      _self.token[i]["mark"] = 0;
      if(token["type"] == Lexter.types.COMMAS && token["text"] == "("){
        pos = i;
        find = true;
        break;
      }
    }

    left = pos;
    if(right == 0){
      left = 0;
      right = count-1;
    }
    /*}}}*/

    /*{{{ find the calculation with the highest priority*/
    while(true){
      pos = -1;
      var max = 65535;

      for(var i = left;i<=right;i++){
        var token = _self.token[i];
        if((token["mark"] != -1 && token["mark"] != 0) || token["type"] == Lexter.types.COMMAS){
          continue;
        }
        var level = _self.priority(token["text"]);
        if(level < max){
          max = level;
          pos = i;
        }
      }
      if(pos < 0){
        var begin = left;
        if(left > 0 && _self.token[left-1]["type"] == Lexter.types.FUNCTION){
          begin = left - 1;
          _self.stack.push({
            "call" : _self.token[begin]["text"],
            "args" : _self.get_token_args(begin)
          });
          index++;
        }else if(_self.token[left]["mark"] === -1 || (right-left) === 2 ){
          var a = [_self.get_token_var(find ? left+1 : left)];
          _self.stack.push({
            "call" : "STATIC",
            "args" : a 
          });
          index++;
        }
        for(var i = begin;i<=right;i++){
          _self.token[i]["mark"] = index;
        }

        break;
      }

      _self.stack.push({
        "call" : "OPERATE",
        "args" : _self.get_token_args(pos)
      });
      index++;
      _self.token[pos]["mark"] = index;

      for(i in [-1,1]){
        var offset = [-1,1][i];
        if(_self.token[pos+offset]["mark"] == -1 || _self.token[pos+offset]["mark"] == 0){
          _self.token[pos+offset]["mark"] = index;
        }else{
          tmp = _self.token[pos+offset]["mark"];
          for(var j = pos+offset;j>=0 && j<count;j+=offset){
            if(_self.token[j]["mark"] != tmp){break;}
            _self.token[j]["mark"] = index;
          }
        }
      }
    }
    /*}}}*/

	}
}
/*}}}*/

/*{{{ optimize()*/
/**
 * 计算优化器，优化可以直接算出值的部分
 * @param empty
 * @return void 
 */
QuickEval.prototype.optimize = function(){
  var _self = this;
  var count = _self.stack.length;
outerloop:
  for(var i = 0;i<count;i++){
    var stack = _self.stack[i];
    var call = stack["call"].toUpperCase();
    if(!call || !functions[call]){
      throw new Error("Undefined function named as \""+stack["call"]+"\"");
    }
    call = functions[call];
    if(!call["cache"]){
      continue;
    }
    var args = [];
    for(idx in stack["args"]){
      var arg = stack["args"][idx];
      if(arg["type"] != Lexter.types.OPERATOR && arg["type"] != Lexter.types.NUMBER && arg["type"] != Lexter.types.STRING){
        continue outerloop;
      }
      args.push(arg["text"]);
    }

    if(args.length < call["args"]){
      throw new Error("Function "+stack["call"]+" needs "+call["args"]+" args at least, given "+args.length);
    }
    var value = call["call"](args);
    for(j = i+1;j<count;j++){
      args = [];
      for(k in _self.stack[j]["args"]){
        var arg = _self.stack[j]["args"][k];
        if(arg["type"] == Lexter.types.MEMORY && arg["text"] == i){
          _self.stack[j]["args"][k] = {
            "type" : Lexter.types.NUMBER,
            "text" : value
          };
        }
      }
    }
    _self.stack[i] = {
      "call" : "STATIC",
      "args" : [
      {
        "type" : Lexter.types.NUMBER,
        "text" : value
      }
      ],
      "stat" : true
    };
  }

  stacks = [];
  values = [];
  for(var i = 0;i<count;i++){
    if(_self.stack[i]["stat"]){
      if(i == count - 1){
        stacks = [_self.stack[i]];
      }
      continue;
    }

    for(j in _self.stack[i]["args"]){
      var arg = _self.stack[i]["args"][j];
      if(arg["type"] == Lexter.types.MEMORY){
        _self.stack[i]["args"][j]["text"] = values[arg["text"]];
      }
    }

    var index = stacks.length;
    stacks[index] = _self.stack[i];
    values[i] = index;
  }
  _self.stack = stacks;
}
/*}}}*/

/*{{{ get_token_args()*/
/**
 * 分解函数参数
 * @param {int} pos 参数起始位置
 * @return {Array}
 */
QuickEval.prototype.get_token_args = function(pos){
  var _self = this;
  if(_self.token[pos] == undefined || !_self.token[pos]){
    return false;
  }

  var token = _self.token[pos];
  if(token["type"] == Lexter.types.OPERATOR){
    var a =[_self.get_token_var(pos),_self.get_token_var(pos-1),_self.get_token_var(pos+1)];
    return a;
  }

  if(token["type"] != Lexter.types.FUNCTION){
    return false;
  }

  var expr = 0;
  var res = [];
outerloop:
  for(var i = pos+1,count = _self.token.length;i<count;i++){
    token = _self.token[i];
    if(token["type"] != Lexter.types.COMMAS){
      continue;
    }
    switch(token["text"]){
      case "(":
        expr++;
      break;
      case ")":
        if((--expr) == 0){
          var prev = _self.token[i-1];
          if(prev["type"] != Lexter.types.COMMAS || prev["text"] != "("){
            res.push(_self.get_token_var(i-1));
          }
          break outerloop;
        }
      break;
      case ",":
        if(expr == 1){
          res.push(_self.get_token_var(i-1));
        }
      break;
      default:
      break;
    }
  }
  return res;
}
/*}}}*/

/*{{{ get_token_var()*/
/**
 * 获得单个参数变量
 * @param {int} pos 参数位置
 * @return {Object} 
 */
QuickEval.prototype.get_token_var = function(pos){
  var _self = this;
  if(_self.token[pos] == undefined || !_self.token[pos]){
    return null;
  }
  var token = _self.token[pos];
  if(token["mark"] != -1 && token["mark"] != 0){
    return {
      "type" : Lexter.types.MEMORY,
      "text" : token["mark"] - 1
    }
  }

  return {
    "type" : token["type"],
    "text" : token["text"]
  }
}
/*}}}*/

/*{{{ priority()*/
/**
 * 获得运算优先级
 * @param {String} oper 运算符
 * @return {int} 操作符优先级
 */
QuickEval.prototype.priority = function(oper){
  if(operators[oper] != undefined && operators[oper] != null){
    return operators[oper];
  }
  return 65535;
}
/*}}}*/

/*{{{ operate()*/
/**
 * 计算器
 * @param {Array} args 运算三元素组成的数组
 * @return {int || null}
 */
function operate(args){
  var ops = args[0];
  var val1 = parseFloat(args[1]);
  var val2 = parseFloat(args[2]);
  switch(ops){
    case "+":
      return val1 + val2;

    case "-":
      return val1 - val2;

    case "*":
      return val1 * val2;

    case "/":
      return val2 ? (val1/val2) : 0;

    case "%":
      return val2 ? (val1%val2) : 0;

    case "^":
      return val1 ^ val2;

    case "&":
      return val1 & val2;

    case "|":
      return val1 | val2;

    case "<<":
      return val1 << parseInt(val2);

    case ">>":
      return val1 >> parseInt(val2);

    case ">":
      return val1 > val2 ? 1 : 0;

    case ">=":
      return val1 >= val2 ? 1 : 0;

    case "<":
      return val1 < val2 ? 1 : 0;

    case "<=":
      return val1 <= val2 ? 1 : 0;

    case "==":
      return val1 == val2 ? 1 : 0;

    case "!=":
      return val1 != val2 ? 1 : 0;

    case "&&":
      return (val1 && val2) ? 1 : 0;

    case "||":
      return (val1 || val2) ?  1 : 0;

    default:
    break;
  }
  return null;
}
/*}}}*/

/*{{{ round()*/
/**
 * 精度控制
 * @param {Array} args 第一个元素是要控制精度的数字，二个是控制精度的位数
 * @return {int}
 */
function round(args){
  var intpre = null;
  var num = args[0];
  if(args[1] === undefined || args[1] === null){intpre = 2;}
  else{intpre = args[1];}
  intpre = parseInt(intpre);
  var round = Math.pow(10,intpre);
  return parseInt(num * round + 0.5)/round;
}
/*}}}*/

exports.create = function(expression,charset){
  return new QuickEval(expression,charset);
}
