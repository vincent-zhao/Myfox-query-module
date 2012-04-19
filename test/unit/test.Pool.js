var should = require('should');
var mpool	= require(__dirname + '/../../lib/pool.js');

describe("Pool test",function(){
  
  /*{{{ test default mpool callbacks*/
  it("test default mpool callbacks",function(done){
    var mp	= mpool.create(2);

    mp.conn.should.eql([true,true]);
    mp.stack.should.eql([0,1]);
    mp.queue.should.eql([]);

    mp.get(function(conn, pos) {
      mp.stack.should.eql([0]);
      mp.conn.should.eql([true,true]);

      // xxx: 故意不释放, 测试下一个get
      //mp.release(pos);
      mp.stack.should.eql([0]);
    });

    mp.get(function(conn, pos) {
      mp.stack.should.eql([]);
      mp.conn.should.eql([true,true]);
      mp.release(pos);
      mp.stack.should.eql([0]);
    });

    mp.close(function() {
      mp.conn.should.eql([]);
      mp.stack.should.eql([]);
      mp.queue.should.eql([]);
      done();
    });
  });
  /*}}}*/

  /*{{{ test self mpool callback*/
  it("test self mpool callback",function(done){
    var num = 0;
    var mp	= mpool.create(2,
    {
      conn    : function() {return ++num;},
      close   : function(rs) {return --num;},
    });

    num.should.eql(2);

    mp.close(function() {
      num.should.eql(0)
      done();
    });
  })
  /*}}}*/

})
