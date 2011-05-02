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
		d.setTime(d.getTime() + 8 * 3600 * 1000);
		var min = d.getMinutes();
		var hr = d.getHours();
		var meridiem = "AM";
		if (hr > 12){
			hr = hr - 12;
			meridiem = "PM";
		}
		return (d.getMonth() + 1) + "/" + d.getDate() + "/" + d.getFullYear() + " " + hr + ":" + (min < 10 ? "0" + min : min) + " " + meridiem;
	};
	data.config = config;
	
	return templateNode.tmpl(template, data);
};