
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

var crypto = require("crypto")
var sha1 = function(s) {var h=crypto.createHash("sha1");h.update(s);return h.digest("hex")}

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
	log(3, "www() root="+root)
	boy
		.deliver(root, req, res)
		.addHeader("Hooptious", "Gruntbuggly")
		.before(function() {
		})
		.after(function() {
			log(2, req.method+req.url)
		})
		.error(function(e) {
			fail(res, "error: "+req.url+": "+e)
		})
		.otherwise(function(e) {
			fail(res, "file not found: "+req.url) 
		})
}


x.log = log	

x.defaults = {
	logLevel: 0,
	port: 4080,
	tmpPath: "./data",
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
		var url = req.url
		if(url == "/dadu.js")
			return www(req, res, path.dirname(module.filename))
		if(test) {
			if(url == "/")
				return www(req, res, path.dirname(module.filename))
			else
				return www(req, res, self.tmpPath)
		}
		fail(res, "file not found: "+req.url) 
	}

	self.accept = function(req, res) {
		log(3, "accept "+req.method+" "+req.url)

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

		log(3, "---- "+file)

		var fpath = self.tmpPath
		fs.mkdir(fpath, 0777, function(e) {
			
			//var hash = sha1(file + Date()) + path.extname(file).toLowerCase()
			var hash = file.toLowerCase().replace(/[^-._a-z0-9]+/g, "_");

			if(!e)
				log(3, fpath+" created")

			var rs = req
			rs.sofar = 0;
			fpath += "/" + hash
			log(3, "writing file to " + fpath)

			var ws = fs.createWriteStream(fpath)

			rs.addListener("data", function(d) {
				log(3, "r data "+d.length+" / "+rs.sofar)
				rs.sofar += d.length;
				//rs.pause()
				ws.write(d, "binary")
				/*if(ws.write(d, "binary") === false) {
					log(3, " ... "+d.length)
					rs.pause()
					log(3, " (read paused) ")
				}*/
			})
			/*
			ws.addListener("pause", function() {
				log(3, "w pause ")
				rs.pause()
			})
			ws.addListener("drain", function() {
				log(3, "w drain ")
				rs.resume()
			})
			
			ws.addListener("resume", function() {
				log(3, "w resume ")
				rs.resume()
			})
			*/
			
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

				/*ws.addListener("drain", function() {
					log(3, "w final drain ")
					//rs.resume()
				//	log(3, " (read resumed) ")
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
				*/
			})
			/*
			rs.addListener("close", function(e) {
				log(1, "r close")
				ws.end() 
				//fs.unlink(path, function(){})
				fail(res, e)
			})
			rs.addListener("error", function(e) {
				log(1, "r error")
				ws.end() 
				//fs.unlink(path, function(){})
				fail(res, e)
			})
			ws.addListener("error", function(e) {
				log(1, "ws error")
				//fs.unlink(path, function(){})
				fail(res, e)
			})
			rs.resume();
			*/

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


