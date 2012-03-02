var Log = require("../lib/log");

module.exports = {
    address : "0.0.0.0",// 用默认值，不要修改
    port : 9123, // 服务端口
    workerPath: __dirname+"/../app/worker.js", // worker目录，不要修改
    workerNum: 1, // 启动的worker数量，和cpu有关，一个worker是一个进程。
    logPath : __dirname+"/../log/", // 日志路径，不建议修改
    logLevel : Log.NOTICE + Log.WARNING + Log.ERROR, // 日志级别设置，有五种级别:Log.INFO,Log.DEBUG,Log.NOTICE,Log.WARNING,Log.ERROR.
    userPort : 9124, // myfox的debug页面接口
}
