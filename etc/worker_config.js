var Log = require("../lib/log");

module.exports = {
    logPath : __dirname + "/../log", // 日志目录
    logLevel : Log.NOTICE + Log.WARNING + Log.ERROR,// 日志级别
    hbInterval : 2000,// 心跳间隔
    lcacheLength : 1000,// 本地缓存长度
    mcachePrefix : "memPre" //mecache缓存前缀
}
