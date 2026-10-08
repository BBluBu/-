# CampusLogin

Windows 校园网工具，使用 Electron + React + TypeScript，直接请求 Dr.COM 接口。

## 使用前配置

这是 0.1.6 的公开脱敏源码。`127.0.0.1` 是服务器占位地址，`demo-student → 示例用户` 是昵称映射示例，不包含真实校园服务器地址或个人账号。使用前请将 `src/main/drcom/config.ts` 的 `baseUrl` 改为学校实际的 Dr.COM 认证服务器；昵称映射可在 `src/renderer/src/accountDisplay.ts` 中自行配置。接口路径、请求参数和 JSONP 解析方式保持原实现。

## 当前阶段

- Electron 工程与 React 页面，提供状态卡片和简洁的登录流程。
- 页面启动时检测一次状态；之后仅在点击“重新检测”时再次检测，不随时间、网络状态变化或窗口焦点变化自动复查。
- 主进程发送 GET 请求，preload 通过受限 IPC 方法连接 React。
- 安全解析 JSONP，分别检测 Dr.COM 认证状态和公网连通性；公网使用两个独立探测地址，任一成功即判定可用。
- 页面提供账号、密码和登录按钮；点击登录成功后会确认一次本次认证结果，并可直接点击“完成并关闭”。已认证时无需再次登录。主进程保留注销接口，页面不提供注销按钮。
- 请求超时为 5 秒，不自动登录，也不定时轮询；关闭窗口即退出应用。
- 可选记住账号和密码。勾选“记住密码”后，仅在登录成功时加密保存，下次打开自动填入；取消勾选会删除已保存的密码。Windows 安装版支持自行选择登录 Windows 时打开应用。
- 窗口按屏幕可用空间确定尺寸并固定大小；页面在常见尺寸下完整显示，较小屏幕会收起次要诊断信息。

不提供自动登录或托盘常驻。

## 开发

需要 Node.js 24 LTS 和 npm。

```powershell
npm install
npm run dev
```

```powershell
npm run typecheck
npm test
npm run build
npm start
```

首次安装生成 `package-lock.json` 后，后续可使用 `npm ci` 按锁定版本安装。

`build` 生成 `out/` 中的应用代码，`start` 使用 Electron 运行构建结果。`npm run build:win` 生成 Windows 安装程序，`npm run build:win:dir` 生成免安装目录，两者均输出到 `release/`。安装向导默认使用系统安装目录，也可手动选择其他位置。开机启动开关只在打包后的 Windows 应用中可用，开发模式下不可用。

如果 Electron 压缩包已经位于本机其他缓存目录，可以在打包命令后传入 `-- --config.electronDist="压缩包的绝对路径"`，直接使用该 zip。应用图标由 `node scripts/generate-icon.cjs` 生成。

若本机未安装 Node.js，但项目中已有 `.tools/node-v24.*-win-x64/` 便携运行时，可在当前 PowerShell 会话中设置：

```powershell
$taskNode = Get-ChildItem .tools -Directory -Filter 'node-v24.*-win-x64' | Select-Object -First 1
$env:Path = "$($taskNode.FullName);$env:Path"
npm.cmd run dev
```

## 代码结构

```text
src/main/           Electron 主进程、IPC、Dr.COM 请求和 JSONP 解析
src/preload/        window.campusLogin 桥接与类型声明
src/renderer/       React 页面和样式
src/shared/         跨进程共享类型与通道名称
tests/              JSONP、客户端与 IPC 测试
resources/          Windows 应用图标
```

React 页面调用 `window.campusLogin.checkStatus()`、`checkInternet()` 和 `login({ username, password })`；preload 也提供 `logout()`，但页面尚未接入。未勾选“记住密码”时，密码仅保留在运行时内存中，登录成功后清空；失败时保留输入方便重试。勾选后由主进程调用 Electron `safeStorage`，使用 Windows DPAPI 将密码加密后写入用户数据目录的 `remembered-credentials.json`；账号与密文一起保存，密码不进入 localStorage 或日志。加密不可用时拒绝保存；配置损坏或解密失败时提示重新输入。Windows 加密保护依赖当前 Windows 用户，不能隔离同一用户下运行的其他程序。界面不能传入任意服务器地址。窗口禁用 Node 集成，启用上下文隔离与 sandbox。JSONP 不通过 eval、Function 或 script 标签执行。

