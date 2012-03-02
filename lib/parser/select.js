/* vim: set expandtab tabstop=2 shiftwidth=2 foldmethod=marker: */
/*
 (C) 2011-2012 Alibaba Group Holding Limited.
 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU General Public License
 version 2 as published by the Free Software Foundation.

 File: select.js
 Author: xuyi (xuyi.zl@taobao.com)
 Description: sql语句解析类
 Last Modified: 2012-02-20
*/

var Lexter = require('./lexter.js');

var WHERE = {
  EQ      : 1,
  GT      : 2,
  GE      : 3,
  LT      : 4,
  LE      : 5,
  NE      : 6,
  IN      : 7,
  NOTIN   : 8,
  LIKE    : 9,
  NOTLIKE : 10,
  BETWEEN : 11,
  ISNULL  : 20,
  NOTNULL : 21,
};

var ORDER = {
  ASC  : 1,
  DESC : 2,
};

var RELATEMAP = {
  '='  : WHERE.EQ,
  '==' : WHERE.EQ,
  '!=' : WHERE.NE,
  '<>' : WHERE.NE,
  '>'  : WHERE.GT,
  '>=' : WHERE.GE,
  '<'  : WHERE.LT,
  '<=' : WHERE.LE,
};

/* {{{ private function fetch()*/
function fetch(key, tks, sep) {
  if (undefined == sep) {
    sep = '';
  }
  var ret = [];
  for (var i = 0; i < tks.length; ++i) {
    ret.push(tks[i][key]);
  }
  return ret.join(sep);
}
/* }}}*/

/* {{{ private function deal()*/
function deal(tmp) {
  var ret = [];
  for (var i = 0; i < tmp.length; i++) {
    if (tmp[i].type !== Lexter.types.KEYWORD && tmp[i].type !== Lexter.types.COMMAS) {
      ret.push(tmp[i]);
    }
  }
  return ret;
}
/* }}}*/

/* {{{ public Insight.construc() */
/**
 * 构造函数
 * @param {String} sql 
 */
var Insight = function(sql) {
  this.lexter = Lexter.create(sql);
  this.tokens = this.lexter.getAll();
  this.ualias = [];
  this.begin = 0;
  this.ualias[Lexter.types.KEYWORD] = true;
  this.ualias[Lexter.types.VARIABLE] = true;
}
/* }}} */

/* {{{ public Insight.select() */
/**
 * 生成语意解析后对象
 * @return {Object}
 */
Insight.prototype.select = function() {
  if (Lexter.types.KEYWORD != this.tokens[0].type || ! (/^SELECT$/i.test(this.tokens[0].text))) {
    throw new Error("SQL command should begin with keyword *SELECT*");
  }
  return {
    /*{{{*/
    'columns': this.parseColumn(
    1, this.lexter.indexOf({
    type: Lexter.types.KEYWORD,
    text: '^FROM$',
    },
    this.begin), null, false),

    'tables': this.parseTable(
    1 + this.lexter.indexOf({
      type: Lexter.types.KEYWORD,
      text: '^(FROM)$',
    },
    this.begin), this.lexter.indexOf({
      type: Lexter.types.KEYWORD,
      text: '^(WHERE|ORDER|GROUP|LIMIT|JOIN|INNER|OUTER|CROSE|LEFT|RIGHT|NATURAL)$',
    },
    this.begin), {
      type: Lexter.types.COMMAS,
      text: ',',
    },
    true),

    'joinmap': this.parseJoins(
    this.lexter.indexOf({
      type: Lexter.types.KEYWORD,
      text: '^(JOIN|INNER|OUTER|CROSS|LEFT|RIGHT|NATURAL)$',
    },
    this.begin), this.lexter.indexOf({
      type: Lexter.types.KEYWORD,
      text: '^(WHERE|ORDER|GROUP|LIMIT)$',
    },
    this.begin), {
      type: Lexter.types.KEYWORD,
      text: '^(JOIN|INNER|OUTER|CROSS|LEFT|RIGHT|NATURAL)$'
    },
    false),

    'where': this.parseWhere(
    this.lexter.indexOf({
      type: Lexter.types.KEYWORD,
      text: '^(WHERE)$',
    },
    this.begin), this.lexter.indexOf({
      type: Lexter.types.KEYWORD,
      text: '^(ORDER|GROUP|LIMIT)$',
    },
    this.begin), {
      type: Lexter.types.KEYWORD,
      text: '^(AND)$',
    },
    true),

    'groupby': this.parseGroupBy(
    this.lexter.indexOf({
      type: Lexter.types.KEYWORD,
      text: '^(GROUP)$',
    },
    this.begin), this.lexter.indexOf({
      type: Lexter.types.KEYWORD,
      text: '^(ORDER|LIMIT)$',
    },
    this.begin), {
      type: Lexter.types.COMMAS,
      text: ',',
    },
    true),

    'orderby': this.parseOrderBy(
    this.lexter.indexOf({
      type: Lexter.types.KEYWORD,
      text: '^(ORDER)$',
    },
    this.begin), this.lexter.indexOf({
      type: Lexter.types.KEYWORD,
      text: '^(LIMIT)$',
    },
    this.begin), {
      type: Lexter.types.COMMAS,
      text: ',',
    },
    true),

    'limits': this.parseLimit(
    1 + this.lexter.indexOf({
      type: Lexter.types.KEYWORD,
      text: '^(LIMIT)$',
    },
    this.begin), - 1, {
      type: Lexter.types.COMMAS,
      text: ',',
    },
    true)
    /*}}}*/
    };
}
/* }}} */

