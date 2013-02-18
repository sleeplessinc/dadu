
/*
Copyright 2012 Sleepless Software Inc. All rights reserved.

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
	
var j2o = function(j) { try { return JSON.parse(j) } catch(e) { return null } }
var o2j = function(o) { return JSON.stringify(o) }


if((typeof process) !== 'undefined') {

    // node.js

	var seq = 0;

	exports.handleUpload = function(req, res, opts) {

		var crypto = require("crypto")
		var sha1 = function(s) {var h=crypto.createHash("sha1");h.update(s);return h.digest("hex")}

		opts = opts || {};
		var fsPath = opts.fsPath || "./data";
		var reClean = opts.reClean || /[^-._a-z0-9]+/g;

		var cb = function(err, o) {
			o = o || {};
				o.error = err;
			var j = o2j(o);
			res.writeHead(200, {
				//"Access-Control-Allow-Origin": "*",
				"Access-Control-Max-Age": "0",
				"Content-Type": "application/json",
				"Content-Length": j.length
			})
			res.end(j)

			// XXX callback to 
			if(opts.cb) {
				opts.cb(err, path);
			}
		}

		var u = require("url").parse(req.url, true)
		var query = u.query

		var file = query.file || "";
		file = file.toLowerCase().replace(reClean, "_")
		if(!file)
			return cb("No file");
		if(file.match("/\.\./"))
			return cb("Naughty file name: "+file);

		seq += 1;
		var ext = require("path").extname(file)
		var hash = ( sha1( file + ((new Date()).getTime()) + seq ) ).toLowerCase();

		var file = hash + "_" + file;


		var path = fsPath + "/" + file;


		var ws = require("fs").createWriteStream(path)

		req.soFar = 0;

		req.addListener("data", function(d) {
			req.soFar += d.length;
			ws.write(d, "binary")
		})
		
		req.addListener("end", function() {
			ws.end() 
			cb(null, { file: file, size: req.soFar });
		})

	}


	if(require.main === module) {

		//
		// test mode!
		//
	
		var testPort = 4080;
		require('http').createServer(function(req, res) {
			console.log(req.method + " " + req.url);
			var u = require("url").parse(req.url, true)

			var path = u.pathname.substr(1);
			if(path == "") {
				if(u.query.file) {
					exports.handleUpload(req, res);
					return;
				}
				path = "index.html";
			}
			require("fs").readFile(path, function(err, data) {
				if(err) {
					res.end("File not found: "+path);
				}
				else {
					var mime = "text/html";
					if(path.substr(-3) == ".js")
						mime = "application/javascript";
					res.writeHead(200, {
						"Content-Type": mime,
						"Content-Length": data.length
					})
					res.end(data);
				}
			})
		}).listen(testPort);
		console.log("listening on "+testPort);
	}

}
else {

    // browser

	function Dadu( server ) {

		var self = this;

		if( ! server ) {
			var loc = document.location;
			server = loc.protocol + "//" + loc.hostname + ":4080"
		}

		var nop = function(){}
		var xfers = { queue: [], }


		var tick = function(cbStatus, cbSent) {

			if(!xfers.current) {
				// nothing currently being sent

				if(xfers.queue.length < 1) {
					// queue drained. make one last status callback with done=true
					xfers.done = true;
					xfers.soFar = xfers.total
					xfers.percent = 100
					cbStatus(xfers)
					return	// don't restart timer
				}

				// get next file from queue
				var file = xfers.queue.shift()

				// make it the current transfer in progress
				xfers.current = file

				// start sending
				var xhr = null;
				if(typeof ActiveXObject != "undefined") 
					xhr = new ActiveXObject("Microsoft.XMLHTTP");
				else
					xhr = new XMLHttpRequest();

				xhr.upload.addEventListener("progress", function(e) {
					if(e.lengthComputable)
						file.loaded = e.loaded 
				}, false)

				xhr.onload = function() {
					var o = j2o(xhr.responseText) || {error: "Upload failed"};

					file.error = o.error
					file.remoteName = o.file;
					file.remoteSize = o.size;
					xfers.ok.push(file)
					xfers.current = null
					xfers.filesDone++
					cbSent(file)
				}

				xhr.upload.addEventListener("error", function(e) {
					file.error = e
					xfers.error.push(file)
					xfers.filesFailed++
					xfers.current = null
					xfers.filesDone++
				}, false)

				xhr.upload.addEventListener("abort", function(e) {
					file.aborted = e
					xfers.error.push(file)
					xfers.filesFailed++
					xfers.current = null
					xfers.filesDone++
				}, false)

				var url = server + "/?file=" + encodeURIComponent(file.fileName)

				xhr.open("POST", url, true);
				xhr.setRequestHeader("Content-Type", "text/plain") // required for chrome?
				xhr.send(file);

				// XXX should there be a return here?
			}


			// compute overall progress
			xfers.soFar = 0
			for(var i = 0; i < xfers.ok.length; i++) {
				xfers.soFar += xfers.ok[i].size
			}
			for(var i = 0; i < xfers.error.length; i++) {
				xfers.soFar += xfers.error[i].size
			}
			if(xfers.current) {
				xfers.soFar += xfers.current.loaded || 0
			}
			xfers.percent = Math.floor((xfers.soFar * 100) / xfers.total)


			// call back with current status
			cbStatus(xfers)

			setTimeout(tick, 250, cbStatus, cbSent)		// again!
		}


		self.target = function(elem, cbStatus, cbEnter, cbLeave, cbSent) {

			if(!elem)
				return;

			if(typeof cbStatus === "object") {
				var o = cbStatus;
				cbStatus = o.status
				cbEnter = o.enter
				cbLeave = o.leave
				cbSent = o.sent
			}

			cbStatus = cbStatus || nop;
			cbEnter = cbEnter || nop;
			cbLeave = cbLeave || nop;
			cbSent = cbSent || nop;


			elem.ondragenter = function(evt) {
				evt.preventDefault();
				cbEnter(evt)
				return true;
			}

			elem.ondragleave = cbLeave

			elem.ondragover = function(evt) {
				evt.preventDefault();
				return true;
			}

			elem.ondrop = function(evt) {
				evt.preventDefault();

				cbLeave(evt)

				var newFiles = evt.dataTransfer.files
				var idle = false

				if(xfers.queue.length < 1 && !xfers.current) {
					// nothing in queue or in transit; clear counts and arrays
					idle = true
					xfers.ok = []
					xfers.error = []
					xfers.current = null
					xfers.filesTotal = 0
					xfers.filesDone = 0
					xfers.filesFaild = 0
					xfers.total = 0
					xfers.soFar = 0
					xfers.percent = 0
					xfers.done = false
				}

				// add new files to queue.  there may already be transfers in progress
				for(var i = 0; i < newFiles.length; i++) {
					var file = newFiles[i]
					xfers.queue.push(file)
					xfers.total += file.size
					xfers.filesTotal++
					if(file.fileName === undefined) {
						// latest FF
						file.fileName = file.name;
					}
				}

				if(idle)
					tick(cbStatus, cbSent)
			}
		}

	}

}
