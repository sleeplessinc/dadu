
# Drag and Drop Upload

This code facilitates drag-and-drop file uploads in a browser.
For it to work, there has to be both client and server side components.
Both are included here, and both are contained in the one file, "dadu.js".
The code detects if it's running in node.js or a browser and behaves accordingly.

## Install

	$ npm install dadu

## Examples

### Server

For servers, a single function call is provided that handles an http request
given the typical request and response objects.

	dadu = require("dadu");
	require('http').createServer(function(req, res) {
		dadu.handleUpload(req, res);
	}).listen(4080);

The handler will reply to the HTTP client with a JSON formatted "xfer" object (see below).

There are a few options you can pass in with an object.

		var options = {
			// where you want uploaded files to land.  Must already exist
			fsPath: "/tmp",	// this is the default
			// a regular expression used to sanitize filenames before writing
			reClean = /[^-._a-z0-9]+/g;	// this is the default
		}
		dadu.handleUpload(req, res, options);

If you include a callback in the options object,
this will be called with an error,
or the full path of the uploaded file.

		dadu.handleUpload(req, res, {
			cb: function(error, path) {
				if(error)
					console.log("ERROR: "+error);
				else
					// path == the filesystem path where uploaded file was stored
			}
		});


### Browser

Include the dadu.js file:

	<script src='dadu.js'></script>

Create a Dadu object:

	<script>
		dadu = new Dadu();
	</script>

And then call the target() function with a DOM element:

	<div id=drop>
		[ Drop a file on me.]
	</div>
	<script>
		dadu.target( document.getElementById('drop') );
	</script>

At this point, you can now drag and drop files onto the target element
to upload a file.

The target() function can also take an options object:

	<script>
		dadu.target(drop, {
			sent: function(xfer) { },	// called when upload is complete 
			status: function(info) { },	// called every 1/4 second or so 
			enter: function(event) { },	// called when mouse enters the target element.  
			leave: function(event) { },	// called when mouse leaves the target element.  
		})
	</script>


The sent() function receives an "xfer" object, which looks something like this:

	{
		"error":null,
		"fileName":"273853_1565046558_2703087_n.jpg",
		"size":11100,
		"type":"image/jpeg",
		"remoteName":"273853_1565046558_2703087_n.jpg",
		"remoteSize":11100
	}

The remoteName is the filesystem name given to the uploaded file on the server side.
It may differ from the name of the file actually dropped into the browser.

If "error" is not null, then it will be a description of what went wrong.
Otherwise, the upload succeeded.

The status() function receives an object that looks something like this:

	{
		"queue":[],		// array of xfer objects waiting to be sent
		"ok":[],		// array of xfer objects sent successfully
		"error":[],		// array of xfer objects that experienced an error
		"current": {	// the xfer object that is currently being uploaded (if any)
			"fileName":"273853_1565046558_2703087_n.jpg",
			"size":11100,
			"type":"image/jpeg"
						// note that this is same object passed into sent() function, but
						// hasn't had remoteName and remoteSize added as it's not done yet.
		},
		"filesTotal":1,		// num files to send
		"filesDone":0,		// num sent OK
		"filesFaild":0,		// num failed
		"total":11100,		// bytes to send (all files)
		"soFar":0,			// bytes sent so far (all files)
		"percent":0,		// 0 - 100, indicating progress
		"done":false		// true when all files processed and dadu goes idle
	}


Note that the Dadu() constructor function also takes an options argument:

	var dadu = new Dadu({
		port: 4080		// port to expect server to be listening on - default 80
	});



## Demo

To demonstrate, run the server in test mode:

	$ npm install dadu
	$ node dadu.js

Then load localhost:4080 in your browser.
You will get a test page that you can drop files onto.
They will be uploaded and land in "/tmp".


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


