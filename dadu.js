
// Copyright 2011 Sleepless Software Inc. All rights reserved. 


function isBrowser() { return ((typeof process) == 'undefined') }

if(isBrowser()) {

	var dadu = {

		xfers: { files: [] },

		add: function(target, url, cbStatus, cbEnter, cbLeave) {
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
				var xfers = dadu.xfers,
					newFiles = event.dataTransfer.files, l = newFiles.length, i,
					file, tick

				if(xfers.files.length < 1) {
					// nothing in the queue.  clear counts and arrays
					xfers.ok = []
					xfers.error = []
					xfers.abort = []
					xfers.current = null
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
				}

				tick = function() {
					var r, file, i, loc = document.location

					if(!xfers.current) {
						// nothing currently being sent

						if(l < 1) {
							// queue drained. make one last status callback with done=true
							xfers.done = true;
							if(cbStatus)
								cbStatus(xfers)
							return	// return, don't restart timer
						}

						// get next file from queue
						file = xfers.files.shift()

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
							file.ok = true
							xfers.ok.push(file)
							xfers.current = null
						}
						r.upload.addEventListener("error", function(e) {
							file.error = e
							xfers.error.push(file)
							xfers.current = null
						})
						r.upload.addEventListener("abort", function(e) {
							file.aborted = e
							xfers.abort.push(file)
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

						// make this the current transfer in progress
						xfers.current = file
					}


					// compute overall progress
					xfers.sofar = 0
					for(i = 0; i < xfers.ok.length; i++) {
						xfers.sofar += xfers.ok[i].fileSize
					}
					for(i = 0; i < xfers.error.length; i++) {
						xfers.sofar += xfers.error[i].fileSize
					}
					if(xfers.current)
						xfers.sofar += xfers.current.loaded
					xfers.percent = Math.floor((xfers.sofar * 100) / xfers.total)


					// call back with current status
					if(cbStatus)
						cbStatus(xfers)


					// again
					setTimeout(tick, 2000)
				}

				tick()

			}

		}

	}

}
else {

	require.paths.unshift("../node_modules")

	var fs = require("fs")
	var http = require("http")
	var url = require("url")
	var log = require("log5")
	var util = require("util"); insp = util.inspect


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

			log3("mkdir "+(e ? "exists" : "created")+" "+path)
			var rs = req
			path = path+"/"+file
			log3("file path = "+path)

			var ws = fs.createWriteStream(path)

			rs.resume();
			rs.addListener("data", function(d) {
				log3("rs data "+d.length)
				if(ws.write(d) === false)
					rs.pause()
			})
			ws.addListener("pause", function() {
				log3("ws pause")
				rs.pause()
			})
			ws.addListener("drain", function() {
				log3("ws drain")
				rs.resume()
			})
			ws.addListener("resume", function() {
				log3("ws resume")
				rs.resume()
			})
			rs.addListener("end", function() {
				log3("rs end")
				ws.end() 
				// xxx
				s = "ok"
				res.writeHead(200, {
					"Content-Type": "text/plain",
					"Content-Length": s.length
				})
				res.end(s)
			})
			rs.addListener("close", function(e) {
				log3("rs close")
				ws.end() 
				fs.unlink(path)
				fail(res, e)
			})
			rs.addListener("error", function(e) {
				log3("rs error")
				ws.end() 
				fs.unlink(path)
				fail(res, e)
			})
			ws.addListener("error", function(e) {
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


