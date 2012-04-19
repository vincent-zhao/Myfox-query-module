var should = require("should");
var parse = require(__dirname + '/../../lib/parse');
var sep = String.fromCharCode('\x01');
var q  = require('querystring');

describe("Parse test",function(){
  
  /*{{{ old plus request*/
  it("old plus request",function(done){
    var req = "sql=SELECT+a.category_id+AS+f1+FROM+rpt_cat_info_d+a++WHERE+thedate+%3D+'2010-10-10'+limit+1";
    var expect = { 
      readCache : true,
      writeCache : true,
      isDebug: false,
      explain: false,
      mode: 'sqlMode',
      sql: 'SELECT a.category_id AS f1 FROM rpt_cat_info_d a WHERE thedate = \'2010-10-10\' limit 1',
      params: ""
    };
    parse(req).should.eql(expect);
    done();
  });
  /*}}}*/

  /*{{{ test old encode request*/
  it("test old encode request",function(done){
    var req = "sql=SELECT%20a.category_id%20AS%20f1%20FROM%20rpt_cat_info_d%20a%20%20WHERE%20thedate%20%3D%20'2010-10-10'%20limit%201";
    var expect = { 
      readCache : true,
      writeCache : true,
      isDebug: false,
      explain: false,
      mode: 'sqlMode',
      sql: 'SELECT a.category_id AS f1 FROM rpt_cat_info_d a WHERE thedate = \'2010-10-10\' limit 1',
      params: ""
    };
    parse(req).should.eql(expect);
    done();
  });
  /*}}}*/

  /*{{{ test new request1*/
  it("test new request1",function(done){
    var req = "true"+sep+"false"+sep+"true"+sep+"true"+"\r\nsqlMode\r\nselect * from dim_category limit 10";
    var expect = {
      readCache : true,
      writeCache : false,
      isDebug: true,
      explain: false,
      mode: 'sqlMode',
      sql: 'select * from dim_category limit 10',
      params: undefined
    };
    parse(req).should.eql(expect);
    done();
  });
  /*}}}*/

  /*{{{ test new requestr2*/
  it("test new request2",function(done){
    var req = "false"+sep+"true"+sep+"false"+sep+"false"+"\r\nsqlMode\r\nselect * from dim_category limit 10";
    var expect = {
      readCache : false,
      writeCache : true,
      isDebug: false,
      explain: false,
      mode: 'sqlMode',
      sql: 'select * from dim_category limit 10',
      params: undefined
    };
    parse(req).should.eql(expect);
    done();
  });
  /*}}}*/

});
