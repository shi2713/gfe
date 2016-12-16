/**
 * @文件压缩
 * @see
 *
 * UglifyJS: uglify-js 
 * homePage: 
 * 配置 http://lisperator.net/uglifyjs/codegen
 * 配置2 http://lisperator.net/uglifyjs/compress
 * 
 * CleanCSS: clean-css
 * 配置 https://github.com/GoalSmashers/clean-css#how-to-use-clean-css-programmatically
 * 
 * Pngquant: node-pngquant-native
 *
 */

var path = require('path');
var fs = require('fs');
var requirejs = require('requirejs');

//lib自身组件
var $ = require('./base.js');
var f = require('./file.js');
var gfe = require('./gfe.js');
var base64 = require('./base64.js');

//外部组件
var UglifyJS = require("uglify-js");
var CleanCSS = require('clean-css');
// var Pngcrush = require('node-pngcrush');
var Pngquant = require('gfe-png-native');
var Htmlminify = require('html-minifier').minify;

//exports
var compress = module.exports = {};

/**
* @文件压缩初始化
* @time 2014-2-14 16:19:18
* @param src 输入文件/文件夹相对路径,无dest默认compress src
* @param dest 输出文件/文件夹相对路径
*/
compress.dir = function (src,dest){
	if (typeof(src) == 'undefined') {
		console.log('gfe warning no src folder');
		return;
	}
	
	var srcPath = path.normalize(f.currentDir()+'/'+src);
	var destPath;
	
	if (typeof(dest) == 'undefined') {
		destPath = srcPath;
	}else{
		destPath = path.normalize(f.currentDir() +'/'+dest);
		f.copy(srcPath, destPath);
	}

	compress.init(destPath);

	console.log('gfe compress success!');
}

