/*
    File: lexter.js
    Author: pengchun,yixuan (pengchun@taobao.com,yixuan.zzq@taobao.com)
    Description: 词法分析类
    Last Modified: 2012-02-07
*/

var mysqlEscape = function(val){
  if (val === undefined || val === null) {
    return 'NULL';
  }

  switch (typeof val) {
    case 'boolean': return (val) ? 'true' : 'false';
    case 'number': return val+'';
  }

  if (typeof val === 'object') {
    val = (typeof val.toISOString === 'function')
      ? val.toISOString()
      : val.toString();
  }

  val = val.replace(/[\0\n\r\b\t\\\'\"\x1a]/g, function(s) {
    switch(s) {
      case "\0": return "\\0";
      case "\n": return "\\n";
      case "\r": return "\\r";
      case "\b": return "\\b";
      case "\t": return "\\t";
      case "\x1a": return "\\Z";
      default: return "\\"+s;
    }
  });
  return "'"+val+"'";
}


var Types   = {
    UNKNOWN     : 0,				/**<    未知的 */
    KEYWORD     : 1,				/**<    关键字 */
    NUMBER      : 2,				/**<    数  字 */
    STRING      : 3,				/**<    字符串 */
    FUNCTION    : 4,				/**<    函数名 */
    VARIABLE    : 5,				/**<    变  量 */
    PARAMS      : 6,                /**<    绑定值 */
    OPERATOR    : 7,				/**<    运算符 */
    COMMAS      : 8,				/**<    标  点 */
	MEMORY		: 9,

    COMMENT     : 99,               /**<    注  释 */

}

var Parser  = function(query) {
    var tks = [], pre = Types.UNKNOWN;
    var tmp = [], cur = '', sub = '', nxt = '';

    var len = query.length;
    for (var i = 0; i < len; i++) {
        cur = query.charAt(i);

        /* {{{ 注释 */
        if ('/' == cur && '*' == query.charAt(i + 1)) {
            tmp = [];
            i++;
            while (++i < len) {
                sub = query.charAt(i);
                nxt = query.charAt(++i);
                if ('*' == sub && '/' == nxt) {
                    break;
                }
                tmp.push(sub);
                tmp.push(nxt);
            }
            tmp = tmp.join("");
            tks.push({
                'text'  : tmp.replace(/^[\*\s]+/, '').replace(/[\s\*]+$/, ''),
                'type'  : Types.COMMENT,
            });
        }
        /* }}} */

        /* {{{ 字符串 */
        else if ("'" == cur || '"' == cur || '`' == cur) {
            tmp = [];
            while (i < len && cur != (sub = query.charAt(++i))) {
                ("\\" == sub) ? tmp.push(query.charAt(++i)) : tmp.push(sub);
            }
            tmp = tmp.join("");
            tks.push({
                'text'  : tmp,
                'type'  : ('`' == cur) ? Types.VARIABLE : Types.STRING,
            });
        }
        /* }}} */

        /* {{{ 绑定变量 */
        else if (':' == cur) {
            tmp = [cur];
            while (i < len) {
                sub = query.charAt(++i);
                if (!(/^\w+$/i.test(sub))) {
                    break;
                }
                tmp.push(sub);
            }
            tmp = tmp.join("");
            tks.push({
                'text'  : tmp,
                'type'  : Types.PARAMS,
            });
        }
        /* }}} */

        /* {{{ 函数名 */
        else if (/^[a-z_]+$/i.test(cur)) {
            tmp = [cur];
            while (i < len) {
                sub = query.charAt(++i);
                if (!(/^[\w\.]+$/i.test(sub))) {
                    break;
                }
                tmp.push(sub);
            }
            tmp = tmp.join("");
            i--;
            tks.push({
                'text'  : tmp,
                'type'  : '(' == sub ? Types.FUNCTION : Types.KEYWORD,
            });
        }
        /* }}} */

        /* {{{ 数字 */

        else if (('-' == cur && Types.VARIABLE != pre) || /\d+/.test(cur)) {
            tmp = [cur];
            while (i < len) {
                sub = query.charAt(++i);
                if (!(/^[\d\.]+$/.test(sub))) {
                    break;
                }
                tmp.push(sub);
            }
            tmp = tmp.join("");
            i--;

			if("-" == tmp){
         	   tks.push({
            	    'text'  : '-',  /**<    类型转换 */
                	'type'  : Types.OPERATOR
            	});	
			}else{
         	   tks.push({
            	    'text'  : tmp - 0,  /**<    类型转换 */
                	'type'  : Types.NUMBER
            	});	
			}
        }
        /* }}} */

        /* {{{ 标点 */
        else if (/^[\,;\(\)]+$/.test(cur)) {
            tks.push({
                'text'  : cur,
                'type'  : Types.COMMAS,
            });
        }
        /* }}} */

        /* {{{ 运算符 */
        else if (/^(\+|\-|\*|\/|>|<|=|!)$/.test(cur)) {
            tmp = [cur];
            while (i < len) {
                sub = query.charAt(++i);
                if (!(/^(\+|\*|\/|>|<|=|!)+$/.test(sub))) {
                    break;
                }
                tmp.push(sub);
            }
            tmp = tmp.join("");
            i--;

            tks.push({
                'text'  : tmp,
                'type'  : Types.OPERATOR,
            });
        }
        /* }}} */

        pre = tks[tks.length - 1].type;
    }

    return tks;
}

