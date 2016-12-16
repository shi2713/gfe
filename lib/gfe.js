/**
 * @gfe
 */
var path = require('path');
var fs = require('fs');
var util = require('util');
var exec = require('child_process').exec;
var EventEmitter = require('events').EventEmitter;

//lib自身组件
var $ = require('./base.js');
var f = require('./file.js');
var Server = require('./server.js');
var Compress = require('./compress.js');
var Openurl = require("./openurl.js");
var Widget = require("./widget.js");
var Config = require("./config.js");
var Log = require("./log.js");
var BuildCss = require("./buildCss.js");
var BuildWidget = require("./buildWidget.js");
var BuildES6 = require('./buildES6.js');
var Output = require("./output.js");
var FindPort = require('./findPort');
var FileLint = require('./fileLint');
var FileFormat = require('./fileFormat');
var FtpUpload = require('./ftpUpload');

//外部组件
var Node_watch = require('node-watch');
var Livereload = require('./livereloadServer');

//define
var gfe = module.exports;

/**
 * @配置项
 */
gfe.config = Config;

/**
 * @commoder help
 */
gfe.help = function() {
    var content = [];
    content = content.concat([
        '',
        '  Usage: gfe <Command>',
        '',
        '  Command:',
        '',
        // '    install      install init dir, demo',
        '    init         project directory init',
        '    build        build project',
        '      -uat       auto add uat CDN (-uat/-pre/-prd)',
        '      -open      auto open html/index.html ',
        '      -combo     combo debug for online/RD debug',
        '      -css       compile less/scss file in current dir',
        '      -plain     output project with plain',
        '',
        // '    release      release project',
        '',
        '    output       output project',
        '      -uat       output CDN from uat (-uat/-pre/-prd)',
        '      -all       output project (include html/onlyCopy) ',
        '      -rjs       output project based requirejs',
        '      dirname    output your own custom dirname',
        '      -debug     uncompressed js,css,images for test',
        '      -backup    backup outputdir to tags dir',
        '      -path [p]  replace projectPath to specified path option',
        '',
        // '    upload       upload css/js dir to remote sever',
        //'    -html      upload output project (include html) ',
        // '      dirname    upload output your own custom dirname',
        // '      -debug     uncompressed js,css,images for test',
        // '      -preview   upload html dir to preview server dir',
        // '      -nc        upload css/js dir to preview server dir use newcdn url',
        // '      -nh        upload html dir to preview server dir use newcdn url',
        // '      -custom    upload a dir/file to server',
        // '      -list      upload file list from config.json to server',
        '',
        '    widget',
        '      -all       preview all widget',
        '      -list      get widget list from server',
        '      -preview xxx  preview a widget',
        '      -install xxx  install a widget to local',
        // '      -publish xxx  publish a widget to server',
        '      -create xxx   create a widget to local',
        //'    -w    watch upload output files to remote sever',
        '',
        '    server       debug for online/RD debug',
        '    svn tag xxx  project automatically svn tag',
        '    lint         file lint',
        '    format       file formater',
        ' ',
        '  Extra commands:',
        '',
        '    compress     compress js/css (gfe compress input output)',
        '    clean        clean cache folder',
        '    -h           get help information',
        '    -v           get the version number',
        ''
    ]);
    console.log(content.join('\n'));
}

