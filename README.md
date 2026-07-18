# 周日面聚会互动邀请函

一个可直接部署到 GitHub Pages 的静态互动邀请函。页面以手账风格呈现聚会信息、来宾阵容和六个互动环节，不依赖后端服务或第三方前端库。

## 特性

- 响应式单页邀请函，兼容鼠标、触摸和键盘操作
- 包含门铃、零食、拌面、合影、切西瓜、递麦和月亮等互动
- 使用本地图片与图标，无 JavaScript 时仍可阅读核心信息
- 使用浏览器本地存储保留浏览进度
- 使用 Node.js 内置测试验收内容、互动、资产与发布安全

## 文件结构

```text
.
├── index.html          # 页面结构与静态文案
├── js/                 # 内容数据、状态、界面与互动逻辑
├── styles/             # 设计变量、基础、组件与动画样式
├── assets/             # 角色、图标、合影与分享预览资产
├── tests/              # Node.js 自动化测试
└── package.json        # 本地命令
```

## 本地使用

需要已安装 Node.js 和 Python 3。

```bash
npm test
npm run serve
```

启动后按终端提示的本地地址访问页面。

## 内容修改入口

- 聚会日期、时间、集合地点与页面文案：`index.html` 和 `js/content.js`
- 来宾设定、六个环节与递麦文案：`js/content.js`
- 互动行为与进度管理：`js/interactions.js`、`js/state.js` 和 `js/app.js`
- 视觉样式：`styles/`
- 角色、合影、图标与分享预览图：`assets/`

修改内容或资产后，请先运行 `npm test`。

## 隐私

这是纯静态站点，发布后仓库与网页中的内容都可能被公开访问。提交前请检查聚会地点、人名、照片及其他个人信息，并确认已获得相关人员同意。不要将密钥、令牌或其他秘密写入项目文件。

## 发布到 GitHub Pages

1. 在 GitHub 新建一个仓库，新仓库不需预先生成 README。
2. 先将已完成的功能分支快进合并到本地 `main`，确保将要发布的内容已进入主分支：

   ```bash
   git switch main
   git merge --ff-only feat/interactive-invitation
   ```

3. 在项目根目录关联远程仓库并推送 `main` 分支：

   ```bash
   git remote add origin https://github.com/<用户名>/<仓库名>.git
   git push -u origin main
   ```

   如果明确要跳过本地合并、直接将当前分支发布为远程 `main`，可使用 `git push -u origin HEAD:main`。推荐优先完成上述合并流程，便于后续维护分支历史。

4. 打开 GitHub 仓库的 **Settings → Pages**。
5. 在 **Build and deployment** 中选择 **Deploy from a branch**。
6. 选择 `main` 分支和 `/ (root)` 目录，然后保存。
7. 等待部署完成，访问：`https://<用户名>.github.io/<仓库名>/`