/*{{{ Insight.parseColumn()*/
/**
 * 解析column
 * @param  {Integer} beg 开始标志位
 * @param  {Integer} end 结束标志位
 * @param  {Object} sep 分隔符
 * @param  {Boolean} txt 是否文本输出
 * @return {Array}
 */
Insight.prototype.parseColumn = function(beg, end, sep, txt) {
  if (undefined == sep) {
    sep = {
      type: Lexter.types.COMMAS,
      text: ','
    };
  }
  var pos = 0,
      key = '',
      pre = null,
      tmp = [],
      ret = [];
  end = (end < 0) ? this.tokens.length: end;
  while (beg < end) {
    var dist = null;
    pos = this.lexter.indexOf(sep, beg);
    if (pos > end) {
      pos = - 1;
    }
    if (pos >= 0) {
      tmp = this.tokens.slice(beg, pos);
      beg = pos + 1;
    } else {
      tmp = this.tokens.slice(beg, end);
      beg = end;
    }
    pre = tmp[tmp.length - 2];
    if (undefined == pre) {
      pre = {
        type: Lexter.types.OPERATOR,
        text: '',
      };
    }
    if (pre.type == Lexter.types.KEYWORD && /^as$/i.test(pre.text)) {
      key = tmp[tmp.length - 1].text;
      key = key.split('.').pop();
      var tt = [];
      for (var i = 0; i < tmp.length; i++) {
        if (/^(all|distinct|distinctrow)$/i.test(tmp[i].text)) {
          dist = tmp[i];
        } else {
          tt.push(tmp[i]);
        }
      }
      tmp = tt;
      pos = - 2;
    } else if (pre.type != Lexter.types.OPERATOR && true === this.ualias[tmp[tmp.length - 1].type]) {
      key = tmp[tmp.length - 1].text;
      key = key.split('.').pop();
      if (tmp[0].type == Lexter.types.KEYWORD && /^(all|distinct|distinctrow)$/i.test(tmp[0].text)) {
        dist = tmp.shift();
        pos = 0;
      } else {
        pos = - 1;
      }
    } else {
      key = fetch('text', tmp);
      key = key.split('.').pop();
      pos = 0;
    }

    if (0 == pos) {
      ret[key] = {
        dist: dist,
        expr: tmp
      };
    } else {
      ret[key] = {
        dist: dist,
        expr: tmp.slice(0, pos)
      };
    }

    if (true == txt) {
      ret[key] = {
        dist: (null == dist) ? '': dist.text.toUpperCase(),
        expr: fetch('text', ret[key])
      };
    }
  }
  this.begin = beg - 1;
  return ret;

}
/*}}}*/

