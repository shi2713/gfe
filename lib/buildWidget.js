/**
* @build widget 引入其内容和相关css,js文件以及css,js路径替换
* @param inputPath 文件路径
* @param content 文件内容
* @param type 编译类型 build || release
* @example 
	{%widget name="unit"%} 
	==> 
	<link type="text/css" rel="stylesheet"  href="/widget/base/base.css" source="widget"/>
	==>
	<link type="text/css" rel="stylesheet"  href="/app/css/widget.css" source="widget"/>

	删除和替换 {%widgetOutputName="mywidgetname"%}
*/

var path = require('path');
var fs = require('fs');
var jsmart = require('jsmart');

//lib自身组件
var $ = require('./base.js');
var f = require('./file.js');
var gfe = require('./gfe.js');
var Vm = require("./vm.js");

//exports
var buildWidget = module.exports = {};

/**
 * @init
 */
buildWidget.init = function(inputPath,content,type,callback,param){
	var pageOriginContent = content;
	var isBuild = type == 'build';
	var isRelease = type == 'release';
	var isOutput = type == 'output';
			
	//自定义静态资源cdn
	var cmd3 = process.argv[3];

    if (cmd3 == "-uat") {
        gfe.config.customCdns = gfe.config.uatServer;
    }
    if (cmd3 == "-pre") {
        gfe.config.customCdns = gfe.config.preServer;
    }
    if (cmd3 == "-prd") {
        gfe.config.customCdns = gfe.config.prdServer;
    }
	//css,js路径替换
	if (isOutput) content = staticUrlReplace(content);
    if (isBuild) content = staticUrlReplace(content,isBuild);

	var result = content.match($.reg.notCommentWidget());
	var origin = content;
	var isJM = false;
	var cssFile='' , jsFile='';
	var cssComboArr = [];
	var jsComboArr = [];

	//widget
	if (result){
		var filesListObj = {};//去重用
		result.forEach(function(resultItem){

			var widgetArray = $.reg.widget().exec(resultItem);
			var widgetType;
			var widgetTypeArray = $.reg.widgetType().exec(resultItem);
			
			if (widgetTypeArray) widgetType = widgetTypeArray[1];
			
			//取widget数据 {%widget data=" "%}
			var widgetData;
			var widgetDataArray = $.reg.widgetData().exec(resultItem);
			if (widgetDataArray) widgetData = widgetDataArray[1];
			
			//取widget是否注释tag {%widget comment=" "%}
			var widgetComment;
			var widgetCommentArray = $.reg.widgetComment().exec(resultItem);
			if (widgetCommentArray) widgetComment = widgetCommentArray[1];

			//如果type为js或者css则只引用不处理tpl
			var buildTag = {
				tpl:true,
				vm:true,
				smarty: true,
				js:true,
				css:true,
				html:true
			}

			if (widgetType) {
				if (widgetType =='tpl'|| widgetType =='vm'|| widgetType =='css'|| widgetType =='js' || widgetType == 'smarty' || widgetType == 'html'){
					for(var i in buildTag ){
						if(i != widgetType ) buildTag[i] = false;
					}
				}else {
					//console.log(inputPath +' '+ resultItem);
					console.log("gfe warnning [widget type - "+widgetType +'] is not approve, please try "tpl,vm,js,css" again ');
					return;
				}
			}

			//{%widget name=" "%}
			var widgetStr = widgetArray[0];
			//widgetStr中的name
			var widgetName = $.trim(widgetArray[1]);
			var widgetDir = '/widget/' +widgetName;
			//widget 目录
			var fileDir = path.normalize(gfe.currentDir + widgetDir);
			var widgetInputName = gfe.config.widgetInputName;

			if(widgetInputName.length > 0 && !$.inArray(widgetInputName, widgetName)){
				return;
			}


			var placeholder='';
			var dirExists = f.exists(fileDir);
			if (dirExists){
				var files = fs.readdirSync(fileDir);
				files.forEach(function(item){
					//less,scss文件转换成css文件
					var itemOrgin = item;
					item = $.getCssExtname(item);

					//tpl,css,js路径中含有widgetName前缀的才引用 ---> 名字完全一样才引用
				
					//单个文件
					var fileUrl = path.join(fileDir, item);
					var staticUrl = ''+widgetDir +'/'+ item;

					if(param == '-plain'){
						staticUrl = '..'+widgetDir +'/'+ item;
					}

					//css Compile
					var cssCompileFn = function(staticUrl){
						var cssLink = $.placeholder.cssLink(staticUrl);
						if (isBuild){
							content = $.placeholder.insertHead(content,cssLink);
						}else if(isRelease || isOutput){
							if(gfe.config.output.combineWidgetCss){
								//less,sass文件从编译后的bgCurrent读取
								if ($.is.less(itemOrgin) || $.is.sass(itemOrgin)) {
									var fileUrlTemp = gfe.bgCurrentDir + staticUrl;
									cssFile +=  f.read(fileUrlTemp) + '\n\r';
								}else{
									cssFile +=  f.read(gfe.bgCurrentDir+staticUrl) + '\n\r';
								}
							}else{
								if(gfe.config.output.cssCombo && gfe.config.cdn){
									cssComboArr.push(staticUrl.replace('/widget/', ''));
								}else{
									content = $.placeholder.insertHead(content,cssLink);
								}
							}
						}

						/*
						if (isJM){
							origin = $.placeholder.insertHead(origin,cssLink);
						}*/
						filesListObj[staticUrl] = 1;
					}

					//js Compile
					var jsCompileFn = function(staticUrl){
						var jsLink = $.placeholder.jsLink(staticUrl);
						if (isBuild){
							content = buildWidget.insertJs(content,jsLink, gfe.config.build.jsPlace);
						}else if (isRelease || isOutput){
							if(gfe.config.output.combineWidgetJs){
								//合并所有widget中的js文件至widgetOutputName
								jsFile += f.read(gfe.currentDir+staticUrl) + '\n\r';
							}else{
								if(gfe.config.output.jsCombo && gfe.config.cdn){
									jsComboArr.push(staticUrl.replace('/widget/', ''));
								}else{
									content = buildWidget.insertJs(content,jsLink, gfe.config.output.jsPlace);
								}
							}
						}
						/*
						if (isJM){
							origin = $.placeholder.insertBody(origin,jsLink);
						}*/
						filesListObj[staticUrl] = 1;	 
					}

					/**
					 * @build widget tpl/vm
					 */
					//vm编译
					var vmCompileFn = function(vmContent){
						var fileUrlDirname = path.dirname(fileUrl)+'/';
						var dataSourceContent={};
						var dataSourceUrl = fileUrlDirname+widgetName+$.is.dataSourceSuffix ;

						try {
							if (f.exists(dataSourceUrl)) {
								var temp = f.read(dataSourceUrl);
								if (temp && temp != '')  dataSourceContent = JSON.parse(temp);
							}
						} catch (e) {
							console.log(dataSourceUrl);
							console.log(e);
							return;
						}

						try {
							var widgetDataObj = {};
							if (widgetData){
								widgetDataObj = JSON.parse(widgetData);
							}
						} catch (e) {
							console.log('gfe widget ' +widgetName  +' data error');
							console.log(e);
							return;
						}

						var dataObj = $.merageObj( dataSourceContent, widgetDataObj);
						
						//vm处理
						try {
							if (dataObj && vmContent && gfe.config.output.vm){
								var vmRander =  Vm.rander(vmContent, dataObj, fileUrlDirname);
								
								//vm继承js/css
								if(vmRander.url.js){
									vmRander.url.js.forEach(function(item){
										 jsCompileFn(item);
									})
								}

								if(vmRander.url.css){
									vmRander.url.css.forEach(function(item){
										 cssCompileFn(item);
									})
								}
								return vmRander.content;
							}
						} catch (e) {
							console.log('gfe erro [gfe.buildWidget] - velocityjs');
							console.log(fileUrl);
							console.log(e);
						}

						return vmContent;
					}
					
					//tpl vm Compile
					var tmplCompileFn = function(type){
						placeholder = f.read(fileUrl);
						//替换模板中的cssLink/jsLink
						if (isOutput) placeholder = staticUrlReplace(placeholder);

						if (type == 'vm' || type == 'tpl') {
							placeholder = vmCompileFn(placeholder);
						}

						if(type == 'smarty'){
							var smartyJSON = f.read(path.join(fileDir, widgetName+'.json')) || widgetData;
							var smartyCompiled = new jSmart(placeholder);

							if(smartyCompiled && smartyJSON){
								placeholder = smartyCompiled.fetch(JSON.parse(smartyJSON));
							}
						}

						fileUrl = f.pathFormat(path.join(widgetDir, item));
						
						var typeHtml='';
						if (widgetType) typeHtml='['+widgetType+']';
						if ( gfe.config.build.widgetIncludeComment){
							if(widgetComment === 'false') return;
							placeholder = '\r\n<!-- '+typeHtml+' '+fileUrl+' -->\r\n' + placeholder + '\r\n<!--/ '+fileUrl+' -->';
						}
					}
					
					//tpl
					if ( $.is.tpl(item) && buildTag.tpl && (item == widgetName+$.is.tplSuffix) ){
						tmplCompileFn('tpl');
					}

					//vm
					if ( $.is.vm(item) && buildTag.vm && item == widgetName+$.is.vmSuffix ){
						tmplCompileFn('vm');
					}

					//smarty
					if ( $.is.smarty(item) && buildTag.smarty && item == widgetName+$.is.smartySuffix ){
						tmplCompileFn('smarty');
					}

					//html
					if ( $.is.html(item) && buildTag.html && item == widgetName+$.is.htmlSuffix ){
						tmplCompileFn('html');
					}

					/**
					 * @build widget css
					 */
					if ($.is.css(item) && !filesListObj[staticUrl] && buildTag.css && item == widgetName+$.is.cssSuffix ){
						cssCompileFn(staticUrl);
					}

					/**
					 * @build widget js
					 */
					if ($.is.js(item) && !filesListObj[staticUrl] && buildTag.js && item == widgetName+$.is.jsSuffix){
						jsCompileFn(staticUrl);
					}
				});
				/*
				if (isJM){
					origin = origin.replace(widgetStr,placeholder);
				}*/
				//替换掉{%widget name="base"%} 
				content = content.replace(widgetStr,placeholder);
			}else{
				console.log('gfe warning [gfe.buildWidget] ' +widgetStr +' widget '+ widgetName+ ' does not exist.');
			}
		});
		
		//去掉{%widgetOutputName="mywidgetname"%}
		var getContentWidgetOutputName = $.reg.widgetOutputName().exec(content);
		if ( getContentWidgetOutputName ){
			content = content.replace(getContentWidgetOutputName[0],'');
		}

		//release output处理
		if (isRelease || isOutput){
			//修改为默认取配置文件中的widgetOutputName 2014-5-24
			var pkgName = gfe.config.widgetOutputName;
			//var pkgName = path.basename(inputPath).replace('.html', '');
			if (getContentWidgetOutputName){
				pkgName = getContentWidgetOutputName[1];
			}

			var outputDir = gfe.bgCurrentDir;
			var outputCss = '/' + gfe.config.cssDir+'/'+pkgName+'.css';
			var outputJs = '/' + gfe.config.jsDir+'/'+pkgName+'.js';

			var cssOutputDir = '/' + gfe.config.cssDir.replace(gfe.config.baseDir+'/', '') +'/';
			var jsOutputDir = '/' + gfe.config.jsDir.replace(gfe.config.baseDir+'/', '') +'/';

			if (isOutput) {
				if(gfe.config.cdn){
					outputCss = '/' +  gfe.getProjectPath() + cssOutputDir+pkgName+'.css';
					outputCss = $.replaceSlash(outputCss);

					//outputCss = gfe.config.cdn + outputCss;
					outputCss = gfe.config.customCdns!=null ? (gfe.config.customCdns["css"] + outputCss) : gfe.config.cdn + outputCss;

					outputJs = '/' + gfe.getProjectPath() + jsOutputDir+pkgName+'.js';
					outputJs = $.replaceSlash(outputJs);

					//outputJs = gfe.config.cdn + outputJs;
					outputJs = gfe.config.customCdns!=null ? (gfe.config.customCdns["js"] + outputJs) : gfe.config.cdn + outputJs;
					
				}else{
					outputCss = gfe.config.customCdns!=null ? (gfe.config.customCdns["css"] + outputCss) : addgetProjectPath(cssOutputDir+pkgName+'.css');
					outputJs = gfe.config.customCdns!=null ? (gfe.config.customCdns["js"] + outputJs) : addgetProjectPath(jsOutputDir+pkgName+'.js');
				}
			}
			//seajsAddCdn
			content = seajsAddCdn(content);

			//widgetUrlAddCdn
			content = widgetUrlAddCdn(content);
	
			//css链接加前缀
			if(gfe.config.output.combineWidgetCss && cssFile !=''){
				var cssLink = $.placeholder.cssLink(outputCss);
				content = $.placeholder.insertHead(content, cssLink  );
				f.write(path.normalize(outputDir+'/' + gfe.config.cssDir+'/'+pkgName+'.css') , cssFile);
			}else if(gfe.config.output.cssCombo && cssComboArr.length){
				var cdnPrefix = gfe.config.customCdns!=null ? gfe.config.customCdns["css"] : gfe.config.cdn;
				cssComboArr = $.uniq(cssComboArr);
				//var outputCss1 = '/' +  gfe.getProjectPath() +'/widget/??'+cssComboArr.join(',');

				//outputCss1 = gfe.config.cdn + $.replaceSlash(outputCss1);
				var outputCss1 = cdnPrefix + '/' + gfe.getProjectPath() + '/widget/??'+cssComboArr.join(',');
				//var outputCss1 = '/'+'/widget/??'+cssComboArr.join(',');
				//outputCss1 = outputCss + $.replaceSlash(outputCss1);
				
				var cssLink1 = $.placeholder.cssLink(outputCss1);
				content = $.placeholder.insertHead(content, cssLink1);
			}

			//js链接加前缀
			if(gfe.config.output.combineWidgetJs && jsFile !=''){
				var jsLink = $.placeholder.jsLink(outputJs);
				content = buildWidget.insertJs(content,jsLink,gfe.config.output.jsPlace);
				f.write(path.normalize(outputDir+'/' + gfe.config.jsDir+'/'+pkgName+'.js') , jsFile);
			}else if(gfe.config.output.jsCombo && jsComboArr.length){
				var cdnPrefix = gfe.config.customCdns!=null ? gfe.config.customCdns["js"] : gfe.config.cdn;
				jsComboArr = $.uniq(jsComboArr);
				var outputJs1 = cdnPrefix + '/' + gfe.getProjectPath() + '/widget/??'+jsComboArr.join(',');
				//outputJs1 = gfe.config.cdn + $.replaceSlash(outputJs1);
				//var outputJs = '/' + gfe.config.jsDir;
				//outputJs1 = $.replaceSlash(outputJs1);
				var jsLink1 = $.placeholder.jsLink(outputJs1);
				content = buildWidget.insertJs(content,jsLink1, gfe.config.output.jsPlace);
			}
		}
	}else{
		if (isRelease || isOutput){
			//seajsAddCdn
			content = seajsAddCdn(content);
		}

		if (isOutput){
			//widgetUrlAddCdn
			content = widgetUrlAddCdn(content);
		}
	}

	var data = {
		origin:origin,
		tpl:content,
		css:cssFile,
		js:jsFile
	}

	//输出一份用于debug的文件
	if (gfe.config.output.debug && (~pageOriginContent.indexOf('/html') || ~pageOriginContent.indexOf('/HTML')) && (~pageOriginContent.indexOf('/head') || ~pageOriginContent.indexOf('/HEAD')) && (~pageOriginContent.indexOf('/body') || ~pageOriginContent.indexOf('/BODY'))) {
		var debugTpl = debugContentProcess(pageOriginContent);
		data.debugTpl = debugTpl;
	}

	if (callback) callback(data);
}


