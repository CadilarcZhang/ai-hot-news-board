# Google Custom Search API 配置指南

## 重要说明

您提供的OAuth客户端配置是用于用户登录认证的，**不是**Google Custom Search API所需的配置。

Google Custom Search API需要两个参数：
1. **API密钥（API Key）** - 用于调用Google Custom Search API
2. **搜索引擎ID（Search Engine ID / CX）** - 自定义搜索引擎的唯一标识符

## 获取Google Custom Search API密钥和搜索引擎ID

### 步骤1：创建Google Cloud项目并启用API

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 在左侧菜单中，选择 **"API和服务" > "库"**
4. 搜索 **"Custom Search API"**
5. 点击进入并点击 **"启用"** 按钮

### 步骤2：创建API密钥

1. 在左侧菜单中，选择 **"API和服务" > "凭据"**
2. 点击 **"+ 创建凭据"** > **"API密钥"**
3. 复制生成的API密钥（格式类似：`AIzaSy...`）
4. **重要**：点击API密钥进行编辑，在"API限制"中选择"限制密钥"，然后选择"Custom Search API"

### 步骤3：创建自定义搜索引擎

1. 访问 [Google Custom Search Engine](https://programmablesearchengine.google.com/)
2. 点击 **"添加"** 创建新的搜索引擎
3. 配置搜索引擎：
   - **要搜索的网站**：可以填写 `*` 表示搜索整个互联网，或者指定特定网站
   - **搜索引擎名称**：给搜索引擎起个名字
   - **语言**：选择中文（简体）
4. 点击 **"创建"**
5. 创建完成后，点击 **"控制面板"**
6. 在"基本信息"中找到 **"搜索引擎ID"**（格式类似：`017576662512468239146:omuauf_lfve`）
7. 在"设置"中，启用 **"搜索整个网络"** 选项（如果只想搜索特定网站，可以跳过）

### 步骤4：配置环境变量

在项目根目录创建或编辑 `.env` 文件，添加以下配置：

```env
# Google Custom Search API配置
GOOGLE_SEARCH_API_KEY=你的API密钥
GOOGLE_SEARCH_ENGINE_ID=你的搜索引擎ID
```

或者在Vercel等部署平台的环境变量中配置：
- `GOOGLE_SEARCH_API_KEY` = 你的API密钥
- `GOOGLE_SEARCH_ENGINE_ID` = 你的搜索引擎ID

## 免费配额限制

Google Custom Search API的免费配额：
- **每天100次免费搜索请求**
- 超出后需要付费（每1000次请求约$5）

## 测试配置

配置完成后，可以通过以下方式测试：

1. 在代码中添加日志输出，查看是否成功调用Google API
2. 检查控制台日志，确认搜索是否成功
3. 如果Google搜索失败，系统会自动回退到百度搜索

## 解决403 Forbidden错误

如果遇到 `403 Forbidden: Requests from referer <empty> are blocked` 错误，有以下解决方案：

### 方案1：修改API密钥的HTTP referrer限制（推荐）

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 进入 **"API和服务" > "凭据"**
3. 点击你的API密钥进行编辑
4. 在 **"应用限制"** 部分：
   - 选择 **"HTTP引荐来源网址（网站）"**
   - 添加以下网址（根据你的实际域名修改）：
     - `https://news.zxt.net.cn/*`
     - `https://*.vercel.app/*` （如果使用Vercel）
     - `http://localhost:*` （本地开发）
5. 保存更改

### 方案2：使用IP地址限制（服务器端推荐）

1. 在API密钥设置中，选择 **"IP地址（网络服务器、cron作业等）"**
2. 添加你的服务器IP地址
3. 注意：Vercel等Serverless平台的IP是动态的，此方案不适用

### 方案3：不设置任何限制（不推荐，安全性较低）

1. 在API密钥设置中，选择 **"无"**
2. 这样任何来源都可以使用，但安全性较低
3. 建议至少设置HTTP referrer限制

### 方案4：代码中添加Referer头（已实现）

代码中已经添加了Referer头，但需要确保：
- 在Vercel环境变量中设置 `SITE_URL` 为你的域名
- 或者代码会自动使用 `VERCEL_URL` 环境变量

## 常见问题

### Q: API密钥和OAuth客户端ID有什么区别？
A: 
- **API密钥**：用于服务器端调用Google API（如Custom Search API）
- **OAuth客户端ID**：用于用户登录认证，让用户授权访问他们的Google账户

### Q: 为什么需要创建自定义搜索引擎？
A: Google Custom Search API要求必须使用自定义搜索引擎，即使你想搜索整个互联网也需要创建一个。

### Q: 如何提高中文搜索结果质量？
A: 新检索（`lib/newsSearch.js`，`SEARCH_V2` 默认开启）使用 `lr=lang_zh-CN`、`gl=cn`、`hl=zh-CN`，并用 `dateRestrict=d3`（不足再放宽到 `d7`）。不再传 `cr=countryCN`，避免按服务器所在国把中文媒体过滤掉。可信站点只在本地打分里加权。

### Q: 如何查看API使用情况？
A: 在Google Cloud Console的"API和服务" > "配额"中查看使用情况。

## 配置示例

```env
# .env 文件示例
GOOGLE_SEARCH_API_KEY=AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz
GOOGLE_SEARCH_ENGINE_ID=017576662512468239146:omuauf_lfve
```

## 注意事项

1. **不要将API密钥提交到Git仓库**，确保 `.env` 文件在 `.gitignore` 中
2. **限制API密钥的使用范围**，只允许Custom Search API使用
3. **监控API使用量**，避免超出免费配额产生费用
4. 如果API密钥泄露，立即在Google Cloud Console中删除并重新创建


