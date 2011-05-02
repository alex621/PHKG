var http = require('http');
var fs = require('fs');
var path = require('path');
var config = require("./config");
var logger = require("./logger");
var qs = require('querystring');
qs.unescape = function (str){
	return unescape(str);
};
qs.escape = function (str){
	return escape(str);
};

module.exports = dataSource;

config.server = config.hkgoldenServer();
config.host = "forum" + config.server + ".hkgolden.com";
config.prefix = "http://" + config.host + "/";

function dataSource(){
	
}

//common function for requesting hkgolden
var request = function (url, callback, method, headers, data){
	if (! method){
		method = "GET";
	}
	
	if (! headers){
		headers = {
			"Host": config.host,
			"Connection": "close"
		};
	}
	
	if (url.substr(0, config.prefix.length) != config.prefix){
		url = config.prefix + url;
	}
	
	var hkg = http.createClient(80, config.host);
	var hkgReq = hkg.request(method, url, headers);
	hkgReq.addListener('response', function(res) {
		res.setEncoding("binary");
		var temp = "";
		var cLength = 0;
		res.addListener('data', function(chunk) {
			temp += chunk;
		});
		res.addListener('end', function() { //full packet received
			if (typeof callback == "function"){
				callback(temp, res.headers);
			}
		});
	});
	if (data != undefined){
		hkgReq.end(data, "binary");
	}else{
		hkgReq.end();
	}
};

dataSource.prototype.getQuote = function (id, rid, callback){
	var reqStr = "{'s_MessageID':" + id + ",'s_ReplyID':" + rid + "}";
	var headers = {
		"Host": config.host,
		"User-Agent": "Mozilla/5.0 (X11; U; Linux i686; zh-TW; rv:1.9) Gecko/2008061015 Firefox/3.0",
		"Referer": config.prefix + "default.aspx",
		"Content-Type": "application/json; charset=utf-8",
		"Content-Length": reqStr.length,
		"Connection": "close"
	};
	
	request("MessageFunc.asmx/quote_message", function (temp, resHeaders){
		if (callback != undefined){
			callback(temp.substr(6, temp.length - 8));
		}
	}, "POST", headers, reqStr);
};

dataSource.prototype.submitPost = function (type, title, content, userInfo, replyTo, callback){
	var gurl;
	if (replyTo) {
		gurl = "post.aspx?mt=Y&ft=" + type + "&rid=0&id=" + replyTo;
	} else {
		gurl = "post.aspx?mt=N&ft=" + type;
	}
	
	var headers1 = {
		"Host": config.host,
		"User-Agent": "Mozilla/5.0 (X11; U; Linux i686; zh-TW; rv:1.9) Gecko/2008061015 Firefox/3.0",
		"Referer": config.prefix + "login.aspx",
		"Cookie": userInfo.session,
		"Connection": "close"
	};
	
	request(gurl, function (temp, resHeaders){
		var inputPattern = /<input name="([^"]*)"/g;
		var inputPattern2 = /<input.*name="([^"]*)".*value="([^"]*)"/g;
		var formData = {};
		var matches;
		while (matches = inputPattern.exec(temp)){
			formData[matches[1]] = "";
		}
		while (matches = inputPattern2.exec(temp)){
			formData[matches[1]] = matches[2];
		}
		
		formData['messagetype'] = 'Y';
		formData['ctl00$ContentPlaceHolder1$ddl_forum_type'] = type;
		formData['ctl00$ContentPlaceHolder1$messagesubject'] = title;
		formData['ctl00$ContentPlaceHolder1$messagetext'] = content;
		formData['ctl00$ContentPlaceHolder1$btn_Submit.x'] = 41;
		formData['ctl00$ContentPlaceHolder1$btn_Submit.y'] = 9;
		formData['ctl00$ContentPlaceHolder1$btn_Submit'] = 'I1';
		
		var postData = qs.stringify(formData);
		var headers2 = {
			"Host": config.host,
			"User-Agent": "Mozilla/5.0 (X11; U; Linux i686; zh-TW; rv:1.9) Gecko/2008061015 Firefox/3.0",
			"Referer": config.prefix + gurl,
			"Content-Length": postData.length,
			"Content-Type": "application/x-www-form-urlencoded",
			"Cookie": userInfo.session,
			"Connection": "close"     
		};
		
		request(gurl, function (temp2, resHeaders2){
			if (callback != undefined){
				callback();
			}
		}, "POST", headers2, postData);
	}, "GET", headers1);
};

