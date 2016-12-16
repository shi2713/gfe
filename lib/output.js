/**
* @输出处理后的工程文件
* @param {String} options.type 'default' : 默认输出js,css文件夹 如$ gfe o
* @param {String} options.type 'all' : all下输出js,css和html文件夹以及onlyCopy 如$ gfe o -all
* @param {String} options.type 'custom' : 自定义输出 如$ gfe o app/js/test.js
* @param {String} options.list : 自定义输出的文件路径,如app/js/test.js
* @param {Boolse} options.isbackup 是否备份
* @param {Boolse} options.isdebug 是否为debug
* @param {Function} options.callback 回调函数
* @todo 只复制改动的文件
*/
var path = require('path');
var fs = require('fs');
var Q = require("q");


//lib自身组件
var $ = require('./base.js');
var f = require('./file.js');
var gfe = require('./gfe.js');
var CssSprite = require('./cssSprite.js');
var Concat = require('./concat.js');
var CompressScheduler = require('./compressScheduler.js');

//exports
var output = module.exports = {};

/**
 * @init
 */
output.init = function(options){
    var type = options.type,
        list = options.list,
        onlyCopyList = options.onlyCopyList,
        isbackup = options.isbackup,
        isdebug = options.isdebug,
        callback = options.callback;

    var outputdirName = gfe.config.outputDirName;
    var outputComment = gfe.config.output.comment;
    var encoding = gfe.config.output.encoding;
    var excludeFiles = gfe.config.output.excludeFiles;
        excludeFiles = excludeFiles ? excludeFiles + '|.vm|.scss|.less|.psd' : '.vm|.scss|.less|.psd';
    var weinre = gfe.config.build.weinre;
    // var outputdir = outputdirName+'/'+ (options.projectPath || gfe.getProjectPath());
    // 修改输出目录
    var outputdir = outputdirName;
    var isbackup = typeof(isbackup) == 'undefined' ? false : isbackup;
    
    //[notice]输出路径暂不可配置
    var cssDir = path.normalize( gfe.bgCurrentDir + '/' + gfe.config.cssDir );
    var imagesDir = path.normalize( gfe.bgCurrentDir + '/' + gfe.config.imagesDir );
    var jsDir =  path.normalize( gfe.bgCurrentDir + '/' + gfe.config.jsDir );
    var htmlDir = path.normalize( gfe.bgCurrentDir + '/' + gfe.config.htmlDir );
    var widgetDir = path.normalize( gfe.bgCurrentDir + '/' + gfe.config.widgetDir );

    var debugHtml = '';
    if(weinre){
        fs.readdirSync(htmlDir).forEach(function(name){
            var pathname = path.join(htmlDir, name);
            if(f.isFile(pathname)){
                debugHtml += '<li style="padding-bottom:0.2em;"><a target="_blank" href="'+mobileWeinre(pathname)+'">'+name+'</a></li>';
            }
        });

        debugHtml = '<ul>'+debugHtml+'</ul>';

        f.write(path.join(htmlDir, '_debug.html'), debugHtml);
    }

    var core = function() {
        var logText = 'gfe output success!';
        var copyDefaultDir = function(){
            //gfe.config.baseDir是一期目录规划的问题
            var cssOutputDir = outputdir + '/' + gfe.config.cssDir.replace(gfe.config.baseDir+'/', '');
            var imagesOutputDir = outputdir + '/' + gfe.config.imagesDir;
            if(gfe.config.baseDir != ''){
                imagesOutputDir = outputdir + '/' + gfe.config.imagesDir.replace(gfe.config.baseDir+'/', '');
            }
            var jsOutputDir = outputdir + '/' + gfe.config.jsDir.replace(gfe.config.baseDir+'/', '');

            //图片目录不位于css/i中
            if(gfe.config.imagesDir.split(gfe.config.cssDir).length  == 1 ){
                f.copy(imagesDir, imagesOutputDir);
            }
            
            f.copy(cssDir, cssOutputDir, '(css|'+$.imageFileType()+')$', (excludeFiles ? excludeFiles : '(less|scss)$'), null, null, null, encoding);
            f.copy(jsDir, jsOutputDir, (isdebug ? '(js|map)$' : 'js$'), (excludeFiles ? excludeFiles : 'babel$'), null, null, null, encoding);

            // 输出widget todo 可配置
            var outputWidgetDir = outputdir+'/'+gfe.config.widgetDir;
            f.copy(widgetDir, outputWidgetDir,  '(js|css|'+$.imageFileType()+(isdebug ? '|map' : '') + ')$', (excludeFiles ? excludeFiles : '(less|scss|psd)$'), null, null, null, encoding);
            
            if(f.exists(widgetDir)){
                
                //将所有widget/images复制到html/images
                fs.readdirSync(widgetDir).forEach(function(dir){
                    var source = widgetDir + '/' + dir;
                    if(f.isDir(source) && f.exists(source + '/images') ){
                        f.mkdir(gfe.config.htmlDir+'/images');
                        f.copy(source + '/images', outputdir + '/' + gfe.config.htmlDir+ '/images', null, null, null, null, null, encoding);
                    };
                });

                //复制到widget的目标目录之后，再将空目录删除
                fs.readdirSync(outputWidgetDir).forEach(function(dir){
                    var realpath = fs.realpathSync(outputWidgetDir + '/' + dir);
                    var dirs = fs.readdirSync(realpath);
                    var files = f.getdirlist(realpath);

                    if(files.length == 0 && dirs.length == 0){
                        fs.rmdirSync(realpath);
                    }
                });

                //combineWidgetCss下widget中的图片widgert/a/i/a.png输出至css/i/目录下
                if (gfe.config.output.combineWidgetCss){
                    f.mkdir(imagesOutputDir);
                    var imgList = f.getdirlist(widgetDir, $.imageFileType()+'$');
                    imgList.forEach(function(imgListItem){
                        f.copy(imgListItem, imagesOutputDir+'/'+ path.basename(imgListItem), null, null, null, null, null, encoding);
                    });
                }
            }
        }
        var copyCustomDir = function(){
            if(!list) return;
            var listArray = list.split('|');
            for (var i=0; i<listArray.length; i++ ){
                var item = listArray[i];
                if ( f.exists(item) ) {
                    var dirname = path.dirname(item);
                    var basename = path.basename(item);
                    if($.is.less(basename) || $.is.sass(basename)){
                        basename = basename.replace(/(sass|scss|less)/g, 'css');
                    }

                    var source = path.normalize( gfe.bgCurrentDir + '/'+ dirname  +'/'+ basename );
                    
                    if (isbackup){ 
                        backupProject(item);
                    }else {
                        var dirnameTemp = '';
                        if (dirname != '.') {
                            dirnameTemp = dirname.replace(gfe.config.baseDir,'');
                            dirnameTemp = '/' + dirnameTemp;
                        }
                        var targetBase = outputdir + dirnameTemp;
                        var target = path.normalize(targetBase +'/'+ basename );
                        var targetdir = path.normalize(targetBase);

                        f.mkdir(targetdir);
                        //gfe u widget/xxx/时要过滤某些文件
                        f.copy(source, target, null, (excludeFiles ? excludeFiles : '(vm|tpl|less|scss|psd)$'), null, null, null, encoding);
                        if(i==(listArray.length-1)){
                            customItemRes+=item;
                        }else{
                            customItemRes+=item+'|';
                        };
                        
                    }
                }
            }

            if (customItemRes == ''){
                customTag = false;
                console.log('gfe error ['+list+'] is not exists');
            }
            if (!isbackup) { logText = 'gfe output success! custom:['+customItemRes+']';}
        }
        var copyOnlyCopyDir = function(){
            if(!onlyCopyList) return;
            var onlyCopyListArray = onlyCopyList.split('|');
            for (var i=0; i<onlyCopyListArray.length; i++ ){
                var item = onlyCopyListArray[i];
                if ( f.exists(item) ) {
                    var dirname = path.dirname(item);
                    var basename = path.basename(item);

                    var source = path.normalize( gfe.bgCurrentDir + '/'+ dirname  +'/'+ basename );

                    
                    if (isbackup){ 
                        backupProject(item);
                    }else {
                        var dirnameTemp = '';
                        if (dirname != '.') {
                            dirnameTemp = dirname.replace(gfe.config.baseDir,'');
                            dirnameTemp = '/' + dirnameTemp;

                        }
                        var targetBase = outputdir + dirnameTemp;
                        var target = path.normalize(targetBase +'/'+ basename );
                        var targetdir = path.normalize(targetBase);
                        f.copy(source, target, null, null, null, null, null, encoding);
                        if(i==(onlyCopyListArray.length-1)){
                            onlyCopyItemRes+=item;
                        }else{
                            onlyCopyItemRes+=item+'|';
                        };
                        
                    }
                }
            }

            if (onlyCopyItemRes == ''){
                customTag = false;
                console.log('gfe error ['+onlyCopyList+'] is not exists');
            }
            if (!isbackup) { logText = 'gfe output success! onlyCopy:['+onlyCopyItemRes+']';}
        }

        var customItemRes='',onlyCopyItemRes='';
        var customTag= true;

        switch (type){
            case 'default' :
                copyDefaultDir();
                break ;
            case 'plain':
                copyDefaultDir();
                customTag = false;
                break;
            case 'all': 
                copyDefaultDir();
                //输出html
                f.copy(htmlDir, outputdir+'/'+gfe.config.htmlDir, null, excludeFiles, null, null, null, encoding);
                //输出onlyCopy
                copyOnlyCopyDir();
                break;
            case 'custom':
                copyCustomDir();
                break;
        }
    
        //backup jsdir, cssdir, widgetdir to tags dir
        if (type == 'backup') {
            backupProject();
        }

        if(customTag){
            Q().then(function (){
                //css sprite
                if(!isbackup){
                    if(gfe.config.output.cssSprite){
                        CssSprite.init(outputdirName);
                    }
                }
            }).then(function (){
                //压缩 1.0
                /*    
                if(!isbackup){
                    var Compress = require('./compress.js');
                    Compress.init(outputdirName, isdebug);        
                }*/
                CompressScheduler.init(outputdirName, isdebug, function(){
                    Q().then(function (){
                        //合并
                        if(!isbackup){
                            Concat.init(outputdirName);
                        }
                    }).then(function (){
                        //callback
                        if(callback) callback();
                    }).then(function (){
                        //log
                        if(!isbackup){
                            console.log(logText);
                        }
                    });
                });
            })
        }else{
            console.log(logText);
        }
    }
    
    if (f.exists(outputdirName)) {
        f.del(outputdirName,function(){
            core();
        });
    }else {
        core();
    }
}

