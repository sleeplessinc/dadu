
// Copyright 2011 Sleepless Software Inc. All rights reserved. 

if(typeof process == 'undefined') {

	// Assume we're running in a web browser

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
				var ticking = true;
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
					dbg("onload: "+r.responseText);
					file.ok = true
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
				})
				r.upload.addEventListener("abort", function(e) {
					dbg("abort")
					file.aborted = e
					xfers.error.push(file)
					xfers.filesFailed++
					xfers.current = null
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

	// Assume we're running in Node

	require.paths.unshift("../node_modules")

	var fs = require("fs")
	var http = require("http")
	var url = require("url")
	var log = require("log5")
	var util = require("util"); insp = util.inspect

	var crypto = require("crypto")
	function sha1(s) {var h=crypto.createHash("sha1");h.update(s);return h.digest("hex")}

	var nop = function(){}

	function fail(res, why) {
		var rc = 500

		why = why || "mystery"
		log3("FAIL: "+why)
		s = "ERROR "+rc
		res.writeHead(rc, {
			"Content-Type": "text/plain",
			"Content-Length": s.length
		})
		res.end(s)
	}


	// Static pages delivered using paperboy
	var boy = require("paperboy")
	function www(req, res) {
		log3("boy: "+req.url)
		boy
			.deliver(process.cwd(), req, res)
			.before(function() {
			})
			.after(function() {
				log3("PB OK "+req.method+req.url)
			})
			.error(function(e) {
				fail(res, "error: "+req.url+": "+e)
			})
			.otherwise(function(e) {
				fail(res, "file not found: "+req.url) 
			})
	}


	function get(req, res) {
		var url = req.url

		if(url == "/") {
			req.url = "/dadu.html"
			www(req, res)
			return;
		}

		if(url == "/dadu.js") {
			www(req, res)
			return;
		}

		return fail(res, "file not found: "+url)
	}

	function accept(req, res) {
		log3("accept "+req.method+" "+req.url)

		var method = req.method
		if(method == "GET")
			return get(req, res)
		if(method != "POST")
			return fail(res, "method not supported: "+method+" "+req.url)

		log3("POST "+req.url)

		var u = url.parse(req.url, true)
		var query = u.query
		var file = query.file
		if(!file)
			return fail(res, "no file name")
		if(file.match("/\.\./"))
			return fail(res, "naughty file name: "+file)
		file = file.replace(/[^-._A-Za-z0-9]/g, "_")

		var path = "/tmp"
		fs.mkdir(path, 0777, function(e) {
			var hash = sha1(file + Date())

			if(!e)
				log3(path+" created")

			var rs = req
			path = path+"/"+hash
			log3("tmp fs path is "+path)

			var ws = fs.createWriteStream(path)

			rs.resume();
			rs.addListener("data", function(d) {
				//log3("rs data "+d.length)
				if(ws.write(d) === false)
					rs.pause()
			})
			ws.addListener("pause", function() {
				//log3("ws pause")
				rs.pause()
			})
			ws.addListener("drain", function() {
				//log3("ws drain")
				rs.resume()
			})
			ws.addListener("resume", function() {
				//log3("ws resume")
				rs.resume()
			})
			rs.addListener("end", function() {
				log3("rs end")
				rs.resume()		// took me forever to find this was needed
				ws.end() 
				// xxx
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
				log3("ws error")
				fs.unlink(path)
				fail(res, e)
			})

		})

	}

	var port = 4080
	logLevel = 5

	http.createServer(accept).listen(port)
	log3("listening on "+port+"\n");

}


