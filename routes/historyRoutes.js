const express = require('express');
const router = express.Router();

// 内存存储
let historyStore = [];
const MAX_HISTORY_ITEMS = 20;

router.post('/', async (req, res) => {
  try {
    const { platform, news } = req.body;

    if (!platform || !Array.isArray(news)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const snapshotTime = new Date();

    news.forEach(item => {
      const title = item.title;

      historyStore = historyStore.filter(existingItem => existingItem.title !== title);

      const doc = {
        _id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title,
        platform,
        heat: item.heat || 0,
        rank: item.rank || 0,
        snapshotTime,
        createdAt: snapshotTime,
        content: item.content || {}
      };

      historyStore.unshift(doc);
    });

    if (historyStore.length > MAX_HISTORY_ITEMS) {
      historyStore.splice(MAX_HISTORY_ITEMS);
    }

    res.json({ success: true, count: news.length });
  } catch (error) {
    console.error('保存历史记录失败:', error);
    res.status(500).json({ error: '保存失败' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { platform, date, limit = MAX_HISTORY_ITEMS, skip = 0 } = req.query;

    let filtered = [...historyStore];

    if (platform) {
      filtered = filtered.filter(item => item.platform === platform);
    }

    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.snapshotTime);
        return itemDate >= startDate && itemDate <= endDate;
      });
    }

    filtered.sort((a, b) => {
      const timeDiff = new Date(b.snapshotTime) - new Date(a.snapshotTime);
      if (timeDiff !== 0) return timeDiff;
      return a.rank - b.rank;
    });

    const history = filtered
      .slice(parseInt(skip), parseInt(skip) + parseInt(limit));

    res.json(history);
  } catch (error) {
    console.error('获取历史记录失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

router.get('/trend', async (req, res) => {
  try {
    const { title, platform } = req.query;

    if (!title) {
      return res.status(400).json({ error: '缺少标题参数' });
    }

    let filtered = historyStore.filter(item => item.title === title);

    if (platform) {
      filtered = filtered.filter(item => item.platform === platform);
    }

    filtered.sort((a, b) => new Date(a.snapshotTime) - new Date(b.snapshotTime));

    res.json(filtered);
  } catch (error) {
    console.error('获取趋势数据失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

router.get('/search', async (req, res) => {
  try {
    const { q, limit = MAX_HISTORY_ITEMS } = req.query;

    if (!q) {
      return res.status(400).json({ error: '缺少搜索关键词' });
    }

    const keyword = q.toLowerCase();
    const results = historyStore.filter(item =>
      item.title.toLowerCase().includes(keyword)
    );

    results.sort((a, b) => new Date(b.snapshotTime) - new Date(a.snapshotTime));

    res.json(results.slice(0, parseInt(limit)));
  } catch (error) {
    console.error('搜索失败:', error);
    res.status(500).json({ error: '搜索失败' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const index = historyStore.findIndex(item => item._id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: '记录不存在' });
    }

    historyStore.splice(index, 1);
    res.json({ success: true });
  } catch (error) {
    console.error('删除历史记录失败:', error);
    res.status(500).json({ error: '删除失败' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = {
      total: historyStore.length,
      byPlatform: {},
      latest: historyStore.length > 0 ? historyStore[historyStore.length - 1] : null
    };

    historyStore.forEach(item => {
      stats.byPlatform[item.platform] = (stats.byPlatform[item.platform] || 0) + 1;
    });

    res.json(stats);
  } catch (error) {
    console.error('获取统计失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

module.exports = router;
