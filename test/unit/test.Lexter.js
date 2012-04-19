var should = require('should');
var Lexter	= require(__dirname + '/../../lib/parser/lexter.js');

describe("Lexter test",function(){
  
  /*{{{ test simple select with comment parse*/
  it("test simple select with comment parse",function(done){
		var lexter	= Lexter.create(
			"SELECT /** 我是注释 **/ 123, `password`, MD5(\"123456\") FROM mysql.user WHERE user=\"测试\\\"引号\" AND host!='%'"
		);
    var eql = [
			{'text'	: 'SELECT', 'type' : Lexter.types.KEYWORD},
			{'text'	: '我是注释', 'type' : Lexter.types.COMMENT},
			{'text'	: 123, 'type' : Lexter.types.NUMBER},
			{'text'	: ',', 'type' : Lexter.types.COMMAS},
			{'text'	: 'password', 'type' : Lexter.types.VARIABLE},
			{'text'	: ',', 'type' : Lexter.types.COMMAS},
			{'text'	: 'MD5', 'type' : Lexter.types.FUNCTION},
			{'text'	: '(', 'type' : Lexter.types.COMMAS},
			{'text'	: '123456', 'type' : Lexter.types.STRING},
			{'text'	: ')', 'type' : Lexter.types.COMMAS},
			{'text'	: 'FROM', 'type' : Lexter.types.KEYWORD},
			{'text'	: 'mysql.user', 'type' : Lexter.types.KEYWORD},
			{'text'	: 'WHERE', 'type' : Lexter.types.KEYWORD},
			{'text'	: 'user', 'type' : Lexter.types.KEYWORD},
			{'text'	: '=', 'type' : Lexter.types.OPERATOR},
			{'text'	: '测试"引号', 'type' : Lexter.types.STRING},
			{'text'	: 'AND', 'type' : Lexter.types.KEYWORD},
			{'text'	: 'host', 'type' : Lexter.types.KEYWORD},
			{'text'	: '!=', 'type' : Lexter.types.OPERATOR},
			{'text'	: '%', 'type' : Lexter.types.STRING},
		];
    lexter.getAll().should.eql(eql);
		done();
  });
  /*}}}*/

  /*{{{ test negative number be parsed */
  it("test negative number be parsed",function(done){
    var lexter  = Lexter.create('SELECT a, c-1 FROM table WHERE b=-2');
    var eql = [
      {text : 'SELECT', type : Lexter.types.KEYWORD},
      {text : 'a', type : Lexter.types.KEYWORD},
      {text : ',', type : Lexter.types.COMMAS},
      {text : 'c', type : Lexter.types.KEYWORD},
      {text : -1, type : Lexter.types.NUMBER},
      {text : 'FROM', type : Lexter.types.KEYWORD},
      {text : 'table', type : Lexter.types.KEYWORD},
      {text : 'WHERE', type : Lexter.types.KEYWORD},
      {text : 'b', type : Lexter.types.KEYWORD},
      {text : '=', type : Lexter.types.OPERATOR},
      {text : -2, type : Lexter.types.NUMBER},
    ];
    lexter.getAll().should.eql(eql);
    done();
  });
  /*}}}*/

    /*{{{ test parse bind variable */
    it("test parse bind variable",function(done){
      var lexter  = Lexter.create('c=:id AND t=:V_1');
      var eql = [
        {text : 'c', type : Lexter.types.KEYWORD},
        {text : '=', type : Lexter.types.OPERATOR},
        {text : ':id', type : Lexter.types.PARAMS},
        {text : 'AND', type : Lexter.types.KEYWORD},
        {text : 't', type : Lexter.types.KEYWORD},
        {text : '=', type : Lexter.types.OPERATOR},
        {text : ':V_1', type : Lexter.types.PARAMS},
      ];
      lexter.getAll().should.eql(eql);
      done();
    });
    /*}}}*/

    /*{{{ test number be parsed*/
    it("test number be parsed",function(done){
      var lexter  = Lexter.create(123402);
      var eql = [
        {text : 123402, type : Lexter.types.NUMBER}
      ];
      lexter.getAll().should.eql(eql);
      done();
    });
    /*}}}*/

    /*{{{ test expression parsed ok */
    it("test expression parsed ok",function(done){
      var lexter  = Lexter.create('1+2*3.783/ABS(-3.6)');
      var eql = [
        {text : 1, type : Lexter.types.NUMBER},
        {text : '+', type : Lexter.types.OPERATOR},
        {text : 2, type : Lexter.types.NUMBER},
        {text : '*', type : Lexter.types.OPERATOR},
        {text : 3.783, type : Lexter.types.NUMBER},
        {text : '/', type : Lexter.types.OPERATOR},
        {text : 'ABS', type : Lexter.types.FUNCTION},
        {text : '(', type : Lexter.types.COMMAS},
        {text : -3.6, type : Lexter.types.NUMBER},
        {text : ')', type : Lexter.types.COMMAS},
      ];
      lexter.getAll().should.eql(eql);
      done();
    });
    /*}}}*/

    /*{{{ test token index of */
    it("test token index of",function(done){
      var lexter  = Lexter.create('1+2*3.783/ABS(x + 3.6) + y');
      var commas  = {
        type    : Lexter.types.OPERATOR,
        text    : '+'
      };

      lexter.indexOf(commas).should.eql(1);
      lexter.indexOf(commas,1).should.eql(12);

      // xxx: x 后边的+号不应该被识别出

      lexter.indexOf(commas,8).should.eql(12);
      lexter.indexOf(commas,12).should.eql(-1);

      // xxx: 正则表达式匹配
      lexter.indexOf({
        type    : Lexter.types.FUNCTION,
        text    : 'a',
      }).should.eql(6);

      lexter.indexOf({
        type    : Lexter.types.FUNCTION,
        text    : '^a$',
      }).should.eql(-1);

      done();
    });
    /*}}}*/

    /*{{{ test get operator vars */
    it("test get operator vars",function(done){
      var lexter = Lexter.create("-1+v+FUNCTION(a,FUNC2(b))");
      var expect = [
        {text:-1,type:Lexter.types.NUMBER},
        {text:"v",type:Lexter.types.KEYWORD}
      ];
      Lexter.vars(1,"-1+v+FUNCTION(a,FUNC2(b))",true).should.eql(expect);
      expect = [
        [{text:"a",type:Lexter.types.KEYWORD}],
        [{text:"FUNC2",type:Lexter.types.FUNCTION},
         {text:"(",type:Lexter.types.COMMAS},
         {text:"b",type:Lexter.types.KEYWORD},
         {text:")",type:Lexter.types.COMMAS}]
      ];
      Lexter.vars(4,lexter.getAll(),false).should.eql(expect);
      expect = [
        [{text:"b",type:Lexter.types.KEYWORD}]
      ];
      Lexter.vars(8,lexter.getAll(),false).should.eql(expect);
      done();
    });
    /*}}}*/
    
    /*{{{ test get text*/
    it("test get text",function(done){
      var t = [
        {type:Lexter.types.FUNCTION,text:"ABS"},
        {type:Lexter.types.COMMAS,text:"("},
        {type:Lexter.types.NUMBER,text:-3.6},
        {type:Lexter.types.STRING,text:")"},
        {type:Lexter.types.STRING,text:true},
        {type:Lexter.types.STRING,text:123},
        {type:Lexter.types.STRING,text:"\nA\0B\rC\bD\tE"},
      ];
      Lexter.text(t," OR ").join("").should.eql("ABS OR ( OR -3.6 OR \')\' OR true OR 123 OR \'\\nA\\0B\\rC\\bD\\tE\'");
      done();
    });
    /*}}}*/

});
