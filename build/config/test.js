module.exports = {
  dataloader_config : {
    dbname : "meta_myfox_config",//路由库名
    table_prefix : "dev_",//路由表前缀
    table_name : "route_info",//路由表明

    master_conn_host : "127.0.0.1",//路由主库host
    master_conn_user : "",//##用户名##
    master_conn_port : "3306",//端口
    master_conn_pass : "",//##密码##
    master_conn_db   : "",//

    slave_conn_host : "127.0.0.1",//路由备库host
    slave_conn_user : "",//##用户名##
    slave_conn_port : "3306",//端口
    slave_conn_pass : "",//##密码##
    slave_conn_db   : "",//
  },
  firewall_config : {
    online_servers : "'127.0.0.1:9124'",//服务地址端口，本机跑默认127.0.0.1:9124
  },
  sqlcount_config : { //sql归一地址
    master_conn_host : "127.0.0.1",//host
    master_conn_user : "",//##用户名##
    master_conn_port : "3306",//
    master_conn_pass : "",//##密码##
    master_conn_db   : "meta_myfox_config",//数据库名
  },
  memcache_config : {
    memcache_serverList : "'localhost:11211'",//memcache地址
    poolSize : 5
  },

  mysqlloader_config : {
  },

  master_config : {
    serverPort : 9123,//服务端口
    workerNum : 4,//worker数量
    logLevel : "Log.DEBUG+Log.NOTICE+Log.WARNING+Log.ERROR",
    userPort : 9124,//监控端口
    adminPwd : ""
  },

  worker_config : {
    logLevel : "Log.DEBUG+Log.NOTICE+Log.WARNING+Log.ERROR",
    lcacheLength : 1000//本地缓存队列长度
  }
}
