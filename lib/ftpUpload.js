/**
 * @upload 2014-12-5
 */

var path = require('path');

//依赖lib
var f = require('./file.js');
var gfe = require('./gfe.js');

/**
* @upload init
* @time 2014-2-26 19:17:39 / 2014-12-5
* @param {Function} callback custom模式下回调函数
* @param {Boolse} haslog custom模式下是否显示log
* @param {Boolse} hasConfig 配置文件是否存在
* @example
*	gfe upload (default first run "gfe output -html")
*	gfe upload js/a.js (first run "gfe output js/a.js")
*	gfe upload -custom localdir serverdir (serverdir no exists, the same localdir)
*  
*  another call method 
*  	gfe.upload([0, 0, 0, '-custom', 'localdirname', 'serverdirname'], true ,function(){})
*  
*/
exports.init = function(argv, hasConfig, haslog, callback){
	var haslog = typeof(haslog) == 'undefined' ? true : haslog;
	var hasConfig = typeof(hasConfig) == 'undefined' ? true : hasConfig;
	var ftp = {};
	var uploadSource = path.normalize(f.currentDir()+'/' + gfe.config.outputDirName);
	var uploadTarget = gfe.config.serverDir;
	
	if(!hasConfig){
		console.log('gfe error: "config.json" is not exists');
		return;
	}

	if(gfe.config.host == JSON.parse(gfe.config.configJsonFileContent).host){
		console.log('gfe error: config.json "host" error');
		return;
	}
	
	//core function
	var ftpFn = function(source, target){
		if(gfe.config.host){
			//console.log('gfe process: uploading [' + source + '].');
			ftp = require('./ftp.js');
			ftp.upload(source, target, null, null, null, null, null, function(err){
				gfe.dot.end(haslog);
				if(haslog) console.log('gfe upload ['+gfe.config.host +'/'+ target+'] success!');
				if(callback) callback();
			});
		}else{
			console.log('gfe error [gfe.upload] - server host no setup');
		}
	}
	
	//default upload,do "gfe output -html" first
	var outputFnOnce = function(){
		if (typeof(argv[3]) == 'undefined') {
			//argv[3] = '-html';
		}
		gfe.argvInit('output', argv, function(){
			ftpFn(uploadSource, uploadTarget);
		});
	}

	//watch upload
	var outputFnWatch = function(){
		ftp.quit();
		gfe.buildMain('output');
		Output.init({
			type:'all',
			callback:function(){
				ftpFn(uploadSource, uploadTarget);
			}
		});
	}
	
	//entrance
	if (argv[3] == '-watch') {
		//watch upload
		outputFnOnce();
		Node_watch(f.currentDir(), function(filename) {
			console.log(filename);
			outputFnWatch();
		});
	}else if(argv[3] == '-custom' && argv[4] ){
		//custom upload	
		if ( f.exists(argv[4]) ) {
			var serverdir = argv[5] ? argv[5] : argv[4];
			console.log('gfe uploading');
			gfe.dot.begin();
			ftpFn(argv[4], serverdir);
		} else{
			console.log('gfe warning [gfe.upload] - "'+argv[4]+'" not exists');
		};
	}else if((argv[3]=='-preview' || argv[3]=='-p' || argv[4]=='-preview' || argv[4]=='-p') && gfe.config.previewServerDir){
		//preview
		if(argv[3] == '-preview' || argv[3] == '-p'){
			argv[3] = gfe.config.buildDirName;
		}
		
		gfe.argvInit('output', argv, function(){
			ftpFn(uploadSource, gfe.config.previewServerDir);
		});
	}else if( argv[3] == '-nc' && gfe.config.newcdn ){
		//newcdn css/js/widget
		if (typeof(argv[4]) != 'undefined'){
			argv[3] = argv[4];
			delete argv[4];
		}else{
			delete argv[3];
		}

		gfe.config.cdn = gfe.config.newcdn;
		outputFnOnce();
	}else if( argv[3] == '-nh' && gfe.config.newcdn){
		//newcdn html
		argv[3] = gfe.config.buildDirName;
		//内链link src替换
		gfe.config.cdnDefalut = gfe.config.cdn;
		gfe.config.cdn = gfe.config.newcdn;
		gfe.argvInit('output', argv, function(){
			ftpFn(uploadSource, gfe.config.previewServerDir);
		});
	}else if(argv[3] == '-list' && gfe.config.uploadList){
		// 根据config.json配置上传
		argv[3] = gfe.config.uploadList;
		gfe.argvInit('output', argv, function(){
			ftpFn(uploadSource, uploadTarget);
		});
	}else {
		//default upload
		outputFnOnce();
	}
}