var fs = require('fs');
var strip_tags = require("./strip_tags");
var templateNode = require("./template");
var config = require("./config");

module.exports = view;

function view(file){
	this.file = file;
}


view.prototype.render = function (data){
	var template = fs.readFileSync("view/" + this.file, "binary");
	
	data.stripDangerousTags = function (str){
		return strip_tags(str, "<a><img><br><p><div><ol><ul><li><blockquote><del><ins><em><span><strong>");
	};
	data.hkgTimeFormat = function (str){
		var d = new Date(parseInt(str));
		return (d.getMonth() + 1) + "/" + d.getDate() + "/" + d.getFullYear() + " " + d.getHours() + ":" + d.getMinutes();
	};
	data.config = config;
	
	return templateNode.tmpl(template, data);
};