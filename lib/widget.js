/**
 * @本地widget预览和发布至外端机器
 */
var path = require('path');
var fs = require('fs');

//依赖lib
var $ = require('./base.js');
var f = require('./file.js');
var gfe = require('./gfe.js');
var Server = require('./server.js');
var Openurl = require("./openurl.js");
var FindPort = require('./findPort');

var Node_watch = require('node-watch');

var Client = require('svn-spawn');
var widgetConfig = require("./widgetConfig.js");
var svn = new Client({
    cwd: widgetConfig.svnWidgetPath,
    //username: widgetConfig.username,
    //password: widgetConfig.password,
    noAuthCache: true
});

//exports
var widget = module.exports;

/**
 * @widget path check
 */
widget.pathCheck = function(name) {
    if (typeof(name) == 'undefined') return true;

    /*
    if ( !/^widget\//.test(name) ) {
    	console.log('gfe error widget name format error');
    	return true;
    }*/

    if (!f.exists('widget/' + name)) {
        console.log('gfe error widget path is not exists');
        return true;
    }

    return false;
}

/**
 * @本地预览页面templete
 * @todo: 放在server上控制
 */
widget.templete = function(str, title) {
    if (typeof(str) == 'undefined' || !str) {
        var str = '';
    }

    var css = '';
    gfe.config.widget.css.forEach(function(item) {
        css += '<link rel="stylesheet" type="text/css" href="' + item + '" media="all" />\r\n';
    })

    var js = '';
    gfe.config.widget.js.forEach(function(item) {
        js += '<script type="text/javascript" src="' + item + '"></script>\r\n';
    })

    return '<!DOCTYPE html>' + '\r\n' +
        '<html>' + '\r\n' +
        '<head>' + '\r\n' +
        '<meta charset="utf-8" />' + '\r\n' +
        '<title>' + title + '</title>' + '\r\n' + css + js +
        '</head>' + '\r\n' +
        '<body>' + '\r\n' + str + '\r\n' +
        '</body>' + '\r\n' +
        '</html>';
}

/**
 * @path has "widget" 
 */
widget.hasWidget = function(path) {
    var reg = new RegExp(gfe.config.widgetDir, 'gm');
    return reg.test(path);
}

/**
 * @预览所有widget
 * @example  gfe widget -all
 * @本地所有的widget中tpl,css,js拼装后html文件放在html中
 */
widget.all = function() {
    gfe.bgMkdir();

    var htmlDir = gfe.config.htmlDir;
    f.mkdir(htmlDir);

    var target = htmlDir + '/allwidget.html';

    var widgetDir = f.currentDir() + '/' + gfe.config.widgetDir;
    if (!f.exists(widgetDir)) {
        console.log('gfe error widget not exists');
        return;
    }

    var core = function() {
        var widgetListHtml = '';
        fs.readdirSync(widgetDir).forEach(function(item) {
            if (f.excludeFiles(item)) {
                widgetListHtml += '{%widget name="' + item + '"%}\r\n';
            }
        });

        var result = widget.templete('\r\n' + widgetListHtml, gfe.getProjectPath() + ' - all widget preview');
        f.write(target, result);
    }

    core();
    gfe.argvInit('build', '-open', function() {
        //todo watch
        //core();
        Openurl.open('http://localhost:' + gfe.config.localServerPort + '/' + target);
        console.log('gfe open you broswer to see it');
    },'all'); //因为gfe widget -all预览所有widget不需要更新成最新widget，所以添加'all'参数，不需要(Widget.update)更新最新widget
}

/**
 * @本地预览widget
 * @example  gfe widget -preview widget/header
 * @本地widget中tpl,css,js拼装后html文件放在当前widget中
 */
