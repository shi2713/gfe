/**
 * @统一配置文件
 */

/**
 * @config Json File Content
 */
var configJsonFileContent = '{\r\n'+
'    "projectPath": "gmpro/2.0.0/project/1.0.0",\r\n'+
'    "projectFolder":"css|js|widget",\r\n'+
'    "projectApp":"image",\r\n'+
'    "tplPath":"WEB-INF/template/project",\r\n'+
'    "tplFolder":"html",\r\n'+
'    "tplApp":"channel_web",\r\n'+
'    "svnPath":{\r\n'+
'       "trunk":"https://repo.ds.gome.com.cn:8443/svn/atg_poc/30_Coding/NewDevMode/trunk/gome-gfe/",\r\n'+
'       "branch":"https://repo.ds.gome.com.cn:8443/svn/atg_poc/30_Coding/NewDevMode/branches/gome-gfe/",\r\n'+
'       "tag":"https://repo.ds.gome.com.cn:8443/svn/atg_poc/30_Coding/NewDevMode/tags/gome-gfe/"\r\n'+
'    }\r\n'+
'}';

module.exports = {
    //"threads":4, 多线程
    //"isbackup":true,
    //"backupPath":"d:/ppa",

    "configFileName": "config.json", //配置文件名称

    "projectPath": null, //工程目录前缀
    
    "host": null, //远端机器IP
    "user": null, //远端机器user
    "password": null, //远端机器password

    "baseDir": "", //静态文件名称，是一期目录规划的问题，貌似已废弃
    "cssDir": "css", //css文件夹名称
    "imagesDir": "css/i", //images文件夹名称
    "jsDir": "js", //js文件夹名称
    "htmlDir": "html", //html文件夹名称
    "dataDir": "data", //data文件夹名称
    "widgetDir": "widget", //widget文件夹名称
    "buildDirName": "html", //编译的html文件夹名称 
    
    "outputDirName": "build", //输出的目标文件夹名称
    "outputCustom": null, //自定义输出，多个文件或文件夹以|间隔
    "outputOnlyCopy": null, //额外输出项目之外内容，多个文件或文件夹以|间隔

    "widgetServerDir": "home", //widget服务器所在的文件夹名称
    "widgetOutputName": "widget", //输出的所有widget合并后的文件名
    "widgetInputName": [], //指定需要输出的widget名称
    "widgetAutoUpdate": false, //为true时,build/output时自动从svn拉到最新的widget

    "localServerPort": 80, //本地服务器端口
    "haslog":true,
    "configJsonFileContent": configJsonFileContent,
    
    "cdn": "//app.gomein.net.cn", //静态cdn域名
    "newcdn": "//app.gomein.net.cn", //newcdn

    "serverDir": "", //上传至远端服务器文件夹的名称
    "previewServerDir": "", //html文件夹上传至服务器所在的文件夹名称

    "build":{
        "jsPlace": "insertBody", //调试时js文件位置 insertHead|insertBody
        "widgetIncludeComment":false,//widget引用带注释
        "livereload":false, //是否开启liveload
        "sass":false,//是否开启sass编译
        "less":false,//是否开启less编译
        "csslint":false,//是否开启csslint

        "weinre": false, //是否开启移动设备调试
        "weinreUrl": "//app.gomein.net.cn"//调试移动设备的服务器地址
    },

    "output":{
        "concat": {},//文件合并

        "cssImagesUrlReplace": false,//css中图片url加cdn替换
        "jsUrlReplace": false,//js文件的id和dependences是否添加cdn前缀
        "jsPlace": "insertBody", //编译后js文件位置 insertHead|insertBody
        "cssCombo": true, //css进行combo
        "jsCombo": true, //js进行combo todo
        "cssMd5":false, //css生成md5戳
        "jsMd5":false, //js生成md5戳

        "debug":false,//是否输出一套debug页面
        "debugCdn": "//127.0.0.1",//debug页面中私有js、css的debug调试域名

        "combineWidgetCss":false,//合并所有引用的widget中的css
        "combineWidgetJs":false,//合并所有引用的widget中的js

        "hasBanner": 1, //定义js和css的banner前缀形式。0，不需要；1，时间戳；2，md5值
        "vm": true, //是否开启vm编译
        "compresshtml": false,//是否开启压缩html文件
        "compressJs": true,//是否开启压缩js文件
        "compressCss": true,//是否开启压缩css文件
        "compressPng": true,//是否开启压缩png图片
        "compressPngReg": null,//是否压缩此参数匹配的文件，多个文件以|分格
        "compressJsReg":null, //不压缩此参数匹配的文件(a.js|b.js|c.js)
        "compressCssReg":null, //不压缩此参数匹配的文件(a.css|b.css|c.css)

        "comment": true,//是否输出文件中的注释

        "cssSprite": true, //是否开启css sprite功能
        "cssSpriteMode": 1, //0: 将所有css文件中的背景图合并成一张sprite图片，1: 将每一个widget中的背景图分别合并成一张图片
        "cssSpriteMargin": 10, //css sprite图片之间的间距
        "cssSpriteDirection": "vertical", //vertical：垂直合并，horizontal：水平合并

        "base64": false, //是否对图片进行base64编码

        "imagesSuffix": 0,
        /*0：不添加任何后缀
          1：给css中需要cssSprite的背景图添加后缀，后缀会被添加在文件扩展名的后面。例如：test.png => test.png?20150319161000
          2：给css中需要cssSprite的背景图添加后缀，后缀会被添加在文件名的后面，生成一个新的文件。例如：test.png => test20150319161000.png
        */

        "jsRemove": [],//移除js中函数或者方法,比如console,y.log即配置为['console','y.log']
        "excludeFiles": null,//对输出的文件/文件夹进行过滤，只支持正则表达式且不要带前后斜杠
        "encoding": "utf-8"//指定项目的编码格式：utf-8，gbk
    },

    "widget":{
        //widget预览所依赖的js
        "js": [
            "//js.gomein.net.cn/gmlib/jq/1.7.1/jquery.js",
            "//js.gomein.net.cn/gmlib/sea/??/seajs/3.0.0/sea.js,seajs-combo/1.0.0/seajs-combo.js"
        ],
        //widget预览所依赖的css
        "css": [
            "//css.atguat.com.cn/gmlib/reset/1.0.0/reset.css"
        ],
        //新建widget文件夹的文件类型
        // "createFiles": ["vm"]
    },

    "babel": {
        // 默认只启用基本转义 http://babeljs.io/docs/plugins/preset-es2015/
        "defaultPresets": ["es2015"],
        // 兼容IE6,7,8
        "defaultPlugins": ["transform-es3-member-expression-literals", "transform-es3-property-literals"]
    },

    "rewrite": {
        
    },

    //通过命令行控制静态资源cdn(gfe output -uat -html; gfe output -pre -html; gfe output -prd -html)
    "customCdns": null, //cdn
    "uatServer": { //uat对应的cdn
        "js":"//js.atguat.net.cn",
        "css":"//css.atguat.net.cn",
        "bgimg":"//app.atguat.net.cn"
    },
    "preServer": { //pre对应的cdn
        "js":"//js.gomeprelive.net.cn",
        "css":"//css.gomeprelive.net.cn",
        "bgimg":"//app.gomeprelive.net.cn"
    },
    "prdServer":{ //prd对应的cdn
        "js":"//js.gomein.net.cn",
        "css":"//css.gomein.net.cn",
        "bgimg":"//app.gomein.net.cn"
    },

    //项目svn地址
    "svnPath":{
        "trunk":"https://repo.ds.gome.com.cn:8443/svn/atg_poc/30_Coding/NewDevMode/trunk/gome-gfe",
        "branch":"https://repo.ds.gome.com.cn:8443/svn/atg_poc/30_Coding/NewDevMode/branches/gome-gfe",
        "tag":"https://repo.ds.gome.com.cn:8443/svn/atg_poc/30_Coding/NewDevMode/tags/gome-gfe"
    }
}