/**
 *@svn自动打tag 
 *@gfe svn tag 1.0.0
*/
gfe.svnTag = function(version){ 
    //svn copy svnTrunk svnTag -m '110156:顶通会员等级更新调整:channel_web'
    var E = new EventEmitter();
    // var msg = " -m 110156:顶通会员等级更新调整:channel_web";
    var msg = " -m 113099:gfe-auto-tag:image";
    var content = fs.readFileSync(process.cwd()+"\\"+gfe.config.configFileName,'utf8');
    content = JSON.parse(content);
    var projectName = content.projectName;
    
    var svnTrunk = gfe.config['svnPath'].trunk;
    var svnTag = gfe.config['svnPath'].tag;

    var commandMkdirP = "svn mkdir "+svnTag+"/"+projectName+msg;
    var commandMkdirV = "svn mkdir "+svnTag+"/"+projectName+"/"+version+msg;
    var commandCopy = "svn copy "+svnTrunk+"/"+projectName+" "+svnTag+"/"+projectName+ "/"+version+msg;
    var commandDelete = "svn delete "+svnTag+"/"+projectName+"/"+version+msg;
    var svnMsg = 'gfe svn tag success!';

    exec(commandMkdirP,function(err){
        if(!err){
            exec(commandCopy,function(err){
                if(err){
                    console.log(err);
                }else{
                    console.log(svnMsg);
                };
            });
        }else{
            exec(commandDelete,function(err){
                if(!err){
                    exec(commandCopy,function(err){
                        if(err){
                            console.log(err);
                        }else{
                            console.log(svnMsg);
                        };
                    });
                }else{
                    exec(commandCopy,function(err){
                        if(err){
                            console.log(err);
                        }else{
                            console.log(svnMsg);
                        };
                    });
                };
            });
        };
    });
}

/**
* @gfe build -pre -open时引用gomeprelive服务器的资源，uat和默认引用atguat服务器的资源
*/


/**
 * @总的初始化函数 from ../index.js
 * @commander
 */
