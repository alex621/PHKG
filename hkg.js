var http = require('http');
var net = require("net");
var cache = require("./cache");
var logger = require("./logger");
var dataSource = require("./dataSource");
var fs = require('fs');

var view = require("./view");

module.exports = hkg;

var serverConfig = {
	host: "phkg.plesier.com",
	port: 80,
	prefix: "http://phkg.plesier.com/"
};

var packetCounter = 0;
var cacheI = new cache();
var dataSourceI = new dataSource();

function hkg(){
	this.availablePeers = [];
	this.connectedPeers = {};
	this.maxPeers = 100;
	this.numOfConnected = 0;
	this.bufferData = {};
	
	this.iAmAlive();
	this.getAvailablePeers();
	this.createServer();
}

hkg.prototype.iAmAlive = function (){
	var phkg = http.createClient(serverConfig.port, serverConfig.host);
	var phkgReq = phkg.request("GET", serverConfig.prefix + "peer.alive", {
		"Host": serverConfig.host,
		"Connection": "close"
	});
	phkgReq.end();
};

hkg.prototype.createServer = function (){
	var tht = this;
	var server = net.createServer(function (sock){
		sock.setEncoding("binary");
		sock.addListener("connect", function (){
			//a peer connected, welcome
			tht.registerPeer(sock.remoteAddress, sock);
		});
		sock.addListener("close", function (){
			tht.unregisterPeer(sock.remoteAddress);
		});
		sock.addListener("data", function (data){
			tht.handleBufferResponse(sock.remoteAddress, data);
		});
		sock.addListener("error", function (){
			logger("Fail to connect");
		});
		sock.addListener("fullPacket", function (ip, data){
			tht.processRequest(ip, data);
		});
	});
	
	server.listen(1999);
};

hkg.prototype.handleBufferResponse = function (ip, data){
	logger("Data received: " + data);
	var extract = function (str){
		var pattern = /^[0-9]+/;
		var length = str.match(pattern);
		if (length == null){
			return null;
		}
		length = length[0];
		return {
			offset: length.length,
			length: parseInt(length)
		};
	};
	
	if (this.bufferData[ip] == undefined){
		this.bufferData[ip] = "";
	}
	this.bufferData[ip] += data;
	var buffer = this.bufferData[ip];
	var bufferInfo = extract(buffer);
	if (bufferInfo == null){
		//drop all buffer data
		this.bufferData[ip] = "";
	}else{
		logger("Buffer length: " + Buffer.byteLength(buffer, "binary"));
		logger("Data length: " + Buffer.byteLength(data, "binary"));
		logger(bufferInfo);
		if (Buffer.byteLength(buffer, "binary") >= (bufferInfo.length + bufferInfo.offset)){
			//a full packet received, extract it
			logger("Extracting for full packet");
			var packetData = buffer.substr(bufferInfo.offset, bufferInfo.length);
			this.bufferData[ip] = buffer.substr(bufferInfo.offset + bufferInfo.length);
			
			if (this.connectedPeers[ip]){
				this.connectedPeers[ip].emit("fullPacket", ip, packetData);
			}
		}
	}
};

hkg.prototype.getAvailablePeers = function (){
	var tht = this;
	var phkg = http.createClient(serverConfig.port, serverConfig.host);
	var phkgReq = phkg.request("GET", serverConfig.prefix + "active.peers", {
		"Host": serverConfig.host,
		"Connection": "close"
	});
	phkgReq.addListener('response', function(res) {
		var temp = "";
		res.addListener('data', function(chunk) {
			temp += chunk;
		});
		res.addListener('end', function() {
			var obj = JSON.parse(temp);
			if (obj.success){
				tht.availablePeers = obj.msg;
				tht.newPeersMayAvailable();
			}
		});
	});
	phkgReq.end();
};

hkg.prototype.newPeersMayAvailable = function (){
	if (this.numOfConnected < this.maxPeers){
		for (var i = 0, l = this.availablePeers.length; i < l; i++){
			var peer = this.availablePeers[i];
			if (! this.connectedPeers[peer]){
				//not connected, try
				logger("Attempting to connect to " + peer);
				this.connect(peer);
			}
		}
	}
};

