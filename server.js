const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = 3000;

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
        res.json(response.data);
    } catch (error) {
        console.error('获取热搜数据失败:', error);
        res.status(500).json({ error: '获取热搜数据失败', message: error.message });
    }
});

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
                        "content": "你是一位热搜解读专家，请根据热搜标题生成一段生动有趣的解读，包含表情符号，语气活泼，像社交媒体博主的风格。内容要有深度但不要太长。"
                    },
                    {
                        "role": "user",
                        "content": `请解读这条热搜：${title}`
                    }
                ],
                "stream": true,
                "max_tokens": 512,
                "temperature": 0.7,
                "top_p": 0.7,
                "response_format": {
                    "type": "text"
                }
            },
            responseType: 'stream'
        });
        
        // 处理流式响应
        response.data.on('data', (chunk) => {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
                if (line.trim() === '') continue;
                
                if (line.startsWith('data: ')) {
                    const data = line.substring(6);
                    
                    if (data === '[DONE]') {
                        res.write('data: [DONE]\n\n');
                        continue;
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
            res.end();
        });
        
        response.data.on('error', (err) => {
            console.error('流处理错误:', err);
            res.write(`data: ${JSON.stringify({ error: '流处理错误' })}\n\n`);
            res.end();
        });
        
    } catch (error) {
        console.error('AI内容生成失败:', error);
        res.write(`data: ${JSON.stringify({ error: '生成内容失败', message: error.message })}\n\n`);
        res.end();
    }
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
}); 