/**
 * @insertJs
 * @(考虑到性能 insertHead -> insertBody) -> 放head有利于前后端沟通,可通过配置修改
 * @gfe.config.output.jsPlace 'insertHead' --> header ; 'insertBody' --> body
 */
buildWidget.insertJs = function(content, jsLink, jsPlace){
	if(jsPlace == 'insertHead'){
		content = $.placeholder.insertHead(content, jsLink);
	}else if(jsPlace == 'insertBody'){
		content = $.placeholder.insertBody(content, jsLink);
	}
	return content;
}

/**
* @非widget引用, 原页面上的静态资源css, js链接替换处理: js直接加cdn, css链接根据配置是否combo加cdn
* @param {String} str 源代码
* @return {String} 替换后的源代码
* @example
	<link type="text/css" rel="stylesheet"  href="../app/css/main.css" />
	<link type="text/css" rel="stylesheet"  href="../app/css/less.css" />
	==>
	<link type="text/css" rel="stylesheet"  href="http://cdnul.com/??productpath/css/main.css,productpath/css/less.css" />

	<script type="text/javascript" src="../app/js/common.js"></script>
	 ==>
	<script type="text/javascript" src="http://cdnul.com/productpath/js/common.js"></script>
*/
function staticUrlReplace(str,isBuild){
	var comboIeArray = []; //存放ie兼容性写法的link,并且对其url进行了处理
	var comboIeArray2 = []; //存放的ie兼容性写法的link,初始url值，并未进行处理
	var usageLink = ''; //存放的ie兼容性写法的(最终)需要的link引入字符串
	var usageScript = ''; //存放的ie兼容性写法的(最终)需要的script引入字符串

	function isIn(single,group){ //判断single是否存在于group数组中
	    var inw = false;
	    if(group && group.length>0){
	    	group.forEach(function(item){
		        if(item==single){
		            inw = true;
		            return;
		        }
		    });
	    }
	    return inw;
	}

	//combo数组
	var comboTags = str.match(/<\!--gfe:combo:begin-->((?!<\!--gfe:combo:end-->)[\s\S])*<\!--gfe:combo:end-->/img);

	var replaceCore= function (str,type){
		var regStr = $.reg[type+'Str'];
		var reg = new RegExp(regStr,'gm');
		var regResult =  str.match(reg);
		var comboCssDomain = 0;
		var comboJsDomain = 0;

		//存放IE兼容性写法的的css(比如这种引入的地址：<!--[if IE 8]><link rel="stylesheet" href="/css/d.css"><![endif]-->)
		var ieLinks = str.match(/(<\!--\[if\s)[\s\S]*?(<\!\[endif\]-->)/img);

		ieLinks = $.uniq(ieLinks);
		var ieLinksStr = ''; 
		var ieLinksOri = null; //存放的ie兼容的<link rel="stylesheet" href='xxx.css'>这样的数据
		var ieScriptsStr = ''; 
		var ieScriptsOri = null; //存放的ie兼容的<script src="/js/a.js"></script>这样的数据
		if(ieLinks&&ieLinks.length>0){
			ieLinks.forEach(function(item,i){
				ieLinksStr+=item;
				//css处理
				var linksie = item.match(/<link\s.*?stylesheet\s*.*href="(.*?)".*?>/img);
				if(linksie && linksie.length>0){
					ieLinksOri = (ieLinksOri&&ieLinksOri.length>0) ? ieLinksOri.concat(linksie): linksie;
					usageLink += item+"\r\n";
					str = str.replace(item,'');
				}
				//js处理
				var scriptsie = item.match(/<script\s.*?src="(.*?)".*?<\/script>/img);
				if(scriptsie && scriptsie.length>0){
					ieScriptsOri = (ieScriptsOri&&ieScriptsOri.length>0) ? ieScriptsOri.concat(scriptsie): scriptsie;
					usageScript += item+"\r\n";
					str = str.replace(item,'');
				}
			});
		}

		if (regResult){
			if(isBuild){  //build时给公共的js和css加cdn
				cdnPrefix = '';
				if(type=="js"){
					cdnPrefix = gfe.config.customCdns!=null ? gfe.config.customCdns["js"] : gfe.config.cdn;
				}else if(type=="css"){
					cdnPrefix = gfe.config.customCdns!=null ? gfe.config.customCdns["css"] : gfe.config.cdn;
				}else{
					cdnPrefix = gfe.config.cdn;
				}

				//把ie兼容写法的link与正常引入的link合并，因为都需要对其href的url做处理
				//regResult = regResult.concat(ieLinksOri); 
				//regResult = regResult.concat(ieScriptsOri);
				if(ieScriptsOri){ //ie兼容的js <scripts>
					var regJsStr = $.reg['jsStr'];
					ieScriptsOri.forEach(function(item){
						var reg = new RegExp(regJsStr,'gm');
						var i = reg.exec(item);
						if(i!=null&&!$.is.httpLink(i[1])){
							var j = i[1];
							if(j.indexOf('/')!=0){
								j = projectPathReplace(j);
							}
							
							var originJ = i[1];
							//comboArray.push(j);
							// if(j.substring(0,1)!='/'){
								comboIeArray.push(j);
								comboIeArray2.push(originJ);
							// }
							
						}
					})
				}
				if(ieLinksOri){ //ie兼容的css <link>
					var regJsStr = $.reg['cssStr'];
					ieLinksOri.forEach(function(item){
						var reg = new RegExp(regJsStr,'gm');
						var i = reg.exec(item);
						if(i!=null&&!$.is.httpLink(i[1])){
							var j = i[1];
							if(j.indexOf('/')!=0){
								j = projectPathReplace(j);
							}
							var originJ = i[1];
							//comboArray.push(j);
							// if(j.substring(0,1)!='/'){
								comboIeArray.push(j);
								comboIeArray2.push(originJ);
							// }
						}
					})
				}

				var comboArray = [];
				//regResult = regResult.concat(ieLinksOri); 
				//regResult = regResult.concat(ieScriptsOri); 
				regResult = $.uniq(regResult);
                regResult.forEach(function(item){
                	var isI = isIn(item,ieLinksOri); //判断是不是ie兼容写法的link
                    var reg = new RegExp(regStr,'gm');
                    var i = reg.exec(item);
                    var cdnRegStr = gfe.config.cdnDefalut ? gfe.config.cdnDefalut : gfe.config.cdn;
                    var cdnReg = new RegExp(cdnRegStr+'/', 'gm');
                    var k = (i!=null&&i['input']&&i['input']!=null) ? i['input'] : null;
                    if(k && k!=''){
                    	var strReplace = function (){
	                        if(!/href="\/\//.test(k)){
	                        	// var sreg=new RegExp(k+"(\\s*?)\\r\\n","gmi");
	                        	// str = str.replace(sreg, '');
	                            str = str.replace(k, '');
	                        }
	                    }

	                    if(i && !cdnReg.test(i[1]) && !$.is.httpLink(i[1]) ){
							//var t = i[1].replace(cdnReg, '');
							//comboArray.push(t);
							strReplace();
						}

						if ( i && !$.is.httpLink(i[1]) ){
							//url
							var j = i[1];
							var originJ = i[1];
							//j = projectPathReplace(j);

							var widgetReg = new RegExp('^'+gfe.config.widgetDir, 'gm');
							if(! widgetReg.test(j)){
								// comboArray.push(j);
								if(!isI){ 
									comboArray.push(j); //非兼容IE的css引入文件和js引入
								}
								// if(!isI){ 
								// 	comboArray.push(j); //非兼容IE的css引入文件和js引入
								// }else{
								// 	comboIeArray.push(j);
								// 	comboIeArray2.push(originJ);
								// }
								strReplace();
							}
						}
                    }         
                });

                if(comboArray.length>0){
                    comboArray = $.uniq(comboArray);

                    //自定义静态资源cdn
                    var itemCdn="";
                    var tagSrc="";
                    for (var i=0; i<comboArray.length; i++){
                        var type = f.getSuffix(comboArray[i]);
                        if(comboArray[i].indexOf('include virtual')!=-1 
                        	&&(comboArray[i].indexOf('css.html')!=-1 || comboArray[i].indexOf('style.html')!=-1) ){
                        	type = 'cssHtml';
                        }
                        if(comboArray[i].indexOf('include virtual')!=-1 
                        	&&(comboArray[i].indexOf('js.html')!=-1 || comboArray[i].indexOf('script.html')!=-1) ){
                        	type = 'jsHtml';
                        }

                        if(type=="js" || type=="jsHtml" ){
                            itemCdn = gfe.config.customCdns!=null ? gfe.config.customCdns["js"] : gfe.config.cdn;
                        }
                        if(type=="css"|| type=="cssHtml"){
                            itemCdn = gfe.config.customCdns!=null ? gfe.config.customCdns["css"] : gfe.config.cdn;
                        }

                        var item = comboArray[i];

                        if( !/^\.\.\/js\//.test(item) && !/^\/js\//.test(item) &&
                            !/^\.\.\/css\//.test(item) && !/^\/css\//.test(item) &&
                            !/^http/.test(item) && item.indexOf('include virtual')==-1){
                        		if(item.substring(0,1)=='/'){
                        			item = itemCdn ? itemCdn + item : item;
                        		}else{
                        			item = itemCdn ? itemCdn+'/'+item : item;
                        		}
                        		
                        }
                        if(item.indexOf('include virtual')!=-1 
                        	&& ( item.indexOf('css.html')!=-1||item.indexOf('js.html')!=-1) ){
                        	item = itemCdn ? itemCdn+'/??'+item : item+"/??";
                        }

                        if(item.indexOf('include virtual')!=-1 
                        	&& ( item.indexOf('style.html')!=-1||item.indexOf('script.html')!=-1) ){
                        	item = itemCdn ? item : item+"/??";
                        }

                        if(type!=='undefined'){
                        	if($.placeholder[type+'Link']){
                        		tagSrc += $.placeholder[type+'Link'](item);
                        	}
                        }
                        
                        //item = addgetProjectPath(item) ;
                        //tagSrc += $.placeholder[type+'Link'](item);
                        
                    }
                    if (type == 'js'||type == 'jsHtml') {
                    	str = buildWidget.insertJs(str,tagSrc, gfe.config.build.jsPlace);
                    }else{
                        str = $.placeholder.insertHead(str, tagSrc);
                    }
                }
			}else{

				if(type=="html"){
					var htmlInnerJs = true;
					var str = seajsAddCdn(str,htmlInnerJs);
					str = str.replace(/,comboExcludes:\/\.\*\//,''); //删除,comboExcludes:/.*/；有特殊字符
				}else{
					/*匹配这种地址：<link rel="stylesheet" href="http://css.gomein.net.cn/??<!--#include virtual='/n/common/default/css.html'-->,gmlib/reset/1.1.0/reset.css">*/
	                var includeSrcCssTag = ''; //css标签带tag
	                var includeSrcCss = ''; //css href地址
	                var includeSrcJsTag = '' //js标签带tag
	                var includeSrcJs = ''; //js src地址

	                var inlineList = [];
					var inlineResult = [];
					for(var i=0;i<regResult.length;i++){
						if(regResult[i] && regResult[i].indexOf(' inline')==-1){
							inlineResult.push(regResult[i]);
						}else{
							if(regResult[i]!=null){
								inlineList.push(regResult[i]);
							}
						}
					}
					regResult = inlineResult;

					var comboArray = [];

					//把ie兼容写法的link与正常引入的link合并，因为都需要对其href的url做处理
					//regResult = regResult.concat(ieLinksOri); 
					//regResult = regResult.concat(ieScriptsOri);
					if(ieScriptsOri){ //ie兼容的js <scripts>
						var regJsStr = $.reg['jsStr'];
						ieScriptsOri.forEach(function(item){
							var reg = new RegExp(regJsStr,'gm');
							var i = reg.exec(item);
							if(i!=null&&!$.is.httpLink(i[1])){
								var j = i[1];
								j = projectPathReplace(j);
								var originJ = i[1];
								//comboArray.push(j);
								comboIeArray.push(j);
								comboIeArray2.push(originJ);
							}
						})
					}
					if(ieLinksOri){ //ie兼容的css <link>
						var regJsStr = $.reg['cssStr'];
						ieLinksOri.forEach(function(item){
							var reg = new RegExp(regJsStr,'gm');
							var i = reg.exec(item);
							if(i!=null&&!$.is.httpLink(i[1])){
								var j = i[1];
								j = projectPathReplace(j);
								var originJ = i[1];
								//comboArray.push(j);
								comboIeArray.push(j);
								comboIeArray2.push(originJ);
							}
						})
					}
					regResult.forEach(function(item){
						var isI = isIn(item,ieLinksOri); //判断是不是ie兼容写法的link
						var reg = new RegExp(regStr,'gm');
						var i = reg.exec(item);
						var cdnRegStr = gfe.config.cdnDefalut ? gfe.config.cdnDefalut : gfe.config.cdn;
						var cdnReg = new RegExp(cdnRegStr+'/', 'gm');

						// i是一个这样的数据格式[]
						// ['<link rel="stylesheet" href="/css/d.css">',
						// 	'/css/d.css',
						// 	index: 0,
						// 	input: '<link rel="stylesheet" href="/css/d.css">']

						if(i!=null && i.indexOf(' inline')==-1){ //如果引入地址有inline属性则不做url处理
							var k = i['input'];

							var strReplace = function (){
								if(!/href="\/\//.test(k)){
		                        	// var sreg=new RegExp(k+"(\\s*?)\\r\\n","gmi");
		                        	// str = str.replace(sreg, '');
									str = str.replace(k, '');
								}
							}

		                    if( i[1].indexOf('include virtual')!=-1 
		                    	&& (i[1].indexOf('css.html')!=-1 || i[1].indexOf('style.html')!=-1) ){
		                        includeSrcCss = i[1];
		                    	includeSrcCssTag =  i[0];
		                    }

		                    if( i[1].indexOf('include virtual')!=-1 
		                    	&& (i[1].indexOf('js.html')!=-1 || i[1].indexOf('script.html')!=-1) ){
		                        includeSrcJs = i[1];
		                    	includeSrcJsTag =  i[0];
		                    }

							if(i && !cdnReg.test(i[1]) && !$.is.httpLink(i[1]) ){
								//var t = i[1].replace(cdnReg, '');
								//comboArray.push(t);
								strReplace();
							}

							if ( i && !$.is.httpLink(i[1]) ){
								//url
								var j = i[1];
								j = projectPathReplace(j);
								var originJ = i[1];

								var widgetReg = new RegExp('^'+gfe.config.widgetDir, 'gm');

								if(! widgetReg.test(j)){
									if(!isI){ //把兼容IE的css排除，因为不需要和url拼接在一起
										comboArray.push(j); //非兼容IE的css引入文件和js引入
									}
									strReplace();
								}
							}
						}
					});
					function noComboLogic(){
						if(comboArray.length>0){
							//自定义静态资源cdn
							cdnPrefix = '';
							if(type=="js"){
								cdnPrefix = gfe.config.customCdns!=null ? gfe.config.customCdns["js"] : gfe.config.cdn;
							}else if(type=="css"){
								cdnPrefix = gfe.config.customCdns!=null ? gfe.config.customCdns["css"] : gfe.config.cdn;
							}else{
								cdnPrefix = gfe.config.cdn;
							}

							comboArray = $.uniq(comboArray);
							var tagSrc = '';

							if(cdnPrefix!=''){
								cdnPrefix =  cdnPrefix + (comboArray.length>1 ? '/??' : '/');
							}

							var comboUrl = comboArray.join(',');
							comboUrl = comboUrl.replace(/\/\//gm,'/');
							var staticUrl =  cdnPrefix + comboUrl;
							
							//combo
							if(gfe.config.output[type+'Combo'] && gfe.config.cdn && includeSrcCss=='' && includeSrcJs==''){
								
								//cdnPrefix =  gfe.config.cdn + (comboArray.length>1 ? '/??' : '/');
								//var staticUrl = comboUrl;
								tagSrc = '' + $.placeholder[type+'comboLink'](staticUrl);

							}else if(gfe.config.output[type+'Combo'] && gfe.config.cdn && includeSrcCss!=''){

								str = str.replace(includeSrcCssTag+'\r\n', '');
								tagSrc = $.placeholder[type+'Link'](comboUrl);

							}else if(gfe.config.output[type+'Combo'] && gfe.config.cdn && includeSrcJs!=''){

								str = str.replace(includeSrcJsTag+'\r\n', '');
								tagSrc = $.placeholder[type+'Link'](comboUrl);

							}else{
								//自定义静态资源cdn
								
								cdnPrefix = cdnPrefix.substring(0,cdnPrefix.length-2);
								for (var i=0; i<comboArray.length; i++){
									var item = comboArray[i];
									if(item.indexOf('include virtual')==-1){
										item = cdnPrefix ? cdnPrefix+item : item;
									}
									//item = cdnPrefix ? cdnPrefix+'/'+item : item;
									item = addgetProjectPath(item) ;
									tagSrc += $.placeholder[type+'Link'](item);
								}
							}

							if (type == 'js'||type=='jsHtml') {
								str = buildWidget.insertJs(str,tagSrc, gfe.config.output.jsPlace);
							}else{
								str = $.placeholder.insertHead(str, tagSrc);
							}
						}

						
					}
					function comboLogic(){
	                    if (comboArray.length > 0) {
	                        //自定义静态资源cdn
	                        cdnPrefix = '';
	                        if (type == 'css' && gfe.config.output.cssCombo==true) {
	                            var comboArrayNew = [];
	                            if (comboTags.length > 0) {
	                                comboTags.forEach(function(item, i) {
	                                    /*  
											item css
											<!--gfe:combo:begin-->
								                <link rel="stylesheet" href="gmlib/reset/1.0.0/reset.css">
								                <link rel="stylesheet" href="/css/index.css">
									        <!--gfe:combo:end-->
									        item js
									        <!--gfe:combo:begin-->
										        <script src="/js/aaa.js"></script>
										        <script src="/js/bbb.js"></script>
											<!--gfe:combo:end-->
								        */
	                                    var csslinks = item.match(/<link\s.*?stylesheet\s*.*href="(.*?)".*?>/img);
	                                    if (csslinks && csslinks.length > 0) {
	                                        var l = [];
	                                        csslinks.forEach(function(cssitem, cssi) {
	                                            var hrefStr = cssitem.match(/href="(.*?)"/);
	                                            if (hrefStr != null) {
	                                                l.push(hrefStr[1]);
	                                            }
	                                        });
	                                        if (l.length > 0) {
	                                            comboArrayNew.push(l.join(','));
	                                        }
	                                    }
	                                });
		                            
		                            function isInComboArray(itemL){
		                            	var isi = '';
		                            	comboArray.forEach(function(item,i){
		                            		if(item.indexOf(itemL)!=-1){
		                            			isi = item;
		                            		}
		                            	});
		                            	return isi;
		                            }

		                            if (comboArrayNew && comboArrayNew.length > 0) {
		                                comboArrayNew.forEach(function(item, i) {
		                                    //var comboUrl = comboArray.join(',');
		                                    //var comboUrl = item.join(',');
		                                    //comboUrl = comboUrl.replace(/\/\//gm,'/');

		                                    var itemList = item.split(',');
		                                    
		                                    itemList.forEach(function(itemL,itemI){
		                                    	if(isInComboArray(itemL)!=''){
		                                    		itemL = isInComboArray(itemL);
		                                    		itemList[itemI] = isInComboArray(itemL);
		                                    	}
		                                    });
		                                    
		                                    item = itemList.join(',');
		                                    item = item.replace(/\/\//gm, '/');

		                                    cdnPrefix = gfe.config.customCdns != null ? gfe.config.customCdns["css"] : gfe.config.cdn;
		                                    cdnPrefix = cdnPrefix+'/??';
		                                    
		                                    if(item.indexOf('include virtual')==-1 && item.indexOf(gfe.config.projectPath)!=-1){
		                                    	item = cdnPrefix+item;
		                                    }
		                                    comboUrl = item;
		                                    //var comboUrl = item.replace(/\/\//gm, '/');
		                                    var staticUrl = cdnPrefix + comboUrl;

		                                    //combo
		                                    if (gfe.config.output[type + 'Combo'] && gfe.config.cdn && includeSrcCss == '' && includeSrcJs == '') {

		                                        //cdnPrefix =  gfe.config.cdn + (comboArray.length>1 ? '/??' : '/');
		                                        //var staticUrl = comboUrl;
		                                        tagSrc = '' + $.placeholder[type + 'comboLink'](staticUrl);

		                                    } else if (gfe.config.output[type + 'Combo'] && gfe.config.cdn && includeSrcCss != '') {

		                                        //str = str.replace(includeSrcCssTag + '\r\n', '');
		                                        tagSrc = $.placeholder[type + 'Link'](comboUrl);

		                                    } else if (gfe.config.output[type + 'Combo'] && gfe.config.cdn && includeSrcJs != '') {

		                                        str = str.replace(includeSrcJsTag + '\r\n', '');
		                                        tagSrc = $.placeholder[type + 'Link'](comboUrl);

		                                    } else {
		                                        //自定义静态资源cdn

		                                        for (var i = 0; i < comboArray.length; i++) {
		                                            var item = comboArray[i];
		                                            item = cdnPrefix ? cdnPrefix + '/' + item : item;
		                                            item = addgetProjectPath(item);
		                                            tagSrc += $.placeholder[type + 'Link'](item);
		                                        }
		                                    }
		                                    str = $.placeholder.insertHead(str, tagSrc);
		                                    // if (type == 'js' || type == 'jsHtml') {
		                                    //     str = buildWidget.insertJs(str, tagSrc, gfe.config.output.jsPlace);
		                                    // } else {
		                                    //     str = $.placeholder.insertHead(str, tagSrc);
		                                    // }
		                                });
		                            }
	                            }

	                            
	                        }else if(type=='js' && gfe.config.output.jsCombo==true){
	                        	var comboArrayNew = [];
	                            if (comboTags.length > 0) {
	                                comboTags.forEach(function(item, i) {
	                                    /*  
											item css
											<!--gfe:combo:begin-->
								                <link rel="stylesheet" href="gmlib/reset/1.0.0/reset.css">
								                <link rel="stylesheet" href="/css/index.css">
									        <!--gfe:combo:end-->
									        item js
									        <!--gfe:combo:begin-->
										        <script src="/js/aaa.js"></script>
										        <script src="/js/bbb.js"></script>
											<!--gfe:combo:end-->
								        */
	                                    
	                                    var jslinks = item.match(/<script\s.*?src="(.*?)".*?<\/script>/img);
	                                    if (jslinks && jslinks.length > 0) {
	                                        var l = [];
	                                        jslinks.forEach(function(jsitem, jsi) {
	                                            var hrefStr = jsitem.match(/src="(.*?)"/);
	                                            if (hrefStr != null) {
	                                                l.push(hrefStr[1]);
	                                            }
	                                        });
	                                        if (l.length > 0) {
	                                            comboArrayNew.push(l.join(','));
	                                        }
	                                    }
	                                });
	                            }

	                            function isInComboArray(itemL){
	                            	var isi = '';
	                            	comboArray.forEach(function(item,i){
	                            		if(item.indexOf(itemL)!=-1){
	                            			isi = item;
	                            		}
	                            	});
	                            	return isi;
	                            }

	                            if (comboArrayNew && comboArrayNew.length > 0) {
	                                comboArrayNew.forEach(function(item, i) {
	                                    //var comboUrl = comboArray.join(',');
	                                    //var comboUrl = item.join(',');
	                                    //comboUrl = comboUrl.replace(/\/\//gm,'/');

	                                    var itemList = item.split(',');
	                                    itemList.forEach(function(itemL,itemI){
	                                    	if(isInComboArray(itemL)!=''){
	                                    		itemL = isInComboArray(itemL);
	                                    		itemList[itemI] = isInComboArray(itemL);
	                                    	}
	                                    });

	                                    item = itemList.join(',');
	                                    item = item.replace(/\/\//gm, '/');
	                                    // cdnPrefix = gfe.config.customCdns != null ? gfe.config.customCdns["js"] : gfe.config.cdn;
	                                    // if(item.indexOf('include virtual')==-1 && item.indexOf(gfe.config.projectPath)!=-1){
	                                    // 	item = cdnPrefix+'/??'+item;
	                                    // }
	                                    cdnPrefix = gfe.config.customCdns != null ? gfe.config.customCdns["css"] : gfe.config.cdn;
	                                    cdnPrefix = cdnPrefix+'/??';
	                                    if(item.indexOf('include virtual')==-1 && item.indexOf(gfe.config.projectPath)!=-1){
	                                    	item = cdnPrefix+item;
	                                    }
	                                    
	                                    comboUrl = item;

	                                    //var comboUrl = item.replace(/\/\//gm, '/');
	                                    var staticUrl = cdnPrefix + comboUrl;

	                                    //combo
	                                    if (gfe.config.output[type + 'Combo'] && gfe.config.cdn && includeSrcCss == '' && includeSrcJs == '') {

	                                        //cdnPrefix =  gfe.config.cdn + (comboArray.length>1 ? '/??' : '/');
	                                        //var staticUrl = comboUrl;
	                                        tagSrc = '' + $.placeholder[type + 'comboLink'](staticUrl);

	                                    } else if (gfe.config.output[type + 'Combo'] && gfe.config.cdn && includeSrcCss != '') {

	                                        str = str.replace(includeSrcCssTag + '\r\n', '');
	                                        tagSrc = $.placeholder[type + 'Link'](comboUrl);

	                                    } else if (gfe.config.output[type + 'Combo'] && gfe.config.cdn && includeSrcJs != '') {

	                                        //str = str.replace(includeSrcJsTag + '\r\n', '');
	                                        tagSrc = $.placeholder[type + 'Link'](comboUrl);

	                                    } else {
	                                        //自定义静态资源cdn

	                                        for (var i = 0; i < comboArray.length; i++) {
	                                            var item = comboArray[i];
	                                            item = cdnPrefix ? cdnPrefix + '/' + item : item;
	                                            item = addgetProjectPath(item);
	                                            tagSrc += $.placeholder[type + 'Link'](item);
	                                        }
	                                    }
	                                    //buildWidget.insertJs = function(content, jsLink, jsPlace) {
	                                    str = buildWidget.insertJs(str, tagSrc, gfe.config.output.jsPlace);
	                                    // if (type == 'js' || type == 'jsHtml') {
	                                    //     str = buildWidget.insertJs(str, tagSrc, gfe.config.output.jsPlace);
	                                    // } else {
	                                    //     str = $.placeholder.insertHead(str, tagSrc);
	                                    // }
	                                });
	                            }
	                        }else{
	                        	noComboLogic();
	                        }

	                    }
					}
					//如果html中没有combo标签,则根据config参数决定是否combo所有标签
					if(comboTags == null || (gfe.config.output.cssCombo==false&&gfe.config.output.jsCombo==false)){
						noComboLogic();
					}else{
						comboLogic();
					}
					//把inline的css放到</head>之前，把inline的js放到</body>之前
					if(inlineList.length>0){
						for(var i=0;i<inlineList.length;i++){
							var item = inlineList[i];
							tagSrc = item;
							var sreg=new RegExp(item+"(\\s*?)\\r\\n","gmi");
                        	str = str.replace(sreg, '');
							//str = str.replace(item+'\r\n', '');
							if (type == 'js') {
								str = buildWidget.insertJs(str,tagSrc, gfe.config.output.jsPlace);
							}
							if(type == 'css'){
								str = $.placeholder.insertHead(str, tagSrc);
							}
						}
					}
				}

			}
			
		}
		return str;
	}

	var jsReplace= function (str,regStr){
		var reg = new RegExp(regStr,'gm');
		var regResult =  str.match(reg);
		if (regResult){
			regResult.forEach(function(item){
				var reg = new RegExp(regStr,'gm');
				var i = reg.exec(item);
				if ( i && !$.is.httpLink(i[1]) ){
					//url
					var j = i[1];
					j = projectPathReplace(j);

					//add cdn
					if(gfe.config.cdn){
						j =  '/' + j;
						j = $.replaceSlash(j);
						j = gfe.config.cdn +  j;
					}
					
					j = addgetProjectPath(j) ;

					//replace
					var r = new RegExp(i[1],'gm');
					str = str.replace(r,j);
				}
			});
		}
		return str;
	}

	str = replaceCore(str, 'css');
	str = replaceCore(str, 'js');
	str = replaceCore(str, 'html');

	str = str.replace(/(^[\s]$)+/gm,'');
	str = str.replace(/<\!--gfe:combo:begin-->((?!<\!--gfe:combo:end-->)[\s\S])*<\!--gfe:combo:end-->/img,''); //删除combo注释标签

	//把ie兼容性写法的css进行替换，替换成处理后的url地址

	if(isBuild){
		str = str.replace(usageScript,'');
		str = str.replace('</head>',usageLink+'\r\n</head>');
		if(gfe.config.build.jsPlace=="insertHead"){
			str = str.replace('</head>',usageScript+'\r\n</head>');
		}
		if(gfe.config.build.jsPlace=="insertBody"){
			str = str.replace('</body>',usageScript+'\r\n</body>');
		}
	}else{
		str = str.replace('</head>',usageLink+'\r\n</head>');
		if(gfe.config.output.jsPlace=="insertHead"){
			str = str.replace('</head>',usageScript+'\r\n</head>');
		}
		if(gfe.config.output.jsPlace=="insertBody"){
			str = str.replace('</body>',usageScript+'\r\n</body>');
		}
	}

	comboIeArray.forEach(function(item,i){ //处理IE兼容的css和js的url地址加cdn
		//var buildReg=new RegExp(item+"(\\s*?)\\r\\n","gmi");
		var buildReg = new RegExp('href="'+comboIeArray2[i],"img");
		var buildRegJs = new RegExp('src="'+comboIeArray2[i],"img");
		cdnPrefix = cdnPrefix.replace('/??','');
		if(isBuild){
			if(comboIeArray2[i].indexOf('/')==0){
				str = str.replace(buildReg,'href="'+item);
				str = str.replace(buildRegJs,'src="'+item);
			}else{
				str = str.replace(buildReg,'href="'+cdnPrefix+'/'+item);
				str = str.replace(buildRegJs,'src="'+cdnPrefix+'/'+item);
			}
		}else{
			var url = gfe.config.output.cssCombo ? cdnPrefix+'/'+item : cdnPrefix+item;
			var url2 = gfe.config.output.jsCombo ? cdnPrefix+'/'+item : cdnPrefix+item;
			str = str.replace(buildReg,'href="'+url);
			str = str.replace(buildRegJs,'src="'+url2);
		}
	});

	//inbottom处理
	var re = new RegExp(/<script([^>]*)inbottom([^>]*)>((?!<\/script>)[\s\S])*<\/script>/gim);
	var pageJs = str.match(re);
	var pagejsStr = '';
	if(pageJs && pageJs.length>0){
		pageJs.forEach(function(item,i){
			pagejsStr+=item+'\r\n';
		});
	}
	str = str.replace(re,'');
	if ( /<\/body>/.test(str) ){
		var pagejsStr = pagejsStr .replace(re, function(str, index){
			str = str.replace(/\sinbottom/gm,'');
		    return str;
		});
		str = str.replace('</body>',pagejsStr+'\r\n</body>');
	}

	return str;
}

/**
 * 线上Debug输出文件逻辑处理
 * @param  {String} 页面内容
 * @return {String} 处理后的页面内容
 */
function debugContentProcess(content) {
    //为gmlib和"/"开头的静态资源添加CDN
    function addCdnToStaticAsset(content) {
        var publicAssetRefRegExp = /(<script([^>]*?)(src)\s*=\s*"gmlib([^>]*?)(>\s*<\s*\/script\s*>))|(<link([^>]*?)(href)\s*=\s*"gmlib([^>]*?)>)/gi;
        var privateAssetRefRegExp = /(<script([^>]*?)(src)\s*=\s*"\/js\/([^>]*?)(>\s*<\s*\/script\s*>))|(<link([^>]*?)(href)\s*=\s*"\/css\/([^>]*?)>)/gi;
        var cssServer = gfe.config.customCdns != null ? gfe.config.customCdns.css : gfe.config.cdn;
        var jsServer = gfe.config.customCdns != null ? gfe.config.customCdns.js : gfe.config.cdn;
        var debugCdn = gfe.config.output.debugCdn;

        content = content.replace(publicAssetRefRegExp, function(publicAssetRef) {
            if (~publicAssetRef.indexOf("link")) {
                publicAssetRef = publicAssetRef.replace(/\s*href\s*=\s*"/, function(matchContent) {
                    return matchContent + cssServer + '/';
                });
            }
            if (~publicAssetRef.indexOf("script")) {
                publicAssetRef = publicAssetRef.replace(/\s*src\s*=\s*"/, function(matchContent) {
                    return matchContent + jsServer + '/'
                });
            }
            return publicAssetRef;
        }).replace(privateAssetRefRegExp, function(privateAssetReg) {
            privateAssetReg = privateAssetReg.replace(/(\s*href\s*=\s*")|(\s*src\s*=\s*")/, function(matchContent) {
                return matchContent + debugCdn;
            }).replace('inline','');
            return privateAssetReg;
        });

        return content;
    }

    //处理js的位置，添加insertBody
    function processJsPlace(content) {
        var jsPlace = gfe.config.build.jsPlace;
        var srcScriptRegExp = /(<script([^>]*)(src)([^>]*)>(((?!<\/script>)[\s\S])*)<\/script>)|(<\!--\[if\s)(((?!<\!\[endif\]-->)[\s\S])*)<script(((?!<\!\[endif\]-->)[\s\S])*)(<\!\[endif\]-->)/gi;
        var inbottomScriptRegExp = /<script([^>]*)(inbottom)([^>]*)>(((?!<\/script>)[\s\S])*)<\/script>/gi;
        var srcScripts = [];
        var inbottomScripts = [];

        content = content.replace(srcScriptRegExp, function(srcScript) {
            srcScripts.push(srcScript);
            return '';
        }).replace(inbottomScriptRegExp, function(inbottomScript) {
            inbottomScripts.push(inbottomScript);
            return '';
        });

        if (srcScripts.length > 0) {
            if (jsPlace === 'insertBody') {
                content = content.replace('<\/body>', srcScripts.join('\r\n') + '<\/body>');
            }
            if (jsPlace === 'insertHead') {
                content = content.replace('<\/head>', srcScripts.join('\r\n') + '<\/head>');
            }
        }
        if (inbottomScripts.length > 0) {
            content = content.replace('<\/body>', inbottomScripts.join('\r\n') + '<\/body>');
        }
        return content;
    }

    content = addCdnToStaticAsset(content);
    content = processJsPlace(content);

    return content;
}


/**
* @seajs.use add prefix 
* @example  
*	seajs.use(['/a.js', '/b.js'],function(){}) ==> 
*	seajs.use(['projectPath/a.js', 'projectPath/b.js'],function(){})
*/
function seajsAddCdn(source,htmlInnerJs){
	var cdn = gfe.config.cdn;
	var configBaseDir = gfe.config.baseDir ? gfe.config.baseDir+'/'  : '';
	var tag = source.match(/seajs.use\((.*?)\S*[function)|]/gmi);
	//var tag = source.match(/seajs.use\(([\s\S]*)\s\S*[function)|]/gmi);	
	if (tag) {
		var tempObj = {};
		for (var i =0, j= tag.length; i<j; i++){
			var  t= tag[i].replace(/seajs.use\(|\[|\]|\)/gim, "");
			t = t.replace(/function\(/gim, "");
			var t1 = t.split(',');
			if (t1) {
				for (var m=0; m<t1.length; m++ ){
					var t2 = t1[m].replace(/\"/g, '').replace(/\'/g, '');
					//js和widget的路径,'js/a.js'的不做替换
					var t1R = new RegExp(gfe.config.jsDir+'/|'+gfe.config.widgetDir+'/', 'gm');
					if ( t1R.test(t2) && !$.is.httpLink(t2) && 
						( t2.charAt(0) == '/' || t2.charAt(0) == '\\' || t2.charAt(0) == '.' )
					) {
						tempObj[t2] = projectPathReplace(t2);
					}
				}
			}
		}
		
		for (var i in  tempObj ){
			//var reg = new RegExp(escape(i), 'gim');
			var reg = new RegExp(escape(i)+'(\'|\")'+'{1}', 'gim');

			if(!htmlInnerJs){
				if(cdn){
					tempObj[i] = cdn + '/' + tempObj[i];
				}
			}
			var regStr = escape(i);
			//source = source.replace(reg, tempObj[i])
			// source = source.replace(reg, function(str,index){
			// 	console.log(str);
			// 	console.log(index);
			// 	console.log('11111111111111111111111111111');
			// 	var lastStr = str.substring(str.length-1);
			// 	console.log(tempObj[i]+lastStr);
			// 	return tempObj[i]+lastStr;
			// });
		}
	}
	return source;
}

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
 * @引用widget文件下的img/cssLink/jsLink add cdn prefix
 * @example 
 	<img src="/widget/a/a.png"><img src='/widget/a/a.png'><img src='../widget/a/a.png'><img src="./widget/a/a.png"> 
 	--->
 	<img src="http://cdn.com/projectPath/widget/a/a.png">
 */
function widgetUrlAddCdn(source){
	var configBaseDir = gfe.config.baseDir ? gfe.config.baseDir+'/'  : '';
	var tag = source.match(/["|'][\\.]*\/widget\/\S*["|']/gmi);
	var cdnPrefix='';
	if (tag) {
		var tempObj = {};
		for (var i =0, j= tag.length; i<j; i++){
			var  t = tag[i].replace(/["|']/gim, "");
			var t1 = t;
			var suffix = t1.substring(t1.lastIndexOf('.'),t1.length);
			if(suffix==".css"){
				cdnPrefix = gfe.config.customCdns!=null ? gfe.config.customCdns["css"] : gfe.config.cdn;
			}
			if(suffix==".js"){
				cdnPrefix = gfe.config.customCdns!=null ? gfe.config.customCdns["js"] : gfe.config.cdn;
			}
			if(gfe.config.cdn){
				var t2 = '';
				if(!gfe.config.output.cssCombo){
					var t2 = '/' + gfe.getProjectPath() + t.replace(/^\.*/, "");
				}else{
					var t2 = '/' + t.replace(/^\.*/, "");
				}
				
				t2 = $.replaceSlash(t2);
				t1 = cdnPrefix + t2;
			}else{
				t1 = addgetProjectPath(t1) ;
				t1 = $.replaceSlash(t1);
			}

			if(t != t1){
				tempObj[t] = t1;
			}
		}
		for (var i in tempObj ){
			var reg = new RegExp(i, 'gim');
			source = source.replace(reg, tempObj[i]);
		}
	}
	return source;
}


/**
 * @projectPathReplace
 * @ctime 2014-7-5
 * @example 
	/css/index.css
	../css/index.css
	==>
	projectPath/css/index.css
 */
function projectPathReplace(j){
	j = j.replace(gfe.config.baseDir, '');
					
	if(gfe.config.cdn){
		j = j.replace(/\.\.\//g,'/');
		//add projectPath
		if (j.substring(0,3)=='/js' || j.substring(0,4)=='/css') {j = gfe.getProjectPath() + j;}
		// del ../  ./  
		if (j.charAt(0) == '/') { j = j.replace('/','');}
		// 替换./和//为/
		j = j.replace(/\/\/|\.\//gm, '/');
	}

	// // ==> /
	j = j.replace(/\/\//gm,'/');
	return j;
}

