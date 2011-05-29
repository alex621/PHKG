var fs = require('fs');
var path = require('path');

var config = require('./config');
var dataSource = require('./dataSource');

var dataSourceI = new dataSource();

var user = {
	getInfo: function (){
		var fullPath = config.userPath + "info.json";
		
		var info = {
			isLoggedIn: false
		};
		
		if (path.existsSync(fullPath)){
			var content = fs.readFileSync(fullPath, "binary");
			try{
				var data = JSON.parse(content);
				
				info.isLoggedIn = true;
				info.email = data.email;
				info.password = data.password;
				info.session = data.session;
			}catch (e){
				//parse error
			}
			
			return info;
		}else{
			return info;
		}
	},
	
	login: function (email, password, callback){
		dataSourceI.login(email, password, function (sessionData){
			if (sessionData == "LoginError"){
				callback("LoginError");
				return;
			}
			var fullPath = config.userPath + "info.json";
			var data = {
				email: email,
				password: password,
				session: sessionData
			};
			fs.writeFile(fullPath, JSON.stringify(data), "binary");
			
			callback(user.getInfo());
		});
	},
	
	logout: function (){
		var fullPath = config.userPath + "info.json";
		try{
			fs.unlinkSync(fullPath);
		}catch (e){
			//no such file
		}
	}
};

module.exports = user;