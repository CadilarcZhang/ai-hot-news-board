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
    const SERVER_URL = 'http://localhost:3001';
    
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
            'baidu': [
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
        try {
            // 创建一个容器用于存储内容
            const contentContainer = document.getElementById('text-content');
            
            // 立即显示一个加载动画和初始提示，减少用户等待感
            contentContainer.innerHTML = `
                <div class="typing-indicator">
                    <p>AI正在快速生成内容<span class="dot-animation">...</span></p>
                    <div class="typing-dots">
                        <span></span><span></span><span></span>
                    </div>
                </div>
            `;
            
            // 添加一个超时处理
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('请求超时')), 25000); // 减少超时时间
            });
            
            // 使用Promise.race来处理超时
            return Promise.race([
                new Promise((resolve, reject) => {
                    let fullContent = '';
                    let isFirstChunk = true;
                    let hasReceivedContent = false;
                    let isDone = false;
                    let retryCount = 0;
                    const maxRetries = 1; // 减少重试次数，加快响应
                    
                    function attemptFetch() {
                        // 使用fetch发送POST请求
                        fetch(`${SERVER_URL}/api/generate-content`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ title: title })
                        })
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`HTTP error! status: ${response.status}`);
                            }
                            
                            const reader = response.body.getReader();
                            const decoder = new TextDecoder();
                            let buffer = '';
                            
                            function readStream() {
                                reader.read().then(({ done, value }) => {
                                    if (done) {
                                        // 如果没有收到任何内容，显示重试信息或备用内容
                                        if (!hasReceivedContent) {
                                            if (retryCount < maxRetries) {
                                                retryCount++;
                                                contentContainer.innerHTML = `
                                                    <div class="retry-indicator">
                                                        <p>正在重试 (${retryCount}/${maxRetries})<span class="dot-animation">...</span></p>
                                                        <div class="loading-spinner"></div>
                                                    </div>
                                                `;
                                                setTimeout(attemptFetch, 1000);
                                            } else {
                                                const fallbackContent = `<p>很抱歉，我们无法生成关于"${title}"的内容。</p><p>服务器可能暂时繁忙，请稍后再试。</p>`;
                                                contentContainer.innerHTML = fallbackContent;
                                                resolve(fallbackContent);
                                            }
                                        } else {
                                            // 确保内容完整显示
                                            const formattedContent = formatContent(fullContent);
                                            contentContainer.innerHTML = formattedContent;
                                            resolve(formattedContent);
                                        }
                                        return;
                                    }
                                    
                                    const chunk = decoder.decode(value, { stream: true });
                                    buffer += chunk;
                                    
                                    // 处理缓冲区中的所有完整事件
                                    const lines = buffer.split('\n\n');
                                    buffer = lines.pop() || ''; // 保留最后一个不完整的行
                                    
                                    for (const line of lines) {
                                        if (line.startsWith('data: ')) {
                                            try {
                                                const data = JSON.parse(line.substring(6));
                                                
                                                if (data.error) {
                                                    console.error('服务器错误:', data.error);
                                                    continue; // 继续处理，不中断
                                                }
                                                
                                                if (data.content) {
                                                    hasReceivedContent = true;
                                                    
                                                    // 如果是第一个内容块，并且内容是"正在思考中..."，则不添加到fullContent
                                                    if (isFirstChunk && data.content === "正在思考中...") {
                                                        isFirstChunk = false;
                                                        continue;
                                                    }
                                                    
                                                    // 移除加载动画，显示实际内容
                                                    if (isFirstChunk) {
                                                        contentContainer.innerHTML = '';
                                                        isFirstChunk = false;
                                                    }
                                                    
                                                    fullContent += data.content;
                                                    
                                                    // 更新显示，确保内容实时显示
                                                    const formattedContent = formatContent(fullContent);
                                                    contentContainer.innerHTML = formattedContent;
                                                    
                                                    // 滚动到底部，确保用户看到最新内容
                                                    const contentArea = document.getElementById('content-area');
                                                    contentArea.scrollTop = contentArea.scrollHeight;
                                                }
                                                
                                                if (data.done) {
                                                    isDone = true;
                                                    // 如果没有收到任何实际内容，显示备用内容
                                                    if (!hasReceivedContent || fullContent.trim() === '') {
                                                        const fallbackContent = `<p>很抱歉，我们无法生成关于"${title}"的内容。</p><p>服务器可能暂时繁忙，请稍后再试。</p>`;
                                                        contentContainer.innerHTML = fallbackContent;
                                                        resolve(fallbackContent);
                                                    } else {
                                                        // 确保内容完整显示
                                                        const formattedContent = formatContent(fullContent);
                                                        contentContainer.innerHTML = formattedContent;
                                                        resolve(formattedContent);
                                                    }
                                                    return;
                                                }
                                            } catch (e) {
                                                // 忽略解析错误，继续处理
                                                console.log('解析错误:', e, 'Line:', line);
                                            }
                                        }
                                    }
                                    
                                    // 继续读取流
                                    readStream();
                                }).catch(error => {
                                    console.error('流读取错误:', error);
                                    // 如果已经收到了一些内容，就显示已收到的内容
                                    if (hasReceivedContent) {
                                        const formattedContent = formatContent(fullContent);
                                        contentContainer.innerHTML = formattedContent;
                                        resolve(formattedContent);
                                    } else if (retryCount < maxRetries) {
                                        retryCount++;
                                        contentContainer.innerHTML = `
                                            <div class="retry-indicator">
                                                <p>正在重试 (${retryCount}/${maxRetries})<span class="dot-animation">...</span></p>
                                                <div class="loading-spinner"></div>
                                            </div>
                                        `;
                                        setTimeout(attemptFetch, 1000);
                                    } else {
                                        // 否则显示友好的错误信息
                                        const errorContent = `<p>很抱歉，我们无法生成关于"${title}"的内容。</p><p>服务器可能暂时繁忙，请稍后再试。</p>`;
                                        contentContainer.innerHTML = errorContent;
                                        resolve(errorContent);
                                    }
                                });
                            }
                            
                            // 开始读取流
                            readStream();
                        })
                        .catch(error => {
                            console.error('请求错误:', error);
                            if (retryCount < maxRetries) {
                                retryCount++;
                                contentContainer.innerHTML = `
                                    <div class="retry-indicator">
                                        <p>正在重试 (${retryCount}/${maxRetries})<span class="dot-animation">...</span></p>
                                        <div class="loading-spinner"></div>
                                    </div>
                                `;
                                setTimeout(attemptFetch, 1000);
                            } else {
                                const errorContent = `<p>很抱歉，我们无法生成关于"${title}"的内容。</p><p>服务器可能暂时繁忙，请稍后再试。</p>`;
                                contentContainer.innerHTML = errorContent;
                                resolve(errorContent);
                            }
                        });
                    }
                    
                    // 开始第一次尝试
                    attemptFetch();
                }),
                timeoutPromise
            ]).catch(error => {
                console.error('生成内容失败:', error);
                const errorContent = `<p>很抱歉，请求超时。</p><p>我们的服务器可能正在处理大量请求，请稍后再试。</p>`;
                contentContainer.innerHTML = errorContent;
                return errorContent;
            });
        } catch (error) {
            console.error('AI内容生成失败:', error);
            const errorContent = `<p>很抱歉，发生了意外错误。</p><p>请刷新页面重试。</p>`;
            return errorContent;
        }
    }
    
    // 格式化内容为HTML
    function formatContent(text) {
        if (!text || !text.trim()) {
            return '<p>正在思考中...</p>';
        }
        
        // 将文本按段落分割并包装在<p>标签中
        // 首先尝试按双换行符分割
        let paragraphs = text.split('\n\n').filter(p => p.trim());
        
        if (paragraphs.length <= 1) {
            // 如果没有明确的双换行符，尝试按单换行符分割
            paragraphs = text.split('\n').filter(p => p.trim());
        }
        
        if (paragraphs.length === 0) {
            // 如果仍然没有段落，就把整个文本作为一个段落
            return `<p>${text}</p>`;
        }
        
        return paragraphs.map(p => `<p>${p}</p>`).join('');
    }
    
    // 当AI调用失败时的备用内容生成
    function generateFallbackContent(title) {
        // 根据不同标题生成不同的模拟内容
        const contentMap = {
            "国庆假期旅游总收入超9000亿元": `
                <p>✨ 国庆假期旅游总收入超9000亿元 ✨</p>
                <p>哇！这个国庆假期真的太火爆了！旅游总收入居然突破9000亿元大关！🔥💰 作为一个资深旅游爱好者，我简直惊呆了！这个数字背后反映的是大家强烈的出游意愿和消费信心回升！</p>
                <p>据统计，全国接待国内游客超过8亿人次，同比增长超过20%！📈 各大景区、酒店、民宿一房难求，高铁、飞机票更是一票难求！这波旅游热潮不仅带动了住宿、餐饮、交通等传统旅游业态，还促进了文创、直播带货等新业态发展！👏</p>
                <p>从消费结构来看，这次假期呈现出几个明显特点：一是家庭出游成为主流，亲子游、研学游备受欢迎；二是夜间经济异常火爆，各地夜市、灯光秀吸引了大量游客；三是文化旅游深度融合，博物馆、非遗展示等文化场所游客如织。🌃🏛️</p>
                <p>专家分析，这一数据表明我国经济韧性强、潜力大、活力足，消费市场持续复苏向好。随着各地促消费政策持续发力，预计四季度消费市场将继续保持良好增长态势。💼📊</p>
                <p>你们国庆去哪玩了？有没有被人山人海吓到？欢迎评论区分享你的旅行故事！✈️🏞️</p>
            `,
            "苹果发布iOS18新功能": `
                <p>🍎 苹果发布iOS18新功能，这次真的有点东西！👀</p>
                <p>各位果粉们注意啦！苹果刚刚发布的iOS18新功能简直太赞了！这次更新不仅仅是小打小闹，而是带来了一系列重磅功能！🚀</p>
                <p>首先是全新的主屏幕自定义选项，终于可以随心所欲地调整图标位置和大小了！还可以在主屏幕上留出空白区域，不再是整齐但呆板的网格布局！其次是AI助手大升级，Siri变得更聪明了，可以理解更复杂的指令，甚至能帮你总结长文本！🤖</p>
                <p>隐私保护方面也有重大突破，新增了"App隐私报告"功能，可以详细查看每个应用访问了哪些数据，何时访问的，甚至可以设置更精细的权限控制。这对于越来越重视个人数据安全的用户来说，简直是福音！🔐👍</p>
                <p>最让我惊喜的是电池优化算法，据说可以提升15%的续航时间！这对我这种重度手机用户来说简直是福音！🔋 还有全新的健康功能，可以记录和分析更多身体数据，甚至可以生成健康趋势报告，帮助用户更好地了解自己的身体状况。💪❤️</p>
                <p>你们更新了吗？感觉如何？有没有发现什么好玩的小功能？快来评论区分享一下吧！#苹果 #iOS18 #科技</p>
            `,
            "专家称每天喝咖啡或降低死亡风险": `
                <p>☕ 好消息！专家称每天喝咖啡或降低死亡风险！😲</p>
                <p>咖啡控们欢呼吧！最新研究表明，每天适量饮用咖啡可能有助于降低死亡风险！这简直是给我们这些离不开咖啡的人最好的礼物！🎁</p>
                <p>研究发现，每天喝1-3杯咖啡的人，全因死亡风险比不喝咖啡的人低12%左右。咖啡中含有的抗氧化物质和多酚类化合物，可能有助于减少炎症，改善胰岛素敏感性，甚至可能对心血管系统有保护作用！💓</p>
                <p>这项研究跟踪调查了超过50万人，持续时间长达10年，结果显示咖啡摄入与多种疾病风险降低相关，包括2型糖尿病、帕金森病、某些类型的癌症等。研究人员表示，无论是含咖啡因的还是不含咖啡因的咖啡，都显示出了这种保护作用，这意味着咖啡中的其他成分可能才是关键。🔬📊</p>
                <p>但专家也提醒，咖啡不是"灵丹妙药"，过量摄入可能导致焦虑、失眠等问题。而且加了大量糖和奶油的花式咖啡可不算健康饮品哦！最健康的饮用方式是黑咖啡或仅加少量牛奶。☝️🧐</p>
                <p>你是咖啡爱好者吗？每天喝几杯呢？喜欢什么口味的咖啡？欢迎在评论区分享你的咖啡习惯！#咖啡 #健康 #生活方式</p>
            `
        };
        
        // 如果有预设内容则返回，否则生成通用内容
        if (contentMap[title]) {
            return contentMap[title];
        }
        
        // 为不同类型的热搜生成不同风格的内容
        if (title.includes("国庆") || title.includes("假期") || title.includes("旅游")) {
            return `
                <p>🎉 ${title} 🎉</p>
                <p>国庆假期真是太精彩了！全国各地景区人山人海，酒店一房难求！据最新数据显示，这个假期旅游市场火爆程度超出预期，消费热情高涨！💰✨</p>
                <p>从三亚的海滩到北京的故宫，从西安的兵马俑到张家界的玻璃栈道，各大景区游客如织！这不仅反映了人们强烈的出游意愿，也展示了我国经济活力和消费市场的强大潜力！📈</p>
                <p>值得注意的是，这次假期呈现出几个新特点：一是短途自驾游成为主流，二是文化旅游深度融合，三是乡村旅游备受青睐。特别是一些传统村落和特色小镇，因其独特的文化魅力和自然风光，吸引了大量游客前往打卡。🚗🏞️</p>
                <p>专家分析认为，这一现象反映了人们旅游消费观念的转变，从单纯的观光游向体验式、沉浸式旅游转变。未来，旅游业应当更加注重提升服务质量和文化内涵，满足游客日益多元化的需求。🌟🧳</p>
                <p>你们假期去哪玩了？有什么有趣的经历吗？欢迎在评论区分享！👇</p>
            `;
        } else if (title.includes("专家") || title.includes("研究") || title.includes("健康")) {
            return `
                <p>💡 ${title} 💡</p>
                <p>又有新研究出炉啦！这次的发现真的很有意思！科学家们通过大量数据分析和临床观察，得出了这个引人注目的结论！🔬👨‍🔬</p>
                <p>研究团队对超过10000名参与者进行了为期5年的跟踪调查，发现了一些令人惊讶的关联性。数据显示，那些坚持特定生活习惯的人群，在多项健康指标上都表现出明显优势。这一发现可能会对未来的健康指导方针产生重大影响。📊📈</p>
                <p>专家解释说，这项研究之所以重要，是因为它打破了我们之前的一些认知，提供了全新的视角来看待健康问题。不过，他们也强调，研究结果需要在更大范围内验证，才能形成确定的结论。👩‍⚕️🧪</p>
                <p>虽然这项研究结果令人振奋，但专家们也提醒我们，科学研究需要谨慎对待，单一研究结果不能简单推广。健康生活方式仍然是最重要的：均衡饮食、适量运动、充足睡眠、保持心情愉快！💪😊</p>
                <p>你对这个研究结果有什么看法？它会改变你的生活习惯吗？欢迎在评论区讨论！💭</p>
            `;
        } else {
            return `
                <p>🔥 ${title} 🔥</p>
                <p>这条热搜最近在社交媒体上引起了广泛关注和讨论！短短几小时内，阅读量就突破了数亿，相关话题讨论超过数十万条！大家纷纷发表自己的看法，热度持续攀升！📱💬</p>
                <p>为什么这个话题能引起如此大的反响？一方面是因为它触及了大众的切身利益和普遍关切，另一方面也反映了当下社会的热点焦点和价值取向。从某种程度上说，这个热搜话题成为了观察社会心态和公众情绪的一个窗口。🔍👀</p>
                <p>有意思的是，不同年龄段、不同地区的人对这一话题的态度存在明显差异。年轻人普遍表现出更强的参与度和更鲜明的观点，而中老年群体则相对保守。这种代际差异背后，折射出的是不同成长环境和价值观念的碰撞。👨‍👩‍👧‍👦🌏</p>
                <p>专家认为，随着这一话题的持续发酵，相关部门可能会出台一系列政策来回应公众关切。我们也会持续关注这一话题的发展动态，为大家带来最新的解读和分析。无论你持什么立场，这都是一个值得深思的现象！🤔📰</p>
                <p>你怎么看这个热搜？欢迎在评论区留言分享你的观点！👇</p>
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
        aiContent.style.display = 'block'; // 显示内容区域，以便流式显示
        
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
                <rect x="50" y="50" width="700" height="350" fill="${colors[news.id] || '#ff3852'}" opacity="0.1"/>
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