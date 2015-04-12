

// keeps track of the currently selected PID
// jsTree does not have a way to add extended data to the element to retreive on selection
// which is.. quite lame
//
var CURR_PID = 0;
var CURR_PJSON = {};
var LICENSE_TREE = {};

// helper function
function exists(a) {return (a!=undefined && a!=null)}

//---------------------------------------------------------------------------------
// startup
//
// called on document ready
//
function startup() {
	//On document ready, load the data for the tree
	//
	$(function() {
		initializeProjectsList();
	});

	// retrieve information about the socket the server is using to communicate information back
	// to the client.  Port is configurable at the server, so we request it here
	$.ajax({

		url: "/npmapi/socket-port",
		dataType: "json",
		type: "GET",
		success: function(obj) {
			if (exists(obj.resp.port)) {
				configureSocketListener(obj.resp.port);
			} else {
				console.log ("No socket provided, dynamic updates disabled");
			}			
			return;
		}	
	});

	// initialize tabs
	$(".tab").click(function(e) {

		el = e.target;
		// hide the viewed pane
		hidePane = $(".tab-selected").attr("targ");
		showPane = $(el).attr("targ");
		$("#"+hidePane).hide();
		$("#"+showPane).show();
		$(".tab-selected").removeClass("tab-selected");
		$(el).addClass("tab-selected");

	});

	// initialize legend reveal;
	$("#legend").click(function(e) {
		$("#legend-reveal").slideToggle(250);
	});

	// simulate "fixed" for the right side control pane (fixed itself won't work on this element)
	$(window).scroll(function() {

		var line = parseInt($("#pkg_container").offset().top) + 0;
	    var winTop = $(window).scrollTop();
	    var divBot = $("#pkg_contents").height();
	    var winSize = $(window).height();

	    var botDiff = Math.max(0, divBot - winSize + 100);
	    var marginOffset = Math.max(0, winTop - line - botDiff);

		$("#pkg_contents").css("margin-top", marginOffset + "px");

	});	
}

//---------------------------------------------------------------------------------
// configureSocketListener
//
// Set up a listener to nodejs events based on the given portnumber
// based on portnum provided by the server
function configureSocketListener (port) {

	// establish socket connection on port provided
	var socket = io(":" + port);
	console.log ("Socket listening on port " + port);

	// set up listener for event "new-plist"
	socket.on('new-plist', function(obj) {
		var sel;
		var jobj;

		console.log ("NEW PLIST EMITTED");
		jobj = JSON.parse(obj);
		console.log(jobj);

		// update the selector list in the UI
		sel = $('#proj-sel-list').val();
		updateSelList(jobj);
		if (exists(sel)) {
			$("#proj-sel-list").val(sel);
		}
		// "flash" the list to indicate the change
		$("#proj-sel-list").removeClass("flash-anim");
		$("#proj-sel-list").addClass("flash-anim");
		$("#fbrowser-btn").removeClass("pulse-anim");
		$("#fbrowser-btn").addClass("pulse-anim");
	});
}


//---------------------------------------------------------------------------------
// initializeProjectsList
//
// Loads the projects that can be browsed from the node server
// and puts them into a select list (handlebars template)
//
function initializeProjectsList() {

	// Detect an anchor tag (hash) in the URL and preserve it
	// on refresh (strip the '#')
    var hash = window.location.hash.replace("#", "");

	$.ajax({

		url: "/npmapi/refresh",
		dataType: "json",
		type: "GET",

		success:function(obj) {
			updateSelList(obj);
			console.log(obj);
			// Select the item in hash if present
			if (hash) {
				$('#proj-sel-list').val(hash);
			}	
			resetTreeFromSelect();
    	}	
  	});
}

//---------------------------------------------------------------------------------
// updateSelList
//
// Update the selection list with new information provided.  Since we overwrite the HTML
// we also re-establish the change and click functions each time called
//
function updateSelList(obj) {
	var source, template, htmlStr;

	// HANDLEBARS templating
	source   = $("#projectSelList").html();
	template = Handlebars.compile(source);
	htmlStr = template(obj);
	$('#proj-sel-container').html(htmlStr);

	// Initialize the change action for the file browse button
	$('#proj-sel-list').change(function() {
		$('#jstree').jstree("destroy");
		$('#license-tree').jstree("destroy");
		resetTreeFromSelect();
	});
	// Initialize the click action for the file browse button
	$('#proj-sel-list').click(function() {
		console.log ("CLICKED");
		$("#proj-sel-list").removeClass("pulse-anim");
		$("#proj-sel-list").removeClass("flash-anim");
		$("#fbrowser-btn").removeClass("pulse-anim");
		$("#fbrowser-btn").removeClass("flash-anim");
	});

}

