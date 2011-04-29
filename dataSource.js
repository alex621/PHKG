var http = require('http');
var fs = require('fs');
var path = require('path');
var config = require("./config");
var logger = require("./logger");

module.exports = dataSource;

config.server = config.hkgoldenServer();
config.host = "forum" + config.server + ".hkgolden.com";
config.prefix = "http://" + config.host + "/";

function dataSource(){
	
}

//common function for requesting hkgolden
var request = function (url, callback, method, headers){
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
				callback(temp);
			}
		});
	});
	hkgReq.end();
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