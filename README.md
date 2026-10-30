# QQ邮箱本地主题切换

适用于新版 QQ 邮箱的 Tampermonkey 用户脚本，提供 **东方青绿、竹林清风、桃花微雨** 三种主题切换，支持记住选择及关闭本地换肤。

**说明：** 本项目只在浏览器本地修改 CSS 类名，不修改会员资格、账号数据或服务端权限。主题资源如果没有加载，添加类名不能保证外观完整显示。

## 安装
1. 安装 [Tampermonkey](https://www.tampermonkey.net/)。
2. 打开 [脚本源文件](./qqmail-local-themes.user.js)，复制到 Tampermonkey 新脚本中保存。
3. 刷新 `https://wx.mail.qq.com/home/index`，点击扩展菜单选择主题。
4. 选择「跟随网页设置」则刷新页面，恢复邮箱自己的主题逻辑。

## 特性
- 三种主题菜单，当前主题带勾选标记
- 本地存储选项
- MutationObserver 对抗页面重新覆盖 class
- 只匹配新版 QQ 邮箱，不采集邮件、无外部网络请求

## 测试
`node --test tests/themes.test.cjs`：模拟 DOM 的测试，不代替真实浏览器端到端验证。

## 限制
依赖 QQ 邮箱现有的 `page-theme-*` CSS 及图片资源。官方更新后可能失效。

## 许可证
MIT。非腾讯官方项目。