## 简介：

myfox查询模块是一个**分布式mysql查询层**。使用nodejs实现。你可以用myfox查询模块查询分布式数据库中的数据。

## 准备：
1. node的版本在0.6.7以上（包括0.6.7）
2. 你必须有可以访问的mysql服务器(在运行myfox查询模块的服务的机器上需要安装一个mysql服务器，这是为了运行我们的demo程序来测试你是否已经安装myfox查询模块成功)。
3. myfox查询模块只提供查询服务，所以你必须已经将数据导入到mysql数据库中，导入的方法请点击这里https://github.com/vincent-zhao/Myfox-load-module (下面提供了myfox查询模块的demo测试，这个测试不需要先装载数据)
4. 你必须提供可用的memcache服务器。
5. 如果你是ubuntu用户，请注意，ubuntu默认启动dash，不是bash。所以需要输入下面命令：
  sudo dpkg-reconfigure dash（选择"否"）

## 配置：
(在进行下述测试之前，先不要随便修改配置，以便测试正常进行)
配置的详细说明见**DIRECTIONS.md**文件的**如何配置myfox查询模块**部分(直接myfox查询模块代码下etc目录下每个配置文件中都有说明)。

## 必须了解：
在使用myfox查询模块之前，你必须了解myfox查询模块的数据接口。数据接口的详细介绍见**DIRECTIONS.md**文件的**输入输出数据接口说明**部分

## 安装
1. 在myfox查询模块目录下用npm安装libmysqlclient（npm install libmysqlclient）

## 运行：
你可以直接在myfox查询模块根目录下运行**startup.sh**脚本来启动myfox查询模块服务。

## 测试：
1. 下载安装包并且解压
2. 测试环境：
* 有本地mysql数据库
* 有可以连接的memcache服务器（配置默认用本地）
* node-v0.6.7以上版本
* 使用npm安装完libmysqlclient。
3. 配置
* dataloader_config.js，只要修改本地路由数据库的用户名,密码和端口号
* memcache_config.js配置，修改memcache的地址和端口
* init.sql修改，在第44和45行中，把(##用户名##)修改为你mysql的用户名，(##密码##)修改为你的mysql密码。（init.sql是为了构造假的用于测试的数据，所以你无须太过关心这个文件的具体内容）。
* 其他保持默认。
4. 运行**install.sh**脚本设置测试环境。在运行install.sh之前要进入install.sh文件修改运行参数。如何设置参数见install.sh中的说明。
5. 按照上述说明运行myfox。
6. 打开浏览器，输入http://127.0.0.1:9124. 在框内输入select * from numsplit where thedate=20110610 and cid=1。提交请求。如果页面显示出结果，恭喜你，你的myfox查询模块已经可以正常工作了，你可以根据自己的数据库对配置文件进行修改，从而让myfox为你自己的应用提供服务了：）

## 联系：
1. 如果你有任何问题和建议，欢迎联系我们。我们的联系方式见DEVELOPERS文件。
