# 热搜历史记录功能 - 安装和集成指南

## 概述

本文档说明如何将热搜历史记录功能集成到现有的 AI 热搜榜项目中。

---

## 前置条件

- Node.js >= 14.0.0
- MongoDB（本地或云服务）
- 项目已克隆到本地

---

## 安装步骤

### 1. 安装 MongoDB 依赖

```bash
# 在项目根目录执行
npm install mongoose
```

### 2. 配置 MongoDB 连接

创建或更新 `.env` 文件：

```bash
# MongoDB 连接字符串
MONGODB_URI=mongodb://localhost:27017/hot-news

# 或使用 MongoDB Atlas（推荐）
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/hot-news?retryWrites=true&w=majority
```

### 3. 集成到 server.js

在 `server.js` 中添加以下代码（在 `app.listen` 之前）：

```javascript
// 在文件顶部添加
const mongoose = require('mongoose');

// 在 app.get() 定义之后，app.listen() 之前添加
// 连接 MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hot-news', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB 连接成功'))
.catch(err => console.error('❌ MongoDB 连接失败:', err));

// 加载历史记录路由
const historyRoutes = require('./routes/historyRoutes');
app.use(`${BASE_PATH}/api/hot-news/history`, historyRoutes);
```

### 4. 自动保存热搜历史（可选）

在 `server.js` 的热搜获取端点中添加自动保存逻辑：

找到 `app.get('${BASE_PATH}/api/hot-news')` 端点，在返回数据前添加：

```javascript
// 在获取热搜数据后，自动保存历史记录
const HotNewsHistory = require('./models/HotNewsHistory');

app.get(`${BASE_PATH}/api/hot-news`, async (req, res) => {
    try {
        const { platform = 'networkhot', refresh = false } = req.query;
        const cacheKey = `hot-news-${platform}`;
        const cachedData = simpleCache.get(cacheKey);

        if (cachedData && !refresh) {
            return res.json(cachedData);
        }

        // ... 现有的获取热搜逻辑 ...

        const response = await axios.get(apiUrl);
        const newsData = response.data;

        // 保存到历史记录（新增）
        if (newsData && newsData.news && newsData.news.length > 0) {
            try {
                await HotNewsHistory.create({
                    platform: platform,
                    news: newsData.news.map((item, index) => ({
                        title: item.title,
                        heat: item.heat || 0,
                        rank: index + 1
                    }))
                });
                console.log(`✅ 已保存 ${newsData.news.length} 条热搜历史记录`);
            } catch (historyError) {
                console.error('❌ 保存历史记录失败:', historyError);
            }
        }

        simpleCache.set(cacheKey, newsData, 1800);
        return res.json(newsData);
    } catch (error) {
        console.error('获取热搜失败:', error);
        return res.status(500).json({ error: '获取热搜失败' });
    }
});
```

---

## 文件结构

新增文件：

```
ai-hot-news-board/
├── models/
│   └── HotNewsHistory.js          # 新增：历史记录数据模型
├── routes/
│   └── historyRoutes.js            # 新增：历史记录 API 路由
├── HISTORY-FEATURE-INSTALL.md      # 本文档
└── HISTORY-FEATURE-DEMO.md         # 功能演示文档
```

修改文件：

```
ai-hot-news-board/
├── server.js                     # 修改：添加 MongoDB 连接和路由
├── public/
│   ├── index.html                 # 修改：添加历史标签页
│   └── script.js                 # 修改：添加历史记录功能
└── .env                         # 修改：添加 MONGODB_URI
```

---

## 测试

### 1. 启动服务器

```bash
npm start
```

### 2. 验证 MongoDB 连接

你应该看到：
```
✅ MongoDB 连接成功
内容生成工作进程已启动
```

### 3. 访问应用

打开浏览器访问：http://localhost:3001/hot-news

### 4. 测试历史记录功能

1. **点击"历史"标签**
   - 应该看到历史记录列表

2. **筛选历史记录**
   - 选择日期
   - 选择平台
   - 点击"搜索"

3. **搜索历史记录**
   - 在搜索框输入关键词
   - 点击"搜索"

4. **查看历史内容**
   - 点击任意历史记录
   - 右侧应显示完整内容

### 5. 测试 API

```bash
# 测试获取历史记录
curl "http://localhost:3001/api/hot-news/history?platform=weibo&date=2026-01-11"

# 测试搜索历史记录
curl "http://localhost:3001/api/hot-news/history/search?q=热搜"

# 测试获取热搜趋势
curl "http://localhost:3001/api/hot-news/history/trend?title=测试&platform=weibo"
```

---

## MongoDB 数据库说明

### 数据库名

- 本地: `hot-news`
- Atlas: 由连接字符串指定

### 集合（Collections）

- `hotnewshistories` - 热搜历史记录集合

### 索引

系统会自动创建以下索引：

```javascript
// 平台和时间索引（复合索引）
{ platform: 1, snapshotTime: -1 }

// 标题全文搜索索引
{ title: 'text' }
```

---

## 故障排查