hkg.prototype.connect = function (ip){
	var sock = net.createConnection(1999, ip);
	sock.setEncoding("binary");
	var tht = this;
	sock.addListener("connect", function (){
		tht.registerPeer(ip, sock);
	});
	sock.addListener("close", function (){
		tht.unregisterPeer(ip);
	});
	sock.addListener("data", function (data){
		tht.handleBufferResponse(ip, data);
	});
	sock.addListener("error", function (){
		logger("Fail to connect");
	});
	sock.addListener("fullPacket", function (ip, data){
		tht.processRequest(ip, data);
	});
};

hkg.prototype.registerPeer = function (ip, sock){
	if (this.numOfConnected >= this.maxPeers){
		sock.destroy();
		return;
	}
	logger("Register peer: " + ip);
	this.connectedPeers[ip] = sock;
	this.numOfConnected++;
};

hkg.prototype.unregisterPeer = function (ip){
	logger("Unregister peer: " + ip);
	if (this.connectedPeers[ip]){
		delete this.connectedPeers[ip];
		this.numOfConnected--;
	}
};


hkg.prototype.processRequest = function (ip, data){
	if (this.connectedPeers[ip]){
		logger("Got a packet from: " + ip);
		logger("Data: " + data);
		var sock = this.connectedPeers[ip];
		var packet = JSON.parse(data);
		if (! packet.isResponse){
			//consume it
			var responsePacket = {
				id: packet.id,
				isResponse: true
			};
			packet.isResponse = true;
			
			var params = packet.data.params;
			
			switch (packet.data.type){
				case "topics":
					var data = cacheI.readTopics(params.type, params.page, params.timeLimit);
					responsePacket.data = data;
				break;
				
				case "post":
					var data = cacheI.readPost(params.id, params.page, params.timeLimit);
					responsePacket.data = data;
				break;
			}
			
			var pStr = JSON.stringify(responsePacket);
			var dataToWrite = Buffer.byteLength(pStr, "binary") + pStr;
			logger("Data to write: " + dataToWrite);
			sock.write(dataToWrite, "binary");
		}
	}
};

hkg.prototype.request = function (ip, data, callback){
	if (this.connectedPeers[ip]){
		logger("About to write packet to: " + ip);
		var sock = this.connectedPeers[ip];
		var id = packetCounter++;
		var packetID = (+new Date) + "" + id;
		var pStr = JSON.stringify({
			id: packetID,
			data: data
		});
		var dataToWrite = Buffer.byteLength(pStr, "binary") + pStr;
		logger("Data to write: " + dataToWrite);
		sock.write(dataToWrite, "binary");
		var cb = function (toIP, data){
			var packet = JSON.parse(data);
			if (packet.id == packetID){
				//consume it
				sock.removeListener("fullPacket", cb);
				if (typeof callback == "function"){
					callback(packet.data);
				}
			}
		};
		sock.addListener("fullPacket", cb);
	}
};

hkg.prototype.visit = function (url, stream){
	var hkgPatterns = [{
		regex: /http:\/\/forum[0-9]*\.hkgolden\.com\/topics\.aspx\?type=([A-Z]*)&page=([0-9]*)/,
		fn: "topics"
	},{
		regex: /http:\/\/forum[0-9]*\.hkgolden\.com\/topics\.aspx\?type=([A-Z]*)/,
		fn: "topics"
	},{
		regex: /http:\/\/forum[0-9]*\.hkgolden\.com\/view\.aspx\?.*message=([0-9]*).*page=([0-9]*)/,
		fn: "post"
	},{
		regex: /http:\/\/forum[0-9]*\.hkgolden\.com\/view\.aspx\?.*message=([0-9]*).*/,
		fn: "post"
	},{
		regex: /http:\/\/forum[0-9]*\.hkgolden\.com\/faces\/(.*)/,
		fn: "icon"
	}];
	
	for (var i = 0, l = hkgPatterns.length; i < l; i++){
		var hkgPattern = hkgPatterns[i];
		var matches = hkgPattern.regex.exec(url);
		if (matches != null){
			var params = matches;
			params.shift();
			params.unshift(stream);
			return this[hkgPattern.fn].apply(this, params);
		}
	}
	
	return false;
};

