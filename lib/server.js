/**
 * @simple server
 */
var PORT = 3000;
var http = require('http');
var url = require('url');
var fs = require('fs');
var path = require('path');

var ssi = require('./ssi.js');
var f = require('./file.js');
var gfe = require('./gfe.js');
//var compress = require('./compress.js');

var mine = {
	"css": "text/css",
	"gif": "image/gif",
	"html": "text/html",
	"tpl": "text/html",
	"vm": "text/html",
	"shtml": "text/html",
	"ico": "image/x-icon",
	"jpeg": "image/jpeg",
	"jpg": "image/jpeg",
	"js": "text/javascript",
	"json": "application/json",
	"pdf": "application/pdf",
	"png": "image/png",
	"svg": "image/svg+xml",
	"swf": "application/x-shockwave-flash",
	"tiff": "image/tiff",
	"txt": "text/plain",
	"wav": "audio/x-wav",
	"wma": "audio/x-ms-wma",
	"wmv": "video/x-ms-wmv",
	"xml": "text/xml",
	"ttf": "font/ttf",
	"otf": "font/opentype",
	"woff": "application/font-woff",
	"woff2": "application/font-woff2",
	"eot": "application/vnd.ms-fontobject"
};

//exports
var server = module.exports = {};

/**
 * @getIp
 */
server.getIp = function() {
	var net = require('os').networkInterfaces();
	for (var key in net) {
		if (net.hasOwnProperty(key)) {
			var items = net[key];
			if (items && items.length) {
				for (var i = 0; i < items.length; i++) {
					var ip = String(items[i].address).trim();
					if (ip && /^\d+(?:\.\d+){3}$/.test(ip) && ip !== '127.0.0.1') {
						return ip;
					}
				}
			}
		}
	}
	return '127.0.0.1';
};

/**
 * @joinbuffers
 */
server.joinbuffers = function(bufferStore) {
	var length = bufferStore.reduce(function(previous, current) {
		return previous + current.length;
	}, 0);

	var data = new Buffer(length);
	var startPos = 0;
	bufferStore.forEach(function(buffer) {
		buffer.copy(data, startPos);
		startPos += buffer.length;
	});
	return data;
};

/**
 * @init
 * @param {String} serverCurrentDir 服务器文件夹本地路径
 * @param {String} port 服务器端口号
 * @param {String} cdn cdn文件夹前缀 http://cdn.com
 * @param {String} replacePath cdn替换路径字符 如vip/2014 : http://cdn.com/vip/2014/js/vip.index.js ---> http://cdn.com/js/vip.index.js 本地调试反向代理适用
 * @param {String} debug debug模式下替换http链接中的projectPath
 */
