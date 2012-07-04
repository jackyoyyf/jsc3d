/**
	@preserve Copyright (c) 2011 Humu humu2009@gmail.com
	jsc3d is freely distributable under the terms of the MIT license.

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
**/


/**
	@namespace JSC3D
*/
JSC3D = {};


/**
	@class Viewer

	Viewer is the main class of JSC3D. It provides presentation of and interaction with a simple static 3D scene 
	which can either be given as the url of the scene file, or be manually constructed and passed in. It 
	also provides some settings to adjust the mode and quality of the rendering.<br /><br />

	Viewer should be constructed with an existing canvas object where to perform the rendering.<br /><br />

	Viewer provides 3 way to specify the scene:<br />
	1. Use setParameter() method before initilization and set 'SceneUrl' parameter with a valid url  
	   that describes where to load the scene. <br />
	2. Use replaceSceneFromUrl() method, passing in a valid url to load/replace scene at runtime.<br />
	3. Use replaceScene() method, passing in a manually constructed scene object to replace the current one 
	   at runtime.<br />
*/
JSC3D.Viewer = function(canvas) {
	this.params = {
		SceneUrl: '', 
		InitRotationX: 0, 
		InitRotationY: 0, 
		InitRotationZ: 0, 
		ModelColor: '#caa618', 
		BackgroundColor1: '#ffffff', 
		BackgroundColor2: '#383840', 
		RenderMode: 'flat', 
		Definition: 'standard', 
		MipMapping: 'off', 
		SphereMapUrl: ''
	};

	this.canvas = canvas;
	this.ctx = null;
	this.canvasData = null;
	this.bkgColorBuffer = null;
	this.colorBuffer = null;
	this.zBuffer = null;
	this.selectionBuffer = null;
	this.frameWidth = canvas.width;
	this.frameHeight = canvas.height;
	this.scene = null;
	this.defaultMaterial = null;
	this.sphereMap = null;
	this.isLoaded = false;
	this.isFailed = false;
	this.errorMsg = '';
	this.needUpdate = false;
	this.needRepaint = false;
	this.initRotX = 0;
	this.initRotY = 0;
	this.initRotZ = 0;
	this.zoomFactor = 1;
	this.rotMatrix = new JSC3D.Matrix3x4;
	this.transformMatrix = new JSC3D.Matrix3x4;
	this.sceneUrl = '';
	this.modelColor = 0xcaa618;
	this.bkgColor1 = 0xffffff;
	this.bkgColor2 = 0x383840;
	this.renderMode = 'flat';
	this.definition = 'standard';
	this.isMipMappingOn = false;
	this.sphereMapUrl = '';
	this.buttonStates = {};
	this.keyStates = {};
	this.mouseX = 0;
	this.mouseY = 0;
	this.onmousedown = null;
	this.onmouseup = null;
	this.onmousemove = null;
	this.beforeupdate = null;
	this.afterupdate = null;
	this.isDefaultInputHandlerEnabled = true;

	// setup input handlers
	var self = this;
	this.canvas.addEventListener('mousedown', function(e){self.mouseDownHandler(e);}, false);
	this.canvas.addEventListener('mouseup', function(e){self.mouseUpHandler(e);}, false);
	this.canvas.addEventListener('mousemove', function(e){self.mouseMoveHandler(e);}, false);
	document.addEventListener('keydown', function(e){self.keyDownHandler(e);}, false);
	document.addEventListener('keyup', function(e){self.keyUpHandler(e);}, false);
};

/**
	Set the initial value for a parameter to parameterize the viewer.<br />
	Available parameters are:<br />
	'<b>SceneUrl</b>':         url string that describes where to load the scene, default: '';<br />
	'<b>InitRotationX</b>':    initial rotation angle around x-axis for the whole scene, default: 0;<br />
	'<b>InitRotationY</b>':    initial rotation angle around y-axis for the whole scene, default: 0;<br />
	'<b>InitRotationZ</b>':    initial rotation angle around z-axis for the whole scene, default: 0;<br />
	'<b>ModelColor</b>':       fallback color for all meshes, default: '#caa618';<br />
	'<b>BackgroundColor1</b>': color at the top of the background, default: '#ffffff';<br />
	'<b>BackgroundColor2</b>': color at the bottom of the background, default: '#383840';<br />
	'<b>RenderMode</b>':       render mode, default: 'flat';<br />
	'<b>Definition</b>':       quality level of rendering, default: 'standard';<br />
	'<b>MipMapping</b>':       turn on/off mip-mapping, default: 'off';<br />
	'<b>SphereMapUrl</b>':     url string that describes where to load the image used for sphere mapping, default: ''.<br />
	@param {string} name name of the parameter to set.
	@param value new value for the parameter.
*/
JSC3D.Viewer.prototype.setParameter = function(name, value) {
	this.params[name] = value;
};

/**
	Initialize viewer for rendering and interactions.
*/
JSC3D.Viewer.prototype.init = function() {
	this.sceneUrl = this.params['SceneUrl'];
	this.initRotX = parseFloat(this.params['InitRotationX']);
	this.initRotY = parseFloat(this.params['InitRotationY']);
	this.initRotZ = parseFloat(this.params['InitRotationZ']);
	this.modelColor = parseInt('0x' + this.params['ModelColor'].substring(1));
	this.bkgColor1 = parseInt('0x' + this.params['BackgroundColor1'].substring(1));
	this.bkgColor2 = parseInt('0x' + this.params['BackgroundColor2'].substring(1));
	this.renderMode = this.params['RenderMode'].toLowerCase();
	this.definition = this.params['Definition'].toLowerCase();
	this.isMipMappingOn = this.params['MipMapping'].toLowerCase() == 'on';
	this.sphereMapUrl = this.params['SphereMapUrl'];

	try {
		this.ctx = this.canvas.getContext('2d');
		this.canvasData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
	}
	catch(e) {
		this.ctx = null;
		this.canvasData = null;
	}

	if(this.canvas.width <= 2 || this.canvas.height <= 2)
		this.definition = 'standard';
	
	switch(this.definition) {
	case 'low':
		this.frameWidth = ~~((this.canvas.width + 1) / 2);
		this.frameHeight = ~~((this.canvas.height + 1) / 2);
		break;
	case 'high':
		this.frameWidth = this.canvas.width * 2;
		this.frameHeight = this.canvas.height * 2;
		break;
	case 'standard':
	default:
		this.frameWidth = this.canvas.width;
		this.frameHeight = this.canvas.height;
		break;
	}

	this.zoomFactor = 1;
	this.rotMatrix.identity();
	this.transformMatrix.identity();
	this.isLoaded = false;
	this.isFailed = false;
	this.errorMsg = '';
	this.needUpdate = false;
	this.needRepaint = false;
	this.scene = null;
	// allocate memory storage for frame buffers
	this.colorBuffer = new Array(this.frameWidth * this.frameHeight);
	this.zBuffer = new Array(this.frameWidth * this.frameHeight);
	this.selectionBuffer = new Array(this.frameWidth * this.frameHeight);
	this.bkgColorBuffer = new Array(this.frameWidth * this.frameHeight);
	this.generateBackground();
	// create a default material for rendring of meshes that don't have one
	this.defaultMaterial = new JSC3D.Material;
	this.defaultMaterial.ambientColor = 0;
	this.defaultMaterial.diffuseColor = this.modelColor;
	this.defaultMaterial.transparency = 0;
	this.defaultMaterial.simulateSpecular = true;
	this.drawBackground();

	// set a timer to wake up update routine per 30 milliseconds
	var self = this;
	setInterval(function(){self.doUpdate();}, 30);

	// load scene if any
	this.loadScene();
	
	// load sphere mapping image if any
	this.setSphereMapFromUrl(this.sphereMapUrl);
};

/**
	Ask viewer to render a new frame or just repaint last frame.
	@param {boolean} repaintOnly true to repaint last frame; false(default) to render a new frame.
*/
JSC3D.Viewer.prototype.update = function(repaintOnly) {
	if(this.isFailed) {
		this.reportError(this.errorMsg);
		return;
	}

	if(repaintOnly)
		this.needRepaint = true;
	else
		this.needUpdate = true;
};

/**
	Set rotation angles of the whole scene around axis vectors.
	@param {float} rotX rotation angle around x-axis in degrees.
	@param {float} rotY rotation angle around y-axis in degrees.
	@param {float} rotZ rotation angle around z-axis in degrees.
*/
JSC3D.Viewer.prototype.rotate = function(rotX, rotY, rotZ) {
	this.rotMatrix.rotateAboutXAxis(rotX);
	this.rotMatrix.rotateAboutYAxis(rotY);
	this.rotMatrix.rotateAboutZAxis(rotZ);
};

/**
	Set render mode.<br />
	Available render modes are:<br />
	'<b>point</b>':         render meshes as point clouds;<br />
	'<b>wireframe</b>':     render meshes as wireframe;<br />
	'<b>flat</b>':          render meshes as solid objects using flat shading;<br />
	'<b>smooth</b>':        render meshes as solid objects using smooth shading;<br />
	'<b>texture</b>':       render meshes as solid textured objects, no lighting will be apllied;<br />
	'<b>textureflat</b>':   render meshes as solid textured objects, lighting will be calculated per face;<br />
	'<b>texturesmooth</b>': render meshes as solid textured objects, lighting will be calculated per vertex and interpolated.<br />
	@param {string} mode new render mode.
*/
JSC3D.Viewer.prototype.setRenderMode = function(mode) {
	this.params['RenderMode'] = mode;
	this.renderMode = mode;
};

/**
	Set quality level of rendering.<br />
	Available quality levels are:<br />
	'<b>low</b>':      low-quality rendering will be applied, with highest performance;<br />
	'<b>standard</b>': normal-quality rendering will be applied, with modest performace;<br />
	'<b>high</b>':     high-quality rendering will be applied, with lowest performace.<br />
	@params {string} definition new quality level.
*/
JSC3D.Viewer.prototype.setDefinition = function(definition) {
	if(this.canvas.width <= 2 || this.canvas.height <= 2)
		definition = 'standard';

	if(definition == this.definition)
		return;
	
	this.params['Definition'] = definition;
	this.definition = definition;

	var oldFrameWidth = this.frameWidth;

	switch(this.definition) {
	case 'low':
		this.frameWidth = ~~((this.canvas.width + 1) / 2);
		this.frameHeight = ~~((this.canvas.height + 1) / 2);
		break;
	case 'high':
		this.frameWidth = this.canvas.width * 2;
		this.frameHeight = this.canvas.height * 2;
		break;
	case 'standard':
	default:
		this.frameWidth = this.canvas.width;
		this.frameHeight = this.canvas.height;
		break;
	}

	var newSize = this.frameWidth * this.frameHeight;
	if(this.colorBuffer.length < newSize)
		this.colorBuffer = new Array(newSize);

	if(this.zBuffer.length < newSize)
		this.zBuffer = new Array(newSize);

	if(this.selectionBuffer.length < newSize)
		this.selectionBuffer = new Array(newSize);

	if(this.bkgColorBuffer.length < newSize)
		this.bkgColorBuffer = new Array(newSize);

	this.generateBackground();

	// zoom factor should be adjusted, 
	// otherwise there would be an abrupt zoom-in or zoom-out on next frame
	this.zoomFactor *= this.frameWidth / oldFrameWidth;
};

/**
	Specify a new image from the given url which will be used for applying sphere mapping.
	@param {string} sphereMapUrl url string that describes where to load the image.
*/
JSC3D.Viewer.prototype.setSphereMapFromUrl = function(sphereMapUrl) {
	if(sphereMapUrl == '') {
		this.sphereMap = null;
		return;
	}

	this.params['SphereMapUrl'] = sphereMapUrl;
	this.sphereMapUrl = sphereMapUrl;

	var self = this;
	var newSphereMap = new JSC3D.Texture;

	newSphereMap.onready = function() {
		self.sphereMap = newSphereMap;
		self.update();
	};

	newSphereMap.createFromUrl(this.sphereMapUrl);
};

/**
	Enable/Disable the default mouse and key event handling routines.
	@param {boolean} enabled true to enable the default handler; false to disable them.
*/
JSC3D.Viewer.prototype.enableDefaultInputHandler = function(enabled) {
	this.isDefaultInputHandlerEnabled = enabled;
};

/**
	Load a new scene from the given url to replace the current scene.
	@param {string} sceneUrl url string that describes where to load the new scene.
*/
JSC3D.Viewer.prototype.replaceSceneFromUrl = function(sceneUrl) {
	this.params['SceneUrl'] = sceneUrl;
	this.sceneUrl = sceneUrl;
	this.isFailed = this.isLoaded = false;
	this.loadScene();
};

/**
	Replace the current scene with a given scene.
	@param {JSC3D.Scene} scene the given scene.
*/
JSC3D.Viewer.prototype.replaceScene = function(scene) {
	this.params['SceneUrl'] = '';
	this.sceneUrl = '';
	this.isFailed = false;
	this.isLoaded = true;
	this.errorMsg = '';
	this.setupScene(scene);
};

/**
	Get the current scene.
	@returns {JSC3D.Scene} the current scene.
*/
JSC3D.Viewer.prototype.getScene = function() {
	return this.scene;
};

/**
	Query information at a given position on the canvas.
	@param {float} clientX client x coordinate on the current page.
	@param {float} clientY client y coordinate on the current page.
	@returns {JSC3D.PickInfo} a PickInfo object which hold the result.
*/
JSC3D.Viewer.prototype.pick = function(clientX, clientY) {
	var pickInfo = new JSC3D.PickInfo;

	var canvasRect = this.canvas.getBoundingClientRect();
	var canvasX = clientX - canvasRect.left;
	var canvasY = clientY - canvasRect.top;
	
	var frameX = canvasX;
	var frameY = canvasY;
	if( this.selectionBuffer != null && 
		canvasX >= 0 && canvasX < this.canvas.width && 
		canvasY >= 0 && canvasY < this.canvas.height ) {
		switch(this.definition) {
		case 'low':
			frameX = ~~(frameX / 2);
			frameY = ~~(frameY / 2);
			break;
		case 'high':
			frameX *= 2;
			frameY *= 2;
			break;
		case 'standard':
		default:
			break;
		}

		var pickedId = this.selectionBuffer[frameY * this.frameWidth + frameX];
		if(pickedId > 0) {
			var meshes = this.scene.getChildren();
			for(var i=0; i<meshes.length; i++) {
				if(meshes[i].internalId == pickedId) {
					pickInfo.mesh = meshes[i];
					break;
				}
			}
		}
	}

	pickInfo.canvasX = canvasX;
	pickInfo.canvasY = canvasY;
	if(pickInfo.mesh)
		pickInfo.depth = this.zBuffer[frameY * this.frameWidth + frameX];

	return pickInfo;
};

/**
	Render a new frame or repaint last frame.
	@private
*/
JSC3D.Viewer.prototype.doUpdate = function() {
	if(this.needUpdate || this.needRepaint) {
		if(this.beforeupdate != null && (typeof this.beforeupdate) == 'function')
			this.beforeupdate();

		if(this.scene) {
			if(this.needUpdate && this.colorBuffer != null) {
				this.beginScene();
				this.render();
				this.endScene();
			}

			this.paint();
		}
		else {
			this.drawBackground();
		}

		this.needRepaint = false;
		this.needUpdate = false;

		if(this.afterupdate != null && (typeof this.afterupdate) == 'function')
			this.afterupdate();
	}
};

/**
	Paint onto canvas.
	@private
*/
JSC3D.Viewer.prototype.paint = function() {
	if(!this.canvasData)
		return;

	this.ctx.putImageData(this.canvasData, 0, 0);
};

/**
	The mouse-down event handling routine.
	@private
*/
JSC3D.Viewer.prototype.mouseDownHandler = function(e) {
	if(this.onmousedown) {
		var info = this.pick(e.clientX, e.clientY);
		this.onmousedown(info.canvasX, info.canvasY, e.button, info.depth, info.mesh);
	}

	if(!this.isDefaultInputHandlerEnabled)
		return;

	this.buttonStates[e.button] = true;
	this.mouseX = e.clientX;
	this.mouseY = e.clientY;
};

/**
	The mouse-up event handling routine.
	@private
*/
JSC3D.Viewer.prototype.mouseUpHandler = function(e) {
	if(this.onmouseup) {
		var info = this.pick(e.clientX, e.clientY);
		this.onmouseup(info.canvasX, info.canvasY, e.button, info.depth, info.mesh);
	}

	if(!this.isDefaultInputHandlerEnabled)
		return;

	this.buttonStates[e.button] = false;
};

/**
	The mouse-move event handling routine.
	@private
*/
JSC3D.Viewer.prototype.mouseMoveHandler = function(e) {
	if(this.onmousemove) {
		var info = this.pick(e.clientX, e.clientY);
		this.onmousemove(info.canvasX, info.canvasY, e.button, info.depth, info.mesh);
	}

	if(!this.isDefaultInputHandlerEnabled)
		return;

	var isDragging = this.buttonStates[0] == true;
	var isShiftDown = this.keyStates[16] == true;
	if(isDragging) {
		if(isShiftDown) {
			this.zoomFactor *= this.mouseY <= e.clientY ? 1.11 : 0.9;
		}
		else {
			var rotX = (this.mouseY - e.clientY) * 360 / this.canvas.width;
			var rotY = (e.clientX - this.mouseX) * 360 / this.canvas.height;
			this.rotMatrix.rotateAboutXAxis(rotX);
			this.rotMatrix.rotateAboutYAxis(rotY);
		}
		this.mouseX = e.clientX;
		this.mouseY = e.clientY;
		this.update();
	}
};

/**
	The key-down event handling routine.
	@private
*/
JSC3D.Viewer.prototype.keyDownHandler = function(e) {
	if(!this.isDefaultInputHandlerEnabled)
		return;

	this.keyStates[e.keyCode] = true;
};

/**
	The key-up event handling routine.
	@private
*/
JSC3D.Viewer.prototype.keyUpHandler = function(e) {
	if(!this.isDefaultInputHandlerEnabled)
		return;

	this.keyStates[e.keyCode] = false;
};

/**
	Internally load a scene.
	@private
*/
JSC3D.Viewer.prototype.loadScene = function() {
	this.scene = null;
	this.isLoaded = false;

	if(this.sceneUrl == '')
		return false;

	var lastSlashAt = this.sceneUrl.lastIndexOf('/');
	if(lastSlashAt == -1)
		lastSlashAt = this.sceneUrl.lastIndexOf('\\');
	
	var fileName = this.sceneUrl.substring(lastSlashAt + 1);
	var lastDotAt = fileName.lastIndexOf('.');
	if(lastDotAt == -1)
		return false;

	var fileExtName = fileName.substring(lastDotAt + 1);
	var loader = JSC3D.LoaderSelector.getLoader(fileExtName);
	if(!loader)
		return false;

	var self = this;

	loader.onload = function(scene) {
		self.setupScene(scene);
	};

	loader.onerror = function(errorMsg) {
		self.scene = null;
		self.isLoaded = false;
		self.isFailed = true;
		self.errorMsg = errorMsg;
		self.update();
	};

	loader.onprogress = function(task, prog) {
		self.reportProgress(task, prog);
	};

	loader.onresource = function(resource) {
		if((resource instanceof JSC3D.Texture) && self.isMipMappingOn && !resource.hasMipmap())
			resource.generateMipmaps();		
		self.update();
	};

	loader.loadFromUrl(this.sceneUrl);

	return true;
};

