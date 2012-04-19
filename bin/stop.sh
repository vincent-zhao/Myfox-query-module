# !/bin/bash
# vim: set expandtab tabstop=4 shiftwidth=4 foldmethod=marker: #

ps -ef|grep "nohup node master.js"|grep -v grep|cut -c 9-15|xargs kill -9
