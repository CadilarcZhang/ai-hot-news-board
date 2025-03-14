// 工具函数模块
export function formatContent(text) {
    if (!text || !text.trim()) {
        return '<p>正在思考中...</p>';
    }
    
    // 将文本按段落分割并包装在<p>标签中
    let paragraphs = text.split('\n\n').filter(p => p.trim());
    
    if (paragraphs.length <= 1) {
        paragraphs = text.split('\n').filter(p => p.trim());
    }
    
    if (paragraphs.length === 0) {
        return `<p>${text}</p>`;
    }
    
    return paragraphs.map(p => `<p>${p}</p>`).join('');
}

export function getFallbackData(platform = 'weibo') {
    // 备用数据代码...
}

export function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
} 