/**
	Prepare for rendering of a new scene.
	@private
*/
JSC3D.Viewer.prototype.setupScene = function(scene) {
	scene.init();
	if(!scene.isEmpty()) {
		var d = scene.aabb.lengthOfDiagonal();
		var w = this.frameWidth;
		var h = this.frameHeight;
		this.zoomFactor = (d == 0) ? 1 : (w < h ? w : h) / d;
	}

	this.rotMatrix.identity();
	this.rotMatrix.rotateAboutXAxis(this.initRotX);
	this.rotMatrix.rotateAboutYAxis(this.initRotY);
	this.rotMatrix.rotateAboutZAxis(this.initRotZ);
	this.scene = scene;
	this.isLoaded = true;
	this.isFailed = false;
	this.errorMsg = '';
	this.needUpdate = false;
	this.needRepaint = false;
	this.update();
};

/**
	Show progress and some informations about current time-cosuming task.
	@param {string} task text information about current task.
	@param {float} progress progress of current task. this should be a number between 0 and 1.
*/
JSC3D.Viewer.prototype.reportProgress = function(task, progress) {
	if(!this.ctx)
		return;

	this.drawBackground();

	this.ctx.save();

	var r = 255 - ((this.bkgColor1 & 0xff0000) >> 16);
	var g = 255 - ((this.bkgColor1 & 0xff00) >> 8);
	var b = 255 - (this.bkgColor1 & 0xff);
	var style = '#' + r.toString(16) + g.toString(16) + b.toString(16);
	this.ctx.strokeStyle = style;
	this.ctx.fillStyle = style;

	var barX = 40;
	var barY = this.canvas.height * 0.38;
	var barWidth = this.canvas.width - barX * 2;
	var barHeight = 20;
	this.ctx.strokeRect(barX, barY, barWidth, barHeight);
	this.ctx.fillRect(barX+2, barY+2, (barWidth-4)*progress, barHeight-4);

	this.ctx.font = '12px Courier New';
	this.ctx.textAlign = 'left';
	this.ctx.fillText(task, barX, barY-4, barWidth);

	this.ctx.restore();
};

/**
	Show informations about a fatal error.
	@param {string} message text information about this error.
*/
JSC3D.Viewer.prototype.reportError = function(message) {
	if(!this.ctx)
		return;

	this.drawBackground();

	this.ctx.save();

	var msgX = 40;
	var msgY = this.canvas.height * 0.38 - 4;
	var r = 255 - ((this.bkgColor1 & 0xff0000) >> 16);
	var g = 255 - ((this.bkgColor1 & 0xff00) >> 8);
	var b = 255 - (this.bkgColor1 & 0xff);
	var style = '#' + r.toString(16) + g.toString(16) + b.toString(16);
	this.ctx.fillStyle = style;
	this.ctx.font = '16px Courier New';
	this.ctx.textAlign = 'left';
	this.ctx.fillText(message, msgX, msgY);

	this.ctx.restore();
};

/**
	Fill the background color buffer.
	@private
*/
JSC3D.Viewer.prototype.generateBackground = function() {
	var w = this.frameWidth;
	var h = this.frameHeight;
	var pixels = this.bkgColorBuffer;

	var r1 = (this.bkgColor1 & 0xff0000) >> 16;
	var g1 = (this.bkgColor1 & 0xff00) >> 8;
	var b1 = this.bkgColor1 & 0xff;
	var r2 = (this.bkgColor2 & 0xff0000) >> 16;
	var g2 = (this.bkgColor2 & 0xff00) >> 8;
	var b2 = this.bkgColor2 & 0xff;

	var pix = 0;
	for(var i=0; i<h; i++) {
		var r = (r1 + i * (r2 - r1) / h) & 0xff;
		var g = (g1 + i * (g2 - g1) / h) & 0xff;
		var b = (b1 + i * (b2 - b1) / h) & 0xff;

		for(var j=0; j<w; j++) {
			pixels[pix++] = r << 16 | g << 8 | b;
		}
	}
};

/**
	Draw background onto canvas.
	@private
*/
JSC3D.Viewer.prototype.drawBackground = function() {
	if(!this.canvasData)
		return;

	this.beginScene();
	this.endScene();

	this.paint();
};

/**
	Begin to render a new frame.
	@private
*/
JSC3D.Viewer.prototype.beginScene = function() {
	var cbuf = this.colorBuffer;
	var zbuf = this.zBuffer;
	var sbuf = this.selectionBuffer;
	var bbuf = this.bkgColorBuffer;
	var size = this.frameWidth * this.frameHeight;
	var MIN_Z = -Number.MAX_VALUE;

	for(var i=0; i<size; i++) {
		cbuf[i] = bbuf[i];
		zbuf[i] = MIN_Z;
		sbuf[i] = 0;
	}
};

/**
	End for rendering of a frame.
	@private
*/
JSC3D.Viewer.prototype.endScene = function() {
	var data = this.canvasData.data;
	var width = this.canvas.width;
	var height = this.canvas.height;
	var cbuf = this.colorBuffer;
	var cwidth = this.frameWidth;
	var cheight = this.frameHeight;
	var csize = cwidth * cheight;

	switch(this.definition) {
	case 'low':
		var halfWidth = width >> 1;
		var surplus = cwidth - halfWidth;
		var src = 0, dest = 0;
		for(var i=0; i<height; i++) {
			for(var j=0; j<width; j++) {
				var color = cbuf[src];
				data[dest]     = (color & 0xff0000) >> 16;
				data[dest + 1] = (color & 0xff00) >> 8;
				data[dest + 2] = color & 0xff;
				data[dest + 3] = 0xff;
				src += (j & 1);
				dest += 4;
			}
			src += (i & 1) ? surplus : -halfWidth;
		}
		break;
	case 'high':
		var src = 0, dest = 0;
		for(var i=0; i<height; i++) {
			for(var j=0; j<width; j++) {
				var color0 = cbuf[src];
				var color1 = cbuf[src + 1];
				var color2 = cbuf[src + cwidth];
				var color3 = cbuf[src + cwidth + 1];
				data[dest]     = ((color0 & 0xff0000) + (color1 & 0xff0000) + (color2 & 0xff0000) + (color3 & 0xff0000)) >> 18;
				data[dest + 1] = ((color0 & 0xff00) + (color1 & 0xff00) + (color2 & 0xff00) + (color3 & 0xff00)) >> 10;
				data[dest + 2] = ((color0 & 0xff) + (color1 & 0xff) + (color2 & 0xff) + (color3 & 0xff)) >> 2;
				data[dest + 3] = 0xff;
				src += 2;
				dest += 4;
			}
			src += cwidth;
		}
		break;
	case 'standard':
	default:
		for(var src=0, dest=0; src<csize; src++, dest+=4) {
			var color = cbuf[src];
			data[dest]     = (color & 0xff0000) >> 16;
			data[dest + 1] = (color & 0xff00) >> 8;
			data[dest + 2] = color & 0xff;
			data[dest + 3] = 0xff;
		}
		break;
	}
};

/**
	Render a new frame.
	@private
*/
JSC3D.Viewer.prototype.render = function() {
	if(this.scene.isEmpty())
		return;

	var aabb = this.scene.aabb;

	// calculate transformation matrix
	this.transformMatrix.identity();
	this.transformMatrix.translate(-(aabb.minX+aabb.maxX)/2, -(aabb.minY+aabb.maxY)/2, -(aabb.minZ+aabb.maxZ)/2);
	this.transformMatrix.multiply(this.rotMatrix);
	this.transformMatrix.scale(this.zoomFactor, -this.zoomFactor, this.zoomFactor);
	this.transformMatrix.translate(this.frameWidth/2, this.frameHeight/2, 0);

	// sort, transform and render the scene
	var renderList = this.sortScene(this.transformMatrix);
	for(var i=0; i<renderList.length; i++) {
		var mesh = renderList[i];

		if(!mesh.isTrivial()) {
			JSC3D.Math3D.transformVectors(this.transformMatrix, mesh.vertexBuffer, mesh.transformedVertexBuffer);

			if(mesh.visible) {
				switch(this.renderMode) {
				case 'point':
					this.renderPoint(mesh);
					break;
				case 'wireframe':
					this.renderWireframe(mesh);
					break;
				case 'flat':
					this.renderSolidFlat(mesh);
					break;
				case 'smooth':
					this.renderSolidSmooth(mesh);
					break;
				case 'texture':
					if(mesh.hasTexture())
						this.renderSolidTexture(mesh);
					else
						this.renderSolidFlat(mesh);
					break;
				case 'textureflat':
					if(mesh.hasTexture())
						this.renderTextureFlat(mesh);
					else
						this.renderSolidFlat(mesh);
					break;
				case 'texturesmooth':
					if(mesh.isEnvironmentCast && this.sphereMap != null && this.sphereMap.hasData())
						this.renderSolidSphereMapped(mesh);
					else if(mesh.hasTexture())
						this.renderTextureSmooth(mesh);
					else
						this.renderSolidSmooth(mesh);
					break;
				default:
					this.renderSolidFlat(mesh);
					break;
				}
			}
		}
	}
};

/**
	Sort meshes inside the scene into a render list. The sorting criterion is a mixture of trnasparency and depth.
	This routine is necessary to ensure a correct rendering order.
	@private
*/
JSC3D.Viewer.prototype.sortScene = function(mat) {
	var renderList = [];

	var meshes = this.scene.getChildren();
	for(var i=0; i<meshes.length; i++) {
		var mesh = meshes[i];
		if(!mesh.isTrivial()) {
			renderList.push(mesh);
			var meshCenter = mesh.aabb.center();
			JSC3D.Math3D.transformVectors(mat, meshCenter, meshCenter);
			var meshMaterial = mesh.material ? mesh.material : this.defaultMaterial;
			mesh.sortKey = { 
				depth: meshCenter[2], 
				isTransparnt: (meshMaterial.transparency > 0) || (mesh.hasTexture() ? mesh.texture.hasTransparency : false)
			};
		}
	}

	renderList.sort( 
		function(mesh0, mesh1) {
			// opaque meshes should always be prior to transparent ones to be rendered
			if(!mesh0.sortKey.isTransparnt && mesh1.sortKey.isTransparnt)
				return -1;

			// opaque meshes should always be prior to transparent ones to be rendered
			if(mesh0.sortKey.isTransparnt && !mesh1.sortKey.isTransparnt)
				return 1;

			// transparent meshes should be rendered from far to near
			if(mesh0.sortKey.isTransparnt)
				return mesh0.sortKey.depth - mesh1.sortKey.depth;

			// opaque meshes should be rendered form near to far
			return mesh1.sortKey.depth - mesh0.sortKey.depth;
	} );

	return renderList;
};

/**
	Render the given mesh as points.
	@private
*/
JSC3D.Viewer.prototype.renderPoint = function(mesh) {
	var w = this.frameWidth;
	var h = this.frameHeight;
	var xbound = w - 1;
	var ybound = h - 1;
	var ibuf = mesh.indexBuffer;
	var vbuf = mesh.transformedVertexBuffer;
	var nbuf = mesh.transformedVertexNormalZBuffer;
	var cbuf = this.colorBuffer;
	var zbuf = this.zBuffer;
	var sbuf = this.selectionBuffer;
	var numOfVertices = vbuf.length / 3;
	var id = mesh.internalId;
	var color = mesh.material ? mesh.material.diffuseColor : this.defaultMaterial.diffuseColor;
	
	if(!nbuf || nbuf.length < numOfVertices) {
		mesh.transformedVertexNormalZBuffer = new Array(numOfVertices);
		nbuf = mesh.transformedVertexNormalZBuffer;
	}

	JSC3D.Math3D.transformVectorZs(this.rotMatrix, mesh.vertexNormalBuffer, nbuf);

	for(var i=0, j=0; i<numOfVertices; i++, j+=3) {
		var xformedNz = nbuf[i];
		if(mesh.isDoubleSided)
			xformedNz = xformedNz > 0 ? xformedNz : -xformedNz;
		if(xformedNz > 0) {
			var x = ~~(vbuf[j]     + 0.5);
			var y = ~~(vbuf[j + 1] + 0.5);
			var z = vbuf[j + 2];
			if(x >=0 && x < xbound && y >=0 && y < ybound) {
				var pix = y * w + x;
				if(z > zbuf[pix]) {
					zbuf[pix] = z;
					cbuf[pix] = color;
					sbuf[pix] = id;
				}
				pix++;
				if(z > zbuf[pix]) {
					zbuf[pix] = z;
					cbuf[pix] = color;
					sbuf[pix] = id;
				}
				pix += xbound;
				if(z > zbuf[pix]) {
					zbuf[pix] = z;
					cbuf[pix] = color;
					sbuf[pix] = id;
				}
				pix++;
				if(z > zbuf[pix]) {
					zbuf[pix] = z;
					cbuf[pix] = color;
					sbuf[pix] = id;
				}
			}
		}
	}
};

/**
	Render the given mesh as wireframe.
	@private
*/
JSC3D.Viewer.prototype.renderWireframe = function(mesh) {
	var w = this.frameWidth;
	var h = this.frameHeight;
	var xbound = w - 1;
	var ybound = h - 1;
	var ibuf = mesh.indexBuffer;
	var vbuf = mesh.transformedVertexBuffer;
	var nbuf = mesh.transformedFaceNormalZBuffer;
	var cbuf = this.colorBuffer;
	var zbuf = this.zBuffer;
	var sbuf = this.selectionBuffer;
	var numOfFaces = mesh.faceCount;
	var id = mesh.internalId;
	var color = mesh.material ? mesh.material.diffuseColor : this.defaultMaterial.diffuseColor;

	if(!nbuf || nbuf.length < numOfFaces) {
		mesh.transformedFaceNormalZBuffer = new Array(numOfFaces);
		nbuf = mesh.transformedFaceNormalZBuffer;
	}

	JSC3D.Math3D.transformVectorZs(this.rotMatrix, mesh.faceNormalBuffer, nbuf);

	var i = 0, j = 0;
	while(i < numOfFaces) {
		var xformedNz = nbuf[i++];
		if(mesh.isDoubleSided)
			xformedNz = xformedNz > 0 ? xformedNz : -xformedNz;
		if(xformedNz < 0) {
			do {
			} while (ibuf[j++] != -1);
		}
		else {
			var vStart, v0, v1;
			v0 = ibuf[j++] * 3;
			v1 = ibuf[j++] * 3;
			vStart = v0;

			var isClosed = false;
			while(!isClosed) {
				var x0 = ~~(vbuf[v0]     + 0.5);
				var y0 = ~~(vbuf[v0 + 1] + 0.5);
				var z0 = vbuf[v0 + 2];
				var x1 = ~~(vbuf[v1]     + 0.5);
				var y1 = ~~(vbuf[v1 + 1] + 0.5);
				var z1 = vbuf[v1 + 2];

				var dx = x1 - x0;
				var dy = y1 - y0;
				var dz = z1 - z0;

				var dd;
				var xInc, yInc, zInc;
				if(Math.abs(dx) > Math.abs(dy)) {
					dd = dx;
					xInc = dx > 0 ? 1 : -1;
					yInc = dx != 0 ? xInc * dy / dx : 0;
					zInc = dx != 0 ? xInc * dz / dx : 0;
				}
				else {
					dd = dy;
					yInc = dy > 0 ? 1 : -1;
					xInc = dy != 0 ? yInc * dx / dy : 0;
					zInc = dy != 0 ? yInc * dz / dy : 0;
				}

				var x = x0;
				var y = y0;
				var z = z0;

				if(dd < 0) {
					x = x1;
					y = y1;
					z = z1;
					dd = -dd;
					xInc = -xInc;
					yInc = -yInc;
					zInc = -zInc;
				}

				for(var k=0; k<dd; k++) {
					if(x >=0 && x < xbound && y >=0 && y < ybound) {
						var pix = (~~y) * w + (~~x);
						if(z > zbuf[pix]) {
							zbuf[pix] = z;
							cbuf[pix] = color;
							sbuf[pix] = id;
						}
					}

					x += xInc;
					y += yInc;
					z += zInc;
				}

				if(v1 == vStart) {
					isClosed = true;
				}
				else {
					v0 = v1;

					if(ibuf[j] != -1) {
						v1 = ibuf[j++] * 3;
					}
					else {
						v1 = vStart;
					}
				}
			}

			j++;
		}
	}
};

