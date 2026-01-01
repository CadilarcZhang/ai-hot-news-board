const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const cheerio = require('cheerio');
const app = express();
const PORT = process.env.PORT || 3001;
// 在 Vercel 上，BASE_PATH 应该为空字符串，使用根路径
// 如果 BASE_PATH 为空字符串，则使用 '/' 作为静态文件路径
const BASE_PATH = process.env.BASE_PATH !== undefined ? process.env.BASE_PATH : '/hot-news';
const STATIC_PATH = BASE_PATH || '/';

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
// 在 Vercel 上，BASE_PATH 为空时使用根路径
app.use(STATIC_PATH, express.static(path.join(__dirname, 'public'), {
    index: 'index.html',
    extensions: ['html'],
    maxAge: '1d'
}));

// 如果 BASE_PATH 不为空，同时提供根路径的静态文件服务（用于本地开发）
// 这样无论 HTML 中使用绝对路径还是相对路径都能工作
// 只提供静态资源文件（js, css, 图片等），不提供 HTML 文件
if (BASE_PATH && BASE_PATH !== '/') {
    // 创建一个静态文件中间件，只处理静态资源
    const staticMiddleware = express.static(path.join(__dirname, 'public'), {
        index: false, // 不提供 index.html
        maxAge: '1d'
    });
    
    app.use('/', (req, res, next) => {
        // 只处理静态资源文件请求，不处理 HTML 或其他路由
        const staticExtensions = ['.js', '.css', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webmanifest', '.woff', '.woff2', '.ttf', '.eot'];
        const hasStaticExtension = staticExtensions.some(ext => req.path.toLowerCase().endsWith(ext));
        
        if (hasStaticExtension) {
            // 使用静态文件中间件提供文件
            staticMiddleware(req, res, next);
        } else {
            next(); // 不是静态文件请求，继续到下一个中间件
        }
    });
}

// 添加一个测试路由
app.get(`${BASE_PATH}/test`, (req, res) => {
    res.send('服务器正在运行');
});

// 天行API密钥（优先使用环境变量）
const TIANAPI_KEY = process.env.TIANAPI_KEY || 'eb50731204ecb974aa2fcc8f22478f42';

// AI API密钥（优先使用环境变量）
const AI_API_KEY = process.env.AI_API_KEY || 'sk-pxmeadiyndbhhtvzvblpgnmyalwvhvvkikllrfjmkqzwtnvo';

// 获取热搜数据的接口
app.get(`${BASE_PATH}/api/hot-news`, async (req, res) => {
    try {
        const platform = req.query.platform || 'networkhot';
        
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
                endpoint = 'networkhot';
        }
        
        const apiUrl = `https://apis.tianapi.com/${endpoint}/index?key=${TIANAPI_KEY}`;
        
        const response = await axios.get(apiUrl);
        // console.log(JSON.stringify(response.data));
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
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // 禁用Nginx缓冲
    res.setHeader('Transfer-Encoding', 'chunked'); // 确保使用分块传输
    // Vercel 特定优化
    res.setHeader('X-Vercel-Cache-Control', 'no-cache');
    
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
                // 确保数据是字符串格式，使用UTF-8编码
                const dataStr = typeof data === 'string' ? data : String(data);
                res.write(dataStr, 'utf8');
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
    }, 30000); // 增加到30秒超时，适应Vercel环境
    
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
                "model": "deepseek-ai/DeepSeek-V3.2-Exp",
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
            timeout: 30000 // 增加到30秒超时，适应Vercel环境
        });
        
        // 清除超时计时器
        clearTimeout(timeout);
        
        let fullContent = '';
        let buffer = ''; // 添加缓冲区来处理跨chunk的数据
        
        // 处理流式响应
        response.data.on('data', (chunk) => {
            if (isResponseEnded) return;
            
            // 将新数据添加到缓冲区
            buffer += chunk.toString();
            
            // 按行分割，但保留最后一行（可能不完整）
            const lines = buffer.split('\n');
            // 保留最后一行在缓冲区中（如果它不以换行符结尾）
            buffer = lines.pop() || '';
            
            // 处理完整的行
            for (const line of lines) {
                if (isResponseEnded) break;
                
                // 跳过空行
                if (line.trim() === '') continue;
                
                // 处理SSE数据行
                if (line.startsWith('data: ')) {
                    const data = line.substring(6).trim();
                    
                    // 检查是否是结束标记
                    if (data === '[DONE]') {
                        // 缓存生成的完整内容，增加缓存时间到24小时
                        if (fullContent.trim().length > 0) {
                            simpleCache.set(cacheKey, fullContent, 86400); // 缓存24小时
                        }
                        
                        safeWrite(`data: ${JSON.stringify({ done: true })}\n\n`);
                        safeEnd();
                        return;
                    }
                    
                    // 尝试解析JSON数据
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.choices && 
                            parsed.choices[0] && 
                            parsed.choices[0].delta && 
                            parsed.choices[0].delta.content) {
                            
                            const content = parsed.choices[0].delta.content;
                            if (content) {
                                fullContent += content;
                                safeWrite(`data: ${JSON.stringify({ content })}\n\n`);
                            }
                        }
                    } catch (e) {
                        // 如果JSON解析失败，可能是数据不完整，记录但不中断
                        console.error('解析JSON出错:', e, '数据:', data.substring(0, 100));
                        // 不中断流，继续处理下一行
                    }
                }
            }
        });
        
        response.data.on('end', () => {
            // 处理缓冲区中剩余的数据
            if (buffer.trim() && !isResponseEnded) {
                const lines = buffer.split('\n');
                for (const line of lines) {
                    if (line.trim() === '' || isResponseEnded) continue;
                    
                    if (line.startsWith('data: ')) {
                        const data = line.substring(6).trim();
                        
                        if (data === '[DONE]') {
                            if (fullContent.trim().length > 0) {
                                simpleCache.set(cacheKey, fullContent, 86400);
                            }
                            break;
                        }
                        
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.choices && 
                                parsed.choices[0] && 
                                parsed.choices[0].delta && 
                                parsed.choices[0].delta.content) {
                                
                                const content = parsed.choices[0].delta.content;
                                if (content) {
                                    fullContent += content;
                                    safeWrite(`data: ${JSON.stringify({ content })}\n\n`);
                                }
                            }
                        } catch (e) {
                            console.error('处理缓冲区数据时出错:', e);
                        }
                    }
                }
            }
            
            // 如果没有正常完成，发送完成信号
            if (!isResponseEnded) {
                // 缓存生成的完整内容
                if (fullContent.trim().length > 0) {
                    simpleCache.set(cacheKey, fullContent, 86400);
                }
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

// ==================== 联网搜索和内容抓取工具函数 ====================

/**
 * 搜索新闻文章
 * @param {string} query - 搜索关键词
 * @returns {Promise<Array>} 返回搜索结果数组，包含标题、链接、摘要
 */
async function searchNews(query) {
    try {
        // 方法1: 使用Google Custom Search API（如果配置了）
        const GOOGLE_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
        const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;
        
        if (GOOGLE_API_KEY && GOOGLE_SEARCH_ENGINE_ID) {
            try {
                const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&num=5`;
                const googleResponse = await axios.get(googleUrl, { timeout: 10000 });
                
                if (googleResponse.data.items && googleResponse.data.items.length > 0) {
                    return googleResponse.data.items.map(item => ({
                        title: item.title,
                        link: item.link,
                        snippet: item.snippet || ''
                    }));
                }
            } catch (googleError) {
                console.error('Google搜索失败，尝试备用方法:', googleError.message);
            }
        }
        
        // 方法2: 使用百度搜索（备用方法，可能被反爬虫）
        try {
            const searchUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}&tn=news`;
            
            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    'Referer': 'https://www.baidu.com/'
                },
                timeout: 10000,
                maxRedirects: 5
            });
            
            const $ = cheerio.load(response.data);
            const results = [];
            
            // 解析百度搜索结果 - 尝试多种选择器
            $('.result, .c-result, .result-op').each((index, element) => {
                if (results.length >= 5) return false; // 最多取5个结果
                
                const $el = $(element);
                const title = $el.find('h3 a, .t a, .c-title-text').text().trim();
                let link = $el.find('h3 a, .t a').attr('href') || $el.find('a').first().attr('href');
                const snippet = $el.find('.c-abstract, .c-span9, .c-abstract-text, .c-color-text').text().trim();
                
                if (title && link) {
                    // 处理百度跳转链接
                    if (link.startsWith('/link?url=')) {
                        // 尝试提取真实URL
                        try {
                            const urlMatch = link.match(/url=([^&]+)/);
                            if (urlMatch) {
                                link = decodeURIComponent(urlMatch[1]);
                            }
                        } catch (e) {
                            // 如果解析失败，跳过这个结果
                            return;
                        }
                    }
                    
                    if (link && link.startsWith('http')) {
                        results.push({
                            title,
                            link: link,
                            snippet: snippet || title
                        });
                    }
                }
            });
            console.log("百度搜索结果: " + JSON.stringify(results));
            if (results.length > 0) {
                return results;
            }
        } catch (baiduError) {
            console.error('百度搜索失败:', baiduError.message);
        }
        
        // 如果都失败了，返回空数组
        return [];
    } catch (error) {
        console.error('搜索新闻失败:', error);
        return [];
    }
}

