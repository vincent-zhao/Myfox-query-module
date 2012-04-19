## 简介：

myfox查询模块是一个**分布式mysql查询层**。使用nodejs实现。你可以用myfox查询模块查询分布式数据库中的数据。关于myfox的实际应用场景和简单的架构介绍，可以见此文 http://www.tbdata.org/archives/1789

## 准备：
1. node的版本在0.6.7以上（包括0.6.7）
2. 你必须有可以访问的mysql服务器(在运行myfox查询模块的服务的机器上需要安装一个mysql服务器，这是为了运行我们的demo程序来测试你是否已经安装myfox查询模块成功)。
3. myfox查询模块只提供查询服务，所以你必须已经将数据导入到mysql数据库中，导入的方法请点击这里 https://github.com/vincent-zhao/Myfox-load-module (下面提供了myfox查询模块的demo测试，这个测试不需要先装载数据)
4. 你必须提供可用的memcache服务器。
5. 如果你是ubuntu用户，请注意，ubuntu默认启动dash，不是bash。所以需要输入下面命令：
  sudo dpkg-reconfigure dash（选择"否"）

## 配置：
(在进行下述测试之前，先不要随便修改配置，以便测试正常进行)
配置文件见build/config/test.js文件，对每项有详细的说明，至于demo测试如何配置请看下面测试部分，可以参考同一目录下的test.default.js文件。配置好后在根目录下运行make conf即可自动生成配置文件。

## 了解：
1. 在使用myfox查询模块之前，你必须了解myfox查询模块的数据接口。数据接口的详细介绍见**DIRECTIONS.md**文件
2. nodefox使用了node-cluster多进程框架 http://github.com/aleafs/node-cluster

## 安装
1. 只需将源码包放到制定目录解压即可，不需要单独再安装任何依赖库等

## 运行：
1. 运行之前必须先跑通我们的单元测试，单元测试过程中我们会帮你装好所有依赖的库，单元测试很简单，只需要在根目录下输入make test即可
2. 进入我们的bin目录，运行start.sh文件即可
3. 根目录下的的Makefile支持几种操作
* make conf ENV＝？ 生成配置文件，build/config中定制各个环境下的配置。默认情况make conf时生成test环境下的配置。
* make test 单元测试
* make clean 清除生成的配置文件和run目录下的运行时文件

## demo测试：
1. 下载安装包并且解压
2. 测试环境：
* 有本地mysql数据库(强烈建议，这样就会方便很多)
* 有可以连接的memcache服务器（配置默认用本地）
* node-v0.6.7以上版本
3. 配置
* 打开build/config/test.js，根据注释进行配置，如果你按照我所说mysql装载本地的话，只需要在文件中修改注释内标注“##”符号的部分就可以了。根目录下运行make conf生成配置文件。
* init.sql修改，如果mysql在本地，只需要在第42和43行中，把(##用户名##)修改为你mysql的用户名，(##密码##)修改为你的mysql密码。否则还需要修改前面的mysql地址和端口（init.sql是为了构造假的用于测试的数据，所以你无须太过关心这个文件的具体内容）。
* 其他保持默认。
4. 运行**install.sh**脚本设置测试环境。在运行install.sh之前要进入install.sh文件修改运行参数。如何设置参数见install.sh中的说明，本机mysql只需要修改第11行的用户名和密码。
5. 按照上述说明运行myfox。
6. 打开浏览器，输入http://127.0.0.1:9124. 在框内输入select * from numsplit where thedate=20110610 and cid=1。提交请求。如果页面显示出结果，恭喜你，你的myfox查询模块已经可以正常工作了，你可以根据自己的数据库对配置文件进行修改，从而让myfox为你自己的应用提供服务了：）

## 联系：
1. 如果你有任何问题和建议，欢迎联系我们。我们的联系方式见DEVELOPERS文件。
