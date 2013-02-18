
# Drag and Drop Upload 

This module facilitates drag-and-drop file uploads in a web page.

There is a server component, a client (browser code) component, and a component
that you have to supply yourself.

## Install

	$ npm install dadu

## Server Component

	$ node dadu.js

The server listens on port 4080 and speaks HTTP.  It performs two jobs:

1. It serves up its own browser code (GET /dadu.js) for use in HTML script tags.
2. It receives uploads (POST /?file=filename) sent by said code.

When the server receives a file, it is renamed to something unique, and stored in
"/tmp" on the server.


## Browser Component

In your web page, first create a Dadu object:

	<script src='dadu.js'></script>
	<script>
		var dadu = new Dadu()
	</script>

And then call the target() function within the object with a DOM element:

	<div id=drop> [ DROP FILES HERE ] </div>
	<script>
		dadu.target(
			document.getElementById('drop'),
			cbStatus,		// called every 1/4 second or with status 
			cbDragEnter,	// called when mouse enters the target element.  
			cbDragExit,		// called when mouse leaves the target element.  
			cbSent			// called when upload is complete 
			);
	</script>

At this point, you can now drag and drop files onto the target element
to upload a file.

When a file is successfully uploaded, 
the "cbSent" function receives an object, that looks something like this:

	{
		"error":null,
		"fileName":"foo.jpg",
		"size":11100,
		"type":"image/jpeg",
		"remoteName":"a7ac539356be4e5f8a74e5f8a72e08b_foo.jpg",
		"remoteSize":11100
	}

The uploaded file will be found at
"/tmp/a7ac539356be4e5f8a74e5f8a72e08b_foo.jpg"
on the server.
Note that remoteName will differ from the name of the file dropped into the browser.

If "error" is not null, then it will be a description of what went wrong.
Otherwise, the upload succeeded.


## Your Component

When th "cbSent" function is called with no error, it's now up to you to deal with
it somehow, and you have to do so within 60 seconds. After that time, the uploaded
copy in "/tmp" is deleted.

One option is to for the browser to perform a XHR/Ajax call to a PHP script,
supplying it the "remoteName".  The PHP script can then copy the file from the
"/tmp" dir to its final location.

Another option is for the dadu server to be instantiated manually and given a callback
function.  That callback function can then do something with the uploaded file.
See the "Server: Advanced" section below.



## Demo

To demonstrate, run the server in test mode:

	$ npm install dadu
	$ node dadu.js

Then open "http://yourserver:4080" in a browser.
You will get a test page that you can drop files onto.
They will be uploaded and land in "/tmp", then vanish after 60 seconds.


## Server: Advanced

Note that the server can also be instantiated manually by using dadu.js as a
node.js module:

	var dadu = require( "dadu" );
	var server = dadu.createServer().listen( my_port );

If you use a port other than 4080 here, you must ensure the browser code is doing so
as well.

There are some options you can include as well, shown here with what are used
as defaults if not provided:

	var dadu = require( "dadu" );
	var server = dadu.createServer({
		seq: 0,				// incremented before each upload; participates in SHA1 hashing
		rmSecs: 60,			// seconds after upload that temp files are deleted
		tmpDir: "/tmp",		// file system dir where uploaded files land
		reClean: /[^-._a-z0-9]+/g,		// used to clean up the names of uploaded files
		cleanRep: "_",		// chars matching reClean in filename are replaced with this
		cbUpload: null,		// called when a file is successfully uploaded:
	}).listen( my_port );


The cbUpload callback will receive 2 args:

- error: null if no error, else string describing error
- info: an object somehing like: { file: "somefilename", size: 12345 });


## Browser Advanced

The status() function receives an object that looks something like this:

	{
		"queue":[],		// array of xfer objects waiting to be sent
		"ok":[],		// array of xfer objects sent successfully
		"error":[],		// array of xfer objects that experienced an error
		"current": {	// the xfer object that is currently being uploaded (if any)
			"fileName":"a7ac539356be4e5f8a74e5f8a72e08b_foo.jpg",
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


