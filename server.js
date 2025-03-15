const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3001;

// 创建简单的内存缓存对象
const simpleCache = {
    data: {},
    set: function(key, value, ttl) {
        const now = Date.now();
        const item = {
            value: value,
            expiry: now + (ttl * 1000) // ttl以秒为单位
        };
        this.data[key] = item;
    },
    get: function(key) {
        const item = this.data[key];
        if (!item) return null;
        
        const now = Date.now();
        if (now > item.expiry) {
            delete this.data[key];
            return null;
        }
        
        return item.value;
    }
};

// 配置CORS，允许所有来源访问API
app.use('/api', cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 解析JSON请求体
app.use(express.json());

// 显示调试信息
console.log('启动服务器...');
console.log('静态文件目录:', path.join(__dirname, 'public'));

// 提供静态文件
app.use(express.static(path.join(__dirname, 'public'), {
    index: 'index.html',
    extensions: ['html'],
    maxAge: '1d' // 添加缓存控制
}));

// 添加一个测试路由
app.get('/test', (req, res) => {
    res.send('服务器正在运行');
});

// 天行API密钥
const TIANAPI_KEY = 'eb50731204ecb974aa2fcc8f22478f42';

// AI API密钥
const AI_API_KEY = 'sk-pxmeadiyndbhhtvzvblpgnmyalwvhvvkikllrfjmkqzwtnvo';

// 获取热搜数据的接口
app.get('/api/hot-news', async (req, res) => {
    try {
        const platform = req.query.platform || 'weibo';
        
        // 尝试从缓存获取热搜数据
        const cacheKey = `hot-news-${platform}`;
        const cachedData = simpleCache.get(cacheKey);
        
        if (cachedData) {
            console.log(`从缓存获取${platform}热搜数据`);
            return res.json(cachedData);
        }
        
        // 根据平台选择不同的API接口
        let endpoint = '';
        switch(platform) {
            case 'weibo':
                endpoint = 'weibohot';
                break;
            case 'toutiao':
                endpoint = 'toutiaohot';
                break;
            case 'douyin':
                endpoint = 'douyinhot';
                break;
            default:
                endpoint = 'weibohot';
        }
        
        const apiUrl = `https://apis.tianapi.com/${endpoint}/index?key=${TIANAPI_KEY}`;
        
        const response = await axios.get(apiUrl);
        
        // 缓存结果，设置5分钟过期
        simpleCache.set(cacheKey, response.data, 300);
        
        res.json(response.data);
    } catch (error) {
        console.error('获取热搜数据失败:', error);
        res.status(500).json({ error: '获取热搜数据失败', message: error.message });
    }
});

// 备用内容生成函数
function generateFallbackContent(title) {
    const templates = [
        `🔥 "${title}"登上热搜！这个话题引发了广泛讨论，网友们纷纷表示关注。有人支持，有人反对，各种观点碰撞出不同的火花。你怎么看这个热门话题呢？`,
        `📱 "${title}"冲上热搜榜！这条热搜背后有什么故事？是突发事件还是持续关注的话题？无论如何，它已经成为今日网络讨论的焦点。`,
        `👀 "${title}"引发热议！这个话题为何如此受关注？可能是因为它触动了大众的某个敏感神经，也可能只是一个有趣的社会现象。`,
        `💬 "${title}"成为今日热点！网友们对此议论纷纷，各种观点和角度让这个话题更加立体。你有什么想法要分享吗？`,
        `🌟 "${title}"突然爆红！这个话题之所以能登上热搜，或许是因为它反映了当下的社会热点，或者触及了人们共同的情感共鸣。`
    ];
    
    // 随机选择一个模板
    return templates[Math.floor(Math.random() * templates.length)];
}

// 流式生成AI内容的接口
app.post('/api/generate-content', async (req, res) => {
    const { title } = req.body;
    
    if (!title) {
        return res.status(400).json({ error: '标题不能为空' });
    }
    
    // 设置响应头，支持流式输出
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // 设置超时处理
    const timeout = setTimeout(() => {
        res.write(`data: ${JSON.stringify({ content: "\n\n请求超时，请稍后再试... 🕒\n\n" })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
    }, 8000); // 设置8秒超时，低于Vercel的10秒限制
    
    try {
        // 创建AI API请求，添加超时设置
        const response = await axios({
            method: 'post',
            url: 'https://api.siliconflow.cn/v1/chat/completions',
            headers: {
                'Authorization': `Bearer ${AI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            data: {
                "model": "Qwen/QwQ-32B",
                "messages": [
                    {
                        "role": "system",
                        "content": "你是一位热搜解读专家，请根据热搜标题生成一段简短生动的解读，包含表情符号，语气活泼。回答控制在100字以内。"
                    },
                    {
                        "role": "user",
                        "content": `请简短解读这条热搜：${title}`
                    }
                ],
                "stream": true,
                "max_tokens": 200, // 减少token数量
                "temperature": 0.7,
                "top_p": 0.7,
                "response_format": {
                    "type": "text"
                }
            },
            responseType: 'stream',
            timeout: 7000 // 设置axios超时为7秒
        });
        
        // 清除超时计时器
        clearTimeout(timeout);
        
        // 处理流式响应
        response.data.on('data', (chunk) => {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
                if (line.trim() === '') continue;
                
                if (line.startsWith('data: ')) {
                    const data = line.substring(6);
                    
                    if (data === '[DONE]') {
                        res.write('data: [DONE]\n\n');
                        res.end();
                        return;
                    }
                    
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.choices && 
                            parsed.choices[0] && 
                            parsed.choices[0].delta && 
                            parsed.choices[0].delta.content) {
                            
                            const content = parsed.choices[0].delta.content;
                            res.write(`data: ${JSON.stringify({ content })}\n\n`);
                        }
                    } catch (e) {
                        console.error('解析JSON出错:', e);
                    }
                }
            }
        });
        
        response.data.on('end', () => {
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            res.end();
        });
        
        response.data.on('error', (err) => {
            console.error('流处理错误:', err);
            res.write(`data: ${JSON.stringify({ content: "\n\n生成内容时出错，请稍后再试... ⚠️\n\n" })}\n\n`);
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            res.end();
        });
        
    } catch (error) {
        // 清除超时计时器
        clearTimeout(timeout);
        
        console.error('AI内容生成失败:', error);
        res.write(`data: ${JSON.stringify({ content: "\n\n生成内容时出错，请稍后再试... ⚠️\n\n" })}\n\n`);
        res.write(`data: ${JSON.stringify({ content: "可能是AI服务暂时不可用，请稍后再尝试。" })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
    }
});

// 确保SPA路由处理正确
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 处理OPTIONS预检请求
app.options('/api/*', cors());

// 启动服务器
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`尝试访问 http://localhost:${PORT}/index.html`);
});

// 确保在最后导出app以供Vercel使用
module.exports = app; 