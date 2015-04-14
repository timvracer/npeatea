
"use strict";

//
// Wrapper for the app, you can integrate this into your own admin app
// via req-handler.js.  You need to simply instantiate your node
// server, and pass any /npmapi requests to the req-handler.  You also 
// can configure which socket you would like used for the socket.io
// connection to the client JS.
//
var express = require('express');
var npeatea = require('./req-handler.js');

var app = express();

npeatea.setSocketPort(1338);
npeatea.setFSPollingRate(10);  // in seconds

app.get ('/npmapi/*', function(req,res) {
	// process requests intended for npmapi
	return npeatea.processRequest(req,res);
});

app.listen(1337);
console.log('Server running at http://<host>:1337/ : nPeaTea socket on port <host>:1338');