/**
 * @mobileWeinre
 * @在页面的body标签最后插入一个<script src="http://123.56.105.44:8080/target/target-script-min.js#20150810145518"></script>
 */
function mobileWeinre(pathname){
    var timestamp = $.getTimestamp();
    var weinreUrl = gfe.config.build.weinreUrl + '/target/target-script-min.js#' + timestamp;
    var content = f.read(pathname);

    content = $.placeholder.insertBody(content, '<script src="' + weinreUrl + '"></script>');
    f.write(pathname, content);

    return gfe.config.build.weinreUrl + '/client#' + timestamp;
}

/**
* @备份工程文件至 "tags/日期" 文件夹
* @time 2014-3-18 15:20:43
*/
function backupProject(dirname){
    var tagsDirName = 'tags/'+ $.getDay()+'/';
    var tagsDir = gfe.getProjectParentPath(gfe.currentDir) +'/' +tagsDirName;
    var logMsg = '';

    //backup all
    if (typeof(dirname) == 'undefined') {
        f.copy(gfe.currentDir +'/'+ gfe.config.cssDir, tagsDir  + gfe.config.cssDir, null, null, null, null, null, encoding);
        f.copy(gfe.currentDir +'/'+ gfe.config.jsDir, tagsDir +  gfe.config.jsDir, null, null, null, null, null, encoding);
        f.copy(gfe.currentDir +'/'+ gfe.config.widgetDir, tagsDir + gfe.config.widgetDir, null, null, null, null, null, encoding);
        logMsg = gfe.config.cssDir +','+gfe.config.jsDir +','+gfe.config.widgetDir;
    }else {
    //custom backup
        f.copy(gfe.currentDir +'/'+ dirname, tagsDir + dirname, null, null, null, null, null, encoding);
        logMsg = dirname;
    }
    console.log('gfe backup ['+logMsg+'] to "'+ tagsDirName + '" done! ');
}