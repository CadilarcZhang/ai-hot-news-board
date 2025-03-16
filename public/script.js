document.addEventListener('DOMContentLoaded', function() {
    // 获取当前日期，用于作者发布时间
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    
    // 更新所有发布时间显示
    const publishTimeElements = document.querySelectorAll('.author-meta p');
    publishTimeElements.forEach(el => {
        el.textContent = `刚刚发布 · ${dateStr}`;
    });
    
    // 获取基础路径
    const BASE_PATH = window.location.pathname.startsWith('/hot-news') ? '/hot-news' : '';
    
    // Node.js服务器地址
    const SERVER_URL = BASE_PATH; // 使用相对路径，包含基础路径
    
    // 当前选中的平台
    let currentPlatform = 'weibo';
    
    // 存储所有EventSource实例的映射
    const eventSources = {};
    
    // 获取热搜数据
    function fetchHotNews(platform = 'weibo') {
        // 显示加载状态
        const hotNewsList = document.getElementById('hot-news-list');
        hotNewsList.innerHTML = '<div class="loading-list">加载热搜数据中...</div>';
        
        // 调用Node.js服务器API获取热搜数据
        fetch(`${SERVER_URL}/api/hot-news?platform=${platform}`)
            .then(response => response.json())
            .then(data => {
                if (data.code === 200) {
                    renderHotNewsList(data.result.list);
                } else {
                    console.error('获取热搜失败:', data.msg || data.error);
                    // 如果API调用失败，使用备用数据
                    renderHotNewsList(getFallbackData(platform));
                }
            })
            .catch(error => {
                console.error('API请求错误:', error);
                // 如果API调用出错，使用备用数据
                renderHotNewsList(getFallbackData(platform));
            });
    }
    
    // 渲染热搜列表
    function renderHotNewsList(hotNews) {
        const hotNewsList = document.getElementById('hot-news-list');
        const contentArea = document.getElementById('content-area');
        
        // 清空热搜列表
        hotNewsList.innerHTML = '';
        
        // 清空内容区域，只保留占位符
        const placeholder = contentArea.querySelector('.placeholder');
        contentArea.innerHTML = '';
        contentArea.appendChild(placeholder);
        
        // 清除所有EventSource连接
        Object.keys(eventSources).forEach(key => {
            if (eventSources[key]) {
                eventSources[key].close();
                delete eventSources[key];
            }
        });
        
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
            
            // 为每个热搜项创建一个内容区域
            const newsId = `news-${index + 1}`;
            const template = document.getElementById('news-content-template');
            const newsContent = template.content.cloneNode(true).querySelector('.news-content');
            
            newsContent.id = newsId;
            newsContent.querySelector('.content-title').textContent = `${index + 1}. ${title}`;
            
            // 添加到内容区域
            contentArea.appendChild(newsContent);
            
            li.addEventListener('click', function() {
                // 移除其他项目的active类
                document.querySelectorAll('.hot-item').forEach(item => {
                    item.classList.remove('active');
                });
                
                // 为当前项目添加active类
                this.classList.add('active');
                
                // 显示对应的内容区域
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
    function getFallbackData(platform = 'weibo') {
        const data = {
            'weibo': [
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
            ],
            'toutiao': [
                { word: "国庆假期全国接待游客超8亿人次", hotindex: "4125.7万" },
                { word: "多地医院儿科爆满", hotindex: "3876.2万" },
                { word: "新一轮冷空气将影响北方地区", hotindex: "3654.9万" },
                { word: "电影《志愿军》票房破20亿", hotindex: "3421.3万" },
                { word: "多地景区门票降价", hotindex: "3210.5万" },
                { word: "新能源车企价格战再升级", hotindex: "2987.6万" },
                { word: "专家建议延长带薪年假", hotindex: "2765.4万" },
                { word: "全国多地将迎来降雨", hotindex: "2543.8万" },
                { word: "研究显示睡眠不足影响免疫力", hotindex: "2321.7万" },
                { word: "多地上调最低工资标准", hotindex: "2109.3万" }
            ],
            'douyin': [
                { word: "国庆假期消费数据创新高", hotindex: "4532.1万" },
                { word: "多地医保定点药店可刷医保电子凭证", hotindex: "4321.8万" },
                { word: "专家称现在非典型肺炎并不可怕", hotindex: "4102.5万" },
                { word: "北京公积金贷款额度上限提高", hotindex: "3876.3万" },
                { word: "女子吐槽景区商家2根玉米80元", hotindex: "3654.9万" },
                { word: "专家建议取消地铁早高峰限流", hotindex: "3421.7万" },
                { word: "多地景区门票价格下调", hotindex: "3210.5万" },
                { word: "全国多地将迎来新一轮降雨", hotindex: "2987.6万" },
                { word: "研究显示每天1杯咖啡可降低死亡风险", hotindex: "2765.4万" },
                { word: "专家称未来十年房价会稳中有降", hotindex: "2543.8万" }
            ]
        };
        
        return data[platform] || data['weibo'];
    }
    
    // 使用流式API生成内容
    function generateAIContent(newsId, title) {
        const newsContent = document.getElementById(`news-${newsId}`);
        const contentContainer = newsContent.querySelector('.text-content');
        const imageContainer = newsContent.querySelector('.image-container');
        const loadingElement = newsContent.querySelector('.loading');
        const aiContent = newsContent.querySelector('.ai-content');
        
        // 显示加载状态
        loadingElement.style.display = 'flex';
        contentContainer.innerHTML = '';
        
        // 清空图片容器
        imageContainer.innerHTML = '';
        
        // 关闭之前的EventSource连接（如果存在）
        if (eventSources[newsId]) {
            eventSources[newsId].close();
            delete eventSources[newsId];
        }
        
        try {
            // 方法1: 使用EventSource (SSE)
            const eventSource = new EventSource(`${SERVER_URL}/api/generate?title=${encodeURIComponent(title)}`);
            eventSources[newsId] = eventSource;
            
            let fullContent = '';
            aiContent.style.display = 'none';
            
            eventSource.onopen = (evt) => {
                console.log(`SSE成功建立连接 (${newsId})`, evt);
            };
            
            eventSource.onmessage = function(event) {
                try {
                    const data = JSON.parse(event.data);
                    loadingElement.style.display = 'none';
                    aiContent.style.display = 'block';
                    
                    if (data.content) {
                        fullContent += data.content;
                        contentContainer.innerHTML = formatContent(fullContent);
                    }
                    
                    if (data.done) {
                        // 创建SVG图片
                        createSVGImage(newsId, title, newsContent.querySelector('.hot-heat'));
                        
                        if (eventSources[newsId]) {
                            eventSources[newsId].close();
                            delete eventSources[newsId];
                        }
                    }
                } catch (e) {
                    console.error('解析事件数据出错:', e);
                }
            };
            
            eventSource.onerror = function(error) {
                console.error(`EventSource错误 (${newsId}):`, error);
                
                if (eventSources[newsId]) {
                    eventSources[newsId].close();
                    delete eventSources[newsId];
                }
                
                // 显示错误信息
                contentContainer.innerHTML = `
                    <div class="error-container">
                        <div class="error-icon">⚠️</div>
                        <p class="error-message">生成内容时出错</p>
                        <p class="error-action">请稍后再试或选择其他热搜话题</p>
                        <button class="retry-button" onclick="window.retryGeneration(${newsId}, '${title}')">重试</button>
                    </div>
                `;
                loadingElement.style.display = 'none';
            };
            
            // 方法2: 使用Fetch API的流式处理 (如果EventSource不可用)
            /*
            const response = await fetch(`${SERVER_URL}/api/generate-content`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullContent = '';
            
            loadingElement.style.display = 'none';
            aiContent.style.display = 'block';
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    break;
                }
                
                // 解码新的数据块
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
                                contentContainer.innerHTML = formatContent(fullContent);
                            }
                            
                            if (data.done) {
                                break;
                            }
                        } catch (e) {
                            console.log('解析错误:', e);
                        }
                    }
                }
            }
            */
        } catch (error) {
            console.error(`生成内容时出错 (${newsId}):`, error);
            loadingElement.style.display = 'none';
            
            // 显示错误信息
            contentContainer.innerHTML = `
                <div class="error-container">
                    <div class="error-icon">⚠️</div>
                    <p class="error-message">生成内容时出错</p>
                    <p class="error-action">请稍后再试或选择其他热搜话题</p>
                    <button class="retry-button" onclick="window.retryGeneration(${newsId}, '${title}')">重试</button>
                </div>
            `;
        }
    }
    
    // 创建SVG图片
    function createSVGImage(newsId, title, heat) {
        const newsContent = document.getElementById(`news-${newsId}`);
        const imageContainer = newsContent.querySelector('.image-container');
        
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
                <rect width="100%" height="100%" fill="${colors[newsId % 10 + 1] || '#ff3852'}" opacity="0.1"/>
                <text x="50%" y="45%" font-family="Arial" font-size="28" fill="${colors[newsId % 10 + 1] || '#ff3852'}" text-anchor="middle" font-weight="bold">${title}</text>
                <text x="50%" y="55%" font-family="Arial" font-size="18" fill="#666" text-anchor="middle">热度: ${heat}</text>
            </svg>
        `;
        
        // 添加一个类来隐藏加载动画
        imageContainer.classList.add('loaded');
    }
    
    // 全局重试函数
    window.retryGeneration = function(newsId, title) {
        generateAIContent(newsId, title);
    };
    
    // 格式化内容为HTML
    function formatContent(text) {
        if (!text || !text.trim()) {
            return '<p>正在生成内容...</p>';
        }
        
        // 使用更高效的方式分割段落
        const paragraphs = text.split('\n\n').length > 1 
            ? text.split('\n\n') 
            : text.split('\n');
        
        // 过滤空段落并格式化
        return paragraphs
            .filter(p => p.trim())
            .map((p, i) => {
                // 为第一段添加特殊样式
                if (i === 0) {
                    return `<p class="first-paragraph">${p}</p>`;
                }
                return `<p>${p}</p>`;
            })
            .join('');
    }
    
    // 显示新闻内容
    function showNewsContent(news) {
        const contentArea = document.getElementById('content-area');
        const placeholder = contentArea.querySelector('.placeholder');
        const newsId = `news-${news.id}`;
        const newsContent = document.getElementById(newsId);
        
        // 隐藏所有内容区域
        document.querySelectorAll('.news-content').forEach(content => {
            content.style.display = 'none';
        });
        
        // 隐藏占位符
        placeholder.style.display = 'none';
        
        // 显示当前内容区域
        newsContent.style.display = 'block';
        
        // 检查是否已经生成过内容
        const textContent = newsContent.querySelector('.text-content');
        if (!textContent.innerHTML.trim()) {
            // 如果没有内容，则生成
            generateAIContent(news.id, news.title);
        } else if (!newsContent.querySelector('.image-container').innerHTML.trim()) {
            // 如果有内容但没有图片，生成图片
            createSVGImage(news.id, news.title, news.heat);
        }
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
        const icon = this.querySelector('i');
        icon.classList.add('rotating');
        
        setTimeout(() => {
            icon.classList.remove('rotating');
        }, 1000);
        
        fetchHotNews(currentPlatform);
    });
    
    // 初始化：获取微博热搜数据
    fetchHotNews('weibo');
    
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
    
    // 移除多余的调试元素
    const debugElements = document.querySelectorAll('[style*="border: 1px solid red"], [style*="border:1px solid red"]');
    debugElements.forEach(el => {
        el.style.border = 'none';
        // 如果元素是空的，完全移除它
        if (!el.innerText.trim() && !el.querySelector('img') && !el.classList.contains('loading')) {
            el.style.display = 'none';
        }
    });
    
    // 检查并移除空的内容容器
    const emptyContainers = document.querySelectorAll('.content-area > div:empty');
    emptyContainers.forEach(el => {
        if (!el.classList.contains('loading') && !el.classList.contains('placeholder')) {
            el.style.display = 'none';
        }
    });
    
    // 主题切换按钮逻辑
    const themeToggleBtn = document.getElementById('theme-toggle');
    
    // 检查本地存储中的主题设置
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        applyDarkMode(true);
    }
    
    // 添加点击事件
    themeToggleBtn.addEventListener('click', function() {
        document.body.classList.toggle('dark-mode');
        
        // 更新所有需要暗黑模式的元素
        const isDarkMode = document.body.classList.contains('dark-mode');
        applyDarkMode(isDarkMode);
        
        // 保存主题设置到本地存储
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    });
    
    // 应用深色模式到所有元素
    function applyDarkMode(isDarkMode) {
        const elements = [
            '.content-area', '.news-content', '.placeholder', 
            '.image-container', 'header', 'main', '.left-panel', 
            '.hot-item', '.platform-tab', '.text-content',
            '.author-info', '.author-meta', '.share-btn',
            '.loading', '.error-container'
        ];
        
        elements.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                if (isDarkMode) {
                    el.classList.add('dark-mode');
                } else {
                    el.classList.remove('dark-mode');
                }
            });
        });
    }
}); 