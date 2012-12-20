
# Drag and Drop Upload

## Install

	npm install dadu

## Example

### Server

	dadu = require("dadu");
	require('http').createServer(function(req, res) {

		dadu.handleUpload(req, res);

	}).listen(4080);


There are a few options you can pass in with an object.

		var options = {

			// where you want uploaded files to land.  Must already exist
			// default is "/tmp"
			fsPath: "/tmp",
		
			// a regular expression used to sanitize filenames before writing
			// default is /[^-._a-z0-9]+/g;
			reClean = /[^-._a-z0-9]+/g;

		}

		dadu.handleUpload(req, res, options);

And lastly, if you include a callback, this will be called with the full path of
the uploaded file for you.

		dadu.handleUpload(req, res, {
			cb: function(error, path) {
				if(error)
					// something went wrong
				// path == the filesystem path where uploaded file was stored
			}
		});


### Browser

The browser and server both use the exact same dadu.js file.
The code deduces whether it's running in a node process or not and acts accordingly.

	<html>
	<body>
		<div id=drop>Drop a file on me.</div>
		<script src='dadu.js'></script>
		<script>
			var drop = document.getElementById('drop')
			dadu = new Dadu();
			dadu.target(drop);
		</script>
	</body>
	</html>


The target() function also can take an options object.

	dadu.target(drop, {
		sent: function(xfer) {
			// called when upload is complete 
			// arg is the xfer that just completed
			alert('file uploaded ok: ' + o2j(o));
		},
		status: function(xfers) {
			// called every 1/4 second or so with array of xfer objects
		},
		enter: function(event) {
			// called when mouse enters the target element.  
			// so you can do some sort of highlight effect, for example
		},
		leave: function(event) {
			// called when mouse leaves the target element.  
		},
	})


## Test


To test, run the server ...

	node dadu.js

Then load localhost:4080 in your browser.
When the server is in testmode it will return a test page that you can
drop files onto.


## License


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


