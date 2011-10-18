
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


var dadu = {

	xfers: { files: [] },

	target: function(target, cbStatus, cbEnter, cbLeave, cbSent) {
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
			//dbg("/drop/")

			var newFiles = event.dataTransfer.files
			var l = newFiles.length
			var i, file, tick

			if(xfers.files.length < 1 && !xfers.current) {
				// nothing in queue or in transit; clear counts and arrays
				//dbg("clearing ...")
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
				if(file.fileName === undefined) {
					// latest FF
					file.fileName = file.name;
				}
				//dbg("queueing "+file.fileName+" "+file.fileSize)
			}

			dadu.tick(cbStatus, cbSent)
		}
	},

	tick: function(cbStatus, cbSent) {
		//dbg("dadu.tick");
		var loc = document.location
		var xfers = dadu.xfers
		var l = xfers.files.length
		var r, file, i, url

		if(!xfers.current) {
			//dbg("no xfer in progress ...")
			// nothing currently being sent
			if(l < 1) {
				// queue drained. make one last status callback with done=true
				//dbg("no more files - last callback ...")
				xfers.done = true;
				xfers.sofar = xfers.total
				xfers.percent = 100
				if(cbStatus)
					cbStatus(xfers)
				return	// return, don't restart timer
			}

			// get next file from queue
			file = xfers.files.shift()
			//dbg("next file "+file.fileName)

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

				//dbg("onload: "+hashName+" - " + file.fileName)
				file.ok = true
				file.hashName = hashName
				xfers.ok.push(file)
				xfers.current = null
				xfers.filesDone++
				if(cbSent)
					cbSent(file.fileName, file.hashName)
			}
			r.upload.addEventListener("error", function(e) {
				//dbg("error: " + file.fileName)
				file.error = e
				xfers.error.push(file)
				xfers.filesFailed++
				xfers.current = null
				xfers.filesDone++
			})
			r.upload.addEventListener("abort", function(e) {
				//dbg("abort: " + file.fileName)
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
			//dbg("sending "+file.fileName+" url="+url)
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

		setTimeout(dadu.tick, 1000, cbStatus, cbSent)
	}

}


