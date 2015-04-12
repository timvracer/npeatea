NPMLPB - Node.js Local Package Browser
=========================

[NPMAPI]: https://www.npmjs.org/package/npmapi

A visualization of [NPMAPI] that allows you to browse local projects on a node server based on the configuration file
npmlpb.json as supported by [NPMAPI].  

**[NPMAPI]** is configured via an npmlpb.json file in ther server root directory which defines your projects root
directory as well as specific project directories you are interested in browsing via the API.  

NPM Local Package Browser (LPB) runs as a node.js webserver serving pages and assets, responding to API requests, and providing a socket.io interface to provide
for real-time updates when something relevant changes in the projects being observed.  

You can integrate the LPB into your own projects using the exported API **processRequest**.  You can also enable real time updates
to reflect changes by providing a socket port using **setSocketPort**.

<a target="_blank" href="http://imageshack.com/f/p4hPRXaMp"><img src="http://imagizer.imageshack.us/v2/600x480q90/904/hPRXaM.png" border="0", height="500"></a>

## Installation 

If you are going to run the application directly, simply install the module as a top-level project.  If you want to integrate this into your own application (i.e. admin application for your project), then install as a dependency module in your project directory.  

```
npm install local-package-browser
```

###npmlpb.json configuration file

This is the config file used for specifying scannable projects, or your root project directory (will scan all sub-directories)
A sample file npmlpb.json is included in the install package
**This file must be placed in the application directory where node is running**
```
{
  "projects_rootdir" : "../", 
  "projects" : [         
           {"name" : "npm", "path": "node_modules/npm/"},
           {"name" : "columnify", "path": "node_modules/npm/node_modules/columnify/"}
         ]
}
```

## Running the application

The webserver by default is set to run on ports 1337 (web) and 1338 (socket).  You can change these settings by editing the index.js wrapper file directly.  To start the server, just enter:

```
node index.js
```

This will start the server and the socket listener.  Next, using a modern browser (webkit preferred) navigate to
```
<hostname>:1337/npmapi/index.html
```

If you are testing this locally, then simply use "localhost" for the hostname.  

##Usage

There are 2 primary UI controls to use, the project select list, and the dependency tree.  The project select list in the upper left corner will show you the valid projects that were found based on the npmlpb.json configuration (a valid project with dependencies will have a package.json and a node_modules directory).  Click on the select list, and choose which package you want to view.

The tree list is what you use to browse the dependency tree.  The project selected is at the root of the tree.  You can click the small triangle icons on the list to open up the subtree below any particular level.  When you select a package, it will load that package's information in the right side panel.  The application prioritizes any local information for presentation (package.json, README.md, etc.), but will fetch data directly from npmjs.org if necessary.  Note, there is no API available to fetch README file information from npmjs.org, so only the package.json can be retrieved.  (This is one of many reasons I wrote [NPMAPI]).

Use the tabs at the top of the content pane to switch between viewing the README and the package.json.  For the README, if a ```readmeFilename``` is specified in the package.json, NPMAPI will load that file and return it for viewing, and will ignore any content that might be specified in the ```readme``` property in package.json.


### Integrating into your own application

You can integrate NPMLPB into your own application powered by node.js by leveraging the API exposed in req-handler.js.  The basic idea is to route any /npmapi requests to the provided request handler.  You can inspect the index.js file to see a basic example:
```
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

```
In your own application, you need would set up the socket using ```setSocketPort```, and set the polling rate (how often the server will inspect the file structure for changes) in seconds using ```setFSPollingRate```

In your own webserver (whether you are using express or not), simply route any /npmapi/* calls to ```processRequest``` which will handle it from there.

## License

The MIT License (MIT)

Copyright (c) 2014, Ask.com

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.