compress.inlineCssJs = function(source){
	var inline = require('inline-source');
	
	var code = f.read(source);
	var links = code.match(/<link\s*?rel="stylesheet"\s*?href=\"(.*?)\"\s*?inline>/gim);
	var linksJs = code.match(/<script\s+?(\S*?)(\s*?)inline(\s*?)>/gim);
	if( (links && links.length>0) || (linksJs && linksJs.length>0) ){
		code = code.replace(/<link\s*?rel="stylesheet"\s*?href=\"(.*?)\"\s*?inline>/gim,'<link rel="stylesheet" href="/'+gfe.config.outputDirName+'$1" inline>');
		f.write(source,code);
		inline(source, {
			compress: true,
			// Skip all css types and png formats
			ignore: []
		}, function (err, html) {
			if(err){
				console.log(err);
			}
			f.write(source, html);
		});
	}
	
}


/**
* @文件/文件夹压缩
* @param {String} rSource 文件/文件夹绝对路径
* @param {Boolse} isdebug debug模式true时不压缩代码,仅处理路径
* @param {Object} config 多线程传参数gfe.config
* @param {Function} getProject 多线程传参数gfe.getProject
*/
compress.init = function(rSource, isdebug, config, getProject){
	if(typeof(config) != 'undefined') gfe.config = config;
	if(typeof(getProject) != 'undefined') gfe.getProject = getProject;

	var isdebug = isdebug || false;
	var allTag = true;
	var source = f.realpath(rSource);
	if(source){
		if(f.isDir(source)){
			fs.readdirSync(source).forEach(function(name){
				if(name != '.' && name != '..' && !(/.svn/.test(name)) ) {
					allTag = compress.init(source + '/' + name, isdebug) && allTag;
				}
			});
		} else if(f.isFile(source)){
			//html minify
			if( ($.is.html(source)||$.is.ftl(source)) && gfe.config.output.compresshtml){
				if(!isdebug){
					var sourceCode = compress.html(source, isdebug);
					f.write(source, sourceCode);
				}
			}

			//js UglifyJS
			if ($.is.js(source)) {
				if(gfe.config.output.rjs){
					var outputdir = path.normalize(f.currentDir()+'/'+gfe.config.outputDirName + '/' + gfe.getProjectPath());
					requirejs.optimize({
						appDir: outputdir,
						allowSourceOverwrites: true,
						keepBuildDir: true,
						dir: outputdir
					}, function(){}, function(error){})
				}else{
					if(gfe.config.output.compressJs){
						var sourceCode =  compress.js(source, isdebug);
						f.write(source, sourceCode);
					}

					var sourceCode = compress.addJsDepends(source);
					f.write(source, sourceCode);
				}
			}
			
			//css CleanCSS
			if ($.is.css(source) && gfe.config.output.compressCss) {
				var sourceCode = compress.css(source, isdebug);
				f.write(source, sourceCode);
			} else if($.is.css(source)){
				var sourceCode = compress.css2(source, isdebug);
				f.write(source, sourceCode);
			}

			//增加域名前缀
			if(gfe.config.output.cssImagesUrlReplace && $.is.css(source)) {
				var sourceCode = compress.cssImagesUrlReplace(source, sourceCode, gfe.config.cdn);
				f.write(source, sourceCode);
			}
			if(!gfe.config.output.cssImagesUrlReplace && $.is.css(source)){
				var sourceCode = compress.cssImagesUrlReplace(source, sourceCode, '');
				f.write(source, sourceCode);
			}
			
			//png optimize
			if ($.is.png(source) && !isdebug && gfe.config.output.compressPng) {
				compress.png(source, source); 
			}

			//html remove comment
			if( ($.is.html(source) || $.is.ftl(source)) && !gfe.config.output.comment){
				var content = f.read(source);
				var htmlComment = $.reg.htmlComment();
				content = content.replace(htmlComment, '').replace(/\n\s*\r/g, '');
				f.write(source, content);
			}

			if(gfe.config.output.base64 && ($.is.sass(source) || $.is.less(source) || $.is.css(source))){
				var sourceCode = base64.init(source);
				f.write(source, sourceCode);
			}	

			if( (/\.html$/.test(source)||/\.ftl$/.test(source) ) && source.indexOf('.gfe-temp')==-1){
				setTimeout(function(){
					compress.inlineCssJs(source);
				},1500);
			}

		} else {
			allTag = false;
		}
	} else {
		//console.log('error');
	}
	return allTag;
}

/**
* @js文件依赖替换
* @time 2014-2-21 18:46:24
* @param source 文件名
* @param source 文件内容
* 
*	 var a=require('a.js') ==> var a=require('projectPath/a.js')
*
*	 define('/a.js',function(require, exports) {});  ==>
*	 define('projectPath/a.js', ['projectPath/b.js'], function(require, exports) {});
*
*  define(function(require, exports)) ==> 
*	define('projectPath/a.js',['projectPath/b.js'],function(require, exports))
*
*	seajs.use(['/a.js', '/b.js'],function(){}) ==> 
*	seajs.use(['projectPath/a.js', 'projectPath/b.js'],function(){})
* 
*/
compress.addJsDepends = function(source,sC){
	var sourceCode;
	sourceCode = sC!=undefined ? sC : f.read(source);
	//var cdn = gfe.config.cdn;
	var cdn = gfe.config.customCdns!=null ? gfe.config.customCdns["js"] : gfe.config.cdn;
	var configBaseDir = gfe.config.baseDir ? gfe.config.baseDir+'/'  : '';
	var dependenceArray = [];
	var arr = sourceCode.match(/require\s*\(\s*("|')(.*?)("|')\s*\)/gmi);

	if(gfe.config.output.jsUrlReplace == false){
		cdn = "";
	}

	if (arr) {
		for (var i =0; i<arr.length; i++ ){
			var temp = arr[i].match(/require\((.*?)\)/);
			if(temp){
				temp[1] = temp[1].replace(/'|"/g, '');
				var match = temp[1];
				//无.js缀和不含有.css的url加.js
				if (! (/\.js$/i.test(match)) && !/\.css/i.test(match)) {
					match += '.js';
				}
				//add prefix
				if( /^\//.test(match) && !$.is.httpLink(match)) {
					match = match.replace(configBaseDir, '');
					match = gfe.getProjectPath()+match;
				}

				if(cdn && !$.is.httpLink(match)){
					match = (cdn + '/' + match);
				}

				//source content require add prefix
				//var a=require('a.js') ==> var a=require('projectPath/a.js')
				sourceCode = sourceCode.replace(arr[i], 'require("'+match+'")');
				dependenceArray.push('"' + match + '"');
			}
		}
	}
	dependenceArray = dependenceArray.join(',');

	/**
	* @has file id add dependenceArray
	* @example
	*	 define('/a.js',function(require, exports) {});  ==>
	*	 define('projectPath/a.js', ['projectPath/b.js'], function(require, exports) {});
	*/
	if (dependenceArray.length>0) {
		//insert 
		var arrTemp = /(define\(.*?["|'].*?["|']).*?,function/m.exec(sourceCode);
		var strTemp = arrTemp ? arrTemp[1] : null;
		if(strTemp){
			// source = source.replace(strTemp, strTemp+','+'['+dependenceArray+']');
		}
	}
	
	/**
	* @add files id and dependenceArray
	* @example  
	*  define(function(require, exports)) ==> 
	*  define('projectPath/a.js',['projectPath/b.js'],function(require, exports))
	*/
	// if ( /define\(function/gm.exec(sourceCode) ) {
	// 	//getProjectPath
	// 	var filepath = source.split(gfe.config.outputDirName+'/'+gfe.getProjectPath());
	// 	var filename = null;
	// 	if (filepath && filepath.length>1) {
	// 		filename = filepath[1].replace(configBaseDir, '');
	// 		var getProjectPath = gfe.getProjectPath() ? gfe.getProjectPath()+'/'  : '';
	// 		filename = getProjectPath+filename;
	// 	};

	// 	if (!filename) {
	// 		filename = path.basename(source);
	// 	}

	// 	//del // prefix
	// 	filename = filename.replace(/\/\//g, '/');
	// 	if (dependenceArray.length==0) {
	// 		dependenceArray = '';
	// 	}

	// 	if(cdn && !($.is.httpLink(filename))){
	// 		filename = cdn + '/' + filename;
	// 	}
	// 	sourceCode = sourceCode.replace('define(function','define("'+filename+'",['+dependenceArray+'],function');
	// }

	/**
	* @seajs.use add prefix 
	* @example  
	*	seajs.use(['/a.js', '/b.js'],function(){}) ==> 
	*	seajs.use(['projectPath/a.js', 'projectPath/b.js'],function(){})
	*/
	//var hasSeajs = sourceCode.match(/seajs\.use\((.*?),\s*function/gim);
	var hasSeajs = sourceCode.match(/seajs\.use\(((\[(.*?)])|(\'(.*?)\')|(\"(.*?)\"))/gim);
	if (hasSeajs) {
		//去重obj
		var tempObj = {};

		for (var i =0, j= hasSeajs.length; i<j; i++){
			var  t= hasSeajs[i].replace(/seajs.use\(|\[|\]|\)|,function/gim, '');
			var t1 = t.split(',');
			if (t1) {
				for (var m=0; m<t1.length; m++ ){
					//get origin source
					var t2 = t1[m].replace(/[\"\'\s]/g, '');
					var t3 = t2.replace(configBaseDir, '');

					if(!$.is.httpLink(t2)){
						if (/^\//.test(t2)) {
							if(cdn){
								tempObj[t2] = cdn + '/' + gfe.getProjectPath() + t3;
							}else{
								tempObj[t2] = gfe.getProjectPath() + t3;
							}

						}else if(!/^\.\//.test(t2) && !/^\.\.\//.test(t2)){
							if(cdn){
								tempObj[t2] = cdn + '/' + t3;
							}else{
								tempObj[t2] = t3;
							}
						}
					}
				}
			}
		}
		for (var i in tempObj ){
			var reg = new RegExp('["\']'+i+'["\']', 'gim');
			sourceCode = sourceCode.replace(reg, '"'+tempObj[i]+'"');
		}
	}
	return sourceCode;
};

/**
* @增加前缀banner
* @return {String} /* projectPath - Date:2014-03-13 13:06:12:120 * /
*/
compress.setPrefixBanner = function(bannerType, source, result){
	var projectPath = gfe.getProjectPath() ? gfe.getProjectPath().replace('/','-')+' '  : '';
	var basename = path.basename(source);
	var banner = '';

	if(bannerType == 1){
		banner = '/* '+projectPath + basename +' Date:'+$.getDay('-')+' '+$.getTime(':', false)+' */\r\n';
	}
	
	if(bannerType == 2){
		banner = '/* '+projectPath + basename +' md5:'+$.md5(result)+' */\r\n';
	}

	return banner;
}

/**
* @html文件压缩
* @param source 文件/文件夹路径
* @return compress code
*/
compress.html = function(source, isdebug){
	if(!f.exists(source)){
		return;
	}

	var sourceContent = f.read(source);
	sourceContent = sourceContent.replace(/console\.(.+)/g,''); //删除页面JS中的console.
	var minify = Htmlminify(sourceContent, {
		removeComments: true,		//移除注释
		ignoreCustomFragments: [/(<\/??#.+?\s+?.*?)>/gim],  //
		collapseWhitespace: true,	//合并多余的空格
		minifyJS: true,				//压缩文件中的js代码
		minifyCSS: true				//压缩文件中的css代码
	});
	return minify;
}

/**
* @js文件压缩
* @param source 文件/文件夹路径
* @return compress code
*/
compress.js = function(source, isdebug){
	var isdebug = isdebug || false;
	if (!f.exists(source)) {
		return;
	}
	var sourceContent = f.read(source);
	//sourceContent = compress.addJsDepends(sourceContent);
	
	var options = {
		remove: [],//
		except: ['require','define'],//不压缩的字符名
		ascii_only: true,//输出Unicode characters
		beautify: false,//美化代码
		warnings: false//显示压缩报错
		//,mangle: false//是否压缩 失效的参数
	};

	if(gfe.config.output.jsRemove){
		options.remove = gfe.config.output.jsRemove;
	}

	var result = sourceContent;

	try {
		if (!isdebug){
			//parse
			UglifyJS.base54.reset();
			var toplevel = UglifyJS.parse(sourceContent);
			toplevel.figure_out_scope();
			var compressorOption = {
				hoist_funs : false,  //函数声明至顶端
				//fromString: true,  //说明代码源的格式是否为字符串
				//mangle: true,      //是否压缩,只要配置就不压缩了
				warnings: false,     //显示压缩报错
				join_vars: false
			}
			if (options.warnings) {
				compressorOption.warnings = options.warnings;
			}

			//remove console.log
			var matchRemoveOption = function(host, method){
				return !options.remove.every(function(element){
				  if(element.indexOf(".") == -1){
				    return element != host;
				  }
				  return element != host + '.' + method;
				});
			}
			var removeConsoleTransformer = new UglifyJS.TreeTransformer(function(node, descend){
				if(node instanceof UglifyJS.AST_Call){
					var host, method;
					try{
						host = node.expression.start.value;
						method = node.expression.end.value;
					}catch(err){
					
					}
					
					if(host && method){
						if(matchRemoveOption(host, method)){
							return new UglifyJS.AST_Atom();
						}
					}
				}
				descend(node, this);
				return node;
			});
			toplevel = toplevel.transform(removeConsoleTransformer);

			var compressor = UglifyJS.Compressor(compressorOption);
			toplevel = toplevel.transform(compressor);
			toplevel.mangle_names({except:options.except});

			//output, has /*$ */ comments
			var compressJsReg = gfe.config.output.compressJsReg;
			if(f.filter(source, false, compressJsReg)){
				var stream = UglifyJS.OutputStream({
					comments: function(scope, comment){
						if ( isdebug ){
							return true;
						}else{
							if(comment.type == 'comment2' && comment.value.charAt(0) === '$' && options.copyright){
								return comment;
							}
							return false;
						}
					},
					space_colon : false,
					//quote_keys: true, object keys加引号
					beautify: options.beautify,
					ascii_only: options.ascii_only
				});

				toplevel.print(stream);
				result = stream.get();
			}			
			
		}

		//增加前缀banner
		if(!isdebug){
			result = compress.setPrefixBanner(gfe.config.output.hasBanner, source, result) + result + '\r\n';
		}
	}catch (e) {
		if (e && e.message) {
			console.log('gfe error [compress.js] - '+source +' , line:'+e.line +', ' +e.message );
		}
	}
	return result;
};


/**
* @css文件压缩
* @param source 文件/文件夹路径
* @return compress code
*/
compress.css = function(source, isdebug){
	var isdebug = isdebug || false;

	if (!f.exists(source)) {return;}
	var sourceCode = f.read(source);
	var result = sourceCode;

	var compressCssReg = gfe.config.output.compressCssReg;
	if(f.filter(source, false, compressCssReg)){
		if ( !isdebug ){
			result = new CleanCSS({
				aggressiveMerging:false,//disable aggressive merging of properties.
				keepBreaks:false,//是否有空格
				processImport:false,//是否替换@import
				compatibility: '*'
			}).minify(sourceCode);
		}
	}

	if(gfe.config.output.imagesSuffix){
		result = compress.imagesSuffix(source, result);
	}

	//增加前缀banner
	result = compress.setPrefixBanner(gfe.config.output.hasBanner, source, result) + result + '\r\n';
	
	return result;
};

compress.css2 = function(source, isdebug){
	var isdebug = isdebug || false;

	if (!f.exists(source)) {return;}
	var sourceCode = f.read(source);
	var result = sourceCode;
	if(gfe.config.output.imagesSuffix){//替换imagesSuffix情况下的image名称
		result = compress.imagesSuffix(source, result);
	}
	return result;
}

/**
* css中图片路径替换
* @time 2014-2-21 10:17:13
* @param cdn 前缀
* @param prefix css目录前缀
* @param suffix 后缀 
* @example 
	cssImagesUrlReplace('.test{background-image:url("i/test.jpg");}','http://cdn.com/','?time=123') ===> 
	.test{background-image:url("http://cdn.com/i/test.jpg?time=123");}
*/
compress.cssImagesUrlReplace = function (source, str, cdn, prefix, suffix) {

	//自定义css中图片路径的cdn
	if(gfe.config.output.cssImagesUrlReplace){
		cdn = gfe.config.customCdns!=null ? gfe.config.customCdns["bgimg"] : cdn;
	}

	//是否为widget中的css文件
	var isWidgetCssFileReg = new RegExp("/"+gfe.config.widgetDir+"/","igm");
	var isWidgetCssFile = isWidgetCssFileReg.test(source);

    var suffix = gfe.config.suffix;

    var imagesSuffix = gfe.config.output.imagesSuffix;

    var cssImagesUrlReg = new RegExp("url\\(.*?\\)","igm");
    var temp,strType = typeof str;
    if(strType=="string"){
    	temp = str.match(cssImagesUrlReg);
    }

    var sourcedir = path.normalize( path.dirname(source) );
	var outputdir = path.normalize( f.currentDir()+'/'+gfe.config.outputDirName);

	var prefix = sourcedir.replace(outputdir , '');
	//项目在C盘,build在D盘
	prefix = prefix.replace(path.normalize(gfe.config.outputDirName), '');

	// \替换成/
	prefix = prefix.replace(/\\/g, '/');
	prefix = '/' + prefix +'/';
	// //替换成/
	prefix = prefix.replace(/\/\//gim,'/');
    if (temp) {
		var tempObj = {};
		//去重
		for (var i = temp.length - 1; i >= 0; i--) {
			if ($.is.imageFile(temp[i])) {
				tempObj[temp[i]] = 1;
			}
		}

		for (var i in tempObj){
			var b = i;
			b = b.replace('url(','');
			b = b.replace(')','');
			b = b.replace(/\s/g,'');
			b = b.replace(/\"/g,'');
			b = b.replace(/\'/g,'');

			if ( b != 'about:blank' && !$.is.httpLink(b) && !/data:image/.test(b)) {

				var bOrigin = b;

				var c = b.replace(/\.\.\//g,"");
				c = c.replace(/(^\.\/)/,"");

				var hasWidget = new RegExp("^/"+gfe.config.widgetDir,"igm");
				if ( hasWidget.test(b)){
					// /widget/aaa 替换
					c = cdn+'/'+gfe.getProjectPath()+'/'+c;
				}else{
					if(gfe.config.baseDir){
						// /css/ replace其中的/app/
						c = c.replace('/'+gfe.config.baseDir+'/', "");
						// /css/ replace其中的 app/
						c = c.replace(gfe.config.baseDir+'/', '');
					}

					if(isWidgetCssFile){
						var hasCss = new RegExp(gfe.config.cssDir, "igm");
						//widget中样式引用css中的图片
						if(hasCss.test(c) && c.indexOf('/') == 0){
							c = cdn+'/'+$.replaceSlash(gfe.getProjectPath()+'/'+c);
						}else{
							c = cdn+$.replaceSlash(prefix+c);
						}
					}else{
						//页面中写样式的场景暂不处理，使用inline方式代替，注释人：midday
						if(/\.html$/.test(source)||/\.ftl$/.test(source)){
							if(/^\//.test(c)){
								c = cdn+c;
							}else{
								c = cdn+'/'+$.replaceSlash(gfe.getProjectPath()+'/css/'+c);
							}
							if(/\?\_\_sprite$/.test(c)){
								var type = c.substring(c.lastIndexOf('.'),c.lastIndexOf('.')+4);
								var s = c.substring(0,c.lastIndexOf("/")+1);
								c = s+gfe.getProjectPath()+type+'?__sprite';
							}
						}else{
							
							if(/\?\_\_sprite[0-9]{13}$/.test(c) ||/\?\_\_sprite$/.test(c) || /\?.*?$/.test(c)){ //处理sprite图片地址
								if(/^\//.test(c)){
									c = cdn + c;
								}else{
									c = cdn+'/'+gfe.getProjectPath() + $.replaceSlash(path.join(prefix,b).replace(/\\/g,'/'));
								}
							}else{ //处理正常图片(非sprite图片)地址
								if(/^\//.test(c)){
									c = cdn+c;
								}else{
									c = cdn+'/' + gfe.getProjectPath() + $.replaceSlash(path.join(prefix,b).replace(/\\/g,'/'));
								}
							}
						}
					}
				}

				var signStr=bOrigin.split('?')[1];
				bOrigin = bOrigin.replace('/', '\\\/').replace('?'+signStr, '\\?'+signStr);
				var sReg = new RegExp('url\\("{0,1}'+bOrigin+'"{0,1}\\)', 'gim');
				str = str.replace(sReg, 'url('+c+')');
			}
		};
    };

    return str;
}

compress.imagesSuffix = function(source, str){
	var imagesSuffix = gfe.config.output.imagesSuffix;
	var suffix = gfe.config.suffix;

	if(imagesSuffix == 1){
		str = str.replace(new RegExp('\\.png\\?__sprite', 'gmi'), '.png?__sprite'+suffix);
	}else if(imagesSuffix == 2){
		str = str.replace(/\.png\?__sprite/gmi, suffix+'.png?__sprite');
	}

	return str;
}


/**
@method	Pngquant优化png图片
@option {String} source 输入文件路径
@option {String} target 输出文件路径
@option {Function} callback 回调函数
@option {Boolse} false 是否显示log
**/
compress.png = function(source, target, callback, haslog){
	var compressPngReg = gfe.config.output.compressPngReg;
	if(f.filter(source, false, compressPngReg)){
		
	    fs.readFile(source, function (err, buffer) {
			if (err){
				return callback(err);
			}
	      
	      	var options = {};
			if(typeof(haslog) != 'undefined'){
				options.params = '-v --iebug';
			}
			
			buffer = Pngquant.option(options).compress(buffer);

			fs.writeFile(target, buffer, {
				flags: 'wb'
			}, callback);
	    });
    }
};
