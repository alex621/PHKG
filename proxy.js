/*
** Peteris Krumins (peter@catonmat.net)
** http://www.catonmat.net  --  good coders code, great reuse
**
** A simple proxy server written in node.js.
**
*/

var http = require('http');
var sys  = require('sys');
var url = require('url');
var pathLib = require('path');
var fs = require('fs');

var config = require("./config");
var logger = require("./logger");

var thisHost = "localhost:" + config.proxyPort;
var thisPath = pathLib.resolve("", ".");

var hkg = require("./hkg");
var hkgI = new hkg();

process.on('uncaughtException', function (err) {
	//a trick to prevent connection reset error
	logger('Caught exception: ' + err);
});

var server = http.createServer(function(request, response) {
	request.socket.setMaxListeners(100);
	var host = request.headers['host'];
	if (host == thisHost || host == ""){
		//requesting local
		for (var i = 0, l = config.directAccessPaths.length; i < l; i++){
			var path = config.directAccessPaths[i];
			if (request.url.substr(0, path.length) == path){
				//match, then return directly
				var pathName = url.parse(request.url).pathname;
				var realPath = "." + pathName;
				var absRealPath = pathLib.resolve("", realPath);
				
				if (absRealPath.substr(0, thisPath.length) != thisPath){
					//not child path, security risk
					response.end();
					return;
				}
				if (pathLib.existsSync(realPath)){
					var directFile = fs.createReadStream(realPath);
					directFile.pipe(response);
					return;
				}
			}
		}
		response.end();
		return;
	}
	var hkgRegex = /forum[0-9]*\.hkgolden\.com/;
	
	if (request.headers["host"].match(hkgRegex) != null){
		//it is a hkg request
		var consumed = hkgI.visit(request.url, response);
		if (consumed){
			return;
		}
	}

	
	
	var proxy = http.createClient(80, request.headers['host']);
	var proxy_request = proxy.request(request.method, request.url, request.headers);
	proxy_request.addListener('response', function(proxy_response) {
		proxy_response.addListener('data', function(chunk) {
			response.write(chunk);
		});
		proxy_response.addListener('end', function() {
			response.end();
		});
		response.writeHead(proxy_response.statusCode, proxy_response.headers);
	});
	
	request.addListener('data', function(chunk) {
		proxy_request.write(chunk);
	});
	request.addListener('end', function() {
		proxy_request.end();
	});
});

server.listen(config.proxyPort);
logger("Listening on port " + config.proxyPort);