const express = require('express');
const router = express.Router();
const hotNewsController = require('../controllers/hotNewsController');
const contentController = require('../controllers/contentController');

// 热搜数据路由
router.get('/hot-news', hotNewsController.getHotNews);

// 内容生成路由
router.post('/generate-content', contentController.generateContent);

module.exports = router; 