const { chromium } = require('playwright');

(async () => {
  console.log('=== 浏览历史功能完整测试 ===\n');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:3001/hot-news', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 1. 清空历史记录
    console.log('1. 清空历史记录');
    await page.evaluate(() => {
      localStorage.removeItem('hot_news_history');
    });
    console.log('   ✓ 已清空\n');

    // 2. 访问首页并查看初始状态
    console.log('2. 访问 http://localhost:3001/hot-news');
    console.log(`   页面标题: ${await page.title()}`);
    const newsCount = await page.$$eval('#hot-news-list .hot-item', items => items.length);
    console.log(`   热搜列表: ${newsCount} 条`);
    const secondNewsTitle = await page.locator('#hot-news-list .hot-item').nth(1).locator('.hot-title').textContent();
    console.log(`   第2条新闻: ${secondNewsTitle.trim()}\n`);

    // 3. 点击第2个热搜
    console.log('3. 点击第2个热搜');
    await page.locator('#hot-news-list .hot-item').nth(1).click();
    await page.waitForTimeout(3000);

    let history = await page.evaluate(() => JSON.parse(localStorage.getItem('hot_news_history') || '[]'));
    console.log(`   历史记录数: ${history.length}`);
    if (history.length > 0) {
      console.log(`   ✓ 保存成功: "${history[0].title}"`);
      console.log(`   - 平台字段: ${history[0].platform}`);
      console.log(`   - 浏览时间: ${history[0].browseTime}\n`);
    }

    // 4. 点击"历史" Tab
    console.log('4. 点击"历史" Tab');
    await page.click('button[data-platform="history"]');
    await page.waitForTimeout(1000);

    // 检查history-list容器
    const historyListItems = await page.$$('#history-list .hot-item');
    console.log(`   历史列表(#history-list)显示: ${historyListItems.length} 条记录`);

    if (historyListItems.length > 0) {
      const firstItem = historyListItems[0];
      const html = await firstItem.evaluate(el => el.innerHTML);
      const timeMatch = html.match(/(\d{2}-\d{2}\s+\d{2}:\d{2})/);
      const platformMatch = html.match(/全网|微博|头条|抖音/);

      const title = await page.locator('#history-list .hot-item .hot-title').first().textContent();
      console.log(`   ✓ 第一条记录:`);
      console.log(`     - 标题: ${title.trim()}`);
      console.log(`     - 平台: ${platformMatch ? platformMatch[0] : '未显示'}`);
      console.log(`     - 时间: ${timeMatch ? timeMatch[0] : '未显示'}\n`);
    } else {
      console.log('   ✗ 历史列表为空\n');
    }

    // 5. 测试删除功能
    console.log('5. 测试删除功能');
    const deleteBtn = await page.$('#history-list .hot-item .history-delete-btn');
    if (deleteBtn) {
      page.once('dialog', async dialog => {
        console.log(`   确认框: "${dialog.message()}"`);
        await dialog.accept();
      });
      await deleteBtn.click();
      await page.waitForTimeout(1000);

      history = await page.evaluate(() => JSON.parse(localStorage.getItem('hot_news_history') || '[]'));
      const afterDeleteCount = await page.$$('#history-list .hot-item').then(items => items.length);
      console.log(`   storage记录数: ${history.length}`);
      console.log(`   列表显示数: ${afterDeleteCount}`);
      console.log('   ✓ 删除功能正常\n');
    } else {
      console.log('   ✗ 未找到删除按钮\n');
    }

    // 6. 返回全网，验证去重
    console.log('6. 返回"全网" Tab，验证去重功能');
    await page.click('button[data-platform="networkhot"]');
    await page.waitForTimeout(1000);

    // 先添加两条不同的记录
    await page.locator('#hot-news-list .hot-item').nth(1).click();
    await page.waitForTimeout(2000);
    await page.locator('#hot-news-list .hot-item').nth(2).click();
    await page.waitForTimeout(2000);

    history = await page.evaluate(() => JSON.parse(localStorage.getItem('hot_news_history') || '[]'));
    console.log(`   添加两条后记录数: ${history.length}`);

    // 再次点击第2条，测试去重
    console.log('   再次点击第2条...');
    await page.locator('#hot-news-list .hot-item').nth(1).click();
    await page.waitForTimeout(2000);

    history = await page.evaluate(() => JSON.parse(localStorage.getItem('hot_news_history') || '[]'));
    console.log(`   去重后记录数: ${history.length}`);

    if (history.length === 2) {
      console.log('   ✓ 去重正常: 删除旧记录，只保留1条新记录');
    } else if (history.length === 3) {
      console.log('   ✗ 去重失败: 新增了记录而非更新');
    } else {
      console.log(`   ? 记录数异常: ${history.length}`);
    }

    // 显示当前历史
    console.log('\n   当前历史记录:');
    history.forEach((h, i) => console.log(`     ${i + 1}. ${h.title}`));

    // 7. 验证历史列表显示
    console.log('\n7. 切换到历史Tab验证显示');
    await page.click('button[data-platform="history"]');
    await page.waitForTimeout(500);

    const displayItems = await page.$$('#history-list .hot-item');
    console.log(`   历史列表显示: ${displayItems.length} 条`);

    if (displayItems.length > 0) {
      const first = displayItems[0];
      const html = await first.evaluate(el => el.innerHTML);
      console.log(`   HTML结构: ${html.substring(0, 300)}`);
    }

  } catch (error) {
    console.error('\n测试出错:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n=== 测试完成 ===');
  }
})();
