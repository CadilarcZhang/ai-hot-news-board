# Vercel 部署指南 - 手把手教程

本指南将帮助你一步步在 Vercel 上部署你的 Node.js 应用。

## 📋 准备工作

### 1. 确保你的代码已提交到 Git

在部署之前，确保你的代码已经提交到 Git 仓库（GitHub、GitLab 或 Bitbucket）。

```bash
# 检查 Git 状态
git status

# 如果有未提交的更改，提交它们
git add .
git commit -m "准备部署到 Vercel"
git push
```

### 2. 准备环境变量

你需要准备以下环境变量：
- `TIANAPI_KEY`: 天行 API 密钥（已在代码中，但建议使用环境变量）
- `AI_API_KEY`: AI API 密钥（已在代码中，但建议使用环境变量）
- `BASE_PATH`: 基础路径（在 Vercel 上通常为空字符串，已配置在 vercel.json 中）

## 🚀 部署步骤

### 方法一：通过 Vercel 网站部署（推荐）

#### 步骤 1: 注册/登录 Vercel 账号

1. 访问 [https://vercel.com](https://vercel.com)
2. 点击右上角的 **Sign Up** 或 **Log In**
3. 使用 GitHub、GitLab 或 Bitbucket 账号登录（推荐，方便后续自动部署）

#### 步骤 2: 导入项目

1. 登录后，点击 **Add New...** → **Project**
2. 在 "Import Git Repository" 页面，选择你的代码仓库
   - 如果还没连接，点击 **Connect Git Provider** 连接你的 Git 账号
3. 找到你的 `ai-hot-news-board` 项目，点击 **Import**

#### 步骤 3: 配置项目

1. **Project Name**: 可以保持默认或自定义（例如：`ai-hot-news-board`）
2. **Framework Preset**: 选择 **Other** 或 **Node.js**
3. **Root Directory**: 保持默认（`./`）
4. **Build Command**: 留空（Vercel 会自动检测）
5. **Output Directory**: 留空
6. **Install Command**: `npm install`（默认）

#### 步骤 4: 配置环境变量

在部署前，点击 **Environment Variables** 添加以下环境变量：

1. 点击 **Environment Variables** 区域
2. 添加以下变量：

   | 变量名 | 值 | 说明 |
   |--------|-----|------|
   | `TIANAPI_KEY` | `eb50731204ecb974aa2fcc8f22478f42` | 天行 API 密钥（或你自己的密钥） |
   | `AI_API_KEY` | `sk-pxmeadiyndbhhtvzvblpgnmyalwvhvvkikllrfjmkqzwtnvo` | AI API 密钥（或你自己的密钥） |
   | `BASE_PATH` | （留空） | 基础路径，在 Vercel 上使用根路径 |
   | `NODE_ENV` | `production` | 生产环境标识 |

   **注意**：为了安全，建议使用你自己的 API 密钥，不要使用代码中硬编码的密钥。

3. 确保所有环境都勾选（Production、Preview、Development）

#### 步骤 5: 部署

1. 点击 **Deploy** 按钮
2. 等待部署完成（通常需要 1-3 分钟）
3. 部署成功后，你会看到一个成功页面，显示你的应用 URL

#### 步骤 6: 访问应用

部署完成后，你会得到一个类似这样的 URL：
- `https://ai-hot-news-board.vercel.app`
- 或者自定义域名（如果配置了）

点击 URL 即可访问你的应用！

---

### 方法二：通过 Vercel CLI 部署

如果你更喜欢使用命令行，可以按照以下步骤：

#### 步骤 1: 安装 Vercel CLI

```bash
npm install -g vercel
```

#### 步骤 2: 登录 Vercel

```bash
vercel login
```

这会打开浏览器，让你登录 Vercel 账号。

#### 步骤 3: 在项目目录中初始化

```bash
cd /Users/zhangxitong/ai-hot-news-board
vercel
```

#### 步骤 4: 按照提示操作

CLI 会问你几个问题：
- **Set up and deploy?** → 输入 `Y`
- **Which scope?** → 选择你的账号
- **Link to existing project?** → 如果是第一次部署，输入 `N`
- **What's your project's name?** → 输入项目名称（例如：`ai-hot-news-board`）
- **In which directory is your code located?** → 输入 `./`（当前目录）

#### 步骤 5: 设置环境变量

```bash
# 设置环境变量
vercel env add TIANAPI_KEY
# 输入值：eb50731204ecb974aa2fcc8f22478f42（或你自己的密钥）

vercel env add AI_API_KEY
# 输入值：sk-pxmeadiyndbhhtvzvblpgnmyalwvhvvkikllrfjmkqzwtnvo（或你自己的密钥）

vercel env add BASE_PATH
# 输入值：（留空，直接回车）

vercel env add NODE_ENV
# 输入值：production
```

#### 步骤 6: 部署

```bash
# 部署到生产环境
vercel --prod
```

#### 步骤 7: 访问应用

部署完成后，CLI 会显示你的应用 URL，直接访问即可！

---

## 🔧 常见问题排查

### 问题 1: 部署失败，提示找不到模块

**解决方案**：
- 确保 `package.json` 中所有依赖都已正确列出
- 检查 `node_modules` 是否已提交（通常不应该提交）
- 确保 `.gitignore` 中包含 `node_modules`

### 问题 2: API 路由返回 404

**解决方案**：
- 检查 `vercel.json` 配置是否正确
- 确保路由路径以 `/api/` 开头
- 检查 `server.js` 中的路由定义

### 问题 3: 静态文件无法加载

**解决方案**：
- 确保 `public` 目录存在且包含所有静态文件
- 检查 `vercel.json` 中的静态文件路由配置

### 问题 4: 环境变量未生效

**解决方案**：
- 在 Vercel 项目设置中检查环境变量是否正确添加
- 确保环境变量已添加到所有环境（Production、Preview、Development）
- 重新部署项目（环境变量更改后需要重新部署）

### 问题 5: 应用访问慢或超时

**解决方案**：
- Vercel 免费版有函数执行时间限制（10秒）
- 如果 AI 生成内容时间较长，考虑优化代码或升级到付费版
- 检查是否有不必要的长时间操作

---

## 📝 后续操作

### 自动部署

一旦项目连接到 Vercel，每次你推送到 Git 仓库的主分支时，Vercel 会自动重新部署你的应用。

### 查看部署日志

1. 在 Vercel 项目页面，点击 **Deployments**
2. 选择任意一次部署，查看详细日志

### 自定义域名

1. 在 Vercel 项目页面，点击 **Settings** → **Domains**
2. 添加你的自定义域名
3. 按照提示配置 DNS 记录

### 回滚部署

如果新部署有问题，可以回滚到之前的版本：
1. 在 **Deployments** 页面
2. 找到之前的成功部署
3. 点击 **...** → **Promote to Production**

---

## 🎉 完成！

恭喜！你的应用已经成功部署到 Vercel 了！

如果遇到任何问题，可以：
- 查看 Vercel 的 [官方文档](https://vercel.com/docs)
- 检查部署日志
- 在 Vercel 社区寻求帮助

祝你部署顺利！🚀