widget.preview = function(name) {
    gfe.bgMkdir();

    if (widget.pathCheck(name)) {
        return;
    }

    var target = 'widget/' + name;
    var widgetname = name;

    var core = function() {
        var result = widget.templete(null, widgetname);
        fs.readdirSync(target).forEach(function(item) {
            if (item && f.excludeFiles(item)) {
                var itemContent = f.read(target + '/' + item);

                if ($.is.tpl(item) || $.is.vm(item)) {
                    hasTpl = true;
                    itemContent = itemContent;
                    result = $.placeholder.insertBody(result, itemContent);
                }

                if ($.is.css(item)) {
                    result = $.placeholder.insertHead(result, $.placeholder.cssLink(item));
                }

                if ($.is.js(item)) {
                    result = $.placeholder.insertHead(result, $.placeholder.jsLink(item));
                }
            }
        });

        var indexUrl = target + '/' + widgetname + '.html';
        f.write(indexUrl, result);
    }

    core();

    var localServerPort = gfe.config.localServerPort;
    FindPort(localServerPort, function(data) {
        if (!data) {
            console.log('Port ' + localServerPort + ' is tack up');
            localServerPort += 1000;
            gfe.config.localServerPort = localServerPort;
        }

        Server.init(target + '/', gfe.config.localServerPort);
        Openurl.open('http://localhost:' + gfe.config.localServerPort + '/' + widgetname + '.html');
        console.log('gfe open you broswer to see it!');

        //监听
        Node_watch(target, function(widgetname) {
            core();
        });
    });
}

/**
 * @更新svn
 * @time 2016-8-12
 */
widget.svnUpdate = function(callback) {
    svn.update(function(err, data) {
        callback && callback();
    });
}

/**
 * @SVN版
 * @取得所有widget的列表
 * @time 2016-8-10 11:04:00
 */
widget.list = function() {
    svn.getInfo(function(err, data) {
        console.log('gfe widget list: ');
        console.log('----------------');
        svn.cmd(['list',data.url],function(err,data){
        });
    });
}

/**
 * @SVN版
 * @下载widget到当前项目文件夹
 * @example  gfe widget -install widgetName
 * @time 2016-8-10
*/
widget.install = function(name,version){
    var _this = this;
    _this.svnUpdate(installFn);
    function installFn(){
        var widgetDir = process.cwd()+"\\widget";

        if(f.isDir(widgetDir)){
            if(!version){
                noVersion();
            }
            if(version){
                hasVersion();
            }
        }

        function noVersion(){
            if(f.exists(widgetDir+"\\"+name)){
                console.log('gfe warnning widget [' + name + '] is exists in current project!');
            }else{
                var sourcePath = widgetConfig.svnWidgetPath+"\\"+name;

                if(f.exists(sourcePath)){
                    copyWidget(sourcePath);
                }else{
                    console.log('gfe warnning widget [' + name + '] is not exists on svn server!');
                }

                function copyWidget(sourcePath){
                    widgetDir = widgetDir+"/"+name;
                    f.mkdir(widgetDir);
                    var maxVersion = '1.0.0';
                    if(f.isDir(sourcePath)){
                        fs.readdirSync(sourcePath).forEach(function(item){
                            maxVersion = item;
                        });
                        sourcePath = sourcePath+"\\"+maxVersion;
                        f.copy(sourcePath,widgetDir);
                        console.log('gfe widget [' + name +' : '+ maxVersion + '] install done from server!');
                    }
                }
            }
        }

        function hasVersion(){
            var currentVersion;
            if(f.exists(widgetDir+"\\"+name)){
                var wContent = f.read(widgetDir+"\\"+name+"\\component.json",'utf8');
                currentVersion = JSON.parse(wContent).version;
            }

            if(currentVersion == version){
                console.log('gfe warnning widget [' + name + ' : ' + version + '] is exists in current project!');
            }else{
                var sourcePath = widgetConfig.svnWidgetPath+"\\"+name+"\\"+version;

                if(f.exists(sourcePath)){
                    copyWidget(sourcePath);
                }else{
                    console.log('gfe warnning widget [' + name + ' : ' + version + '] is not exists on svn server!');
                }

                function copyWidget(sourcePath){
                    widgetDir = widgetDir+"/"+name;
                    f.del(widgetDir,function(){
                        f.mkdir(widgetDir);
                        if(f.isDir(sourcePath)){
                            f.copy(sourcePath,widgetDir);
                            console.log('gfe widget [' + name+' : '+ version  + '] install done from server!');
                        }
                    });
                }
            }
        }
    }
}

