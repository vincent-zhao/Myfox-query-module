var should = require('should');
var LCache = require(__dirname + '/../../lib/cache/lcache');

describe('Lcache unit test',function(){

  /*{{{ set values into lcache*/
  it("set values into lcache",function(done){
    var lc = LCache.create(5);
    lc.set("k1","v1");
    lc.set("k2","v2");
    lc.set("k3","v3");
    var eql = 
    [
        {"key":"k1","value":"v1"},
        {"key":"k2","value":"v2"},
        {"key":"k3","value":"v3"},
    ];
    (lc.buffer).should.eql(eql);
    done();
  });
  /*}}}*/

  /*{{{ get from lcache ok*/
  it("get from lcache ok",function(done){
    var lc = LCache.create(5);
    lc.set("k1","v1");
    lc.set("k2","v2");
    lc.set("k3",{v:"k3"});
    lc.get("k2").should.eql("v2");
    lc.get("k3").should.eql({v:"k3"});
    var eql = 
    [
        {"key":"k2","value":"v2"},
        {"key":"k3","value":{v:"k3"}},
        {"key":"k1","value":"v1"},
    ];
    (lc.buffer).should.eql(eql);
    done();
  });
  /*}}}*/

  /*{{{ set into full lcache*/
  it("set into full lcache",function(done){
    var lc = LCache.create(5);
    lc.set("k1","v1");
    lc.set("k2","v2");
    lc.set("k3","v3");
    lc.set("k4","v4");
    lc.set("k5","v5");
    lc.set("k6","v6");
    var eql = 
    [
      {"key":"k1","value":"v1"},
      {"key":"k2","value":"v2"},
      {"key":"k3","value":"v3"},
      {"key":"k4","value":"v4"},
      {"key":"k6","value":"v6"},
    ];
    (lc.buffer).should.eql(eql);
    done();
  });
  /*}}}*/

  /*{{{ clean cache*/
  it("clean cache",function(done){
    var lc = LCache.create(5);
    lc.set("k1","v1");
    lc.set("k2","v2");
    lc.set("k3","v3");
    lc.clean();
    (lc.buffer).should.eql([]);
    done();
  });
  /*}}}*/

})
