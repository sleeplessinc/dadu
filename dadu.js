
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

	// ========================
    // node.js
	// ========================

	exports.handleUpload = function(req, res, opts) {

		opts = opts || {};
		var fsPath = opts.fsPath || "/tmp";
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
		// ====================
		// test mode
		// ====================
		var testPort = 4080;
		require('http').createServer(function(req, res) {

			console.log(req.method + " " + req.url);
			if(req.url == "/") {
				var data = ""+
"<html>"+"\n"+
"<body>"+"\n"+
"<div id=drop>Drop a file on me.</div>"+"\n"+
"<script src='dadu.js'></script>"+"\n"+
"<script>"+"\n"+
"	dadu = new Dadu({port:"+testPort+"});"+"\n"+
"	dadu.target('drop', {"+"\n"+
"		sent: function(xfer) { alert('file uploaded ok: ' + o2j(xfer)); },"+"\n"+
"	})"+"\n"+
"</script>"+"\n"+
"";
				res.writeHead(200, {
					"Content-Type": "text/html",
					"Content-Length": data.length
				})
				res.end(data);
				return;
			}

			if(req.url == "/dadu.js") {
				require("fs").readFile("dadu.js", function(err, data) {
					res.writeHead(200, {
						"Content-Type": "application/javascript",
						"Content-Length": data.length
					})
					res.end(data);
				})
				return;
			}
		
			exports.handleUpload(req, res);

		}).listen(testPort);
		console.log("listening on "+testPort);
	}

}
else {

	// ========================
    // browser
	// ========================

	var Dadu = function(opts) {

		var self = this;

		opts = opts || {};

		var port = opts.port || 80;

		var xfers = { files: [] }

		self.target = function(target, cbStatus, cbEnter, cbLeave, cbSent) {

			var nop = function() {}


			if(typeof cbStatus === "object") {
				var o = cbStatus;
				cbStatus = o.status || nop();
				cbEnter = o.enter || nop();
				cbLeave = o.leave || nop();
				cbSent = o.sent || nop();
			}


			if(typeof target === "string")
				target = document.getElementById(target)
			if(typeof target !== "object")
				target = document.body

			target.ondragenter = function(event) {
				event.preventDefault();
				if(cbEnter)
					cbEnter(event)
				return true;
			}

			target.ondragleave = cbLeave || nop

			target.ondragover = function(event) {
				event.preventDefault();
				return true;
			}

			target.ondrop = function(event) {
				event.preventDefault();

				(cbLeave || nop)(event)

				var newFiles = event.dataTransfer.files
				var l = newFiles.length
				var ticking = true
				var i, file, tick

				if(xfers.files.length < 1 && !xfers.current) {
					// nothing in queue or in transit; clear counts and arrays
					ticking = false
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
				for(i = 0; i < l; i++) {
					file = newFiles[i]
					xfers.files.push(file)
					xfers.total += file.size
					xfers.filesTotal++
					if(file.fileName === undefined) {
						// latest FF
						file.fileName = file.name;
					}
				}

				if(!ticking)
					self.tick(cbStatus, cbSent)
			}
		}

		self.tick = function(cbStatus, cbSent) {
			var l = xfers.files.length
			var r, file, i

			if(!xfers.current) {
				// nothing currently being sent

				if(l < 1) {
					// queue drained. make one last status callback with done=true
					xfers.done = true;
					xfers.soFar = xfers.total
					xfers.percent = 100
					if(cbStatus)
						cbStatus(xfers)
					return	// don't restart timer
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
				}, false)

				r.onload = function() {
					var o = j2o(r.responseText) || {error: "Upload failed"};

					file.ok = true
					file.remoteName = o.file;
					file.remoteSize = o.size;
					xfers.ok.push(file)
					xfers.current = null
					xfers.filesDone++
					if(cbSent)
						cbSent(file)
				}

				r.upload.addEventListener("error", function(e) {
					alert('Upload error.');
					file.error = e
					xfers.error.push(file)
					xfers.filesFailed++
					xfers.current = null
					xfers.filesDone++
				}, false)

				r.upload.addEventListener("abort", function(e) {
					alert('Upload aborted.');
					file.aborted = e
					xfers.error.push(file)
					xfers.filesFailed++
					xfers.current = null
					xfers.filesDone++
				}, false)

				var url =
					document.location.protocol + "//" +
					document.location.hostname + ":" + port +
					"/?file=" + encodeURIComponent(file.fileName)

				r.open("POST", url, true);
				r.setRequestHeader("Content-Type", "text/plain") // required for chrome?
				r.send(file);
			}


			// compute overall progress
			xfers.soFar = 0
			for(i = 0; i < xfers.ok.length; i++) {
				xfers.soFar += xfers.ok[i].size
			}
			for(i = 0; i < xfers.error.length; i++) {
				xfers.soFar += xfers.error[i].size
			}
			if(xfers.current) {
				xfers.soFar += xfers.current.loaded || 0
			}
			xfers.percent = Math.floor((xfers.soFar * 100) / xfers.total)


			// call back with current status
			if(cbStatus)
				cbStatus(xfers)

			setTimeout(self.tick, 250, cbStatus, cbSent)
		}

	}

/*
	var dadu = {

		xfers: { files: [] },

		target: function(target, cbStatus, cbEnter, cbLeave, cbSent, url) {

			var xfers = dadu.xfers
			var nop = function() {}


			if(typeof cbStatus === "object") {
				var o = cbStatus;
				cbStatus = o.status || nop();
				cbEnter = o.enter || nop();
				cbLeave = o.enter || nop();
				cbSent = o.enter || nop();
			}


			if(typeof target === "string")
				target = document.getElementById(target)
			if(typeof target !== "object")
				target = document.body

			target.ondragenter = function(event) {
				event.preventDefault();
				if(cbEnter)
					cbEnter(event)
				return true;
			}

			target.ondragleave = cbLeave || nop

			target.ondragover = function(event) {
				event.preventDefault();
				return true;
			}

			target.ondrop = function(event) {
				event.preventDefault();

				(cbLeave || nop)(event)

				var newFiles = event.dataTransfer.files
				var l = newFiles.length
				var ticking = true
				var i, file, tick

				if(xfers.files.length < 1 && !xfers.current) {
					// nothing in queue or in transit; clear counts and arrays
					ticking = false
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
				for(i = 0; i < l; i++) {
					file = newFiles[i]
					xfers.files.push(file)
					xfers.total += file.size
					xfers.filesTotal++
					if(file.fileName === undefined) {
						// latest FF
						file.fileName = file.name;
					}
				}

				if(!ticking)
					dadu.tick(cbStatus, cbSent, url)
			}
		},

		tick: function(cbStatus, cbSent, url) {
			var loc = document.location
			var xfers = dadu.xfers
			var l = xfers.files.length
			var r, file, i , url

			if(!xfers.current) {
				// nothing currently being sent
				if(l < 1) {
					// queue drained. make one last status callback with done=true
					xfers.done = true;
					xfers.soFar = xfers.total
					xfers.percent = 100
					if(cbStatus)
						cbStatus(xfers)
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
				}, false)
				r.onload = function() {
					var hashName = r.responseText

					file.ok = true
					file.hashName = JSON.parse(r.responseText).hash
					xfers.ok.push(file)
					xfers.current = null
					xfers.filesDone++
					if(cbSent)
						cbSent(file)
				}
				r.upload.addEventListener("error", function(e) {
					alert('error');
					file.error = e
					xfers.error.push(file)
					xfers.filesFailed++
					xfers.current = null
					xfers.filesDone++
				}, false)
				r.upload.addEventListener("abort", function(e) {
					alert('abort');
					file.aborted = e
					xfers.error.push(file)
					xfers.filesFailed++
					xfers.current = null
					xfers.filesDone++
				}, false)
				//if(!url) {
					url = loc.protocol + "//" + loc.hostname + ":4080"
				//}
				url += "/?file="+encodeURIComponent(file.fileName)
				r.open("POST", url, true);
				r.setRequestHeader("Content-Type", "text/plain") // required for chrome - go figure
				r.send(file);
			}


			// compute overall progress
			xfers.soFar = 0
			for(i = 0; i < xfers.ok.length; i++) {
				xfers.soFar += xfers.ok[i].size
			}
			for(i = 0; i < xfers.error.length; i++) {
				xfers.soFar += xfers.error[i].size
			}
			if(xfers.current) {
				xfers.soFar += xfers.current.loaded || 0
			}
			xfers.percent = Math.floor((xfers.soFar * 100) / xfers.total)


			// call back with current status
			if(cbStatus)
				cbStatus(xfers)

			setTimeout(dadu.tick, 250, cbStatus, cbSent, url)
		}

	}
	*/


}