/**
* @判断给定widget是否存在于本地项目widget中
* @只是内部方法，供widget其它函数自己使用
* @time 2016-8-10
*/
widget.isIn = function(widget,widgets){
    var inw = false;
    widgets.forEach(function(item){
        if(item==widget){
            inw = true;
            return;
        }
    });
    return inw;
}

/**
 * @更新所有widget
 * @判断本地项目中widget哪些是存在于服务器上的，再判断当前widget是否是最新版本，如果不是则更新到最新版本
*/
widget.update = function(callback){
    var _this = this;
    _this.svnUpdate(updateFn);
    function updateFn(){
        //获取服务器所有widget
        var widgets = [];
        if(f.exists(widgetConfig.svnWidgetPath)){
            fs.readdirSync(widgetConfig.svnWidgetPath).forEach(function(item){
                widgets.push(item);
            });
        }
        
        var widgetDir = process.cwd()+"/widget";
        var sourcePath,targetPath,wname,maxVersion,currentVersion,dirList,nWidgets=[],updateMsg=[];

        if(f.isDir(widgetDir)){
            fs.readdirSync(widgetDir).forEach(function(name){
                wname = name;
                var inWidgets = _this.isIn(name,widgets);
                if(inWidgets){
                    fs.readdirSync(widgetConfig.svnWidgetPath+"/"+name).forEach(function(item){
                        nWidgets.push(item);
                    });
                    maxVersion = nWidgets[nWidgets.length-1]; //根据版本号规律，获取出来的数组最后一个就是最新的版本号,目前没发现任何问题，如有问题可用getListMax方法
                    sourcePath = widgetConfig.svnWidgetPath+"\\"+name+"\\"+maxVersion;
                    targetPath = process.cwd()+"\\widget\\"+name;
                    var fileList = [];
                    targetPath = targetPath.replace(/\\/g,'/');
                    sourcePath = sourcePath.replace(/\\/g,'/');
                    fs.readdirSync(targetPath).forEach(function(filename){ //查看widget是否是空文件夹
                        fileList.push(filename);
                    });
                    var targetJson = targetPath+'\\component.json';
                    targetJson = targetJson.replace(/\\/g,'/');
                    if(f.exists(targetJson)){
                        var targetPathCon = f.read(targetJson,'utf8');
                        currentVersion = JSON.parse(targetPathCon).version;
                        if(currentVersion!=maxVersion){
                            f.del(targetPath,function(){
                                f.mkdir(targetPath);
                                f.copy(sourcePath,targetPath);
                                updateMsg.push("gfe widget ["+wname+"] update to version ["+maxVersion+"].");
                            });
                        }
                    }
                    if(fileList.length==0){ //widget是空文件夹，则从服务器更新最新版本widget
                        f.del(targetPath,function(){
                            f.mkdir(targetPath);
                            f.copy(sourcePath,targetPath);
                            updateMsg.push("gfe widget ["+wname+"] update to version ["+maxVersion+"].");
                        });
                    }
                }
            });
        }
        callback && callback();
        if(updateMsg.length>0){
            updateMsg.forEach(function(item){
                console.log(item);
            });
        }
        console.log('gfe all the widget are latest version!');

        function getListMax(widgetVersions){ //把['1.0.0','1.0.1','1.0.2','1.0.3']这种的数组找出最大的版本号
            var newList = [];
            widgetVersions.forEach(function(item){
                var num = parseInt(item.split('.').join(''));
                newList.push(num);
            });
            var maxNum = Math.max.apply(null,newList);
            return maxNum;
        }
    } 
}

