var should = require('should');
var Select = require(__dirname + '/../../lib/parser/select.js');
var Lexter = require(__dirname + '/../../lib/parser/lexter.js');

describe('Select test',function(){
  
  /*{{{ throw exception when not begin with select */
  it("throw exception when not begin with select",function(done){
		try {
			var select = Select.create("`SELECT` 1 as b");
			select.get();
      true.should.not.be.ok;
		} catch(err) {
      true.should.be.ok;
      "SQL command should begin with keyword *SELECT*".should.eql(err.message);
		}
		done();
  });
  /*}}}*/

  /*{{{ parse right select column*/
  it("parse right select column",function(done){
		var select = Select.create('sElECt distiNct a, 1 b, 1+MD5("123") AS `select`, MAX(d), DistInct user.username');
    var eql = {
      'a' : {
        dist : { text: 'distiNct', type: 1 },
        expr: [{
          text: 'a',
          type: 1
        }]
      },
      'b' : {
        dist: null,
        expr: [{
          text: 1,
          type: 2
        }]
      },
      'select' : {
        dist: null,
        expr: [{
          text: 1,
          type: 2
        },
        {
          text: '+',
          type: 7
        },
        {
          text: 'MD5',
          type: 4
        },
        {
          text: '(',
          type: 8
        },
        {
          text: '123',
          type: 3
        },
        {
          text: ')',
          type: 8
        }]
      },
      'MAX(d)' : {
        dist: null,
        expr: [{
          text: 'MAX',
          type: 4
        },
        {
          text: '(',
          type: 8
        },
        {
          text: 'd',
          type: 1
        },
        {
          text: ')',
          type: 8
        }]
      },
      'username' : {
        dist: {
          text: 'DistInct',
          type: 1
        },
        expr: [{
          text: 'user.username',
          type: 1
        }]
      }
    }
    select.get('columns').should.eql(eql);
		done();
  });
  /*}}}*/

  /*{{{ parse right table*/
  it("parse right table",function(done){
		var sql = Select.create('SELECT .. FROM mysql.tableA As a, tableB b, c WHERE ..... ORDER BY bbbb ...');
    var eql = {
      'a' : {
        db: 'mysql',
        table: 'tableA'
      },
      'b' : {
        db: '',
        table: 'tableB'
      },
      'c' : {
        db: '',
        table: 'c'
      }
    }
    sql.get("tables").should.eql(eql);
    done();
  });
  /*}}}*/
  
  /*{{{ parse right join*/
  it("parse right join",function(done){
		var sql = Select.create('SELECT a.c1, b.c2 FROM a LEFT JOIN b ON a.c3=b.c3 AND a.c4=b.c4 JOIN db.tab_c as c ON c.id=a.c2');
    sql.get('joinmap').b.should.eql({
			table: 'b',
			method: 'LEFT JOIN',
			where: 'a.c3 = b.c3 AND a.c4 = b.c4'
    });
    sql.get('joinmap').c.should.eql({
			table: 'db.tab_c',
			method: 'JOIN',
			where: 'c.id = a.c2'
    });
		done();
  });
  /*}}}*/

  /*{{{ parse right where*/
  it("parse right where",function(done){
		var sql = Select.create('SelEcT * FROM table WHERE a=b AND c >= "id" AND thedate BETWEEN (100 AND 200) AND t IN (2,5,"6") and m LIKE "%abc%" AND 1 <> 2 AND d is not null AND p NOT LIKE "8" AND db.table.x NOT IN (2) AND z is null');
    var eql = [
      {
        relate: Select.WHERE.EQ,
        values: [{text: 'b',type: 1}],
        column: {text: 'a',type: 1}
      },
      {
        relate: Select.WHERE.GE,
        values: [{text: 'id',type: 3}],
        column: {text: 'c',type: 1}
      },
      {
        relate: Select.WHERE.BETWEEN,
        values: [{text: 100,type: 2},{text: 200,type: 2}],
        column: {text: 'thedate',type: 1}
      },
      {
        relate: Select.WHERE.IN,
        values: [{text: 2,type: 2},{text: 5,type: 2},{text: '6',type: 3}],
        column: {text: 't',type: 1}
      },
      {
        relate: Select.WHERE.LIKE,
        values: [{text: '%abc%',type: 3}],
        column: {text: 'm',type: 1}
      },
      {
        relate: Select.WHERE.NE,
        values: [{text: 2,type: 2}],
        column: {text: 1,type: 2}
      },
      {
        relate: Select.WHERE.NOTNULL,
        values: null,
        column: {text: 'd',type: 1}
      },
      {
        relate: Select.WHERE.NOTLIKE,
        values: [{text: '8',type: 3}],
        column: {text: 'p',type: 1}
      },
      {
        relate: Select.WHERE.NOTIN,
        values: [{text: 2,type: 2}],
        column: {text: 'db.table.x',type: 1}
      },
      {
        relate: Select.WHERE.ISNULL,
        values: null,
        column: {text: 'z',type: 1}
      }
    ]
    sql.get('where').should.eql(eql);
		done();
  });
  /*}}}*/

  /*{{{ parse right groupby*/
  it("parse right groupby",function(done){
		var sql = Select.create('SELECT * FROM table gRouP by c, CONCAT(`status`, "wo")');
    var eql = [
      [{text: 'c',type: 1}],
      [
        {text: 'CONCAT',type: 4},
        {text: '(',type: 8},
        {text: 'status',type: 5},
        {text: ',',type: 8},
        {text: 'wo',type: 3},
        {text: ')',type: 8},
      ]
    ]
    sql.get('groupby').should.eql(eql);
		done();
  });
  /*}}}*/

  /*{{{ parse right orderby*/
  it("parse right orderby",function(done){
		var sql = Select.create('SELECT * FROM tab ORDER BY a DESC, MD5(b), c ASC');
    var eql = [
      {
        type: 2,
        expr: [{text: 'a',type: 1}]
      },
      {
			type: 1,
			expr: [{text: 'MD5',type: 4},{text: '(',type: 8},{text: 'b',type: 1},{text: ')',type: 8}]
      },
      {
        type: 1,
        expr: [{text: 'c',type: 1}]
      }
    ]
    sql.get('orderby').should.eql(eql);
		done();
  });
  /*}}}*/
  
  /*{{{ parse right limit*/
  it("parse right limit",function(done){
		var sql = Select.create('Select * from asldf LIMIT 10');
    var eql = [
      {text: 0,type: 2},
      {text: 10,type: 2}
    ]
    sql.get("limits").should.eql(eql);
		done();
  });
  /*}}}*/

  /*{{{ replace works fine*/
  it("replace works fine",function(done){
		var sql = Select.create('SELECT a.c1, b.c2 FROM a LEFT JOIN b ON a.c3=b.c3 AND a.c4=b.c4 WHERE a.c1 = 2 AND a.c1 > 1 AND b.c2 = 0');

		sql.replaceWhere('a.c1', "a.c4 = 5 AND a.pid = '01'");
		sql.replaceTable('a', 'new_b');

    var eql = [
      {
        relate: 1,
        values: [{text: 0,type: 2}],
        column: {text: 'b.c2',type: 1}
      },
      {
        relate: 1,
        values: [{text: 5,type: 2}],
        column: {text: 'a.c4',type: 1}
      },
      {
        relate: 1,
        values: [{text: '01',type: 3}],
        column: {text: 'a.pid',type: 1}
      }
    ]
    sql.get('where').should.eql(eql);
    sql.get('tables').a.table.should.eql("new_b");
		done();
  });
  /*}}}*/

  /*{{{parse right elements*/
  it("parse right elements",function(done){
		var sql = Select.create('SELECT brand_id,SUM(collector_num) from rpt_brand_buyer_area_d where thedate = "2010-10-10" and brand_id = "10122" and category_id = "110520" limit 6');
    var res = '';
    for(var tk in sql.get()){
        res += tk + ',';
    }
    res = res.substr(0,res.length-2);
    res.should.eql('columns,tables,joinmap,where,groupby,orderby,limit');
		done();
  });
  /*}}}*/

})
