module.exports = {
  routeTable : { //路由表信息
    dbname : 'meta_myfox_config',//路由表所在数据库
    table_prefix : 'dev_', //路由表前缀
    table_name : "route_info", //固定路由表名字
    useSuffix : true, //路由表是否有后缀名（后缀名由计算所得）
  },
  mysql   : { // 路由库配置
      master: [{ // 主数据库
        poolSize : 10, // 连接池大小
        timeout  : 10, // 请求超时时间
        slow     : 1000 * 2, // 慢查询时间阈值
        connInfo : { // mysql服务器的连接信息
          conn_host : '',//mysql服务器地址
          conn_user : '',//用户名
          conn_port : '3306',//端口号
          conn_pass : '',//密码
          conn_db   : '',//库名
        }
      },
      ],
      slave : [{ // 从数据库
        poolSize : 10, // 连接池大小
        timeout  : 10, // 请求超时时间
        slow     : 1000 * 2, // 慢查询时间阈值
        connInfo : { // mysql服务器的连接信息
          conn_host : '',//mysql服务器地址
          conn_user : '',//用户名
          conn_port : '3306',//端口号
          conn_pass : '',//密码
          conn_db   : '',//库名
        }
      },
      ],
  }
};
