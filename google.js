var http = require('http');
var htmlspecialchars_decode = require("./htmlspecialchars_decode");

module.exports = {
	search: function (keyword, cb){
		var fullPath = "http://www.google.com.hk/search?q=" + keyword;
		
		var client = http.createClient(80, "google.com");
		var req = client.request("GET", fullPath, {
			"Host": "google.com",
			"Connection": "close"
		});
		req.addListener('response', function(res) {
			res.setEncoding("UTF-8");
			var temp = "";
			var cLength = 0;
			res.addListener('data', function(chunk) {
				temp += chunk;
			});
			res.addListener('end', function() { //full packet received
				var resultPattern = /<h3 class=\"r\"><a href=\"([^\"]*)\"[^>]*>(.*?)<\/a>/gm;
				var results = [];
				while (matches = resultPattern.exec(temp)){
					results.push({
						url: htmlspecialchars_decode(matches[1]),
						title: matches[2]
					});
				}
				
				if (typeof cb == "function"){
					cb(results);
				}
			});
		});
		req.end();
	}
};