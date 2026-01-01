# Vercel 自动部署不工作 - 排查指南

## 🔍 问题：代码已推送到 GitHub，但 Vercel 没有自动部署

### 可能的原因和解决方案：

---

## 1️⃣ 检查 Vercel 项目是否连接到 GitHub 仓库

### 步骤：

1. **访问 Vercel 控制台**
   - 打开 [vercel.com](https://vercel.com)
   - 登录你的账号

2. **进入项目设置**
   - 在 Dashboard 中找到你的项目
   - 点击项目名称进入项目详情
   - 点击 **Settings** 标签

3. **检查 Git 连接**
   - 在 **Settings** 页面，找到 **Git** 部分
   - 查看是否显示你的 GitHub 仓库信息
   - 如果没有显示或显示错误，需要重新连接

### 如果未连接或连接错误：

1. **重新连接 Git 仓库**
   - 在项目 **Settings** → **Git** 页面
   - 点击 **Disconnect**（如果已连接）
   - 然后点击 **Connect Git Repository**
   - 选择你的 GitHub 账号
   - 找到 `ai-hot-news-board` 仓库
   - 点击 **Import**

2. **确认仓库信息**
   - 确保显示的是正确的仓库
   - 检查仓库名称和路径是否正确

---

## 2️⃣ 检查推送的分支

### Vercel 默认只监听主分支的推送

1. **确认主分支名称**
   ```bash
   git branch
   ```
   - 主分支通常是 `main` 或 `master`

2. **检查当前分支**
   ```bash
   git branch --show-current
   ```

3. **如果不在主分支，切换到主分支并推送**
   ```bash
   git checkout main  # 或 master
   git merge your-branch-name  # 合并你的更改
   git push origin main  # 推送到主分支
   ```

### 在 Vercel 中检查分支设置：

1. **进入项目 Settings**
2. **找到 Git** 部分
3. **检查 Production Branch**
   - 确保设置为 `main` 或 `master`（根据你的仓库）
   - 如果不对，点击 **Edit** 修改

---

## 3️⃣ 检查 Vercel 的自动部署设置

### 步骤：

1. **进入项目 Settings**
2. **找到 Git** 部分
3. **检查 Automatic deployments**
   - 确保 **Automatic deployments from Git** 是开启状态
   - 如果关闭了，打开它

---

## 4️⃣ 检查 GitHub Webhook 设置

### 步骤：

1. **在 GitHub 仓库中检查**
   - 进入你的 GitHub 仓库
   - 点击 **Settings** → **Webhooks**
   - 查看是否有 Vercel 的 webhook
   - 如果有，检查状态是否为 ✅（绿色勾）

2. **如果 Webhook 不存在或失败**
   - 在 Vercel 中重新连接仓库（见步骤 1）
   - Vercel 会自动创建 Webhook

---

## 5️⃣ 手动触发部署（临时解决方案）

如果自动部署不工作，可以手动触发：

### 方法 A：在 Vercel 控制台

1. **进入项目**
2. **点击 Deployments 标签**
3. **找到最新的部署记录**
4. **点击右侧的 ...（三个点）**
5. **选择 Redeploy**

### 方法 B：使用 Vercel CLI

```bash
# 安装 Vercel CLI（如果还没安装）
npm install -g vercel

# 登录
vercel login

# 部署到生产环境
cd /Users/zhangxitong/ai-hot-news-board
vercel --prod
```

---

## 6️⃣ 检查推送是否成功

### 确认代码已推送到 GitHub：

1. **在 GitHub 上检查**
   - 访问你的 GitHub 仓库
   - 查看最新的 commit 记录
   - 确认你的更改已经显示在仓库中

2. **检查推送命令**
   ```bash
   git log --oneline -5  # 查看最近的提交
   git remote -v  # 查看远程仓库地址
   ```

---

## 7️⃣ 查看 Vercel 部署日志

### 检查是否有错误：

1. **进入 Vercel 项目**
2. **点击 Deployments 标签**
3. **查看最近的部署记录**
   - 如果有失败的部署，点击查看日志
   - 检查错误信息

---

## 🔧 快速修复步骤（推荐）

### 如果项目已存在但未连接 Git：

1. **在 Vercel 控制台**
   - 进入项目 **Settings** → **Git**
   - 点击 **Connect Git Repository**
   - 选择你的 GitHub 账号
   - 选择 `ai-hot-news-board` 仓库
   - 点击 **Import**

2. **配置项目**
   - 确认 Production Branch 是 `main` 或 `master`
   - 确认 Framework Preset 是 **Other** 或 **Node.js**
   - 确认 Root Directory 是 `./`

3. **重新部署**
   - 点击 **Deploy** 按钮
   - 或者推送代码到主分支

---

## ✅ 验证自动部署是否工作

### 测试步骤：

1. **做一个小的更改**
   ```bash
   echo "# 测试自动部署" >> README.md
   git add README.md
   git commit -m "测试自动部署"
   git push origin main
   ```

2. **在 Vercel 中观察**
   - 进入项目 **Deployments** 页面
   - 应该会在 1-2 分钟内看到新的部署开始
   - 如果没有，说明自动部署未配置成功

---

## 📞 如果以上方法都不行

### 可能的其他原因：

1. **Vercel 账号权限问题**
   - 检查 Vercel 账号是否有权限访问 GitHub 仓库
   - 在 GitHub 仓库 Settings → Collaborators 中检查

2. **GitHub 仓库是私有的**
   - 确保 Vercel 有权限访问私有仓库
   - 在 Vercel 账号设置中检查 GitHub 集成权限

3. **联系 Vercel 支持**
   - 访问 [vercel.com/support](https://vercel.com/support)
   - 或查看 [Vercel 文档](https://vercel.com/docs)

---

## 💡 最佳实践

1. **确保主分支名称一致**
   - GitHub 仓库的主分支（main/master）
   - Vercel 的 Production Branch 设置

2. **定期检查部署状态**
   - 推送代码后，在 Vercel 中查看是否自动触发部署

3. **使用预览部署**
   - 推送到其他分支会创建预览部署
   - 不会影响生产环境

---

祝你排查顺利！如果还有问题，请告诉我具体的错误信息。🚀