### MongoDB 连接失败

**问题**: `MongoServerError: bad auth`

**解决方案**:
1. 检查 `.env` 中的连接字符串
2. 确认用户名和密码正确
3. 检查 IP 白名单设置（Atlas）

**问题**: `MongooseServerSelectionError`

**解决方案**:
1. 检查 MongoDB 服务是否运行
2. 确认网络连接
3. 检查防火墙设置

### 历史记录不显示

**问题**: 历史记录列表为空

**解决方案**:
1. 检查 MongoDB 是否有数据
2. 确认已访问过热搜页面
3. 查看浏览器控制台错误

### API 返回 500 错误

**问题**: 服务器内部错误

**解决方案**:
1. 检查服务器日志
2. 确认 MongoDB 连接正常
3. 验证数据模型定义

---

## 生产环境部署

### 1. 使用 MongoDB Atlas（推荐）

1. 创建 Atlas 账户: https://www.mongodb.com/cloud/atlas
2. 创建免费集群
3. 配置 IP 白名单（0.0.0.0/0 表示允许所有 IP）
4. 创建数据库用户
5. 获取连接字符串

### 2. 配置环境变量

在 Vercel 或其他部署平台的环境变量中设置：

```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/hot-news?retryWrites=true&w=majority
```

### 3. 验证部署

```bash
# 测试 API 健康状态
curl https://your-domain.com/api/hot-news/history

# 查看历史记录
curl https://your-domain.com/api/hot-news/history?limit=10
```

---

## 数据维护

### 清理旧数据

```bash
# 删除 30 天前的历史记录
node -e "
const mongoose = require('mongoose');
const HotNewsHistory = require('./models/HotNewsHistory');

mongoose.connect(process.env.MONGODB_URI)
.then(async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await HotNewsHistory.deleteMany({
        snapshotTime: { \$lt: thirtyDaysAgo }
    });

    console.log(\`已删除 \${result.deletedCount} 条旧记录\`);
    process.exit(0);
})
.catch(err => {
    console.error('删除失败:', err);
    process.exit(1);
});
"
```

### 导出数据

```bash
# 导出历史记录到 JSON
node -e "
const mongoose = require('mongoose');
const HotNewsHistory = require('./models/HotNewsHistory');
const fs = require('fs');

mongoose.connect(process.env.MONGODB_URI)
.then(async () => {
    const history = await HotNewsHistory.find({})
        .sort({ snapshotTime: -1 })
        .limit(1000);

    fs.writeFileSync('history-export.json', JSON.stringify(history, null, 2));
    console.log('已导出', history.length, '条记录');
    process.exit(0);
});
"
```

---

## API 文档

### POST /api/hot-news/history

保存热搜历史记录。

**请求体**:
```json
{
  "platform": "weibo",
  "news": [
    {
      "title": "示例热搜",
      "heat": 100,
      "rank": 1
    }
  ]
}
```

**响应**:
```json
{
  "success": true,
  "count": 1
}
```

### GET /api/hot-news/history

获取历史记录列表。

**查询参数**:
- `platform` - 平台筛选 (可选)
- `date` - 日期筛选，格式: YYYY-MM-DD (可选)
- `limit` - 返回数量限制，默认 50 (可选)
- `skip` - 跳过数量，用于分页 (可选)

**示例**:
```
/api/hot-news/history?platform=weibo&date=2026-01-11&limit=20&skip=0
```

**响应**:
```json
[
  {
    "_id": "65a1b2c3d4e5f6g7h8i9j0k",
    "title": "示例热搜",
    "platform": "weibo",
    "heat": 100,
    "rank": 1,
    "snapshotTime": "2026-01-11T10:30:00.000Z",
    "createdAt": "2026-01-11T10:30:00.000Z",
    "content": {
      "text": "AI 生成的内容...",
      "articles": [...],
      "imageUrl": "https://..."
    }
  }
]
```

### GET /api/hot-news/history/trend

获取特定热搜的历史趋势。

**查询参数**:
- `title` - 热搜标题 (必需)
- `platform` - 平台筛选 (可选)

**示例**:
```
/api/hot-news/history/trend?title=示例热搜&platform=weibo
```

### GET /api/hot-news/history/search

搜索历史记录。

**查询参数**:
- `q` - 搜索关键词 (必需)
- `limit` - 返回数量限制，默认 50 (可选)

**示例**:
```
/api/hot-news/history/search?q=热搜&limit=20
```

### DELETE /api/hot-news/history/:id

删除单条历史记录。

**路径参数**:
- `id` - 历史记录 ID

**响应**:
```json
{
  "success": true
}
```

---

## 总结

通过以上步骤，你已成功将热搜历史记录功能集成到项目中。

主要功能：
- ✅ 自动保存热搜历史
- ✅ 按日期和平台筛选
- ✅ 全文搜索历史记录
- ✅ 查看热搜趋势
- ✅ 在前端查看历史内容

如遇问题，请参考"故障排查"部分或查看服务器日志。

---

**创建时间**: 2026-01-11
**文档版本**: 1.0
