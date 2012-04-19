var should = require('should');
var Select = require(__dirname + "/../../lib/parser/select");
var Column = require(__dirname + "/../../lib/column");
var Reform = require(__dirname + "/../..//lib/reform");
USE_UNIQUEKEY = true;

describe("Reform test",function(){
  beforeEach(function(){
		Column.init();
  });
  describe("reform.result()",function(){

    /*{{{ only mirror table in sql*/
    it("only mirror table in sql",function(done){
      var sql = "SELECT * FROM mirror WHERE a=b AND d in (2,45) GROUP BY a,MD5(b,\"c\") ORDER BY c DESC, TOUPPER(d) LIMIT 10";
      var nodes = {
        mirror : [[{hosts_list:"2,4$",modtime : 3, real_table : "mirror_0.t_mirror_2",unique_key : ""}]]
      };

      var reform = Reform.create(
        Select.create(sql).get(),nodes,{token:"01"}
      );
      
      var expect = [
        {
          host:"2,4",
          time:3,
          sql:"SELECT * FROM mirror_0.t_mirror_2 AS mirror WHERE a = b AND d IN (2,45) ORDER BY c DESC,TOUPPER(d) ASC LIMIT 0, 10"
        }
      ];
      reform.result().route.should.eql(expect);
      done();		
    });
    /*}}}*/

    /*{{{ only hash table in sql*/
    it("only hash table in sql",function(done){
      var sql = "SELECT * FROM hashes WHERE _date_ IN (2,3,4) AND cid = 4 AND a = b and d in (2,45) LIMIT 10,100";
      var nodes = {
        hashes : [
          [
            {
              hosts_list: "2$",
              modtime: 10,
              real_table : "hashes.t_hashes_1",
              unique_key : "",
              route_val : {
                _date_ : 2,
                cid : 4
              }
            }
          ],
          [
            {
              hosts_list : "4$",
              modtime: 11,
              real_table : "t_hashes_2",
              unique_key : "",
              route_val : {
                _date_ : 3,
                cid : 4
              }
            }
          ],
          [
            {
              hosts_list : "2$",
              modtime: 0,
              real_table : "t_hashes_3",
              unique_key : "",
              route_val : {
                _date_ : 4,
                cid : 4
              }
            }
          ]
        ],
        awkjiofewf : ["useless"]
      }
      var reform = Reform.create(Select.create(sql).get(),nodes,{token:"01"});
      var expect = [
        {
          host : '2',
          time : 10,
          sql : "SELECT * FROM hashes.t_hashes_1 AS hashes WHERE hashes._date_ = 2 AND hashes.cid = 4 AND a = b AND d IN (2,45) LIMIT 0, 110"
        },
        {
          host : '4',
          time : 11,
          sql : "SELECT * FROM t_hashes_2 AS hashes WHERE hashes._date_ = 3 AND hashes.cid = 4 AND a = b AND d IN (2,45) LIMIT 0, 110"
        },
        {
          host : '2',
          time : 0,
          sql : "SELECT * FROM t_hashes_3 AS hashes WHERE hashes._date_ = 4 AND hashes.cid = 4 AND a = b AND d IN (2,45) LIMIT 0, 110"
        }
      ];
      reform.result().route.should.eql(expect);
      done();
    });
    /*}}}*/

    /*{{{ mirror and hash table in sql*/
    it("mirror and hash table in sql",function(done){
      var sql = "SELECT * FROM mirror,numsplit WHERE _date_ IN (2,3,4) AND cid = 4 AND a = b AND d in (2,45)";
      var nodes = {
        mirror : [
          [
            {
              hosts_list : "2,4$",
              modtime : 4,
              real_table : "mirror.t_hashes_2",
              unique_key : "",
            }
          ]
        ],
        numsplit : [
          [
            {
              hosts_list : "2$",
              modtime : 2,
              real_table : "numsplit.t_hashes_1",
              unique_key : "",
              route_val : {
                _date_ : 2,
                cid : 4
              }
            }
          ],
          [
            {
              hosts_list : "4$",
              modtime : 3,
              real_table : "numsplit.t_hashes_2",
              unique_key : "",
              route_val : {
                _date_ : 3,
                cid : 4
              }
            }
          ]
        ],
        fejfeowf : ["useless"]
      };
      var reform = Reform.create(Select.create(sql).get(),nodes,{token:"01"});
      var expect = [
        {
          host : '2',
          time : 4,
          sql : "SELECT * FROM mirror.t_hashes_2 AS mirror,numsplit.t_hashes_1 AS numsplit WHERE numsplit._date_ = 2 AND numsplit.cid = 4 AND a = b AND d IN (2,45)"
        },
        {
          host : '4',
          time : 4,
          sql : "SELECT * FROM mirror.t_hashes_2 AS mirror,numsplit.t_hashes_2 AS numsplit WHERE numsplit._date_ = 3 AND numsplit.cid = 4 AND a = b AND d IN (2,45)"
        }
      ];
      reform.result().route.should.eql(expect);
      done();
    });
    /*}}}*/

    /*{{{ max min count avg num patch ok*/
    it("max min count avg num patch ok",function(done){
      var query = "SELECT a,1+MAX(b),MIN(c) as c, AVG(d) FROM hashes WHERE _date_=2 AND cid=1 GROUP BY a";
      var nodes = {
        hashes : [
          [
            {
              hosts_list : "2$",
              modtime : 4,
              real_table : "hashes.t_hashes_2_1",
              unique_key : "",
              route_val : {
                _date_ : 2,
                cid : 1
              }
            },
            {
              hosts_list : "4$",
              modtime : 4,
              real_table : "hashes.t_hashes_4_1",
              unique_key : "",
              route_val : {
                _date_ : 2,
                cid : 1
              }
            }
          ]
        ]
      };
      var reform = Reform.create(Select.create(query).get(),nodes,{token:"01"});
      var expect = [
        {
          host : '2',
          time : 4,
          sql : "SELECT a,MAX(b) AS i_am_virtual_1,MIN(c) AS i_am_virtual_2,SUM(d) AS i_am_virtual_3,COUNT(d) AS i_am_virtual_4 FROM hashes.t_hashes_2_1 AS hashes WHERE hashes._date_ = 2 AND hashes.cid = 1 GROUP BY a"
        },
        {
          host : '4',
          time : 4,
          sql : "SELECT a,MAX(b) AS i_am_virtual_1,MIN(c) AS i_am_virtual_2,SUM(d) AS i_am_virtual_3,COUNT(d) AS i_am_virtual_4 FROM hashes.t_hashes_4_1 AS hashes WHERE hashes._date_ = 2 AND hashes.cid = 1 GROUP BY a"
        }
      ];

      var expect2 = {
        "a" : {
          expr : "",
          merge : null,
          hide : false
        },
        "i_am_virtual_1" : {
          expr : "",
          merge : Column.REFORM_MAX,
          hide : true
        },
        "1+MAX(b)" : {
          expr : "1+i_am_virtual_1",
          merge : null,
          hide : false
        },
        "i_am_virtual_2" : {
          expr : "",
          merge : Column.REFORM_MIN,
          hide : true
        },
        "c" : {
          expr : "i_am_virtual_2",
          merge : null,
          hide : false
        },
        "i_am_virtual_3" : {
          expr : "",
          merge : Column.REFORM_SUM,
          hide : true
        },
        "i_am_virtual_4" : {
          expr : "",
          merge : Column.REFORM_SUM,
          hide : true
        },
        "AVG(d)" : {
          expr : "i_am_virtual_3 / i_am_virtual_4",
          merge : null,
          hide : false
        }
      }
      
      var result = reform.result();
      result.route.should.eql(expect);
      result.columns.should.eql(expect2);
      done();
    });
    /*}}}*/

    /*{{{ join table*/
    it("join table",function(done){
      var query = "SELECT a AS b FROM mirror RIGHT JOIN numsplit n ON mirror.t1 = n.t2 WHERE n._date_ = 2 AND cid=3 ORDER BY cid, a DESC";
      var nodes = {
        mirror : [
          [
            {
              hosts_list : "2,4$",
              modtime : 4,
              real_table : "mirror_0.t_mirror_2",
              unique_key : "",
            }
          ]
        ],
        numsplit : [
          [
            {
              hosts_list : "2$",
              modtime : 4,
              real_table : "numsplit_1.t_numplist_2_1",
              unique_key : "",
              route_val : {
                _date_ : 2,
                cid : 3
              }
            },
            {
              hosts_list : "4$",
              modtime : 4,
              real_table : "numsplit_1.t_numplist_4_1",
              unique_key : "",
              route_val : {
                _date_ : 2,
                cid : 3
              }
            }
          ]
        ]
      };
      var reform = Reform.create(Select.create(query).get(),nodes,{token:"01"});
      var expect = [
        {
          host : '2',
          time : 4,
          sql : "SELECT a AS b,cid FROM mirror_0.t_mirror_2 AS mirror RIGHT JOIN numsplit_1.t_numplist_2_1 AS n ON mirror.t1 = n.t2 WHERE n._date_ = 2 AND n.cid = 3 ORDER BY cid ASC,a DESC"
        },
        {
          host : '4',
          time : 4,
          sql : "SELECT a AS b,cid FROM mirror_0.t_mirror_2 AS mirror RIGHT JOIN numsplit_1.t_numplist_4_1 AS n ON mirror.t1 = n.t2 WHERE n._date_ = 2 AND n.cid = 3 ORDER BY cid ASC,a DESC"
        }
      ];
      reform.result().route.should.eql(expect);
      done();
    });
    /*}}}*/

    /*{{{ string column reform*/
    it("string column reform",function(done){
      var sql = "SELECT DATEFORMAT(thedate, \"a\") AS f0 FROM mirror";
      var nodes = {
        mirror : [
          [
            {
              hosts_list : "2,4$",
              modtime : 4,
              real_table : "mirror_0.t_mirror_2",
              unique_key : "",
            }
          ]
        ]
      };
      var reform = Reform.create(Select.create(sql).get(),nodes,{token:"01"});
      var expect = [
        {
          host : "2,4",
          time : 4,
          sql : "SELECT DATEFORMAT(thedate,'a') AS f0 FROM mirror_0.t_mirror_2 AS mirror"
        }
      ];
      var expect2 = {
        f0 : {
          expr : "",
          merge : null,
          hide : false
        }
      };
      var result = reform.result();
      result.route.should.eql(expect);
      result.columns.should.eql(expect2);
      done();
    });
    /*}}}*/

    /*{{{ brand buyer star d reform*/
    it("brand buyer star d reform",function(done){
      var query = "SELECT buyer_star_level_id AS f0,buyer_star_level_id AS f1, SUM(gmv_winner_num) AS f2, SUM(gmv_winner_num) AS f22, FLOOR(SUM(gmv_trade_amt)) AS f3, FLOOR(SUM(gmv_trade_amt) / SUM(gmv_winner_num)) AS f4 FROM rpt_brand_buyer_star_d a WHERE brand_id = 27961 AND thedate = 20101009 GROUP BY f0,f1 ORDER BY buyer_star_level_id  ASC";
      var nodes = {
        rpt_brand_buyer_star_d : [
          [
            {
              hosts_list : "8$",
              modtime : 4,
              real_table : "rpt_brand_buyer_star_d_0.rpt_brand_buyer_star_d_041_154",
              unique_key : "",
              route_val : {
                thedate : 20101009
              }
            }
          ]
        ]
      };
      var reform = Reform.create(Select.create(query).get(),nodes,{token:"01"});
      var expect = [
        {
          host : '8',
          time : 4,
          sql : "SELECT buyer_star_level_id AS f0,SUM(gmv_winner_num) AS i_am_virtual_1,SUM(gmv_trade_amt) AS i_am_virtual_2 FROM rpt_brand_buyer_star_d_0.rpt_brand_buyer_star_d_041_154 AS a WHERE a.thedate = 20101009 AND brand_id = 27961 GROUP BY f0 ORDER BY buyer_star_level_id ASC"
        }
      ];
      var result = reform.result();
      result.route.should.eql(expect);
      result.orders.should.eql({f0:"ASC"});
      done();
    });
    /*}}}*/

    /*{{{ join table group sql reform*/
    it("join table group sql reform",function(done){
      var query = "SELECT m.a AS b,SUM(n.c) AS f1 FROM mirror AS m RIGHT JOIN numsplit n ON mirror.t1 = n.t2 WHERE n._date_=2 AND cid=1 /* GROUP BY lalalla */ ORDER BY n.cid, m.a DESC";
      var nodes = {
        mirror : [
          [
            {
              hosts_list : "2,4$",
              modtime : 4,
              real_table : "mirror_0.t_mirror_2",
              unique_key : "",
            }
          ]
        ],
        numsplit : [
          [
            {
              hosts_list : "2$",
              modtime : 4,
              real_table : "numsplit_1.t_numplist_2_1",
              unique_key : "",
              route_val : {
                _date_ : 2,
                cid : 3
              }
            },
            {
              hosts_list : "4$",
              modtime : 4,
              real_table : "numsplit_1.t_numplist_4_1",
              unique_key : "",
              route_val : {
                _date_ : 2,
                cid : 3
              }
            }
          ]
        ]
      };
      var reform = Reform.create(Select.create(query).get(),nodes,{token:"01"});
      var expect = [
        {
          host : '2',
          time : 4,
          sql : "SELECT m.a AS b,SUM(n.c) AS i_am_virtual_1,n.cid FROM mirror_0.t_mirror_2 AS m RIGHT JOIN numsplit_1.t_numplist_2_1 AS n ON mirror.t1 = n.t2 WHERE n._date_ = 2 AND n.cid = 3 GROUP BY b,n.cid ORDER BY n.cid ASC,m.a DESC" 
        },
        {
          host : '4', 
          time : 4,
          sql : "SELECT m.a AS b,SUM(n.c) AS i_am_virtual_1,n.cid FROM mirror_0.t_mirror_2 AS m RIGHT JOIN numsplit_1.t_numplist_4_1 AS n ON mirror.t1 = n.t2 WHERE n._date_ = 2 AND n.cid = 3 GROUP BY b,n.cid ORDER BY n.cid ASC,m.a DESC"
        }
      ];
      reform.result().route.should.eql(expect);
      done();
    });
    /*}}}*/

    /*{{{ distinct only one column*/
    it("distinct only one column",function(done){
      var query = "SELECT DISTINCT model_id FROM dim_category_brand_prd WHERE category_level2 = 50011980 AND brand_id = 4079617 AND deleted = 0 AND model_name <> '' ORDER BY model_id ASC";
      var nodes = {
        dim_category_brand_prd : [
          [
            {
              hosts_list : "6,8$",
              modtime : 4,
              real_table : "dim_category_brand_prd_0.dim_category_brand_prd_141_1",
              unique_key : "",
            }
          ]
        ]
      };
      var reform = Reform.create(Select.create(query).get(),nodes,{token:"01"});
      var expect = [
        {
          host: "6,8",
          time : 4,
          sql : "SELECT DISTINCT model_id FROM dim_category_brand_prd_0.dim_category_brand_prd_141_1 AS dim_category_brand_prd WHERE category_level2 = 50011980 AND brand_id = 4079617 AND deleted = 0 AND model_name != '' ORDER BY model_id ASC"
        }
      ];
      var result = reform.result();
      result.route.should.eql(expect);
      result.orders.should.eql({model_id:"ASC"});
      result.distinct.should.eql(true);
      done();
    });
    /*}}}*/

    /*{{{ string comma sql*/
    it("string comma sql",function(done){
      var sql = "SELECT a FROM mirror WHERE b LIKE \"s'd%\"";
      var nodes = {
        mirror : [
          [
            {
              hosts_list : "2,4$",
              real_table : "mirror_0.t_mirror_2",
              unique_key : "",
              modtime : 2
            }
          ]
        ]
      };
      var reform = Reform.create(Select.create(sql).get(),nodes,{token:"01"});
      var expect = [
        {
          host : "2,4",
          time : 2,
          sql : "SELECT a FROM mirror_0.t_mirror_2 AS mirror WHERE b LIKE \'s\\\'d%\'"
        }
      ];
      reform.result().route.should.eql(expect);
      done();
    });
    /*}}}*/

    /*{{{ distinct column*/
    it("distinct column",function(done){
      var query = "SELECT DISTINCT(model_id) AS id,model_name as name FROM dim_category_brand_prd WHERE category_level2 = 50011980 AND brand_id = 4079617 AND deleted = 0 AND model_name <> '' ORDER BY model_name ASC";
      var nodes = {
        dim_category_brand_prd : [
          [
            {
              hosts_list : "6,8$",
              modtime : 1,
              real_table : "dim_category_brand_prd_0.dim_category_brand_prd_141_1",
              unique_key : "",
            }
          ]
        ]
      };
      var reform = Reform.create(Select.create(query).get(),nodes,{token:"01"});
      var expect = [
        {
          host : "6,8",
          time : 1,
          sql : "SELECT DISTINCT (model_id) AS id,model_name AS name FROM dim_category_brand_prd_0.dim_category_brand_prd_141_1 AS dim_category_brand_prd WHERE category_level2 = 50011980 AND brand_id = 4079617 AND deleted = 0 AND model_name != '' ORDER BY model_name ASC"
        }
      ];
      var result = reform.result();
      result.route.should.eql(expect);
      result.orders.should.eql({name:"ASC"});
      result.distinct.should.eql(true);
      result.columns.should.eql({
        id : {
          expr : "",
          merge : null,
          hide : false
        },
        name : {
          expr : "",
          merge : null,
          hide : false
        }
      });
      done();
    });
    /*}}}*/

    /*{{{ unique key reform test(in from)*/
    it("unique key reform test(in from)",function(done){
      var query = "select key2,SUM(FLOOR(key3)),SUM(key4) from uniqueTest where key1 in (1,2) ORDER BY SUM(key3)";
      var nodes = {
        uniqueTest : [
          [
            {
              hosts_list:"13$",
              modtime : 1,
              real_table : "uniqueTest_0.uniqueTest_real",
              unique_key : "key1;key2$",
              route_val : {
                key1 : 1
              }
            },
            {
              hosts_list:"13$",
              modtime : 1,
              real_table : "uniqueTest_0.uniqueTest_real2",
              unique_key : "key1$",
              route_val : {
                key1 : 2
              }
            }
          ]
        ]
      }
      var reform = Reform.create(Select.create(query).get(),nodes,{token:"01"});
      var expect = [
        {
          host : "13",
          time : 1,
          sql : "SELECT key2,FLOOR(key3) AS i_am_virtual_1,key4 AS i_am_virtual_2,key3 AS i_am_virtual_3 FROM uniqueTest_0.uniqueTest_real AS uniqueTest WHERE uniqueTest.key1 = 1 GROUP BY key2 ORDER BY key3 ASC"
        },
        {
          host : "13",
          time : 1,
          sql : "SELECT key2,SUM(FLOOR(key3)) AS i_am_virtual_1,SUM(key4) AS i_am_virtual_2,SUM(key3) AS i_am_virtual_3 FROM uniqueTest_0.uniqueTest_real2 AS uniqueTest WHERE uniqueTest.key1 = 2 GROUP BY key2 ORDER BY SUM(key3) ASC"
        }
      ];
      result = reform.result();
      result.route.should.eql(expect);
      done();
    });
    /*}}}*/

    /*{{{ unique key reform test(in from not end with $)*/
    it("unique key reform test(in from not end with $)",function(done){
      var query = "select key2,SUM(key3) from uniqueTest where key1 in (1,2) ORDER BY SUM(key3)";
      var nodes = {
        uniqueTest : [
          [
            {
              hosts_list:"13$",
              modtime : 1,
              real_table : "uniqueTest_0.uniqueTest_real",
              unique_key : "key1;key2$",
              route_val : {
                key1 : 1
              }
            },
            {
              hosts_list:"13$",
              modtime : 1,
              real_table : "uniqueTest_0.uniqueTest_real2",
              unique_key : "key1,key2",
              route_val : {
                key1 : 2
              }
            }
          ]
        ]
      }
      var reform = Reform.create(Select.create(query).get(),nodes,{token:"01"});
      var expect = [
        {
          host : "13",
          time : 1,
          sql : "SELECT key2,key3 AS i_am_virtual_1 FROM uniqueTest_0.uniqueTest_real AS uniqueTest WHERE uniqueTest.key1 = 1 GROUP BY key2 ORDER BY key3 ASC"
        },
        {
          host : "13",
          time : 1,
          sql : "SELECT key2,SUM(key3) AS i_am_virtual_1 FROM uniqueTest_0.uniqueTest_real2 AS uniqueTest WHERE uniqueTest.key1 = 2 GROUP BY key2 ORDER BY SUM(key3) ASC"
        }
      ];
      result = reform.result();
      result.route.should.eql(expect);
      done();
    });
    /*}}}*/

    /*{{{ unique key reform test(exist join)*/
    it("unique key reform test(exist join)",function(done){
      var query = "select u.key2,SUM(u.key3) from uniqueTest as u inner join joinTestTab as j on u.id = j.id where u.key1 in (1,2) ORDER BY SUM(u.key3)";
      var nodes = {
        uniqueTest : [
          [
            {
              hosts_list:"13$",
              modtime : 1,
              real_table : "uniqueTest_0.uniqueTest_real",
              unique_key : "key1;key2$",
              route_val : {
                key1 : 1
              }
            },
            {
              hosts_list:"13$",
              modtime : 1,
              real_table : "uniqueTest_0.uniqueTest_real2",
              unique_key : "key1$",
              route_val : {
                key1 : 2
              }
            }
          ]
        ],
        joinTestTab : [
          [
            {
              hosts_list : "1,2,3,13$",
              modtime : 1,
              real_table : "joinTestTab_0.joinTestTab_real",
              unique_key : "id$",
            }
          ]
        ]
      }
      var reform = Reform.create(Select.create(query).get(),nodes,{token:"01"});
      var expect = [
        {
          host : "13",
          time : 1,
          sql : "SELECT u.key2 AS key2,SUM(u.key3) AS i_am_virtual_1 FROM uniqueTest_0.uniqueTest_real AS u INNER JOIN joinTestTab_0.joinTestTab_real AS j ON u.id = j.id WHERE u.key1 = 1 GROUP BY key2 ORDER BY SUM(u.key3) ASC"
        },
        {
          host : "13",
          time : 1,
          sql : "SELECT u.key2 AS key2,SUM(u.key3) AS i_am_virtual_1 FROM uniqueTest_0.uniqueTest_real2 AS u INNER JOIN joinTestTab_0.joinTestTab_real AS j ON u.id = j.id WHERE u.key1 = 2 GROUP BY key2 ORDER BY SUM(u.key3) ASC"
        }
      ];
      result = reform.result();
      result.route.should.eql(expect);
      done();
    });
    /*}}}*/

  })
});
