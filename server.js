const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3001;
const BASE_PATH = process.env.BASE_PATH || '/hot-news';

// 增强缓存对象，添加更多功能
const enhancedCache = {
    data: {},
    stats: { hits: 0, misses: 0, similarHits: 0 },
    set: function(key, value, ttl) {
        const now = Date.now();
        const item = {
            value: value,
            expiry: now + (ttl * 1000), // ttl以秒为单位
            createdAt: now,
            accessCount: 0
        };
        this.data[key] = item;
    },
    get: function(key) {
        const item = this.data[key];
        if (!item) {
            this.stats.misses++;
            return null;
        }
        
        const now = Date.now();
        if (now > item.expiry) {
            delete this.data[key];
            this.stats.misses++;
            return null;
        }
        
        // 更新访问计数和统计
        item.accessCount++;
        this.stats.hits++;
        
        return item.value;
    },
    // 延长缓存项的生命周期
    extend: function(key, additionalTtl) {
        const item = this.data[key];
        if (item) {
            item.expiry += (additionalTtl * 1000);
            return true;
        }
        return false;
    },
    // 获取缓存统计信息
    getStats: function() {
        return {
            ...this.stats,
            itemCount: Object.keys(this.data).length,
            hitRate: (this.stats.hits + this.stats.similarHits) / 
                     (this.stats.hits + this.stats.misses + this.stats.similarHits) * 100 || 0,
            similarHitRate: this.stats.similarHits / 
                           (this.stats.hits + this.stats.misses + this.stats.similarHits) * 100 || 0
        };
    },
    // 清理过期项目
    cleanup: function() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const key in this.data) {
            if (now > this.data[key].expiry) {
                delete this.data[key];
                cleaned++;
            }
        }
        
        return cleaned;
    },
    // 添加查找相似提示词的方法
    getSimilar: function(key, similarityThreshold = 0.8) {
        // 提取标题部分作为比较基础
        const titleMatch = key.match(/content-(.*)/);
        if (!titleMatch || !titleMatch[1]) return null;
        
        const title = titleMatch[1].toLowerCase();
        let bestMatch = null;
        let highestSimilarity = 0;
        
        // 遍历缓存中的所有键
        for (const cacheKey in this.data) {
            // 只比较内容类型的缓存
            if (!cacheKey.startsWith('content-')) continue;
            
            const cachedTitleMatch = cacheKey.match(/content-(.*)/);
            if (!cachedTitleMatch || !cachedTitleMatch[1]) continue;
            
            const cachedTitle = cachedTitleMatch[1].toLowerCase();
            
            // 计算相似度 (简单实现，可以用更复杂的算法)
            const similarity = this.calculateSimilarity(title, cachedTitle);
            
            if (similarity > similarityThreshold && similarity > highestSimilarity) {
                const item = this.data[cacheKey];
                // 检查是否过期
                if (Date.now() <= item.expiry) {
                    highestSimilarity = similarity;
                    bestMatch = {
                        key: cacheKey,
                        value: item.value,
                        similarity: similarity
                    };
                }
            }
        }
        
        if (bestMatch) {
            this.stats.similarHits++;
            console.log(`找到相似提示词缓存: ${bestMatch.key} (相似度: ${bestMatch.similarity.toFixed(2)})`);
        }
        
        return bestMatch;
    },
    
    // 简单的相似度计算函数 (Jaccard 相似度)
    calculateSimilarity: function(str1, str2) {
        // 将字符串分解为字符集合
        const set1 = new Set(str1.split(''));
        const set2 = new Set(str2.split(''));
        
        // 计算交集大小
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        
        // 计算并集大小
        const union = new Set([...set1, ...set2]);
        
        // 计算 Jaccard 相似度
        return intersection.size / union.size;
    }
};