gfe.init = function(argv) {
    //设置全局时间戳
    gfe.config.suffix = $.getTimestamp();

    //读取配置文件
    gfe.getConfig(function(configData) {
        var cmd2 = argv[2];
        gfe.currentDir = f.currentDir();

        if (argv.length < 3 || cmd2 === '-h' || cmd2 === '--help') {
            Log.send('help');
            gfe.help();

        }else if(cmd2==="svn" && argv[3]==="tag"){
            Log.send('svn tag');
            var version = argv[4];
            gfe.svnTag(version);
        } else if (cmd2 === '-v' || cmd2 === '--version') {
            Log.send('version');
            gfe.version();

        } else if (cmd2[0] === '-') {
            Log.send('help');
            gfe.help();

        } else if (cmd2 === 'b' || cmd2 === 'build') {
            Log.send('build');
            var cmd3 = argv[3];
            if(cmd3=="-pre"){
                gfe.env = "www.gomeprelive.com.cn";
            }else if (cmd3=="-prd"){
                gfe.env = "www.gome.com.cn";
            }else{
                gfe.env = 'www.atguat.com.cn';
            }
            gfe.argvInit('build', argv);

        } else if (cmd2 === 'r' || cmd2 === 'release') {
            Log.send('release');
            gfe.argvInit('release', argv);

        } else if (cmd2 === 'o' || cmd2 === 'output') {
            Log.send('output');
            gfe.argvInit('output', argv);

        } else if (cmd2 === 'u' || cmd2 === 'upload') {
            Log.send('upload');
            FtpUpload.init(argv, configData);

        } else if (cmd2 === 'i' || cmd2 === 'init') {            
            Log.send('install-init');
            gfe.install('init', argv[3]);

        } else if (cmd2 === 'c' || cmd2 === 'compress') {
            Log.send('compress');
            Compress.dir(argv[3], argv[4]);

            //widget
        } else if (cmd2 === 'w' || cmd2 === 'widget') {
            var cmd3 = argv[3],
                cmd4 = argv[4],
                cmd5 = argv[5];
            var force = cmd5 != 'undefined' && cmd5 == '-force' ? true : false

            if (cmd3 == '-all' || cmd3 == '-a') {
                Log.send('widget-all');
                Widget.all(cmd4);
            }

            if (cmd3 == '-list' || cmd3 == '-l') {
                Log.send('widget-list');
                Widget.list(cmd4);
            }

            if(cmd3 == '-update' || cmd3 == '-u'){
                Log.send('widget-update');
                Widget.update();
            }

            if(cmd3 == '-config'){
                Log.send('widget-config');
                Widget.config();
            }

            var hasCmd4 = function() {
                if (cmd4) {
                    return true;
                } else {
                    console.log('gfe tips [gfe.init] Please input widget name');
                    return false;
                }
            }

            var widgetCmd = function() {
                var content = [];
                content = content.concat([
                    '',
                    '  Command:',
                    '',
                    '    widget',
                    '      -all     preview all widget',
                    '      -list    get widget list from server',
                    '      -preview xxx     preview a widget',
                    '      -install xxx     install a widget to local',
                    // '      -publish xxx     publish a widget to server',
                    '      -create  xxx     create a widget to local',
                    ''
                ]);
                console.log(content.join('\n'));
            }

            if (cmd3) {
                if (cmd3 == '-preview' || cmd3 == '-pre' && hasCmd4()) {
                    Log.send('widget-preview');
                    Widget.preview(cmd4);

                } else if (cmd3 == '-install' || cmd3 == '-i' && hasCmd4()) {
                    Log.send('widget-install');
                    Widget.install(cmd4, cmd5);

                } else if (cmd3 == '-publish' || cmd3 == '-p' && hasCmd4()) {
                    Log.send('widget-publish');
                    Widget.publish(cmd4, force);

                } else if ((cmd3 == '-create' || cmd3 == '-c') && hasCmd4()) {
                    Log.send('widget-create');
                    Widget.create(cmd4);

                }
            }

            if (!cmd3) {
                widgetCmd();
            }

            //extra commands
            //server
        } else if (cmd2 === 'server') {
            Log.send('server');
            Server.init('./', gfe.config.localServerPort, gfe.config.cdn, gfe.getProjectPath(), true);
            console.log('gfe server running at http://localhost:' + gfe.config.localServerPort + '/');

            //file lint
        } else if (cmd2 === 'lint' || cmd2 === 'l') {
            var cmd3 = argv[3];
            var filename = (typeof(cmd3) == 'undefined') ? f.currentDir() : cmd3;
            Log.send('file lint');
            FileLint.init(filename);

            //file format
        } else if (cmd2 === 'format' || cmd2 === 'f') {
            var cmd3 = argv[3];
            var filename = (typeof(cmd3) == 'undefined') ? f.currentDir() : cmd3;
            Log.send('file format');
            FileFormat.init(filename);

            //clean 
        } else if (cmd2 === 'clean') {
            Log.send('clean');
            gfe.clean();

            //todo: beautiful/jsbin/
        } else {
            console.log('gfe error [gfe.init] invalid option: ' + cmd2 + ' \rType "gfe -h" for usage.');
        }
    });
};
/**
 * @输入命令的初始化 build, release, output
 */
