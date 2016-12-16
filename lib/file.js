/**
* @文件操作 
*/

//原生组件
var path = require('path');
var fs = require('fs');
var util = require('util');
var Url = require('url');
var iconv = require('iconv-lite');
var inline = require('inline-source');
var crypto = require('crypto');

//core function
var f = module.exports = {
	getSuffix:function(url){
		return url.substring(url.lastIndexOf('.')+1);
	},
	exists:fs.existsSync || path.existsSync,
	isFile : function(path){
		return this.exists(path) && fs.statSync(path).isFile();
	},
	isDir : function(path){
		return this.exists(path) && fs.statSync(path).isDirectory();
	},
	isBlankDir: function(path){
		return f.getdirlist(path).length == 0;
	},
	isWin : process.platform.indexOf('win') === 0,
	realpath : function(path){
		if(path && f.exists(path)){
			path = fs.realpathSync(path);
			if(this.isWin){
				path = path.replace(/\\/g, '/');
			}
			if(path !== '/'){
				path = path.replace(/\/$/, '');
			}
			return path;
		} else {
			return false;
		}
	},
	/**
	* @路径格式化 \ ==> /
	*/
	pathFormat:function(str){
		return str.replace(/\\/g,'\/');
	},
	currentDir:function(){
		return fs.realpathSync('.');
	},
	/**
	* @读文件
	* @update 
	*/
	read:function(path,encodeing){
		if (this.exists(path)){
			try {
				var encodeing = encodeing || 'utf8';
				return fs.readFileSync(path,encodeing);
			} catch (e) {
				console.log("gfe error [f.read]");
				console.log(path);
				console.log(e);
			}		
		}
	},
	/**
	* @写文件
	*/
	write:function(path,source,encodeing,cb){
		try {
			var encodeing = encodeing || 'utf8';

			if(encodeing == 'gbk'){
				var s = iconv.decode(source, 'gbk');
    			source = iconv.encode(s, 'gbk');
    		}

			fs.writeFileSync(path , source, encodeing);
			cb && cb(path);
		} catch (e) {
			console.log("gfe error [f.write] " + path);
			console.log(e);
		}
	},
    /**
     * @copy二进制文件
     */
    copyBinary:function(srcFile, destFile){
    	var BUF_LENGTH = 64 * 1024;
		var _buff = new Buffer(BUF_LENGTH);
		
        try {
            var fdr = fs.openSync(srcFile, 'r')
            var stat = fs.fstatSync(fdr)
            var fdw = fs.openSync(destFile, 'w', stat.mode)
            var bytesRead = 1
            var pos = 0

            while (bytesRead > 0) {
                bytesRead = fs.readSync(fdr, _buff, 0, BUF_LENGTH, pos)
                fs.writeSync(fdw, _buff, 0, bytesRead)
                pos += bytesRead
            }

            fs.closeSync(fdr)
            fs.closeSync(fdw)
        } catch (e) {
            console.log("gfe error [f.copyBinary] " + srcFile);
            console.log(e);
        }
    },
	/**
	* @删除文件
	* @param source {String} 原始路径
	* @param callback {Function} 回调函数
	*/
	del:function(source,callback){
		var removedAll = true;
		var source = f.realpath(source);

		if(source){
			if(f.isDir(source)){
				var files;
				try {
					files = fs.readdirSync(source);
				} catch (err) {
					console.log(err);
				}
				
				files.forEach(function(name){
					if(name != '.' && name != '..') {
						removedAll = f.del(source + '/' + name) && removedAll;
					}
				});

				if(removedAll) {
					if(fs.existsSync(source)){
						fs.rmdirSync(source);	
					}
					
					if(callback) callback();
				}
			} else if(f.isFile(source)){
				if (f.isWin && f.exists(source)) {
					fs.chmodSync(source, 666);
				}
				fs.unlinkSync(source);
			} else {
				removedAll = false;
			}
		}

		return removedAll;
	},
	/**
	* @文件筛选
	* @param {String}  source  原始文件夹/文件路径
	* @param {String}  include  包括的文件后缀
	* @param {String}  exclude  不包括的文件后缀
	* @example f.filter(source, null, 'less|scss')
	*/
	filter:function(source, include, exclude){
		var filterTag = true;
		if (include) {
			var reg = new RegExp(include, 'gm');
			var regResult = reg.exec(source);
			if (!regResult) {
				filterTag = false;
			}
		}

		if (exclude) {
			var reg = new RegExp(exclude, 'gm');
			var regResult = reg.exec(source);
			if (regResult) {
				filterTag = false;
			}
		}

		return filterTag;
	},
	/**
	* @文件夹/文件复制不包括那些文件
	*/
	excludeFiles:function(filename){
		 return !(/.svn|Thumbs.db|.DS_Store/.test(filename));
	},
	/**
	* @生成md5
	*/
	getMd5:function(str){
	    str=str.toString();
	    var obj=crypto.createHash('md5');
	    obj.update(str);
	    var md5Str = obj.digest('hex').substring(0,8);
	    return md5Str;
	},
	/**
	* @JS和CSS文件生成MD5,并生成json文件,文件里是文件名对应的加了md5的文件名
	*/
	genMd5:function(target,source,encoding){
		var gfe = require('./gfe.js');
		var cssregExp = eval("/^"+gfe.config.outputDirName+"\\/css/").test(target);
		var jsregExp = eval("/^"+gfe.config.outputDirName+"\\/js/").test(target);
		var suf = (/\.css$/.test(target) || /\.js$/.test(target));
		var isMd5 = (gfe.config['output'].cssMd5 || gfe.config['output'].jsMd5);
		var isWidget = eval("/^"+gfe.config.outputDirName+"\\/widget/").test(target);

		if( isMd5 && suf && (cssregExp||jsregExp) && !isWidget){
			var originCssPath = target.split(gfe.config.outputDirName+"/css/")[1];
			var originJsPath = target.split(gfe.config.outputDirName+"/js/")[1];

			var str = fs.readFileSync(source);
			var md5Str = "_"+f.getMd5(str);
			var fileName = target.substring(target.lastIndexOf('/')+1,target.length).split('.')[0];
			var suffix = f.getSuffix(target);

			if(suffix=="css" && gfe.config['output'].cssMd5){
				target = target.substring(0,target.lastIndexOf('/')+1);
				target = target+fileName+md5Str+"."+suffix;
				f.write(target,fs.readFileSync(source), encoding);

				var md5CssPath = target.split(gfe.config.outputDirName+"/css/")[1];
				var revcss = process.cwd()+"/"+gfe.config.outputDirName+'/revcss.json';
				
				if(!f.exists(revcss)){
					var cssCon = {};
					cssCon[originCssPath] = md5CssPath;
					fs.writeFileSync(revcss,JSON.stringify(cssCon,null,4));
				}else{
					var cssFileCon = fs.readFileSync(revcss);
					cssFileCon = JSON.parse(cssFileCon);
					cssFileCon[originCssPath] = md5CssPath;
					fs.writeFileSync(revcss,JSON.stringify(cssFileCon,null,4));
				}
			}

			if(suffix=="js" && gfe.config['output'].jsMd5){
				target = target.substring(0,target.lastIndexOf('/')+1);
				target = target+fileName+md5Str+"."+suffix;
				f.write(target,fs.readFileSync(source), encoding);

				var md5JsPath = target.split(gfe.config.outputDirName+"/js/")[1];
				var revjs = process.cwd()+"/"+gfe.config.outputDirName+'/revjs.json';
				if(!f.exists(revjs)){
					var jsCon = {};
					jsCon[originJsPath] = md5JsPath;
					fs.writeFileSync(revjs,JSON.stringify(jsCon,null,4));
				}else{
					var jsFileCon = fs.readFileSync(revjs);
					jsFileCon = JSON.parse(jsFileCon);
					jsFileCon[originJsPath] = md5JsPath;
					fs.writeFileSync(revjs,JSON.stringify(jsFileCon,null,4));
				}
			}
		}
		return target;
	},
	/**
	* @替换html、ftl文件中的css和js地址为md5戳地址
	*/
	md5Replace:function(sourceCode){
		var gfe = require('./gfe.js');
		var outputDirName = gfe.config.outputDirName;
		if(gfe.config['output'].cssMd5){
			if(f.exists(process.cwd()+"/"+outputDirName+"/revcss.json")){
				var cssRev = fs.readFileSync(process.cwd()+"/"+outputDirName+"/revcss.json");
				cssRev = JSON.parse(cssRev);
				for(var i in cssRev){
					sourceCode = sourceCode.replace(new RegExp(i,"gm"),cssRev[i]);
				}
			}
		}

		if(gfe.config['output'].jsMd5){
			if(f.exists(process.cwd()+"/"+outputDirName+"/revjs.json")){
				var jsRev = fs.readFileSync(process.cwd()+"/"+outputDirName+"/revjs.json");
				jsRev = JSON.parse(jsRev);
				for(var i in jsRev){
					sourceCode = sourceCode.replace(new RegExp(i,"gm"),jsRev[i]);
				}
			}
		}		

		return sourceCode;
	},
	/**
	* @文件夹/文件复制
	* @param source {String} 原始文件夹/文件路径
	* @param target {String} 目标文件夹/文件路径
	* @param uncover {Boole} false 覆盖
	* @param move {Boole} false 移动
	* @example f.copy(source,target,'include.js','exclude.css',false,false,false);
	*/
	copy:function(source, target, include, exclude, uncover, move , logTag, encoding){
		var removedAll = true;
		var source = f.realpath(source);

		if(source && f.filter(source, null, exclude)){
			if (!f.exists(target) && f.isDir(source)) {
				f.mkdir(target);
                //fs.chmodSync(target, 666);
			}
			
			if(f.isDir(source)){
				fs.readdirSync(source).forEach(function(name){
					if(name != '.' && name != '..' && f.excludeFiles(name)  ) {
						removedAll = f.copy(source + '/' + name,target + '/' + name, include, exclude, uncover, move , logTag ) && removedAll;
					}
				});

				//Bug  return binding.rmdir(pathModule._makeLong(path));
				//https://github.com/joyent/node/issues/3051
				//Yes, fs.rmdirSync throw an error, as you see. Because the directory still has a file even after fs.unlinkSync is called to remove the file.
				if(move && removedAll) {
					fs.rmdirSync(source);
				}
			} else if(f.isFile(source) && f.filter(source, include, exclude)){
				if(uncover && f.exists(target)){
					//uncover
					removedAll = false;
				} else {
					//中文会报错

					var target = f.genMd5(target,source,encoding); //做覆盖式发布时，生成md5戳的css和js文件
					
					f.write(target,fs.readFileSync(source), encoding);

					var gfe = require('./gfe.js');
					var compress = require('./compress.js');
					var targetBase = gfe.config.outputDirName;


					//不处理outputOnlyCopy中的文件
					var outputOnlyCopyFiles = true;
					if (gfe.config.outputOnlyCopy){
						var customArray = gfe.config.outputOnlyCopy.split('|');						
						customArray.forEach(function(name){
							if (target.replace(targetBase+'\\','').indexOf(name) == 0){
								outputOnlyCopyFiles = false;
							}
						});
					}

					if(/\.js$/.test(target) && outputOnlyCopyFiles){
						compress.addJsDepends(target);
					}

					if( (/\.html$/.test(target)||/\.ftl$/.test(target) ) && target.indexOf('.gfe-temp')==-1 && outputOnlyCopyFiles){
						var sourceCode = f.read(target);
						sourceCode = compress.addJsDepends(target,sourceCode);
						if(gfe.config['output'].cssMd5 || gfe.config['output'].jsMd5){
							sourceCode = f.md5Replace(sourceCode);
						}
						f.write(target, sourceCode);
					}

					// if( (/\.html$/.test(target)||/\.ftl$/.test(target) ) && target.indexOf('.gfe-temp')==-1){
					// 	inline(target, {
					// 		compress: true,
					// 		// Skip all css types and png formats
					// 		ignore: []
					// 	}, function (err, html) {
					// 		if(err){
					// 			console.log(err);
					// 		}
					// 		// Do something with html
					// 		var gfe = require('./gfe.js');
					// 		var compress = require('./compress.js');
					// 		var cdnStr = '';
					// 		if(gfe.config.output.cssImagesUrlReplace){
					// 			cdnStr = gfe.config.cdn;
					// 		}
					// 		var sourceCode = compress.cssImagesUrlReplace(target, html, cdnStr);
					// 		f.write(target, sourceCode, encoding);
					// 		sourceCode = compress.addJsDepends(target,sourceCode);
					// 		if(gfe.config['output'].cssMd5 || gfe.config['output'].jsMd5){
					// 			sourceCode = f.md5Replace(sourceCode);
					// 		}
					// 		f.write(target, sourceCode);
					// 	});
					// }

                    //f.copyBinary(source,target)
					if(move) {
						fs.unlinkSync(source);
					}
				}
			} else {
				removedAll = false;
			}
		} else {
			if (typeof(logTag) != 'undefined' && logTag) {
				console.log('gfe error : [ '+source+' ] --- no such file or dir');
			}
		}
		return removedAll;
	},
	/**
	* @下载文件
	* @param path 下载文件路径
	* @param target 目标文件名
	*/
	download:function(source,target,callback){
		var http = require('http');
		var fs = require('fs');

		var file = fs.createWriteStream(target);
		var request = http.get(source,function(response) {
			var status = response.statusCode;
			response.pipe(file);

			response.on('end',function(){
				if(status >= 200 && status < 300 || status === 304){
					if(callback) callback('ok');
				}
				
				if(status === 404){
					console.log('gfe download error '+source+ ' not exist.');
					if(callback) callback('error');
				}
			});

			response.on('error',function(err){
				 var msg = typeof err === 'object' ? err.message : err;
				 console.log(err);
			})
		});
	},
	tar:function(source,target,callback){
		//引用的组件
		var tar = require("tar");
		fs.createReadStream(source)
		.pipe(tar.Extract({ path:target }))
		.on("error",function (err) {
			console.error("gfe [file.tar] error "+source)
		})
		.on("end", function () {
			if(callback) callback();
		})
	}
}