/**
 * 抓取网页主要内容
 * @param {string} url - 网页URL
 * @returns {Promise<string>} 返回网页主要内容文本
 */
async function fetchArticleContent(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Referer': 'https://www.baidu.com/'
            },
            timeout: 10000,
            maxRedirects: 5
        });
        
        const $ = cheerio.load(response.data);
        
        // 移除不需要的元素
        $('script, style, nav, header, footer, aside, .ad, .advertisement, .comment, .comments').remove();
        
        // 尝试多种选择器来提取主要内容
        let content = '';
        
        // 方法1: 查找常见的文章内容选择器
        const contentSelectors = [
            'article',
            'section',
            '.pages_content',
            '.article-content',
            '.content',
            '.post-content',
            '.entry-content',
            '#content', 
            '.main-content',
            '.news-content',
            '.article-body',
            '.article-text',    
            'p'
        ];
        
        for (const selector of contentSelectors) {
            const $content = $(selector);
            if ($content.length > 0) {
                content = $content.text().trim();
                if (content.length > 200) { // 确保内容足够长
                    break;
                }
            }
        }
        
        // 方法2: 如果没找到，尝试提取所有段落
        if (content.length < 200) {
            const paragraphs = [];
            $('p').each((index, el) => {
                const text = $(el).text().trim();
                if (text.length > 50) { // 过滤太短的段落
                    paragraphs.push(text);
                }
            });
            content = paragraphs.join('\n\n');
        }
        
        // 清理内容：移除多余空白、换行
        content = content.replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
        
        // 限制内容长度（避免token过多）
        if (content.length > 5000) {
            content = content.substring(0, 5000) + '...';
        }
        
        return content;
    } catch (error) {
        console.error(`抓取网页内容失败 (${url}):`, error.message);
        return '';
    }
}