//---------------------------------------------------------------------------------
// resetTreeFromSelect
//
// When a change occurs on the project list, we reset the
// tree list based on the current selection
// the pid is stored in the value of the select list
//
function resetTreeFromSelect() {
	var sel = $('#proj-sel-list').find(":selected");
	// sel[0] is the first selected item, there will be only 1 as it is a single-select control
	var pid = $(sel[0]).val();
	CURR_PID = pid;
	var txt = $(sel[0]).text();

	// modify the URL anchor
	window.location.hash = "#" + pid;
	// Now load the first project (current selection)
	initializeTree(pid);

}	

//---------------------------------------------------------------------------------
// initializeTree
//
// Load up jstree after making a call to the server to retrieve
// the dependency tree for the given project id
//
function initializeTree(pid) {

	// Makes AJAX call to retrieve the local module list, and then
	// loads it into jstree

	npmapiGetData(pid, function(obj) {

		// load the retrieved data into the jstree object
		CURR_PJSON = obj.packageJson;

		loadData(pid, obj);

		// initialize jstree object
	    // create an instance when the DOM is ready
	    $('#jstree').jstree({
	    	"core" : {
	    		"multiple" : false,
	    		"check_callback" : true
	    	}
	    });

	    // bind to events triggered on the tree
	    $('#jstree').on("changed.jstree", function (e, data) {
	    	processTreeSelect(data.selected);
	    });

		// initialize license-tree object
	    // create an instance when the DOM is ready
	    $('#license-tree').jstree({
	    	"core" : {
	    		"multiple" : false,
	    		"check_callback" : true
	    	}
	    });

	    // bind to events triggered on the license tree
	    $('#license-tree').on("changed.jstree", function (e, data) {
	    	processLicenseTreeSelect(data.selected);
	    });

	    // Calculate the status, but wait 1000ms to free up processing for the main list
	    //
	    setTimeout(function() {

	    	var statsObj;

			statsObj = getStatsFromObj (obj);
			console.log ("totMods = " + statsObj.totMods + " -- Depth = " + statsObj.depth);
			console.log(statsObj);

			// HANDLEBARS templating
			var source   = $("#statsLine").html();
			var template = Handlebars.compile(source);
			htmlStr = template(statsObj);
			$('#stats').html(htmlStr);

			// Initialize click action for the License Report button

			$("#license-button").click(function(e) {

				$("#license-report-container").toggle();
				console.log ("license report click");
				$("#jstree").jstree(true).close_all();
				$("#license-report-label").removeClass("pulse-anim");
				$("#license-report-label").addClass("pulse-anim");
				setTimeout(function() {
					$("#license-report-label").removeClass("pulse-anim");
				}, 1000);
			});


		}, 1000);

	});
}

//---------------------------------------------------------------------------------
// getStatsFromObj
//
// Reursively extract statistics from object - total number of modules as well as the 
// depth of the dependency tree.  
//
function getStatsFromObj(obj) {
	var retObj, 
		i;
	var numMods = 0;
	var depth = 0;

	if (exists(obj.dependencies)) {
		// number of modules represented at this node's depth is the number of dependencies it has
		// we then add the number of modules for each of it's children to get the total number
		// represented at this depth
		numMods = obj.dependencies.length;

		// Now get stats for each child node (recursively)
		for (i=0; i<obj.dependencies.length; i++) {
			retObj = getStatsFromObj(obj.dependencies[i]);
			numMods += retObj.totMods;

			// in examining all dependencies of this node, depth is defined as
			// the one with the largest value
			depth = Math.max(depth,retObj.depth);
		}	
		// add 1 to the depth to include the node we are examining
		return {'totMods' : numMods, 'depth' : depth + 1};
	}	
	// Base case is that this node has no dependencies, it's a leaf node
	// so we return that it has no modules or depth
	return {'totMods' : 0, 'depth' : 0};

}