//同步mkdir
f.mkdir = function(p, mode, made) {
    if (mode === undefined) {
        mode = 0777 & (~process.umask());
    }
    if (!made) made = null;

    if (typeof mode === 'string') mode = parseInt(mode, 8);
    p = path.resolve(p);

	if ( !f.exists(p) ) {
		try {
			fs.mkdirSync(p, mode);
			made = made || p;
		}
		catch (err0) {
			switch (err0.code) {
				case 'ENOENT' :
					made = f.mkdir(path.dirname(p), mode, made);
					f.mkdir(p, mode, made);
					break;
				default:
					var stat;
					try {
						stat = fs.statSync(p);
					}
					catch (err1) {
						throw err0;
					}
					if (!stat.isDirectory()) throw err0;
					break;
			}
		}
		return made;
	}
};

/**
* @递归读取文件列表
* @2014-4-17 17:16:14
*/
f.getdirlist = function(source, include, exclude){
	var _this = this;
	var result = [];
	//var source = f.realpath(source);
	if(source){
		if(f.isDir(source)){
			fs.readdirSync(source).forEach(function(name){
				result = result.concat( _this.getdirlist(source + '/' + name, include, exclude) );
			});
		} else if(f.isFile(source) && f.filter(source, include, exclude)){
			result.push(source.replace("//","/"));
		}
	}
	return result;
}

