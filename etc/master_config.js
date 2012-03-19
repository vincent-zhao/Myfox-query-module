var Log = require("../lib/log");

module.exports = {
    address : "0.0.0.0",// ip
    port : 9123,// 服务端口
    workerPath: __dirname+"/../app/worker.js",// worker所在目录
    workerNum: 4,// worker数量
    logPath : __dirname+"/../log/",// 日志路径
    logLevel : Log.NOTICE + Log.WARNING + Log.ERROR, // 日志界别
    statesFile : __dirname + "/../run/states.js",
    userPort : 9124,// 监控端口
    adminPwd: '******' // 管理员密码
}
