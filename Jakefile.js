var fs = require("fs");
var configPath = __dirname + "/conf";

desc('default jake');
task('default',function(params){
  console.log("not tell to generate which env");
});

desc('run jake for config generation');
task("generateConfig",function(envName,path){
  if(envName !== "test" && envName !== "rc1" && envName !== "rc2" && envName !== "release"){
    console.log("no config for " + envName);
    return;
  }
  if(path !== undefined){
    configPath = path;
  }
  console.log("start generate " + envName + " enviroment.....");
  var getConfig = require(__dirname + "/build/config/" + envName + ".js");
  for(var i in getConfig){
    var getTpl = fs.readFileSync(__dirname + "/build/tpl/" + i + "_tpl.js").toString();
    for(var j in getConfig[i]){
      var reg = new RegExp("##"+j+"##","");
      getTpl = getTpl.replace(reg,getConfig[i][j].toString());
    }
    fs.writeFileSync(configPath + "/" + i + ".js","var Log = require(\"../lib/log\");\nmodule.exports = " + getTpl);
  }
  console.log("generate " + envName + " enviroment succeed!");
});