/**
 * @更新所有widget
 * @删除从服务器安装的widget，再copy一份widget中的最新版本到本地
*/
widget.updateBak = function(callback){
    var _this = this;
    _this.svnUpdate(updateFn);
    function updateFn(){
        //获取服务器所有widget
        var widgets = [];
        fs.readdirSync(widgetConfig.svnWidgetPath).forEach(function(item){
            widgets.push(item);
        });
        var widgetDir = process.cwd()+"/widget";
        var sourcePath,targetPath,maxVersion,dirList,nWidgets=[];
        if(f.isDir(widgetDir)){
            fs.readdirSync(widgetDir).forEach(function(name){
                var inWidgets = _this.isIn(name,widgets);
                if(inWidgets){
                    fs.readdirSync(widgetConfig.svnWidgetPath+"/"+name).forEach(function(item){
                        nWidgets.push(item);
                    });
                    maxVersion = nWidgets[nWidgets.length-1]; //根据版本号规律，获取出来的数组最后一个就是最新的版本号,目前没发现任何问题，如有问题可用getListMax方法
                    sourcePath = widgetConfig.svnWidgetPath+"\\"+name+"\\"+maxVersion;
                    targetPath = process.cwd()+"\\widget\\"+name;

                    dirList = fs.readdirSync(targetPath);
                    dirList.forEach(function(fileName){
                        fs.unlinkSync(targetPath+ "\\" + fileName);
                    });
                    f.copy(sourcePath,targetPath);

                    // f.del(targetPath,function(){
                    //     f.mkdir(targetPath);
                    //     f.copy(sourcePath,targetPath);
                    //     callback && callback();
                    // });
                }
            });
        }

        callback && callback();
        console.log("gfe widget updata success!");

        function getListMax(widgetVersions){ //把['1.0.0','1.0.1','1.0.2','1.0.3']这种的数组找出最大的版本号
            var newList = [];
            widgetVersions.forEach(function(item){
                var num = parseInt(item.split('.').join(''));
                newList.push(num);
            });
            var maxNum = Math.max.apply(null,newList);
            return maxNum;
        }
    }
}

/**
 * @widget相关配置文件
 * @svnWidgetPath: 配置svn widget所在本地路径
 * @userName: svn用户名
 * @password: svn密码
*/
widget.config = function(){
    console.log('gfe widget config tips: input widget config');
    var Prompt = require('simple-prompt');
    var questions = [{
        question: 'path',
        required: true
    }];
    var profile = new Prompt(questions);
    profile.create().then(function(error, answers) {
        if (error) {
            return;
        }

        answers.path = answers.path.replace(/(^\s+)|(\s+$)/g, "");
        answers.path = '"'+answers.path+'"';
        if(answers.path.indexOf('\\')!=-1){
            answers.path = answers.path.split('\\');
            answers.path = answers.path.join('/');
        }
        if (answers.path != '') fillIn();

        function fillIn(){
            var str = 'module.exports = {"svnWidgetPath":'+answers.path+'}';
            f.write(__dirname+'\\'+'widgetConfig.js',str,'utf-8');
        }
    });
}

/**
 * @根据关键字搜索所有widget
 * @time 2014-3-14 14:50:29
 */
widget.search = function(name) {

}


/**
 * @widget自动生成目录
 * @time 2014-6-23 11:04:00
 */
widget.create = function(name) {
    var widgetDir = 'widget/' + name;
    if (f.exists(widgetDir)) {
        console.log('gfe warnning : widget [' + name + '] is exists');
        return;
    }

    console.log('gfe tips: if you create it, input "y" else input "n" ');
    var Prompt = require('simple-prompt');
    var questions = [{
        question: 'vm',
        required: true
    }, {
        question: 'js'
    }, {
        question: 'css'
    }, {
        question: 'json'
    }];
    var profile = new Prompt(questions);
    profile.create().then(function(error, answers) {
        if (error) {
            return;
        }
        var createFilesArray = ['component.json'];
        if (answers.vm == 'y') createFilesArray.push(name + '.vm');
        if (answers.js == 'y') createFilesArray.push(name + '.js');
        if (answers.css == 'y') createFilesArray.push(name + '.css');
        if (answers.json == 'y') createFilesArray.push(name + '.json');

        f.mkdir(widgetDir);
        //gfe.config.widget.createFiles
        createFilesArray.forEach(function(item) {
            f.write(widgetDir + '/' + item, '');
        });

        //给compoent.json写入默认的内容
        var componentJson = '{\r\n' +
            '	"name": "' + name + '",\r\n' +
            '	"version": "1.0.0",\r\n' +
            '	"dependencies": {}\r\n' +
            '}';
        f.write(widgetDir + '/component.json', componentJson);

        console.log('gfe widget [' + name + '] create done!');
    });
}
