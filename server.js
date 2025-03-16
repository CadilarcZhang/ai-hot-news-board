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

// 流式生成AI内容的接口 - 使用SSE (Server-Sent Events)
app.get(`${BASE_PATH}/api/generate`, async (req, res) => {
    const title = req.query.title;
    
    if (!title) {
        return res.status(400).json({ error: '标题不能为空' });
    }
    
    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // 禁用Nginx缓冲
    
    // 检查缓存中是否有该标题的内容
    const cacheKey = `content-${title}`;
    const cachedContent = simpleCache.get(cacheKey);
    
    // 标记响应是否已结束
    let isResponseEnded = false;
    
    // 安全写入函数，防止写入已关闭的流
    const safeWrite = (data) => {
        if (!isResponseEnded && !res.writableEnded && res.writable) {
            try {
                res.write(data);
            } catch (error) {
                console.error('写入响应时出错:', error);
                isResponseEnded = true;
            }
        }
    };
    
    // 安全结束函数，防止多次结束响应
    const safeEnd = () => {
        if (!isResponseEnded && !res.writableEnded && res.writable) {
            try {
                isResponseEnded = true;
                res.end();
            } catch (error) {
                console.error('结束响应时出错:', error);
            }
        }
    };
    
    // 处理客户端断开连接
    req.on('close', () => {
        isResponseEnded = true;
        console.log('客户端断开连接');
    });
    
    // 如果有缓存内容，分段发送以模拟流式效果
    if (cachedContent) {
        console.log(`从缓存获取内容: ${title}`);
        
        // 分段发送缓存内容，模拟流式效果
        const chunks = cachedContent.split('\n');
        
        // 立即发送第一段，减少用户等待感
        safeWrite(`data: ${JSON.stringify({ content: chunks[0] })}\n\n`);
        
        // 模拟流式发送其余段落
        let i = 1;
        const sendNextChunk = () => {
            if (i < chunks.length && !isResponseEnded) {
                if (chunks[i].trim()) {
                    safeWrite(`data: ${JSON.stringify({ content: chunks[i] })}\n\n`);
                }
                i++;
                setTimeout(sendNextChunk, 100); // 每100ms发送一段，加快速度
            } else if (!isResponseEnded) {
                safeWrite(`data: ${JSON.stringify({ done: true })}\n\n`);
                safeEnd();
            }
        };
        
        setTimeout(sendNextChunk, 100); // 快速开始发送
        return;
    }
    
    // 设置请求超时
    const timeout = setTimeout(() => {
        if (!isResponseEnded) {
            safeWrite(`data: ${JSON.stringify({ content: "\n\n很抱歉，服务器响应超时。🕒\n\n" })}\n\n`);
            safeWrite(`data: ${JSON.stringify({ content: "当前服务繁忙，请稍后再试。您也可以尝试刷新页面或选择其他热搜话题。" })}\n\n`);
            safeWrite(`data: ${JSON.stringify({ done: true })}\n\n`);
            safeEnd();
        }
    }, 15000); // 15秒超时
    
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
                "model": "deepseek-ai/DeepSeek-V3",
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
                // 不限制token数量，确Q保内容完整
                "temperature": 0.7, // 降低温度，使生成更确定性
                "top_p": 0.95,
                "response_format": {
                    "type": "text"
                }
            },
            responseType: 'stream',
            timeout: 10000 // 10秒超时
        });
        
        // 清除超时计时器
        clearTimeout(timeout);
        
        let fullContent = '';
        
        // 处理流式响应
        response.data.on('data', (chunk) => {
            if (isResponseEnded) return;
            
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
                if (line.trim() === '' || isResponseEnded) continue;
                
                if (line.startsWith('data: ')) {
                    const data = line.substring(6);
                    
                    if (data === '[DONE]') {
                        // 缓存生成的完整内容
                        if (fullContent.trim().length > 0) {
                            simpleCache.set(cacheKey, fullContent, 3600); // 缓存1小时
                        }
                        
                        safeWrite(`data: ${JSON.stringify({ done: true })}\n\n`);
                        safeEnd();
                        return;
                    }
                    
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.choices && 
                            parsed.choices[0] && 
                            parsed.choices[0].delta && 
                            parsed.choices[0].delta.content) {
                            
                            const content = parsed.choices[0].delta.content;
                            fullContent += content;
                            safeWrite(`data: ${JSON.stringify({ content })}\n\n`);
                        }
                    } catch (e) {
                        console.error('解析JSON出错:', e);
                    }
                }
            }
        });
        
        response.data.on('end', () => {
            // 如果没有正常完成，发送完成信号
            if (!isResponseEnded) {
                safeWrite(`data: ${JSON.stringify({ done: true })}\n\n`);
                safeEnd();
            }
        });
        
        response.data.on('error', (err) => {
            if (isResponseEnded) return;
            
            console.error('流处理错误:', err);
            
            // 如果出错，发送友好提示
            safeWrite(`data: ${JSON.stringify({ content: "\n\n很抱歉，服务暂时繁忙。🔄\n\n" })}\n\n`);
            safeWrite(`data: ${JSON.stringify({ content: "我们的AI助手正在处理大量请求，请稍后再试。您也可以尝试刷新页面或选择其他热搜话题。" })}\n\n`);
            safeWrite(`data: ${JSON.stringify({ done: true })}\n\n`);
            safeEnd();
        });
        
    } catch (error) {
        // 清除超时计时器
        clearTimeout(timeout);
        
        if (isResponseEnded) return;
        
        console.error('AI内容生成失败:', error);
        
        // 发送友好的错误提示
        safeWrite(`data: ${JSON.stringify({ content: "\n\n很抱歉，服务暂时不可用。⚠️\n\n" })}\n\n`);
        safeWrite(`data: ${JSON.stringify({ content: "我们的系统遇到了一些技术问题，请稍后再试。感谢您的理解和耐心。" })}\n\n`);
        safeWrite(`data: ${JSON.stringify({ done: true })}\n\n`);
        safeEnd();
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