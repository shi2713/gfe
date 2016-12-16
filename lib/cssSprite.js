/**
 * @css sprite
 * @ctime 2014-6-30
 * @todo : support repeat-x,repeat-y
 */
var $ = require('./base.js');
var f = require('./file.js');
var gfe = require('./gfe.js');

var path = require('path');
var Images = require('gfe-images');

var cssSprite = module.exports = {};

/**
 * @addgetProjectPath
 */
function addgetProjectPath(str){
	if(!gfe.config.cdn && !/^\.\./.test(str)){
		str = '..'+str;
	}
	return str ;
}

/**
 * @imagesUrlAddCdn
 */
function imagesUrlAddCdn(imageUrl){
	var res ='';
	//console.log(gfe.config.customCdns);	
	var cdn = gfe.config.customCdns!=null ? gfe.config.customCdns["bgimg"] : gfe.config.cdn;

	// //if(gfe.config.cdn){
	// if(cdn){
	// 	res = $.replaceSlash(imageUrl);
	// 	//res = gfe.config.cdn + res;
	// 	res = cdn + res;
	// 	console.log('RRRRRRRRRRRRRRRRRRes');
	// 	console.log(res);
	// }else{
	// 	res = addgetProjectPath(imageUrl);
	// }

	res = addgetProjectPath(imageUrl);
	return  res;
}

/**
 * @init
 * @param {String} source css路径文件夹
 */
cssSprite.init = function(source){
	if(gfe.config.output.cssSpriteMode == 0){
		cssSprite.overall(source);
	}

	if(gfe.config.output.cssSpriteMode == 1){
		var list = f.getdirlist(source, '.css$');
		list.forEach(function(item){
			try{
				var cssContent = cssSprite.scatter(item, f.read(item), source);
				f.write(item, cssContent);
			}catch(e){
			}
		});
	}
}

/**
 * @overall
 * @param {String} source css路径
 * @param {String} content css源码内容
 * @example
 	background:#ffd4ae url(i/i-arrws.png?__sprite) no-repeat; 
	--> 
	background:#ffd4ae url(i/sptire_menu.png?__sprite) no-repeat;background-position:12px 10px;
 */