gfe.argvInit = function(runType, argv, callback,all) {
    if (runType == 'build' || runType == 'release') {
        if(gfe.config.widgetAutoUpdate && all==undefined){
            Widget.update(function(){
                buildFn();
            });
        }else{
            buildFn();
        }
        
        function buildFn(){
            if (runType == 'build' && typeof(argv[3]) != 'undefined' && argv[3] == '-css') {
                gfe.buildCss();
            } else {
                var autoOpenurl = false,
                    comboDebug = false;
                if (typeof(argv[3]) != 'undefined') {
                    if (argv[3] == '-open' || argv[3] == '-o') autoOpenurl = true;
                    if (argv[3] == '-combo' || argv[3] == '-c') comboDebug = true;
                    if ( (argv[3] == 'uat' || argv[3] == 'prd' || argv[3] == 'pre') 
                        || ( argv[4]=='-open' || argv[4]=='-o') ){
                        autoOpenurl = true;
                    }
                }

                gfe.bgMkdir();
                gfe.bgCopyDir();
                gfe.buildMain(runType, argv[3] || argv[4]);

                //plain mode
                if(argv[3] == '-plain' || argv[4] == '-plain'){
                    var outputdirName = gfe.config.outputDirName;
                    var outputdir = outputdirName+'/'+gfe.getProjectPath();
                    f.copy(gfe.bgCurrentDir, outputdir);

                    console.log('gfe build plain success!');
                }else{
                    console.log("at precess:<<"+process.pid+">>");

                    gfe.server(autoOpenurl, comboDebug, function(data) {
                        gfe.watch(runType, callback, data);
                    });
                }
            }
        }
        
    } else if (runType == 'output') {
        // gfe.bgMkdir();
        // var _bgdir=gfe.bgCurrentDir+"_"+Math.random();
        // f.renameFile(gfe.bgCurrentDir,_bgdir);
        // console.log(_bgdir);
        // f.delAsync(_bgdir);
        // f.mkdir(gfe.bgCurrentDir);
        if(gfe.config.widgetAutoUpdate){
            Widget.update(function(){
                outputFn();
            });
        }else{
            outputFn();
        }

        function outputFn(){
            gfe.bgMkdir();
            f.del(gfe.bgCurrentDir, function() {
                gfe.bgCopyDir();
                gfe.buildMain(runType);
                //默认
                var outputType = 'default',
                    projectPath = null,
                    outputOnlyCopyList = null,
                    outputList, isbackup = false,
                    isdebug = false;

                if (typeof(argv[3]) != 'undefined') {
                    var cmd3 = argv[3];
                    var cmd4 = argv[4];

                    //custom自定义
                    outputType = 'custom';
                    outputList = cmd3;

                    //projectPath自定义
                    if (cmd3 == '-path') {
                        projectPath = cmd4;
                        outputType = 'default';
                    }

                    //debug(不压缩)
                    if (cmd3 == '-debug' || cmd4 == '-debug') {
                        isdebug = true;
                        if (!cmd4) outputType = 'default';
                    }

                    //all
                    if (cmd3 == '-all' || cmd4 == '-all') {
                        outputType = 'all';
                        outputList = null;
                        //按配置项来输出 额外输出
                        if (gfe.config.outputOnlyCopy) {
                            outputOnlyCopyList = gfe.config.outputOnlyCopy;
                        }
                    }

                    //自定义静态资源cdn，默认输出为all格式
                    if ( (cmd3 == '-uat' || cmd3 == '-pre' || cmd3 == '-prd') && cmd4 == '-all') {
                        outputType = 'all';
                        outputList = null;
                    }

                    if ( (cmd3 == '-uat' || cmd3 == '-pre' || cmd3 == '-prd') && cmd4 == undefined) {
                        outputType = 'default';
                        outputList = null;
                    }

                    //backup
                    if (cmd3 == '-backup' || cmd4 == '-backup') {
                        outputType = 'backup';
                        isbackup = true;
                        if (cmd4 == '-backup') {
                            outputType = 'custom';
                            outputList = cmd3;
                        }
                    }

                    //r.js
                    if(cmd3 == '-rjs' || cmd4 == '-rjs'){
                        outputType = 'default';
                        gfe.config.output.rjs = true;
                    }

                    
                } else {
                    //按配置项来输出 自定义输出
                    if (gfe.config.outputCustom) {
                        outputType = 'custom';
                        outputList = gfe.config.outputCustom;
                    }
                    //按配置项来输出 额外输出
                    if (gfe.config.outputOnlyCopy) {
                        outputOnlyCopyList = gfe.config.outputOnlyCopy;
                    }
                }

                try {
                    Output.init({
                        type: outputType,
                        list: outputList,
                        onlyCopyList: outputOnlyCopyList,
                        projectPath: projectPath,
                        isbackup: isbackup,
                        isdebug: isdebug,
                        callback: callback
                    });
                } catch (e) {
                    console.log(e);
                }
            });
        }
    }

}

/**
 * @读取gfe version
 */
gfe.version = function() {
    var package = require('../package.json');
    console.log(package.version);
}

/**
 * @读取配置文件config.json, 覆盖默认配置
 */