/**
	Render the given mesh as solid object, using flat shading.
	@private
*/
JSC3D.Viewer.prototype.renderSolidFlat = function(mesh) {
	var w = this.frameWidth;
	var h = this.frameHeight;
	var ibuf = mesh.indexBuffer;
	var vbuf = mesh.transformedVertexBuffer;
	var nbuf = mesh.transformedFaceNormalZBuffer;
	var cbuf = this.colorBuffer;
	var zbuf = this.zBuffer;
	var sbuf = this.selectionBuffer;
	var numOfFaces = mesh.faceCount;
	var id = mesh.internalId;
	var material = mesh.material ? mesh.material : this.defaultMaterial;
	var palette = material.getPalette();
	var isOpaque = material.transparency == 0;
	var trans = material.transparency * 255;
	var opaci = 255 - trans;

	// skip this mesh if it is fully transparent
	if(material.transparency == 1)
		return;

	if(!nbuf || nbuf.length < numOfFaces) {
		mesh.transformedFaceNormalZBuffer = new Array(numOfFaces);
		nbuf = mesh.transformedFaceNormalZBuffer;
	}

	JSC3D.Math3D.transformVectorZs(this.rotMatrix, mesh.faceNormalBuffer, nbuf);

	var Xs = new Array(3);
	var Ys = new Array(3);
	var Zs = new Array(3);
	var i = 0, j = 0;
	while(i < numOfFaces) {
		var xformedNz = nbuf[i++];
		if(mesh.isDoubleSided)
			xformedNz = xformedNz > 0 ? xformedNz : -xformedNz;
		if(xformedNz < 0) {
			do {
			} while (ibuf[j++] != -1);
		}
		else {
			var color = palette[~~(xformedNz * 255)];

			var v0, v1, v2;
			v0 = ibuf[j++] * 3;
			v1 = ibuf[j++] * 3;

			do {
				v2 = ibuf[j++] * 3;

				Xs[0] = ~~(vbuf[v0]     + 0.5);
				Ys[0] = ~~(vbuf[v0 + 1] + 0.5);
				Zs[0] = vbuf[v0 + 2];
				Xs[1] = ~~(vbuf[v1]     + 0.5);
				Ys[1] = ~~(vbuf[v1 + 1] + 0.5);
				Zs[1] = vbuf[v1 + 2];
				Xs[2] = ~~(vbuf[v2]     + 0.5);
				Ys[2] = ~~(vbuf[v2 + 1] + 0.5);
				Zs[2] = vbuf[v2 + 2];

				var high = Ys[0] < Ys[1] ? 0 : 1;
				high = Ys[high] < Ys[2] ? high : 2;
				var low = Ys[0] > Ys[1] ? 0 : 1;
				low = Ys[low] > Ys[2] ? low : 2;
				var mid = 3 - low - high;

				if(high != low) {
					var x0 = Xs[low];
					var z0 = Zs[low];
					var dy0 = Ys[low] - Ys[high];
					dy0 = dy0 != 0 ? dy0 : 1;
					var xStep0 = (Xs[low] - Xs[high]) / dy0;
					var zStep0 = (Zs[low] - Zs[high]) / dy0;

					var x1 = Xs[low];
					var z1 = Zs[low];
					var dy1 = Ys[low] - Ys[mid];
					dy1 = dy1 != 0 ? dy1 : 1;
					var xStep1 = (Xs[low] - Xs[mid]) / dy1;
					var zStep1 = (Zs[low] - Zs[mid]) / dy1;

					var x2 = Xs[mid];
					var z2 = Zs[mid];
					var dy2 = Ys[mid] - Ys[high];
					dy2 = dy2 != 0 ? dy2 : 1;
					var xStep2 = (Xs[mid] - Xs[high]) / dy2;
					var zStep2 = (Zs[mid] - Zs[high]) / dy2;

					var linebase = Ys[low] * w;
					for(var y=Ys[low]; y>Ys[high]; y--) {
						if(y >=0 && y < h) {
							var xLeft = ~~x0;
							var zLeft = z0;
							var xRight, zRight;
							if(y > Ys[mid]) {
								xRight = ~~x1;
								zRight = z1;
							}
							else {
								xRight = ~~x2;
								zRight = z2;
							}

							if(xLeft > xRight) {
								var temp;
								temp = xLeft;
								xLeft = xRight;
								xRight = temp;
								temp = zLeft;
								zLeft = zRight;
								zRight = temp;
							}

							if(xLeft < 0)
								xLeft = 0;
							if(xRight >= w)
								xRight = w - 1;

							var zInc = (xLeft != xRight) ? ((zRight - zLeft) / (xRight - xLeft)) : 1;
							var pix = linebase + xLeft;
							if(isOpaque) {
								for(var x=xLeft, z=zLeft; x<=xRight; x++, z+=zInc) {
									if(z > zbuf[pix]) {
										zbuf[pix] = z;
										cbuf[pix] = color;
										sbuf[pix] = id;
									}
									pix++;
								}
							}
							else {
								for(var x=xLeft, z=zLeft; x<xRight; x++, z+=zInc) {
									if(z > zbuf[pix]) {
										var foreColor = color;
										var backColor = cbuf[pix];
										var rr = ((backColor & 0xff0000) * trans + (foreColor & 0xff0000) * opaci) >> 8;
										var gg = ((backColor & 0xff00) * trans + (foreColor & 0xff00) * opaci) >> 8;
										var bb = ((backColor & 0xff) * trans + (foreColor & 0xff) * opaci) >> 8;
										cbuf[pix] = (rr & 0xff0000) | (gg & 0xff00) | (bb & 0xff);
										sbuf[pix] = id;
									}
									pix++;
								}
							}
						}

						// step up to next scanline
						//
						x0 -= xStep0;
						z0 -= zStep0;
						if(y > Ys[mid]) {
							x1 -= xStep1;
							z1 -= zStep1;
						}
						else {
							x2 -= xStep2;
							z2 -= zStep2;
						}
						linebase -= w;
					}
				}

				v1 = v2;
			} while (ibuf[j] != -1);

			j++;
		}
	}
};

/**
	Render the given mesh as solid object, using smooth shading.
	@private
*/
JSC3D.Viewer.prototype.renderSolidSmooth = function(mesh) {
	var w = this.frameWidth;
	var h = this.frameHeight;
	var ibuf = mesh.indexBuffer;
	var vbuf = mesh.transformedVertexBuffer;
	var vnbuf = mesh.transformedVertexNormalZBuffer;
	var fnbuf = mesh.transformedFaceNormalZBuffer;
	var cbuf = this.colorBuffer;
	var zbuf = this.zBuffer;
	var sbuf = this.selectionBuffer;
	var numOfFaces = mesh.faceCount;
	var numOfVertices = vbuf.length / 3;
	var id = mesh.internalId;
	var material = mesh.material ? mesh.material : this.defaultMaterial;
	var palette = material.getPalette();
	var isOpaque = material.transparency == 0;
	var trans = material.transparency * 255;
	var opaci = 255 - trans;

	// skip this mesh if it is fully transparent
	if(material.transparency == 1)
		return;

	if(!vnbuf || vnbuf.length < numOfVertices) {
		mesh.transformedVertexNormalZBuffer = new Array(numOfVertices);
		vnbuf = mesh.transformedVertexNormalZBuffer;
	}

	if(!fnbuf || fnbuf.length < numOfFaces) {
		mesh.transformedFaceNormalZBuffer = new Array(numOfFaces);
		fnbuf = mesh.transformedFaceNormalZBuffer;
	}

	JSC3D.Math3D.transformVectorZs(this.rotMatrix, mesh.vertexNormalBuffer, vnbuf);
	JSC3D.Math3D.transformVectorZs(this.rotMatrix, mesh.faceNormalBuffer, fnbuf);

	var isDoubleSided = mesh.isDoubleSided;

	var Xs = new Array(3);
	var Ys = new Array(3);
	var Zs = new Array(3);
	var Ns = new Array(3);
	var i = 0, j = 0;
	while(i < numOfFaces) {
		var xformedFNz = fnbuf[i++];
		if(isDoubleSided)
			xformedFNz = xformedFNz > 0 ? xformedFNz : -xformedFNz;
		if(xformedFNz < 0) {
			do {
			} while (ibuf[j++] != -1);
		}
		else {
			var i0, i1, i2;
			var v0, v1, v2;
			i0 = ibuf[j++];
			v0 = i0 * 3;
			i1 = ibuf[j++];
			v1 = i1 * 3;

			do {
				i2 = ibuf[j++];
				v2 = i2 * 3;

				Xs[0] = ~~(vbuf[v0]     + 0.5);
				Ys[0] = ~~(vbuf[v0 + 1] + 0.5);
				Zs[0] = vbuf[v0 + 2];
				Xs[1] = ~~(vbuf[v1]     + 0.5);
				Ys[1] = ~~(vbuf[v1 + 1] + 0.5);
				Zs[1] = vbuf[v1 + 2];
				Xs[2] = ~~(vbuf[v2]     + 0.5);
				Ys[2] = ~~(vbuf[v2 + 1] + 0.5);
				Zs[2] = vbuf[v2 + 2];

				Ns[0] = vnbuf[i0];
				Ns[1] = vnbuf[i1];
				Ns[2] = vnbuf[i2];
				if(isDoubleSided) {
					if(Ns[0] < 0)
						Ns[0] = -Ns[0];
					if(Ns[1] < 0)
						Ns[1] = -Ns[1];
					if(Ns[2] < 0)
						Ns[2] = -Ns[2];
				}

				var high = Ys[0] < Ys[1] ? 0 : 1;
				high = Ys[high] < Ys[2] ? high : 2;
				var low = Ys[0] > Ys[1] ? 0 : 1;
				low = Ys[low] > Ys[2] ? low : 2;
				var mid = 3 - low - high;

				if(high != low) {
					var x0 = Xs[low];
					var z0 = Zs[low];
					var n0 = Ns[low] * 255;
					var dy0 = Ys[low] - Ys[high];
					dy0 = dy0 != 0 ? dy0 : 1;
					var xStep0 = (Xs[low] - Xs[high]) / dy0;
					var zStep0 = (Zs[low] - Zs[high]) / dy0;
					var nStep0 = (Ns[low] - Ns[high]) * 255 / dy0;

					var x1 = Xs[low];
					var z1 = Zs[low];
					var n1 = Ns[low] * 255;
					var dy1 = Ys[low] - Ys[mid];
					dy1 = dy1 != 0 ? dy1 : 1;
					var xStep1 = (Xs[low] - Xs[mid]) / dy1;
					var zStep1 = (Zs[low] - Zs[mid]) / dy1;
					var nStep1 = (Ns[low] - Ns[mid]) * 255 / dy1;

					var x2 = Xs[mid];
					var z2 = Zs[mid];
					var n2 = Ns[mid] * 255;
					var dy2 = Ys[mid] - Ys[high];
					dy2 = dy2 != 0 ? dy2 : 1;
					var xStep2 = (Xs[mid] - Xs[high]) / dy2;
					var zStep2 = (Zs[mid] - Zs[high]) / dy2;
					var nStep2 = (Ns[mid] - Ns[high]) * 255 / dy2;

					var linebase = Ys[low] * w;
					for(var y=Ys[low]; y>Ys[high]; y--) {
						if(y >=0 && y < h) {
							var xLeft = ~~x0;
							var zLeft = z0;
							var nLeft = n0;
							var xRight, zRight, nRight;
							if(y > Ys[mid]) {
								xRight = ~~x1;
								zRight = z1;
								nRight = n1;
							}
							else {
								xRight = ~~x2;
								zRight = z2;
								nRight = n2;
							}

							if(xLeft > xRight) {
								var temp;
								temp = xLeft;
								xLeft = xRight;
								xRight = temp;
								temp = zLeft;
								zLeft = zRight;
								zRight = temp;
								temp = nLeft;
								nLeft = nRight;
								nRight = temp;
							}

							var zInc = (xLeft != xRight) ? ((zRight - zLeft) / (xRight - xLeft)) : 1;
							var nInc = (xLeft != xRight) ? ((nRight - nLeft) / (xRight - xLeft)) : 1;
							if(xLeft < 0) {
								zLeft -= xLeft * zInc;
								nLeft -= xLeft * nInc;
								xLeft = 0;
							}
							if(xRight >= w) {
								xRight = w - 1;
							}
							var pix = linebase + xLeft;
							if(isOpaque) {
								for(var x=xLeft, z=zLeft, n=nLeft; x<=xRight; x++, z+=zInc, n+=nInc) {
									if(z > zbuf[pix]) {
										zbuf[pix] = z;
										cbuf[pix] = palette[n > 0 ? (~~n) : 0];
										sbuf[pix] = id;
									}
									pix++;
								}
							}
							else {
								for(var x=xLeft, z=zLeft, n=nLeft; x<xRight; x++, z+=zInc, n+=nInc) {
									if(z > zbuf[pix]) {
										var foreColor = palette[n > 0 ? (~~n) : 0];
										var backColor = cbuf[pix];
										var rr = ((backColor & 0xff0000) * trans + (foreColor & 0xff0000) * opaci) >> 8;
										var gg = ((backColor & 0xff00) * trans + (foreColor & 0xff00) * opaci) >> 8;
										var bb = ((backColor & 0xff) * trans + (foreColor & 0xff) * opaci) >> 8;
										cbuf[pix] = (rr & 0xff0000) | (gg & 0xff00) | (bb & 0xff);
										sbuf[pix] = id;
									}
									pix++;
								}
							}
						}

						// step up to next scanline
						//
						x0 -= xStep0;
						z0 -= zStep0;
						n0 -= nStep0;
						if(y > Ys[mid]) {
							x1 -= xStep1;
							z1 -= zStep1;
							n1 -= nStep1;
						}
						else {
							x2 -= xStep2;
							z2 -= zStep2;
							n2 -= nStep2;
						}
						linebase -= w;
					}
				}

				v1 = v2;
				i1 = i2;
			} while (ibuf[j] != -1);

			j++;
		}
	}
};

/**
	Render the given mesh as textured object, with no lightings.
	@private
*/
JSC3D.Viewer.prototype.renderSolidTexture = function(mesh) {
	var w = this.frameWidth;
	var h = this.frameHeight;
	var ibuf = mesh.indexBuffer;
	var vbuf = mesh.transformedVertexBuffer;
	var nbuf = mesh.transformedFaceNormalZBuffer;
	var cbuf = this.colorBuffer;
	var zbuf = this.zBuffer;
	var sbuf = this.selectionBuffer;
	var numOfFaces = mesh.faceCount;
	var id = mesh.internalId;
	var texture = mesh.texture;
	var isOpaque = !texture.hasTransparency;
	var tbuf = mesh.texCoordBuffer;
	var tibuf = mesh.texCoordIndexBuffer;
	var tdata = texture.data;
	var tdim = texture.width;
	var tbound = tdim - 1;
	var mipmaps = texture.hasMipmap() ? texture.mipmaps : null;
	var mipentries = mipmaps ? texture.mipentries : null;

	if(!nbuf || nbuf.length < numOfFaces) {
		mesh.transformedFaceNormalZBuffer = new Array(numOfFaces);
		nbuf = mesh.transformedFaceNormalZBuffer;
	}

	JSC3D.Math3D.transformVectorZs(this.rotMatrix, mesh.faceNormalBuffer, nbuf);

	var Xs = new Array(3);
	var Ys = new Array(3);
	var Zs = new Array(3);
	var THs = new Array(3);
	var TVs = new Array(3);
	var i = 0, j = 0;
	while(i < numOfFaces) {
		var xformedNz = nbuf[i++];
		if(mesh.isDoubleSided)
			xformedNz = xformedNz > 0 ? xformedNz : -xformedNz;
		if(xformedNz < 0) {
			do {
			} while (ibuf[j++] != -1);
		}
		else {
			var v0, v1, v2;
			var t0, t1, t2;
			v0 = ibuf[j] * 3;
			t0 = tibuf[j] * 2;
			j++;
			v1 = ibuf[j] * 3;
			t1 = tibuf[j] * 2;
			j++;

			// select an appropriate mip-map level for texturing
			//
			if(mipmaps) {
				v2 = ibuf[j] * 3;
				t2 = tibuf[j] * 2;

				tdim = texture.width;

				Xs[0] = vbuf[v0];
				Ys[0] = vbuf[v0 + 1];
				Xs[1] = vbuf[v1];
				Ys[1] = vbuf[v1 + 1];
				Xs[2] = vbuf[v2];
				Ys[2] = vbuf[v2 + 1];

				THs[0] = tbuf[t0] * tdim;
				TVs[0] = tbuf[t0 + 1] * tdim;
				THs[1] = tbuf[t1] * tdim;
				TVs[1] = tbuf[t1 + 1] * tdim;
				THs[2] = tbuf[t2] * tdim;
				TVs[2] = tbuf[t2 + 1] * tdim;

				var faceArea = (Xs[1] - Xs[0]) * (Ys[2] - Ys[0]) - (Ys[1] - Ys[0]) * (Xs[2] - Xs[0]);
				if(faceArea < 0)
					faceArea = -faceArea;
				faceArea += 1;
				var texArea = (THs[1] - THs[0]) * (TVs[2] - TVs[0]) - (TVs[1] -  TVs[0]) * (THs[2] - THs[0]);
				if(texArea < 0)
					texArea = -texArea;
				var mipRatio = texArea / faceArea;

				var level = 0;
				if(mipRatio < mipentries[1])
					level = 0;
				else if(mipRatio >= mipentries[mipentries.length - 1]) {
					level = mipentries.length - 1;
					tdim = 1;
				}
				else {
					while(mipRatio >= mipentries[level+1]) {
						level++;
						tdim /= 2;
					}
				}

				tdata = mipmaps[level];
				tbound = tdim - 1;
			}

			do {
				v2 = ibuf[j] * 3;
				t2 = tibuf[j] * 2;
				j++;

				Xs[0] = ~~(vbuf[v0]     + 0.5);
				Ys[0] = ~~(vbuf[v0 + 1] + 0.5);
				Zs[0] = vbuf[v0 + 2];
				Xs[1] = ~~(vbuf[v1]     + 0.5);
				Ys[1] = ~~(vbuf[v1 + 1] + 0.5);
				Zs[1] = vbuf[v1 + 2];
				Xs[2] = ~~(vbuf[v2]     + 0.5);
				Ys[2] = ~~(vbuf[v2 + 1] + 0.5);
				Zs[2] = vbuf[v2 + 2];

				THs[0] = tbuf[t0] * tdim;
				TVs[0] = tbuf[t0 + 1] * tdim;
				THs[1] = tbuf[t1] * tdim;
				TVs[1] = tbuf[t1 + 1] * tdim;
				THs[2] = tbuf[t2] * tdim;
				TVs[2] = tbuf[t2 + 1] * tdim;

				var high = Ys[0] < Ys[1] ? 0 : 1;
				high = Ys[high] < Ys[2] ? high : 2;
				var low = Ys[0] > Ys[1] ? 0 : 1;
				low = Ys[low] > Ys[2] ? low : 2;
				var mid = 3 - low - high;

				if(high != low) {
					var x0 = Xs[low];
					var z0 = Zs[low];
					var th0 = THs[low];
					var tv0 = TVs[low];
					var dy0 = Ys[low] - Ys[high];
					dy0 = dy0 != 0 ? dy0 : 1;
					var xStep0 = (Xs[low] - Xs[high]) / dy0;
					var zStep0 = (Zs[low] - Zs[high]) / dy0;
					var thStep0 = (THs[low] - THs[high]) / dy0;
					var tvStep0 = (TVs[low] - TVs[high]) / dy0;

					var x1 = Xs[low];
					var z1 = Zs[low];
					var th1 = THs[low];
					var tv1 = TVs[low];
					var dy1 = Ys[low] - Ys[mid];
					dy1 = dy1 != 0 ? dy1 : 1;
					var xStep1 = (Xs[low] - Xs[mid]) / dy1;
					var zStep1 = (Zs[low] - Zs[mid]) / dy1;
					var thStep1 = (THs[low] - THs[mid]) / dy1;
					var tvStep1 = (TVs[low] - TVs[mid]) / dy1;

					var x2 = Xs[mid];
					var z2 = Zs[mid];
					var th2 = THs[mid];
					var tv2 = TVs[mid];
					var dy2 = Ys[mid] - Ys[high];
					dy2 = dy2 != 0 ? dy2 : 1;
					var xStep2 = (Xs[mid] - Xs[high]) / dy2;
					var zStep2 = (Zs[mid] - Zs[high]) / dy2;
					var thStep2 = (THs[mid] - THs[high]) / dy2;
					var tvStep2 = (TVs[mid] - TVs[high]) / dy2;

					var linebase = Ys[low] * w;
					for(var y=Ys[low]; y>Ys[high]; y--) {
						if(y >=0 && y < h) {
							var xLeft = ~~x0;
							var zLeft = z0;
							var thLeft = th0;
							var tvLeft = tv0;
							var xRight, zRight, thRight, tvRight;
							if(y > Ys[mid]) {
								xRight = ~~x1;
								zRight = z1;
								thRight = th1;
								tvRight = tv1;
							}
							else {
								xRight = ~~x2;
								zRight = z2;
								thRight = th2;
								tvRight = tv2;
							}

							if(xLeft > xRight) {
								var temp;
								temp = xLeft;
								xLeft = xRight;
								xRight = temp;
								temp = zLeft;
								zLeft = zRight;
								zRight = temp;
								temp = thLeft;
								thLeft = thRight;
								thRight = temp;
								temp = tvLeft;
								tvLeft = tvRight;
								tvRight = temp;
							}

							var zInc = (xLeft != xRight) ? ((zRight - zLeft) / (xRight - xLeft)) : 1;
							var thInc = (xLeft != xRight) ? ((thRight - thLeft) / (xRight - xLeft)) : 1;
							var tvInc = (xLeft != xRight) ? ((tvRight - tvLeft) / (xRight - xLeft)) : 1;

							if(xLeft < 0) {
								zLeft -= xLeft * zInc;
								thLeft -= xLeft * thInc;
								tvLeft -= xLeft * tvInc;
								xLeft = 0;
							}
							if(xRight >= w)
								xRight = w - 1;

							var pix = linebase + xLeft;
							if(isOpaque) {
								for(var x=xLeft, z=zLeft, th=thLeft, tv=tvLeft; x<=xRight; x++, z+=zInc, th+=thInc, tv+=tvInc) {
									if(z > zbuf[pix]) {
										zbuf[pix] = z;
										cbuf[pix] = tdata[(tv & tbound) * tdim + (th & tbound)];
										sbuf[pix] = id;
									}
									pix++;
								}
							}
							else {
								for(var x=xLeft, z=zLeft, th=thLeft, tv=tvLeft; x<xRight; x++, z+=zInc, th+=thInc, tv+=tvInc) {
									if(z > zbuf[pix]) {
										var foreColor = tdata[(tv & tbound) * tdim + (th & tbound)];
										var backColor = cbuf[pix];
										var opaci = (foreColor >> 24) & 0xff;
										var trans = 255 - opaci;
										var rr = ((backColor & 0xff0000) * trans + (foreColor & 0xff0000) * opaci) >> 8;
										var gg = ((backColor & 0xff00) * trans + (foreColor & 0xff00) * opaci) >> 8;
										var bb = ((backColor & 0xff) * trans + (foreColor & 0xff) * opaci) >> 8;
										cbuf[pix] = (rr & 0xff0000) | (gg & 0xff00) | (bb & 0xff);
										sbuf[pix] = id;
									}
									pix++;
								}
							}
						}

						// step up to next scanline
						//
						x0 -= xStep0;
						z0 -= zStep0;
						th0 -= thStep0;
						tv0 -= tvStep0;
						if(y > Ys[mid]) {
							x1 -= xStep1;
							z1 -= zStep1;
							th1 -= thStep1;
							tv1 -= tvStep1;
						}
						else {
							x2 -= xStep2;
							z2 -= zStep2;
							th2 -= thStep2;
							tv2 -= tvStep2;
						}
						linebase -= w;
					}
				}

				v1 = v2;
				t1 = t2;
			} while (ibuf[j] != -1);

			j++;
		}
	}
};

