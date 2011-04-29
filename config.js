var config = {
	debug: true,
	useUpnp: false, //to be implemented
	
	proxyPort: 8080,
	
	hkgoldenServer: function (){
		return 4;
	},
	
	directAccessPaths: [
		"/css/",
		"/img/",
		"/js/"
	]
};

config.thisPath = "localhost:" + config.proxyPort;
config.thisHTTPPath = "http://" + config.thisPath + "/";

module.exports = config;