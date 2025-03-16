const Queue = require('bull');
const axios = require('axios');

// AI API密钥
const AI_API_KEY = 'sk-pxmeadiyndbhhtvzvblpgnmyalwvhvvkikllrfjmkqzwtnvo';

// 创建内容生成队列
const contentQueue = new Queue('content-generation');

// 处理内容生成任务
contentQueue.process(async (job) => {
    const { title } = job.data;
    
    // 更新进度
    await job.progress(10);
    
    try {
        // 调用AI API生成内容
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
                "temperature": 0.7,
                "top_p": 0.95,
                "response_format": {
                    "type": "text"
                }
            }
        });
        
        // 更新进度
        await job.progress(100);
        
        // 返回生成的内容
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('内容生成失败:', error);
        throw new Error('内容生成失败');
    }
});

console.log('内容生成工作进程已启动'); 