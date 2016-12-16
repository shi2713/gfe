/**
 * @处理SSI
 */

//原生组件
//var ssi = require('ssi');
var path = require('path');
var http = require('http');
var fs = require('fs');
var ssi = require('ssi');

var Task = require('./task.js');
var f = require('./file.js');
var gfe = require('./gfe.js');

function fixRegExpString(str) {
	return str
		.replace(/\\/g, '\\\\')
		.replace(/\(/g, '\\(')
		.replace(/\)/g, '\\)')
		.replace(/\{/g, '\\{')
		.replace(/\}/g, '\\}');
}

var SSI = module.exports = {};

SSI.parse = function(fileContent, callback, rootDirs, filePath) {
	var matches = fileContent.match(/<!--#\s*include\s+(file|virtual)=["']?[^"']+["']?\s*-->/g);
	var currDir = filePath.split(/[\\\/]/);
	currDir.length = currDir.length - 1;
	currDir = currDir.join(path.sep);
	if (matches) {
		var task = new Task.Concurrency;
		// 如果包含SSI 
		matches.forEach(function(SSITag, i) {
			task.add(function() {
				var match;
				if (match = SSITag.match(/<!--#\s*include\s+(file|virtual)=["']?([^"']+)["']?\s*-->/)) {
					// 虚拟目录
					if (match[1] == 'virtual') {
						// 先从本地ftl文件夹找
						var tmpFilePath;
						if (match[2].substr(0, 1) == '/') {
							tmpFilePath = match[2];
						} else {
							tmpFilePath = path.join(currDir, match[2]);
						}

						if (f.isFile(tmpFilePath)) {
							var content = fs.readFileSync(tmpFilePath);
							// 本地读取成功 
							SSI.parse((content || '').toString(), function(err, content) {
								if (!err) {
									fileContent = fileContent.replace(new RegExp(fixRegExpString(match[0]), 'g'), content);
									task.done();
								} else {
									console.log(match[2] + '->' + content);
								}
							}, rootDirs, filePath);
						} else { // 本地文件未找到从uat拉取
							var options = {
								//hostname: 'www.atguat.com.cn',
								hostname: gfe.env,
								port: 80,
								path: match[2],
								method: 'GET'
							};

							var req = http.request(options, function(res) {
								if (res.statusCode == 200) {
									res.setEncoding('utf8');
									var body = '';
									res.on('data', function(chunk) {
										body += chunk;
									}).on('end', function() {
										SSI.parse(body.toString(), function(err, content) {
											if (!err) {
												fileContent = fileContent.replace(new RegExp(fixRegExpString(match[0]), 'g'), content);
												task.done();
											} else {
												console.log(match[2] + '->' + content);
											}
										}, rootDirs, filePath);
									});
								} else {
									console.log(match[2] + '\'s http code: ' + res.statusCode);
								}

							});

							// uat拉失败，直接抛出错误
							req.on('error', function(e) {
								console.log(match[2] + ' has [http error]:' + e.message + '\n<br>' + JSON.stringify(options));
							});

							req.end();
						}

					} else if (match[1] == 'file') {
						// 文件包含从本地ftl文件夹找
						var tmpFilePath;
						if (match[2].substr(0, 1) == '/' || match[2].substr(0, 2) == '..') {
							task.fail(match[2] + ' error: can\'t read file.');
						} else {
							tmpFilePath = path.join(currDir, match[2]);
							// console.log(tmpFilePath);
							readFile(tmpFilePath, 'utf-8', function(err, content) {
								if (err) {
									// 本地文件未找到直接抛出异常 
									console.log(match[2] + ' error:' + content);
								} else {
									// 本地读取成功
									SSI.parse((content || '').toString(), function(err, content) {
										if (!err) {
											fileContent = fileContent.replace(new RegExp(fixRegExpString(match[0]), 'g'), content);
											task.done();
										} else {
											console.log(match[2] + '->' + content);
										}
									}, rootDirs, filePath);
								}
							}, rootDirs);
						}
					} else {
						console.log(match[0] + ' unknow include.');
					}
				}
			});
		});
		task.success(function(){ 
            var parser = new ssi("", "", "");
            var results = parser.parse("", fileContent);  
            callback(false, results.contents);
        });

        task.error(function(path){
            callback(true, filePath + '\n<br>' + path);
        });

        task.start();  
	} else {
		callback(false, fileContent);
	}
}