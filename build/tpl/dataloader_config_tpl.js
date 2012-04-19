{
  routeTable : { //路由表信息
    dbname : '##dbname##',//路由表所在数据库
    table_prefix : '##table_prefix##', //路由表前缀
    table_name : "##table_name##" //固定路由表名字
  },
  mysql   : {// 路由库配置
      master: [{ // 主数据库
        poolSize : 3, // 连接池大小
        timeout  : 10, // 请求超时时间
        slow     : 1000 * 2, // 慢查询时间阈值
        connInfo : { // mysql服务器的连接信息
          conn_host : "##master_conn_host##",
          conn_user : "##master_conn_user##",
          conn_port : "##master_conn_port##",
          conn_pass : "##master_conn_pass##",
          conn_db   : "##master_conn_db##",
        }
      },
      ],
      slave : [{ //从数据库
        poolSize : 3, // 连接池大小
        timeout  : 10, // 请求超时时间
        slow     : 1000 * 2, // 慢查询时间阈值
        connInfo : { // // mysql服务器的连接信息
          conn_host : "##slave_conn_host##",
          conn_user : "##slave_conn_user##",
          conn_port : "##slave_conn_port##",
          conn_pass : "##slave_conn_pass##",
          conn_db   : "##slave_conn_db##",
        }
      },
      ],
  }
};
