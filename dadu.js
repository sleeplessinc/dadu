
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

if(typeof process == 'undefined') {

	// This section of code is the browser client.  It's ignored by the node server

	var dadu = {

		xfers: { files: [] },

		add: function(target, cbStatus, cbEnter, cbLeave) {
			var xfers = dadu.xfers
			var nop = function() {}

			if(typeof target === "string")
				target = document.getElementById(target)
			if(typeof target !== "object")
				target = document.body

			target.ondragenter = function() {
				event.preventDefault();
				if(cbEnter)
					cbEnter(event)
				return true;
			}

			target.ondragleave = cbLeave || nop

			target.ondragover = function() {
				event.preventDefault();
				return true;
			}

			target.ondrop = function(event) {

				(cbLeave || nop)(event)
				dbg("/drop/")

				var newFiles = event.dataTransfer.files
				var l = newFiles.length
				var ticking = true
				var i, file, tick

				if(xfers.files.length < 1 && !xfers.current) {
					// nothing in queue or in transit; clear counts and arrays
					dbg("clearing ...")
					ticking = false;
					xfers.ok = []
					xfers.error = []
					xfers.current = null
					xfers.filesTotal = 0
					xfers.filesDone = 0
					xfers.filesFaild = 0
					xfers.total = 0
					xfers.sofar = 0
					xfers.percent = 0
					xfers.done = false
				}

				// add new files to queue.  there may already be transfers in progress
				for(i = 0; i < l; i++) {
					file = newFiles[i]
					xfers.files.push(file)
					xfers.total += file.fileSize
					xfers.filesTotal++
					dbg("queueing "+file.fileName+" "+file.fileSize)
				}


				if(!ticking)
					dadu.tick(cbStatus)
			}
		},

		tick: function(cbStatus) {
			var loc = document.location
			var xfers = dadu.xfers
			var l = xfers.files.length
			var r, file, i, url

			if(!xfers.current) {
				// nothing currently being sent
				if(l < 1) {
					// queue drained. make one last status callback with done=true
					xfers.done = true;
					xfers.sofar = xfers.total
					xfers.percent = 100
					if(cbStatus)
						cbStatus(xfers)
					if(dadu.tickID == 0)
						clearInterval(dadu.tickID)
					return	// return, don't restart timer
				}

				// get next file from queue
				file = xfers.files.shift()

				// make this the current transfer in progress
				xfers.current = file

				// start sending it
				if(typeof ActiveXObject != "undefined") 
					r = new ActiveXObject("Microsoft.XMLHTTP");
				else
					r = new XMLHttpRequest();
				r.upload.addEventListener("progress", function(e) {
					if(e.lengthComputable)
						file.loaded = e.loaded 
				})
				r.onload = function() {
					var hashName = r.responseText

					dbg("onload: "+hashName)
					file.ok = true
					file.hashName = hashName
					xfers.ok.push(file)
					xfers.current = null
					xfers.filesDone++
				}
				r.upload.addEventListener("error", function(e) {
					dbg("error")
					file.error = e
					xfers.error.push(file)
					xfers.filesFailed++
					xfers.current = null
					xfers.filesDone++
				})
				r.upload.addEventListener("abort", function(e) {
					dbg("abort")
					file.aborted = e
					xfers.error.push(file)
					xfers.filesFailed++
					xfers.current = null
					xfers.filesDone++
				})
				url = loc.protocol +
						"//" +
						loc.hostname +
						":4080/?file=" +
						encodeURIComponent(file.fileName)
				r.open("POST", url, true);
				r.setRequestHeader("Content-Type", "text/plain") // required for chrome - go figure
				r.send(file);
				dbg("send() "+file.fileName)
			}


			// compute overall progress
			xfers.sofar = 0
			for(i = 0; i < xfers.ok.length; i++) {
				xfers.sofar += xfers.ok[i].fileSize
			}
			for(i = 0; i < xfers.error.length; i++) {
				xfers.sofar += xfers.error[i].fileSize
			}
			if(xfers.current) {
				xfers.sofar += xfers.current.loaded || 0
			}
			xfers.percent = Math.floor((xfers.sofar * 100) / xfers.total)


			// call back with current status
			if(cbStatus)
				cbStatus(xfers)

			setTimeout(dadu.tick, 1000, cbStatus)
		}

	}

}
else {

	// This section of code is the node.js server.  It's ignored by the browser.

	var x = exports

	var fs = require("fs")
	var http = require("http")
	var path = require("path")
	var url = require("url")
	var util = require("util"); insp = util.inspect
	var log = require("log5").mkLog()

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


	// Static pages delivered using paperboy
	var boy = require("paperboy")
	var www = function(req, res, root) {
		log(4, "www() root="+root)
		boy
			.deliver(root, req, res)
			.before(function() {
			})
			.after(function() {
				log(2, "PB OK "+req.method+req.url)
			})
			.error(function(e) {
				fail(res, "error: "+req.url+": "+e)
			})
			.otherwise(function(e) {
				fail(res, "file not found: "+req.url) 
			})
	}


	x.defaults = {
		logLevel: 0,
		port: 4080,
		tmpPath: "/tmp/dadu",
		wwwPath: "/tmp/dadu",
		homePath: process.cwd(),
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
			var root = self.wwwPath

			if(url == "/" || url == "/dadu.js")
				root = self.homePath
			www(req, res, root)
		}

		self.accept = function(req, res) {
			log(4, "accept "+req.method+" "+req.url)

			var method = req.method
			if(method == "GET")
				return self.get(req, res)
			if(method != "POST")
				return fail(res, "method not supported: "+method+" "+req.url)

			log(4, "POST "+req.url)

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
				var hash = sha1(file + Date()) + path.extname(file).toLowerCase()

				if(!e)
					log(4, fpath+" created")

				var rs = req
				fpath += "/" + hash
				log(2, "writing file to " + fpath)

				var ws = fs.createWriteStream(fpath)

				rs.resume();
				rs.addListener("data", function(d) {
					//log(3, "rs data "+d.length)
					if(ws.write(d) === false)
						rs.pause()
				})
				ws.addListener("pause", function() {
					//log(3, "ws pause")
					rs.pause()
				})
				ws.addListener("drain", function() {
					//log(3, "ws drain")
					rs.resume()
				})
				ws.addListener("resume", function() {
					//log(3, "ws resume")
					rs.resume()
				})
				rs.addListener("end", function() {
					log(4, "rs end")
					rs.resume()		// took me forever to find this was needed
					ws.end() 
					s = hash
					res.writeHead(200, {
						"Content-Type": "text/plain",
						"Content-Length": s.length
					})
					res.end(s)
				})
				rs.addListener("close", function(e) {
					alert("unexpected codepath")
					ws.end() 
					fs.unlink(path)
					fail(res, e)
				})
				rs.addListener("error", function(e) {
					alert("unexpected codepath")
					ws.end() 
					fs.unlink(path)
					fail(res, e)
				})
				ws.addListener("error", function(e) {
					alert("unexpected codepath")
					log(1, "ws error")
					fs.unlink(path)
					fail(res, e)
				})

			})

		}

		self.listen = function(port) {
			self.server.listen(port || self.port)
		}

		self.server = http.createServer(self.accept)

	}

	if(require.main === module) {
		// run standalone in test mode
		new x.Dadu({logLevel:5}).listen()
		log(1, "Test mode: listening on "+x.defaults.port);
	}

}


