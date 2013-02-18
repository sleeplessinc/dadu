
/*
Copyright 2011 Sleepless Software Inc. All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to
deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE. 
*/

var x = exports
var test = (require.main === module)

var fs = require("fs")
var http = require("http")
var https = require("https")
var path = require("path")
var url = require("url")
var util = require("util"); insp = util.inspect
var log = require("log5").mkLog("dadu:")
var findit = require("findit")

var crypto = require("crypto")
var sha1 = function(s) {var h=crypto.createHash("sha1");h.update(s);return h.digest("hex")}

var seq = 0;

var nop = function(){}

var fail = function(res, why) {
	var rc = 500

	why = why || "mystery"
	log(1, "FAIL: "+why)
	s = "ERROR "+rc
	res.writeHead(rc, {
		"Content-Type": "text/plain",
		"Content-Length": s.length
	})
	res.end(s)
}


// Static files delivered using paperboy
var boy = require("paperboy")
var www = function(req, res, root) {
	//log(3, "www() root="+root)
	boy
		.deliver(root, req, res)
		.addHeader("Hooptious", "Gruntbuggly")
		.before(function() {
		})
		.after(function() {
			log(2, req.method+" "+req.url)
		})
		.error(function(e) {
			fail(res, "error: "+req.url+": "+e)
		})
		.otherwise(function(e) {
			fail(res, "file not found: "+req.url) 
		})
}


/*
var dir = function(req, res) {
	var f =  findit.find("./data")
	var first = true
	log(3, "dir")

	res.write("[")

	f.on('directory', function(p, stat) {
		//var s = "dir "+p+"\n"
		//log(3, s)
	});

	f.on('file', function(p, stat) {
		stat.file = path.basename(p)
		if(first)
			first = false
		else
			res.write(",")
		var s = res.write(JSON.stringify(stat))
		//log(3, p)
	});

	f.on('link', function(p, stat) {
		//var s = "link "+p+"\n"
		//log(3, s)
	});

	f.on('end', function() {
		//log(3, "end ")
		res.end("]")
	});
}
*/

var del = function(req, res) {
	var u = url.parse(req.url, true)
	var query = u.query
	var file = query.file
	log(3, "delete "+file)

	fs.unlink("data/"+file, function(e) {
		if( e ) {
			res.end( "error" )
		}
		else {
			res.end("ok")
		}
	})
}



x.log = log	

x.defaults = {
	logLevel: 0,
	port: 4080,
	tmpPath: "data",
	tlsKey: null,
	tlsCert: null,
}

x.Dadu = function(opts) {
	var self = this

	for(key in x.defaults)
		self[key] = x.defaults[key]
	for(key in opts)
		self[key] = opts[key]
	self.opts = opts 

	log(self.logLevel)

	self.get = function(req, res) {
		var u = req.url
		if(u === "/dadu.js")
			return www(req, res, path.dirname(module.filename))
		//if(u == "/dir")
		//	return dir(req, res)
		if(/^\/delete\/?\?/.test(u))
			return del(req, res)
		if(test) {
			if(u == "/")
				return www(req, res, path.dirname(module.filename))
			else
				return www(req, res, self.tmpPath)
		}
		fail(res, "file not found: "+u) 
	}

	self.accept = function(req, res) {
		//log(3, "accept "+req.method+" "+req.url)

		var method = req.method

		if(method == "OPTIONS") {
			res.writeHead(200, {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Max-Age": "0",
			})
			res.end()
			return;
		}
		if(method == "GET")
			return self.get(req, res)
		if(method != "POST")
			return fail(res, "method not supported: "+method+" "+req.url)

		log(3, "POST "+req.url)

		var u = url.parse(req.url, true)
		var query = u.query
		var file = query.file
		if(!file)
			return fail(res, "no file name")
		if(file.match("/\.\./"))
			return fail(res, "naughty file name: "+file)
		file = file.replace(/[^-._A-Za-z0-9]/g, "_")

		var fpath = self.tmpPath
		fs.mkdir(fpath, 0777, function(e) {
			
			//var hash = sha1(file + Date()) + path.extname(file).toLowerCase()
			//var hash = file.toLowerCase().replace(/[^-._a-z0-9]+/g, "_");
			seq += 1;
			var ext = path.extname(file)
			var hash = ( sha1( file + ((new Date()).getTime()) + seq ) + ext ).toLowerCase();

			if(!e)
				log(3, fpath+" created")

			var rs = req
			rs.sofar = 0;
			fpath += "/" + hash
			//log(3, "writing file to " + fpath)

			var ws = fs.createWriteStream(fpath)

			rs.addListener("data", function(d) {
				//log(3, "r data "+d.length+" / "+rs.sofar)
				rs.sofar += d.length;
				ws.write(d, "binary")
			})
			
			rs.addListener("end", function() {
				log(3, "r end "+rs.sofar)

				ws.end() 

				o = {}
				o.hash = hash
				o.filename = ""		// XXX
				o.size = 0		// XXX
				o.ts = 0		// XXX
				var j = JSON.stringify(o);
				res.writeHead(200, {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Max-Age": "0",
					"Content-Type": "text/plain",
					"Content-Length": j.length
				})
				res.end(j)

			})
		})
	}

	self.listen = function(port) {
		port = port || self.port
		self.server.listen(port)
		log(3, "listening on "+port);
	}

	if(self.tlsKey && self.tlsCert) {
		self.server = https.createServer({
			key: fs.readFileSync(self.tlsKey),
			cert: fs.readFileSync(self.tlsCert)
		}, self.accept)
	}
	else {
		self.server = http.createServer(self.accept)
	}
}

x.createServer = function(opts) {
	return new x.Dadu(opts)
}

if(test) {
	// run standalone in test mode
	log("TEST MODE")
	new x.Dadu({logLevel:5}).listen()
}


