
"use strict";

var serveStatic = require('serve-static');
var finalhandler = require('finalhandler');
var util = require('util');
var npmapi = require('npmapi');
var cycle = require('cycle');
var path = require('path');
var io = require('socket.io');
var _ = require('underscore');


npmapi.setLogger (function(msg){logger(msg)});

// We use dirname so that docroot works from wherever the module in installed in the module tree
var SERVE = serveStatic( __dirname + '/docroot', {'index': ['index.html', 'index.htm']});
var SOCKET_PORT = null;
var TIMER_HANDLE = null;
var VERBOSE = false;

var argv = require('minimist')(process.argv.slice(2));

if (exists(argv.v)) {VERBOSE = true};

//---------------------------------------------------------------------------------
// helper function because I miss coffeescript
function exists(a) {return (a!==undefined && a!==null)}


//---------------------------------------------------------------------------------
// logging function, use your own logger if desired
function logger(msg) {
	if (VERBOSE) {
		console.log ("-> " + msg);
	}
}

//---------------------------------------------------------------------------------
// exported function to allow the caller to set the socket portnumber
// for the server.  
function setSocketPort(portNum) {
	SOCKET_PORT = portNum;
	io = require('socket.io')(portNum);
}

function bind(server, portNum) {
    SOCKET_PORT = portNum;
    io = require('socket.io')(server);
}

//---------------------------------------------------------------------------------
// Poll the filesystem for changes (if requested)
// Will refactor this to use watches (fs.watch) to detect changes to 
// relevant directories
function setFSPollingRate(secs) {
	if (TIMER_HANDLE) {
		clearInterval(TIMER_HANDLE);
	}
	TIMER_HANDLE = setInterval(pollFS, 5*1000);
}	

// Clear, explicit routing table - easy to understand and modify in context.
// processed with a single FIND statement (underscore).  Add your new api processing
// functions below and add to the table to support new routes.  
var NPMLPB_ENDPOINTS = [
	{"key" : "socket-port", "func" : api_socketPort},
	{"key" : "modlist", "func" : api_modlist},
	{"key" : "npminfo", "func" : api_npminfo},
	{"key" : "refresh", "func" : api_refresh},
	{"key" : "plist", "func" : api_plist}
]

//---------------------------------------------------------------------------------
// ProcessRequest
//
// exported function for processing a npmapi request.  
//
function processRequest(req, res) {

	var apiObj;

	logger("REQUEST URL: " + req.url);
	logger(req.query);

	// look in the routing table for an api match
	apiObj = _.find(NPMLPB_ENDPOINTS, function(rec){; return ( ("/npmapi/"+rec.key) === req.path)});

	if (exists(apiObj)) {
		// call the configured API
		return apiObj.func(req, res);
	} else {
		//------------ DEFAULT ROUTE is to try and load the requested file -------------
		// attempt to serve the request as a static asset
		req.url = req.url.replace("/npmapi/", "/");
		logger ("LOADING STATIC: " + __dirname + "/docroot" + req.url);
		var done = finalhandler(req, res);
		SERVE(req,res, done);
		return;
	}
}	

//---------------------------------------------------------------------------------
// return the port number of the configured socket.io connection
function api_socketPort(req, res) {
	var retObj = {};
	retObj.port = SOCKET_PORT;
	writeAPIResponse(null, retObj, res, false);
}

//---------------------------------------------------------------------------------
// return the list of modules and dependencies for the given pid (?pid=<md5>)
function api_modlist(req, res) {
	if (!exists(req.query.pid)) {
		req.query.pid = '0';
	}
	npmapi.getModuleList(req.query.pid, function(err, jsObj) {
		writeAPIResponse(err, jsObj, res, true);
	});	
}

//---------------------------------------------------------------------------------
// getNpmInfo has 2 possible request paramaters.  If only 'npmmod' is specified, it is assumed to be
// module@version, and the API will look up the information from the npm registry via "view"
// if modpath is specified, it will take priority.  It is a full path in the form 
// of #|module@ver|module@ver|module@ver... to the specific package.json you want in the dependency tree.
function api_npminfo(req, res) {
	npmapi.getNpmInfo(req.query, function(err, jsObj) {
		writeAPIResponse(err, jsObj, res, true);
	});	
}

//---------------------------------------------------------------------------------
// forces a reload of the project list, and retuns the refreshed object
function api_refresh(req, res) {
	npmapi.initConfig (function(err, jsObj) {
		writeAPIResponse(err, jsObj, res, false);
	});
}

//---------------------------------------------------------------------------------
// returns the currently cached project list (fast)
function api_plist(req, res) {
	npmapi.getProjectList(function(err, jsObj) {
		writeAPIResponse(err, jsObj, res, false);
	});	
}

//---------------------------------------------------------------------------------
// helper function for API responses which all do the same things when 
// writing out their response
//
function writeAPIResponse(err, jsObj, res, bcycle) {
	var retObj = {};

	retObj.type = "JSON";
	if (err) {
		retObj.status = "error";
		retObj.error = err;
		retObj.resp = {};
	} else {
		retObj.status = "success";
		if (bcycle) {
			jsObj = cycle.decycle(jsObj);
		}	
		retObj.resp = jsObj;
	}
	res.writeHead(200, {"Content-Type": "application/json"});
	res.write(JSON.stringify(retObj));
	res.end();
}

//---------------------------------------------------------------------------------
// Function to detect if there are any changes in the project tree as specified by
// npmlpb.json.  Any detected changes will broadcast a change message and new package
// to all listening clients
//
function pollFS() {

	// Check if the project list has changed
	npmapi.getProjectList(function(err, currObj) {
		if (!err) {
			npmapi.initConfig(function(err, newObj) {
				if (!err) {
					if (JSON.stringify(currObj) !== JSON.stringify(newObj)) {
						var retObj = {};
						retObj.status = "success";
						retObj.resp = newObj;
						io.emit('new-plist', JSON.stringify(retObj));
					}
				}	
			});
		}
	});

}

module.exports.processRequest = processRequest;
module.exports.setSocketPort = setSocketPort;
module.exports.setFSPollingRate = setFSPollingRate;
module.exports.bind = bind;
