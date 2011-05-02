var http = require('http');
var net = require("net");
var fs = require('fs');
var qs = require('querystring');
qs.unescape = function (str){
	return unescape(str);
};
qs.escape = function (str){
	return escape(str);
};

var cache = require("./cache");
var config = require("./config");
var logger = require("./logger");
var dataSource = require("./dataSource");
var view = require("./view");
var user = require("./user");
var google = require("./google");

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
	//this.channels();
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

hkg.prototype.visit = function (url, data, stream){
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
		regex: /http:\/\/forum[0-9]*\.hkgolden\.com\/post\.aspx\?mt=N&ft=([A-Z]+)/,
		fn: "submitPost"
	},{
		regex: /http:\/\/forum[0-9]*\.hkgolden\.com\/post\.aspx\?mt=Y&id=([0-9]+)&ft=([A-Z]+)&rid=([0-9]+)&page=([0-9]+)/,
		fn: "submitPost"
	},{
		regex: /http:\/\/forum[0-9]*\.hkgolden\.com\/post\.submit/,
		fn: "actSubmitPost"
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
			var _POST = qs.parse(data);
			params.unshift(_POST);
			params.unshift(stream);
			return this[hkgPattern.fn].apply(this, params);
		}
	}
	
	return false;
};


hkg.prototype.icon = function (stream, _POST, path){
	logger("Using local icon");
	var iconFile = fs.createReadStream("img/faces/" + path);
	iconFile.pipe(stream);
	return true;
};

hkg.prototype.channels = function (){
	dataSourceI.channels(function (data){
		if (data != null){
			cacheI.writeChannels({
				lastModified: (+new Date),
				channels: data
			});
		}
	});
	return true;
};

hkg.prototype.actSubmitPost = function (stream, _POST){
	var cb = function (userInfo){
		qs.escape = function (str){
			return escape(str);
		};
		var id = (_POST["id"] ? _POST["id"] : null);
		dataSourceI.submitPost(_POST["type"], _POST["title"], _POST["content"], userInfo, id, function (){
			if (id){
				stream.writeHead(302, {
					"Location": "http://forum6.hkgolden.com/view.aspx?message=" + id + "&page=" + _POST["page"]
				});
			}else{
				stream.writeHead(302, {
					"Location": "http://forum6.hkgolden.com/topics.aspx?type=" + _POST["type"]
				});
			}
			stream.end();
		});
	};

	var userInfo = user.getInfo();
	if (! userInfo.isLoggedIn){
		user.login(_POST.email, _POST.password, cb);
	}else{
		cb(userInfo);
	}
	
	return true;
};

hkg.prototype.submitPost = function (stream, _POST, id, type, rid, page){
	if (! type){
		type = id;
		id = null;
	}

	var channelsData = cacheI.readChannels(3600000);
	var channels = null;
	if (channelsData){
		channels = channelsData.channels;
	}
	
	var iconMap = config.iconMap;
	
	var userInfo = user.getInfo();
	
	var renderFn = function (content){
		var viewRenderer = new view("submitPost.template");
		stream.end(viewRenderer.render({
			id: id,
			type: type,
			rid: rid,
			page: page,
			content: content,
			channels: channels,
			iconMap: iconMap,
			user: userInfo
		}), "binary");
	};
	
	if (rid){
		dataSourceI.getQuote(id, rid, function (content){
			renderFn(content);
		});
	}else{
		renderFn("");
	}
	
	return true;
};

hkg.prototype.standardProcess = function (renderFn, cacheReader, cacheWriter, reqData, dataSourceFn){
	var tht = this;
	
	var localCache = cacheReader();
	if (localCache != null){
		logger("Got data from local cache");
		renderFn(localCache);
		return true;
	}
	
	var received = false;
	var resFromPeers = 0;
	var requestedHKG = false;
	
	var cb = function (data){
		logger("Got data");
		
		if ((data != null) && (!received)){
			logger("Data is not null");
			received = true;
			cacheWriter(data);
			renderFn(data);
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
			
			dataSourceFn(cb);
		}
	};
	
	if (this.numOfConnected == 0){
		reqHKG();
	}else{
		setTimeout(reqHKG, 3000);
	}
	
	for (var x in this.connectedPeers){
		logger("Requesting " + x + " for topics");
		this.request(x, reqData, cb);
	}
};

hkg.prototype.topics = function (stream, _POST, type, page){
	var tht = this;
	var renderFn = function (data){
		var channelsData = cacheI.readChannels(3600000);
		var channels = null;
		if (channelsData){
			channels = channelsData.channels;
		}
		
		var viewRenderer = new view("topics.template");
		stream.end(viewRenderer.render({
			type: type,
			page: page,
			topics: data.topics,
			channels: channels
		}), "binary");
	};

	if (page == undefined){
		page = 1;
	}
	
	var timeLimit = 5000;
	
	var cacheReader = function (){
		return cacheI.readTopics(type, page, timeLimit);
	};
	
	var cacheWriter = function (data){
		cacheI.writeTopics(type, page, data);
	};
	
	var reqData = {
		type: "topics",
		params: {
			type: type,
			page: page,
			timeLimit: timeLimit
		}
	};
	
	var dataSourceFn = function (cb){
		dataSourceI.topics(type, page, function (data){
			cb({
				lastModified: (+new Date),
				topics: data
			});
		});
	};
	
	this.standardProcess(renderFn, cacheReader, cacheWriter, reqData, dataSourceFn);
	
	return true;
};

hkg.prototype.post = function (stream, _POST, id, page){
	var tht = this;
	var renderFn = function (data){
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
	
	var cacheReader = function (){
		return cacheI.readPost(id, page, timeLimit);
	};
	
	var cacheWriter = function (data){
		cacheI.writePost(id, page, data);
	};
	
	var reqData = {
		type: "post",
		params: {
			id: id,
			page: page,
			timeLimit: timeLimit
		}
	};
	
	var dataSourceFn = function (cb){
		dataSourceI.post(id, page, function (data){
			cb({
				lastModified: (+new Date),
				post: data
			});
		});
	};
	
	this.standardProcess(renderFn, cacheReader, cacheWriter, reqData, dataSourceFn);
	
	return true;
};