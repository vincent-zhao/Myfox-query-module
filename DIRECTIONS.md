输入输出数据接口：
===================================

## 输入数据格式：

输入数据格式包括几个部分，其中包括**缓存控制**，**调试模式**，**请求模式**和**sql语句**。

我们用**\r\n**和**某特定分隔符**来组装上面这些部分，将他们组装成一个字符串。

上述的分隔符可以使用**var sep = String.fromCharCode('\x01')**获得。在下面的例子中我们用**"^A"**来表示这个分隔符。

### 如何组装成一个字符换？

如下（每个括号表示一部分），

  （缓存控制）^A（调试模式）\r\n（请求模式）\r\n（sql语句）\r\n

**解释**

* 缓存控制 可以设置成true或者false。true表示这条请求访问缓存。false表示这条请求的所有处理不经过缓存。
* 控制模式 也可以设置成true或者false。true表示在输出数据中带出详细的调试信息，false表示不带出调试信息。
* 请求模式 请求模式暂时设置为固定值sqlMode，请求模式是用来为以后程序的接口扩展做准备。
* sql语句 具体的sql语句。

### 例子

  true^Atrue\r\nsqlMode\r\nselect id from Table limit 1\r\n

**解释**

这个请求的含义是：
* 使用缓存
* 要求带出调试信息
* 采用sqlMode请求模式
* sql语句为select id from Table limit 1


## 输出数据格式：

输出数据是一个JSON字符串，转化为JSON对象后，JSON对象包括**数据**和**消息**两个部分。

数据部分是请求的结果。消息部分是错误信息。

输出的数据分为两类，一种是**正常结果**，一种是**错误结果**

### 错误结果：

错误结果表示在整个sql请求过程中出现了错误。也许是因为sql本身有问题或者是数据库内没有指定的表等。详细的错误信息在返回的**消息**字段中会说明。

错误结果例子：

  {data:[],msg:"err message"}

在解析sql的过程中发生任何错误，myfox就会返回具体的错误信息并且将data设置为空数组。

### 正常结果：

在整个解析过程中没有发生任何错误就可以得到正常的结果。

正常结果的例子：

  {data:[{a:1,b:2},{a:4,b:6}],msg:null}

如果结果正常返回，则msg会被设置为null

data字段是一个数组，数组中每个元素都代表一行数据。a:1表示这一行数据中，列名为a的值是1。


如何配置myfox
===================================
在etc目录下有5个配置文件

**dataloader_config.js:**

路由获取类的配置：

    module.exports = {
      routeTable : { //路由表信息
        dbname : 'meta_myfox_config',//路由表所在数据库
        table_prefix : 'dev_', //路由表前缀
        table_name : "route_info", //固定路由表名字
        useSuffix : true, //路由表是否有后缀名（后缀名由计算所得）
      },
      mysql   : {
        master: [{ // 主数据库
          poolSize : 10, // 连接池大小
          timeout  : 1000 * 10, // 请求超时时间
          slow     : 1000 * 2, // 慢请求阈值
          connInfo : { // mysql服务器的连接信息
            conn_host : '1.1.1.1',
            conn_user : 'username',
            conn_port : '3306',
            conn_pass : 'password',
            conn_db   : 'dbname',
          }
        },
        ],
        slave : [{ //从数据库
          poolSize : 10, // 连接池大小
          timeout  : 1000 * 10, // 请求超时时间
          slow     : 1000 * 2, // 慢日志阈值
          connInfo : { // mysql服务器连接信息
            conn_host : '1.1.1.1',
            conn_user : 'username',
            conn_port : '3306',
            conn_pass : 'password',
            conn_db   : 'dbname',
          }
        },
        ],
     }
    };

**memcache_config.js:**

memcache配置：

    module.exports = {
      serverList : [ // memcache服务器列表
        'localhost:11211'
      ],
      opt : {
        poolsize : 20 // memcache连接池大小
      }
    }

**mysqlloader_config.js:**

取数据（非路由数据）模块的配置：

    module.exports = {
      poolSize : 10, // mysql数据库连接池大小
      timeout : 1000 * 10 // 请求超时时间
      slow : 1000 * 2 // 慢日志阈值
    }

**master_config.js:**

master配置：

    module.exports = {
      address : "0.0.0.0", // 用默认值，不要修改
      port : 9222, // 服务端口
      workerPath: __dirname+"/../app/worker.js", // worker目录，不要修改
      workerNum: 4, // 启动的worker数量，和cpu有关，一个worker是一个进程。
      logPath : __dirname+"/../log/", //日志路径，不建议修改
      logLevel : Log.NOTICE + Log.WARNING + Log.ERROR, // 日志级别设置，有五种级别:Log.INFO,Log.DEBUG,Log.NOTICE,Log.WARNING,Log.ERROR.
      userPort : 9223,// myfox的debug页面接口
      adminPwd: '52.....94' // 这个发布版本无用，不要修改
    }

**worker_config.js:**

worker配置：

    module.exports = {
      logPath : __dirname + "/../log", // 日志路径，不建议修改
      logLevel : Log.DEBUG + Log.NOTICE + Log.WARNING + Log.ERROR, // 日志级别设置，和master中一样
      hbInterval : 2000,// 心跳建个，不建议修改
      lcacheLength : 1000,// 本地缓存长度，视路由库复杂程度而定
    }