gfe.getConfig = function(callback) {
    var res = null;
    var url = f.currentDir() + '/' + gfe.config.configFileName;
    if (f.exists(url)) {
        try {
            var data = f.read(url);
            if (data) {
                data = JSON.parse(data);
                if (typeof(data) == 'object') {
                    data = $.merageObj(gfe.config, data);
                }
                //console.log(data);
                res = data;
            }
            if (callback) callback(res);
        } catch (e) {
            console.log('gfe error [gfe.getConfig] - config.json format error');
            console.log(e);
            if (callback) callback(res);
        }
    } else {
        if (callback) callback(res);
    }
}

/**
 * @工程后台文件夹生成
 * @gfe.bgCurrentDir 为后台文件根目录
 */
gfe.bgMkdir = function() {

    var list = ['LOCALAPPDATA', 'HOME', 'APPDATA'];
    var temp;
    for (var i = 0, len = list.length; i < len; i++) {
        if (temp = process.env[list[i]]) {
            break;
        }
    }
    if (temp) {
        temp = temp || __dirname + '/../';
        temp += '/.gfe-temp/';
        temp = path.normalize(temp);
        f.mkdir(temp);

        //创建文件夹
        var creatDir = function(filename) {
            var dir = path.normalize(temp + '/' + filename + '/');
            f.mkdir(dir);
            gfe[filename + 'Dir'] = dir;
        };

        //项目缓存文件夹
        creatDir('cache');
        //项目temp文件夹
        creatDir('temp');
        //项目lib文件夹
        creatDir('lib');

        creatDir('backup');

        //复制当前项目至temp文件夹(除outputdir)
        //取得当前工程名
        var currentDirName = path.basename(gfe.currentDir);
        gfe.bgCurrentDir = path.normalize(gfe.tempDir + '/' + currentDirName);

        gfe.bgCurrentDirName = currentDirName;
        f.mkdir(gfe.bgCurrentDir);
    }
}
/**
 * @复制当前项目至工程后台目录
 * @仅copy app,html,widget, config文件
 */
gfe.bgCopyDir = function() {
    if (gfe.config.baseDir != '' || gfe.config.outputCustom || gfe.config.outputOnlyCopy) {
        f.copy(gfe.currentDir + '/' + gfe.config.baseDir, gfe.bgCurrentDir + '/' + gfe.config.baseDir);
    }

    f.copy(gfe.currentDir + '/' + gfe.config.cssDir, gfe.bgCurrentDir + '/' + gfe.config.cssDir);
    f.copy(gfe.currentDir + '/' + gfe.config.imagesDir, gfe.bgCurrentDir + '/' + gfe.config.imagesDir);
    f.copy(gfe.currentDir + '/' + gfe.config.jsDir, gfe.bgCurrentDir + '/' + gfe.config.jsDir);

    f.copy(gfe.currentDir + '/' + gfe.config.htmlDir, gfe.bgCurrentDir + '/' + gfe.config.htmlDir);
    f.copy(gfe.currentDir + '/' + gfe.config.dataDir, gfe.bgCurrentDir + '/' + gfe.config.dataDir);
    f.copy(gfe.currentDir + '/' + gfe.config.widgetDir, gfe.bgCurrentDir + '/' + gfe.config.widgetDir);
    f.copy(gfe.currentDir + '/' + gfe.config.configFileName, gfe.bgCurrentDir + '/' + gfe.config.configFileName);

}

/**
 * @屏幕打点器
 * @time 2014-3-14 07:08
 * @example
 *  begin: gfe.dot.begin()  end: gfe.dot.end();
 */
gfe.dot = {
    timer: null,
    begin: function() {
        this.date = new Date();
        process.stdout.write('.');
        this.timer = setInterval(function() {
            process.stdout.write('.');
        }, 1000);
    },
    end: function(haslog) {
        var haslog = typeof(haslog) == 'undefined' ? true : haslog;
        if (this.timer) {
            var date = new Date();
            clearInterval(this.timer);
            if (haslog) {
                console.log('\r\ngfe spend ' + (date - this.date) / 1000 + 's');
            } else {
                console.log();
            }
        }
    }
}

