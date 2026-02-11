const { chromium } = require('playwright');

(async () => {
  console.log('=== 浏览历史功能详细测试 ===\n');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:3001/hot-news', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 清空现有历史记录
    await page.evaluate(() => {
      localStorage.removeItem('hot_news_history');
    });
    console.log('1. 已清空历史记录\n');

    // 获取当前热搜列表的标题
    const currentTitles = await page.evaluate(() => {
      const items = document.querySelectorAll('.hot-item .hot-title');
      return Array.from(items).map(el => el.textContent.trim());
    });
    console.log('2. 当前热搜标题:');
    currentTitles.forEach((t, i) => console.log(`   ${i + 1}. ${t}`));
    console.log('');

    // 点击第2条
    console.log('3. 点击第2条热搜');
    await page.locator('.hot-item').nth(1).click();
    await page.waitForTimeout(3000);

    let history = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('hot_news_history') || '[]');
    });
    console.log(`   历史记录数: ${history.length}`);
    console.log(`   保存的标题: "${history[0]?.title}"`);
    console.log(`   当前第2条标题: "${currentTitles[1]}"`);
    console.log(`   标题是否完全一致: ${history[0]?.title === currentTitles[1]}`);
    console.log('');

    // 再次点击同一条
    console.log('4. 再次点击第2条热搜');
    await page.locator('.hot-item').nth(1).click();
    await page.waitForTimeout(3000);

    history = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('hot_news_history') || '[]');
    });
    console.log(`   历史记录数: ${history.length}`);
    if (history.length > 0) {
      history.forEach((h, i) => {
        console.log(`   ${i + 1}. "${h.title}" (${h.browseTime})`);
      });
    }
    console.log('');

    // 点击第3条
    console.log('5. 点击第3条热搜');
    await page.locator('.hot-item').nth(2).click();
    await page.waitForTimeout(3000);

    history = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('hot_news_history') || '[]');
    });
    console.log(`   历史记录数: ${history.length}`);
    if (history.length > 0) {
      history.forEach((h, i) => {
        console.log(`   ${i + 1}. "${h.title}" (平台: ${h.platform})`);
      });
    }

  } catch (error) {
    console.error('测试出错:', error.message);
  } finally {
    await browser.close();
  }
})();