server.init = function(serverCurrentDir, port, cdn, replacePath, comboDebug, addJsDepends) {

	if (typeof(port) != 'undefined') {
		PORT = port;
	}

	if (typeof(comboDebug) == 'undefined') {
		comboDebug = false;
	}

	var config = http.createServer(function(request, response) {
		var requestUrl = request.url;
		var isComboUrl = /\?\?/.test(requestUrl);
		var pathname = url.parse(requestUrl).pathname;

		if (typeof(serverCurrentDir) == 'undefined') {
			var realPath = fs.realpathSync('.') + '/' + pathname;
		} else {
			var realPath = serverCurrentDir + '/' + pathname;
		}
		realPath = decodeURI(realPath);

		var ext = path.extname(realPath);
		ext = ext ? ext.slice(1) : 'unknown';

		if (isComboUrl) {
			/**
				??a.js,b.js计算.js扩展名
				??a.css,b.css计算.css扩展名
			*/
			var comboUrlTemp = requestUrl.split(',');
			ext = path.extname(comboUrlTemp[comboUrlTemp.length - 1]);
			ext = ext ? ext.slice(1) : 'unknown';
		}

		if (typeof(replacePath) != 'undefined' && comboDebug) {
			//替换掉路径中projectPath, 有风险吗?
			realPath = realPath.replace(replacePath, '');
		}

		var response404 = function() {
			response.writeHead(404, {
				'Content-Type': 'text/html'
			});
			response.write('<center><h1>404 Not Found</h1></center><hr><center>' + server.copyright(PORT) + '</center>');
			response.end();
		}

		// 增加url rewrite
		// add by guotingjie at 2016-5-3
		var rewrite = gfe.config.rewrite || {};
		var matchUrl;
		var realPathJson = gfe.config.rewrite[pathname];

		for (matchUrl in rewrite) {
			if (realPath.indexOf(matchUrl) == 0) {
				realPath = rewrite[matchUrl];
				break;
			}
		}

		var realPathJsonFile = realPath.replace(pathname,'') + realPathJson;

		fs.exists(realPath, function(exists) {
			var cdnUrl = cdn + pathname;
			//添加支持rewrite
			if(realPath.indexOf(matchUrl)> -1){
				fs.readFile(realPathJsonFile,"utf8",function (error,data){
					if(error) throw error ;				
					response.writeHead(200, {
						'Content-Type': 'text/html'
					});
					response.write(data);
					response.end();
				});
				return;
			}
			if (!exists) {
				response404();
				return;
			}
			if (isComboUrl) {
				//cdn检测同名文件
				//todo增加短路径支持 requestUrl
				cdnUrl = requestUrl;

				var contentType = mine[ext] || "text/plain";
				var fileContent = '';

				//以??先分隔为数组
				var comboUrl = requestUrl.split('??');
				var comboFile = [];

				if (comboUrl.length > 0) {
					//将头尾的斜杠去掉
					// comboUrl[0] = comboUrl[0].replace(/^\//, '').replace(/\/$/, '');

					if (comboUrl[1]) {
						//以逗号将文件名称分隔为数组
						comboFile = comboUrl[1].split('?')[0].split(',');
					}
				}

				comboFile.forEach(function(file) {
					var fileDir = '';
					var content = '';

					//将头尾的斜杠去掉
					file = file.replace(/^\//, '').replace(/\/$/, '');
					if (comboUrl[0] !== '') {
						fileDir = comboUrl[0] + file;
					} else {
						fileDir = file;
					}

					var currentDir = serverCurrentDir + fileDir;
					if (f.exists(currentDir)) {
						content = f.read(currentDir);
						// if (typeof(addJsDepends) == 'function') { 
						// 	content = addJsDepends(currentDir); //本地build时js中的seajs引用地址加cdn
						// }

						//如果代码的末尾没有分号，则自动添加一个。以避免代码合并出现异常。
						if (!/[;\r\n]$/.test(content) && ext == 'js') {
							content += ';';
						}
						fileContent += content;
					} else {
						fileDir = cdnUrl + fileDir;
						response404();
					}
				});

				response.writeHead(200, {
					'Content-Type': contentType
				});
				response.write(fileContent);
				response.end();

			} else {
				if (f.isDir(realPath)) {
					fs.readdir(realPath, function(err, file) {
						if (err) {
							response.writeHead(500, {
								'Content-Type': mine.html
							});
							response.end(err);
						} else {
							response.writeHead(200, {
								'Content-Type': "text/html"
							});

							var html = server.getDirList(realPath, pathname, PORT);
							response.end(html, "binary");
						}
					});
				}
				//增加支持ftl
				if (f.isFile(realPath)) {
					var ext = path.extname(realPath);
					ext = ext.replace('.', '');
					if (ext === 'ftl' || ext === 'html') {

						var fileName = /[^\/]*$/.exec(pathname)[0].replace(/\.ftl$/, '.json');
						//var dataPath = serverCurrentDir + '/' + gfe.config.dataDir + '/' + fileName;
						if(serverCurrentDir.indexOf('widget')!=-1){
							var dataPath = serverCurrentDir + fileName;
						}else{
							var dataPath = serverCurrentDir + '/' + gfe.config.dataDir + '/' + fileName;
						}

						fs.exists(dataPath, function(exists) {

							var Freemarker = require('freemarker.js');
							var fm = new Freemarker({
								viewRoot: path.join(serverCurrentDir, './'), //path.join(__dirname, '../' + replacePath),
								options: {}
							});
							//console.log(path.join(__dirname,path.join(serverCurrentDir, './')));

							if (!exists) {
								fm.render(pathname, {}, function(err, data, out) {
									response.writeHead(200, {
										'Content-Type': 'text/html;charset=utf-8'
									});

									var hasError = false;

									if (out.toLowerCase().indexOf('done') == -1) {
										hasError = true;
										data = 'render freemarker error:' + (out + '').replace(/\n/g, '<br>\n') + '<br>' + data;
									}

									if (hasError) {
										response.write(data);
										response.end();
									} else {
										ssi.parse(data, function(err, content) {
											if (err) {
												data = 'render freemarker error -> [ssi parser]:<br>' + content;
											} else {
												data = content;
											}
											response.write(data);
											response.end();
										}, path.join(f.currentDir(), '/html'), realPath);
									}
								});
							}

							if (f.isFile(dataPath)) {
								//如果是widget，不需要freemarker解析，这里用indexOf('widget')判断不严谨???
								if(serverCurrentDir.indexOf('widget')!=-1){
									var readWidget = true;
									f.readJSON(dataPath, function(data) {
										response.write(data);
										response.end();
									},readWidget);
								}else{
									f.readJSON(dataPath, function(data) {
										var params = requestUrl.indexOf("?")!=-1 ? requestUrl.split('?')[1] : null;
										if(params!=null){
											params = params.split('&');
											for(var i=0;i<params.length;i++){
												var pKey = params[i].split("=")[0];
												var pValue = params[i].split("=")[1];
												data[pKey] = pValue;
											}
										}
										f.write(dataPath,JSON.stringify(data),'utf-8');
										try {
											fm.render(pathname, data, function(err, data, out) {
												var hasError = false;
												if (err) {
													hasError = true;
													data = 'render freemarker error:' + (err + '').replace(/\n/g, '<br>\n') + '<br>' + data;
												}

												response.writeHead(200, {
													'Content-Type': 'text/html;charset=utf-8'
												});

												if (hasError) {
													response.write(data);
													response.end();
												} else {
													ssi.parse(data, function(err, content) {
														if (err) {
															data = 'render freemarker error -> [ssi parser]:<br>' + content;
														} else {
															data = content;
														}
														response.write(data);
														response.end();
													}, path.join(f.currentDir(), '/html'), realPath);
												}
											});
											
										} catch (e) {
											console.log(e);
										}
									});
								}
								
							}
						});
					} else {
						var contentType = mine[ext] || "text/plain";
						var content = fs.readFileSync(realPath);

						response.writeHead(200, {
							'Content-Type': contentType
						});

						response.end(content);
					}
				}
			}
		});
	});
	config.listen(PORT);
	config.on('error', function(err) {
		if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
			console.log('gfe server : Port ' + PORT + ' has used.');
		}
	});
}