/**
 * @从服务器端下载文件 todo:检查版本号
 */
gfe.download = function(pathItem, targetDir) {
    var url = gfe.config[pathItem];
    var cacheDir = path.normalize(gfe.cacheDir + '/' + pathItem + '.tar');

    console.log('gfe downloading');
    gfe.dot.begin();

    f.download(url, cacheDir, function(data) {
        if (data == 'ok') {
            f.tar(cacheDir, targetDir, function() {
                console.log('\r\ngfe [' + pathItem + '] install done');
                gfe.dot.end(false);
            });
        } else if (data == 'error') {
            gfe.dot.end(false);
        }
    })
}

/**
 * @从服务器端下载demo 或其它文件
 */
gfe.install = function(type, dir) {
    gfe.bgMkdir();

    /**
    widget模块安装走gfe widget -install widget/header
    console.log('gfe downloading');
    */
    gfe.createStandardDir(dir);
}

/**
* @服务器
* @param {Boolse}  
    autoOpenurl true: html/index.html存在的话则打开, 不存在打开 http://localhost:3000/
    autoOpenurl false: 只启动不打开网页
* @param {Boolse}  comboDebug 联调/线上调试模式
*/
gfe.server = function(autoOpenurl, comboDebug, callback) {
    var localServerPort = gfe.config.localServerPort;
    FindPort(localServerPort, function(data) {
        if (!data) {
            console.log('findPort : Port ' + localServerPort + ' has used');
            localServerPort = (localServerPort - 0) + 1000;
            gfe.config.localServerPort = localServerPort;
        }
        
        Server.init( gfe.bgCurrentDir, localServerPort, gfe.config.cdn, gfe.getProjectPath(), comboDebug, Compress.addJsDepends );

        if (typeof(autoOpenurl) != 'undefined' && autoOpenurl) {
            var homepageFtl = '/' + gfe.config.htmlDir + '/index.ftl';
            var homepageHtm = '/' + gfe.config.htmlDir + '/index.html';
            if (!f.exists(gfe.currentDir + homepageFtl) && !f.exists(gfe.currentDir + homepageHtm)) {
                homepage = '';
            }else if (f.exists(gfe.currentDir + homepageFtl)){
                homepage = homepageFtl;
            }else {
                homepage = homepageHtm;
            };
            gfe.openurl('http://localhost:' + localServerPort + '/' + homepage);
        }

        console.log('gfe server running at http://localhost:' + localServerPort + '/');
        if (callback) callback(data);
    });
}

/**
 * @检测路径是否为项目文件夹内路径 即 baseDir htmlDir widgetDir configFile
 * @param {String} filename 文件路径
 */