// 替换原有的 simpleCache
const simpleCache = enhancedCache;

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
        
        // 缓存结果，设置15分钟过期（增加缓存时间）
        simpleCache.set(cacheKey, response.data, 900);
        
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
    let cachedContent = simpleCache.get(cacheKey);
    
    // 如果没有精确匹配，尝试查找相似的提示词
    if (!cachedContent) {
        const similarMatch = simpleCache.getSimilar(cacheKey);
        if (similarMatch) {
            cachedContent = similarMatch.value;
            console.log(`使用相似提示词缓存: "${title}" => "${similarMatch.key.replace('content-', '')}"`);
            
            // 同时为当前标题创建缓存，避免下次再查找
            simpleCache.set(cacheKey, cachedContent, 86400); // 缓存24小时
        }
    }
    
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
                // 不限制token数量，确保内容完整
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
                        // 缓存生成的完整内容，增加缓存时间到24小时
                        if (fullContent.trim().length > 0) {
                            simpleCache.set(cacheKey, fullContent, 86400); // 缓存24小时
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

// 图片生成API
app.post(`${BASE_PATH}/api/generate-image`, async (req, res) => {
    try {
        const { prompt, title } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: '提示词不能为空' });
        }
        
        // 检查缓存中是否有该标题的图片
        const cacheKey = `image-${title}`;
        let cachedImage = simpleCache.get(cacheKey);
        
        // 如果没有精确匹配，尝试查找相似的提示词
        if (!cachedImage) {
            const similarMatch = simpleCache.getSimilar(cacheKey, 0.7); // 图片可以用更低的相似度阈值
            if (similarMatch) {
                cachedImage = similarMatch.value;
                console.log(`使用相似图片缓存: "${title}" => "${similarMatch.key.replace('image-', '')}"`);
                
                // 同时为当前标题创建缓存，避免下次再查找
                simpleCache.set(cacheKey, cachedImage, 3600 * 24); // 缓存24小时
                
                return res.json({ image: cachedImage });
            }
        } else {
            console.log(`从缓存获取图片: ${title}`);
            return res.json({ image: cachedImage });
        }
        
        // 调用图片生成API
        const response = await axios({
            method: 'post',
            url: 'https://api.siliconflow.cn/v1/images/generations',
            headers: {
                'Authorization': `Bearer ${AI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            data: {
                "model": "Kwai-Kolors/Kolors",
                "prompt": prompt,
                "negative_prompt": "低质量，模糊，变形，文字，水印",
                "image_size": "1024x1024",
                "batch_size": 1,
                "seed": Math.floor(Math.random() * 1000000),
                "num_inference_steps": 20,
                "guidance_scale": 7.5
            },
            timeout: 30000 // 30秒超时，避免长时间等待
        });
        
        // 获取生成的图片URL
        const imageUrl = response.data.data[0].url;
        
        // 缓存图片URL
        simpleCache.set(cacheKey, imageUrl, 3600 * 24); // 缓存24小时
        
        res.json({ image: imageUrl });
    } catch (error) {
        console.error('图片生成失败:', error);
        res.status(500).json({ error: '图片生成失败', message: error.message });
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

// 添加缓存清理定时任务
setInterval(() => {
    const cleaned = simpleCache.cleanup();
    if (cleaned > 0) {
        console.log(`缓存清理完成，移除了 ${cleaned} 个过期项目`);
    }
}, 3600000); // 每小时清理一次

// 添加缓存统计接口（仅供内部使用）
app.get(`${BASE_PATH}/api/cache-stats`, (req, res) => {
    // 简单的API密钥验证，实际应用中应使用更安全的方法
    const apiKey = req.query.key;
    if (apiKey !== 'admin-secret-key') {
        return res.status(403).json({ error: '未授权访问' });
    }
    
    res.json(simpleCache.getStats());
});

// 添加提示词缓存预热功能
app.post(`${BASE_PATH}/api/cache-warmup`, async (req, res) => {
    // 简单的API密钥验证
    const apiKey = req.query.key;
    if (apiKey !== 'admin-secret-key') {
        return res.status(403).json({ error: '未授权访问' });
    }
    
    const { titles } = req.body;
    
    if (!titles || !Array.isArray(titles) || titles.length === 0) {
        return res.status(400).json({ error: '请提供有效的标题列表' });
    }
    
    // 限制批量预热的数量
    const maxWarmupCount = 10;
    const titlesToWarmup = titles.slice(0, maxWarmupCount);
    
    res.json({ 
        message: '缓存预热任务已启动', 
        count: titlesToWarmup.length,
        titles: titlesToWarmup
    });
    
    // 异步执行预热任务
    (async () => {
        console.log(`开始缓存预热，共 ${titlesToWarmup.length} 个标题`);
        
        for (const title of titlesToWarmup) {
            const cacheKey = `content-${title}`;
            
            // 检查是否已经有缓存
            if (simpleCache.get(cacheKey)) {
                console.log(`标题已有缓存，跳过: ${title}`);
                continue;
            }
            
            // 检查是否有相似缓存
            if (simpleCache.getSimilar(cacheKey)) {
                console.log(`标题有相似缓存，跳过: ${title}`);
                continue;
            }
            
            try {
                console.log(`预热缓存: ${title}`);
                
                // 调用AI API生成内容
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
                        "temperature": 0.7,
                        "top_p": 0.95,
                        "response_format": {
                            "type": "text"
                        }
                    },
                    timeout: 15000 // 15秒超时
                });
                
                // 缓存生成的内容
                if (response.data && response.data.choices && response.data.choices[0].message.content) {
                    const content = response.data.choices[0].message.content;
                    simpleCache.set(cacheKey, content, 86400); // 缓存24小时
                    console.log(`缓存预热成功: ${title}`);
                }
                
                // 避免API限流，添加延迟
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error) {
                console.error(`缓存预热失败: ${title}`, error);
            }
        }
        
        console.log('缓存预热完成');
    })();
}); 