/**
 * @readJSON
 */
f.readJSON = function(url, callback,readWidget){
	var res = null;
	if (f.exists(url)) {
		try{
			var data = f.read(url);
			if (data) {
				if(readWidget){
					res = data;
				}else{
					data = JSON.parse(data);
					res = data;
				}
				
			}
			if(callback) callback(res);
		}catch(e){
			console.log('gfe error [f.readJSON] "'+url+'" format error' );
			console.log(e);
			//if(callback) callback(res);
		}
	}else{
		console.log('gfe error [f.readJSON] "'+url+'" is not exists' );
		//if(callback) callback(res);
	}
}

f.moveFolderAsync=function(source,target){
    var fork = require('child_process').fork;
    var childPath=__dirname+"/fileWorker.js";
    childPath=path.normalize(childPath);

    var subProc =  fork(childPath);
    subProc.on('message', function(data) {
        this.disconnect();
    });

    subProc.send({
        source:source,
        target:target,
        route:'copy'
    });
}

f.delAsync=function(target){
    var fork = require('child_process').fork;
    var childPath=__dirname+"/fileWorker.js";
    childPath=path.normalize(childPath);

    var subProc =  fork(childPath);
    subProc.on('message', function(data) {
        this.disconnect();
    });

    subProc.send({
        target:target,
        route:'del'
    });
}

f.renameFile=function(path,dest){
	fs.renameSync(path,dest);
}

f.base64Encode = function(file) {
    var bitmap = fs.readFileSync(file);
    return new Buffer(bitmap).toString('base64');
}
