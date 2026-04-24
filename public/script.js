// Vercel Analytics 事件跟踪函数
function trackEvent(eventName, properties = {}) {
    if (typeof window !== 'undefined' && window.va) {
        window.va('track', eventName, properties);
    }
}

// Vercel Speed Insights 性能监控函数
function trackPerformance(metricName, value, unit = 'ms') {
    if (typeof window !== 'undefined' && window.va) {
        window.va('track', 'Performance Metric', {
            metric_name: metricName,
            metric_value: value,
            metric_unit: unit,
            page_path: window.location.pathname,
            timestamp: new Date().toISOString()
        });
    }
}

// Web Vitals 性能监控
function trackWebVitals() {
    if (typeof window !== 'undefined' && window.va) {
        // 监控 Core Web Vitals
        if ('PerformanceObserver' in window) {
            try {
                // 监控 LCP (Largest Contentful Paint)
                const lcpObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    if (lastEntry) {
                        trackPerformance('LCP', Math.round(lastEntry.startTime), 'ms');
                    }
                });
                lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

                // 监控 FID (First Input Delay)
                const fidObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach(entry => {
                        if (entry.name === 'first-input') {
                            trackPerformance('FID', Math.round(entry.processingStart - entry.startTime), 'ms');
                        }
                    });
                });
                fidObserver.observe({ type: 'first-input', buffered: true });

                // 监控 CLS (Cumulative Layout Shift)
                const clsObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    let clsValue = 0;
                    entries.forEach(entry => {
                        if (!entry.hadRecentInput) {
                            clsValue += entry.value;
                        }
                    });
                    if (clsValue > 0) {
                        trackPerformance('CLS', Math.round(clsValue * 1000), 'unit');
                    }
                });
                clsObserver.observe({ type: 'layout-shift', buffered: true });

                // 监控 TTFB (Time to First Byte)
                if (window.performance && window.performance.timing) {
                    const timing = window.performance.timing;
                    const ttfb = timing.responseStart - timing.navigationStart;
                    trackPerformance('TTFB', Math.round(ttfb), 'ms');
                }
            } catch (error) {
                console.warn('Web Vitals monitoring not fully supported:', error);
            }
        }
    }
}

// 动态加载 QRCode 库
let qrcodeLoading = false;
let qrcodeLoaded = false;

function loadQRCodeLibrary() {
    return new Promise((resolve, reject) => {
        // 如果已经加载，直接返回
        if (typeof QRCode !== 'undefined') {
            qrcodeLoaded = true;
            resolve();
            return;
        }

        // 如果正在加载，等待加载完成
        if (qrcodeLoading) {
            const checkInterval = setInterval(() => {
                if (typeof QRCode !== 'undefined') {
                    clearInterval(checkInterval);
                    qrcodeLoaded = true;
                    resolve();
                } else if (!qrcodeLoading) {
                    clearInterval(checkInterval);
                    reject(new Error('QRCode 库加载失败'));
                }
            }, 100);
            return;
        }

        // CDN 列表（按优先级排序）
        const cdns = [
            'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js',
            'https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.3/qrcode.min.js'
        ];

        let currentIndex = 0;
        qrcodeLoading = true;

        function tryLoadCDN(index) {
            if (index >= cdns.length) {
                qrcodeLoading = false;
                reject(new Error('所有 CDN 都加载失败'));
                return;
            }

            const script = document.createElement('script');
            script.src = cdns[index];
            script.async = true;

            script.onload = () => {
                if (typeof QRCode !== 'undefined') {
                    qrcodeLoading = false;
                    qrcodeLoaded = true;
                    resolve();
                } else {
                    // 当前 CDN 加载失败，尝试下一个
                    document.head.removeChild(script);
                    tryLoadCDN(index + 1);
                }
            };

            script.onerror = () => {
                // 当前 CDN 加载失败，尝试下一个
                if (script.parentNode) {
                    document.head.removeChild(script);
                }
                tryLoadCDN(index + 1);
            };

            document.head.appendChild(script);
        }

        tryLoadCDN(0);
    });
}

// ==================== 浏览历史模块 ====================
const HISTORY_STORAGE_KEY = 'hot_news_history';
const MAX_HISTORY_ITEMS = 15;
let isAutoSelecting = false; // 标志：是否正在自动选择（切换Tab/初始化）

/**
 * 获取浏览历史列表
 * @returns {Array} 历史记录数组
 */
function getHistoryList() {
    try {
        const data = localStorage.getItem(HISTORY_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('获取浏览历史失败:', error);
        return [];
    }
}

/**
 * 保存浏览历史
 * @param {Object} news - 热搜对象 { title, heat, platform, content }
 */
function saveToHistory(news) {
    try {
        const history = getHistoryList();

        // 检查是否已存在同标题记录
        const existingIndex = history.findIndex(item => item.title === news.title);

        if (existingIndex !== -1) {
            // 已存在：删除旧记录
            history.splice(existingIndex, 1);
        }

        // 添加新记录到顶部
        history.unshift({
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
            title: news.title,
            heat: news.heat,
            platform: news.platform,
            browseTime: new Date().toISOString(),
            content: news.content || null
        });

        // 限制数量
        if (history.length > MAX_HISTORY_ITEMS) {
            history.splice(MAX_HISTORY_ITEMS);
        }

        // 保存
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
        console.error('保存浏览历史失败:', error);
    }
}

/**
 * 删除单条历史记录
 * @param {string} id - 历史记录ID
 * @returns {boolean} 是否删除成功
 */
function deleteHistoryItem(id) {
    try {
        const history = getHistoryList();
        const newHistory = history.filter(item => item.id !== id);
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newHistory));
        return true;
    } catch (error) {
        console.error('删除历史记录失败:', error);
        return false;
    }
}

/**
 * 清空所有历史记录
 */
function clearHistory() {
    try {
        localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch (error) {
        console.error('清空历史记录失败:', error);
    }
}

/**
 * 渲染历史列表
 */
function renderHistoryList() {
    const historyList = document.getElementById('history-list');
    const history = getHistoryList();

    if (history.length === 0) {
        historyList.innerHTML = '<li class="loading-list">暂无浏览历史</li>';
        return;
    }

    const platformMap = {
        'networkhot': '全网',
        'toutiao': '头条',
        'douyin': '抖音',
        'weibo': '微博'
    };

    historyList.innerHTML = '';
    history.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'hot-item history-item';
        li.dataset.id = index + 1;
        li.dataset.historyId = item.id;

        const date = new Date(item.browseTime);
        const timeStr = date.toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        const platformName = platformMap[item.platform] || item.platform;

        const rankSpan = document.createElement('span');
        rankSpan.className = 'hot-rank';
        rankSpan.textContent = index + 1;

        const infoDiv = document.createElement('div');
        infoDiv.className = 'hot-info';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'hot-title';
        titleSpan.textContent = item.title;
        titleSpan.title = item.title;

        const heatSpan = document.createElement('span');
        heatSpan.className = 'hot-heat';

        const timeText = document.createElement('span');
        timeText.className = 'history-time';
        timeText.textContent = `${timeStr} · ${platformName}`;

        heatSpan.appendChild(timeText);
        heatSpan.appendChild(document.createTextNode(item.heat));

        infoDiv.appendChild(titleSpan);
        infoDiv.appendChild(heatSpan);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'history-delete-btn';
        deleteBtn.title = '删除';
        deleteBtn.textContent = '✕';

        li.appendChild(rankSpan);
        li.appendChild(infoDiv);
        li.appendChild(deleteBtn);

        // 绑定删除按钮事件
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (confirm('确定删除这条历史记录吗？')) {
                if (deleteHistoryItem(item.id)) {
                    renderHistoryList();
                }
            }
        });

        // 绑定点击事件
        li.addEventListener('click', function() {
            showNewsContent({
                id: index + 1,
                title: item.title,
                heat: item.heat,
                content: item.content,
                isHistory: true
            });
        });

        historyList.appendChild(li);
    });
}

// ==================== 内容缓存模块 ====================

/**
 * 从 localStorage 获取缓存的文章内容
 * @param {string} title - 文章标题
 * @returns {Object|null} 缓存数据或 null
 */
