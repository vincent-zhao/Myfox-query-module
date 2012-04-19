module.exports = {
  dataloader_config : {
    dbname : "meta_myfox_config",
    table_prefix : "dev_",
    table_name : "route_info",

    master_conn_host : "127.0.0.1",
    master_conn_user : "root",
    master_conn_port : "3306",
    master_conn_pass : "root",
    master_conn_db   : "",

    slave_conn_host : "127.0.0.1",
    slave_conn_user : "root",
    slave_conn_port : "3306",
    slave_conn_pass : "root",
    slave_conn_db   : "",
  },
  firewall_config : {
    online_servers : "'127.0.0.1:9124'",
  },
  sqlcount_config : {
    master_conn_host : "127.0.0.1",
    master_conn_user : "root",
    master_conn_port : "3306",
    master_conn_pass : "root",
    master_conn_db   : "meta_myfox_config",
  },
  memcache_config : {
    memcache_serverList : "'localhost:11211'",
    poolSize : 5
  },

  mysqlloader_config : {
  },

  master_config : {
    serverPort : 9123,
    workerNum : 4,
    logLevel : "Log.DEBUG+Log.NOTICE+Log.WARNING+Log.ERROR",
    userPort : 9124,
    adminPwd : ""
  },

  worker_config : {
    logLevel : "Log.DEBUG+Log.NOTICE+Log.WARNING+Log.ERROR",
    lcacheLength : 1000
  }
}
