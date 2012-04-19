var should = require('should');
var QuickEval = require(__dirname + "/../../lib/quickeval");
var Lexter = require(__dirname + "/../../lib/parser/lexter");

describe("QuickEval test",function(){

  /*{{{ test normal quick eval*/
  it("test normal quick eval",function(done){
		var e = QuickEval.create("2");
    e.execute().should.eql(2);
		e = QuickEval.create("((((((1%3)&(0|1))||0)&&1) << 2)>>1)");
    e.execute().should.eql(2);
		e = QuickEval.create("(4>=2)&&(5>4)&&(1<2)&&(2<=3)");
    e.execute().should.eql(1);
		e = QuickEval.create("1+2*3.6/(-2)");
    e.execute().should.eql(-2.6);
		e = QuickEval.create("1+x");
    e.execute({x:1.4}).should.eql(2.4);
		var e = QuickEval.create("x-2");
    e.execute({x:3}).should.eql(1);
		e = QuickEval.create("1+ROUND(x,1)");
    e.execute({x:1.4999}).should.eql(2.5);
		e = QuickEval.create("ABS(-1)");
    e.execute().should.eql(1);
		e = QuickEval.create("CEIL(x+1.5)");
    e.execute({x:1}).should.eql(3);
		e = QuickEval.create("FLOOR(1.5)");
    e.execute().should.eql(1);
		e = QuickEval.create("EXP(1.5)");
    e.execute().should.eql(4.4816890703380645);
		e = QuickEval.create("SQRT(4)");
    e.execute().should.eql(2);
		e = QuickEval.create("SIN(3)");
    e.execute().should.eql(0.1411200080598672);
		e = QuickEval.create("COS(3)");
    e.execute().should.eql(-0.9899924966004454);
		e = QuickEval.create("MD5(\"abc\")");
    e.execute().should.eql("900150983cd24fb0d6963f7d28e17f72");
		e = QuickEval.create("INT(3)");
    e.execute().should.eql(3);
		e = QuickEval.create("LN(10)");
    e.execute().should.eql(2.302585092994046);
		e = QuickEval.create("LOG(100)");
    e.execute().should.eql(2);
		e = QuickEval.create("LENGTH(\"abab\")");
    e.execute().should.eql(4);

		e = QuickEval.create([
			{
				type : Lexter.types.NUMBER,
				text : 1
			},
			{
				type : Lexter.types.OPERATOR,
				text : "+"
			},
			{
				type : Lexter.types.VARIABLE,
				text : "ABS(c)"
			}
		]);
    e.execute({"ABS(c)":1}).should.eql(2);
		done();
  });
  /*}}}*/

    /*{{{ test throw exception when undefined function */
    it("test throw exception when undefined function",function(done){
      try{
        var e = QuickEval.create("I_AM_NOT_EXISTS(1)");
        e.execute();
      }catch(e){
        "Undefined function named as \"I_AM_NOT_EXISTS\"".should.eql(e.message);
        done();
      }
    });
    /*}}}*/

    /*{{{ test operator after function*/
    it("test operator after function",function(done){
      var e = QuickEval.create("POW(2, 4 - ( 100 + tfix ) / 100) - 1");
      e.execute({tfix:100}).should.eql(3);
      var e2 = QuickEval.create("POW(2, 4-(100+tfix)/100)-1");
      e2.execute({tfix:100}).should.eql(3);
      done();
    });
    /*}}}*/

    /*{{{ test compare operate */
    it("test compare operate",function(done){
      var e = QuickEval.create("IF(version >= 2, 0, 1)");
      e.execute({version:2}).should.eql(0);
      e.execute({version:1}).should.eql(1);
      done();
    });
    /*}}}*/

});