外观支持浅色、深色和跟随系统，默认跟随系统；选择保存到本地，跟随系统时实时响应系统主题变化。输入账号和密码后可按回车登录。设置中的“清除保存的账号和密码”删除已记住的账号和加密密码，同时清空输入框，不会注销当前认证；主题和开机启动设置保留。开发阶段使用 `npm run dev` 预览，确认一轮改动后再统一生成安装包。

所有设置集中在右上角的小齿轮按钮：主题、背景开关、自定义图片与恢复内置、记住账号和密码、清除保存信息，以及开机启动。主界面只保留状态与登录操作。设置弹窗可用关闭按钮、Esc 或点击弹窗外关闭；弹窗打开时焦点限制在设置区，关闭后返回设置按钮。

窗口使用一体化标题栏，左侧显示头像和 CampusLogin，右侧提供设置、最小化和关闭。标题栏空白处可拖动窗口，控件区域不参与拖动；颜色跟随主题切换。窗口保持固定大小，不提供最大化。窗口操作通过校验主页面来源的应用 IPC 完成，认证协议和认证 IPC 保持原样。

界面采用社交平台使用的卡特曼头像与窗口内部的南方公园小镇图片。素材来源记录在 `src/renderer/src/assets/SOURCES.md`，运行时读取本地打包文件。内容面板始终居中。浅色显示白天，深色显示夜晚，背景交叉淡化约 500 毫秒；卡片和控件同步切换颜色。系统要求减少动态效果时取消动画。设置中可关闭背景、选择自定义图片或恢复内置背景。自定义图片支持 PNG/JPG/WebP，限制 10 MB 和 4000 万像素，复制到渲染进程 IndexedDB，原文件移动后不影响背景；密码仍由原有主进程加密保存。CSP 仅增加本地 blob 图片许可，不允许远程图片。小窗口会隐藏辅助检测详情以优先显示操作入口。

登录成功后，页面会用本次登录的认证账号显示欢迎称呼。昵称映射集中在 `src/renderer/src/accountDisplay.ts` 的 `accountNames` 中：键为 `@` 前的账号，值为昵称；没有配置昵称的账号显示原账号。若启动时已认证但状态接口未提供账号，页面不会根据本地记住的账号猜测当前用户。

## 已确认协议

服务器：`http://127.0.0.1`。三个接口使用 GET，响应按 JSONP 解析。

| 操作 | 路径 | result 含义 |
| --- | --- | --- |
| 状态检测 | `/drcom/chkstatus` | 0 未登录，1 已登录 |
| 登录 | `/drcom/login` | 1 成功 |
| 注销 | `/drcom/logout` | 1 成功 |

状态请求参数：`callback=dr` 加随机四位数、`jsVersion=4.X`、随机 `v`、`lang=zh`。

登录参数：随机 `callback=drxxxx`、`DDDDD` 为用户账号、`upass` 为用户密码、`0MKKey=123456`、`R1=0`、`R2=`、`R3=0`、`R6=0`、`para=00`、`v6ip=`、`terminal_type=1`、`lang=zh-cn`、`jsVersion=4.2.1`、`v=2873`、`lang=zh`。两个 `lang` 参数按抓包顺序发送。注销目前按无参数 GET 发送，待真实抓包后可通过统一的 URL 构造入口补充参数。

解析器接受合法回调名包装的 JSON 对象，`result` 严格接受数字 0 和 1。账号密码随协议的 GET 查询参数传输，不会写入日志；本地密码仅在用户选择记住时加密保存。

“已登录”表示 Dr.COM 认证状态，不代表互联网连通性。公网检测使用 Windows NCSI 的 Microsoft Connect Test 和 `https://www.baidu.com/`；两者都失败时返回 `Offline`。公网探测失败仍不能完全证明没有互联网，因此页面会分别显示认证服务器与公网探测的结果。Dr.COM 服务器返回 HTTP 错误或无法识别的响应时显示“状态未知”。

## 验证

已通过 `npm run typecheck` 和 `npm test`；自动测试使用模拟响应，未验证真实校园网接口。

自动测试不访问校园网，也不发送真实登录或注销请求。

校园网现场验收：分别在已认证和未认证的情况下检测状态；断开校园网后确认显示“未知”；恢复网络后手动检测，确认可恢复。真实接口兼容性以现场验收结果为准。
