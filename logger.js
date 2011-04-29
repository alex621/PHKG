var config = require("./config");

module.exports = logger;

function logger(msg){
	if (config.debug){
		console.log(msg);
	}
}