var sep = String.fromCharCode('\x01');

//code:506 means that obj lacks key elements
function render(obj){
  var res = "";
  var version = (obj.version !== undefined) ? obj.version : "2.0";
  var code = (obj.code !== undefined) ? obj.code : 506;
  var msg = (obj.msg !== undefined) ? obj.msg : "";
  var data = (obj.data !== undefined) ? obj.data : [];
  res += (version + sep + code + sep + msg + sep + data.length + "\r\n");
  if(data.length == 0){return res;}
  for(var i in data[0]){
    res += (i + sep);
  }
  res = (res.substr(0,res.length-1) + "\r\n");
  for(var i = 0; i < data.length; i++){
    for(j in data[i]){
      res += (data[i][j] + sep);
    } 
    res = (res.substr(0,res.length-1) + "\r\n");
  }
  return res;
}

module.exports = render;
