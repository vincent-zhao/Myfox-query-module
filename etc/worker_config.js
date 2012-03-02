var Log = require("../lib/log");

module.exports = {
    logPath      : __dirname + "/../log", // 日志路径，不建议修改
    logLevel     : Log.NOTICE + Log.WARNING + Log.ERROR, //日志级别设置，和master中一样
    hbInterval   : 2000, //心跳建个，不建议修改
    lcacheLength : 1000, //本地缓存长度，视路由库复杂程度而定
}
