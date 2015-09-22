/**
 * ctor
**/
GraphEditor = function(element, options){
	//data
	this._options 		= typeof options !== 'undefined' 					? options 						: {};
	this._nodes 		= typeof this._options.nodes !== 'undefined' 		? this._options.nodes 			: [];
	this._links 		= typeof this._options.links !== 'undefined' 		? this._options.links 			: [];
	this._lastNodeID 	= typeof this._options.lastNodeID !== 'undefined' 	? this._options.lastNodeID 		: 0;

	//settings
	this._div 			= typeof element !== 'undefined'					? element 						: "";
	this._width 		= typeof this._options.width !== 'undefined'		? this._options.width 			: 500;
	this._height 		= typeof this._options.height !== 'undefined'		? this._options.height 			: 500;
	this._charge 		= typeof this._options.carge !== 'undefined'		? this._options.carge 			: -500;
	this._linkDistance 	= typeof this._options.linkDistance !== 'undefined' ? this._options.linkDistance 	: 150;

	//config
	this._radius 		= typeof this._options.radius !== 'undefined' 		? this._options.radius 			: 12;
	this._mouseMode 	= typeof this._options.mouseMode !== 'undefined' 	? this._options.mouseMode 		: true;
	this._textMode 		= typeof this._options.textMode !== 'undefined' 	? this._options.textMode 		: true;
	this._onAddNode 	= typeof this._options.onAddNode !== 'undefined' 	? this._options.onAddNode 		: function(){};
	this._onAddLink 	= typeof this._options.onAddLink !== 'undefined' 	? this._options.onAddLink 		: function(){};
	this._color 		= d3.scale.category10();

	//container
	this._svg = d3.select(this._div)
		.append('svg')
		.attr('class', 'graphEditor_svg')
		.attr('width', this._width)
		.attr('height', this._height);

	//end arrow
	this._svg.append('svg:defs').append('svg:marker')
		.attr('class', 'graphEditor_path')
		.attr('id', 'end-arrow')
		.attr('viewBox', '0 -5 10 10')
		.attr('refX', 6)
		.attr('markerWidth', 3)
		.attr('markerHeight', 3)
		.attr('orient', 'auto')
	.append('svg:path')
		.attr('d', 'M0,-5L10,0L0,5')
		.attr('fill', '#000');

	//start arrow
	this._svg.append('svg:defs').append('svg:marker')
		.attr('class', 'graphEditor_path')
		.attr('id', 'start-arrow')
		.attr('viewBox', '0 -5 10 10')
		.attr('refX', 4)
		.attr('markerWidth', 3)
		.attr('markerHeight', 3)
		.attr('orient', 'auto')
	.append('svg:path')
		.attr('d', 'M10,-5L0,0L10,5')
		.attr('fill', '#000');

	//drag line
	this._drag_line = this._svg.append('svg:path')
		.attr('class', 'graphEditor_path link dragline hidden')
		.attr('d', 'M0,0L0,0');

	//layout
	this._force = d3.layout.force()
		.nodes(this._nodes)
		.links(this._links)
		.size([this._width, this._height])
		.linkDistance(this._linkDistance)
		.charge(this._charge)
		.on('tick', this.tick.bind(this));

	//path and circle container
	this._path = this._svg.append('svg:g').selectAll('path');
	this._circle = this._svg.append('svg:g').selectAll('g');

	//status saves
	this._selected_node = null;
	this._selected_link = null;
	this._mousedown_link = null;
	this._mousedown_node = null;
	this._mouseup_node = null;
	this._lastKeyDown = -1;

	//listener
	this._svg.on('mousedown', this.mousedown.bind(this))
		.on('mousemove', this.mousemove.bind(this))
		.on('mouseup', this.mouseup.bind(this));

	d3.select(window)
		.on('keydown', this.keydown.bind(this))
		.on('keyup', this.keyup.bind(this));

	//initialize
	this.restart();
};

/**
 * method to update nodes and edges
**/
GraphEditor.prototype.tick = function(){
	//update path position
	this._path.attr('d', function(d){
		var deltaX = d.target.x - d.source.x,
			deltaY = d.target.y - d.source.y,
			dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),
			normX = deltaX / dist,
			normY = deltaY / dist,
			sourcePadding = d.left ? 17 : 12,
			targetPadding = d.right ? 17 : 12,
			sourceX = d.source.x + (sourcePadding * normX),
			sourceY = d.source.y + (sourcePadding * normY),
			targetX = d.target.x - (targetPadding * normX),
			targetY = d.target.y - (targetPadding * normY);

		return 'M' + sourceX + ',' + sourceY + 'L' + targetX + ',' + targetY;
	});

	//update circle position
	this._circle.attr('transform', function(d){
		return 'translate(' + d.x + ',' + d.y + ')';
	});
};

