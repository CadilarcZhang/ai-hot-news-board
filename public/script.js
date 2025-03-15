document.addEventListener('DOMContentLoaded', function() {
    // 获取当前日期，用于作者发布时间
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    
    // 更新所有发布时间显示
    const publishTimeElements = document.querySelectorAll('.author-meta p');
    publishTimeElements.forEach(el => {
        el.textContent = `刚刚发布 · ${dateStr}`;
    });
    
    // Node.js服务器地址
    const SERVER_URL = ''; // 使用相对路径，而不是 'http://localhost:3001'
    
    // 当前选中的平台
    let currentPlatform = 'weibo';
    
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
    async function generateAIContent(title) {
        const contentContainer = document.getElementById('text-content');
        const loadingElement = document.getElementById('loading');
        const aiContent = document.getElementById('ai-content');
        
        // 显示加载状态
        loadingElement.style.display = 'flex';
        contentContainer.innerHTML = '';
        
        try {
            // 使用更快的流式处理
            const response = await fetch(`/api/generate-content`, {
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
            aiContent.style.display = 'block';
            
            // 隐藏加载状态，准备显示内容
            loadingElement.style.display = 'none';
            
            // 创建一个临时容器，用于累积内容
            const tempContainer = document.createElement('div');
            tempContainer.className = 'ai-text-content';
            contentContainer.appendChild(tempContainer);
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    break;
                }
                
                buffer += decoder.decode(value, { stream: true });
                
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));
                            
                            if (data.content) {
                                fullContent += data.content;
                                
                                // 更新显示，使用更高效的方式
                                const formattedContent = formatContent(fullContent);
                                tempContainer.innerHTML = formattedContent;
                                
                                // 自动滚动到底部，提高用户体验
                                tempContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
                            }
                            
                            if (data.done) {
                                // 完成后的最终格式化
                                const formattedContent = formatContent(fullContent);
                                tempContainer.innerHTML = formattedContent;
                                return fullContent;
                            }
                        } catch (e) {
                            console.error('解析错误:', e);
                        }
                    }
                }
            }
            
            return fullContent;
        } catch (error) {
            console.error('生成内容失败:', error);
            loadingElement.style.display = 'none';
            
            // 显示错误信息
            contentContainer.innerHTML = `
                <div class="error-container">
                    <div class="error-icon">⚠️</div>
                    <p class="error-message">生成内容时出错</p>
                    <p class="error-action">请稍后再试或选择其他热搜话题</p>
                    <button class="retry-button" onclick="generateAIContent('${title}')">重试</button>
                </div>
            `;
            
            throw error;
        }
    }
    
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
        aiContent.style.display = 'none'; // 显示内容区域，以便流式显示
        
        // 清空之前的内容
        imageContainer.innerHTML = '';
        textContent.innerHTML = '<p>AI正在思考中...</p>';
        
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
                <rect width="100%" height="100%" fill="${colors[news.id] || '#ff3852'}" opacity="0.1"/>
                <text x="50%" y="45%" font-family="Arial" font-size="28" fill="${colors[news.id] || '#ff3852'}" text-anchor="middle" font-weight="bold">${news.title}</text>
                <text x="50%" y="55%" font-family="Arial" font-size="18" fill="#666" text-anchor="middle">热度: ${news.heat}</text>
            </svg>
        `;
        
        // 添加一个类来隐藏加载提示
        imageContainer.classList.add('loaded');
        
        // 隐藏加载中提示，因为内容会流式显示
        loading.style.display = 'none';
        
        // 生成AI内容（流式输出）
        await generateAIContent(news.title);
        
        // 实现分享功能
        setupShareButtons(news.title);
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
    
    // 改进加载状态显示
    function showLoadingState(element, message = '加载中') {
        element.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>${message}<span class="dot-animation">...</span></p>
            </div>
        `;
    }
    
    // 使用骨架屏
    function showSkeletonScreen() {
        const contentContainer = document.getElementById('text-content');
        contentContainer.innerHTML = `
            <div class="skeleton-screen">
                <div class="skeleton-line" style="width: 90%"></div>
                <div class="skeleton-line" style="width: 80%"></div>
                <div class="skeleton-line" style="width: 95%"></div>
                <div class="skeleton-line" style="width: 70%"></div>
                <div class="skeleton-line" style="width: 85%"></div>
            </div>
        `;
    }
    
    // 统一的错误处理
    function handleError(container, error, title = '') {
        console.error('发生错误:', error);
        
        let errorMessage = '很抱歉，发生了意外错误。';
        let actionMessage = '请刷新页面重试。';
        
        if (error.message === '请求超时') {
            errorMessage = '请求超时，服务器可能正在处理大量请求。';
            actionMessage = '请稍后再试或选择其他热搜话题。';
        } else if (error.message && error.message.includes('网络')) {
            errorMessage = '网络连接出现问题。';
            actionMessage = '请检查您的网络连接并重试。';
        } else if (title) {
            errorMessage = `无法生成关于"${title}"的内容。`;
            actionMessage = '服务器可能暂时繁忙，请稍后再试。';
        }
        
        container.innerHTML = `
            <div class="error-container">
                <div class="error-icon">⚠️</div>
                <p class="error-message">${errorMessage}</p>
                <p class="error-action">${actionMessage}</p>
                <button class="retry-button">重试</button>
            </div>
        `;
        
        // 添加重试按钮事件
        const retryButton = container.querySelector('.retry-button');
        if (retryButton && title) {
            retryButton.addEventListener('click', () => {
                showSkeletonScreen();
                generateAIContent(title).catch(e => handleError(container, e, title));
            });
        }
    }
    
    // 修复分享功能
    function setupShareButtons(title) {
        // 移除之前的事件监听器
        const copyLinkBtn = document.getElementById('copy-link');
        const shareWeiboBtn = document.getElementById('share-weibo');
        const shareWechatBtn = document.getElementById('share-wechat');
        
        copyLinkBtn.replaceWith(copyLinkBtn.cloneNode(true));
        shareWeiboBtn.replaceWith(shareWeiboBtn.cloneNode(true));
        shareWechatBtn.replaceWith(shareWechatBtn.cloneNode(true));
        
        // 重新获取元素
        const newCopyLinkBtn = document.getElementById('copy-link');
        const newShareWeiboBtn = document.getElementById('share-weibo');
        const newShareWechatBtn = document.getElementById('share-wechat');
        
        // 复制链接
        newCopyLinkBtn.addEventListener('click', () => {
            const url = `${window.location.origin}?title=${encodeURIComponent(title)}`;
            navigator.clipboard.writeText(url)
                .then(() => showToast('链接已复制到剪贴板'))
                .catch(() => showToast('复制失败，请手动复制'));
        });
        
        // 分享到微博
        newShareWeiboBtn.addEventListener('click', () => {
            const url = `https://service.weibo.com/share/share.php?url=${encodeURIComponent(window.location.href)}&title=${encodeURIComponent('AI解读热搜：' + title)}`;
            window.open(url, '_blank');
        });
        
        // 分享到微信（显示二维码）
        newShareWechatBtn.addEventListener('click', () => {
            showQRCode(window.location.href);
        });
    }
    
    // 显示提示消息
    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 2000);
        }, 10);
    }
    
    // 添加二维码显示功能
    function showQRCode(url) {
        // 创建遮罩层
        const overlay = document.createElement('div');
        overlay.className = 'qrcode-overlay';
        
        // 创建二维码容器
        const container = document.createElement('div');
        container.className = 'qrcode-container';
        
        // 添加标题
        const title = document.createElement('h3');
        title.textContent = '微信扫码分享';
        container.appendChild(title);
        
        // 添加二维码图片（使用外部服务生成）
        const qrImage = document.createElement('img');
        qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
        qrImage.alt = '分享二维码';
        container.appendChild(qrImage);
        
        // 添加提示文字
        const hint = document.createElement('p');
        hint.textContent = '打开微信扫一扫，扫描上方二维码即可分享';
        container.appendChild(hint);
        
        // 添加关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.className = 'qrcode-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });
        container.appendChild(closeBtn);
        
        // 将容器添加到遮罩层
        overlay.appendChild(container);
        
        // 点击遮罩层关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });
        
        // 添加到页面
        document.body.appendChild(overlay);
    }
    
    // 添加二维码样式
    const qrcodeStyle = document.createElement('style');
    qrcodeStyle.textContent = `
        .qrcode-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }
        
        .qrcode-container {
            background-color: white;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            position: relative;
            max-width: 90%;
        }
        
        .qrcode-container h3 {
            margin-bottom: 20px;
            color: #333;
        }
        
        .qrcode-container img {
            max-width: 200px;
            height: auto;
            margin-bottom: 20px;
        }
        
        .qrcode-container p {
            color: #666;
            font-size: 0.9rem;
        }
        
        .qrcode-close {
            position: absolute;
            top: 10px;
            right: 10px;
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: #999;
        }
        
        .qrcode-close:hover {
            color: #333;
        }
        
        @media (prefers-color-scheme: dark) {
            .qrcode-container {
                background-color: #2a2a2a;
            }
            
            .qrcode-container h3 {
                color: #e0e0e0;
            }
            
            .qrcode-container p {
                color: #aaa;
            }
            
            .qrcode-close:hover {
                color: #e0e0e0;
            }
        }
    `;
    document.head.appendChild(qrcodeStyle);
    
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