hkg.prototype.icon = function (stream, path){
	logger("Using local icon");
	var iconFile = fs.createReadStream("img/faces/" + path);
	iconFile.pipe(stream);
};

hkg.prototype.post = function (stream, id, page){
	var tht = this;
	var render = function (data){
		var viewRenderer = new view("post.template");
		stream.end(viewRenderer.render({
			id: id,
			page: page,
			post: data.post
		}), "binary");
	};
	
	if (page == undefined){
		page = 1;
	}
	var timeLimit = 5000;
	
	var localCache = cacheI.readPost(id, page, timeLimit);
	if (localCache != null){
		logger("Got data from local cache");
		render(localCache);
		return true;
	}
	
	var received = false;
	var req = {
		type: "post",
		params: {
			id: id,
			page: page,
			timeLimit: timeLimit
		}
	};
	
	var resFromPeers = 0;
	var requestedHKG = false;
	
	var cb = function (data){
		logger("Got data");
		
		if ((data != null) && (!received)){
			logger("Data is not null");
			received = true;
			cacheI.writePost(id, page, data);
			//stream.end("Got data: " + JSON.stringify(data), "binary");
			render(data);
		}
		
		resFromPeers++;
		if ((resFromPeers >= tht.numOfConnected) && (! received) && (!requestedHKG)){
			reqHKG();
		}
	};
	
	var reqHKG = function (){
		if ((! received) && (! requestedHKG)){
			//not received, then go to hkgolden directly
			logger("Getting data from hkgolden directly");
			
			requestedHKG = true;
			
			dataSourceI.post(id, page, function (data){
				cb({
					lastModified: (+new Date),
					post: data
				});
			});
		}
	};
	
	if (this.numOfConnected == 0){
		reqHKG();
	}else{
		setTimeout(reqHKG, 3000);
	}
	
	for (var x in this.connectedPeers){
		logger("Requesting " + x + " for post");
		this.request(x, req, cb);
	}
	
	return true;
};

hkg.prototype.topics = function (stream, type, page){
	var tht = this;
	var render = function (data){
		var viewRenderer = new view("topics.template");
		stream.end(viewRenderer.render({
			type: type,
			page: page,
			topics: data.topics
		}), "binary");
	};

	if (page == undefined){
		page = 1;
	}
	
	var timeLimit = 5000;
	
	var localCache = cacheI.readTopics(type, page, timeLimit);
	if (localCache != null){
		logger("Got data from local cache");
		render(localCache);
		return true;
	}
	
	var received = false;
	var req = {
		type: "topics",
		params: {
			type: type,
			page: page,
			timeLimit: timeLimit
		}
	};
	
	var resFromPeers = 0;
	var requestedHKG = false;
	
	var cb = function (data){
		logger("Got data");
		
		if ((data != null) && (!received)){
			logger("Data is not null");
			received = true;
			cacheI.writeTopics(type, page, data);
			render(data);
		}
		
		resFromPeers++;
		if ((resFromPeers >= tht.numOfConnected) && (! received) && (!requestedHKG)){
			reqHKG();
		}
	};
	
	var reqHKG = function (){
		if ((! received) && (! requestedHKG)){
			//not received, then go to hkgolden directly
			logger("Getting data from hkgolden directly");
			
			requestedHKG = true;
			
			dataSourceI.topics(type, page, function (data){
				cb({
					lastModified: (+new Date),
					topics: data
				});
			});
		}
	};
	
	if (this.numOfConnected == 0){
		reqHKG();
	}else{
		setTimeout(reqHKG, 3000);
	}
	
	for (var x in this.connectedPeers){
		logger("Requesting " + x + " for topics");
		this.request(x, req, cb);
	}
	
	return true;
};