/**
 * method to update data (enter / exit / update sections)
**/
GraphEditor.prototype.restart = function restart(){
	var self = this;

	this._path = this._path.data(this._links);

	//update section (path)
	this._path.classed('selected', function(d){ return d === self._selected_link; })
		.style('marker-start', function(d){ return d.left ? 'url(#start-arrow)' : ''; })
		.style('marker-end', function(d){ return d.right ? 'url(#end-arrow)' : ''; });

	//enter section (path)
	this._path.enter().append('svg:path')
		.attr('class', 'graphEditor_path link')
		.classed('selected', function(d){ return d === self._selected_link; })
		.style('marker-start', function(d){ return d.left ? 'url(#start-arrow)' : ''; })
		.style('marker-end', function(d){ return d.right ? 'url(#end-arrow)' : ''; })
		.on('mousedown', this.mousePathUp.bind(self));

	//exit section (path)
	this._path.exit().remove();

	this._circle = this._circle.data(this._nodes, function(d){ return self._nodes.indexOf(d); });

	//update section circle
	this._circle.selectAll('circle')
		.style('fill', function(d){ return (d === self._selected_node) ? d3.rgb(self._color(d.id)).brighter().toString() : self._color(d.id); })
		.classed('reflexive', function(d){ return d.reflexive; });

	//enter section circle
	var g = this._circle.enter().append('svg:g');

	g.append('svg:circle')
		.attr('class', 'graphEditor_circle node')
		.attr('r', this._radius)
		.style('fill', function(d){ return (d === self._selected_node) ? d3.rgb(self._color(d.id)).brighter().toString() : self._color(d.id); })
		.style('stroke', function(d){ return d3.rgb(self._color(d.id)).darker().toString(); })
		.classed('reflexive', function(d){ return d.reflexive; })
		.on('mousedown', this.mouseCircleDown.bind(self))
		.on('mouseup', this.mouseCircleUp.bind(self));

	g.append('svg:text')
		.attr('class', 'graphEditor_circleText graphEditor_circleID')
		.attr('x', 0)
		.attr('y', 4)
		.text(function(d){ return self._textMode ? d.id : ""; });

	//exit section circle
	this._circle.exit().remove();

	//start force
	this._force.start();
};

/**
 * fires if the mouse was clicked on the svg
**/
GraphEditor.prototype.mousedown = function(){
	//return if ctl was pressed / a circle or link is already selected / mouseMode is disabled
	if(d3.event.ctrlKey || this._mousedown_node || this._mousedown_link || !this._mouseMode) return;

	//add new node
	var point = d3.mouse(this._svg.node());
	this.addNode({x : point[0], y : point[1]});
};

/**
 * fires if the mouse was dragged on the svg
**/
GraphEditor.prototype.mousemove = function(){
	//return if mousedown does not started on a circle
	if(!this._mousedown_node) return;

	//draw dragline
	this._drag_line.attr('d', 'M' + this._mousedown_node.x + ',' + this._mousedown_node.y + 'L' + d3.mouse(this._svg.node())[0] + ',' + d3.mouse(this._svg.node())[1]);
	this.restart();
};

/**
 * fires if the mouse was released on the svg
**/
GraphEditor.prototype.mouseup = function(){
	//hide draglinge
	if(this._mousedown_node){
		this._drag_line
			.classed('hidden', true)
			.style('marker-end', '');
	}

	this.resetMouseVars();
};

/**
 * fires if the mouse was clicked on ta circle
**/
GraphEditor.prototype.mouseCircleDown = function(d){
	//return if ctrl is pressed
	if(d3.event.ctrlKey) return;

	//select or deselect node (and deselect link)
	this._mousedown_node = d;
	if(this._mousedown_node === this._selected_node){
		this._selected_node = null;
	}else{
		this._selected_node = this._mousedown_node;
	}
	this._selected_link = null;

	//show drag line
	this._drag_line
		.style('marker-end', 'url(#end-arrow)')
		.classed('hidden', false)
		.attr('d', 'M' + this._mousedown_node.x + ',' + this._mousedown_node.y + 'L' + this._mousedown_node.x + ',' + this._mousedown_node.y);

	this.restart();
};

/**
 * fires if the mouse was released on a circle
**/
GraphEditor.prototype.mouseCircleUp = function(d){
	//return if the mousdown does not started on a circle
	if(!this._mousedown_node) return;

	//hide drag line and arrow
	this._drag_line
		.classed('hidden', true)
		.style('marker-end', '');

	//return if it is still the same circle
	this._mouseup_node = d;
	if(this._mouseup_node === this._mousedown_node){
		this.resetMouseVars();
		return;
	}

	//define source and target circle
	var source, target, left, right;
	if(this._mousedown_node.id < this._mouseup_node.id){
		source = this._mousedown_node;
		target = this._mouseup_node;
		left = false;
		right = true;
	}else{
		source = this._mouseup_node;
		target = this._mousedown_node;
		left = true;
		right = false;
	}

	//add new link
	this.addLink({source : source, target : target, left : left, right : right});
};

/**
 * fires if the mouse was released on a path
**/
GraphEditor.prototype.mousePathUp = function(d){
	//if ctrl is pressed return
	if(d3.event.ctrlKey) return; //not needed

	//select or deselect link (and also deselect node)
	this._mousedown_link = d;
	if(this._mousedown_link === this._selected_link){
		this._selected_link = null;
	}else{
		this._selected_link = this._mousedown_link;
	}
	this._selected_node = null;

	this.restart();
};

