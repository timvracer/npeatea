
"use strict";

//
// Wrapper for the app, you can integrate this into your own admin app
// via req-handler.js.  You need to simply instantiate your node
// server, and pass any /npmapi requests to the req-handler.  You also 
// can configure which socket you would like used for the socket.io
// connection to the client JS.
//
var express = require('express');
var npmlpb = require('./req-handler.js');

var app = express();

npmlpb.setSocketPort(1338);
npmlpb.setFSPollingRate(10);  // in seconds

app.get ('/npmapi/*', function(req,res) {
	// process requests intended for npmapi
	return npmlpb.processRequest(req,res);
});

app.listen(1337);
console.log('Server running at http://<host>:1337/ : npmlpb socket on port <host>:1338');
