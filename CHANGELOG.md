##changelog

## 1.1.0
* [add]添加<!--if IE>支持(js)
* [add]添加Combo分段功能
* [add]output添加onlyCopy功能
* [add]css背景图支持跨路径引用
* [up]开启sass支持
* [change]gfe o -html修改为-all
* [fix]修复雪碧图BUG

### 1.0.6
* [add]添加<!--if IE>判断支持(css)
* [add]link/script支持domain标识,可选择不加cdn
* [fix]修复BUG若干

### 1.0.5
* [up]更新三个包文件,支持6.9.x版node
* [add]增加支持js文件inline
* [add]weiget支持type="html"
* [fix]修复inbottom问题
* [fix]修复linux下路径相关问题

### 1.0.4 
* [add]支持css/js压缩过滤(compressCssReg/compressJsReg)
* [fix]修复define错误处理问题
* [fix]修复css url拼接缺少路径问题
* [change]修改cssImagesUrlReplace默认参数为false

### 1.0.3 
* [fix]修复不能输出null文件
* [add]支持css/js文件输出md5

### 1.0.2 
* [fix]修复细节bug若干
* [add]可以指定将script标签生成到最底部,`<script inbottom>`
* [add]支持本地combo拼接

### 1.0.1 
* [add]cssSprite支持水平合并
* [add]可以指定需要合并的widget名称

### 1.0.0 
* 发布gfe@1.0.0