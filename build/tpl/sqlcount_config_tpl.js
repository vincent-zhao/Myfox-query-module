module.exports = {
	logPath: __dirname + '/../logs/worker',
	retry: 5,
	mysql: {
		readTimeout: 2,
		writeTimeout: 2,
		host: "##master_conn_host##",
		user: "##master_conn_user##",
		pass: "##master_conn_pass##",
		db:   "##master_conn_db##",
		prot: "##master_conn_port##",
	},
};

