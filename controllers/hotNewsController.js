const axios = require('axios');
const cache = require('../utils/cache');

const TIANAPI_KEY = process.env.TIANAPI_KEY;

exports.getHotNews = async (req, res, next) => {
    try {
        const platform = req.query.platform || 'weibo';
        
        // 尝试从缓存获取热搜数据
        const cacheKey = `hot-news-${platform}`;
        const cachedData = cache.get(cacheKey);
        
        if (cachedData) {
            console.log(`从缓存获取${platform}热搜数据`);
            return res.json(cachedData);
        }
        
        // 根据平台选择不同的API接口
        const endpoints = {
            'weibo': 'weibohot',
            'toutiao': 'toutiaohot',
            'douyin': 'douyinhot'
        };
        
        const endpoint = endpoints[platform] || 'weibohot';
        if (!TIANAPI_KEY) {
            return res.status(500).json({ error: 'TIANAPI_KEY 未配置' });
        }
        const apiUrl = `https://apis.tianapi.com/${endpoint}/index?key=${TIANAPI_KEY}`;
        
        const response = await axios.get(apiUrl);
        
        // 缓存结果，设置5分钟过期
        cache.set(cacheKey, response.data, 300);
        
        res.json(response.data);
    } catch (error) {
        next(error);
    }
}; 