/**
 * fires if a key was pressed
**/
GraphEditor.prototype.keydown = function(){

	//general
	d3.event.preventDefault(); //not needed

	//return if a key is pressed
	if(this._lastKeyDown !== -1) return;

	this._lastKeyDown = d3.event.keyCode;

	//
	if(d3.event.keyCode === 17){
		this._circle.call(this._force.drag);
		this._svg.classed('ctrl', true);
	}

	//if no link or node was selected return
	if(!this._selected_node && !this._selected_link) return;

	switch(d3.event.keyCode){
		//delete or backspace - delete node
		case 8:
		case 46:
			if(this._selected_node){
				this._nodes.splice(this._nodes.indexOf(this._selected_node), 1);
				this.spliceLinksForNode(this._selected_node);
			}else if(this._selected_link){
				this._links.splice(this._links.indexOf(this._selected_link), 1);
			}

			this._selected_link = null;
			this._selected_node = null;
			this.restart();
			break;

		//B (both)
		case 66:
			if(this._selected_link){
				this._selected_link.left = true;
				this._selected_link.right = true;
			}
			this.restart();
			break;

		//L (left)
		case 76:
			if(this._selected_link){
				this._selected_link.left = true;
				this._selected_link.right = false;
			}
			this.restart();
			break;

		//R (right)
		case 82:
			if(this._selected_node){
				this._selected_node.reflexive = !this._selected_node.reflexive;
			}else if(this._selected_link){
				this._selected_link.left = false;
				this._selected_link.right = true;
			}
		this.restart();
		break;
	}
};

/**
 * fires if a key was released
**/
GraphEditor.prototype.keyup = function(){
	this._lastKeyDown = -1;

	//do not drag after ctrl was released
	if(d3.event.keyCode === 17){
		this._circle
		.on('mousedown.drag', null)
		.on('touchstart.drag', null);
		this._svg.classed('ctrl', false);
	}
};

/**
 * method to splice links for a node
**/
GraphEditor.prototype.spliceLinksForNode = function(node){
	var self = this;

	//get all links which are connected
	var toSplice = this._links.filter(function(l){
		return (l.source === node || l.target === node);
	});

	//remove them from list
	toSplice.map(function(l){
		self._links.splice(self._links.indexOf(l), 1);
	});
};

/**
 * method to reset mouse variables
**/
GraphEditor.prototype.resetMouseVars = function(){
	this._mousedown_node = null;
	this._mouseup_node = null;
	this._mousedown_link = null;
};

/**
 * method to reload a graph
**/
GraphEditor.prototype.reload = function reload(options){
	options 			= typeof options !== 'undefined'				? options 				: {};
	this._nodes 		= typeof options.nodes !== 'undefined'			? options.nodes 		: [];
	this._links 		= typeof options.links !== 'undefined'			? options.links 		: [];
	this._lastNodeID 	= typeof options.lastNodeID !== 'undefined'		? options.lastNodeID 	: 0;

	this._force.stop();
	this._force = d3.layout.force()
		.nodes(this._nodes)
		.links(this._links)
		.size([this._width, this._height])
		.linkDistance(this._linkDistance)
		.charge(this._charge)
		.on('tick', this.tick.bind(this));

	this.restart();
};

/**
 * method to add a node
**/
GraphEditor.prototype.addNode = function(options){
	options 			= typeof options !== 'undefined'				? options 				: {};
	options.id 			= typeof options.id !== 'undefined'				? options.id 			: ++this._lastNodeID;
	options.x 			= typeof options.x !== 'undefined'				? options.x 			: this._with/2 + Math.random();
	options.y 			= typeof options.y !== 'undefined'				? options.y 			: this._height/2 + Math.random();
	options.reflexive	= typeof options.reflexive !== 'undefined'		? options.reflexive 	: false;

	var node = { id : options.id, reflexive : options.reflexive, x : options.x, y : options.y};

	for(var prop in options)
		node[prop]=options[prop];

	this._nodes.push(node);
	this.restart();
	this._onAddNode(node);
};

/**
 * method to add a link
**/
GraphEditor.prototype.addLink = function(options){
	options 			= typeof options !== 'undefined'				? options 			: {};
	options.source 		= typeof options.source !== 'undefined'			? options.source 	: {}; return;
	options.target		= typeof options.target !== 'undefined'			? options.target 	: {}; return;
	options.left		= typeof options.left !== 'undefined'			? options.left 		: false;
	options.right		= typeof options.right !== 'undefined'			? options.right		: false;


	//get or create link
	var link = this._links.filter(function(l){ return (l.source === options.source && l.target === options.target);})[0];

	//set link values
	if(link){
		link.left = options.left || link.left;
		link.right = options.right || link.right;
	}else{
		link = {source: options.source, target: options.target, left: options.left, right: options.right};
		this._links.push(link);
	}

	this._selected_link = link;
	this._selected_node = null;
	this.restart();
	this._onAddLink(link);
};