dataSource.prototype.login = function (email, password, callback){
	logger("Trying to login");
	var session = "";
	
	var headers1 = {
		"Host": config.host,
		"User-Agent": "Mozilla/5.0 (X11; U; Linux i686; zh-TW; rv:1.9) Gecko/2008061015 Firefox/3.0",
		"Referer": config.prefix + "login.aspx"
	};
	request("login.aspx", function (temp, resHeaders){
		console.log("Got data");
		var inputPattern = /<input name="([^"]*)"/g;
		var inputPattern2 = /<input.*name="([^"]*)".*value="([^"]*)"/g;
		var formData = {};
		var matches;
		while (matches = inputPattern.exec(temp)){
			formData[matches[1]] = "";
		}
		while (matches = inputPattern2.exec(temp)){
			formData[matches[1]] = matches[2];
		}
		formData["ctl00$ContentPlaceHolder1$txt_email"] = email;
		formData["ctl00$ContentPlaceHolder1$txt_pass"] = password;
		formData["ctl00$ContentPlaceHolder1$cb_remember_login"] = "on";
		
		var sessionPattern = /(ASP\.NET_SessionId[^;]*);/g;
		var cookies = resHeaders["set-cookie"];
		for (var i = 0, l = cookies.length; i < l; i++){
			var cookie = cookies[i];
			
			if (matches = sessionPattern.exec(cookie)){
				session = matches[1];
			}
		}
		
		var postData = qs.stringify(formData);
		var headers2 = {
			"Host": config.host,
			"User-Agent": "Mozilla/5.0 (X11; U; Linux i686; zh-TW; rv:1.9) Gecko/2008061015 Firefox/3.0",
			"Referer": config.prefix + "login.aspx",
			"Content-Length": postData.length,
			"Content-Type": "application/x-www-form-urlencoded",
			"Cookie": session,
			"Connection": "close"
		};
		
		console.log("Login");
		console.log(headers2);
		request("login.aspx", function (temp2, resHeaders){
			console.log("Got login data");
			var cookies2 = resHeaders["set-cookie"];
			for (var i = 0, l = cookies2.length; i < l; i++){
				var cookie = cookies2[i];
				var cookiePattern = /^([^;]*);/;
				var match = cookiePattern.exec(cookie);
				session += ";" + match[1];
			}
			console.log(session);
			
			if (typeof callback == "function"){
				callback(session);
			}
		}, "POST", headers2, postData);
	}, "POST", headers1);
};

dataSource.prototype.topics = function (type, page, callback){
	request("topics.aspx?type=" + type + "&page=" + page, function (temp){
		var topicPattern = /<a href=\"view\.aspx\?type=[A-Z]+&message=([0-9]+)\">([^<]*)<\/a>/g;
		var matches;
		var topics = [];
		while (matches = topicPattern.exec(temp)){
			var topic = {
				id: matches[1],
				title: matches[2]
			};
			topics.push(topic);
		}
		
		
		var authorPattern = /<tr id=\"Thread_No[0-9]*\" userid=\"([0-9]+)\" username=\"(.*)\">/g;
		var i = 0;
		while (matches = authorPattern.exec(temp)){
			topics[i].authorID = matches[1];
			topics[i].authorName = matches[2];
			i++;
		}
		
		var lastReplyPattern = /<td style=\"width: 18%;[^>]*>.*([^<]*)<span style=\"color: #800000\">(.*)<\/span><\/td>/g;
		i = 0;
		while (matches = lastReplyPattern.exec(temp)){
			var d = new Date(matches[1] + " " + matches[2]);
			d.setTime(d.getTime() - 8 *3600 * 1000); //reset GMT
			topics[i].lastReplyTime = (+ d);
			i++;
		}
		
		var replyNumPattern = /<td style=\"width: 6%;[^>]*>[^0-9]*([-0-9,]+)<\/td>/g;
		i = 0;
		while (matches = replyNumPattern.exec(temp)){
			topics[i].totalReplies = parseInt(matches[1].replace(",", ""));
			matches = replyNumPattern.exec(temp);
			topics[i].rating = parseInt(matches[1].replace(",", ""));
			i++;
		}
		
		if (typeof callback == "function"){
			callback(topics);
		}
	});
};

