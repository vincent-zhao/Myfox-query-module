var should = require('should');
var DataMerge = require(__dirname + "/../../lib/datamerge");
var Util = require('util');

describe("DataMerge test",function(){
  
  /*{{{ test push and sort*/
  it("test push and sort",function(done){
		var arr1 = [
			{a:3,b:1,c:1},
			{a:2,b:2,c:2},
			{a:1,b:2,c:3},
		];
		var arr2 = [
			{a:423,b:0,c:4},
			{a:3,b:1,c:5},
			{a:1,b:223,c:6}
		];
		var arr3 = [
			{a:423,b:0,c:7},
			{a:32,b:14,c:8},
			{a:2,b:200,c:9}
		];
		var arr4 = [
			{a:4,b:6,c:10},
			{a:4,b:9,c:14},
			{a:2,b:200,c:12}
		];
		var arr5 = [
			{a:6,b:6,c:13},
			{a:4,b:9,c:11},
			{a:3,b:15,c:15}
		];
		var sort = DataMerge.create();
		sort.push(arr1);
		sort.push(arr2);
		sort.push(arr3);
		sort.push(arr4);
		sort.push(arr5);
		sort.setSortKey({a:"DESC",b:"DESC",c:"ASC"});
		sort.setLimit(2,8);
		var expect = [
//			{a:423,b:0,c:4},
//			{a:423,b:0,c:7},
			{a:32,b:14,c:8},
			{a:6,b:6,c:13},
			{a:4,b:9,c:11},
			{a:4,b:9,c:14},
			{a:4,b:6,c:10},
			{a:3,b:15,c:15},
			{a:3,b:1,c:1},
			{a:3,b:1,c:5},
//			{a:2,b:200,c:9},
//			{a:2,b:200,c:12},
//			{a:2,b:2,c:2},
//			{a:1,b:223,c:6},
//			{a:1,b:2,c:3},
		];
    sort.getData();

    sort.getData().should.eql(expect);
		done();
  });
  /*}}}*/

  /*{{{ test max min sum with group by */
  it("test max min sum with group by",function(done){
		var data1 = [
			{a:1,b:2,c:3,d:4,e:5,f:"a"},
			{a:2,b:2,c:4,d:5,e:3,f:"b"},
			{a:2,b:9,c:4,d:5,e:13,f:"c"},
			{a:2,b:10,c:4,d:5,e:-6,f:"d"},
			{a:2,b:11,c:4,d:5,e:5,f:"e"},
			{a:2,b:12,c:4,d:5,e:1,f:"f"},
			{a:2,b:13,c:4,d:5,e:6,f:"g"},
			{a:2,b:14,c:4,d:5,e:-3,f:"h"},
		];
		var data2 = [
			{a:1,b:2,c:1,d:9,e:-1,f:"i"},
			{a:2,b:3,c:4,d:5,e:3,f:"j"},
			{a:2,b:4,c:4,d:5,e:0,f:"k"},
			{a:2,b:5,c:4,d:5,e:5,f:"l"},
			{a:2,b:6,c:4,d:5,e:2,f:"m"},
			{a:2,b:7,c:4,d:5,e:8,f:"n"},
			{a:2,b:8,c:4,d:5,e:5,f:"o"},
		];
		var merge = DataMerge.create();
		merge.push(data1);
		merge.push(data2);
		merge.setGroupBy(["a","b"]);
		merge.setMerge({
			c:DataMerge.REFORM_MIN,
			d:DataMerge.REFORM_MAX,
			e:DataMerge.REFORM_SUM,
			f:DataMerge.REFORM_CONCAT,
		});
    var expect =
      [ { a: 1, b: 2, c: 1, d: 9, e: 4 ,f:"a,i"},
        { a: 2, b: 2, c: 4, d: 5, e: 3 ,f:"b"},
        { a: 2, b: 9, c: 4, d: 5, e: 13 ,f:"c"},
        { a: 2, b: 10, c: 4, d: 5, e: -6 ,f:"d"},
        { a: 2, b: 11, c: 4, d: 5, e: 5 ,f:"e"},
        { a: 2, b: 12, c: 4, d: 5, e: 1 ,f:"f"},
        { a: 2, b: 13, c: 4, d: 5, e: 6 ,f:"g"},
        { a: 2, b: 14, c: 4, d: 5, e: -3 ,f:"h"},
        { a: 2, b: 3, c: 4, d: 5, e: 3 ,f:"j"},
        { a: 2, b: 4, c: 4, d: 5, e: 0 ,f:"k"},
        { a: 2, b: 5, c: 4, d: 5, e: 5 ,f:"l"},
        { a: 2, b: 6, c: 4, d: 5, e: 2 ,f:"m"},
        { a: 2, b: 7, c: 4, d: 5, e: 8 ,f:"n"},
        { a: 2, b: 8, c: 4, d: 5, e: 5 ,f:"o"} ];

    merge.getData().should.eql(expect);
		merge.setLimit(1,2);

		expect = 
      [ { a: 2, b: 2, c: 4, d: 5, e: 3 , f: "b"},
        { a: 2, b: 9, c: 4, d: 5, e: 13, f: "c"} ];

    merge.getData().should.eql(expect);
		merge.setSortKey({e:"ASC",b:"DESC"});
    merge.setHidden({d:true,f:false});
		merge.setLimit(-1,2);

		expect = 
    [ 
      { a: 2, b: 10, c: 4, e: -6, f: "d" },
      { a: 2, b: 14, c: 4, e: -3, f: "h" },
    ];

    merge.getData().should.eql(expect);
		
		done();
  });
  /*}}}*/

  /*{{{ test max min sum without group by */
  it("test max min sum without group by",function(done){
		var data1 = [{c:1,d:4,e:5}];
		var data2 = [{c:1,d:9,e:-1}];
		var merge = DataMerge.create();
		merge.push(data1);
		merge.push(data2);
		merge.setMerge({
			c:DataMerge.REFORM_MIN,
			d:DataMerge.REFORM_MAX,
			e:DataMerge.REFORM_SUM
		});
    merge.getData().should.eql([{c:1,d:9,e:4}]);
		done();
  });
  /*}}}*/

  /*{{{ test_sort_with_expression */
  it("test_sort_with_expression",function(done){
		var data1 = [
			{b:2,c:3,d:4},
			{b:4,c:4,d:5}
		];
		var data2 = [
			{b:2,c:1,d:4},
			{b:3,c:4,d:2}
		];
		var merge = DataMerge.create();
		merge.push(data1);
		merge.push(data2);
		merge.setMerge({
			c:DataMerge.REFORM_SUM,
			d:DataMerge.REFORM_SUM
		});
		merge.setGroupBy(["b"]);
		merge.setEvals({e:"c/d"});
		merge.setSortKey({e:"DESC"});
		var expect = [
			{b:3,c:4,d:2,e:4/2},
			{b:4,c:4,d:5,e:4/5},
			{b:2,c:4,d:8,e:4/8}
		];
    merge.getData().should.eql(expect);
		done();
  });
  /*}}}*/

  /*{{{ test distinct*/
  it("test distinct",function(done){
		var merge = DataMerge.create();
		merge.setDistinct(true);
		var data1 = [{c:3,d:4,e:5}];
		var data2 = [{c:3,d:4,e:5}];
		merge.push(data1);
		merge.push(data2);
    merge.getData().should.eql([{c:3,d:4,e:5}]);
		done();
  });
  /*}}}*/

  /*{{{ test push empty return empty*/
  it("test push empty return empty",function(done){
		var sort = DataMerge.create();
		sort.setEvals({f3:"id"});
		sort.setSortKey({id:"DESC"});
    sort.getData().should.eql([]);
		done();
  });
  /*}}}*/

  /*{{{ test number string distinct bug case*/
  it("test number string distinct bug case",function(done){
		var merge = DataMerge.create();
		merge.setDistinct(true);
		merge.setSortKey({category_id:"ASC"});
		var data1 = [
			{category_id:16},
			{category_id:1625},
			{category_id:30},
			{category_id:50006842},
			{category_id:50006843},
		];
		var data2 = [
			{category_id:16},
			{category_id:1625},
			{category_id:30},
			{category_id:50006842},
		];
		merge.push(data1);
		merge.push(data2);
		var expect = [
			{category_id:16},
			{category_id:30},
			{category_id:1625},
			{category_id:50006842},
			{category_id:50006843},
		];
    merge.getData().should.eql(expect);
		done();
  });
  /*}}}*/

});