/*{{{ Insight.parseTable()*/
Insight.prototype.parseTable = function(beg, end, sep, txt) {
  if (beg <= 0 && end <= 0) {
    this.begin = beg - 1;
    return [];
  }
  if (undefined == sep) {
    sep = {
      type: Lexter.types.COMMAS,
      text: ','
    };
  }
  var pos = 0,
      key = '',
      pre = null,
      tmp = [],
      ret = [];
  end = (end < 0) ? this.tokens.length: end;
  while (beg < end) {
    pos = this.lexter.indexOf(sep, beg);
    if (pos > end) {
      pos = - 1;
    }
    if (pos >= 0) {
      tmp = this.tokens.slice(beg, pos);
      beg = pos + 1;
    } else {
      tmp = this.tokens.slice(beg, end);
      beg = end;
    }
    pre = tmp[tmp.length - 2];
    if (undefined == pre) {
      pre = {
        type: Lexter.types.OPERATOR,
        text: '',
      };
    }
    if (pre.type == Lexter.types.KEYWORD && /^as$/i.test(pre.text)) {
      key = tmp[tmp.length - 1].text;
      pos = - 2;
    } else if (pre.type != Lexter.types.OPERATOR && true === this.ualias[tmp[tmp.length - 1].type]) {
      key = tmp[tmp.length - 1].text;
      pos = - 1;
    } else {
      key = fetch('text', tmp);
      pos = 0;
    }
    if (0 == pos) {
      ret[key] = tmp;
    } else {
      ret[key] = tmp.slice(0, pos);
    }

    if (true == txt) {
      var str = fetch('text', ret[key]);
      if (str.indexOf('.') > 0) {
        var idx = str.indexOf('.');
        ret[key] = {
          db: str.substr(0, idx),
          table: str.substr(idx + 1, str.length)
        }
      } else {
        ret[key] = {
          db: '',
          table: str
        }
      }
    }
  }
  this.begin = beg - 1;
  return ret;

}
/*}}}*/

/*{{{ Insight.parseJoins()*/
Insight.prototype.parseJoins = function(beg, end, sep, txt) {
  var pos = 0,
      key = '',
      pre = null,
      tmp = [],
      ret = [],
      tp = [],
      method = '';
  end = (end < 0) ? this.tokens.length: end;
  if (beg < 0) {
    this.begin = beg - 1;
    return ret;
  }
  while (beg < end) {
    pos = this.lexter.indexOf(sep, beg);
    if (pos >= 0) {
      tmp = this.tokens.slice(beg, pos);
      //beg = pos + 1;
      beg = pos;
    } else {
      tmp = this.tokens.slice(beg, end);
      beg = end;
    }
    if (tmp.length == 1) {
      method += tmp[0].text.toUpperCase() + ' ';
      continue;
    }
    method += 'JOIN';
    for (var i = 0; i < tmp.length; i++) {
      if (tmp[i].type == Lexter.types.KEYWORD && /^on$/i.test(tmp[i].text)) {
        pos = i;
      }
    }
    for (var b = 0; b < pos; b++) {
      if (tmp[b].type == Lexter.types.KEYWORD && /^as$/i.test(tmp[b].text)) {
        key = tmp[b + 1].text;
        break;
      }
    }
    if (key.length == 0) {
      key = tmp[pos - 1].text;
    }
    ret[key] = {
      table: tmp[1].text,
      method: method,
      where: fetch('text', tmp.slice(pos + 1, tmp.length), ' ')
    };
    key = '';
    method = '';
  }
  this.begin = beg - 1;
  return ret;
}
/*}}}*/

