# !/bin/bash
# vim: set expandtab tabstop=4 shiftwidth=4 foldmethod=marker: #

ps -ef|grep "app/master.js"|grep -v grep|cut -c 9-15|xargs kill -9

ps -ef|grep "worker.js"|grep -v grep|cut -c 9-15|xargs kill -9
