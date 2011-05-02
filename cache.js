var fs = require('fs');
var path = require('path');
var logger = require("./logger");
var config = require("./config");

module.exports = cache;

function cache(){
	this.tmpPath = config.tmpPath;
}

cache.prototype.readTopics = function (type, page, timeLimit){
	//need to implement validation
	var fileName = type + "-" + page;
	var fullPath = this.tmpPath + fileName;
	
	if (path.existsSync(fullPath)){
		//replace the following line by readSync may benefit from better performance
		var content = fs.readFileSync(fullPath, "binary");
		if (content == ""){
			return null;
		}
		var packet;
		try{
			packet = JSON.parse(content);
		}catch (e){
			//parse error
			return null;
		}
		
		var lastMod = new Date(packet.lastModified);
		var limitDate = new Date((new Date) - timeLimit);
		if (lastMod < limitDate){
			//older, so we return nothing
			return null;
		}else{
			//hit cache
			return packet;
		}
	}else{
		logger("No cache");
		return null;
	}
};

cache.prototype.writeTopics = function (type, page, data){
	var fileName = type + "-" + page;
	var fullPath = this.tmpPath + fileName;
	
	fs.writeFile(fullPath, JSON.stringify(data), "binary");
};

cache.prototype.readPost = function (id, page, timeLimit){
	//need to implement validation
	var fileName = "post" + id + "-" + page;
	var fullPath = this.tmpPath + fileName;
	
	if (path.existsSync(fullPath)){
		//replace the following line by readSync may benefit from better performance
		var content = fs.readFileSync(fullPath, "binary");
		if (content == ""){
			return null;
		}
		var packet = JSON.parse(content);
		
		var lastMod = new Date(packet.lastModified);
		var limitDate = new Date((new Date) - timeLimit);
		if (lastMod < limitDate){
			//older, so we return nothing
			return null;
		}else{
			//hit cache
			return packet;
		}
	}else{
		logger("No cache");
		return null;
	}
};

cache.prototype.writePost = function (id, page, data){
	var fileName = "post" + id + "-" + page;
	var fullPath = this.tmpPath + fileName;
	
	fs.writeFile(fullPath, JSON.stringify(data), "binary");
};

cache.prototype.readChannels = function (timeLimit){
	var fullPath = this.tmpPath + "channels";
	
	if (path.existsSync(fullPath)){
		//replace the following line by readSync may benefit from better performance
		var content = fs.readFileSync(fullPath, "binary");
		if (content == ""){
			return null;
		}
		var packet = JSON.parse(content);
		
		var lastMod = new Date(packet.lastModified);
		var limitDate = new Date((new Date) - timeLimit);
		if (lastMod < limitDate){
			//older, so we return nothing
			return null;
		}else{
			//hit cache
			return packet;
		}
	}else{
		logger("No cache");
		return null;
	}
};

cache.prototype.writeChannels = function (data){
	var fullPath = this.tmpPath + "channels";
	
	fs.writeFile(fullPath, JSON.stringify(data), "binary");
};