/*{{{ Insight.parseWhere()*/
Insight.prototype.parseWhere = function(beg, end, sep, txt) {
  if (beg > 0) {
    beg += 1;
  }
  if (undefined == sep) {
    sep = {
      type: Lexter.types.KEYWORD,
      text: 'AND'
    }
  }
  var pos = 0,
      key = '',
      pre = null,
      tmp = [],
      ret = [],
      column = null,
      partime = null,
      relate = null,
      values = null;
  end = (end < 0) ? this.tokens.length: end;
  while (beg < end) {
    var not = false;
    pos = this.lexter.indexOf(sep, beg);
    if (pos > end) {
      pos = - 1;
    }
    if (pos >= 0) {
      tmp = this.tokens.slice(beg, pos);
      beg = pos + 1;
    } else {
      tmp = this.tokens.slice(beg, end);
      beg = end;
    }
    if (tmp.length < 3) {
      continue;
    }
    column = tmp.shift();
    if (column.type == Lexter.types.COMMAS || column.type == Lexter.types.FUNCTION) {
      continue;
    }
    partime = tmp.shift();
    if (partime.type == Lexter.types.OPERATOR) {
      if (undefined == RELATEMAP[partime.text]) {
        throw new Error("Unrecognized operator");
      }
      relate = RELATEMAP[partime.text];
      values = tmp;
    } else if (partime.text.toLowerCase() == 'is') {
      while (partime = tmp.shift()) {
        if (partime.text.toLowerCase() == 'not') {
          not = true;
        }
        if (partime.text.toLowerCase() == 'null') {
          relate = (not === true) ? WHERE.NOTNULL: WHERE.ISNULL;
          values = null;
          break;
        }
      }
    } else if (partime.text.toLowerCase() == 'not') {
      partime = tmp.shift();
      if (partime.text.toLowerCase() == 'like') {
        relate = WHERE.NOTLIKE;
        values = tmp;
      } else if (partime.text.toLowerCase() == 'in') {
        relate = WHERE.NOTIN;
        values = deal(tmp);
      } else {
        throw new Error();
      }
    } else if (partime.text.toLowerCase() == 'like') {
      relate = WHERE.LIKE;
      values = tmp;
    } else if (partime.text.toLowerCase() == 'in') {
      relate = WHERE.IN;
      values = deal(tmp);
    } else if (partime.text.toLowerCase() == 'between') {
      relate = WHERE.BETWEEN;
      values = deal(tmp);
    } else {
      //throw new Error();
    }
    ret.push({
      relate: relate,
      values: values,
      column: column,
    });
}
this.begin = beg - 1;
return ret;
}
/*}}}*/

/*{{{ Insight.parseGroupBy()*/
Insight.prototype.parseGroupBy = function(beg, end, sep, txt) {
  if (beg < 0) {
    this.begin = beg - 1;
    return [];
  }
  if (undefined == sep) {
    sep = {
      type: Lexter.types.COMMAS,
      text: ','
    };
  }
  var pos = 0,
      key = '',
      pre = null,
      tmp = [],
      ret = [];
  end = (end < 0) ? this.tokens.length: end;
  while (beg < end) {
    pos = this.lexter.indexOf(sep, beg);
    if (pos > end) {
      pos = - 1;
    }
    if (pos >= 0) {
      tmp = this.tokens.slice(beg, pos);
      beg = pos + 1;
    } else {
      tmp = this.tokens.slice(beg, end);
      beg = end;
    }

    if (tmp.length > 2) {
      var rt = [];
      for (var i = 0; i < tmp.length; i++) {
        if (!/^(group|by)$/i.test(tmp[i].text)) {
          rt.push(tmp[i]);
        }
      }
      ret.push(rt);
    } else {
      ret.push([tmp[0]]);
    }
  }
  this.begin = beg - 1;
  return ret;
}
/*}}}*/

/*{{{ Insight.parseOrderBy()*/
Insight.prototype.parseOrderBy = function(beg, end, sep, txt) {
  if (beg < 0) {
    this.begin = beg - 1;
    return [];
  }
  if (undefined == sep) {
    sep = {
      type: Lexter.types.COMMAS,
      text: ','
    };
  }
  var pos = 0,
      key = '',
      pre = null,
      tmp = [],
      ret = [];
  end = (end < 0) ? this.tokens.length: end;
  while (beg < end) {
    var define = false,
        value = ORDER.ASC;
    pos = this.lexter.indexOf(sep, beg);
    if (pos > end) {
      pos = - 1;
    }
    if (pos >= 0) {
      tmp = this.tokens.slice(beg, pos);
      beg = pos + 1;
    } else {
      tmp = this.tokens.slice(beg, end);
      beg = end;
    }
    define = true;
    if (tmp[tmp.length - 1].text.toLowerCase() == 'desc') {
      value = ORDER.DESC;
    } else if (tmp[tmp.length - 1].text.toLowerCase() == 'asc') {
      value = ORDER.ASC;
    } else {
      define = false;
    }
    if (define) {
      tmp.pop();
    }
    for (var i = 0; i < tmp.length; i++) {
      if (tmp[0].type == Lexter.types.KEYWORD && /^(order|by)$/i.test(tmp[0].text)) {
        tmp.shift();
      }
    }
    ret.push({
      type: value,
      expr: tmp,
    });
}
this.begin = beg - 1;
return ret;
}
/*}}}*/

