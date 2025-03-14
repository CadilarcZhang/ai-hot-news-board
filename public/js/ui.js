// UI模块
import API from './api.js';
import { formatContent, getFallbackData } from './utils.js';

const UI = {
    init() {
        this.setupEventListeners();
        this.fetchHotNews('weibo');
    },
    
    setupEventListeners() {
        // 平台标签切换
        const platformTabs = document.querySelectorAll('.platform-tab');
        platformTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                platformTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const platform = tab.dataset.platform;
                this.fetchHotNews(platform);
            });
        });
        
        // 刷新按钮
        const refreshBtn = document.querySelector('.refresh-btn');
        refreshBtn.addEventListener('click', () => {
            const icon = refreshBtn.querySelector('i');
            icon.classList.add('rotating');
            setTimeout(() => icon.classList.remove('rotating'), 1000);
            
            const activePlatform = document.querySelector('.platform-tab.active').dataset.platform;
            this.fetchHotNews(activePlatform);
        });
    },
    
    async fetchHotNews(platform) {
        const hotNewsList = document.getElementById('hot-news-list');
        hotNewsList.innerHTML = '<div class="loading-list">加载热搜数据中...</div>';
        
        try {
            const hotNews = await API.fetchHotNews(platform);
            this.renderHotNewsList(hotNews);
        } catch (error) {
            console.error('获取热搜失败:', error);
            this.renderHotNewsList(getFallbackData(platform));
        }
    },
    
    renderHotNewsList(hotNews) {
        // 渲染热搜列表的代码...
    },
    
    showNewsContent(news) {
        // 显示新闻内容的代码...
    },
    
    generateAIContent(title) {
        const contentContainer = document.getElementById('text-content');
        
        return API.generateContent(title, {
            onStart: () => {
                contentContainer.innerHTML = `
                    <div class="typing-indicator">
                        <p>AI正在快速生成内容<span class="dot-animation">...</span></p>
                        <div class="typing-dots">
                            <span></span><span></span><span></span>
                        </div>
                    </div>
                `;
            },
            onContent: (content, fullContent) => {
                contentContainer.innerHTML = formatContent(fullContent);
            },
            onComplete: (fullContent) => {
                contentContainer.innerHTML = formatContent(fullContent);
            },
            onError: (error) => {
                this.handleError(contentContainer, error, title);
            }
        });
    },
    
    handleError(container, error, title) {
        // 错误处理代码...
    }
};

export default UI; 