/**
	Render the given mesh as textured object. Lighting will be calculated per face.
	@private
*/
JSC3D.Viewer.prototype.renderTextureFlat = function(mesh) {
	var w = this.frameWidth;
	var h = this.frameHeight;
	var ibuf = mesh.indexBuffer;
	var vbuf = mesh.transformedVertexBuffer;
	var nbuf = mesh.transformedFaceNormalZBuffer;
	var cbuf = this.colorBuffer;
	var zbuf = this.zBuffer;
	var sbuf = this.selectionBuffer;
	var numOfFaces = mesh.faceCount;
	var id = mesh.internalId;
	var material = mesh.material ? mesh.material : this.defaultMaterial;
	var palette = material.getPalette();
	var texture = mesh.texture;
	var isOpaque = (material.transparency == 0) && !texture.hasTransparency;
	var matOpacity = ~~((1 - material.transparency) * 255);
	var tbuf = mesh.texCoordBuffer;
	var tibuf = mesh.texCoordIndexBuffer;
	var tdata = texture.data;
	var tdim = texture.width;
	var tbound = tdim - 1;
	var mipmaps = texture.hasMipmap() ? texture.mipmaps : null;
	var mipentries = mipmaps ? texture.mipentries : null;

	// skip this mesh if it is fully transparent
	if(material.transparency == 1)
		return;

	if(!nbuf || nbuf.length < numOfFaces) {
		mesh.transformedFaceNormalZBuffer = new Array(numOfFaces);
		nbuf = mesh.transformedFaceNormalZBuffer;
	}

	JSC3D.Math3D.transformVectorZs(this.rotMatrix, mesh.faceNormalBuffer, nbuf);

	var Xs = new Array(3);
	var Ys = new Array(3);
	var Zs = new Array(3);
	var THs = new Array(3);
	var TVs = new Array(3);
	var i = 0, j = 0;
	while(i < numOfFaces) {
		var xformedNz = nbuf[i++];
		if(mesh.isDoubleSided)
			xformedNz = xformedNz > 0 ? xformedNz : -xformedNz;
		if(xformedNz < 0) {
			do {
			} while (ibuf[j++] != -1);
		}
		else {
			var color = palette[~~(xformedNz * 255)];

			var v0, v1, v2;
			var t0, t1, t2;
			v0 = ibuf[j] * 3;
			t0 = tibuf[j] * 2;
			j++;
			v1 = ibuf[j] * 3;
			t1 = tibuf[j] * 2;
			j++;

			if(mipmaps) {
				v2 = ibuf[j] * 3;
				t2 = tibuf[j] * 2;

				tdim = texture.width;

				Xs[0] = vbuf[v0];
				Ys[0] = vbuf[v0 + 1];
				Xs[1] = vbuf[v1];
				Ys[1] = vbuf[v1 + 1];
				Xs[2] = vbuf[v2];
				Ys[2] = vbuf[v2 + 1];

				THs[0] = tbuf[t0] * tdim;
				TVs[0] = tbuf[t0 + 1] * tdim;
				THs[1] = tbuf[t1] * tdim;
				TVs[1] = tbuf[t1 + 1] * tdim;
				THs[2] = tbuf[t2] * tdim;
				TVs[2] = tbuf[t2 + 1] * tdim;

				var faceArea = (Xs[1] - Xs[0]) * (Ys[2] - Ys[0]) - (Ys[1] - Ys[0]) * (Xs[2] - Xs[0]);
				if(faceArea < 0)
					faceArea = -faceArea;
				faceArea += 1;
				var texArea = (THs[1] - THs[0]) * (TVs[2] - TVs[0]) - (TVs[1] -  TVs[0]) * (THs[2] - THs[0]);
				if(texArea < 0)
					texArea = -texArea;
				var mipRatio = texArea / faceArea;

				var level = 0;
				if(mipRatio < mipentries[1])
					level = 0;
				else if(mipRatio >= mipentries[mipentries.length - 1]) {
					level = mipentries.length - 1;
					tdim = 1;
				}
				else {
					while(mipRatio >= mipentries[level+1]) {
						level++;
						tdim /= 2;
					}
				}

				tdata = mipmaps[level];
				tbound = tdim - 1;
			}

			do {
				v2 = ibuf[j] * 3;
				t2 = tibuf[j] * 2;
				j++;

				Xs[0] = ~~(vbuf[v0]     + 0.5);
				Ys[0] = ~~(vbuf[v0 + 1] + 0.5);
				Zs[0] = vbuf[v0 + 2];
				Xs[1] = ~~(vbuf[v1]     + 0.5);
				Ys[1] = ~~(vbuf[v1 + 1] + 0.5);
				Zs[1] = vbuf[v1 + 2];
				Xs[2] = ~~(vbuf[v2]     + 0.5);
				Ys[2] = ~~(vbuf[v2 + 1] + 0.5);
				Zs[2] = vbuf[v2 + 2];

				THs[0] = tbuf[t0] * tdim;
				TVs[0] = tbuf[t0 + 1] * tdim;
				THs[1] = tbuf[t1] * tdim;
				TVs[1] = tbuf[t1 + 1] * tdim;
				THs[2] = tbuf[t2] * tdim;
				TVs[2] = tbuf[t2 + 1] * tdim;

				var high = Ys[0] < Ys[1] ? 0 : 1;
				high = Ys[high] < Ys[2] ? high : 2;
				var low = Ys[0] > Ys[1] ? 0 : 1;
				low = Ys[low] > Ys[2] ? low : 2;
				var mid = 3 - low - high;

				if(high != low) {
					var x0 = Xs[low];
					var z0 = Zs[low];
					var th0 = THs[low];
					var tv0 = TVs[low];
					var dy0 = Ys[low] - Ys[high];
					dy0 = dy0 != 0 ? dy0 : 1;
					var xStep0 = (Xs[low] - Xs[high]) / dy0;
					var zStep0 = (Zs[low] - Zs[high]) / dy0;
					var thStep0 = (THs[low] - THs[high]) / dy0;
					var tvStep0 = (TVs[low] - TVs[high]) / dy0;

					var x1 = Xs[low];
					var z1 = Zs[low];
					var th1 = THs[low];
					var tv1 = TVs[low];
					var dy1 = Ys[low] - Ys[mid];
					dy1 = dy1 != 0 ? dy1 : 1;
					var xStep1 = (Xs[low] - Xs[mid]) / dy1;
					var zStep1 = (Zs[low] - Zs[mid]) / dy1;
					var thStep1 = (THs[low] - THs[mid]) / dy1;
					var tvStep1 = (TVs[low] - TVs[mid]) / dy1;

					var x2 = Xs[mid];
					var z2 = Zs[mid];
					var th2 = THs[mid];
					var tv2 = TVs[mid];
					var dy2 = Ys[mid] - Ys[high];
					dy2 = dy2 != 0 ? dy2 : 1;
					var xStep2 = (Xs[mid] - Xs[high]) / dy2;
					var zStep2 = (Zs[mid] - Zs[high]) / dy2;
					var thStep2 = (THs[mid] - THs[high]) / dy2;
					var tvStep2 = (TVs[mid] - TVs[high]) / dy2;

					var linebase = Ys[low] * w;
					for(var y=Ys[low]; y>Ys[high]; y--) {
						if(y >=0 && y < h) {
							var xLeft = ~~x0;
							var zLeft = z0;
							var thLeft = th0;
							var tvLeft = tv0;
							var xRight, zRight, thRight, tvRight;
							if(y > Ys[mid]) {
								xRight = ~~x1;
								zRight = z1;
								thRight = th1;
								tvRight = tv1;
							}
							else {
								xRight = ~~x2;
								zRight = z2;
								thRight = th2;
								tvRight = tv2;
							}

							if(xLeft > xRight) {
								var temp;
								temp = xLeft;
								xLeft = xRight;
								xRight = temp;
								temp = zLeft;
								zLeft = zRight;
								zRight = temp;
								temp = thLeft;
								thLeft = thRight;
								thRight = temp;
								temp = tvLeft;
								tvLeft = tvRight;
								tvRight = temp;
							}

							var zInc = (xLeft != xRight) ? ((zRight - zLeft) / (xRight - xLeft)) : 1;
							var thInc = (xLeft != xRight) ? ((thRight - thLeft) / (xRight - xLeft)) : 1;
							var tvInc = (xLeft != xRight) ? ((tvRight - tvLeft) / (xRight - xLeft)) : 1;

							if(xLeft < 0) {
								zLeft -= xLeft * zInc;
								thLeft -= xLeft * thInc;
								tvLeft -= xLeft * tvInc;
								xLeft = 0;
							}
							if(xRight >= w)
								xRight = w - 1;

							var pix = linebase + xLeft;
							if(isOpaque) {
								for(var x=xLeft, z=zLeft, th=thLeft, tv=tvLeft; x<=xRight; x++, z+=zInc, th+=thInc, tv+=tvInc) {
									if(z > zbuf[pix]) {
										zbuf[pix] = z;
										var texel = tdata[(tv & tbound) * tdim + (th & tbound)];
										var rr = (((color & 0xff0000) >> 16) * ((texel & 0xff0000) >> 8));
										var gg = (((color & 0xff00) >> 8) * ((texel & 0xff00) >> 8));
										var bb = ((color & 0xff) * (texel & 0xff)) >> 8;
										cbuf[pix] = (rr & 0xff0000) | (gg & 0xff00) | (bb & 0xff);
										sbuf[pix] = id;
									}
									pix++;
								}
							}
							else {
								for(var x=xLeft, z=zLeft, th=thLeft, tv=tvLeft; x<xRight; x++, z+=zInc, th+=thInc, tv+=tvInc) {
									if(z > zbuf[pix]) {
										var foreColor = tdata[(tv & tbound) * tdim + (th & tbound)];
										var backColor = cbuf[pix];
										var opaci = (((foreColor >> 24) & 0xff) * (matOpacity & 0xff)) >> 8;
										var rr = (((color & 0xff0000) >> 16) * ((foreColor & 0xff0000) >> 8));
										var gg = (((color & 0xff00) >> 8) * ((foreColor & 0xff00) >> 8));
										var bb = ((color & 0xff) * (foreColor & 0xff)) >> 8;
										if(opaci > 250) {
											zbuf[pix] = z;
										}
										else {
											var trans = 255 - opaci;
											rr = (rr * opaci + (backColor & 0xff0000) * trans) >> 8;
											gg = (gg * opaci + (backColor & 0xff00) * trans) >> 8;
											bb = (bb * opaci + (backColor & 0xff) * trans) >> 8;
										}
										cbuf[pix] = (rr & 0xff0000) | (gg & 0xff00) | (bb & 0xff);
										sbuf[pix] = id;
									}
									pix++;
								}
							}
						}

						// step up to next scanline
						//
						x0 -= xStep0;
						z0 -= zStep0;
						th0 -= thStep0;
						tv0 -= tvStep0;
						if(y > Ys[mid]) {
							x1 -= xStep1;
							z1 -= zStep1;
							th1 -= thStep1;
							tv1 -= tvStep1;
						}
						else {
							x2 -= xStep2;
							z2 -= zStep2;
							th2 -= thStep2;
							tv2 -= tvStep2;
						}
						linebase -= w;
					}
				}

				v1 = v2;
				t1 = t2;
			} while (ibuf[j] != -1);

			j++;
		}
	}
};