/*{{{ Insight.parseLimit()*/
Insight.prototype.parseLimit = function(beg, end, sep, txt) {
  if (beg === 0) {
    this.begin = beg - 1;
    return [];
  }
  if (undefined == sep) {
    sep = {
      type: Lexter.types.COMMAS,
      text: ','
    };
  }
  var pos = 0,
      key = '',
      pre = null,
      tmp = [],
      ret = [];
  end = (end < 0) ? this.tokens.length: end;
  while (beg < end) {
    pos = this.lexter.indexOf(sep, beg);
    if (pos > end) {
      pos = - 1;
    }
    if (pos >= 0) {
      tmp = this.tokens.slice(beg, pos);
      beg = pos + 1;
    } else {
      tmp = this.tokens.slice(beg, end);
      beg = end;
    }
    for (var i = 0; i < tmp.length; i++) {
      ret.push(tmp[i]);
    }
  }
  if (ret.length == 1) {
    ret.unshift({
      text: 0,
      type: Lexter.types.NUMBER
    });
}
this.begin = beg - 1;
return ret;
}
/*}}}*/

/* {{{ private Insight._maps() */
Insight.prototype._maps = function(beg, end, sep, txt) {
  if (undefined == sep) {
    sep = {
      type: Lexter.types.COMMAS,
      text: ','
    };
  }

  var pos = 0,
      key = '',
      pre = null,
      tmp = [],
      ret = [];
  end = (end < 0) ? this.tokens.length: end;
  while (beg < end) {
    pos = this.lexter.indexOf(sep, beg);
    if (pos >= 0) {
      tmp = this.tokens.slice(beg, pos);
      beg = pos + 1;
    } else {
      tmp = this.tokens.slice(beg, end);
      beg = end;
    }

    pre = tmp[tmp.length - 2];
    if (undefined == pre) {
      pre = {
        type: Lexter.types.OPERATOR,
        text: '',
      };
    }
    if (pre.type == Lexter.types.KEYWORD && /^as$/i.test(pre.text)) {
      key = tmp[tmp.length - 1].text;
      pos = - 2;
    } else if (pre.type != Lexter.types.OPERATOR && true === this.ualias[tmp[tmp.length - 1].type]) {
      key = tmp[tmp.length - 1].text;
      if (tmp[0].type == Lexter.types.KEYWORD && /^(all|distinct|distinctrow)$/i.test(tmp[0].text)) {
        pos = 0;
      } else {
        pos = - 1;
      }
    } else {
      key = fetch('text', tmp);
      pos = 0;
    }

    if (0 == pos) {
      ret[key] = tmp;
    } else {
      ret[key] = tmp.slice(0, pos);
    }

    if (true == txt) {
      ret[key] = fetch('text', ret[key]);
    }
  }

  return ret;
}
/* }}} */

/* {{{ public Parser.construct() */
/**
 * 解析器构造函数
 * @param {String} sql 
 * @param {Object} val 
 */
var Parser = function(sql, val) {
  this.query = sql.toString().trim();
  this.param = val;
  this.result = null;
}
/* }}} */

/* {{{ public Parser.get() */
/**
 * 获取解析结果
 * @param  {String} key 取得解析结果的某部分
 * @return {Object}
 */
Parser.prototype.get = function(key) {
  if (!this.result) {
    this.result = new Insight(this.query).select();
  }
  if (undefined == key || '' == key) {
    return this.result;
  }
  return this.result[key];
}
/* }}} */

/*{{{ Parser.replaceTable()*/
Parser.prototype.replaceTable = function(from, to) {
  if (!this.result) {
    this.get();
  }
  for (var tk in this.result['tables']) {
    if (this.result['tables'][tk].table == from) {
      this.result['tables'][tk].table = to;
    }
  }
}
/*}}}*/

/*{{{ Parser.replaceWhere()*/
Parser.prototype.replaceWhere = function(from, to) {
  if (!this.result) {
    this.get();
  }
  var pto = 'select .. where ' + to;
  var tres = new Parser(pto);
  tres = tres.get('where');
  for (var tk in this.result['where']) {
    if (this.result['where'][tk].column.text == from) {
      delete this.result['where'][tk];
    }
  }
  this.result['where'] = this.result['where'].concat(tres);
  var newarr = [];
  for (var tmp in this.result['where']) {
    newarr.push(this.result['where'][tmp]);
  }
  this.result['where'] = newarr;
  delete tres;
}
/*}}}*/

exports.create = function(sql, data) {
  return new Parser(sql, data);
}

exports.WHERE = WHERE;
exports.ORDER = ORDER;