cssSprite.overall = function(source){
   	var reg_background = /background(?:-image)?:([\s\S]*?)(?:;|$)/gi;
   	var reg_img_url = /url\s*\(\s*("(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|[^)}]+)\s*\)/i;
	var reg_position = /(0|[+-]?(?:\d*\.|)\d+px|left|right)\s*(0|[+-]?(?:\d*\.|)\d+px|top)/i;
	var reg_repeat = /\brepeat-(x|y)/i;
	var reg_is_sprite = /[?&]__sprite/i;

	
	var result = [];
	var resultNew = [];

	var maxWidth = 0;
	var heightTotal = 0;
	var maxHeight = 0;
	var widthTotal = 0;

	var margin = gfe.config.output.cssSpriteMargin;//高度阈值
	var suffix = gfe.config.suffix;
	var imagesSuffix = gfe.config.output.imagesSuffix;
	var cssSpriteDirection = gfe.config.output.cssSpriteDirection;

	var cssFiles = f.getdirlist(source, '.css$');
	var background = [];

	cssFiles.forEach(function(file, index){
		var content = f.read(file);
		var cssBg = content.match(reg_background);
		var dir = path.dirname(file);

		if(cssBg){
			cssBg.forEach(function(bg, index){
				background.push({
					bg: bg,
					dir: dir
				});
			});
		}
	});
	
	if(background){
		var resultTemp = {};
		background.forEach(function(item, index){
			var img_url = item.bg.match(reg_img_url);

			if(img_url && reg_is_sprite.test(img_url[0]) ){
				var res = {
					content:null,
					url:null,
					position:null,
					repeat:null
				};

				var url = img_url[0].replace(/url\(|\)|\'|\"/gi,'');

				res.urlOrigin = url;
				url = url.replace(reg_is_sprite, '');

				var sprite_rem = img_url[0].match(new RegExp('__rem\\d+', 'g'));
				if(sprite_rem){
					res.rem = parseFloat(sprite_rem[0].replace('__rem', '')); 
					url = url.replace(/__rem\d+/g, '');
				}

				res.url = path.join(item.dir, url);

				if(f.exists(res.url)){
					res.content = Images(res.url);
					if(resultTemp[res.url]){
						result.forEach(function(obj){
							if(obj.url === res.url){
								//如果item数组中不包含当前元素，则添加，为了后续处理url相同但是语法不同的图片，例如：url('oldUrl')或url("oldUrl")或url(oldUrl)
								if(!~obj.items.indexOf(item.bg)){
									obj.items.push(item.bg);	
								}
								return false;
							}
						});
					}

					
					if(!resultTemp[res.url]){
						res.items = [];
						res.items.push(item.bg);

						res.width = res.content.size().width;
						res.height = res.content.size().height;

						if(cssSpriteDirection == 'vertical'){
							if(res.width>maxWidth){
								maxWidth = res.width;
							}
							heightTotal += res.height + margin;
						}else{
							if(res.height>maxHeight){
								maxHeight = res.height;
							}
							widthTotal += res.width + margin;
						}

						if(item.bg.match(reg_position)){
							res.position = item.bg.match(reg_position)[0];
						}
						if(item.bg.match(reg_repeat)){
							res.repeat = item.bg.match(reg_repeat)[0];
						}
						result.push(res);
					}
					resultTemp[res.url] = res.url;
					
				}else{
					console.log('gfe warning: [' + res.url + '] may be not exist.');
				}
			}
		});
	}

	if(result.length>0){

		var outputName = 'bg-sprite';
		var outputExtname = '.png';

		var imagesOutput = null;
		if(cssSpriteDirection == 'vertical'){
			imagesOutput = Images(maxWidth, heightTotal);
		}else{
			imagesOutput = Images(widthTotal, maxHeight);
		}

		var w = 0;
		var h = 0;

		result.forEach(function(item, i){
			if(!item.repeat){
				var positonArray = [];
				var x = 0, y = h, y2 = -h;

				if(cssSpriteDirection == 'vertical'){
					var x = 0, y = h, y2 = -h;
					if(item.position){
						var position = item.position.split(' ');
						var x1 = parseInt(position[0], 10)
						if(x1){ 
							x += x1;
						}
						var y1 = parseInt(position[1], 10)
						if(y1){
							y += y1;
							y2 -= y1;
						}
					}

					//画小图片
					imagesOutput.draw(item.content, 0, y);
				}else{
					var y = 0, x = w, x2 = -w;
					if(item.position){
						var position = item.position.split(' ');
						var x1 = parseInt(position[0], 10)
						if(x1){ 
							x += x1;
							x2 -= x1;
						}
						var y1 = parseInt(position[1], 10)
						if(y1){
							y += y1;
						}
					}

					//画小图片
					imagesOutput.draw(item.content, x, 0);
				}

				var urlOrigin = item.urlOrigin;

				//将需要合并的图片名称替换为合并后的新图片名称
				var urlOriginNew = urlOrigin.replace(path.basename(item.url, path.extname(item.url)), outputName);
				
				//将图片的存放目录统一替换为css/i
				urlOriginNew = urlOriginNew.replace(path.dirname(urlOriginNew), '/css/i');

				//给图片添加cdn
				urlOriginNew = imagesUrlAddCdn('/' + gfe.getProjectPath() + urlOriginNew);
				
				var newItems = [];
				item.items.forEach(function(itemUrl){
					var backgroundNew = itemUrl.replace(urlOrigin, urlOriginNew);
					if(cssSpriteDirection == 'vertical'){
						if(item.rem){
							backgroundNew += 'background-position:'+(x/item.rem)+'rem '+(y2/item.rem)+'rem;';
							backgroundNew += 'background-size:' + (maxWidth/item.rem) + 'rem ' + (heightTotal/item.rem) + 'rem;';
						}else{
							backgroundNew += 'background-position:'+x+'px '+y2+'px;';
						}
					}else{
						if(item.rem){
							backgroundNew += 'background-position:'+(x2/item.rem)+'rem '+(y/item.rem)+'rem;';
							backgroundNew += 'background-size:' + (maxWidth/item.rem) + 'rem ' + (heightTotal/item.rem) + 'rem;';
						}else{
							backgroundNew += 'background-position:'+x2+'px '+y+'px;';
						}
					}
					newItems.push(backgroundNew);
				});
				
				item['newItems'] = newItems;
				resultNew.push(item);
				
				if(cssSpriteDirection == 'vertical'){
					h = h + item.height + margin;
				}else{
					w = w + item.width + margin;
				}
			}
		});

		cssFiles.forEach(function(file, index){
			var content = escape(f.read(file));
			var dir = path.dirname(file);

			resultNew.forEach(function(item, index){
				//替换css中的图片路径
				var url = item.urlOrigin.replace('?__sprite', '').replace(/__rem\d+/gi, '');
				url = path.join(dir, url);
				
				if(url == item.url){
					item.newItems.forEach(function(newItem,i){
						content = content.replace(new RegExp(escape(item.items[i]), 'gi'), escape(newItem));
					});
				}
			});

			if(/w2/.test(file)){
				// console.log(unescape(content))
			}
			f.write(file, unescape(content));
		});
		
		//保存合并完成的cssSprite图片
		var outputDirName = gfe.config.outputDirName + '/css/i/';
		f.mkdir(outputDirName);
		try{
			if(imagesSuffix == 2){
				outputName = outputName + suffix;
			}
			imagesOutput.save(outputDirName + outputName + outputExtname);
		}catch(e){
			console.log(e);
		}
	}
}

/**
 * 以css文件为单位进行图片合并
 * @param  {String} source       css绝对路径
 * @param  {String} content      css源码内容
 * @param  {String} sourceOrigin css来源，例如：build文件夹
 */
cssSprite.scatter = function(source, content, sourceOrigin){
   	var reg_background = /background(?:-image)?:([\s\S]*?)(?:;|$)/gi;
   	var reg_img_url = /url\s*\(\s*("(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|[^)}]+)\s*\)/i;
	var reg_position = /(0|[+-]?(?:\d*\.|)\d+px|left|right)\s*(0|[+-]?(?:\d*\.|)\d+px|top)/i;
	var reg_repeat = /\brepeat-(x|y)/i;
	var reg_is_sprite = /[?&]__sprite/i;

	var background = content.match(reg_background);
	var result = [];

	var maxWidth = 0;
	var heightTotal = 0;
	var maxHeight = 0;
	var widthTotal = 0;

	var margin = gfe.config.output.cssSpriteMargin;//高度阈值
	var suffix = gfe.config.suffix;
	var imagesSuffix = gfe.config.output.imagesSuffix;
	var cssSpriteDirection = gfe.config.output.cssSpriteDirection;
	if(background){
		var resultTemp = {};
		background.forEach(function(item){
			var img_url = item.match(reg_img_url);
			if(img_url && reg_is_sprite.test(img_url[0]) ){
				var res = {
					content:null,
					url:null,
					position:null,
					repeat:null
				};

				var url = img_url[0].replace(/url\(|\)|\'|\"/gi,'');
				res.urlOrigin = url;
				url = url.replace(reg_is_sprite, '');

				var sprite_rem = img_url[0].match(new RegExp('__rem\\d+', 'g'));
				if(sprite_rem){
					res.rem = parseFloat(sprite_rem[0].replace('__rem', '')); 
					url = url.replace(/__rem\d+/g, '');
				}

				res.url = path.join(path.dirname(source),url);
				if(/^\/\w/.test(url)){
					res.url = path.join(gfe.config.outputDirName, gfe.getProjectPath(), url)
				}else{
					res.url = path.join(path.dirname(source),url);
				}
				// console.log(res.url);
				if(f.exists(res.url)){
					res.content = Images(res.url);
					if(resultTemp[url]){

						result.forEach(function(obj){
							if(obj.url === res.url){
								//如果item数组中不包含当前元素，则添加，为了后续处理url相同但是语法不同的图片，例如：url('oldUrl')或url("oldUrl")或url(oldUrl)
								if(!~obj.items.indexOf(item)){
									obj.items.push(item);	
								}
								return false;
							}
						});
					}

					
					if(!resultTemp[url]){
						res.items = [];
						res.items.push(item);
						res.width = res.content.size().width;
						res.height = res.content.size().height;

						if(cssSpriteDirection == 'vertical'){
							if(res.width>maxWidth){
								maxWidth = res.width;
							}
							heightTotal += res.height + margin;
						}else{
							if(res.height>maxHeight){
								maxHeight = res.height;
							}
							widthTotal += res.width + margin;
						}

						if(item.match(reg_position)){
							res.position = item.match(reg_position)[0];
						}
						if(item.match(reg_repeat)){
							res.repeat = item.match(reg_repeat)[0];
						}
						result.push(res);
					}
					resultTemp[url] = url;
				}else{
					console.log('gfe warning: [' + res.url + '] may be not exist,please check the css file['+source+']');
				}
			}
		});
	}

	if(result.length>0){

		var outputName = path.basename(source, path.extname(source));
		var outputExtname = '.png';

		var imagesOutput = null;
		if(cssSpriteDirection == 'vertical'){
			imagesOutput = Images(maxWidth, heightTotal);
		}else{
			imagesOutput = Images(widthTotal, maxHeight);
		}
		
		var w = 0;
		var h = 0;
		result.forEach(function(item, i){
			if(!item.repeat){
				outputExtname = path.extname(item.url);

				if(cssSpriteDirection == 'vertical'){
					var x = 0, y = h, y2 = -h;
					if(item.position){
						var position = item.position.split(' ');
						var x1 = parseInt(position[0], 10)
						if(x1){ 
							x += x1;
						}
						var y1 = parseInt(position[1], 10)
						if(y1){
							y += y1;
							y2 -= y1;
						}
					}

					//画小图片
					imagesOutput.draw(item.content, 0, y);
				}else{
					var y = 0, x = w, x2 = -w;
					if(item.position){
						var position = item.position.split(' ');
						var x1 = parseInt(position[0], 10)
						if(x1){ 
							x += x1;
							x2 -= x1;
						}
						var y1 = parseInt(position[1], 10)
						if(y1){
							y += y1;
						}
					}

					//画小图片
					imagesOutput.draw(item.content, x, 0);
				}

				//样式替换
				var urlOrigin = item.urlOrigin;
				
				//将合成图的路径替换为i/[cssFileName].png?__sprite
				var urlOriginNew = urlOrigin.replace(/(.*?)([?&]__sprite)/gi, 'i/' + outputName + '.png$2');
				
				item.items.forEach(function(itemUrl){
					var backgroundNew = itemUrl.replace(urlOrigin, urlOriginNew);

					if(cssSpriteDirection == 'vertical'){
						if(item.rem){
							backgroundNew += 'background-position:'+(x/item.rem)+'rem '+(y2/item.rem)+'rem;';
							backgroundNew += 'background-size:' + (maxWidth/item.rem) + 'rem ' + (heightTotal/item.rem) + 'rem;';
						}else{
							backgroundNew += 'background-position:'+x+'px '+y2+'px;';
						}
					}else{
						if(item.rem){
							backgroundNew += 'background-position:'+(x2/item.rem)+'rem '+(y/item.rem)+'rem;';
							backgroundNew += 'background-size:' + (maxWidth/item.rem) + 'rem ' + (heightTotal/item.rem) + 'rem;';
						}else{
							backgroundNew += 'background-position:'+x2+'px '+y+'px;';
						}
					}

					//替换图片路径
					content = escape(content);
					content = content.replace(new RegExp(escape(itemUrl), 'gi'), escape(backgroundNew));
					content = unescape(content);
				});
				
				
				if(cssSpriteDirection == 'vertical'){
					h = h + item.height + margin;
				}else{
					w = w + item.width + margin;
				}
			}
		});
	
		//合成大图
		try{
			f.mkdir(path.dirname(source) + '/i/');

			if(imagesSuffix == 2){
				outputName = outputName + suffix;
			}
			imagesOutput.save(path.dirname(source) + '/i/' + outputName + outputExtname);
		}catch(e){
			console.log(e);
		}
	}
	
	return content;
}
