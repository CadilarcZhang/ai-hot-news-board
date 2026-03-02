require('dotenv').config();

const parseBooleanEnv = (value, defaultValue = false) => {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }

    if (typeof value === 'boolean') {
        return value;
    }

    return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

module.exports = {
    port: process.env.PORT || 3001,
    tianApiKey: process.env.TIANAPI_KEY,
    aiApiKey: process.env.AI_API_KEY,
    adminApiToken: process.env.ADMIN_API_TOKEN,
    adminCorsOrigins: process.env.ADMIN_CORS_ORIGINS
        ? process.env.ADMIN_CORS_ORIGINS.split(',').map((item) => item.trim()).filter(Boolean)
        : ['http://localhost:3001', 'http://127.0.0.1:3001'],
    GOOGLE_SEARCH_SWITCH: parseBooleanEnv(process.env.GOOGLE_SEARCH_SWITCH, false),
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
