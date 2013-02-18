
# Drag and Drop Upload 

This code module facilitates drag-and-drop file uploads in a web page.

There is a server component and a client (browser code) component.

## Install

	$ npm install dadu

## Server

	$ node dadu.js


### Browser


First create a Dadu object:

	<script src='dadu.js'></script>
	<script>
		var dadu = new Dadu("http://yourserver.com:4080");
	</script>

And then call the target() function within the object with a DOM element:

	<div id=drop>
		[ Drop a file on me.]
	</div>
	<script>
		dadu.target(
			document.getElementById('drop'),
			cbStatus,		// called every 1/4 second or so 
			cbDragEnter,	// called when mouse enters the target element.  
			cbDragExit,		// called when mouse leaves the target element.  
			cbSent			// called when upload is complete 
			);
	</script>

At this point, you can now drag and drop files onto the target element
to upload a file.

The sent() function receives an "xfer" object, which looks something like this:

	{
		"error":null,
		"fileName":"foo.jpg",
		"size":11100,
		"type":"image/jpeg",
		"remoteName":"a7ac539156be4e5f8a74e5f8a72e08b_foo.jpg",
		"remoteSize":11100
	}

The uploaded file will be in "/tmp" on the server machine and it will have the name
indicated by "remoteName".
The remoteName may differ from the name of the file dropped into the browser.

When this "sent" message is received, your own browser code then must
arrange for the file to be copied from "/tmp" on the server to its final location.
This must happen within 15 seconds, after which uploaded file is deleted from "/tmp".

If "error" is not null, then it will be a description of what went wrong.
Otherwise, the upload succeeded.

The status() function receives an object that looks something like this:

	{
		"queue":[],		// array of xfer objects waiting to be sent
		"ok":[],		// array of xfer objects sent successfully
		"error":[],		// array of xfer objects that experienced an error
		"current": {	// the xfer object that is currently being uploaded (if any)
			"fileName":"a7ac539156be4e5f8a74e5f8a72e08b_foo.jpg",
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



## Demo

To demonstrate, run the server in test mode:

	$ npm install dadu
	$ node dadu.js

Then open "http://yourserver:4080" in a browser.
You will get a test page that you can drop files onto.
They will be uploaded and land in "/tmp", then vanish after 15 seconds.


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


