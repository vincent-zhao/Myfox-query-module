var should = require("should");
var Column = require(__dirname + "/../../lib/column");
var Lexter = require(__dirname + "/../../lib/parser/lexter");

describe("Column Test",function(){
  beforeEach(function(){
    Column.init();
  });

  describe("reform()",function(){
    
    /*{{{ test reform max */
    it("test reform max",function(done){
      var column1 = Column.NEW_COLUMN_PREFIX+"1";
      var column2 = Column.NEW_COLUMN_PREFIX+"2";
      
      var lexter = Lexter.create("1+MAX(b)+2");
      Column.build(lexter.getAll(),"f1");
      
      lexter = Lexter.create("CouNt(*)");
      Column.build(lexter.getAll(),"f2");
      
      var expect = ["MAX(b) AS "+column1,"COUNT(*) AS "+column2];
      var groups = [];
      Column.getAll(groups).should.eql(expect);
      groups.should.eql([]);
      expect = {};
      expect[column1] = {
        expr : "",
        merge : Column.REFORM_MAX,
        hide : true
      };
      expect["f1"] = {
        expr : "1+"+column1+"+2",
        merge : null,
        hide : false
      };
      expect[column2] = {
        expr : "",
        merge : Column.REFORM_SUM,
        hide : true
      };
      expect["f2"] = {
        expr : column2,
        merge : null,
        hide : false
      };
      Column.transform().should.eql(expect);
      done();
    });
    /*}}}*/

    /*{{{ test reform avg */
    it("test reform avg",function(done){
      var column1 = Column.NEW_COLUMN_PREFIX+"1";
      var column2 = Column.NEW_COLUMN_PREFIX+"2";
      
      var lexter = Lexter.create("AVG(a+b+(100/c))+6");
      Column.build(lexter.getAll(),"f1");
      var expect = ["SUM(a+b+(100/c)) AS "+column1,"COUNT(a+b+(100/c)) AS "+column2];
      var groups = [];
      Column.getAll(groups).should.eql(expect);
      groups.should.eql([]);
      expect = [];
      expect[column1] = {
        expr : "",
        merge : Column.REFORM_SUM,
        hide : true,
      };
      expect[column2] = {
        expr : "",
        merge : Column.REFORM_SUM,
        hide : true
      };
      expect["f1"] = {
        expr : column1+" / "+column2+"+6",
        merge : null,
        hide : false
      };
      Column.transform().should.eql(expect);
      done();
    });
    /*}}}*/

    /*{{{ test reform multi grp*/
    it("test reform multi grp",function(done){
      var column1 = Column.NEW_COLUMN_PREFIX+"1";
      var lexter = Lexter.create("SQRT(SUM(gmv_trade_num) * LOG(10,SUM(gmv_trade_num)))");
      Column.build(lexter.getAll(),"f1");
      var groups = [];
      Column.getAll(groups).should.eql(["SUM(gmv_trade_num) AS "+column1]);
      groups.should.eql([]);
      var expect = [];
      expect[column1] = {
        expr : "",
        merge : Column.REFORM_SUM,
        hide : true
      };
      expect["f1"] = {
        expr : "SQRT("+column1+"*LOG(10,"+column1+"))",
        merge : null,
        hide : false
      };
      Column.transform().should.eql(expect);
      
      lexter = Lexter.create("thedate");
      Column.build(lexter.getAll(),"thedate");
      groups = [];
      Column.getAll(groups).should.eql(["SUM(gmv_trade_num) AS "+column1,"thedate"]);
      groups.should.eql(["thedate"]);
      done();
    });
    /*}}}*/

    /*{{{ test reform column with string*/
    it("test reform column with string",function(done){
      var lexter = Lexter.create("DATEFORMAT(thedate, \'%Y-%m-%d\')");
      Column.build(lexter.getAll(),"f1");

      Column.build(lexter.getAll(),"f2");
      var groups = [];
      Column.getAll(groups).should.eql(["DATEFORMAT(thedate,\'%Y-%m-%d\') AS f1"]);
      groups.should.eql([]);
      var expect = [];
      expect["f1"] = {
        expr : "",
        merge : null,
        hide : false
      };
      expect["f2"] = {
        expr : "f1",
        merge : null,
        hide : false
      };
      Column.transform().should.eql(expect);
      done();
    });
    /*}}}*/

  })
});