gfe.checkProjectDir = function(filename) {
    var dirname = filename.replace(gfe.currentDir, '');
    dirname = dirname.replace(/\\/, '');
    if (/^\//.test(dirname)) dirname = dirname.replace(/\//, '');

    var checkTag = false;
    var checkProjectDir = function(i, j) {
        var reg = new RegExp('^' + i);
        if (reg.test(j)) {
            return true;
        } else {
            return false;
        }
    }

    if (checkProjectDir(gfe.config.baseDir, dirname) || checkProjectDir(gfe.config.htmlDir, dirname) || checkProjectDir(gfe.config.widgetDir, dirname) || checkProjectDir(gfe.config.configFileName, dirname)) {
        checkTag = true;
    }
    return checkTag;
}

/**
 * @watch && Livereload
 * @复制有变动的文件
 */
gfe.watch = function(type, callback, data) {
    if (!data) {
        //如果有另外一个进程那么livereload会直接关闭
        gfe.config.build.livereload = false;
        //console.log("another gfe process running , gfe livereload closed"); 
    }

    //livereload
    if (gfe.config.build.livereload) Livereload.init();

    var regStr = '\\.(vm|tpl|ftl|shtml|html|smarty|js|css|less|sass|scss|json|babel|' + $.imageFileType() + ')$';
    var reg = new RegExp(regStr);

    //todo初始化时前后台文件夹同步
    Node_watch(gfe.currentDir, function(filename) {
        //文件过滤
        if (f.isFile(filename)) {
            if (!reg.test(filename)) return;
        }

        var target = gfe.bgCurrentDir + filename.replace(gfe.currentDir, '');
        if (gfe.checkProjectDir(filename)) {
            if (f.exists(filename)) {
                f.copy(filename, target, regStr);
                //build
                gfe.buildMain(type);
                //livereload
                if (gfe.config.build.livereload) Livereload.reloadBrowser([target]);
                if (callback) callback(filename);
            } else {
                f.del(target, function() {
                    if (callback) callback(filename);
                });
            }
        }
    });

    if (callback) callback();
}

/**
 * @openurl
 * @todo : 仅打开一次
 */
gfe.openurl = function(url) {
    if (typeof(url) == 'undefined') {
        var url = "http://localhost:3000/html/index.html";
    }
    Openurl.open(url);
}

/**
* @自动刷新
* @todo

    gfe.refresh = function(){
            
    }
*/

/**
 * @获取当前项目父级目录
 * @1. d:\product\index\trunk ===> d:\product/index
 * @2. d:\product\index\branches\homebranches ===> d:\product/index
 * @3. d:\product\index\homebranches ===> d:\product
 */
gfe.getProjectParentPath = function(currentDir) {
    var nowDir = '';
    if (/branches/.test(currentDir)) {
        nowDir = path.resolve(currentDir, '../', '../');
    } else if (/trunk/.test(currentDir)) {
        nowDir = path.resolve(currentDir, '../');
    }
    return nowDir;
}

/**
 * @获取项目前缀名字
 * @仅从配置文件中取,不再支持branch/trunk 2014-5-24
 * @del --> 1. d:\product\index\trunk ===> product/index
 * @del --> 2. d:\product\index\branches\homebranches ===> product/index
 * @del --> 3. d:\product\index\homebranches ===> product
 */
gfe.getProjectPath = function() {
    var currentDir = f.currentDir(),
        nowDir = '',
        result = '';
    if (gfe.config.projectPath != null) {
        result = gfe.config.projectPath;
    } else {
        //当前文件夹的文件夹命名为projectPath 2014-6-9
        result = path.basename(f.currentDir());
        /*
        nowDir = gfe.getProjectParentPath(currentDir);
        
        if (nowDir) {
            nowDir = nowDir.split(path.sep);
            var nowDirArrayLength = nowDir.length;
            result = nowDir[nowDirArrayLength-2] +'/'+ nowDir[nowDirArrayLength-1];
        }*/
    }
    return result;
}



/**
 * @当含有j/m模块时写放当前文件一次*/
var writeJMOnce = false;


/**
 * @build widget, css(sass, less)
 */
gfe.buildMain = function(type, param) {
    var builddir = '/' + gfe.config.buildDirName + '/';
    var basedir = gfe.currentDir + builddir;
    var encoding = gfe.config.output.encoding;
    
    //build css
    BuildCss.init(gfe.config.cssDir, gfe.bgCurrentDir + '/' + gfe.config.cssDir);
    BuildCss.init(gfe.config.widgetDir, gfe.bgCurrentDir + '/' + gfe.config.widgetDir);

    //build -> html/ .ftl && .html (.gfe-temp)
    if (f.exists(basedir)) {
        var basedirlist = f.getdirlist(basedir, '.html$');
        var basedirlist2 = f.getdirlist(basedir, '.ftl$');
        basedirlist = basedirlist.concat(basedirlist2);

        basedirlist.forEach(function(source) {
            var target = path.normalize(gfe.bgCurrentDir + builddir + source.replace(basedir, ''));

            BuildWidget.init(source, f.read(source), type, function(data) {
                if(f.excludeFiles(target)){
                    f.write(target, data.tpl, encoding);

                    //output时开启debug，需要输出一份debug模板，例如：/path/to/file/xxx.html=>/path/to/file/xxx-debug.html
                    if(gfe.config.output.debug && data.debugTpl){
                        var targetExtname = path.extname(target);
                        var targetBasename = path.basename(target,targetExtname);
                        var targetDirname = path.dirname(target);
                        var debugTarget = path.join(targetDirname,targetBasename + '-debug'+targetExtname);
                        f.write(debugTarget, data.debugTpl, encoding);
                    }
                }

                if (writeJMOnce) {
                    f.write(source, data.origin, encoding);
                }
                return 'ok';

            }, param);
        });
    }
    if(gfe.config.build.csslint){
        FileLint.init(path.join(process.cwd(),gfe.config.cssDir));
    }

    // build ES6 code(.babel files)
    BuildES6.init(gfe.config.jsDir, gfe.bgCurrentDir + '/' + gfe.config.jsDir);
    BuildES6.init(gfe.config.widgetDir, gfe.bgCurrentDir + '/' + gfe.config.widgetDir);
}

/**
 * @项目工程目录初始化
 * @time 2014-2-19 10:21:37
 */
gfe.createStandardDir = function(dir) {
    var projectName = dir;
    var dirArray = [];
    dirArray[0] = gfe.config.baseDir;
    dirArray[1] = gfe.config.cssDir;
    dirArray[2] = gfe.config.imagesDir;
    dirArray[3] = gfe.config.jsDir;
    dirArray[4] = gfe.config.htmlDir;
    dirArray[5] = gfe.config.dataDir;
    dirArray[6] = gfe.config.widgetDir;

    if(dir){
        dir += '/';
    }else{
        dir = 'gfe_init/';
    }

    for (var i = 0; i < dirArray.length; i++) {
        f.mkdir(dir+dirArray[i]);
    }

    var fileArray = [];
    fileArray[0] = gfe.config.configFileName;
    fileArray[1] = gfe.config.htmlDir + '/index.html';

    var templateDir = path.resolve(__dirname, '../template/');

    for (var i = 0; i < fileArray.length; i++) {
        if (!f.exists(fileArray[i])) {
            var basePathIndex = (dir+'/'+fileArray[i]).lastIndexOf('/');
            newPath = (dir+'/'+fileArray[i]).substring(basePathIndex+1);
            if(newPath==gfe.config.configFileName){
                var content = JSON.parse(gfe.config.configJsonFileContent);
                content.projectName = projectName;                
                //fs.writeFileSync(templateDir+"\\"+newPath,JSON.stringify(content,null,2),'utf8');
                f.write(dir+'/'+fileArray[i], JSON.stringify(content,null,4) ,'utf8');
            }else{
                f.write(dir+'/'+fileArray[i], f.read(templateDir + '/' + fileArray[i]),'utf8');
            }
        }
    }
    console.log('gfe project directory init done!');
}

/**
 * @清除项目缓存文件夹
 */
gfe.clean = function() {
    gfe.bgMkdir();
    f.del(gfe.tempDir, function() {
        console.log('gfe cache dir clean done');
    });
}


/**
 * @在当前文件下编译less/sass
 */
gfe.buildCss = function() {
    console.log('gfe buildCss ...');
    var currentDir = gfe.currentDir;
    BuildCss.init(currentDir, currentDir);

    var regStr = '\\.(less|sass|scss)$';
    var reg = new RegExp(regStr);

    Node_watch(currentDir, function(filename) {
        if (f.isFile(filename)) {
            if (!reg.test(filename)) return;
        }

        console.log(filename.replace(currentDir, ''));
        BuildCss.init(currentDir, currentDir);
    });
}