//---------------------------------------------------------------------------------
// addToLicenseTree
//
// Given an package.json object, and the module path id for it, this will add the entry
// to the license tree to look up modules by license type
function addToLicenseTree (obj, id) {

	if (exists(obj.license)) {
		for (var i = 0; i < obj.license.length; i++) {
			if (exists(LICENSE_TREE[obj.license[i]])) {
				LICENSE_TREE[obj.license[i]].count++;
				LICENSE_TREE[obj.license[i]].names.push(id);
			} else {
				LICENSE_TREE[obj.license[i]] = {};
				LICENSE_TREE[obj.license[i]].count = 1;
				LICENSE_TREE[obj.license[i]].names = [id];
			}
		}
	}
}

//---------------------------------------------------------------------------------
// lineObj
//
// create one line object for the jstree structure
//
function lineObj(pid, id, parent, text) {

	this.id = id;
	this.parent = parent;
	this.text = text;
	this.pid = pid;
}

//---------------------------------------------------------------------------------
// loadData
//
// process the returned object containing all the dependencies for the 
// currently selected project
//
// object is of the form
// {dependencies: {package1: {version: "x.x.x"}} package2: {...}} }
//
// other fields in objects ignored
//
function loadData(pid, obj) {


	var rootObj, 
		el,
		jstobj, licTreeObj;
	var dataObj = [];

	console.log ("loadData :");
	console.log (obj);

	LICENSE_TREE = {};
	rootObj = obj.dependencies;


	var ident = obj.name; // + "@" + obj.version;
	el = new lineObj(pid, obj.name, "#", 
					 "<p class='mod-installed '>" + obj.name + "</p> <p class='vnum'>" + obj.version + "</p>");
	dataObj.push(el);

	loadDataObj (pid, dataObj, rootObj, ident);

	console.log (dataObj);
	console.log (LICENSE_TREE);

	jstobj = { 'core' : {
				'data' : dataObj
			 }};

	$('#jstree').jstree(jstobj);

	// Load up the license tree list using jstree
	//

	var licTreeObj = {'core' : {
						'data' : buildLicenseTreeObj(pid)
	}};

	$('#license-tree').jstree(licTreeObj);

}

//---------------------------------------------------------------------------------
// buildLicenseTreeObj
//
// Recursive function to build the data object for jstree by walking through
function buildLicenseTreeObj (pid) {

	var licObj = [];
	var el, prop, i, name;

	for (prop in LICENSE_TREE) {
		el = new lineObj(pid, prop, '#', "<p class='mod-installed'>" + prop + "<p class= 'vnum'>  - [" + LICENSE_TREE[prop].count + "] </p>");
		licObj.push(el);
		for (i = 0; i < LICENSE_TREE[prop].count; i++) {
			name = LICENSE_TREE[prop].names[i];
			el = new lineObj('module-ref', name, prop, "<p class='mod-installed'>" + name + "</p");
			licObj.push(el);		
		}
	}
	return licObj;
}

//---------------------------------------------------------------------------------
// loadDataObj
//
// Recursive function to build the data object for jstree by walking through
// the rootObj provided.  This function will create a line object in dataObj
// for every module at the given level, and then will recursively call into each
// module IF it also has a dependencies object
//
function loadDataObj(pid, dataObj, rootArr, parent){

	var thisObj, 
		ver, 
		ident, 
		nclass,
		title,
		el;

	if (exists(rootArr)) {

		// iterate over the dependencies array passed in
		for (var i = 0; i < rootArr.length; i++) {
			thisObj = rootArr[i];
			ver = thisObj.version;

			var lineObjComponents = getLineObjComponents(thisObj, parent);
			ident = lineObjComponents.ident;
			nclass = lineObjComponents.nclass;
			title = lineObjComponents.title;


			el = new lineObj(pid, ident, parent, 
							 "<p title='" + title + "' class='" + nclass + "'>" + thisObj.name + "</p> <p class='vnum'>" + ver + "</p>");

			dataObj.push(el);

			// store reference to this object while building the license tree
			addToLicenseTree(thisObj,ident);

			if (exists(thisObj.dependencies)) {
				loadDataObj(pid, dataObj, thisObj.dependencies, ident);
			}
		}
	}
}