dataSource.prototype.post = function (id, page, callback){
	request("view.aspx?message=" + id + "&page=" + page, function (temp){
		var post = {};
		try{
			var topicPattern = /<td class=\"repliers_header\">[.\n\r\t ]*<div style=\"float: left\">([^<]*)<\/div>/g;
			var matches;
			
			matches = topicPattern.exec(temp);
			post.title = matches[1];
			
			var replyNumPattern = /<strong> ([0-9]+)<\/strong>/g;
			matches = replyNumPattern.exec(temp);
			post.replyNum = matches[1];
			
			
			var posts = [];
			var authorInfoPattern = /<tr id=\"Thread.*userid=\"([0-9]*)\" username="([^>]*)">/g;
			var genderPattern = /<a href=\"javascript: ToggleUserDetail.*color: #([0-9A-F]*);">/g;
			var postDatePattern = /<span style=\"font-size: 12px; color:gray;\">[^0-9]*([^<]*)<\/span>/g;
			var contentPattern = /<table class=\"repliers_right\" cellpadding=\"0\" cellspacing=\"0\">[.\n\r\t ]*<tbody><tr>[.\n\r\t ]*<td valign=\"top\">([\W\w]*?)<\/td>/gm;
			var ridPattern = /href=\"post\.aspx\?mt=Y&rid=([0-9]*)&id=.*\">/g;
			var breadcrumbPattern = /<div style=\"padding: 8px 0px 0px 0px;\">[\w\W\n\r\t]*?<a href=\"topics\.aspx\?type=([a-zA-Z]+)\">([^<]*)<\/a>[\w\W\n\r\t]*?<\/div>/gm;
			
			matches = breadcrumbPattern.exec(temp);
			post.category = matches[1];
			post.categoryName = matches[2];
			
			var sc = 0;
			while (matches = authorInfoPattern.exec(temp)){
				var postData = {
					authorID: parseInt(matches[1]),
					authorName: matches[2]
				};
				matches = genderPattern.exec(temp);
				postData.authorGender = (matches[1] == "0066FF" ? "M" : "F");
				matches = postDatePattern.exec(temp);
				var d = new Date(matches[1]);
				d.setTime(d.getTime() - 8 *3600 * 1000); //reset GMT
				postData.postDate = (+d);
				matches = contentPattern.exec(temp);
				postData.content = matches[1];
				matches = ridPattern.exec(temp);
				postData.rid = matches[1];
				posts.push(postData);
			}
			post.posts = posts;
		}catch (e){
			//parse error
		}
		
		
		if (typeof callback == "function"){
			callback(post);
		}
	});
};

dataSource.prototype.channels = function (callback){
	request("", function (temp){
		var channels = [];
		try{
			var channelPattern = /<a class=\"BoxLink2\" href=\"\/topics\.aspx\?type=([A-Z]+)\">(.*?)<\/div>/g;
			
			while (matches = channelPattern.exec(temp)){
				var namePattern = /^([^<]*)/g;
				var tagPattern = /<a[^>]*>(.*?)<\/a>/g;
				var channel = {
					id: matches[1]
				};
				
				var content = matches[2];
				matches = namePattern.exec(content);
				channel.name = matches[1];
				channel.tags = [];
				
				while (tagMatches = tagPattern.exec(content)){
					channel.tags.push(tagMatches[1]);
				}
				
				channels.push(channel);
			}
		}catch (e){
			//parse error
		}
		
		if (typeof callback == "function"){
			callback(channels);
		}
	});
};