function getCachedContent(title) {
    try {
        const localCacheKey = `content-${title}`;
        const localCache = localStorage.getItem(localCacheKey);
        if (!localCache) return null;

        const cachedData = JSON.parse(localCache);
        const now = Date.now();

        // 检查缓存是否过期
        if (cachedData.expiry > now) {
            return cachedData;
        } else {
            // 缓存已过期，删除
            localStorage.removeItem(localCacheKey);
            return null;
        }
    } catch (e) {
        console.error('读取缓存出错:', e);
        return null;
    }
}

document.addEventListener('DOMContentLoaded', function () {
    // 跟踪页面访问事件
    trackEvent('页面访问', {
        userAgent: navigator.userAgent,
        language: navigator.language,
        referrer: document.referrer,
        timestamp: new Date().toISOString()
    });

    // 启动 Web Vitals 性能监控
    trackWebVitals();

    // 获取基础路径和当前设备类型（先定义，供后续使用）
    const BASE_PATH = window.location.pathname.startsWith('/hot-news') ? '/hot-news' : '';
    const SERVER_URL = BASE_PATH;

    // 获取服务器位置信息（省份）
    let serverProvince = ''; // 缓存省份信息

    // 获取服务器位置信息
    async function fetchServerLocation() {
        try {
            const response = await fetch(`${SERVER_URL}/api/server-location`);
            const data = await response.json();
            if (data && data.province) {
                serverProvince = data.province;
                console.log('服务器位置:', serverProvince);
                // 更新所有已显示的日期
                updateAllPublishTimes();
            }
        } catch (error) {
            console.error('获取服务器位置失败:', error);
        }
    }

    // 更新所有发布时间显示（包含省份）
    function updateAllPublishTimes() {
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
        const publishTimeElements = document.querySelectorAll('.author-meta p');
        publishTimeElements.forEach(el => {
            const displayText = serverProvince ? `${dateStr} · ${serverProvince}` : dateStr;
            el.textContent = displayText;
        });
    }

    // 初始化时更新日期
    updateAllPublishTimes();

    // 异步获取服务器位置
    fetchServerLocation();

    // 从URL路径中提取平台信息
    let currentPlatform = 'networkhot'; // 默认平台
    const pathParts = window.location.pathname.split('/');
    if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1];
        if (['weibo', 'toutiao', 'douyin'].includes(lastPart)) {
            currentPlatform = lastPart;
        }
    }

    const eventSources = {};

    // 检测是否为移动设备
    const isMobile = window.innerWidth <= 768;

    let targetNewsId = null;

    (function() {
        const urlParams = new URLSearchParams(window.location.search);
        targetNewsId = urlParams.get('newsId');
    })();

    // 主题切换功能
    initThemeToggle();

    // 滚动到固定位置的辅助函数
    function scrollToFixedPosition(element, offsetRatio = 0.15) {
        if (!element) return;

        // 获取元素的当前位置
        const rect = element.getBoundingClientRect();

        // 计算目标滚动位置
        // 目标：让元素的顶部位于视口顶部的 offsetRatio * windowHeight 处
        const targetOffset = window.innerHeight * offsetRatio;
        const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
        const targetScrollY = currentScrollY + rect.top - targetOffset;

        // 执行平滑滚动
        window.scrollTo({
            top: Math.max(0, targetScrollY),
            behavior: 'smooth'
        });

        // console.log(`滚动到位置: ${targetScrollY}px (距离顶部${(offsetRatio * 100).toFixed(0)}%)`);
    }

    // 添加分享功能（只初始化一次，使用事件委托）
    let shareButtonsInitialized = false;
    initShareButtons();

    // 更新网站标题
    document.title = "今日热搜榜";

    // 更新 logo 文本
    const logoTitle = document.querySelector('.logo h1');
    if (logoTitle) {
        logoTitle.textContent = "今日热搜榜";
    }

    // 确保 logo 图标是火焰
    const logoIcon = document.querySelector('.logo .icon');
    if (logoIcon) {
        logoIcon.textContent = "🔥";
    }

    // 初始化主题切换功能
    function initThemeToggle() {
        const themeToggleBtn = document.getElementById('theme-toggle');
        if (!themeToggleBtn) return;

        // 检查本地存储中的主题设置
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            applyDarkMode(true);
        }

        // 添加点击事件
        themeToggleBtn.addEventListener('click', function () {
            document.body.classList.toggle('dark-mode');

            // 更新所有需要暗黑模式的元素
            const isDarkMode = document.body.classList.contains('dark-mode');
            applyDarkMode(isDarkMode);

            // 跟踪主题切换事件
            trackEvent('主题切换', {
                theme: isDarkMode ? 'dark' : 'light'
            });

            // 保存主题设置到本地存储
            localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        });
    }

    // 应用深色模式到所有元素
    function applyDarkMode(isDarkMode) {
        const elements = [
            '.content-area', '.news-content', '.placeholder',
            '.image-container', 'header', 'main', '.left-panel',
            '.hot-item', '.platform-tab', '.text-content',
            '.author-info', '.author-meta', '.share-btn',
            '.loading', '.error-container', '.mobile-content',
            '.mobile-header', '.mobile-text-content',
            '.share-container', '.toast-message'
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

    // 初始化分享按钮功能（使用事件委托，只设置一次）
    // let shareButtonsInitialized = false;
    function initShareButtons() {
        // 防止重复初始化
        if (shareButtonsInitialized) {
            return;
        }

        // 使用事件委托，在 content-area 上监听所有点击事件
        // 这样无论何时动态生成内容，分享按钮都能工作
        const contentArea = document.getElementById('content-area');
        if (!contentArea) {
            // 如果容器还没加载，稍后重试（最多重试3次）
            let retryCount = 0;
            const maxRetries = 3;
            const retryInterval = setInterval(() => {
                retryCount++;
                const container = document.getElementById('content-area');
                if (container) {
                    clearInterval(retryInterval);
                    setupShareButtonListeners(container);
                    shareButtonsInitialized = true;
                } else if (retryCount >= maxRetries) {
                    clearInterval(retryInterval);
                    console.warn('内容区域未找到，分享功能可能不可用');
                }
            }, 100);
            return;
        }

        setupShareButtonListeners(contentArea);
        shareButtonsInitialized = true;
    }

    // 设置分享按钮事件监听器（使用事件委托）
    function setupShareButtonListeners(container) {
        // 只在容器上添加一次事件监听器
        container.addEventListener('click', function (e) {
            // 查找点击的元素是否是分享按钮或其子元素
            const target = e.target.closest('.share-btn');
            if (!target) return;

            // 根据按钮的类名或ID执行相应操作
            if (target.classList.contains('copy-link') || target.id === 'copy-link-btn') {
                // 复制链接
                const url = window.location.href;
                navigator.clipboard.writeText(url)
                    .then(() => {
                        showToast('链接已复制到剪贴板');
                    })
                    .catch(err => {
                        console.error('复制失败:', err);
                        fallbackCopyTextToClipboard(url);
                    });
            } else if (target.classList.contains('share-weibo') || target.id === 'share-weibo-btn') {
                // 分享到微博
                const url = encodeURIComponent(window.location.href);
                const title = encodeURIComponent(document.title);
                const weiboUrl = `https://service.weibo.com/share/share.php?url=${url}&title=${title}`;
                window.open(weiboUrl, '_blank');
            } else if (target.classList.contains('share-wechat') || target.id === 'share-wechat-btn') {
                // 分享到微信 - 显示二维码
                showWechatQRCode();
            }
        });
    }

    // 创建提示框
    function showToast(message) {
        console.log('显示提示:', message);
        // 移除可能存在的旧提示
        const oldToast = document.querySelector('.toast-message');
        if (oldToast) {
            oldToast.remove();
        }

        // 创建新提示
        const toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.textContent = message;

        // 添加到页面
        document.body.appendChild(toast);

        // 添加显示类
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        // 3秒后移除
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }

    // 显示微信二维码
    function showWechatQRCode() {
        const url = window.location.href;

        // 移除已存在的二维码弹窗
        const existingQR = document.getElementById('wechat-qr-modal');
        if (existingQR) {
            existingQR.remove();
        }

        // 创建二维码弹窗
        const modal = document.createElement('div');
        modal.id = 'wechat-qr-modal';
        modal.className = 'wechat-qr-modal';

        // 使用在线 API 生成二维码图片
        // 使用多个备用 API，按优先级排序
        const qrApiUrls = [
            `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`,
            `https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=${encodeURIComponent(url)}`,
            `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=2&data=${encodeURIComponent(url)}`
        ];

        modal.innerHTML = `
            <div class="wechat-qr-content">
                <div class="wechat-qr-header">
                    <h3>微信扫码分享</h3>
                    <button class="wechat-qr-close" aria-label="关闭">&times;</button>
                </div>
                <div class="wechat-qr-body">
                    <div class="wechat-qr-loading">正在生成二维码...</div>
                    <img id="wechat-qr-image" class="wechat-qr-image" style="display: none;" alt="二维码" />
                    <p class="wechat-qr-tip" style="display: none;">使用微信扫一扫，扫描二维码访问</p>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 显示弹窗
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);

        // 尝试加载二维码图片（使用备用 API）
        const qrImage = modal.querySelector('#wechat-qr-image');
        const loadingDiv = modal.querySelector('.wechat-qr-loading');
        const tipP = modal.querySelector('.wechat-qr-tip');

        let currentApiIndex = 0;

        function tryLoadQRImage(index) {
            if (index >= qrApiUrls.length) {
                // 所有 API 都失败
                if (loadingDiv) loadingDiv.textContent = '二维码生成失败，请稍后重试';
                setTimeout(() => {
                    modal.remove();
                }, 2000);
                return;
            }

            const img = new Image();
            let timeout;

            img.onload = () => {
                clearTimeout(timeout);
                // 成功加载，显示二维码
                if (loadingDiv) loadingDiv.style.display = 'none';
                qrImage.src = img.src;
                qrImage.style.display = 'block';
                if (tipP) tipP.style.display = 'block';
            };

            img.onerror = () => {
                clearTimeout(timeout);
                // 当前 API 失败，尝试下一个
                tryLoadQRImage(index + 1);
            };

            // 设置超时，避免长时间等待
            timeout = setTimeout(() => {
                img.onerror();
            }, 5000);

            img.src = qrApiUrls[index];
        }

        tryLoadQRImage(0);

        // 关闭按钮事件
        const closeBtn = modal.querySelector('.wechat-qr-close');
        closeBtn.addEventListener('click', () => {
            closeQRModal(modal);
        });

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeQRModal(modal);
            }
        });

        // ESC 键关闭
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeQRModal(modal);
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    }

    // 关闭二维码弹窗
    function closeQRModal(modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }

    // 备用复制方法
    function fallbackCopyTextToClipboard(text) {
        console.log('使用备用复制方法');
        const textArea = document.createElement('textarea');
        textArea.value = text;

        // 设置样式使其不可见
        textArea.style.position = 'fixed';
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.width = '2em';
        textArea.style.height = '2em';
        textArea.style.padding = '0';
        textArea.style.border = 'none';
        textArea.style.outline = 'none';
        textArea.style.boxShadow = 'none';
        textArea.style.background = 'transparent';

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand('copy');
            if (successful) {
                showToast('链接已复制到剪贴板');
            } else {
                showToast('复制失败，请手动复制');
            }
        } catch (err) {
            console.error('复制失败:', err);
            showToast('复制失败，请手动复制');
        }

        document.body.removeChild(textArea);
    }

    // 添加提示框样式
    const toastStyle = document.createElement('style');
    toastStyle.textContent = `
        .toast-message {
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%) translateY(20px);
            background-color: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            z-index: 1000;
            opacity: 0;
            transition: all 0.3s ease;
        }
        
        .toast-message.show {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        
        body.dark-mode .toast-message {
            background-color: rgba(255, 255, 255, 0.7);
            color: black;
        }
    `;
    document.head.appendChild(toastStyle);

    function showToast(message) {
        let toast = document.querySelector('.toast-notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast-notification';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // 获取热搜数据
    function fetchHotNews(platform = 'networkhot', refresh = false) {
        currentPlatform = platform;
        targetNewsId = null;

        updateUrlWithPlatform(platform);

        // 更新平台标签的激活状态
        document.querySelectorAll('.platform-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.platform === platform);
        });

        // 显示加载状态
        const hotNewsList = document.getElementById('hot-news-list');
        hotNewsList.innerHTML = '<div class="loading-list">加载热搜数据中...</div>';

        fetch(`${SERVER_URL}/api/hot-news?platform=${platform}&refresh=${refresh}`)
            .then(response => response.json())
            .then(data => {
                if (data.code === 200) {
                    renderHotNewsList(data.result.list);

                    if (targetNewsId) {
                        setTimeout(() => {
                            selectAndSaveHistory(parseInt(targetNewsId));
                        }, 300);
                    } else {
                        setTimeout(() => {
                            previewNews(1);
                        }, 300);
                    }
                } else {
                    console.error('获取热搜失败:', data.msg || data.error);
                    renderHotNewsList(getFallbackData(platform));
                    setTimeout(() => {
                        previewNews(1);
                    }, 300);
                }
            })
            .catch(error => {
                console.error('API请求错误:', error);
                renderHotNewsList(getFallbackData(platform));
                setTimeout(() => {
                    selectNewsByIndex(1);
                }, 300);
            });
    }

    // 预览新闻（仅选中显示，不保存到历史）
    function previewNews(index) {
        const hotItem = document.querySelector(`.hot-item[data-id="${index}"]`);
        if (hotItem) {
            // 更新UI状态
            document.querySelectorAll('.hot-item').forEach(item => item.classList.remove('active'));
            hotItem.classList.add('active');

            const title = hotItem.querySelector('.hot-title')?.textContent || '';
            const heat = hotItem.querySelector('.hot-heat')?.textContent || '';

            // 显示内容，但不保存到历史
            showNewsContent({
                id: index,
                title: title,
                heat: heat
            });

            hotItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            console.log(`已预览第 ${index} 个热搜`);
        }
    }

    // 选中并保存到历史
    function selectAndSaveHistory(index) {
        const hotItem = document.querySelector(`.hot-item[data-id="${index}"]`);
        if (hotItem) {
            // 模拟点击该热搜项
            hotItem.click();

            // 滚动到该热搜项
            hotItem.scrollIntoView({ behavior: 'smooth', block: 'center' });

            console.log(`已自动选中第 ${index} 个热搜`);
        } else {
            console.error(`找不到索引为 ${index} 的热搜项`);
        }
    }

    // 更新URL中的平台信息
    function updateUrlWithPlatform(platform) {
        if (!platform) return;

        const url = new URL(window.location.href);

        let newPath = BASE_PATH;
        if (platform !== 'networkhot') {
            newPath = `${BASE_PATH}/${platform}`;
        }
        url.pathname = newPath;

        window.history.replaceState({}, '', url.toString());
    }

    // 更新URL中的newsId参数
    function updateUrlWithNewsId(newsId) {
        if (!newsId) return;

        // 创建新的URL对象
        const url = new URL(window.location.href);

        // 设置或更新newsId参数
        url.searchParams.set('newsId', newsId);
        // url.searchParams.set('t', Date.now()); // 防止缓存

        // 使用History API更新URL，不刷新页面
        window.history.replaceState({}, '', url.toString());
    }

    // 渲染热搜列表
    function renderHotNewsList(hotNews) {
        const hotNewsList = document.getElementById('hot-news-list');
        const contentArea = document.getElementById('content-area');

        // 清空热搜列表
        hotNewsList.innerHTML = '';

        // 清空PC端内容区域
        if (contentArea) {
            const placeholder = contentArea.querySelector('.placeholder');
            contentArea.innerHTML = '';
            contentArea.appendChild(placeholder);
        }

        // 清除所有EventSource连接
        Object.keys(eventSources).forEach(key => {
            if (eventSources[key]) {
                eventSources[key].close();
                delete eventSources[key];
            }
        });

        // 移除所有移动端内容
        document.querySelectorAll('.mobile-content').forEach(el => el.remove());

        hotNews.forEach((news, index) => {
            if (index >= 15) return; // 只显示前15条

            const title = news.word || news.title || news.hotword || news.name;
            const heat = news.hotnum || news.hotindex || news.hotValue || news.score || (Math.floor(Math.random() * 3000) + 1000) + '万';

            // 创建列表项
            const li = document.createElement('li');
            li.className = 'hot-item';
            li.dataset.id = index + 1;

            const rankClass = index < 3 ? ` top${index + 1}` : '';

            // 为移动端添加展开/收起按钮
            const toggleBtn = isMobile ? '<button class="toggle-btn" aria-label="展开/收起"></button>' : '';

            li.innerHTML = `
                <span class="hot-rank${rankClass}">${index + 1}</span>
                <span class="hot-title">${title}</span>
                <span class="hot-heat">${heat}</span>
                ${toggleBtn}
            `;

            // PC端内容区域处理
            if (!isMobile && contentArea) {
                const newsId = `news-${index + 1}`;
                const template = document.getElementById('news-content-template');
                const newsContent = template.content.cloneNode(true).querySelector('.news-content');

                newsContent.id = newsId;
                // newsContent.querySelector('.content-title').textContent = `${index + 1}. ${title}`;

                contentArea.appendChild(newsContent);
            }

            // 添加点击事件
            li.addEventListener('click', function(e) {
                // 如果点击的是切换按钮，不执行其他操作
                if (isMobile && e.target.closest('.toggle-btn')) {
                    return;
                }

                // 移除其他项目的active类
                document.querySelectorAll('.hot-item').forEach(item => {
                    item.classList.remove('active');
                });

                // 为当前项目添加active类
                this.classList.add('active');

                // 更新URL，但不刷新页面
                const newsId = this.dataset.id;
                updateUrlWithNewsId(newsId);

                // 跟踪热搜点击事件和性能指标
                const startTime = performance.now();
                trackEvent('热搜点击', {
                    newsId: newsId,
                    title: title,
                    rank: index + 1,
                    platform: currentPlatform
                });

                // 记录点击后的加载性能
                setTimeout(() => {
                    const loadTime = performance.now() - startTime;
                    // 滚动到固定位置（距离顶部15%），等待CSS过渡开始后执行滚动（150ms延迟）
                    if (isMobile) {
                        scrollToFixedPosition(this, 0.15);
                    }
                    trackPerformance('内容加载时间', loadTime, 'ms');
                }, 100);

                 // 显示对应的内容区域
                 showNewsContent({
                     id: index + 1,
                     title: title,
                     heat: heat
                 });

                 // TODO: 优化：延迟到内容生成完毕后再保存到历史记录
                 // saveToHistory({
                 //     title: title,
                 //     heat: heat,
                 //     platform: currentPlatform
                 // });
            });

            // 注意：移动端toggle按钮的事件处理已通过事件委托在hotNewsList上统一处理
            // 这样可以确保即使列表重新渲染，事件监听器仍然有效

            hotNewsList.appendChild(li);
        });

        // 页面加载时默认选中第一个热搜，除非URL中有指定的newsId
        if (hotNews.length > 0 && !targetNewsId) {
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
    function getFallbackData(platform) {
        const fallbackData = {
            weibo: [
                { word: "热搜榜加载失败，请刷新重试", hotindex: "9999万" },
                { word: "网络连接问题", hotindex: "8888万" },
                { word: "请检查您的网络设置", hotindex: "7777万" },
                { word: "点击刷新按钮重新加载", hotindex: "6666万" },
                { word: "或者尝试切换其他平台", hotindex: "5555万" }
            ],
            toutiao: [
                { title: "头条热榜加载失败，请刷新重试", hotValue: "9999万" },
                { title: "网络连接问题", hotValue: "8888万" },
                { title: "请检查您的网络设置", hotValue: "7777万" },
                { title: "点击刷新按钮重新加载", hotValue: "6666万" },
                { title: "或者尝试切换其他平台", hotValue: "5555万" }
            ],
            douyin: [
                { hotword: "抖音热点加载失败，请刷新重试", score: "9999万" },
                { hotword: "网络连接问题", score: "8888万" },
                { hotword: "请检查您的网络设置", score: "7777万" },
                { hotword: "点击刷新按钮重新加载", score: "6666万" },
                { hotword: "或者尝试切换其他平台", score: "5555万" }
            ]
        };

        return fallbackData[platform] || fallbackData.weibo;
    }

    // 初始化平台标签点击事件
    function initPlatformTabs() {
        const platformTabs = document.querySelectorAll('.platform-tab');
        const hotNewsList = document.getElementById('hot-news-list');
        const historyList = document.getElementById('history-list');

        platformTabs.forEach(tab => {
            tab.addEventListener('click', function () {
                const platform = this.dataset.platform;

                // 更新 Tab 激活状态
                platformTabs.forEach(t => t.classList.remove('active'));
                this.classList.add('active');

                if (platform === 'history') {
                    // 历史 Tab：显示历史列表，隐藏热搜列表
                    historyList.style.display = 'block';
                    hotNewsList.style.display = 'none';
                    renderHistoryList();
                } else {
                    // 热搜平台：显示热搜列表，隐藏历史列表
                    hotNewsList.style.display = 'block';
                    historyList.style.display = 'none';
                    fetchHotNews(platform);
                }

                // 更新当前平台
                currentPlatform = platform;

                trackEvent('平台切换', {
                    platform: platform,
                    previousPlatform: currentPlatform
                });
            });
        });

        // 添加刷新按钮功能
        const refreshBtn = document.querySelector('.refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function () {
                const icon = this.querySelector('i');
                if (icon) {
                    icon.classList.add('rotating');

                    setTimeout(() => {
                        icon.classList.remove('rotating');
                    }, 1000);
                }

                // 跟踪刷新事件
                trackEvent('手动刷新', {
                    platform: currentPlatform
                });

                fetchHotNews(currentPlatform, true);
            });
        }

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
    }

    // 初始化移动端抽屉展开/收起按钮事件
    function initMobileToggle() {
        const hotNewsList = document.getElementById('hot-news-list');
        if (!hotNewsList) return;

        hotNewsList.addEventListener('click', function(e) {
            const toggleBtn = e.target.closest('.toggle-btn');
            if (!toggleBtn) return;

            const hotItem = toggleBtn.closest('.hot-item');
            if (!hotItem) return;

            const newsId = hotItem.dataset.id;
            if (!newsId) return;

            // 检查是否已存在 mobile-content，不存在则创建
            let mobileContent = document.querySelector(`[data-id="mobile-news-${newsId}"]`);
            if (!mobileContent) {
                // 获取标题和热度
                const title = hotItem.querySelector('.hot-title')?.textContent || '';
                const heat = hotItem.querySelector('.hot-heat')?.textContent || '热度未知';
                // 创建移动端内容
                mobileContent = createMobileContent(newsId, title, heat, hotItem);
            }

            hotItem.classList.toggle('expanded');
        });
    }

    // 初始化
    initPlatformTabs();
    initMobileToggle();

    // 根据URL路径加载对应平台的热搜数据
    fetchHotNews(currentPlatform);

    // 使用流式API生成内容
    function generateAIContent(newsId, title) {
        const newsContent = document.getElementById(`news-${newsId}`);
        const contentContainer = newsContent.querySelector('.text-content');
        const imageContainer = newsContent.querySelector('.image-container');
        const loadingElement = newsContent.querySelector('.loading');
        const aiContent = newsContent.querySelector('.ai-content');
        const hotItem = document.querySelector(`.hot-item[data-id="${newsId}"]`);
        const heat = hotItem ? hotItem.querySelector('.hot-heat').textContent : '热度未知';

        // 显示加载状态
        loadingElement.style.display = 'flex';
        contentContainer.innerHTML = '';

        // 清空图片容器
        imageContainer.innerHTML = '';
        imageContainer.innerHTML = '<div class="image-loading"></div>';
        let fullContent = '';
        let cachedArticles = []; // 保存参考来源信息

        generateImageForContent(newsId, title, fullContent, heat);

        // 关闭之前的EventSource连接（如果存在）
        if (eventSources[newsId]) {
            eventSources[newsId].close();
            delete eventSources[newsId];
        }

        try {
            // 检查是否启用联网搜索模式
            const searchModeToggle = document.getElementById('search-mode-toggle');
            const useSearchMode = searchModeToggle && searchModeToggle.checked;
            const apiEndpoint = useSearchMode
                ? `${SERVER_URL}/api/generate-with-search?title=${encodeURIComponent(title)}`
                : `${SERVER_URL}/api/generate?title=${encodeURIComponent(title)}`;

            // 方法1: 使用EventSource (SSE)
            const eventSource = new EventSource(apiEndpoint);
            eventSources[newsId] = eventSource;

            aiContent.style.display = 'none';

            eventSource.onopen = (evt) => {
                console.log(`SSE成功建立连接 (${newsId})`, evt);
            };

            eventSource.onmessage = function (event) {
                try {
                    const data = JSON.parse(event.data);
                    loadingElement.style.display = 'none';
                    aiContent.style.display = 'block';

                    // 处理文章链接信息
                    if (data.type === 'sources' && data.articles && data.articles.length > 0) {
                        // 保存参考来源信息
                        cachedArticles = data.articles;

                        // 在内容容器上方显示文章链接
                        const sourcesContainer = newsContent.querySelector('.article-sources');
                        if (!sourcesContainer) {
                            // 创建链接容器
                            const sourcesDiv = document.createElement('div');
                            sourcesDiv.className = 'article-sources';
                            sourcesDiv.innerHTML = '<div class="sources-label">📰 参考来源：</div><div class="sources-links"></div>';
                            // 插入到内容容器之前
                            contentContainer.parentNode.insertBefore(sourcesDiv, contentContainer);
                        }

                        const linksContainer = newsContent.querySelector('.sources-links');
                        if (linksContainer) {
                            linksContainer.innerHTML = '';
                            data.articles.forEach((article, index) => {
                                const linkElement = document.createElement('a');
                                linkElement.href = article.link;
                                linkElement.target = '_blank';
                                linkElement.rel = 'noopener noreferrer';
                                linkElement.className = 'source-link';
                                linkElement.textContent = `${index + 1}. ${article.title}`;
                                linksContainer.appendChild(linkElement);
                            });
                        }
                    }

                    if (data.message) {
                        // 消息提示不累积，直接显示
                        contentContainer.innerHTML = formatContent(data.message);
                    }

                    if (data.content) {
                        fullContent += data.content;
                        contentContainer.innerHTML = formatContent(fullContent);
                    }

                    if (data.done) {
                        // 保存到本地缓存（保存格式化后的 HTML，避免重复解析）
                        if (fullContent.trim().length > 0) {
                            try {
                                const formattedHtml = formatContent(fullContent);
                                const cacheData = {
                                    html: formattedHtml,  // 保存格式化后的 HTML
                                    articles: cachedArticles,
                                    expiry: Date.now() + (10 * 60 * 1000)
                                };
                                const localCacheKey = `content-${title}`;
                                localStorage.setItem(localCacheKey, JSON.stringify(cacheData));
                                console.log(`内容已保存到本地缓存: ${title}`);

                                // 保存到浏览历史（内容生成完毕后保存，包含完整 content）
                                saveToHistory({
                                    title: title,
                                    heat: heat,
                                    platform: currentPlatform,
                                    content: {
                                        html: formattedHtml,
                                        articles: cachedArticles
                                    }
                                });
                                console.log(`已保存到历史记录`);
                            } catch (e) {
                                console.error('保存到本地缓存失败:', e);
                            }
                        }

                        if (eventSources[newsId]) {
                            eventSources[newsId].close();
                            delete eventSources[newsId];
                        }
                    }
                } catch (e) {
                    console.error('解析事件数据出错:', e);
                }
            };

            eventSource.onerror = function (error) {
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
                        <button class="retry-button" onclick="window.retryGeneration('${newsId}', '${title}')">重试</button>
                    </div>
                `;
                loadingElement.style.display = 'none';
            };
        } catch (error) {
            console.error(`生成内容时出错 (${newsId}):`, error);
            loadingElement.style.display = 'none';

            // 显示错误信息
            contentContainer.innerHTML = `
                <div class="error-container">
                    <div class="error-icon">⚠️</div>
                    <p class="error-message">生成内容时出错</p>
                    <p class="error-action">请稍后再试或选择其他热搜话题</p>
                    <button class="retry-button" onclick="window.retryGeneration('${newsId}', '${title}')">重试</button>
                </div>
            `;
        }
    }

    // 根据内容生成图片
    function generateImageForContent(newsId, title, content, heat) {
        const newsContent = document.getElementById(`news-${newsId}`);
        const imageContainer = newsContent.querySelector('.image-container');

        // 记录图片生成开始时间
        const aiContentStartTime = performance.now();

        // 检查本地存储中是否有图片缓存
        const localCacheKey = `image-${title}`;
        const localCache = localStorage.getItem(localCacheKey);

        if (localCache) {
            try {
                const cachedData = JSON.parse(localCache);
                const now = Date.now();

                // 检查缓存是否过期（7天）
                if (cachedData.expiry > now) {
                    console.log(`从本地缓存获取图片: ${title}`);

                    // 显示缓存的图片
                    imageContainer.innerHTML = `<img src="${cachedData.url}" alt="${title}" class="generated-image">`;
                    imageContainer.classList.add('loaded');
                    imageContainer.style.display = 'block';

                    return;
                } else {
                    // 缓存已过期，删除
                    localStorage.removeItem(localCacheKey);
                }
            } catch (e) {
                console.error('解析本地图片缓存出错:', e);
                localStorage.removeItem(localCacheKey);
            }
        }

        // 构建提示词，使其更具体和相关
        // const prompt = `新闻图片，主题：${title}，内容：${content}，高质量新闻照片，清晰细节，专业新闻风格, 要写实风格，不要卡通风格`;
        const prompt = `新闻图片，主题：${title}，高质量新闻照片，清晰细节，专业新闻风格, 要写实风格，不要卡通风格`;

        // 显示加载状态
        imageContainer.innerHTML = '<div class="image-loading"></div>';

        // 调用图片生成API
        fetch(`${SERVER_URL}/api/generate-image`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt,
                title: title
            })
        })
            .then(response => response.json())
            .then(data => {
                if (data.image) {
                    // 显示生成的图片
                    const imageDisplayTime = performance.now();
                    imageContainer.innerHTML = `<img src="${data.image}" alt="${title}" class="generated-image">`;
                    imageContainer.classList.add('loaded');

                    // 记录图片加载性能
                    trackPerformance('图片显示时间', imageDisplayTime - aiContentStartTime, 'ms');

                    // 保存到本地缓存
                    try {
                        const cacheData = {
                            url: data.image,
                            expiry: Date.now() + (60 * 60 * 1000) // 1小时过期
                        };
                        localStorage.setItem(localCacheKey, JSON.stringify(cacheData));
                        console.log(`图片已保存到本地缓存: ${title}`);
                    } catch (e) {
                        console.error('保存图片到本地缓存失败:', e);
                    }
                } else {
                    // 如果没有成功生成图片，保留SVG图片
                    console.log('图片生成失败，保留SVG图片');
                    createSVGImage(newsId, title, heat);
                }
                imageContainer.style.display = 'block';
            })
            .catch(error => {
                console.error('图片生成出错:', error);
                // 保留SVG图片作为备用
                createSVGImage(newsId, title, heat);
            });
    }

    // 渲染缓存的文章内容
    function renderCachedContent(newsContent, newsId, cachedData, title, heat) {
        const contentContainer = newsContent.querySelector('.text-content');
        const imageContainer = newsContent.querySelector('.image-container');
        const loadingElement = newsContent.querySelector('.loading');
        const aiContent = newsContent.querySelector('.ai-content');

        console.log(`从本地缓存获取内容: ${title}`);

        // 显示缓存的内容
        loadingElement.style.display = 'none';
        aiContent.style.display = 'block';

        // 渲染参考来源
        if (cachedData.articles && cachedData.articles.length > 0) {
            let sourcesContainer = newsContent.querySelector('.article-sources');
            if (!sourcesContainer) {
                sourcesContainer = document.createElement('div');
                sourcesContainer.className = 'article-sources';
                sourcesContainer.innerHTML = '<div class="sources-label">📰 参考来源：</div><div class="sources-links"></div>';
                contentContainer.parentNode.insertBefore(sourcesContainer, contentContainer);
            }

            const linksContainer = newsContent.querySelector('.sources-links');
            if (linksContainer) {
                linksContainer.innerHTML = '';
                cachedData.articles.forEach((article, index) => {
                    const linkElement = document.createElement('a');
                    linkElement.href = article.link;
                    linkElement.target = '_blank';
                    linkElement.rel = 'noopener noreferrer';
                    linkElement.className = 'source-link';
                    linkElement.textContent = `${index + 1}. ${article.title}`;
                    linksContainer.appendChild(linkElement);
                });
            }
        }

        // 渲染文章内容
        if (cachedData.html) {
            contentContainer.innerHTML = cachedData.html;
        } else if (cachedData.content) {
            contentContainer.innerHTML = formatContent(cachedData.content);
        }

        // 生成图片
        if (!imageContainer.innerHTML.trim()) {
            createSVGImage(newsId, title, heat);
            setTimeout(() => {
                generateImageForContent(newsId, title, cachedData.content, heat);
            }, 500);
        }
    }

    // 创建SVG图片（作为占位符）
    function createSVGImage(newsId, title, heat) {
        const newsContent = document.getElementById(`news-${newsId}`);
        const imageContainer = newsContent.querySelector('.image-container');
        imageContainer.style.display = 'block';

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
            <svg width="100%" height="450" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="#f5f5f5"/>
                <rect width="100%" height="100%" fill="${colors[newsId % 10 + 1] || '#ff3852'}" opacity="0.1"/>
                <text x="50%" y="45%" font-family="Arial" font-size="28" fill="${colors[newsId % 10 + 1] || '#ff3852'}" text-anchor="middle" font-weight="bold">${title}</text>
                <text x="50%" y="55%" font-family="Arial" font-size="18" fill="#666" text-anchor="middle">热度: ${heat}</text>
            </svg>
        `;

        // 添加一个类来隐藏加载动画
        imageContainer.classList.add('loaded');
    }

    // 全局重试函数 - 移动端
    window.retryMobileGeneration = function (newsId, title, heat) {
        const mobileContent = document.querySelector(`[data-id="mobile-news-${newsId}"]`);
        if (mobileContent) {
            generateMobileContent(newsId, title, heat, mobileContent);
        } else {
            console.error(`找不到移动端内容容器: mobile-news-${newsId}`);
            // 尝试重新创建
            const listItem = document.querySelector(`.hot-item[data-id="${newsId}"]`);
            if (listItem) {
                createMobileContent(newsId, title, heat, listItem);
            }
        }
    };

    // 全局重试函数 - PC端
    window.retryGeneration = function (newsId, title) {
        generateAIContent(newsId, title);
    };

    // 格式化内容，添加样式
    function formatContent(content) {
        if (!content) return '';

        // 通用方案：检查内容类型，自动选择处理方式
        // 1. 如果内容包含 HTML 标签（已格式化），直接返回
        // 2. 如果内容是纯文本，进行格式化处理

        // 更准确的 HTML 检测：检查是否包含 <p> 标签（这是我们生成的 HTML 的特征）
        const hasParagraphTag = /<p\s+class/i.test(content) || /<p[^>]*>/i.test(content);

        if (hasParagraphTag) {
            return content;
        }

        // 纯文本处理：清理并格式化
        return formatPlainText(content);
    }

    // 格式化纯文本内容为 HTML
    function formatPlainText(content) {
        if (!content) return '';

        // 1. 清理文本：移除 Markdown 标记和多余字符
        const cleaned = cleanMarkdown(content);

        // 2. 按换行符分割成段落
        const paragraphs = splitIntoParagraphs(cleaned);

        // 3. 转换为 HTML，第一段添加特殊样式
        return paragraphsToHtml(paragraphs);
    }

    // 清理 Markdown 标记
    function cleanMarkdown(content) {
        return content
            // 标准化换行符
            .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
            // 移除 Markdown 标记
            .replace(/^#{1,6}\s*/gm, '')           // 标题
            .replace(/\*\*([^*]+(?:\*[^*]+)*)\*\*/g, '$1')  // 粗体
            .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')     // 斜体
            .replace(/^[\s]*[-*+•]\s+/gm, '')       // 列表
            .replace(/^\d+[\.、]\s+/gm, '')         // 数字列表
            .replace(/```[\s\S]*?```/g, '')        // 代码块
            .replace(/`([^`]+)`/g, '$1')           // 行内代码
            .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')  // 链接
            .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '')    // 图片
            // 清理空白字符
            .replace(/\n{3,}/g, '\n\n')            // 多余换行
            .replace(/[ \t]{2,}/g, ' ')            // 多余空格
            .replace(/[ \t]+$/gm, '')              // 行尾空格
            .trim();
    }

    // 将文本分割成段落
    function splitIntoParagraphs(content) {
        // 优先按双换行符分割
        let paragraphs = content.split(/\n\s*\n/).filter(p => p.trim());

        // 如果双换行符分割结果不理想，尝试其他分隔符
        if (paragraphs.length <= 1) {
            // 尝试单换行符分割（过滤太短的行）
            const lines = content.split('\n')
                .map(p => p.trim())
                .filter(p => p.length > 10);  // 只保留长度 > 10 的行

            if (lines.length > 1) {
                paragraphs = lines;
            }
        }

        // 如果还是没有段落，尝试智能分段（按句子分割）
        if (paragraphs.length <= 1 && content.length > 200) {
            // 按句子分割：。！？.!? 等标点符号
            const sentences = content.split(/([。！？\.!?]+)/).filter(s => s.trim());

            if (sentences.length > 2) {
                // 将句子重新组合成段落，每段约 3-5 个句子
                paragraphs = [];
                let currentParagraph = '';

                for (let i = 0; i < sentences.length; i++) {
                    const sentence = sentences[i];
                    currentParagraph += sentence;

                    // 检查是否是句子结束标点
                    if (/[。！？\.!?]/.test(sentence)) {
                        // 如果当前段落已经有 3-5 个句子，或者字符数超过 150，开始新段落
                        const sentenceCount = (currentParagraph.match(/[。！？\.!?]/g) || []).length;

                        if (sentenceCount >= 3 || currentParagraph.length > 150) {
                            paragraphs.push(currentParagraph.trim());
                            currentParagraph = '';
                        }
                    }
                }

                // 添加最后一个段落
                if (currentParagraph.trim()) {
                    paragraphs.push(currentParagraph.trim());
                }
            }
        }

        // 如果还是没有段落，将整个内容作为一段
        if (paragraphs.length === 0) {
            paragraphs = [content];
        }

        return paragraphs;
    }

    // 将段落数组转换为 HTML
    function paragraphsToHtml(paragraphs) {
        if (!paragraphs || paragraphs.length === 0) {
            return '';
        }

        let html = '';

        paragraphs.forEach((para, index) => {
            const escapedPara = escapeHtml(para);
            if (index === 0) {
                // 第一段添加特殊样式类
                html += `<p class="first-paragraph">${escapedPara}</p>`;
            } else if (para.trim()) {
                html += `<p>${escapedPara}</p>`;
            }
        });

        return html;
    }

    // HTML转义函数，防止XSS攻击
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 显示新闻内容 - 同时处理PC和移动端
    // 支持传入 content 缓存以快速显示
    function showNewsContent(news) {
        if (!news || !news.id || !news.title) {
            console.error('无效的新闻数据:', news);
            return;
        }
        if (isMobile) {
            // 移动端逻辑
            const listItem = document.querySelector(`.hot-item[data-id="${news.id}"]`);
            if (listItem) {
                // 收起所有已展开的热搜项（使用display:none保留DOM状态，避免重新生成）
                document.querySelectorAll('.hot-item.expanded').forEach(item => {
                    if (item !== listItem) {
                        item.classList.remove('expanded');
                    }
                });
                // 隐藏所有移动端内容区域（保留DOM和生成状态）
                document.querySelectorAll('.mobile-content').forEach(content => {
                    content.style.display = 'none';
                });
                // 展开当前项
                listItem.classList.add('expanded');

                // 检查是否已有对应的移动端内容（使用data-id精确定位）
                let existingContent = document.querySelector(`[data-id="mobile-news-${news.id}"]`);
                // 先检查本地缓存，有缓存直接渲染，不调用生成函数
                const cachedData = getCachedContent(news.title);

                if (existingContent && cachedData) {
                    // 已有DOM且有缓存，直接渲染缓存内容并显示
                    renderMobileCachedContent(news.id, existingContent, cachedData);
                    existingContent.style.display = 'block';
                } else if (existingContent && !cachedData) {
                    // 已有DOM但无缓存（生成中），直接显示
                    existingContent.style.display = 'block';
                } else {
                    // 无DOM，创建并生成
                    createMobileContent(news.id, news.title, news.heat, listItem);
                }
            }
            document.querySelector('.right-panel').style.display = 'none';
        } else {
            // PC端逻辑 - 保持原有逻辑
            const contentArea = document.getElementById('content-area');
            if (!contentArea) {
                console.error('找不到内容区域元素');
                return;
            }

            const placeholder = contentArea.querySelector('.placeholder');
            if (!placeholder) {
                console.error('找不到占位符元素');
                return;
            }

            const newsId = `news-${news.id}`;
            const newsContent = document.getElementById(newsId);

            if (!newsContent) {
                console.error(`找不到新闻内容元素: ${newsId}`);
                return;
            }

            // 隐藏所有内容区域
            document.querySelectorAll('.news-content').forEach(content => {
                content.style.display = 'none';
            });

            // 隐藏占位符
            placeholder.style.display = 'none';

            // 显示当前内容区域
            newsContent.style.display = 'block';

            // 更新文章标题（在当前newsContent内查找，确保准确）
            const articleTitle = newsContent.querySelector('#article-title');
            if (articleTitle) {
                articleTitle.textContent = `《${news.title}》热搜解读`;
            }
            // 更新发布日期为当前日期（yyyy-MM-dd格式）+ 省份
            const publishTime = newsContent.querySelector('.author-meta p');
            if (publishTime) {
                const now = new Date();
                const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
                // 如果有缓存的省份信息，直接使用；否则先显示日期，等获取到省份后再更新
                const displayText = serverProvince ? `${dateStr} · ${serverProvince}` : dateStr;
                publishTime.textContent = displayText;

                // 如果还没有省份信息，尝试获取
                if (!serverProvince) {
                    fetchServerLocation();
                }
            }

            // 检查是否已经生成过内容
            const textContent = newsContent.querySelector('.text-content');

            // 历史记录点击：只用历史记录的 content（没有就直接 API）
            // 普通点击：优先 localStorage 缓存（有过期时间）
            if (news.isHistory) {
                if (news.content) {
                    renderCachedContent(newsContent, news.id, news.content, news.title, news.heat);
                } else {
                    generateAIContent(news.id, news.title);
                }
            } else {
                const cachedData = getCachedContent(news.title);
                if (cachedData) {
                    renderCachedContent(newsContent, news.id,cachedData, news.title, news.heat);
                } else if (textContent && !textContent.innerHTML.trim()) {
                    generateAIContent(news.id, news.title);
                }
            }
        }
        // 移除这里的 initShareButtons() 调用，因为已经在 DOMContentLoaded 中初始化了
    }

    // 挂载到 window 以便历史模块调用
    window.showNewsContent = showNewsContent;

    // 创建移动端内容区域
    function createMobileContent(newsId, title, heat, listItem) {
        console.log('创建移动端内容:', newsId, title);

        // [方案A] 使用display:none保留DOM状态（当前方案）
        const existingContent = document.querySelector(`[data-id="mobile-news-${newsId}"]`);
        if (existingContent) {
            existingContent.style.display = 'block';
            return existingContent;
        }

        // [方案B] 使用remove删除DOM（如需切换方案，注释掉上面代码，取消下面注释）
        // const existingContent = document.querySelector(`[data-id="mobile-news-${newsId}"]`);
        // if (existingContent) {
        //     existingContent.remove();
        // }

        // 直接创建移动端内容元素，不依赖模板
        const mobileContent = document.createElement('div');
        mobileContent.className = 'mobile-content';
        mobileContent.dataset.id = `mobile-news-${newsId}`;

        mobileContent.innerHTML = `
            <div class="mobile-content-inner">
        
                <div class="mobile-body">
                    <div class="mobile-loading">
                        <div class="loading-spinner"></div>
                        <p>AI正在生成解读...</p>
                    </div>
                    <div class="mobile-text-content"></div>
                    <div class="mobile-image-container"></div>
                </div>
            </div>
        `;

        // 插入到列表项后面
        listItem.parentNode.insertBefore(mobileContent, listItem.nextSibling);

        // 生成内容
        generateMobileContent(newsId, title, heat, mobileContent);

        return mobileContent;
    }

    // 渲染移动端缓存内容（职责分离：渲染逻辑独立出来）
    function renderMobileCachedContent(newsId, mobileContent, cachedData) {
        const textContent = mobileContent.querySelector('.mobile-text-content');
        const imageContainer = mobileContent.querySelector('.mobile-image-container');
        const loading = mobileContent.querySelector('.mobile-loading');

        if (!textContent || !imageContainer || !loading) {
            console.error('移动端内容元素不完整');
            return;
        }

        console.log(`从本地缓存渲染移动端内容`);
        loading.style.display = 'none';

        // 渲染参考来源
        if (cachedData.articles && cachedData.articles.length > 0) {
            let sourcesContainer = mobileContent.querySelector('.article-sources');
            if (!sourcesContainer) {
                sourcesContainer = document.createElement('div');
                sourcesContainer.className = 'article-sources';
                sourcesContainer.innerHTML = '<div class="sources-label">📰 参考来源：</div><div class="sources-links"></div>';
                textContent.parentNode.insertBefore(sourcesContainer, textContent);
            }

            const linksContainer = sourcesContainer.querySelector('.sources-links');
            if (linksContainer) {
                linksContainer.innerHTML = '';
                cachedData.articles.forEach((article, index) => {
                    const linkElement = document.createElement('a');
                    linkElement.href = article.link;
                    linkElement.target = '_blank';
                    linkElement.rel = 'noopener noreferrer';
                    linkElement.className = 'source-link';
                    linkElement.textContent = `${index + 1}. ${article.title}`;
                    linksContainer.appendChild(linkElement);
                });
            }
        }

        // 渲染内容
        if (cachedData.html) {
            textContent.innerHTML = cachedData.html;
        } else if (cachedData.content) {
            textContent.innerHTML = formatContent(cachedData.content);
        }

        // 生成图片
        const heat = mobileContent.closest('.hot-item')?.querySelector('.hot-heat')?.textContent || '';
        generateMobileImage(newsId, cachedData.title || '', '', heat, imageContainer);
    }

    // 为移动端生成AI内容
    function generateMobileContent(newsId, title, heat, mobileContent) {
        // 确保mobileContent存在
        if (!mobileContent) {
            console.error('移动端内容容器不存在');
            return;
        }

        // 获取内容元素
        const textContent = mobileContent.querySelector('.mobile-text-content');
        const imageContainer = mobileContent.querySelector('.mobile-image-container');
        const loading = mobileContent.querySelector('.mobile-loading');

        // 确保所有元素存在
        if (!textContent || !imageContainer || !loading) {
            console.error('移动端内容元素不完整');
            return;
        }

        // 显示加载状态
        loading.style.display = 'flex';
        textContent.innerHTML = '';

        // 注意：缓存检查已前移到 showNewsContent，本函数只负责生成
        // 如果调用本函数，说明需要走 SSE 生成流程

        const localCacheKey = `content-${title}`;
        let fullContent = '';
        let cachedArticles = []; // 保存参考来源信息

        // 生成图片
        generateMobileImage(newsId, title, fullContent, heat, imageContainer);


        // 关闭之前的EventSource连接（如果存在）
        if (eventSources[`mobile-${newsId}`]) {
            eventSources[`mobile-${newsId}`].close();
            delete eventSources[`mobile-${newsId}`];
        }

        try {
            // 检查是否启用联网搜索模式
            const searchModeToggle = document.getElementById('search-mode-toggle');
            const useSearchMode = searchModeToggle && searchModeToggle.checked;
            const apiEndpoint = useSearchMode
                ? `${SERVER_URL}/api/generate-with-search?title=${encodeURIComponent(title)}`
                : `${SERVER_URL}/api/generate?title=${encodeURIComponent(title)}`;

            // 使用EventSource (SSE)
            const eventSource = new EventSource(apiEndpoint);
            eventSources[`mobile-${newsId}`] = eventSource;

            eventSource.onopen = (evt) => {
                console.log(`移动端SSE成功建立连接 (${newsId})`, evt);
            };

            eventSource.onmessage = function (event) {
                try {
                    const data = JSON.parse(event.data);
                    loading.style.display = 'none';

                    // 处理文章链接信息（移动端）
                    if (data.type === 'sources' && data.articles && data.articles.length > 0) {
                        // 保存参考来源信息
                        cachedArticles = data.articles;

                        // 在内容容器上方显示文章链接
                        const sourcesContainer = mobileContent.querySelector('.article-sources');
                        if (!sourcesContainer) {
                            // 创建链接容器
                            const sourcesDiv = document.createElement('div');
                            sourcesDiv.className = 'article-sources';
                            sourcesDiv.innerHTML = '<div class="sources-label">📰 参考来源：</div><div class="sources-links"></div>';
                            // 插入到文本内容之前
                            textContent.parentNode.insertBefore(sourcesDiv, textContent);
                        }

                        const linksContainer = mobileContent.querySelector('.sources-links');
                        if (linksContainer) {
                            linksContainer.innerHTML = '';
                            data.articles.forEach((article, index) => {
                                const linkElement = document.createElement('a');
                                linkElement.href = article.link;
                                linkElement.target = '_blank';
                                linkElement.rel = 'noopener noreferrer';
                                linkElement.className = 'source-link';
                                linkElement.textContent = `${index + 1}. ${article.title}`;
                                linksContainer.appendChild(linkElement);
                            });
                        }
                    }

                    if (data.message) {
                        // 消息提示不累积，直接显示
                        textContent.innerHTML = formatContent(data.message);
                    }
                    if (data.content) {
                        fullContent += data.content;
                        textContent.innerHTML = formatContent(fullContent);
                    }

                    if (data.done) {
                        // 保存到本地缓存（保存格式化后的 HTML，避免重复解析）
                        if (fullContent.trim().length > 0) {
                            try {
                                const formattedHtml = formatContent(fullContent);
                                const cacheData = {
                                    html: formattedHtml,  // 保存格式化后的 HTML
                                    articles: cachedArticles,
                                    expiry: Date.now() + (10 * 60 * 1000)
                                };
                                localStorage.setItem(localCacheKey, JSON.stringify(cacheData));
                                console.log(`内容已保存到本地缓存: ${title}`);

                                // 保存到浏览历史（内容生成完毕后保存，包含完整 content）
                                saveToHistory({
                                    title: title,
                                    heat: heat,
                                    platform: currentPlatform,
                                    content: {
                                        html: formattedHtml,
                                        articles: cachedArticles
                                    }
                                });
                                console.log(`移动端已保存到历史记录`);
                            } catch (e) {
                                console.error('保存到本地缓存失败:', e);
                            }
                        }

                        // 生成图片
                        // generateMobileImage(newsId, title, fullContent, heat, imageContainer);

                        if (eventSources[`mobile-${newsId}`]) {
                            eventSources[`mobile-${newsId}`].close();
                            delete eventSources[`mobile-${newsId}`];
                        }
                    }
                } catch (e) {
                    console.error('解析事件数据出错:', e);
                }
            };

            eventSource.onerror = function (error) {
                console.error(`移动端EventSource错误 (${newsId}):`, error);

                if (eventSources[`mobile-${newsId}`]) {
                    eventSources[`mobile-${newsId}`].close();
                    delete eventSources[`mobile-${newsId}`];
                }

                // 显示错误信息
                loading.style.display = 'none';
                textContent.innerHTML = `
                    <div class="error-container">
                        <div class="error-icon">⚠️</div>
                        <p class="error-message">生成内容时出错</p>
                        <p class="error-action">请稍后再试或选择其他热搜话题</p>
                        <button class="retry-button" onclick="window.retryMobileGeneration('${newsId}', '${title}', '${heat}')">重试</button>
                    </div>
                `;
            };
        } catch (error) {
            console.error(`移动端生成内容时出错 (${newsId}):`, error);
            loading.style.display = 'none';

            // 显示错误信息
            textContent.innerHTML = `
                <div class="error-container">
                    <div class="error-icon">⚠️</div>
                    <p class="error-message">生成内容时出错</p>
                    <p class="error-action">请稍后再试或选择其他热搜话题</p>
                    <button class="retry-button" onclick="window.retryMobileGeneration('${newsId}', '${title}', '${heat}')">重试</button>
                </div>
            `;
        }
    }

    // 为移动端生成图片
    function generateMobileImage(newsId, title, content, heat, imageContainer) {
        // 检查本地存储中是否有图片缓存
        const localCacheKey = `image-${title}`;
        const localCache = localStorage.getItem(localCacheKey);

        if (localCache) {
            try {
                const cachedData = JSON.parse(localCache);
                const now = Date.now();

                // 检查缓存是否过期
                if (cachedData.expiry > now) {
                    console.log(`从本地缓存获取图片: ${title}`);

                    // 显示缓存的图片
                    imageContainer.innerHTML = `<img src="${cachedData.url}" alt="${title}" class="generated-image">`;
                    return;
                } else {
                    // 缓存已过期，删除
                    localStorage.removeItem(localCacheKey);
                }
            } catch (e) {
                console.error('解析本地图片缓存出错:', e);
                localStorage.removeItem(localCacheKey);
            }
        }

        // 创建SVG占位图
        createMobileSVGImage(newsId, title, heat, imageContainer);

        // 构建提示词
        const prompt = `新闻图片，主题：${title}，高质量新闻照片，清晰细节，专业新闻风格, 要写实风格，不要卡通风格`;

        // 调用图片生成API
        fetch(`${SERVER_URL}/api/generate-image`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt,
                title: title
            })
        })
            .then(response => response.json())
            .then(data => {
                if (data.image) {
                    // 显示生成的图片
                    imageContainer.innerHTML = `<img src="${data.image}" alt="${title}" class="generated-image">`;

                    // 保存到本地缓存
                    try {
                        const cacheData = {
                            url: data.image,
                            expiry: Date.now() + (60 * 60 * 1000) // 1小时过期
                        };
                        localStorage.setItem(localCacheKey, JSON.stringify(cacheData));
                        console.log(`图片已保存到本地缓存: ${title}`);
                    } catch (e) {
                        console.error('保存图片到本地缓存失败:', e);
                    }
                }
            })
            .catch(error => {
                console.error('移动端图片生成出错:', error);
                // SVG图片已作为占位符显示
            });
    }

    // 创建移动端SVG图片
    function createMobileSVGImage(newsId, title, heat, imageContainer) {
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
            <svg width="100%" height="150" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="#f5f5f5"/>
                <rect width="100%" height="100%" fill="${colors[newsId % 10 + 1] || '#ff3852'}" opacity="0.1"/>
                <text x="50%" y="45%" font-family="Arial" font-size="16" fill="${colors[newsId % 10 + 1] || '#ff3852'}" text-anchor="middle" font-weight="bold">${title}</text>
                <text x="50%" y="65%" font-family="Arial" font-size="14" fill="#666" text-anchor="middle">热度: ${heat}</text>
            </svg>
        `;
    }

    // 监听窗口大小变化，动态调整布局
    window.addEventListener('resize', function () {
        const newIsMobile = window.innerWidth <= 768;

        // 如果设备类型发生变化，重新加载页面
        if (newIsMobile !== isMobile) {
            location.reload();
        }
    });
}); 