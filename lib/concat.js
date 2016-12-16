/**
 * @files concat
 * @ctime 2014-9-24
 */

var path = require('path');
var fs = require('fs');

//lib自身组件
var $ = require('./base.js');
var f = require('./file.js');
var gfe = require('./gfe.js');

//exports
var concat = module.exports = {};

concat.init = function(rSource){
	var concatFiles = gfe.config.output.concat;

	Object.size = function(obj) {
		var size = 0, key;
		for (key in obj) {
			if (obj.hasOwnProperty(key)) size++;
		}
		return size;
	};
	var source = f.realpath(rSource)+'/'+gfe.getProjectPath();
	
	if ( Object.size(concatFiles)) {
		for (var i in concatFiles  ){
			var res = '';
			concatFiles[i].forEach(function(j){
				var m = $.getCssExtname(source+'/'+j);
				if (f.exists(m)) {
					res += f.read(m);
					//f.del(source+'/'+j);
				}else {
					console.log('gfe warnning "'+j+'" is not exists');
				}
			});
			if (res != '') {
				f.write(source+'/'+i, res);
			}
		}
	}
}