/**
	Render the given mesh as textured object. Lighting will be calculated per vertex and then inerpolated between and inside scanlines.
	@private
*/
JSC3D.Viewer.prototype.renderTextureSmooth = function(mesh) {
	var w = this.frameWidth;
	var h = this.frameHeight;
	var ibuf = mesh.indexBuffer;
	var vbuf = mesh.transformedVertexBuffer;
	var vnbuf = mesh.transformedVertexNormalZBuffer;
	var fnbuf = mesh.transformedFaceNormalZBuffer;
	var cbuf = this.colorBuffer;
	var zbuf = this.zBuffer;
	var sbuf = this.selectionBuffer;
	var numOfFaces = mesh.faceCount;
	var id = mesh.internalId;
	var numOfVertices = vbuf.length / 3;
	var material = mesh.material ? mesh.material : this.defaultMaterial;
	var palette = material.getPalette();
	var texture = mesh.texture;
	var isOpaque = (material.transparency == 0) && !texture.hasTransparency;
	var matOpacity = ~~((1 - material.transparency) * 255);
	var tbuf = mesh.texCoordBuffer;
	var tibuf = mesh.texCoordIndexBuffer;
	var tdata = texture.data;
	var tdim = texture.width;
	var tbound = tdim - 1;
	var mipmaps = texture.hasMipmap() ? texture.mipmaps : null;
	var mipentries = mipmaps ? texture.mipentries : null;

	// skip this mesh if it is fully transparent
	if(material.transparency == 1)
		return;

	if(!vnbuf || vnbuf.length < numOfVertices) {
		mesh.transformedVertexNormalZBuffer = new Array(numOfVertices);
		vnbuf = mesh.transformedVertexNormalZBuffer;
	}

	if(!fnbuf || fnbuf.length < numOfFaces) {
		mesh.transformedFaceNormalZBuffer = new Array(numOfFaces);
		fnbuf = mesh.transformedFaceNormalZBuffer;
	}

	JSC3D.Math3D.transformVectorZs(this.rotMatrix, mesh.vertexNormalBuffer, vnbuf);
	JSC3D.Math3D.transformVectorZs(this.rotMatrix, mesh.faceNormalBuffer, fnbuf);

	var isDoubleSided = mesh.isDoubleSided;

	var Xs = new Array(3);
	var Ys = new Array(3);
	var Zs = new Array(3);
	var Ns = new Array(3);
	var THs = new Array(3);
	var TVs = new Array(3);
	var i = 0, j = 0;
	while(i < numOfFaces) {
		var xformedFNz = fnbuf[i++];
		if(isDoubleSided)
			xformedFNz = xformedFNz > 0 ? xformedFNz : -xformedFNz;
		if(xformedFNz < 0) {
			do {
			} while (ibuf[j++] != -1);
		}
		else {
			var i0, i1, i2;
			var v0, v1, v2;
			var t0, t1, t2;
			i0 = ibuf[j];
			v0 = i0 * 3;
			t0 = tibuf[j] * 2;
			j++;
			i1 = ibuf[j];
			v1 = i1 * 3;
			t1 = tibuf[j] * 2;
			j++;

			if(mipmaps) {
				v2 = ibuf[j] * 3;
				t2 = tibuf[j] * 2;

				tdim = texture.width;

				Xs[0] = vbuf[v0];
				Ys[0] = vbuf[v0 + 1];
				Xs[1] = vbuf[v1];
				Ys[1] = vbuf[v1 + 1];
				Xs[2] = vbuf[v2];
				Ys[2] = vbuf[v2 + 1];

				THs[0] = tbuf[t0] * tdim;
				TVs[0] = tbuf[t0 + 1] * tdim;
				THs[1] = tbuf[t1] * tdim;
				TVs[1] = tbuf[t1 + 1] * tdim;
				THs[2] = tbuf[t2] * tdim;
				TVs[2] = tbuf[t2 + 1] * tdim;

				var faceArea = (Xs[1] - Xs[0]) * (Ys[2] - Ys[0]) - (Ys[1] - Ys[0]) * (Xs[2] - Xs[0]);
				if(faceArea < 0)
					faceArea = -faceArea;
				faceArea += 1;
				var texArea = (THs[1] - THs[0]) * (TVs[2] - TVs[0]) - (TVs[1] -  TVs[0]) * (THs[2] - THs[0]);
				if(texArea < 0)
					texArea = -texArea;
				var mipRatio = texArea / faceArea;

				var level = 0;
				if(mipRatio < mipentries[1])
					level = 0;
				else if(mipRatio >= mipentries[mipentries.length - 1]) {
					level = mipentries.length - 1;
					tdim = 1;
				}
				else {
					while(mipRatio >= mipentries[level+1]) {
						level++;
						tdim /= 2;
					}
				}

				tdata = mipmaps[level];
				tbound = tdim - 1;
			}
			
			do {
				i2 = ibuf[j];
				v2 = i2 * 3;
				t2 = tibuf[j] * 2;
				j++;

				Xs[0] = ~~(vbuf[v0]     + 0.5);
				Ys[0] = ~~(vbuf[v0 + 1] + 0.5);
				Zs[0] = vbuf[v0 + 2];
				Xs[1] = ~~(vbuf[v1]     + 0.5);
				Ys[1] = ~~(vbuf[v1 + 1] + 0.5);
				Zs[1] = vbuf[v1 + 2];
				Xs[2] = ~~(vbuf[v2]     + 0.5);
				Ys[2] = ~~(vbuf[v2 + 1] + 0.5);
				Zs[2] = vbuf[v2 + 2];

				THs[0] = tbuf[t0] * tdim;
				TVs[0] = tbuf[t0 + 1] * tdim;
				THs[1] = tbuf[t1] * tdim;
				TVs[1] = tbuf[t1 + 1] * tdim;
				THs[2] = tbuf[t2] * tdim;
				TVs[2] = tbuf[t2 + 1] * tdim;

				Ns[0] = vnbuf[i0];
				Ns[1] = vnbuf[i1];
				Ns[2] = vnbuf[i2];
				if(isDoubleSided) {
					if(Ns[0] < 0)
						Ns[0] = -Ns[0];
					if(Ns[1] < 0)
						Ns[1] = -Ns[1];
					if(Ns[2] < 0)
						Ns[2] = -Ns[2];
				}

				var high = Ys[0] < Ys[1] ? 0 : 1;
				high = Ys[high] < Ys[2] ? high : 2;
				var low = Ys[0] > Ys[1] ? 0 : 1;
				low = Ys[low] > Ys[2] ? low : 2;
				var mid = 3 - low - high;

				if(high != low) {
					var x0 = Xs[low];
					var z0 = Zs[low];
					var th0 = THs[low];
					var tv0 = TVs[low];
					var n0 = Ns[low] * 255;
					var dy0 = Ys[low] - Ys[high];
					dy0 = dy0 != 0 ? dy0 : 1;
					var xStep0 = (Xs[low] - Xs[high]) / dy0;
					var zStep0 = (Zs[low] - Zs[high]) / dy0;
					var thStep0 = (THs[low] - THs[high]) / dy0;
					var tvStep0 = (TVs[low] - TVs[high]) / dy0;
					var nStep0 = (Ns[low] - Ns[high]) * 255 / dy0;

					var x1 = Xs[low];
					var z1 = Zs[low];
					var th1 = THs[low];
					var tv1 = TVs[low];
					var n1 = Ns[low] * 255;
					var dy1 = Ys[low] - Ys[mid];
					dy1 = dy1 != 0 ? dy1 : 1;
					var xStep1 = (Xs[low] - Xs[mid]) / dy1;
					var zStep1 = (Zs[low] - Zs[mid]) / dy1;
					var thStep1 = (THs[low] - THs[mid]) / dy1;
					var tvStep1 = (TVs[low] - TVs[mid]) / dy1;
					var nStep1 = (Ns[low] - Ns[mid]) * 255 / dy1;

					var x2 = Xs[mid];
					var z2 = Zs[mid];
					var th2 = THs[mid];
					var tv2 = TVs[mid];
					var n2 = Ns[mid] * 255;
					var dy2 = Ys[mid] - Ys[high];
					dy2 = dy2 != 0 ? dy2 : 1;
					var xStep2 = (Xs[mid] - Xs[high]) / dy2;
					var zStep2 = (Zs[mid] - Zs[high]) / dy2;
					var thStep2 = (THs[mid] - THs[high]) / dy2;
					var tvStep2 = (TVs[mid] - TVs[high]) / dy2;
					var nStep2 = (Ns[mid] - Ns[high]) * 255 / dy2;

					var linebase = Ys[low] * w;
					for(var y=Ys[low]; y>Ys[high]; y--) {
						if(y >=0 && y < h) {
							var xLeft = ~~x0;
							var zLeft = z0;
							var thLeft = th0;
							var tvLeft = tv0;
							var nLeft = n0;
							var xRight, zRight, thRight, tvRight, nRight;
							if(y > Ys[mid]) {
								xRight = ~~x1;
								zRight = z1;
								thRight = th1;
								tvRight = tv1;
								nRight = n1;
							}
							else {
								xRight = ~~x2;
								zRight = z2;
								thRight = th2;
								tvRight = tv2;
								nRight = n2;
							}

							if(xLeft > xRight) {
								var temp;
								temp = xLeft;
								xLeft = xRight;
								xRight = temp;
								temp = zLeft;
								zLeft = zRight;
								zRight = temp;
								temp = thLeft;
								thLeft = thRight;
								thRight = temp;
								temp = tvLeft;
								tvLeft = tvRight;
								tvRight = temp;
								temp = nLeft;
								nLeft = nRight;
								nRight = temp;
							}

							var zInc = (xLeft != xRight) ? ((zRight - zLeft) / (xRight - xLeft)) : 1;
							var thInc = (xLeft != xRight) ? ((thRight - thLeft) / (xRight - xLeft)) : 1;
							var tvInc = (xLeft != xRight) ? ((tvRight - tvLeft) / (xRight - xLeft)) : 1;
							var nInc = (xLeft != xRight) ? ((nRight - nLeft) / (xRight - xLeft)) : 0;

							if(xLeft < 0) {
								zLeft -= xLeft * zInc;
								thLeft -= xLeft * thInc;
								tvLeft -= xLeft * tvInc;
								nLeft -= xLeft * nInc;
								xLeft = 0;
							}
							if(xRight >= w)
								xRight = w - 1;

							var pix = linebase + xLeft;
							if(isOpaque) {
								for(var x=xLeft, z=zLeft, n=nLeft, th=thLeft, tv=tvLeft; x<=xRight; x++, z+=zInc, n+=nInc, th+=thInc, tv+=tvInc) {
									if(z > zbuf[pix]) {
										zbuf[pix] = z;
										var color = palette[n > 0 ? (~~n) : 0];
										var texel = tdata[(tv & tbound) * tdim + (th & tbound)];
										var rr = (((color & 0xff0000) >> 16) * ((texel & 0xff0000) >> 8));
										var gg = (((color & 0xff00) >> 8) * ((texel & 0xff00) >> 8));
										var bb = ((color & 0xff) * (texel & 0xff)) >> 8;
										cbuf[pix] = (rr & 0xff0000) | (gg & 0xff00) | (bb & 0xff);
										sbuf[pix] = id;
									}
									pix++;
								}
							}
							else {
								for(var x=xLeft, z=zLeft, n=nLeft, th=thLeft, tv=tvLeft; x<xRight; x++, z+=zInc, n+=nInc, th+=thInc, tv+=tvInc) {
									if(z > zbuf[pix]) {
										var color = palette[n > 0 ? (~~n) : 0];
										var foreColor = tdata[(tv & tbound) * tdim + (th & tbound)];
										var backColor = cbuf[pix];
										var opaci = (((foreColor >> 24) & 0xff) * (matOpacity & 0xff)) >> 8;
										var rr = (((color & 0xff0000) >> 16) * ((foreColor & 0xff0000) >> 8));
										var gg = (((color & 0xff00) >> 8) * ((foreColor & 0xff00) >> 8));
										var bb = ((color & 0xff) * (foreColor & 0xff)) >> 8;
										if(opaci > 250) {
											zbuf[pix] = z;
										}
										else {
											var trans = 255 - opaci;
											rr = (rr * opaci + (backColor & 0xff0000) * trans) >> 8;
											gg = (gg * opaci + (backColor & 0xff00) * trans) >> 8;
											bb = (bb * opaci + (backColor & 0xff) * trans) >> 8;
										}
										cbuf[pix] = (rr & 0xff0000) | (gg & 0xff00) | (bb & 0xff);
										sbuf[pix] = id;
									}
									pix++;
								}
							}
						}

						// step up to next scanline
						//
						x0 -= xStep0;
						z0 -= zStep0;
						th0 -= thStep0;
						tv0 -= tvStep0;
						n0 -= nStep0;
						if(y > Ys[mid]) {
							x1 -= xStep1;
							z1 -= zStep1;
							th1 -= thStep1;
							tv1 -= tvStep1;
							n1 -= nStep1;
						}
						else {
							x2 -= xStep2;
							z2 -= zStep2;
							th2 -= thStep2;
							tv2 -= tvStep2;
							n2 -= nStep2;
						}
						linebase -= w;
					}
				}

				i1 = i2;
				v1 = v2;
				t1 = t2;
			} while (ibuf[j] != -1);

			j++;
		}
	}
};

/**
	Render the given mesh as solid object with sphere mapping. Lighting will be calculated per vertex and then inerpolated between and inside scanlines.
	@private
*/
JSC3D.Viewer.prototype.renderSolidSphereMapped = function(mesh) {
	var w = this.frameWidth;
	var h = this.frameHeight;
	var ibuf = mesh.indexBuffer;
	var vbuf = mesh.transformedVertexBuffer;
	var vnbuf = mesh.transformedVertexNormalBuffer;
	var fnbuf = mesh.transformedFaceNormalZBuffer;
	var cbuf = this.colorBuffer;
	var zbuf = this.zBuffer;
	var sbuf = this.selectionBuffer;
	var numOfFaces = mesh.faceCount;
	var numOfVertices = vbuf.length / 3;
	var id = mesh.internalId;
	var material = mesh.material ? mesh.material : this.defaultMaterial;
	var palette = material.getPalette();
	var sphereMap = this.sphereMap;
	var sdata = sphereMap.data;
	var sdim = sphereMap.width;
	var sbound = sdim - 1;
	var isOpaque = material.transparency == 0;
	var trans = material.transparency * 255;
	var opaci = 255 - trans;

	// skip this mesh if it is fully transparent
	if(material.transparency == 1)
		return;

	if(!vnbuf || vnbuf.length < numOfVertices * 3) {
		mesh.transformedVertexNormalBuffer = new Array(numOfVertices * 3);
		vnbuf = mesh.transformedVertexNormalBuffer;
	}

	if(!fnbuf || fnbuf.length < numOfFaces) {
		mesh.transformedFaceNormalZBuffer = new Array(numOfFaces);
		fnbuf = mesh.transformedFaceNormalZBuffer;
	}

	JSC3D.Math3D.transformVectors(this.rotMatrix, mesh.vertexNormalBuffer, vnbuf);
	JSC3D.Math3D.transformVectorZs(this.rotMatrix, mesh.faceNormalBuffer, fnbuf);

	var isDoubleSided = mesh.isDoubleSided;

	var Xs = new Array(3);
	var Ys = new Array(3);
	var Zs = new Array(3);
	var NXs = new Array(3);
	var NYs = new Array(3);
	var NZs = new Array(3);
	var i = 0, j = 0;
	while(i < numOfFaces) {
		var xformedFNz = fnbuf[i++];
		if(isDoubleSided)
			xformedFNz = xformedFNz > 0 ? xformedFNz : -xformedFNz;
		if(xformedFNz < 0) {
			do {
			} while (ibuf[j++] != -1);
		}
		else {
			var v0, v1, v2;
			v0 = ibuf[j++] * 3;
			v1 = ibuf[j++] * 3;

			do {
				v2 = ibuf[j++] * 3;

				Xs[0] = ~~(vbuf[v0]     + 0.5);
				Ys[0] = ~~(vbuf[v0 + 1] + 0.5);
				Zs[0] = vbuf[v0 + 2];
				Xs[1] = ~~(vbuf[v1]     + 0.5);
				Ys[1] = ~~(vbuf[v1 + 1] + 0.5);
				Zs[1] = vbuf[v1 + 2];
				Xs[2] = ~~(vbuf[v2]     + 0.5);
				Ys[2] = ~~(vbuf[v2 + 1] + 0.5);
				Zs[2] = vbuf[v2 + 2];

				NXs[0] = vnbuf[v0];
				NYs[0] = vnbuf[v0 + 1];
				NZs[0] = vnbuf[v0 + 2];
				NXs[1] = vnbuf[v1];
				NYs[1] = vnbuf[v1 + 1];
				NZs[1] = vnbuf[v1 + 2];
				NXs[2] = vnbuf[v2];
				NYs[2] = vnbuf[v2 + 1];
				NZs[2] = vnbuf[v2 + 2];
				if(isDoubleSided) {
					if(NZs[0] < 0)
						NZs[0] = -NZs[0];
					if(NZs[1] < 0)
						NZs[1] = -NZs[1];
					if(NZs[2] < 0)
						NZs[2] = -NZs[2];
				}

				var high = Ys[0] < Ys[1] ? 0 : 1;
				high = Ys[high] < Ys[2] ? high : 2;
				var low = Ys[0] > Ys[1] ? 0 : 1;
				low = Ys[low] > Ys[2] ? low : 2;
				var mid = 3 - low - high;

				if(high != low) {
					var x0 = Xs[low];
					var z0 = Zs[low];
					var n0 = NZs[low] * 255;
					var sh0 = ((NXs[low] / 2 + 0.5) * sdim) & sbound;
					var sv0 = ((0.5 - NYs[low] / 2) * sdim) & sbound;
					var dy0 = Ys[low] - Ys[high];
					dy0 = dy0 != 0 ? dy0 : 1;
					var xStep0 = (Xs[low] - Xs[high]) / dy0;
					var zStep0 = (Zs[low] - Zs[high]) / dy0;
					var nStep0 = (NZs[low] - NZs[high]) * 255 / dy0;
					var shStep0 = (((NXs[low] - NXs[high]) / 2) * sdim) / dy0;
					var svStep0 = (((NYs[high] - NYs[low]) / 2) * sdim) / dy0;

					var x1 = Xs[low];
					var z1 = Zs[low];
					var n1 = NZs[low] * 255;
					var sh1 = ((NXs[low] / 2 + 0.5) * sdim) & sbound;
					var sv1 = ((0.5 - NYs[low] / 2) * sdim) & sbound;
					var dy1 = Ys[low] - Ys[mid];
					dy1 = dy1 != 0 ? dy1 : 1;
					var xStep1 = (Xs[low] - Xs[mid]) / dy1;
					var zStep1 = (Zs[low] - Zs[mid]) / dy1;
					var nStep1 = (NZs[low] - NZs[mid]) * 255 / dy1;
					var shStep1 = (((NXs[low] - NXs[mid]) / 2) * sdim) / dy1;
					var svStep1 = (((NYs[mid] - NYs[low]) / 2) * sdim) / dy1;

					var x2 = Xs[mid];
					var z2 = Zs[mid];
					var n2 = NZs[mid] * 255;
					var sh2 = ((NXs[mid] / 2 + 0.5) * sdim) & sbound;
					var sv2 = ((0.5 - NYs[mid] / 2) * sdim) & sbound;
					var dy2 = Ys[mid] - Ys[high];
					dy2 = dy2 != 0 ? dy2 : 1;
					var xStep2 = (Xs[mid] - Xs[high]) / dy2;
					var zStep2 = (Zs[mid] - Zs[high]) / dy2;
					var nStep2 = (NZs[mid] - NZs[high]) * 255 / dy2;
					var shStep2 = (((NXs[mid] - NXs[high]) / 2) * sdim) / dy2;
					var svStep2 = (((NYs[high] - NYs[mid]) / 2) * sdim) / dy2;

					var linebase = Ys[low] * w;
					for(var y=Ys[low]; y>Ys[high]; y--) {
						if(y >=0 && y < h) {
							var xLeft = ~~x0;
							var zLeft = z0;
							var nLeft = n0;
							var shLeft = sh0;
							var svLeft = sv0;
							var xRight, zRight, nRight, shRight, svRight;
							if(y > Ys[mid]) {
								xRight = ~~x1;
								zRight = z1;
								nRight = n1;
								shRight = sh1;
								svRight = sv1;
							}
							else {
								xRight = ~~x2;
								zRight = z2;
								nRight = n2;
								shRight = sh2;
								svRight = sv2;
							}

							if(xLeft > xRight) {
								var temp;
								temp = xLeft;
								xLeft = xRight;
								xRight = temp;
								temp = zLeft;
								zLeft = zRight;
								zRight = temp;
								temp = nLeft;
								nLeft = nRight;
								nRight = temp;
								temp = shLeft;
								shLeft = shRight;
								shRight = temp;
								temp = svLeft;
								svLeft = svRight;
								svRight = temp;
							}

							var zInc = (xLeft != xRight) ? ((zRight - zLeft) / (xRight - xLeft)) : 1;
							var nInc = (xLeft != xRight) ? ((nRight - nLeft) / (xRight - xLeft)) : 1;
							var shInc = (xLeft != xRight) ? ((shRight - shLeft) / (xRight - xLeft)) : 1;
							var svInc = (xLeft != xRight) ? ((svRight - svLeft) / (xRight - xLeft)) : 1;
							if(xLeft < 0) {
								zLeft -= xLeft * zInc;
								nLeft -= xLeft * nInc;
								shLeft -= shLeft * shInc;
								svLeft -= svLeft * svInc;
								xLeft = 0;
							}
							if(xRight >= w) {
								xRight = w - 1;
							}
							var pix = linebase + xLeft;
							if(isOpaque) {
								for(var x=xLeft, z=zLeft, n=nLeft, sh=shLeft, sv=svLeft; x<=xRight; x++, z+=zInc, n+=nInc, sh+=shInc, sv+=svInc) {
									if(z > zbuf[pix]) {
										zbuf[pix] = z;
										var color = palette[n > 0 ? (~~n) : 0];
										var stexel = sdata[(sv & sbound) * sdim + (sh & sbound)];
										var rr = (((color & 0xff0000) >> 16) * ((stexel & 0xff0000) >> 8));
										var gg = (((color & 0xff00) >> 8) * ((stexel & 0xff00) >> 8));
										var bb = ((color & 0xff) * (stexel & 0xff)) >> 8;
										cbuf[pix] = (rr & 0xff0000) | (gg & 0xff00) | (bb & 0xff);
										sbuf[pix] = id;
									}
									pix++;
								}
							}
							else {
								for(var x=xLeft, z=zLeft, n=nLeft, sh=shLeft, sv=svLeft; x<xRight; x++, z+=zInc, n+=nInc, sh+=shInc, sv+=svInc) {
									if(z > zbuf[pix]) {
										var color = palette[n > 0 ? (~~n) : 0];
										var foreColor = sdata[(sv & sbound) * sdim + (sh & sbound)];
										var backColor = cbuf[pix];										
										var rr = (((color & 0xff0000) >> 16) * ((foreColor & 0xff0000) >> 8));
										var gg = (((color & 0xff00) >> 8) * ((foreColor & 0xff00) >> 8));
										var bb = ((color & 0xff) * (foreColor & 0xff)) >> 8;
										rr = (rr * opaci + (backColor & 0xff0000) * trans) >> 8;
										gg = (gg * opaci + (backColor & 0xff00) * trans) >> 8;
										bb = (bb * opaci + (backColor & 0xff) * trans) >> 8;
										cbuf[pix] = (rr & 0xff0000) | (gg & 0xff00) | (bb & 0xff);
										sbuf[pix] = id;
									}
									pix++;
								}
							}
						}

						// step up to next scanline
						//
						x0 -= xStep0;
						z0 -= zStep0;
						n0 -= nStep0;
						sh0 -= shStep0;
						sv0 -= svStep0;
						if(y > Ys[mid]) {
							x1 -= xStep1;
							z1 -= zStep1;
							n1 -= nStep1;
							sh1 -= shStep1;
							sv1 -= svStep1;
						}
						else {
							x2 -= xStep2;
							z2 -= zStep2;
							n2 -= nStep2;
							sh2 -= shStep2;
							sv2 -= svStep2;
						}
						linebase -= w;
					}
				}

				v1 = v2;
			} while (ibuf[j] != -1);

			j++;
		}
	}
};

