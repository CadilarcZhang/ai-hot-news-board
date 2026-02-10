const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('http://localhost:3001/hot-news', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  console.log('Page title:', await page.title());

  // 查找所有可能的新闻项选择器
  const selectors = ['.news-item', '.hot-item', '.item', '.news-list li', '.hot-news li'];
  for (const sel of selectors) {
    const count = await page.locator(sel).count();
    if (count > 0) {
      console.log(`Selector "${sel}": found ${count} items`);
    }
  }

  // 获取左侧面板的HTML片段
  const leftPanel = await page.locator('#left-panel').first();
  if (await leftPanel.count() > 0) {
    const innerHTML = await leftPanel.innerHTML();
    console.log('\nLeft panel HTML sample:\n', innerHTML.substring(0, 2000));
  } else {
    console.log('\n#left-panel not found, trying to find main container');
    const mainContainer = await page.locator('.container, main, body').first();
    const bodyHTML = await mainContainer.innerHTML();
    console.log('\nBody/Main HTML sample:\n', bodyHTML.substring(0, 3000));
  }

  await browser.close();
})();