/**
 * 从多个搜索结果中提取并合并内容
 * @param {string} query - 搜索关键词
 * @returns {Promise<Object>} 返回包含文章内容和文章信息的对象
 */
async function fetchMultipleArticles(query) {
    try {
        // 搜索相关新闻
        const searchResults = await searchNews(query);
        
        if (searchResults.length === 0) {
            return { content: null, articles: [] };
        }
        
        // 抓取前3个搜索结果的内容
        const articles = [];
        for (let i = 0; i < Math.min(3, searchResults.length); i++) {
            const result = searchResults[i];
            // console.log(`正在抓取: ${result.title} - ${result.link}`);
            
            const content = await fetchArticleContent(result.link);
            console.log("网页抓取文章内容: " + content);
            if (content && content.length > 200) {
                articles.push({
                    title: result.title,
                    content: content,
                    source: result.link
                });
            }
            
            // 避免请求过快
            if (i < Math.min(3, searchResults.length) - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        if (articles.length === 0) {
            return { content: null, articles: [] };
        }
        console.log("articles: " + JSON.stringify(articles));
        
        // 合并多篇文章内容
        let combinedContent = `根据搜索关键词"${query}"，我找到了以下相关新闻文章：\n\n`;
        
        articles.forEach((article, index) => {
            combinedContent += `【文章${index + 1}】${article.title}\n`;
            combinedContent += `来源：${article.source}\n\n`;
            combinedContent += `${article.content}\n\n`;
            combinedContent += '---\n\n';
        });
        
        // 返回内容和文章信息
        return {
            content: combinedContent,
            articles: articles.map(article => ({
                title: article.title,
                link: article.source
            }))
        };
    } catch (error) {
        console.error('获取多篇文章失败:', error);
        return { content: null, articles: [] };
    }
}

// ==================== 基于联网搜索的内容生成API ====================

// 流式生成AI内容的接口（基于联网搜索）- 使用SSE
app.get(`${BASE_PATH}/api/generate-with-search`, async (req, res) => {
    const title = req.query.title;
    
    if (!title) {
        return res.status(400).json({ error: '标题不能为空' });
    }
    
    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Vercel-Cache-Control', 'no-cache');
    
    // 定义响应状态和工具函数
    let isResponseEnded = false;
    
    const safeWrite = (data) => {
        if (!isResponseEnded && !res.writableEnded && res.writable) {
            try {
                const dataStr = typeof data === 'string' ? data : String(data);
                res.write(dataStr, 'utf8');
            } catch (error) {
                console.error('写入响应时出错:', error);
                isResponseEnded = true;
            }
        }
    };
    
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
    
    // 检查缓存
    const cacheKey = `content-search-${title}`;
    const cacheArticlesKey = `articles-search-${title}`;
    let cachedContent = simpleCache.get(cacheKey);
    let cachedArticles = simpleCache.get(cacheArticlesKey);
    
    if (cachedContent) {
        console.log(`从缓存获取搜索生成内容: ${title}`);
        
        // 如果有缓存的文章链接，先发送
        if (cachedArticles && cachedArticles.length > 0) {
            safeWrite(`data: ${JSON.stringify({ 
                type: 'sources',
                articles: cachedArticles 
            })}\n\n`);
        }
        
        // 分段发送缓存内容
        const chunks = cachedContent.split('\n');
        safeWrite(`data: ${JSON.stringify({ content: chunks[0] })}\n\n`);
        
        let i = 1;
        const sendNextChunk = () => {
            if (i < chunks.length && !res.writableEnded) {
                if (chunks[i].trim()) {
                    safeWrite(`data: ${JSON.stringify({ content: chunks[i] })}\n\n`);
                }
                i++;
                setTimeout(sendNextChunk, 100);
            } else if (!res.writableEnded) {
                safeWrite(`data: ${JSON.stringify({ done: true })}\n\n`);
                safeEnd();
            }
        };
        setTimeout(sendNextChunk, 100);
        return;
    }
    
    req.on('close', () => {
        isResponseEnded = true;
        console.log('客户端断开连接');
    });
    
    // 设置超时
    const timeout = setTimeout(() => {
        if (!isResponseEnded) {
            safeWrite(`data: ${JSON.stringify({ content: "\n\n很抱歉，搜索和生成内容超时。🕒\n\n" })}\n\n`);
            safeWrite(`data: ${JSON.stringify({ content: "当前服务繁忙，请稍后再试。" })}\n\n`);
            safeWrite(`data: ${JSON.stringify({ done: true })}\n\n`);
            safeEnd();
        }
    }, 60000); // 60秒超时（搜索需要更长时间）
    
    // 定义articlesData变量，以便在后续作用域中使用
    let articlesData = { content: null, articles: [] };
    
    try {
        // 步骤1: 发送搜索提示
        safeWrite(`data: ${JSON.stringify({ content: "🔍 正在搜索相关新闻..." })}\n\n`);
        
        // 步骤2: 搜索并抓取文章内容
        articlesData = await fetchMultipleArticles(title);
        console.log("合并多篇文章内容: " + JSON.stringify(articlesData));
        
        // 发送文章链接信息（如果有）
        if (articlesData.articles && articlesData.articles.length > 0) {
            safeWrite(`data: ${JSON.stringify({ 
                type: 'sources',
                articles: articlesData.articles 
            })}\n\n`);
        }
        
        const articlesContent = articlesData.content;
        if (!articlesContent || articlesContent.length < 200) {
            clearTimeout(timeout);
            safeWrite(`data: ${JSON.stringify({ content: "\n\n⚠️ 未能找到足够的新闻内容，将使用AI生成解读。\n\n" })}\n\n`);
            
            // 如果搜索失败，回退到原有的生成方式
            // 这里可以调用原有的生成逻辑，或者直接结束
            // 为了保持功能独立，我们继续使用搜索到的内容，即使内容较少
        } else {
            safeWrite(`data: ${JSON.stringify({ content: "✅ 已找到相关新闻，正在生成摘要...\n\n" })}\n\n`);
        }
        
        // 步骤3: 使用AI对抓取的内容进行摘要
        const prompt = articlesContent 
            ? `请基于以下真实新闻文章内容，为热搜话题"${title}"生成一份准确、客观的新闻摘要。要求：
                1. 基于提供的真实新闻内容，不要编造信息
                2. 提取关键事实和数据
                3. 分析事件的影响和意义
                4. 语言生动有趣，包含适当的表情符号
                5. 至少3-4个段落，每个段落3-4句话
                6. 直接给出最终内容，不要有思考过程

                真实新闻内容：
                ${articlesContent}

                请生成摘要：`
            : `请为热搜话题"${title}"生成一份新闻解读。由于未能获取到足够的真实新闻内容，请基于你的知识生成一份客观的分析。要求语言生动有趣，包含表情符号，至少3-4个段落。`;
        
        // 创建AI API请求
        const response = await axios({
            method: 'post',
            url: 'https://api.siliconflow.cn/v1/chat/completions',
            headers: {
                'Authorization': `Bearer ${AI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            data: {
                "model": "deepseek-ai/DeepSeek-V3.2-Exp",
                "messages": [
                    {
                        "role": "system",
                        "content": "你是一位专业的新闻摘要专家，擅长基于真实新闻内容生成准确、客观的摘要。你会仔细分析提供的新闻内容，提取关键信息，并生成结构清晰、语言生动的摘要。"
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "stream": true,
                "temperature": 0.7,
                "top_p": 0.95,
                "response_format": {
                    "type": "text"
                }
            },
            responseType: 'stream',
            timeout: 30000
        });
        
        clearTimeout(timeout);
        
        let fullContent = '';
        let buffer = '';
        
        // 处理流式响应
        response.data.on('data', (chunk) => {
            if (isResponseEnded) return;
            
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
                if (isResponseEnded) break;
                if (line.trim() === '') continue;
                
                if (line.startsWith('data: ')) {
                    const data = line.substring(6).trim();
                    
                    if (data === '[DONE]') {
                        if (fullContent.trim().length > 0) {
                            simpleCache.set(cacheKey, fullContent, 86400);
                            // 同时缓存文章链接信息
                            if (articlesData.articles && articlesData.articles.length > 0) {
                                simpleCache.set(cacheArticlesKey, articlesData.articles, 86400);
                            }
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
                            if (content) {
                                fullContent += content;
                                safeWrite(`data: ${JSON.stringify({ content })}\n\n`);
                            }
                        }
                    } catch (e) {
                        console.error('解析JSON出错:', e);
                    }
                }
            }
        });
        
        response.data.on('end', () => {
            if (buffer.trim() && !isResponseEnded) {
                const lines = buffer.split('\n');
                for (const line of lines) {
                    if (line.trim() === '' || isResponseEnded) continue;
                    if (line.startsWith('data: ')) {
                        const data = line.substring(6).trim();
                        if (data === '[DONE]') {
                            if (fullContent.trim().length > 0) {
                                simpleCache.set(cacheKey, fullContent, 86400);
                            }
                            break;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.choices && 
                                parsed.choices[0] && 
                                parsed.choices[0].delta && 
                                parsed.choices[0].delta.content) {
                                const content = parsed.choices[0].delta.content;
                                if (content) {
                                    fullContent += content;
                                    safeWrite(`data: ${JSON.stringify({ content })}\n\n`);
                                }
                            }
                        } catch (e) {
                            console.error('处理缓冲区数据时出错:', e);
                        }
                    }
                }
            }
            
            if (!isResponseEnded) {
                if (fullContent.trim().length > 0) {
                    simpleCache.set(cacheKey, fullContent, 86400);
                    // 同时缓存文章链接信息
                    if (articlesData.articles && articlesData.articles.length > 0) {
                        simpleCache.set(cacheArticlesKey, articlesData.articles, 86400);
                    }
                }
                safeWrite(`data: ${JSON.stringify({ done: true })}\n\n`);
                safeEnd();
            }
        });
        
        response.data.on('error', (err) => {
            if (isResponseEnded) return;
            clearTimeout(timeout);
            console.error('流处理错误:', err);
            safeWrite(`data: ${JSON.stringify({ content: "\n\n很抱歉，生成摘要时出错。🔄\n\n" })}\n\n`);
            safeWrite(`data: ${JSON.stringify({ done: true })}\n\n`);
            safeEnd();
        });
        
    } catch (error) {
        clearTimeout(timeout);
        if (isResponseEnded) return;
        
        console.error('基于搜索的内容生成失败:', error);
        safeWrite(`data: ${JSON.stringify({ content: "\n\n很抱歉，服务暂时不可用。⚠️\n\n" })}\n\n`);
        safeWrite(`data: ${JSON.stringify({ content: "请稍后再试或使用普通生成模式。" })}\n\n`);
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
                "model": "Qwen/Qwen-Image",
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

// 处理OPTIONS预检请求
app.options(`${BASE_PATH || ''}/api/*`, cors());

// 处理 favicon.ico 请求（浏览器默认会请求这个）
// 如果存在 favicon.ico 就提供，否则提供 favicon.svg
app.get('/favicon.ico', (req, res) => {
    const faviconPath = path.join(__dirname, 'public', 'favicon.ico');
    const faviconSvgPath = path.join(__dirname, 'public', 'favicon.svg');
    
    if (fs.existsSync(faviconPath)) {
        res.sendFile(faviconPath);
    } else if (fs.existsSync(faviconSvgPath)) {
        // 如果不存在 .ico 文件，提供 .svg 文件
        res.type('image/svg+xml');
        res.sendFile(faviconSvgPath);
    } else {
        res.status(204).end(); // 返回 204 No Content
    }
});

// 如果 BASE_PATH 不为空，也处理 BASE_PATH 下的 favicon
if (BASE_PATH && BASE_PATH !== '/') {
    app.get(`${BASE_PATH}/favicon.ico`, (req, res) => {
        const faviconPath = path.join(__dirname, 'public', 'favicon.ico');
        const faviconSvgPath = path.join(__dirname, 'public', 'favicon.svg');
        
        if (fs.existsSync(faviconPath)) {
            res.sendFile(faviconPath);
        } else if (fs.existsSync(faviconSvgPath)) {
            res.type('image/svg+xml');
            res.sendFile(faviconSvgPath);
        } else {
            res.status(204).end();
        }
    });
}

// 添加对平台路径的支持（包括根路径）
// 这个路由应该在所有 API 路由之后，作为 fallback
if (BASE_PATH && BASE_PATH !== '/') {
    // BASE_PATH 不为空时，处理 BASE_PATH 下的路径
    app.get(`${BASE_PATH}/:platform?`, (req, res) => {
        // 排除 API 路由
        if (req.params.platform && req.params.platform.startsWith('api')) {
            return res.status(404).send('Not found');
        }
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
    // 根路径重定向到 BASE_PATH
    app.get('/', (req, res) => {
        res.redirect(BASE_PATH);
    });
} else {
    // BASE_PATH 为空时，直接处理根路径和其他路径
    // 注意：这个路由会匹配所有路径，所以要放在最后
    app.get('/:platform?', (req, res, next) => {
        // 排除 API 路由和静态文件（静态文件应该已经被 express.static 处理）
        if (req.params.platform) {
            if (req.params.platform.startsWith('api')) {
                return res.status(404).send('Not found');
            }
            // 检查是否是静态文件请求（包含扩展名）
            if (req.params.platform.includes('.')) {
                return res.status(404).send('Not found');
            }
        }
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
}

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
                        "model": "deepseek-ai/DeepSeek-V3.2-Exp",
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