JSC3D.Viewer.prototype.params = null;
JSC3D.Viewer.prototype.canvas = null;
JSC3D.Viewer.prototype.ctx = null;
JSC3D.Viewer.prototype.canvasData = null;
JSC3D.Viewer.prototype.bkgColorBuffer = null;
JSC3D.Viewer.prototype.colorBuffer = null;
JSC3D.Viewer.prototype.zBuffer = null;
JSC3D.Viewer.prototype.selectionBuffer = null;
JSC3D.Viewer.prototype.frameWidth = 0;
JSC3D.Viewer.prototype.frameHeight = 0;
JSC3D.Viewer.prototype.scene = null;
JSC3D.Viewer.prototype.defaultMaterial = null;
JSC3D.Viewer.prototype.sphereMap = null;
JSC3D.Viewer.prototype.isLoaded = false;
JSC3D.Viewer.prototype.isFailed = false;
JSC3D.Viewer.prototype.errorMsg = '';
JSC3D.Viewer.prototype.needUpdate = false;
JSC3D.Viewer.prototype.needRepaint = false;
JSC3D.Viewer.prototype.initRotX = 0;
JSC3D.Viewer.prototype.initRotY = 0;
JSC3D.Viewer.prototype.initRotZ = 0;
JSC3D.Viewer.prototype.zoomFactor = 1;
JSC3D.Viewer.prototype.rotMatrix = null;
JSC3D.Viewer.prototype.transformMatrix = null;
JSC3D.Viewer.prototype.sceneUrl = '';
JSC3D.Viewer.prototype.modelColor = 0xcaa618;
JSC3D.Viewer.prototype.bkgColor1 = 0xffffff;
JSC3D.Viewer.prototype.bkgColor2 = 0xffff80;
JSC3D.Viewer.prototype.renderMode = 'flat';
JSC3D.Viewer.prototype.definition = 'standard';
JSC3D.Viewer.prototype.isMipMappingOn = false;
JSC3D.Viewer.prototype.sphereMapUrl = '';
JSC3D.Viewer.prototype.buttonStates = null;
JSC3D.Viewer.prototype.keyStates = null;
JSC3D.Viewer.prototype.mouseX = 0;
JSC3D.Viewer.prototype.mouseY = 0;
JSC3D.Viewer.prototype.onmousedown = null;
JSC3D.Viewer.prototype.onmouseup = null;
JSC3D.Viewer.prototype.onmousemove = null;
JSC3D.Viewer.prototype.beforeupdate = null;
JSC3D.Viewer.prototype.afterupdate = null;
JSC3D.Viewer.prototype.isDefaultInputHandlerEnabled = false;


/**
	@class PickInfo

	PickInfo is used as the return value of JSC3D.Viewer's pick() method, holding picking values at a given position
	on the canvas.
*/
JSC3D.PickInfo = function() {
	this.canvasX = 0;
	this.canvasY = 0;
	this.depth = -Infinity;
	this.mesh = null;
};


/**
	@class Scene

	This class implements scene that contains a group of meshes that forms the world. 
*/
JSC3D.Scene = function() {
	this.name = '';
	this.aabb = null;
	this.children = [];
	this.maxChildId = 1;
};

/**
	Initialize the scene.
*/
JSC3D.Scene.prototype.init = function() {
	if(this.isEmpty())
		return;

	for(var i=0; i<this.children.length; i++)
		this.children[i].init();

	if(!this.aabb) {
		this.aabb = new JSC3D.AABB;
		this.calcAABB();
	}
};

/**
	See if the scene is empty.
	@returns {boolean} true if it contains no meshes; false if it has any.
*/
JSC3D.Scene.prototype.isEmpty = function() {
	return (this.children.length == 0);
};

/**
	Add a mesh to the scene.
	@param {JSC3D.Mesh} mesh the mesh to be added.
*/
JSC3D.Scene.prototype.addChild = function(mesh) {
	mesh.internalId = this.maxChildId++;
	this.children.push(mesh);
};

/**
	Remove a mesh from the scene.
	@param {JSC3D.Mesh} mesh the mesh to be added.
*/
JSC3D.Scene.prototype.removeChild = function(mesh) {
	for(var i=0; i<this.children.length; i++) {
		if(this.children[i] == mesh) {
			this.children.splice(i, 1);
			break;
		}
	}
};

/**
	Get all meshes in the scene.
	@returns {Array} meshes as an array.
*/
JSC3D.Scene.prototype.getChildren = function() {
	return this.children;
};

/**
	Calculate AABB of the scene.
	@private
*/
JSC3D.Scene.prototype.calcAABB = function() {
	this.aabb.minX = this.aabb.minY = this.aabb.minZ = Number.MAX_VALUE;
	this.aabb.maxX = this.aabb.maxY = this.aabb.maxZ = -Number.MAX_VALUE;
	for(var i=0; i<this.children.length; i++) {
		var child = this.children[i];
		if(!child.isTrivial()) {
			var minX = child.aabb.minX;
			var minY = child.aabb.minY;
			var minZ = child.aabb.minZ;
			var maxX = child.aabb.maxX;
			var maxY = child.aabb.maxY;
			var maxZ = child.aabb.maxZ;
			if(this.aabb.minX > minX)
				this.aabb.minX = minX;
			if(this.aabb.minY > minY)
				this.aabb.minY = minY;
			if(this.aabb.minZ > minZ)
				this.aabb.minZ = minZ;
			if(this.aabb.maxX < maxX)
				this.aabb.maxX = maxX;
			if(this.aabb.maxY < maxY)
				this.aabb.maxY = maxY;
			if(this.aabb.maxZ < maxZ)
				this.aabb.maxZ = maxZ;
		}
	}
};

JSC3D.Scene.prototype.name = '';
JSC3D.Scene.prototype.aabb = null;
JSC3D.Scene.prototype.children = null;
JSC3D.Scene.prototype.maxChildId = 1;


/**
	@class Mesh

	This class implements mesh that is used as an expression of 3D object and the basic primitive for rendering. <br />
	A mesh basically consists of a sequence of faces, and optioanlly a material, a texture mapping and other attributes and metadata.<br />
	A face consists of 3 or more coplanary vertex that should be descript in counter-clockwise order.<br />
	A texture mapping includes a valid texture object with a sequence of texture coordinats specified per vertex.<br />
*/
JSC3D.Mesh = function() {
	this.name = '';
	this.metadata = '';
	this.visible = true;
	this.aabb = null;
	this.vertexBuffer = null;
	this.indexBuffer = null;
	this.vertexNormalBuffer = null;
	this.faceNormalBuffer = null;
	this.material = null;
	this.texture = null;
	this.faceCount = 0;
	this.isDoubleSided = false;
	this.isEnvironmentCast = false;
	this.internalId = 0;
	this.texCoordBuffer = null;
	this.texCoordIndexBuffer = null;
	this.transformedVertexBuffer = null;
	this.transformedVertexNormalZBuffer = null;
	this.transformedFaceNormalZBuffer = null;
	this.transformedVertexNormalBuffer = null;
};

/**
	Initialize the mesh.
*/
JSC3D.Mesh.prototype.init = function() {
	if(this.isTrivial()) {
		return;
	}

	if(this.faceCount == 0) {
		this.calcFaceCount();
		if(this.faceCount == 0)
			return;
	}

	if(!this.aabb) {
		this.aabb = new JSC3D.AABB;
		this.calcAABB();
	}

	if(!this.faceNormalBuffer) {
		this.faceNormalBuffer = new Array(this.faceCount * 3);
		this.calcFaceNormals();
	}

	if(!this.vertexNormalBuffer) {
		this.vertexNormalBuffer = new Array(this.vertexBuffer.length);
		this.calcVertexNormals();
	}

	this.normalizeFaceNormals();

	this.transformedVertexBuffer = new Array(this.vertexBuffer.length);
};

/**
	See if the mesh is a trivial mesh. A trivial mesh should be omited in any calculations and rendering.
	@returns {boolean} true if it is trivial; false if not.
*/
JSC3D.Mesh.prototype.isTrivial = function() {
	return ( !this.vertexBuffer || this.vertexBuffer.length < 3 || 
			 !this.indexBuffer || this.indexBuffer.length < 3 );
};

/**
	Set material for the mesh.
	@param {JSC3D.Material} material the material object.
*/
JSC3D.Mesh.prototype.setMaterial = function(material) {
	this.material = material;
};

/**
	Set texture for the mesh.
	@param {JSC3D.Texture} texture the texture object.
*/
JSC3D.Mesh.prototype.setTexture = function(texture) {
	this.texture = texture;
};

/**
	See if the mesh has valid texture mapping.
	@returns {boolean} true if it has valid texture mapping; false if not.
*/
JSC3D.Mesh.prototype.hasTexture = function() {
	return ( (this.texCoordBuffer != null) && (this.texCoordBuffer.length >= 2) && 
			 (this.texCoordIndexBuffer != null) && (this.texCoordIndexBuffer.length >= 3) && 
			 (this.texCoordIndexBuffer.length >= this.indexBuffer.length) && 
			 (this.texture != null) && this.texture.hasData())
};

/**
	Calculate count of faces.
	@private
*/
JSC3D.Mesh.prototype.calcFaceCount = function() {
	this.faceCount = 0;

	var ibuf = this.indexBuffer;
	if(ibuf[ibuf.length - 1] != -1)
		ibuf.push(-1);

	for(var i=0; i<ibuf.length; i++) {
		if(ibuf[i] == -1)
			this.faceCount++;
	}
};

/**
	Calculate AABB of the mesh.
	@private
*/
JSC3D.Mesh.prototype.calcAABB = function() {
	var minX = minY = minZ = Number.MAX_VALUE;
	var maxX = maxY = maxZ = -Number.MAX_VALUE;

	var vbuf = this.vertexBuffer;
	for(var i=0; i<vbuf.length; i+=3) {
		var x = vbuf[i];
		var y = vbuf[i + 1];
		var z = vbuf[i + 2];

		if(x < minX)
			minX = x;
		if(x > maxX)
			maxX = x;
		if(y < minY)
			minY = y;
		if(y > maxY)
			maxY = y;
		if(z < minZ)
			minZ = z;
		if(z > maxZ)
			maxZ = z;
	}

	this.aabb.minX = minX;
	this.aabb.minY = minY;
	this.aabb.minZ = minZ;
	this.aabb.maxX = maxX;
	this.aabb.maxY = maxY;
	this.aabb.maxZ = maxZ;
};

/**
	Calculate per face normals. The reault remain un-normalized for later vertex normal calculations.
	@private
*/
JSC3D.Mesh.prototype.calcFaceNormals = function() {
	var vbuf = this.vertexBuffer;
	var ibuf = this.indexBuffer;
	var nbuf = this.faceNormalBuffer;
	var i = 0, j = 0;
	while(i < ibuf.length) {
		var index = ibuf[i++] * 3;
		var x0 = vbuf[index];
		var y0 = vbuf[index + 1];
		var z0 = vbuf[index + 2];

		index = ibuf[i++] * 3;
		var x1 = vbuf[index];
		var y1 = vbuf[index + 1];
		var z1 = vbuf[index + 2];

		index = ibuf[i++] * 3;
		var x2 = vbuf[index];
		var y2 = vbuf[index + 1];
		var z2 = vbuf[index + 2];

		var dx1 = x1 - x0;
		var dy1 = y1 - y0;
		var dz1 = z1 - z0;
		var dx2 = x2 - x0;
		var dy2 = y2 - y0;
		var dz2 = z2 - z0;

		var nx = dy1 * dz2 - dz1 * dy2;
		var ny = dz1 * dx2 - dx1 * dz2;
		var nz = dx1 * dy2 - dy1 * dx2;

		nbuf[j++] = nx;
		nbuf[j++] = ny;
		nbuf[j++] = nz;

		do {
		} while (ibuf[i++] != -1);
	}
};

/**
	Calculate per vertex normals.
	@private
*/
JSC3D.Mesh.prototype.calcVertexNormals = function() {
	if(!this.faceNormalBuffer) {
		this.faceNormalBuffer = new Array(this.faceCount * 3);
		this.calcFaceNormals();
	}

	var vbuf = this.vertexBuffer;
	var ibuf = this.indexBuffer;
	var fnbuf = this.faceNormalBuffer;
	var vnbuf = this.vertexNormalBuffer;
	for(var i=0; i<vnbuf.length; i++) {
		vnbuf[i] = 0;
	}

	var numOfVertices = vbuf.length / 3;

	var i = 0, j = 0, k = 0;
	while(i < ibuf.length) {
		k = ibuf[i++];
		if(k == -1) {
			j += 3;
		}
		else {
			var index = k * 3;
			vnbuf[index    ] += fnbuf[j];
			vnbuf[index + 1] += fnbuf[j + 1];
			vnbuf[index + 2] += fnbuf[j + 2];
		}
	}

	for(var i=0, j=0; i<vnbuf.length; i+=3, j++) {
		var nx = vnbuf[i];
		var ny = vnbuf[i + 1];
		var nz = vnbuf[i + 2];
		var len = Math.sqrt(nx * nx + ny * ny + nz * nz);
		if(len > 0) {
			nx /= len;
			ny /= len;
			nz /= len;
		}

		vnbuf[i    ] = nx;
		vnbuf[i + 1] = ny;
		vnbuf[i + 2] = nz;
	}
};

/**
	Normalize face normals.
	@private
*/
JSC3D.Mesh.prototype.normalizeFaceNormals = function() {
	var nbuf = this.faceNormalBuffer;

	for(var i=0; i<nbuf.length; i+=3) {
		var nx = nbuf[i];
		var ny = nbuf[i + 1];
		var nz = nbuf[i + 2];
		var len = Math.sqrt(nx * nx + ny * ny + nz * nz);
		if(len > 0) {
			nx /= len;
			ny /= len;
			nz /= len;
		}

		nbuf[i    ] = nx;
		nbuf[i + 1] = ny;
		nbuf[i + 2] = nz;
	}
};

JSC3D.Mesh.prototype.checkValid = function() {
	//TODO: not implemented yet
};

JSC3D.Mesh.prototype.name = '';
JSC3D.Mesh.prototype.metadata = '';
JSC3D.Mesh.prototype.visible = false;
JSC3D.Mesh.prototype.aabb = null;
JSC3D.Mesh.prototype.vertexBuffer = null;
JSC3D.Mesh.prototype.indexBuffer = null;
JSC3D.Mesh.prototype.vertexNormalBuffer = null;
JSC3D.Mesh.prototype.faceNormalBuffer = null;
JSC3D.Mesh.prototype.texCoordBuffer = null;
JSC3D.Mesh.prototype.texCoordIndexBuffer = null;
JSC3D.Mesh.prototype.material = null;
JSC3D.Mesh.prototype.texture = null;
JSC3D.Mesh.prototype.faceCount = 0;
JSC3D.Mesh.prototype.isDoubleSided = false;
JSC3D.Mesh.prototype.isEnvironmentCast = false;
JSC3D.Mesh.prototype.internalId = 0;
JSC3D.Mesh.prototype.transformedVertexBuffer = null;
JSC3D.Mesh.prototype.transformedVertexNormalZBuffer = null;
JSC3D.Mesh.prototype.transformedFaceNormalZBuffer = null;
JSC3D.Mesh.prototype.transformedVertexNormalBuffer = null;


/**
	@class Material

	This class implements material which describes the feel and look of a mesh.
*/
JSC3D.Material = function() {
	this.name = '';
	this.ambientColor = 0;
	this.diffuseColor = 0x7f7f7f;
	this.transparency = 0;
	this.simulateSpecular = false;
	this.palette = null;
};

/**
	Get the palette of the material used for shadings.
	@return {Array} palette of the material as an array.
*/
JSC3D.Material.prototype.getPalette = function() {
	if(!this.palette) {
		this.palette = new Array(256);
		this.generatePalette();
	}

	return this.palette;
};

/**
	@private
*/
JSC3D.Material.prototype.generatePalette = function() {
	var ambientR = (this.ambientColor & 0xff0000) >> 16;
	var ambientG = (this.ambientColor & 0xff00) >> 8;
	var ambientB = this.ambientColor & 0xff;
	var diffuseR = (this.diffuseColor & 0xff0000) >> 16;
	var diffuseG = (this.diffuseColor & 0xff00) >> 8;
	var diffuseB = this.diffuseColor & 0xff;

	if(this.simulateSpecular) {
		var i = 0;
		while(i < 204) {
			var r = ambientR + i * diffuseR / 204;
			var g = ambientG + i * diffuseG / 204;
			var b = ambientB + i * diffuseB / 204;
			if(r > 255)
				r = 255;
			if(g > 255)
				g = 255;
			if(b > 255)
				b = 255;

			this.palette[i++] = r << 16 | g << 8 | b;
		}

		while(i < 256) {
			var r = ambientR + diffuseR + (i - 204) * (255 - diffuseR) / 82;
			var g = ambientG + diffuseG + (i - 204) * (255 - diffuseG) / 82;
			var b = ambientB + diffuseB + (i - 204) * (255 - diffuseB) / 82;
			if(r > 255)
				r = 255;
			if(g > 255)
				g = 255;
			if(b > 255)
				b = 255;

			this.palette[i++] = r << 16 | g << 8 | b;
		}
	}
	else {
		var i = 0;
		while(i < 256) {
			var r = ambientR + i * diffuseR / 256;
			var g = ambientG + i * diffuseG / 256;
			var b = ambientB + i * diffuseB / 256;
			if(r > 255)
				r = 255;
			if(g > 255)
				g = 255;
			if(b > 255)
				b = 255;

			this.palette[i++] = r << 16 | g << 8 | b;
		}
	}
};

JSC3D.Material.prototype.name = '';
JSC3D.Material.prototype.ambientColor = 0;
JSC3D.Material.prototype.diffuseColor = 0x7f7f7f;
JSC3D.Material.prototype.transparency = 0;
JSC3D.Material.prototype.simulateSpecular = false;
JSC3D.Material.prototype.palette = null;


/**
	@class Texture

	This class implements texture which describes the surface details for a mesh.
*/
JSC3D.Texture = function() {
	this.name = '';
	this.width = 0;
	this.height = 0;
	this.data = null;
	this.mipmaps = null;
	this.mipentries = null;
	this.hasTransparency = false;
	this.srcUrl = '';
	this.onready = null;
};

/**
	Load an image and extract texture data from it.
	@param {string} imageUrl where to load the image.
	@param {boolean} useMipmap set true to generate mip-maps; false(default) not to generate mip-maps.
*/
JSC3D.Texture.prototype.createFromUrl = function(imageUrl, useMipmap) {
	var self = this;
	var img = new Image;

	img.onload = function() {
		self.data = null;
		self.mipmaps = null;
		self.mipentries = null;
		self.width = 0;
		self.height = 0;
		self.hasTransparency = false;
		self.srcUrl = '';
		self.createFromImage(this, useMipmap);
	};

	img.onerror = function() {
		self.data = null;
		self.mipmaps = null;
		self.mipentries = null;
		self.width = 0;
		self.height = 0;
		self.hasTransparency = false;
		self.srcUrl = '';
	};

	img.src = imageUrl;
};

