var should = require('should');
var Decare = require(__dirname + "/../../lib/decare");

describe("Decare test",function(){
  
  /*{{{ normal decare test*/
  it("normal decare test",function(done){
		var decare = Decare.create();
		decare.register("age",[1,2,3]);
		decare.register("sex",["F","M"]);
		decare.register("name",["a","b","c","d"]);
		decare.register("hair",["blue","red"]);
		decare.unregister("hair");
		var res = decare.cal();
		var expect = [];
		var t1 = [];t1["age"] = 1;t1["sex"] = "F";t1["name"] = "a";expect.push(t1);
		var t2 = [];t2["age"] = 1;t2["sex"] = "F";t2["name"] = "b";expect.push(t2);
		var t3 = [];t3["age"] = 1;t3["sex"] = "F";t3["name"] = "c";expect.push(t3);
		var t4 = [];t4["age"] = 1;t4["sex"] = "F";t4["name"] = "d";expect.push(t4);
		var t5 = [];t5["age"] = 1;t5["sex"] = "M";t5["name"] = "a";expect.push(t5);
		var t6 = [];t6["age"] = 1;t6["sex"] = "M";t6["name"] = "b";expect.push(t6);
		var t7 = [];t7["age"] = 1;t7["sex"] = "M";t7["name"] = "c";expect.push(t7);
		var t8 = [];t8["age"] = 1;t8["sex"] = "M";t8["name"] = "d";expect.push(t8);
		var t9 = [];t9["age"] = 2;t9["sex"] = "F";t9["name"] = "a";expect.push(t9);
		var t10 = [];t10["age"] = 2;t10["sex"] = "F";t10["name"] = "b";expect.push(t10);
		var t11 = [];t11["age"] = 2;t11["sex"] = "F";t11["name"] = "c";expect.push(t11);
		var t12 = [];t12["age"] = 2;t12["sex"] = "F";t12["name"] = "d";expect.push(t12);
		var t13 = [];t13["age"] = 2;t13["sex"] = "M";t13["name"] = "a";expect.push(t13);
		var t14 = [];t14["age"] = 2;t14["sex"] = "M";t14["name"] = "b";expect.push(t14);
		var t15 = [];t15["age"] = 2;t15["sex"] = "M";t15["name"] = "c";expect.push(t15);
		var t16 = [];t16["age"] = 2;t16["sex"] = "M";t16["name"] = "d";expect.push(t16);
		var t17 = [];t17["age"] = 3;t17["sex"] = "F";t17["name"] = "a";expect.push(t17);
		var t18 = [];t18["age"] = 3;t18["sex"] = "F";t18["name"] = "b";expect.push(t18);
		var t19 = [];t19["age"] = 3;t19["sex"] = "F";t19["name"] = "c";expect.push(t19);
		var t20 = [];t20["age"] = 3;t20["sex"] = "F";t20["name"] = "d";expect.push(t20);
		var t21 = [];t21["age"] = 3;t21["sex"] = "M";t21["name"] = "a";expect.push(t21);
		var t22 = [];t22["age"] = 3;t22["sex"] = "M";t22["name"] = "b";expect.push(t22);
		var t23 = [];t23["age"] = 3;t23["sex"] = "M";t23["name"] = "c";expect.push(t23);
		var t24 = [];t24["age"] = 3;t24["sex"] = "M";t24["name"] = "d";expect.push(t24);
    res.should.eql(expect);
		done();
  })
  /*}}}*/

});