//---------------------------------------------------------------------------------
// getLineObjComponents 
//
// for one object, get the components used to contruct the jstree line entry
//
//
function getLineObjComponents(thisObj, parent) {

	var ver = thisObj.version;

	if (exists(thisObj.notInstalled)) {
		ident = parent + "|" + "<ni>" + thisObj.name + '@' + ver;
		if (thisObj.depSource === "primary") {
			nclass = "mod-not-installed";
			title = "Primary Not Installed";
		} else {
			nclass = "mod-dev-not-installed";
			title = "Dev Not Installed";
		}
	} else if (thisObj.depSource == "orphaned") {
		ident = parent + "|" + thisObj.name + '@' + ver;
		nclass = "mod-orphaned";
		title = "Orphaned";
	} else {	
		ident = parent + "|" + thisObj.name + '@' + ver;
		if (exists(thisObj.depSource) && thisObj.depSource == "dev") {
			nclass = "mod-dev-installed";
			title = "Installed Dev";
		} else {
			nclass = "mod-installed";
			title = "Installed Primary";
		}
	}	
	return {"ident" : ident, "nclass": nclass, "title" : title};
}

//---------------------------------------------------------------------------------
// npmapiGetData
//
// Retrieve the dependency tree for the project specified by pid
//
function npmapiGetData(pid, cb) {

	$.ajax({

		url: "/npmapi/modlist",
		data: {"pid": pid},
		dataType: "json",
		type: "GET",
		success:function(obj){
			// server will decycle, must retrocycle
			// this is because the dependency tree will contain circular references (object names)
			obj = JSON.retrocycle(obj.resp);
			console.log(obj);
			cb(obj);
			return;
    	}	
  	});

}

//---------------------------------------------------------------------------------
// ProcessTreeSelect
//
// When an item on the tree list is selected, request it's information from the server
// and display it in the content pane
//
function processTreeSelect(id) {

	var val, 
		strAry, 
		parm2, 
		reqUrl;

	// determine which package to retrieve
	//
	// recall: ident = parent + "|" + thisObj.name + "@" + ver;  -- from loadDataObj
	//
	//parm2 = id[0].slice(2);
	strAry = id[0].split('|');

	console.log(strAry);
	if (!exists(strAry[1])) {
		displayReadMe(CURR_PJSON);
		return;
	}

	parm2 = id[0].slice(id[0].indexOf("|") + 1);

	val = strAry[strAry.length-1];

	dataObj = {"pid" : CURR_PID};
	if (val.substr(0,4) == "<ni>") {
		dataObj.npmmod = val.substr(4);
	} else {
		dataObj.modpath = encodeURIComponent(parm2);
	}
	// retrieve data for val, and fill the 
	// content pane

	$.ajax({

		url: "/npmapi/npminfo",
		data: dataObj,
		dataType: "json",
		type: "GET",

		success:function(obj){
			displayReadMe (obj.resp);
    	}	
  	});

}

function processLicenseTreeSelect(id) {

	var sel=[];

	sel.push($("#jstree").jstree(true).get_selected()); 
	console.log ("Selected: " + id);
	console.log ("previous: " + sel);
	$("#jstree").jstree(true).deselect_node(sel);  // this is causing an error with jstree
	$("#jstree").jstree(true).select_node(id);
}


//---------------------------------------------------------------------------------
// displayReadMe
// display the provided README HTML in the display pane
//
function displayReadMe (info) {

	var source, src2,
		template, tmpl2, htmlStr, htmlStr2;

	if (info.readme != undefined) {
		info.readme = info.readme.replace(/[\n]/g, "\n");
		info.readme = info.readme.replace(/<a href=/g, "<a target='_blank' href=");
	}	

	// HANDLEBARS templating
	source   = $("#npm-content-panel").html();
	template = Handlebars.compile(source);
	htmlStr = template(info);

	// Handle the case where author is not on object, but just a string literal
	if (exists(info.author)) {
		var name;
		if (!exists(info.author.name)) {
			name = info.author;
			info.author = {};
			info.author.name = name;
		}	
	}

	// Animate in the new html for the pcontent pane
	$("#content-holder").fadeOut(250, function() {

		$("#pcontent").html(htmlStr);

		var obj = {};
		obj = prettyPrint(info, {
		    // Config
		    maxArray: 40, // Set max for array display (default: infinity)
		    expanded: true, // Expanded view (boolean) (default: true),
		    maxDepth: 5 // Max member depth (when displaying objects) (default: 3)
		}); 
		$("#jsontable").remove();
		$(obj).first().attr("id", "jsontable");
		$("#pjson-content").append(obj);

		$("#content-holder").fadeIn(250);

	});	

}