/**
	Extract texture data from an exsisting image.
	@param {Image} image image as datasource of the texture.
	@param {boolean} useMipmap set true to generate mip-maps; false(default) not to generate mip-maps.
*/
JSC3D.Texture.prototype.createFromImage = function(image, useMipmap) {
	if(image.width <=0 || image.height <=0)
		return;

	var isCanvasClean = false;
	var canvas = JSC3D.Texture.cv;
	if(!canvas) {
		try {
			canvas = document.createElement('canvas');
			JSC3D.Texture.cv = canvas;
			isCanvasClean = true;
		}
		catch(e) {
			return;
		}
	}

	var dim = image.width > image.height ? image.width : image.height;
	if(dim <= 32)
		dim = 32;
	else if(dim <= 64)
		dim = 64;
	else if(dim <= 128)
		dim = 128;
	else if(dim <= 256)
		dim = 256;
	else
		dim = 512;

	if(canvas.width != dim || canvas.height != dim) {
		canvas.width = canvas.height = dim;
		isCanvasClean = true;
	}

	var data;
	try {
		var ctx = canvas.getContext('2d');
		if(!isCanvasClean)
			ctx.clearRect(0, 0, dim, dim);
		ctx.drawImage(image, 0, 0, dim, dim);
		var imgData = ctx.getImageData(0, 0, dim, dim);
		data = imgData.data;
	}
	catch(e) {
		return;
	}

	var size = data.length / 4;
	this.data = new Array(size);
	var alpha;
	for(var i=0, j=0; i<size; i++, j+=4) {
		alpha = data[j + 3];
		this.data[i] = alpha << 24 | data[j] << 16 | data[j+1] << 8 | data[j+2];
		if(alpha < 255)
			this.hasTransparency = true;
	}

	this.width = dim;
	this.height = dim;

	this.mipmaps = null;
	if(useMipmap)
		this.generateMipmaps();

	this.srcUrl = image.src;

	if(this.onready != null && (typeof this.onready) == 'function')
		this.onready();
};

/**
	See if this texture contains texel data.
	@returns {boolean} true if it has texel data; false if not.
*/
JSC3D.Texture.prototype.hasData = function() {
	return (this.data != null);
};

/**
	Generate mip-maps for the texture.
*/
JSC3D.Texture.prototype.generateMipmaps = function() {
	if(this.width <= 1 || this.data == null || this.mipmaps != null)
		return;

	this.mipmaps = [this.data];
	this.mipentries = [1];
	
	var numOfMipLevels = 1 + ~~(0.1 + Math.log(this.width) * Math.LOG2E);
	var dim = this.width >> 1;
	for(var level=1; level<numOfMipLevels; level++) {
		var map = new Array(dim * dim);
		var uppermap = this.mipmaps[level - 1];
		var upperdim = dim << 1;

		var src = 0, dest = 0;
		for(var i=0; i<dim; i++) {
			for(var j=0; j<dim; j++) {
				var texel0 = uppermap[src];
				var texel1 = uppermap[src + 1];
				var texel2 = uppermap[src + upperdim];
				var texel3 = uppermap[src + upperdim + 1];
				var a = ( ((texel0 & 0xff000000) >>> 2) + ((texel1 & 0xff000000) >>> 2) + ((texel2 & 0xff000000) >>> 2) + ((texel3 & 0xff000000) >>> 2) ) & 0xff000000;
				var r = ( ((texel0 & 0xff0000) + (texel1 & 0xff0000) + (texel2 & 0xff0000) + (texel3 & 0xff0000)) >> 2 ) & 0xff0000;
				var g = ( ((texel0 & 0xff00) + (texel1 & 0xff00) + (texel2 & 0xff00) + (texel3 & 0xff00)) >> 2 ) & 0xff00;
				var b = ( ((texel0 & 0xff) + (texel1 & 0xff) + (texel2 & 0xff) + (texel3 & 0xff)) >> 2 ) & 0xff;
				map[dest] = a + r + g + b;
				src += 2;
				dest++;
			}
			src += upperdim;
		}

		this.mipmaps.push(map);
		this.mipentries.push(Math.pow(4, level));
		dim = dim >> 1;
	}
};

/**
	See if this texture has mip-maps.
	@returns {boolean} true if it has mip-maps; false if not.
*/
JSC3D.Texture.prototype.hasMipmap = function() {
	return (this.mipmaps != null);
};

JSC3D.Texture.prototype.name = '';
JSC3D.Texture.prototype.data = null;
JSC3D.Texture.prototype.mipmaps = null;
JSC3D.Texture.prototype.mipentries = null;
JSC3D.Texture.prototype.width = 0;
JSC3D.Texture.prototype.height = 0;
JSC3D.Texture.prototype.hasTransparency = false;
JSC3D.Texture.prototype.srcUrl = '';
JSC3D.Texture.prototype.onready = null;
JSC3D.Texture.cv = null;


/**
	@class AABB

	This class implements the Axis-Aligned Bounding Box to measure spacial enclosure.
*/
JSC3D.AABB = function() {
	this.minX = this.maxX = 0;
	this.minY = this.maxY = 0;
	this.minZ = this.maxZ = 0;
};

/**
	Get the center coordinates of the AABB.
	@returns {Array} center coordinates as an array.
*/
JSC3D.AABB.prototype.center = function() {
	return [(this.minX + this.maxX) / 2, (this.minY + this.maxY) / 2, (this.minZ + this.maxZ) / 2];
};

/**
	Get the length of the diagonal of the AABB.
	@returns {float} length of the diagonal.
*/
JSC3D.AABB.prototype.lengthOfDiagonal = function() {
	var xx = this.maxX - this.minX;
	var yy = this.maxY - this.minY;
	var zz = this.maxZ - this.minZ;
	return Math.sqrt(xx * xx + yy * yy + zz * zz);
};


/**
	@class Matrix3x4

	This class implements 3x4 matrix and mass operations for 3D transformations.
*/
JSC3D.Matrix3x4 = function() {
	this.m00 = 1; this.m01 = 0; this.m02 = 0; this.m03 = 0;
	this.m10 = 0; this.m11 = 1; this.m12 = 0; this.m13 = 0;
	this.m20 = 0; this.m21 = 0; this.m22 = 1; this.m23 = 0;
};

/**
	Make the matrix an identical matrix.
*/
JSC3D.Matrix3x4.prototype.identity = function() {
	this.m00 = 1; this.m01 = 0; this.m02 = 0; this.m03 = 0;
	this.m10 = 0; this.m11 = 1; this.m12 = 0; this.m13 = 0;
	this.m20 = 0; this.m21 = 0; this.m22 = 1; this.m23 = 0;
};

/**
	Scale the matrix using scaling factors on each axial directions.
	@param {float} sx scaling factors on x-axis.
	@param {float} sy scaling factors on y-axis.
	@param {float} sz scaling factors on z-axis.
*/
JSC3D.Matrix3x4.prototype.scale = function(sx, sy, sz) {
	this.m00 *= sx; this.m01 *= sx; this.m02 *= sx; this.m03 *= sx;
	this.m10 *= sy; this.m11 *= sy; this.m12 *= sy; this.m13 *= sy;
	this.m20 *= sz; this.m21 *= sz; this.m22 *= sz; this.m23 *= sz;
};

/**
	Translate the matrix using translations on each axial directions.
	@param {float} tx translations on x-axis.
	@param {float} ty translations on y-axis.
	@param {float} tz translations on z-axis.
*/
JSC3D.Matrix3x4.prototype.translate = function(tx, ty, tz) {
	this.m03 += tx;
	this.m13 += ty;
	this.m23 += tz;
};

/**
	Rotate the matrix an arbitrary angle about the x-axis.
	@param {float} angle rotation angle in degrees.
*/
JSC3D.Matrix3x4.prototype.rotateAboutXAxis = function(angle) {
	if(angle != 0) {
		angle *= Math.PI / 180;
		var cosA = Math.cos(angle);
		var sinA = Math.sin(angle);

		var m10 = cosA * this.m10 + sinA * this.m20;
		var m11 = cosA * this.m11 + sinA * this.m21;
		var m12 = cosA * this.m12 + sinA * this.m22;
		var m13 = cosA * this.m13 + sinA * this.m23;
		var m20 = cosA * this.m20 - sinA * this.m10;
		var m21 = cosA * this.m21 - sinA * this.m11;
		var m22 = cosA * this.m22 - sinA * this.m12;
		var m23 = cosA * this.m23 - sinA * this.m13;

		this.m10 = m10; this.m11 = m11; this.m12 = m12; this.m13 = m13;
		this.m20 = m20; this.m21 = m21; this.m22 = m22; this.m23 = m23;
	}
};

/**
	Rotate the matrix an arbitrary angle about the y-axis.
	@param {float} angle rotation angle in degrees.
*/
JSC3D.Matrix3x4.prototype.rotateAboutYAxis = function(angle) {
	if(angle != 0) {
		angle *= Math.PI / 180;
		var cosA = Math.cos(angle);
		var sinA = Math.sin(angle);

		var m00 = cosA * this.m00 + sinA * this.m20; 
		var m01 = cosA * this.m01 + sinA * this.m21;
		var m02 = cosA * this.m02 + sinA * this.m22;
		var m03 = cosA * this.m03 + sinA * this.m23;
		var m20 = cosA * this.m20 - sinA * this.m00;
		var m21 = cosA * this.m21 - sinA * this.m01;
		var m22 = cosA * this.m22 - sinA * this.m02;
		var m23 = cosA * this.m23 - sinA * this.m03;

		this.m00 = m00; this.m01 = m01; this.m02 = m02; this.m03 = m03;
		this.m20 = m20; this.m21 = m21; this.m22 = m22; this.m23 = m23;
	}
};

/**
	Rotate the matrix an arbitrary angle about the z-axis.
	@param {float} angle rotation angle in degrees.
*/
JSC3D.Matrix3x4.prototype.rotateAboutZAxis = function(angle) {
	if(angle != 0) {
		angle *= Math.PI / 180;
		var cosA = Math.cos(angle);
		var sinA = Math.sin(angle);

		var m10 = cosA * this.m10 + sinA * this.m00;
		var m11 = cosA * this.m11 + sinA * this.m01;
		var m12 = cosA * this.m12 + sinA * this.m02;
		var m13 = cosA * this.m13 + sinA * this.m03;
		var m00 = cosA * this.m00 - sinA * this.m10;
		var m01 = cosA * this.m01 - sinA * this.m11;
		var m02 = cosA * this.m02 - sinA * this.m12;
		var m03 = cosA * this.m03 - sinA * this.m13;

		this.m00 = m00; this.m01 = m01; this.m02 = m02; this.m03 = m03;
		this.m10 = m10; this.m11 = m11; this.m12 = m12; this.m13 = m13;
	}
};

/**
	Multiply the matrix by another matrix.
	@param {JSC3D.Matrix3x4} mult another matrix to be multiplied on this.
*/
JSC3D.Matrix3x4.prototype.multiply = function(mult) {
	var m00 = mult.m00 * this.m00 + mult.m01 * this.m10 + mult.m02 * this.m20;
	var m01 = mult.m00 * this.m01 + mult.m01 * this.m11 + mult.m02 * this.m21;
	var m02 = mult.m00 * this.m02 + mult.m01 * this.m12 + mult.m02 * this.m22;
	var m03 = mult.m00 * this.m03 + mult.m01 * this.m13 + mult.m02 * this.m23 + mult.m03;
	var m10 = mult.m10 * this.m00 + mult.m11 * this.m10 + mult.m12 * this.m20;
	var m11 = mult.m10 * this.m01 + mult.m11 * this.m11 + mult.m12 * this.m21;
	var m12 = mult.m10 * this.m02 + mult.m11 * this.m12 + mult.m12 * this.m22;
	var m13 = mult.m10 * this.m03 + mult.m11 * this.m13 + mult.m12 * this.m23 + mult.m13;
	var m20 = mult.m20 * this.m00 + mult.m21 * this.m10 + mult.m22 * this.m20;
	var m21 = mult.m20 * this.m01 + mult.m21 * this.m11 + mult.m22 * this.m21;
	var m22 = mult.m20 * this.m02 + mult.m21 * this.m12 + mult.m22 * this.m22;
	var m23 = mult.m20 * this.m03 + mult.m21 * this.m13 + mult.m22 * this.m23 + mult.m23;

	this.m00 = m00; this.m01 = m01; this.m02 = m02; this.m03 = m03;
	this.m10 = m10; this.m11 = m11; this.m12 = m12; this.m13 = m13;
	this.m20 = m20; this.m21 = m21; this.m22 = m22; this.m23 = m23;
};


/**
	@class Math3D

	This class provides some utility methods for 3D mathematics.
*/
JSC3D.Math3D = {

	/**
		Transform vectors using the given matrix.
		@param {JSC3D.Matrix3x4} mat the transformation matrix.
		@param {Array} vecs a batch of vectors to be transform.
		@param {Array} xfvecs holds the transformed vetors.
	*/
	transformVectors: function(mat, vecs, xfvecs) {
		for(var i=0; i<vecs.length; i+=3) {
			var x = vecs[i];
			var y = vecs[i + 1];
			var z = vecs[i + 2];
			xfvecs[i]     = mat.m00 * x + mat.m01 * y + mat.m02 * z + mat.m03;
			xfvecs[i + 1] = mat.m10 * x + mat.m11 * y + mat.m12 * z + mat.m13;
			xfvecs[i + 2] = mat.m20 * x + mat.m21 * y + mat.m22 * z + mat.m23;
		}
	},

	/**
		Transform vectors' z components using the given matrix.
		@param {JSC3D.Matrix3x4} mat the transformation matrix.
		@param {Array} vecs a batch of vectors to be transform.
		@param {Array} xfveczs holds the transformed z components of the input vectors.
	*/
	transformVectorZs: function(mat, vecs, xfveczs) {
		var num = vecs.length / 3;
		var i = 0, j = 0
		while(i < num) {
			xfveczs[i] = mat.m20 * vecs[j] + mat.m21 * vecs[j + 1] + mat.m22 * vecs[j + 2] + mat.m23;
			i++;
			j += 3;
		}
	}
};


/**
	@class LoaderSelector
*/
JSC3D.LoaderSelector = {

	/**
		Register a scene loader for a specific file format, using the file extesion name for lookup.
		@param {string} fileExtName extension name for the specific file format.
		@param {Function} loaderCtor constructor of the loader class.
	*/
	registerLoader: function(fileExtName, loaderCtor) {
		if((typeof loaderCtor) == 'function') {
			JSC3D.LoaderSelector.loaderTable[fileExtName] = loaderCtor;
		}
	},

	/**
		Get the proper loader for a target file format using the file extension name.
		@param {string} fileExtName file extension name for the specific format.
		@returns {object} loader object for the specific format; null if not found.
	*/
	getLoader: function(fileExtName) {
		var loaderCtor = JSC3D.LoaderSelector.loaderTable[fileExtName.toLowerCase()];
		if(!loaderCtor)
			return null;

		var loaderInst;
		try {
			loaderInst = new loaderCtor();
		}
		catch(e) {
			loaderInst = null; 
		}

		return loaderInst;
	},

	loaderTable: {}
};


/**
	@class ObjLoader

	This class implements a scene loader from a wavefront obj file. 
*/
JSC3D.ObjLoader = function() {
	this.onload = null;
	this.onerror = null;
	this.onprogress = null;
	this.onresource = null;
	this.requestCount = 0;
};

/**
	Load scene from a given obj file.
	@param {string} urlName a string that specifies where to fetch the obj file.
*/
JSC3D.ObjLoader.prototype.loadFromUrl = function(urlName) {
	var urlPath = '';
	var fileName = urlName;

	var lastSlashAt = urlName.lastIndexOf('/');
	if(lastSlashAt == -1)
		lastSlashAt = urlName.lastIndexOf('\\');
	if(lastSlashAt != -1) {
		urlPath = urlName.substring(0, lastSlashAt+1);
		fileName = urlName.substring(lastSlashAt+1);
	}

	this.requestCount = 0;
	this.loadObjFile(urlPath, fileName);
};

/**
	Load scene from the obj file using the given url path and file name.
	@private
*/
JSC3D.ObjLoader.prototype.loadObjFile = function(urlPath, fileName) {
	var urlName = urlPath + fileName;
	var self = this;
	var xhr = new XMLHttpRequest;
	xhr.open('GET', urlName, true);

	xhr.onreadystatechange = function() {
		if(this.readyState == 4) {
			if(this.status == 200 || this.status == 0) {
				if(self.onload) {
					if(self.onprogress)
						self.onprogress('Loading obj file ...', 1);
					var scene = new JSC3D.Scene;
					var mtllibs = self.parseObj(scene, this.responseText);
					if(mtllibs.length > 0) {
						for(var i=0; i<mtllibs.length; i++)
							self.loadMtlFile(scene, urlPath, mtllibs[i]);
					}
					if(--self.requestCount == 0)
						self.onload(scene);
				}
			}
			else if(self.onerror) {
				self.requestCount--;
				self.onerror('Failed to load obj file \'' + urlName + '\'.');
			}
		}
	};

	if(this.onprogress) {
		this.onprogress('Loading obj file ...', 0);
		xhr.onprogress = function(event) {
			self.onprogress('Loading obj file ...', event.position / event.totalSize);
		};
	}

	this.requestCount++;
	xhr.send();
};

/**
	Load materials and textures from an mtl file and set them to corresponding meshes.
	@private
*/
JSC3D.ObjLoader.prototype.loadMtlFile = function(scene, urlPath, fileName) {
	var urlName = urlPath + fileName;
	var self = this;
	var xhr = new XMLHttpRequest;
	xhr.open('GET', urlName, true);

	xhr.onreadystatechange = function() {
		if(this.readyState == 4) {
			if(this.status == 200 || this.status == 0) {
				if(self.onprogress)
					self.onprogress('Loading mtl file ...', 1);
				var mtls = self.parseMtl(this.responseText);
				var textures = {};
				var meshes = scene.getChildren();
				for(var i=0; i<meshes.length; i++) {
					var mesh = meshes[i];
					if(mesh.mtl != null && mesh.mtllib != null && mesh.mtllib == fileName) {
						var mtl = mtls[mesh.mtl];
						if(mtl != null) {
							if(mtl.material != null)
								mesh.setMaterial(mtl.material);
							if(mtl.textureFileName != '') {
								if(!textures[mtl.textureFileName])
									textures[mtl.textureFileName] = [mesh];
								else
									textures[mtl.textureFileName].push(mesh);
							}
						}
					}
				}
				for(var textureFileName in textures)
					self.setupTexture(textures[textureFileName], urlPath + textureFileName);
			}
			else {
				//TODO: when failed to load an mtl file ...
			}
			if(--self.requestCount == 0)
				self.onload(scene);
		}
	};

	if(this.onprogress) {
		this.onprogress('Loading mtl file ...', 0);
		xhr.onprogress = function(event) {
			self.onprogress('Loading mtl file ...', event.position / event.totalSize);
		};
	}

	this.requestCount++;
	xhr.send();
};

