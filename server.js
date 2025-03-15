const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3001;
const BASE_PATH = process.env.BASE_PATH || '/hot-news';

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
app.use(`${BASE_PATH}/api`, cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 解析JSON请求体
app.use(express.json());

// 显示调试信息
console.log('启动服务器...');
console.log('静态文件目录:', path.join(__dirname, 'public'));
console.log('基础路径:', BASE_PATH);

// 提供静态文件，注意路径前缀
app.use(`${BASE_PATH}`, express.static(path.join(__dirname, 'public'), {
    index: 'index.html',
    extensions: ['html'],
    maxAge: '1d'
}));

// 添加一个测试路由
app.get(`${BASE_PATH}/test`, (req, res) => {
    res.send('服务器正在运行');
});

// 天行API密钥
const TIANAPI_KEY = 'eb50731204ecb974aa2fcc8f22478f42';

// AI API密钥
const AI_API_KEY = 'sk-pxmeadiyndbhhtvzvblpgnmyalwvhvvkikllrfjmkqzwtnvo';

// 获取热搜数据的接口
app.get(`${BASE_PATH}/api/hot-news`, async (req, res) => {
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

// 流式生成AI内容的接口
app.post(`${BASE_PATH}/api/generate-content`, async (req, res) => {
    const { title } = req.body;
    
    if (!title) {
        return res.status(400).json({ error: '标题不能为空' });
    }
    
    // 设置响应头，支持流式输出
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // 检查缓存中是否有该标题的内容
    const cacheKey = `content-${title}`;
    const cachedContent = simpleCache.get(cacheKey);
    
    // 如果有缓存内容，直接返回
    if (cachedContent) {
        console.log(`从缓存获取内容: ${title}`);
        
        // 分段发送缓存内容，模拟流式效果
        const chunks = cachedContent.split('\n');
        
        // 立即发送第一段，减少用户等待感
        res.write(`data: ${JSON.stringify({ content: chunks[0] })}\n\n`);
        
        // 模拟流式发送其余段落
        let i = 1;
        const sendNextChunk = () => {
            if (i < chunks.length) {
                if (chunks[i].trim()) {
                    res.write(`data: ${JSON.stringify({ content: chunks[i] })}\n\n`);
                }
                i++;
                setTimeout(sendNextChunk, 100); // 每100ms发送一段，加快速度
            } else {
                res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                res.end();
            }
        };
        
        setTimeout(sendNextChunk, 100); // 快速开始发送
        return;
    }
    
    // 设置请求超时
    const timeout = setTimeout(() => {
        res.write(`data: ${JSON.stringify({ content: "\n\n很抱歉，服务器响应超时。🕒\n\n" })}\n\n`);
        res.write(`data: ${JSON.stringify({ content: "当前服务繁忙，请稍后再试。您也可以尝试刷新页面或选择其他热搜话题。" })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
    }, 15000); // 减少超时时间到15秒
    
    try {
        // 创建AI API请求
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
                        "content": "你是一位热搜解读专家，请直接生成一段生动有趣的解读，包含表情符号，语气活泼，像社交媒体博主的风格。内容要有深度，至少包含3-4个段落，每个段落至少3-4句话。要包含一些数据分析、社会影响和个人观点。不要有思考过程，直接给出最终内容。"
                    },
                    {
                        "role": "user",
                        "content": `请直接解读这条热搜：${title}，内容要丰富，必须包含表情符号，分析社会影响。不要有思考过程，直接给出最终内容。`
                    }
                ],
                "stream": true,
                // 不限制token数量，确保内容完整
                "temperature": 0.7, // 降低温度，使生成更确定性
                "top_p": 0.95,
                "response_format": {
                    "type": "text"
                }
            },
            responseType: 'stream',
            timeout: 20000 // 减少请求超时时间
        });
        
        // 清除超时计时器
        clearTimeout(timeout);
        
        let isCompleted = false;
        let buffer = '';
        let fullContent = ''; // 用于缓存完整内容
        
        // 处理流式响应
        response.data.on('data', (chunk) => {
            buffer += chunk.toString();
            
            // 尝试处理缓冲区中的所有完整行
            let newlineIndex;
            while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                const line = buffer.slice(0, newlineIndex).trim();
                buffer = buffer.slice(newlineIndex + 1);
                
                if (!line) continue;
                
                if (line.startsWith('data: ')) {
                    const data = line.substring(6);
                    
                    if (data === '[DONE]') {
                        isCompleted = true;
                        
                        // 缓存生成的完整内容
                        if (fullContent.trim().length > 100) { // 只缓存有意义的内容
                            simpleCache.set(cacheKey, fullContent, 3600); // 缓存1小时
                        }
                        
                        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                        continue;
                    }
                    
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.choices && 
                            parsed.choices[0] && 
                            parsed.choices[0].delta && 
                            parsed.choices[0].delta.content) {
                            
                            const content = parsed.choices[0].delta.content;
                            fullContent += content; // 累积完整内容
                            res.write(`data: ${JSON.stringify({ content })}\n\n`);
                        }
                    } catch (e) {
                        console.error('解析JSON出错:', e, 'Line:', data);
                        // 继续处理，不中断
                    }
                }
            }
        });
        
        response.data.on('end', () => {
            // 如果没有正常完成，发送完成信号
            if (!isCompleted) {
                // 缓存生成的完整内容
                if (fullContent.trim().length > 100) { // 只缓存有意义的内容
                    simpleCache.set(cacheKey, fullContent, 3600); // 缓存1小时
                }
                
                res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            }
            res.end();
        });
        
        response.data.on('error', (err) => {
            console.error('流处理错误:', err);
            
            // 如果出错，发送友好提示
            res.write(`data: ${JSON.stringify({ content: "\n\n很抱歉，服务暂时繁忙。🔄\n\n" })}\n\n`);
            res.write(`data: ${JSON.stringify({ content: "我们的AI助手正在处理大量请求，请稍后再试。您也可以尝试刷新页面或选择其他热搜话题。" })}\n\n`);
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            res.end();
        });
        
    } catch (error) {
        // 清除超时计时器
        clearTimeout(timeout);
        
        console.error('AI内容生成失败:', error);
        
        // 发送友好的错误提示，不再生成备用内容
        res.write(`data: ${JSON.stringify({ content: "\n\n很抱歉，服务暂时不可用。⚠️\n\n" })}\n\n`);
        res.write(`data: ${JSON.stringify({ content: "我们的系统遇到了一些技术问题，请稍后再试。感谢您的理解和耐心。" })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
    }
});

// 确保SPA路由处理正确
app.get(`${BASE_PATH}/*`, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 处理OPTIONS预检请求
app.options(`${BASE_PATH}/api/*`, cors());

// 添加根路径重定向
app.get('/', (req, res) => {
    res.redirect(BASE_PATH);
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`应用访问地址: http://localhost:${PORT}${BASE_PATH}`);
});

// 确保在最后导出app以供Vercel使用
module.exports = app; 