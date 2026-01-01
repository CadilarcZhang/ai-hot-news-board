require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3001,
    tianApiKey: process.env.TIANAPI_KEY || 'eb50731204ecb974aa2fcc8f22478f42',
    aiApiKey: process.env.AI_API_KEY || 'sk-pxmeadiyndbhhtvzvblpgnmyalwvhvvkikllrfjmkqzwtnvo',
    environment: process.env.NODE_ENV || 'development',
    GOOGLE_SEARCH_API_KEY: process.env.GOOGLE_SEARCH_API_KEY || 'AIzaSyCH7yE0t_zPFMribXwVkj-IQYjfvoWyvDo',
    GOOGLE_SEARCH_ENGINE_ID: process.env.GOOGLE_SEARCH_ENGINE_ID || '9441a3119c30b4a6e',
    cache: {
        hotNewsExpiry: 300, // 5分钟
        contentExpiry: 3600 // 1小时
    },
    cors: {
        origins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3001', 'http://127.0.0.1:3001'],
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }
}; 