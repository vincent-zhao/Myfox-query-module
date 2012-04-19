# !/bin/bash
# vim: set expandtab tabstop=4 shiftwidth=4 foldmethod=marker: #

#declare -r MYSQL="mysql -h127.0.0.1 -uMysqlUsername -pMysqlPass -PMysqlport --local-infile=1 --default-character-set=utf8"
#-h{your_mysqlServer_ip}
#-u{your_mysqlServer_user}
#-P{your_mysqlServer_port}
#-p{your_mysqlServer_pass}

#修改下面句子
declare -r MYSQL="mysql -h127.0.0.1 -u用户名 -p密码 --local-infile=1 --default-character-set=utf8"
#example:如果我的用户名为root,密码为mypassword,端口为3306,则将declare句子改为如下样子。
#declare -r MYSQL="mysql5 -h127.0.0.1 -uroot -pmypassword -P3306 --local-infile=1 --default-character-set=utf8"

# {{{ function usage() #
function usage() {
	cat <<EOF
 Usage      : `basename ${0}` sql-dir 
 init       : Drop table if exists, default [ Yes ]
EOF
}
# }}} #

# {{{ function notice() #
function notice() {
    local ret="${1}"
    local msg="${2}"

    if [ ${ret} -eq 0 ]
    then
        printf "[32m%s\t...\t[OK][0m\n" "${msg}"
    else
        printf "[31m%s\t...\t[ERROR][0m\n" "${msg}"
    fi
}
# }}} #

# {{{ function init() #
function init() {
    ${MYSQL} < "./init.sql"
    notice ${?} "CREATE TABLES & INIT TEST DATA"
}
# }}} #


if [ ! -f "./init.sql" ]
then
    echo "No init.sql file"
    exit
fi

init

