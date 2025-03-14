// API模块
const API = {
    BASE_URL: '/api',
    
    async fetchHotNews(platform = 'weibo') {
        try {
            const response = await fetch(`${this.BASE_URL}/hot-news?platform=${platform}`);
            const data = await response.json();
            
            if (data.code === 200) {
                return data.result.list;
            } else {
                throw new Error(data.msg || data.error || '获取热搜失败');
            }
        } catch (error) {
            console.error('API请求错误:', error);
            throw error;
        }
    },
    
    generateContent(title, callbacks) {
        return new Promise((resolve, reject) => {
            const { onStart, onContent, onComplete, onError } = callbacks;
            
            if (onStart) onStart();
            
            fetch(`${this.BASE_URL}/generate-content`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title })
            })
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let fullContent = '';
                
                function readStream() {
                    reader.read().then(({ done, value }) => {
                        if (done) {
                            if (onComplete) onComplete(fullContent);
                            resolve(fullContent);
                            return;
                        }
                        
                        const chunk = decoder.decode(value, { stream: true });
                        buffer += chunk;
                        
                        // 处理缓冲区中的所有完整事件
                        const lines = buffer.split('\n\n');
                        buffer = lines.pop() || '';
                        
                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                try {
                                    const data = JSON.parse(line.substring(6));
                                    
                                    if (data.content) {
                                        fullContent += data.content;
                                        if (onContent) onContent(data.content, fullContent);
                                    }
                                    
                                    if (data.done) {
                                        if (onComplete) onComplete(fullContent);
                                        resolve(fullContent);
                                        return;
                                    }
                                } catch (e) {
                                    console.log('解析错误:', e);
                                }
                            }
                        }
                        
                        readStream();
                    }).catch(error => {
                        if (onError) onError(error);
                        reject(error);
                    });
                }
                
                readStream();
            })
            .catch(error => {
                if (onError) onError(error);
                reject(error);
            });
        });
    }
};

export default API; 