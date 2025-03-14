document.addEventListener('DOMContentLoaded', function() {
    // 获取当前日期，用于作者发布时间
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    
    // 更新所有发布时间显示
    const publishTimeElements = document.querySelectorAll('.author-meta p');
    publishTimeElements.forEach(el => {
        el.textContent = `刚刚发布 · ${dateStr}`;
    });
    
    // API密钥
    const TIANAPI_KEY = 'eb50731204ecb974aa2fcc8f22478f42'; // 天行API密钥
    const AI_API_KEY = 'sk-pxmeadiyndbhhtvzvblpgnmyalwvhvvkikllrfjmkqzwtnvo'; // AI大模型API密钥
    
    // 当前选中的平台
    let currentPlatform = 'weibo';
    
    // 获取热搜数据
    function fetchHotNews(platform = 'weibo') {
        // 显示加载状态
        const hotNewsList = document.getElementById('hot-news-list');
        hotNewsList.innerHTML = '<div class="loading-list">加载热搜数据中...</div>';
        
        // 根据平台选择不同的API接口
        let apiUrl = '';
        switch(platform) {
            case 'weibo':
                apiUrl = `https://apis.tianapi.com/weibohot/index?key=${TIANAPI_KEY}`;
                break;
            case 'toutiao':
                apiUrl = `https://apis.tianapi.com/toutiaohot/index?key=${TIANAPI_KEY}`;
                break;
            case 'baidu':
                apiUrl = `https://apis.tianapi.com/nethot/index?key=${TIANAPI_KEY}`;
                break;
            default:
                apiUrl = `https://apis.tianapi.com/douyinhot/index?key=${TIANAPI_KEY}`;
        }
        
        // 调用API获取热搜数据
        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                if (data.code === 200) {
                    renderHotNewsList(data.result.list);
                } else {
                    console.error('获取热搜失败:', data.msg);
                    // 如果API调用失败，使用备用数据
                    renderHotNewsList(getFallbackData());
                }
            })
            .catch(error => {
                console.error('API请求错误:', error);
                // 如果API调用出错，使用备用数据
                renderHotNewsList(getFallbackData());
            });
    }
    
    // 渲染热搜列表
    function renderHotNewsList(hotNews) {
        const hotNewsList = document.getElementById('hot-news-list');
        hotNewsList.innerHTML = '';
        
        hotNews.forEach((news, index) => {
            if (index >= 15) return; // 只显示前15条
            
            const li = document.createElement('li');
            li.className = 'hot-item';
            li.dataset.id = index + 1;
            
            const rankClass = index < 3 ? ` top${index+1}` : '';
            
            // 根据不同平台，热搜数据结构可能不同
            const title = news.word || news.title || news.hotword || news.name;
            const heat = news.hotindex || news.hotValue || news.score || (Math.floor(Math.random() * 3000) + 1000) + '万';
            
            li.innerHTML = `
                <span class="hot-rank${rankClass}">${index + 1}</span>
                <span class="hot-title">${title}</span>
                <span class="hot-heat">${heat}</span>
            `;
            
            li.addEventListener('click', function() {
                // 移除其他项目的active类
                document.querySelectorAll('.hot-item').forEach(item => {
                    item.classList.remove('active');
                });
                
                // 为当前项目添加active类
                this.classList.add('active');
                
                // 显示内容区域
                showNewsContent({
                    id: index + 1,
                    title: title,
                    heat: heat
                });
            });
            
            hotNewsList.appendChild(li);
        });
        
        // 页面加载时默认选中第一个热搜
        if (hotNews.length > 0) {
            const firstItem = document.querySelector('.hot-item');
            if (firstItem) {
                firstItem.classList.add('active');
                const firstNews = hotNews[0];
                showNewsContent({
                    id: 1,
                    title: firstNews.word || firstNews.title || firstNews.hotword || firstNews.name,
                    heat: firstNews.hotindex || firstNews.hotValue || firstNews.score || '3824.5万'
                });
            }
        }
    }
    
    // 备用数据，当API调用失败时使用
    function getFallbackData() {
        return [
            { word: "国庆假期旅游总收入超9000亿元", hotindex: "3824.5万" },
            { word: "苹果发布iOS18新功能", hotindex: "2956.3万" },
            { word: "中秋节赏月指南", hotindex: "2541.8万" },
            { word: "专家称每天喝咖啡或降低死亡风险", hotindex: "2103.2万" },
            { word: "新能源汽车销量创新高", hotindex: "1987.6万" },
            { word: "大学生就业率持续上升", hotindex: "1756.9万" },
            { word: "秋季养生小常识", hotindex: "1654.3万" },
            { word: "新款智能手表功能大揭秘", hotindex: "1532.7万" },
            { word: "国庆档电影票房突破50亿", hotindex: "1421.5万" },
            { word: "健康饮食新趋势", hotindex: "1320.8万" }
        ];
    }
    
    // 使用AI生成内容
    async function generateAIContent(title) {
        try {
            const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${AI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
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
                    "stream": false,
                    "max_tokens": 512,
                    "temperature": 0.7,
                    "top_p": 0.7,
                    "response_format": {
                        "type": "text"
                    }
                })
            });
            
            const data = await response.json();
            if (data.choices && data.choices[0] && data.choices[0].message) {
                return data.choices[0].message.content;
            } else {
                console.error('AI响应格式错误:', data);
                return generateFallbackContent(title);
            }
        } catch (error) {
            console.error('AI内容生成失败:', error);
            return generateFallbackContent(title);
        }
    }
    
    // 当AI调用失败时的备用内容生成
    function generateFallbackContent(title) {
        // 根据不同标题生成不同的模拟内容
        const contentMap = {
            "国庆假期旅游总收入超9000亿元": `
                <p>✨ 国庆假期旅游总收入超9000亿元 ✨</p>
                <p>最近国庆假期旅游总收入超9000亿元真的太火了！作为一个资深旅行爱好者，我不得不分享一下我的看法和经验～📸✈️ 这个假期我跟闺蜜一起去了趟网红打卡地，真的是人山人海，但风景确实没让人失望！特别是日落时分，简直美得不可思议，朋友圈发出来狂收赞呀！😍</p>
            `,
            "苹果发布iOS18新功能": `
                <p>苹果最新发布的iOS18系统带来了多项创新功能，包括全新的主屏幕自定义选项、增强的隐私保护措施以及更智能的Siri助手。</p>
                <p>用户现在可以更自由地调整应用图标大小和位置，甚至可以在主屏幕上留出空白区域。新系统还引入了"专注模式"的升级版本，允许用户为不同场景创建完全定制化的设置。</p>
                <p>此外，iOS18还优化了电池管理算法，据苹果公司称，这将使设备续航时间平均提升15%。</p>
            `
        };
        
        // 如果有预设内容则返回，否则生成通用内容
        if (contentMap[title]) {
            return contentMap[title];
        } else {
            return `
                <p>近日，"${title}"成为社交媒体热议话题，引发广泛关注和讨论。📱🔥</p>
                <p>据相关数据显示，该话题在短短几小时内阅读量突破数亿，相关讨论超过数十万条。众多网友纷纷表达自己的看法和观点，使该话题持续发酵。💬👀</p>
                <p>专家表示，这一现象反映了公众对该领域的高度关注，也体现了社会对相关问题的普遍关切。未来可能会有更多政策和措施出台，以回应公众诉求，推动相关领域的发展和完善。✨📊</p>
            `;
        }
    }
    
    // 显示新闻内容
    async function showNewsContent(news) {
        const contentArea = document.getElementById('content-area');
        const placeholder = contentArea.querySelector('.placeholder');
        const newsContent = document.getElementById('news-content');
        const newsTitle = document.getElementById('news-title');
        const loading = document.getElementById('loading');
        const aiContent = document.getElementById('ai-content');
        const imageContainer = document.getElementById('image-container');
        const textContent = document.getElementById('text-content');
        
        // 隐藏占位符，显示内容区
        placeholder.style.display = 'none';
        newsContent.style.display = 'block';
        
        // 设置标题
        newsTitle.textContent = news.title;
        
        // 显示加载中，隐藏内容
        loading.style.display = 'block';
        aiContent.style.display = 'none';
        
        // 清空之前的内容
        imageContainer.innerHTML = '';
        textContent.innerHTML = '';
        
        // 生成AI内容
        const aiGeneratedContent = await generateAIContent(news.title);
        
        // 隐藏加载中，显示内容
        loading.style.display = 'none';
        aiContent.style.display = 'block';
        
        // 使用SVG图片，不依赖外部资源
        const colors = {
            1: "#ff3852", // 红色
            2: "#ff9500", // 橙色
            3: "#ffcc00", // 黄色
            4: "#4cd964", // 绿色
            5: "#5ac8fa", // 蓝色
            6: "#007aff", // 深蓝色
            7: "#5856d6", // 紫色
            8: "#ff2d55", // 粉色
            9: "#8e8e93", // 灰色
            10: "#ff3b30" // 红色
        };
        
        // 创建SVG图片
        imageContainer.innerHTML = `
            <svg width="800" height="450" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="#f5f5f5"/>
                <rect x="50" y="50" width="700" height="350" fill="${colors[news.id] || '#ff3852'}" opacity="0.1"/>
                <text x="50%" y="45%" font-family="Arial" font-size="28" fill="${colors[news.id] || '#ff3852'}" text-anchor="middle" font-weight="bold">${news.title}</text>
                <text x="50%" y="55%" font-family="Arial" font-size="18" fill="#666" text-anchor="middle">热度: ${news.heat}</text>
            </svg>
        `;
        
        // 添加一个类来隐藏加载提示
        imageContainer.classList.add('loaded');
        
        // 显示AI生成的内容
        textContent.innerHTML = aiGeneratedContent;
    }
    
    // 平台标签切换
    const platformTabs = document.querySelectorAll('.platform-tab');
    platformTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            platformTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // 获取平台类型
            currentPlatform = this.dataset.platform;
            
            // 获取该平台的热搜数据
            fetchHotNews(currentPlatform);
        });
    });
    
    // 刷新按钮
    const refreshBtn = document.querySelector('.refresh-btn');
    refreshBtn.addEventListener('click', function() {
        this.querySelector('i').classList.add('rotating');
        setTimeout(() => {
            this.querySelector('i').classList.remove('rotating');
        }, 1000);
        
        // 刷新当前平台的热搜数据
        fetchHotNews(currentPlatform);
    });
    
    // 添加CSS动画
    const style = document.createElement('style');
    style.textContent = `
        @keyframes rotating {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .rotating {
            animation: rotating 1s linear;
        }
        .loading-list {
            text-align: center;
            padding: 20px;
            color: #999;
        }
    `;
    document.head.appendChild(style);
    
    // 初始加载微博热搜
    fetchHotNews('weibo');
}); 