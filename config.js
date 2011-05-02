var config = {
	debug: true,
	useUpnp: false, //to be implemented
	
	proxyPort: 8080,
	
	tmpPath: "tmp/",
	userPath: "user/",
	
	hkgoldenServer: function (){
		return 4;
	},
	
	directAccessPaths: [
		"/css/",
		"/img/",
		"/js/"
	],
	
	iconMap: {
		"O:-)": "angel.gif",
		"xx(": "dead.gif",
		":)": "smile.gif",
		":o)": "clown.gif",
		":-(": "frown.gif",
		":~(": "cry.gif",
		";-)": "wink.gif",
		":-[": "angry.gif",
		":-]": "devil.gif",
		":D": "biggrin.gif",
		":O": "oh.gif",
		":P": "tongue.gif",
		"^3^": "kiss.gif",
		"?_?": "wonder.gif",
		"#yup#": "agree.gif",
		"#ng#": "donno.gif",
		"#hehe#": "hehe.gif",
		"#love#": "love.gif",
		"#oh#": "surprise.gif",
		"#cn#": "chicken.gif",
		"#ass#": "ass.gif",
		"[sosad]": "sosad.gif",
		"#good#": "good.gif",
		"#hoho#": "hoho.gif",
		"#kill#": "kill.gif",
		"#bye#": "bye.gif",
		"Z_Z": "z.gif",
		"@_@": "@.gif",
		"#adore#": "adore.gif",
		"???": "wonder2.gif",
		"[banghead]": "banghead.gif",
		"[bouncer]": "bouncer.gif",
		"[bouncy]": "bouncy.gif",
		"[censored]": "censored.gif",
		"[flowerface]": "flowerface.gif",
		"[shocking]": "shocking.gif",
		"[photo]": "photo.gif",
		"#fire#": "fire.gif",
		"[yipes]": "yipes.gif",
		"[369]": "369.gif",
		"[bomb]": "bomb.gif",
		"[slick]": "slick.gif",
		"fuck": "fuck.gif",
		"#no#": "no.gif",
		"#kill2#": "kill2.gif",
		"[offtopic]": "offtopic.gif"
	}
};

config.thisPath = "localhost:" + config.proxyPort;
config.thisHTTPPath = "http://" + config.thisPath + "/";

module.exports = config;