/**
	Parse contents of the obj file, generating the scene and returning all required mtllibs. 
	@private
*/
JSC3D.ObjLoader.prototype.parseObj = function(scene, data) {
	var meshes = {};
	var mtllibs = [];
	var namePrefix = 'obj-';
	var meshIndex = 0;
	var curMesh = null;
	var curMtllibName = '';
	var curMtlName = '';

	var tempVertexBuffer = [];		// temporary buffer as container for all vertices
	var tempTexCoordBuffer = [];	// temporary buffer as container for all vertex texture coords

	// create a default mesh to hold all faces that are not associated with any mtl.
	var defaultMeshName = namePrefix + meshIndex++;
	var defaultMesh = new JSC3D.Mesh;
	defaultMesh.name = defaultMeshName;
	defaultMesh.indexBuffer = [];
	meshes['nomtl'] = defaultMesh;
	curMesh = defaultMesh;

	var lines = data.split("\n");
	for(var i=0; i<lines.length; i++) {
		var line = lines[i];
		var tokens = line.split(/[ \t]+/);
		if(tokens.length > 0) {
			var keyword = tokens[0];
			switch(keyword) {
			case 'v':
				if(tokens.length > 3) {
					for(var j=1; j<4; j++) {
						tempVertexBuffer.push( parseFloat(tokens[j]) );
					}
				}
				break;
			case 'vn':
				// ignore vertex normals
				break;
			case 'vt':
				if(tokens.length > 2) {
					tempTexCoordBuffer.push( parseFloat(tokens[1]) );
					tempTexCoordBuffer.push( 1 - parseFloat(tokens[2]) );
				}
				break;
			case 'f':
				if(tokens.length > 3) {
					for(var j=1; j<tokens.length; j++) {
						var refs = tokens[j].split('/');
						curMesh.indexBuffer.push( parseInt(refs[0]) - 1 );
						if(refs.length > 1 && refs[1] != '') {
							if(!curMesh.texCoordIndexBuffer)
								curMesh.texCoordIndexBuffer = [];
							curMesh.texCoordIndexBuffer.push( parseInt(refs[1]) - 1 );
						}
					}
					curMesh.indexBuffer.push(-1);				// mark the end of vertex index sequence for the face
					if(curMesh.texCoordIndexBuffer)
						curMesh.texCoordIndexBuffer.push(-1);	// mark the end of vertex tex coord index sequence for the face
				}
				break;
			case 'mtllib':
				if(tokens.length > 1) {
					curMtllibName = tokens[1];
					mtllibs.push(curMtllibName);
				}
				else
					curMtllibName = '';
				break;
			case 'usemtl':
				if(tokens.length > 1 && tokens[1] != '' && curMtllibName != '') {
					curMtlName = tokens[1];
					var meshid = curMtllibName + '-' + curMtlName;
					var mesh = meshes[meshid];
					if(!mesh) {
						// create a new mesh to hold faces using the same mtl
						mesh = new JSC3D.Mesh;
						mesh.name = namePrefix + meshIndex++;
						mesh.indexBuffer = [];
						mesh.mtllib = curMtllibName;
						mesh.mtl = curMtlName;
						meshes[meshid] = mesh;
					}
					curMesh = mesh;
				}
				else {
					curMtlName = '';
					curMesh = defaultMesh;
				}
				break;
			case '#':
				// ignore comments
			default:
				break;
			}
		}
	}

	var viBuffer = tempVertexBuffer.length >= 3 ? (new Array(tempVertexBuffer.length / 3)) : null;
	var tiBuffer = tempTexCoordBuffer.length >= 2 ? (new Array(tempTexCoordBuffer.length / 2)) : null;

	for(var id in meshes) {
		var mesh = meshes[id];

		// split vertices into the mesh, the indices are also re-calculated
		if(tempVertexBuffer.length >= 3 && mesh.indexBuffer.length > 0) {
			for(var i=0; i<viBuffer.length; i++)
				viBuffer[i] = -1;

			mesh.vertexBuffer = [];
			var oldVI = 0, newVI = 0;
			for(var i=0; i<mesh.indexBuffer.length; i++) {
				oldVI = mesh.indexBuffer[i];
				if(oldVI != -1) {
					if(viBuffer[oldVI] == -1) {
						var v = oldVI * 3;
						mesh.vertexBuffer.push(tempVertexBuffer[v]);
						mesh.vertexBuffer.push(tempVertexBuffer[v + 1]);
						mesh.vertexBuffer.push(tempVertexBuffer[v + 2]);
						mesh.indexBuffer[i] = newVI;
						viBuffer[oldVI] = newVI;
						newVI++;
					}
					else {
						mesh.indexBuffer[i] = viBuffer[oldVI];
					}
				}
			}
		}

		// split vertex texture coords into the mesh, the indices for tex coords are re-calculated as well
		if(tempTexCoordBuffer.length >= 2 && mesh.texCoordIndexBuffer != null && mesh.texCoordIndexBuffer.length > 0) {
			for(var i=0; i<tiBuffer.length; i++)
				tiBuffer[i] = -1;

			mesh.texCoordBuffer = [];
			var oldTI = 0, newTI = 0;
			for(var i=0; i<mesh.texCoordIndexBuffer.length; i++) {
				oldTI = mesh.texCoordIndexBuffer[i];
				if(oldTI != -1) {
					if(tiBuffer[oldTI] == -1) {
						var t = oldTI * 2;
						mesh.texCoordBuffer.push(tempTexCoordBuffer[t]);
						mesh.texCoordBuffer.push(tempTexCoordBuffer[t + 1]);
						mesh.texCoordIndexBuffer[i] = newTI;
						tiBuffer[oldTI] = newTI;
						newTI++;
					}
					else {
						mesh.texCoordIndexBuffer[i] = tiBuffer[oldTI];
					}
				}
			}
		}

		// add mesh to scene
		if(!mesh.isTrivial())
			scene.addChild(mesh);
	}

	return mtllibs;
};

/**
	Parse contents of an mtl file, returning all materials and textures defined in it.
	@private
*/
JSC3D.ObjLoader.prototype.parseMtl = function(data) {
	var mtls = {};
	var curMtlName = '';

	var lines = data.split("\n");
	for(var i=0; i<lines.length; i++) {
		var line = lines[i];
		var tokens = line.split(/[ \t]+/);
		if(tokens.length > 0) {
			var keyword = tokens[0];
			switch(keyword) {
			case 'newmtl':
				curMtlName = tokens[1];
				var mtl = {};
				mtl.material = new JSC3D.Material;
				mtl.textureFileName = '';
				mtls[curMtlName] = mtl;
				break;
			case 'Ka':
				/*
				if(tokens.length == 4 && !isNaN(tokens[1])) {
					var ambientR = (parseFloat(tokens[1]) * 255) & 0xff;
					var ambientG = (parseFloat(tokens[2]) * 255) & 0xff;
					var ambientB = (parseFloat(tokens[3]) * 255) & 0xff;
					var mtl = mtls[curMtlName];
					if(mtl != null)
						mtl.material.ambientColor = (ambientR << 16) | (ambientG << 8) | ambientB;
				}
				*/
				break;
			case 'Kd':
				if(tokens.length == 4 && !isNaN(tokens[1])) {
					var diffuseR = (parseFloat(tokens[1]) * 255) & 0xff;
					var diffuseG = (parseFloat(tokens[2]) * 255) & 0xff;
					var diffuseB = (parseFloat(tokens[3]) * 255) & 0xff;
					var mtl = mtls[curMtlName];
					if(mtl != null)
						mtl.material.diffuseColor = (diffuseR << 16) | (diffuseG << 8) | diffuseB;
				}
				break;
			case 'Ks':
				// ignore specular reflectivity definition
				break;
			case 'd':
				if(tokens.length == 2 && !isNaN(tokens[1])) {
					var opacity = parseFloat(tokens[1]);
					var mtl = mtls[curMtlName];
					if(mtl != null)
						mtl.material.transparency = 1 - opacity;
				}
				break;
			case 'illum':
				/*
				if(tokens.length == 2 && tokens[1] == '2') {
					var mtl = mtls[curMtlName];
					if(mtl != null)
						mtl.material.simulateSpecular = true;
				}
				*/
				break;
			case 'map_Kd':
				if(tokens.length == 2) {
					var texFileName = tokens[1];
					var mtl = mtls[curMtlName];
					if(mtl != null)
						mtl.textureFileName = texFileName;
				}
				break;
			case '#':
				// ignore any comments
			default:
				break;
			}
		}
	}

	return mtls;
};

/**
	Asynchronously load a texture from a given url and set it to corresponding meshes when done.
	@private
*/
JSC3D.ObjLoader.prototype.setupTexture = function(meshList, textureUrlName) {
	var self = this;
	var texture = new JSC3D.Texture;

	texture.onready = function() {
		for(var i=0; i<meshList.length; i++)
			meshList[i].setTexture(this);
		if(self.onresource)
			self.onresource(this);
	};

	texture.createFromUrl(textureUrlName);
};

JSC3D.ObjLoader.prototype.onload = null;
JSC3D.ObjLoader.prototype.onerror = null;
JSC3D.ObjLoader.prototype.onprogress = null;
JSC3D.ObjLoader.prototype.onresource = null;
JSC3D.ObjLoader.prototype.requestCount = 0;

JSC3D.LoaderSelector.registerLoader('obj', JSC3D.ObjLoader);


/**
	@class StlLoader

	This class implements a scene loader from an STL file. Both binary and ASCII STL files are supported.
*/
JSC3D.StlLoader = function() {
	this.onload = null;
	this.onerror = null;
	this.onprogress = null;
	this.onresource = null;
	this.decimalPrecision = 3;
};

/**
	Load scene from a given STL file.
	@param {string} urlName a string that specifies where to fetch the STL file.
*/
JSC3D.StlLoader.prototype.loadFromUrl = function(urlName) {
	var self = this;
	var xhr = new XMLHttpRequest;
	xhr.open('GET', urlName, true);
	xhr.overrideMimeType('text/plain; charset=x-user-defined');

	xhr.onreadystatechange = function() {
		if(this.readyState == 4) {
			if(this.status == 200 || this.status == 0) {
				if(self.onload) {
					if(self.onprogress)
						self.onprogress('Loading stl file ...', 1);
					var scene = new JSC3D.Scene;
					self.parseStl(scene, this.responseText);
					self.onload(scene);
				}
			}
			else if(self.onerror) {
				self.onerror('Failed to load stl file \'' + urlName + '\'.');
			}
		}
	};

	if(this.onprogress) {
		this.onprogress('Loading stl file ...', 0);
		xhr.onprogress = function(event) {
			self.onprogress('Loading stl file ...', event.position / event.totalSize);
		};
	}

	xhr.send();
};

/**
	Set decimal precision that defines the threshold to detect and weld vertices that coincide.
	@param {number} precision the decimal preciison.
*/
JSC3D.StlLoader.prototype.setDecimalPrecision = function(precision) {
	this.decimalPrecision = precision;
};

/**
	Parse contents of an STL file and generate the scene.
	@private
*/
JSC3D.StlLoader.prototype.parseStl = function(scene, data) {
	var UINT16_BYTES            = 2;
	var UINT32_BYTES            = 4;
	var FLOAT_BYTES             = 4;
	var HEADER_BYTES            = 80;
	var FACE_COUNT_BYTES        = UINT32_BYTES;
	var FACE_NORMAL_BYTES       = FLOAT_BYTES * 3;
	var FACE_VERTICES           = 3;
	var VERTEX_BYTES            = FLOAT_BYTES * 3;
	var ATTRIB_BYTE_COUNT_BYTES = UINT16_BYTES;

	var mesh = new JSC3D.Mesh;
	mesh.vertexBuffer = [];
	mesh.indexBuffer = [];
	mesh.faceNormalBuffer = [];

	var isBinary = false;

	// detect whether it is an ASCII STL file or a binary STL file by checking a snippet of file contents.
	if(data.length >= HEADER_BYTES + FACE_COUNT_BYTES) {
		var startOfSnippet = HEADER_BYTES + FACE_COUNT_BYTES;
		var endOfSnippet   = startOfSnippet + Math.min(256, data.length - startOfSnippet);
		for(var i=startOfSnippet; i<endOfSnippet; i++) {
			if((data[i].charCodeAt(0) & 0xff) > 0x7f) {
				isBinary = true;
				break;
			}
		}
	}
	
	if(!isBinary) {
		/*
			this should be an ASCII STL file.

			code contributed by Triffid Hunter
		*/

		var facePattern =	'facet\\s+normal\\s+([-+]?\\b(?:[0-9]*\\.)?[0-9]+(?:[eE][-+]?[0-9]+)?\\b)\\s+([-+]?\\b(?:[0-9]*\\.)?[0-9]+(?:[eE][-+]?[0-9]+)?\\b)\\s+([-+]?\\b(?:[0-9]*\\.)?[0-9]+(?:[eE][-+]?[0-9]+)?\\b)\\s+' + 
								'outer\\s+loop\\s+' + 
									'vertex\\s+([-+]?\\b(?:[0-9]*\\.)?[0-9]+(?:[eE][-+]?[0-9]+)?\\b)\\s+([-+]?\\b(?:[0-9]*\\.)?[0-9]+(?:[eE][-+]?[0-9]+)?\\b)\\s+([-+]?\\b(?:[0-9]*\\.)?[0-9]+(?:[eE][-+]?[0-9]+)?\\b)\\s+' + 
									'vertex\\s+([-+]?\\b(?:[0-9]*\\.)?[0-9]+(?:[eE][-+]?[0-9]+)?\\b)\\s+([-+]?\\b(?:[0-9]*\\.)?[0-9]+(?:[eE][-+]?[0-9]+)?\\b)\\s+([-+]?\\b(?:[0-9]*\\.)?[0-9]+(?:[eE][-+]?[0-9]+)?\\b)\\s+' + 
									'vertex\\s+([-+]?\\b(?:[0-9]*\\.)?[0-9]+(?:[eE][-+]?[0-9]+)?\\b)\\s+([-+]?\\b(?:[0-9]*\\.)?[0-9]+(?:[eE][-+]?[0-9]+)?\\b)\\s+([-+]?\\b(?:[0-9]*\\.)?[0-9]+(?:[eE][-+]?[0-9]+)?\\b)\\s+' + 
								'endloop\\s+' + 
							'endfacet';
		var faceRegExp = new RegExp(facePattern, 'ig');
		var matches = data.match(faceRegExp);

		if(matches) {		
			var numOfFaces = matches.length;

			mesh.faceCount = numOfFaces;
			var v2i = {};
			
			// reset regexp for vertex extraction
			faceRegExp.lastIndex = 0;
			faceRegExp.global = false;

			// read faces
			for(var r = faceRegExp.exec(data); r != null;r = faceRegExp.exec(data)) {
				mesh.faceNormalBuffer.push(parseFloat(r[1]), parseFloat(r[2]), parseFloat(r[3]));

				for(var i = 0; i < 3; i++) {
					var x = parseFloat(r[4 + (i * 3)]);
					var y = parseFloat(r[5 + (i * 3)]);
					var z = parseFloat(r[6 + (i * 3)]);
					
					// weld vertices by the given decimal precision
					var vertKey = x.toFixed(this.decimalPrecision) + '-' + y.toFixed(this.decimalPrecision) + '-' + z.toFixed(this.decimalPrecision);
					var vi = v2i[vertKey];
					if(vi === undefined) {
						vi = mesh.vertexBuffer.length / 3;
						v2i[vertKey] = vi;
						mesh.vertexBuffer.push(x);
						mesh.vertexBuffer.push(y);
						mesh.vertexBuffer.push(z);
					}
					mesh.indexBuffer.push(vi);
				}
				
				// mark the end of the indices of a face
				mesh.indexBuffer.push(-1);
			}
		}
	}
	else {
		/*
			this is a binary STL file
		*/

		var cur = 0;
	
		// skip 80-byte's stl file header
		cur += HEADER_BYTES;
	
		// read face count
		var numOfFaces = this.readUInt32LittleEndian(data, cur);
		cur += UINT32_BYTES;
	
		var expectedLen = HEADER_BYTES + FACE_COUNT_BYTES + 
							(FACE_NORMAL_BYTES + VERTEX_BYTES * FACE_VERTICES + ATTRIB_BYTE_COUNT_BYTES) * numOfFaces;
		
		// file is not complete
		if(data.length < expectedLen)
			return;
	
		mesh.faceCount = numOfFaces;
		var v2i = {};
	
		// read faces
		for(var i=0; i<numOfFaces; i++) {
			// read normal vector of a face
			mesh.faceNormalBuffer.push(this.readFloatLittleEndian(data, cur));
			cur += FLOAT_BYTES;
			mesh.faceNormalBuffer.push(this.readFloatLittleEndian(data, cur));
			cur += FLOAT_BYTES;
			mesh.faceNormalBuffer.push(this.readFloatLittleEndian(data, cur));
			cur += FLOAT_BYTES;
	
			// read all 3 vertices of a face
			for(var j=0; j<FACE_VERTICES; j++) {
				// read coords of a vertex
				var x, y, z;
				x = this.readFloatLittleEndian(data, cur);
				cur += FLOAT_BYTES;
				y = this.readFloatLittleEndian(data, cur);
				cur += FLOAT_BYTES;
				z = this.readFloatLittleEndian(data, cur);
				cur += FLOAT_BYTES;
	
				// weld vertices by the given decimal precision
				var vertKey = x.toFixed(this.decimalPrecision) + '-' + y.toFixed(this.decimalPrecision) + '-' + z.toFixed(this.decimalPrecision);
				var vi = v2i[vertKey];
				if(vi != undefined) {
					mesh.indexBuffer.push(vi);
				}
				else {
					vi = mesh.vertexBuffer.length / 3;
					v2i[vertKey] = vi;
					mesh.vertexBuffer.push(x);
					mesh.vertexBuffer.push(y);
					mesh.vertexBuffer.push(z);
					mesh.indexBuffer.push(vi);
				}
			}
	
			// mark the end of the indices of a face
			mesh.indexBuffer.push(-1);
	
			// skip 2-bytes's 'attribute byte count' field, since we do not deal with any additional attribs
			cur += ATTRIB_BYTE_COUNT_BYTES;			
		}
	}
	
	// add mesh to scene
	if(!mesh.isTrivial())
		scene.addChild(mesh);
};

/**
	@private
*/
JSC3D.StlLoader.prototype.readUInt32LittleEndian = function(data, start) {
	var rv = 0, f = 1;
	for (var i=0; i<4; i++) {
		rv += ((data[start + i].charCodeAt(0) & 0xff) * f);
		f *= 256;
	}

	return rv;
};

/**
	@private
*/
JSC3D.StlLoader.prototype.readFloatLittleEndian = function(data, start) {
	var mLen = 23;
	var eLen = 8;		// 4 * 8 - 23 - 1
	var eMax = 255;		// (1 << eLen) - 1;
	var eBias = 127;	// eMax >> 1;

	var i = 3; 
	var d = -1; 
	var s = data[start + i].charCodeAt(0) & 0xff; 
	i += d; 
	var bits = -7;
	var e = s & ((1 << (-bits)) - 1);
	s >>= -bits;
	bits += eLen
	while(bits > 0) {
		e = e * 256 + (data[start + i].charCodeAt(0) & 0xff);
		i += d;
		bits -= 8;
	}

	var m = e & ((1 << (-bits)) - 1);
	e >>= -bits;
	bits += mLen;
	while(bits > 0) {
		 m = m * 256 + (data[start + i].charCodeAt(0) & 0xff);
		 i += d;
		 bits -= 8;
	}

	switch(e) {
		case 0:		// 0 or denormalized number
			e = 1 - eBias;
			break;
		case eMax:	// NaN or +/-Infinity
			return m ? NaN:((s ? -1 : 1) * Infinity);
		default:	// normalized number
			m = m + Math.pow(2, mLen);
			e = e - eBias;
			break;
	}

	return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

JSC3D.StlLoader.prototype.onload = null;
JSC3D.StlLoader.prototype.onerror = null;
JSC3D.StlLoader.prototype.onprogress = null;
JSC3D.StlLoader.prototype.onresource = null;
JSC3D.StlLoader.prototype.decimalPrecision = 3;

JSC3D.LoaderSelector.registerLoader('stl', JSC3D.StlLoader);