/* {{{ public construct() */
var Lexter  = function(query) {
    this.tokens = Parser(query.toString());
    this.blocks = [];

    var express = 0;
    var calcmap = {
        "(" : 1,
        ")" : -1,
    };

    for (var i = 0; i < this.tokens.length; ++i) {
        var tks = this.tokens[i];
        if (tks.type == Types.COMMAS && undefined !== calcmap[tks.text]) {
            express += calcmap[tks.text];
        } else if (!express) {
            this.blocks.push(i);
        }
    }
}
/* }}} */

/* {{{ public getAll() */
Lexter.prototype.getAll     = function() {
    return this.tokens;
}
/* }}} */

/* {{{ public indexOf() */
Lexter.prototype.indexOf    = function(who, off) {
    var pos = 0;
    var tks = null;

    try {
        var exp = new RegExp(who.text, 'i');
    } catch (e) {
        var exp = who.text.toLowerCase();
    }
    var off = (off === undefined || off < 0) ? 0 : off + 1;

    // xxx: 这里可以用二分法
    /*
    var idx = 0;
    var head = 0;
    var tail = this.blocks.length;
    while(true){
        if((tail - head) == 1){
            idx = tail;
            break;
        }
        var tmp = parseInt((tail-head)/2);
        if(this.blocks[tmp] < off){
            head += tmp;
            continue;
        }
        if(this.blocks[tmp] == off){
            idx = tmp;
            break;
        }
        if(this.blocks[tmp] > off){
            tail -= tmp;
            continue;
        }
    }

    for (var i = idx; i < this.blocks.length; ++i) {
        pos = this.blocks[i];
        tks = this.tokens[pos];
        if (who.type == tks.type && ((exp instanceof RegExp && exp.test(tks.text)) || exp == tks.text.toLowerCase())) {
            return this.blocks[i];
        }
    }
*/
    var bls = this.blocks;
    var len = bls.length;
    for (var i = 0; i < len; ++i) {
        pos = bls[i];
        if (pos < off) {
            continue;
        }

        tks = this.tokens[pos];
        if (who.type == tks.type && ((exp instanceof RegExp && exp.test(tks.text)) || (!(exp instanceof RegExp) && exp == tks.text.toLowerCase()))) {
            return bls[i];
        }
    }

    return -1;
}
/* }}} */

/*{{{ static vars()*/
exports.vars = function(idx,tokens,isString){
	var res;
	if(isString){
		var lexter = new Lexter(tokens);
		tokens = lexter.getAll();
	}
	if(!tokens[idx]){return null;}
	switch(tokens[idx]["type"]){
	case Types.OPERATOR:
		res = [tokens[idx-1],tokens[idx+1]];
		break;
	case Types.FUNCTION:
		res = [];
		var temp = [];
		var expr = 0;
		for(var i  = idx+1, count=tokens.length;i<count;i++){
			var tk = tokens[i];
			if(tk["type"] != Types.COMMAS){
				temp.push(tk);
				continue;
			}
			switch(tk["text"]){
			case "(":
				if(expr>0){
					temp.push(tk);
				}
				expr++;
				break;
			case ")":
				if((--expr)==0){
					res.push(temp);
					temp = [];
					i = count;
					break;
				}else{temp.push(tk);}
				break;
			case ",":
				if(expr == 1){
					res.push(temp);
					temp = [];
				}else{temp.push(tk);}
				break;
			default:
				break;
			}
		}
		break;
		default :
			res = null;
			break;
	}
	return res;
}
/*}}}*/

/*{{{ static text()*/
exports.text = function(stack,comma){
	var res = [];
    var len = stack.length;
    for(var i = 0;i < len; i++){
		var token = stack[i];
        var type = token.type;
        var text = token.text;
		if(!token || !type || text == null){
			res.push(null);
		}else{
			switch(type){
			case Types.STRING :
				res.push(mysqlEscape(text));
				break;
			case Types.VARIABLE :
				res.push(text);
				break;
			default:
				res.push(text);
				break;
			}
		}
		if(comma){
			res.push(comma);
		}
	}
	if(comma){res.pop();}
	return res;
}
/*}}}*/
exports.types   = Types;
exports.create  = function(query) {
    return new Lexter(query);
}

