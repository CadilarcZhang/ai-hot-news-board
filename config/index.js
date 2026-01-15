require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3001,
    tianApiKey: process.env.TIANAPI_KEY,
    aiApiKey: process.env.AI_API_KEY,
    environment: process.env.NODE_ENV || 'development',
    GOOGLE_SEARCH_API_KEY: process.env.GOOGLE_SEARCH_API_KEY,
    GOOGLE_SEARCH_ENGINE_ID: process.env.GOOGLE_SEARCH_ENGINE_ID,
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