/**
 * @get copyright
 */
server.copyright = function(port) {
	var serverIp = server.getIp() + ':' + port;
	var copyright = '<p><strong style="font-size:1.2em">gfe server </strong>' +
		' <strong>IP</strong> <a href="http://' + serverIp + '">' + serverIp + '</a>   ' +
	//'<span style="font-size:0.8em">'+new Date()+'</span>  '+
	'</p>';
	return copyright;
}

/**
 * @get dir list
 */
server.getDirList = function(realPath, pathname, port) {
	// console.log(realPath);
	var dirname = '/';
	var html = '<li style="padding-bottom:5px;"><a href="../">../</a></li>';
	realPath = path.normalize(realPath);
	pathname += '/';
	pathname = pathname.replace(/\/\//, '');

	fs.readdirSync(realPath).forEach(function(name) {
		if (!/.Ds_Store$/.test(name)) {
			// console.log(name);
			var url = pathname + '/' + name;
			url = url.replace(/\/\//g, '/');
			url = encodeURI(url);
			dirname = path.dirname(url);
			if (f.isDir('.' + url)) {
				url = url + '/';
				name = name + '/';
			}

			html += '<li style="padding-bottom:0.2em;"><a href="' + url + '">' + name + '</a></li>';
		}
	})

	html = '<ul>' + html + '</ul>';
	html = '<h1>Index of ' + dirname + '</h1><hr/>' + html + '<hr/> ' + server.copyright(port);
	return html;
}