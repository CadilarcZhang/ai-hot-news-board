const express = require('express');
const cors = require('cors');
const axios = require('axios');
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

// 启用CORS
app.use(cors());
app.use(express.json());

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
            case 'baidu':
                endpoint = 'nethot';
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

// 预生成的常见热搜回复
const preGeneratedResponses = {
    "西安交大通报副教授论文全文抄袭": `
<p>🔥 #西安交大副教授论文全文抄袭# 爆出的瞬间，学术圈的瓜粉们直接炸了锅！这位副教授在国际期刊上发表的论文被扒出**全文抄袭**，西安交大连夜通报：停职、撤销职称、追回待遇！这波处理速度和狠度直接让网友喊话"学术打假不能手软"！👏</p>

<p>据教育部统计，2022年高校学术不端处理案件同比增加23%，而论文抄袭占比超过60%！更可怕的是，**近5年高校被撤稿论文中，37%涉及抄袭**（数据来源：中国科技论文统计报告）。这些数字背后反映的是学术圈的诚信危机，也是对真正踏实做研究学者的不尊重。😓</p>

<p>从社会影响来看，学术不端行为严重损害了我国科研声誉和国际形象。每一篇抄袭论文被发现，都会让国际学术界对中国学者的整体印象大打折扣。同时，这种行为也扭曲了学术评价体系，让"发表数量"凌驾于"研究质量"之上，进一步加剧了学术界的浮躁风气。🤔</p>

<p>值得思考的是，为什么这种明显的抄袭行为能"蒙混过关"到被发表？背后暴露的学术监管漏洞可不是一个"离谱"能概括的呢～这次事件也给我们敲响警钟：学术诚信不仅是个人品德问题，更是关乎国家科研实力和学术声誉的大事！希望各高校能建立更严格的学术审核机制，让学术造假者无处遁形！💪</p>
`,
    "国庆假期旅游总收入超9000亿元": `
<p>🎉 #国庆假期旅游总收入超9000亿元# 这个数字简直太震撼了！8天长假，全国旅游市场火爆程度超出预期，消费热情空前高涨！💰✨</p>

<p>据文旅部数据显示，今年国庆假期全国共接待国内游客8.26亿人次，同比增长4.1%；实现国内旅游收入9632.6亿元，同比增长5.6%！这些数字背后反映的是中国经济的强大韧性和内需市场的巨大潜力。从消费结构来看，高品质、深度体验型旅游成为主流，人均花费较往年明显提升。📈🧳</p>

<p>从社会影响角度分析，这波旅游热潮带动了餐饮、住宿、交通、文创等多个行业全面复苏。特别是一些历史文化名城和乡村旅游目的地，游客量创下历史新高！数据显示，博物馆、非遗展示等文化场所游客同比增长超过30%，夜间经济消费增长超过25%。这种"文旅融合"的新模式，正成为拉动内需的重要引擎！🏛️🌃</p>

<p>不过也要看到，部分热门景区"人从众"现象严重，"一票难求"、"一房难订"、"一座难求"的问题仍然存在。未来旅游业发展，需要更加注重分流引导和服务质量提升。作为旅游爱好者，我建议大家可以错峰出行，探索小众目的地，体验会更好哦！你们假期去哪玩了？有没有被人山人海吓到？欢迎评论区分享你的旅行故事！✈️🏞️</p>
`
};

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
    
    // 如果有预生成的回复，立即返回
    if (preGeneratedResponses[title]) {
        console.log(`使用预生成的内容: ${title}`);
        
        // 分段发送预生成内容，模拟流式效果
        const content = preGeneratedResponses[title];
        const chunks = content.split('</p>');
        
        // 立即发送第一段，减少用户等待感
        res.write(`data: ${JSON.stringify({ content: chunks[0] + '</p>' })}\n\n`);
        
        // 模拟流式发送其余段落
        let i = 1;
        const sendNextChunk = () => {
            if (i < chunks.length) {
                if (chunks[i].trim()) {
                    res.write(`data: ${JSON.stringify({ content: chunks[i] + '</p>' })}\n\n`);
                }
                i++;
                setTimeout(sendNextChunk, 150); // 每150ms发送一段，加快速度
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
        
        // 发送友好的错误提示
        res.write(`data: ${JSON.stringify({ content: "\n\n很抱歉，服务暂时不可用。⚠️\n\n" })}\n\n`);
        res.write(`data: ${JSON.stringify({ content: "我们的系统遇到了一些技术问题，请稍后再试。感谢您的理解和耐心。" })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
    }
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
}); 