const assert = require('assert');
const search = require('../lib/newsSearch');

function article(url, title, extra) {
    return Object.assign({
        title,
        link: url,
        snippet: '特斯拉宣布在中国降价',
        source: 'google',
        publishedAt: Date.now() - 86400000
    }, extra || {});
}

async function testQueryAndParams() {
    assert.strictEqual(search.buildSearchQuery('🔥#特斯拉降价#！！'), '特斯拉降价 新闻');
    assert.strictEqual(search.buildSearchQuery('今日新闻'), '今日新闻');
    assert.strictEqual(search.cleanHotSearchTitle('【热搜】苹果发布会…'), '热搜 苹果发布会');

    const params = search.buildGoogleParams('特斯拉降价 新闻', 'd3');
    assert.strictEqual(params.dateRestrict, 'd3');
    assert.strictEqual(params.num, 10);
    assert.strictEqual(params.lr, 'lang_zh-CN');
    assert.strictEqual(params.gl, 'cn');
    assert.strictEqual(params.hl, 'zh-CN');
    assert.strictEqual(params.cr, undefined);
    assert.strictEqual(params.sort, undefined);
    assert.strictEqual(params.siteSearch, undefined);
    assert.strictEqual(params.key, undefined);
}

function testScoringAndDedup() {
    const now = Date.parse('2026-10-21T00:00:00Z');
    const topic = '特斯拉降价';
    const relevant = search.scoreResult(topic, {
        title: '特斯拉宣布中国区降价',
        link: 'https://www.thepaper.cn/newsDetail_forward_99',
        snippet: '特斯拉宣布降价',
        publishedAt: now - 86400000
    }, now);
    const unrelated = search.scoreResult(topic, {
        title: '今天天气晴朗适合出游',
        link: 'https://example.com/weather/2026/1001.html',
        snippet: '全国大部地区气温回升',
        publishedAt: now - 86400000
    }, now);
    const plain = search.scoreResult(topic, {
        title: '特斯拉宣布降价',
        link: 'https://example.com/auto/2026/1001.html',
        snippet: '特斯拉宣布降价',
        publishedAt: now - 86400000
    }, now);
    const old = search.scoreResult(topic, {
        title: '特斯拉宣布降价',
        link: 'https://example.com/auto/2020/1001.html',
        snippet: '特斯拉宣布降价',
        publishedAt: now - 60 * 86400000
    }, now);
    const channel = search.scoreResult(topic, {
        title: '特斯拉宣布降价',
        link: 'https://news.sina.com.cn/channel/auto',
        snippet: '特斯拉宣布降价'
    }, now);

    assert.ok(relevant > unrelated, '相关结果应高于无关结果');
    assert.ok(relevant > plain, '可信域名应加分');
    assert.ok(plain > old, '近期日期应高于过旧页面');
    assert.ok(channel < plain, '频道页应扣分');
    assert.ok(unrelated < search.SCORE_KEEP);

    const ranked = search.filterAndRankResults(topic, [
        { title: '特斯拉降价', link: 'https://www.qq.com/', snippet: '特斯拉降价' },
        { title: '特斯拉中国区宣布降价', link: 'https://www.thepaper.cn/newsDetail_forward_99', snippet: '特斯拉宣布降价' },
        { title: '汽车频道', link: 'https://news.sina.com.cn/channel/auto', snippet: '特斯拉降价' },
        { title: '报告', link: 'https://example.com/files/report.pdf', snippet: '特斯拉降价' },
        { title: '今天天气晴朗适合出游', link: 'https://example.com/weather/1.html', snippet: '气温回升' }
    ], now);
    assert.strictEqual(ranked.length, 1);
    assert.ok(ranked[0].link.includes('thepaper.cn'));

    const deduped = search.dedupeResults([
        { title: '特斯拉宣布中国区降价', link: 'https://www.thepaper.cn/newsDetail_forward_1?spm=1', score: 0.5 },
        { title: '特斯拉宣布中国区降价', link: 'https://m.thepaper.cn/newsDetail_forward_1#top', score: 0.9 },
        { title: '教育部发布新学期安排', link: 'https://www.people.com.cn/n1/2026/1012/c1001.html', score: 0.8 }
    ]);
    assert.strictEqual(deduped.length, 2);
    const tesla = deduped.find(item => item.link.includes('thepaper.cn'));
    assert.strictEqual(tesla.score, 0.9);
    assert.strictEqual(
        search.normalizeArticleUrl('https://www.thepaper.cn/newsDetail_forward_1?spm=1'),
        search.normalizeArticleUrl('https://m.thepaper.cn/newsDetail_forward_1#top')
    );
    assert.strictEqual(search.titlesNearIdentical('特斯拉宣布中国区降价', '特斯拉宣布中国区降价'), true);
    assert.strictEqual(search.titlesNearIdentical('特斯拉宣布中国区降价', '教育部发布新学期安排'), false);
}

async function testGoogleCallBudget() {
    search.clearSearchCache();
    const calls = [];
    let baiduCalls = 0;
    const googleSearch = async params => {
        calls.push(params.dateRestrict);
        if (params.dateRestrict === 'd3') {
            return [article('https://www.thepaper.cn/newsDetail_forward_1', '特斯拉宣布中国区降价')];
        }
        return [
            article('https://news.sina.com.cn/c/2026-10-20/doc-a.shtml', '特斯拉中国降价落地'),
            article('https://www.jiemian.com/article/1234567.html', '特斯拉宣布降价'),
            article('https://www.36kr.com/p/123456789', '特斯拉降价影响车市')
        ];
    };
    const ranked = await search.searchNewsV2('特斯拉降价', {
        bypassCache: true,
        googleEnabled: true,
        googleSearch,
        baiduSearch: async () => {
            baiduCalls += 1;
            return [];
        }
    });
    assert.deepStrictEqual(calls, ['d3', 'd7']);
    assert.strictEqual(baiduCalls, 0);
    assert.ok(ranked.length >= search.MIN_KEEP);

    const enoughCalls = [];
    await search.searchNewsV2('苹果发布会', {
        bypassCache: true,
        googleEnabled: true,
        googleSearch: async params => {
            enoughCalls.push(params.dateRestrict);
            return [
                article('https://www.thepaper.cn/newsDetail_forward_2', '苹果召开发布会'),
                article('https://news.qq.com/rain/a/20261020A001', '苹果发布会新品'),
                article('https://www.chinanews.com.cn/cj/2026/10-20/10001.shtml', '苹果发布会开幕')
            ];
        },
        baiduSearch: async () => {
            throw new Error('不应调用百度');
        }
    });
    assert.deepStrictEqual(enoughCalls, ['d3']);

    let quotaCalls = 0;
    let quotaBaidu = 0;
    await search.searchNewsV2('华为新品', {
        bypassCache: true,
        googleEnabled: true,
        googleSearch: async () => {
            quotaCalls += 1;
            const error = new Error('daily limit');
            error.quota = true;
            error.status = 403;
            error.reason = 'dailyLimitExceeded';
            throw error;
        },
        baiduSearch: async () => {
            quotaBaidu += 1;
            return [article('https://www.xinhuanet.com/tech/2026-10/20/c_123.htm', '华为发布新品')];
        }
    });
    assert.strictEqual(quotaCalls, 1);
    assert.strictEqual(quotaBaidu, 1);

    let emptyCalls = 0;
    let emptyBaidu = 0;
    await search.searchNewsV2('冷门话题甲', {
        bypassCache: true,
        googleEnabled: true,
        googleSearch: async () => {
            emptyCalls += 1;
            return [];
        },
        baiduSearch: async () => {
            emptyBaidu += 1;
            return [];
        }
    });
    assert.strictEqual(emptyCalls, search.MAX_GOOGLE_CALLS);
    assert.strictEqual(emptyBaidu, 1);
}

async function testArticleSelection() {
    const body = '特斯拉宣布在中国市场降价，涉及多款车型，经销商同步调整售价。'.repeat(8);
    const calls = [];
    const candidates = [
        article('https://www.thepaper.cn/newsDetail_forward_11', '特斯拉宣布中国区降价'),
        article('https://news.sina.com.cn/c/2026-10-20/doc-b.shtml', '特斯拉中国降价'),
        article('https://news.qq.com/rain/a/20261020B001', '特斯拉降价'),
        article('https://www.jiemian.com/article/222.html', '特斯拉降价'),
        article('https://www.xinhuanet.com/fortune/2026-10/20/c_999.htm', '不应抓到的特斯拉降价'),
        article('https://www.chinanews.com.cn/cj/2026/10-20/99999.shtml', '也不应抓到')
    ];
    const articles = await search.selectArticles(candidates, '特斯拉降价', {
        needed: 2,
        waveSize: 4,
        fetchText: async url => {
            calls.push(url);
            return body;
        }
    });
    assert.strictEqual(articles.length, 2);
    assert.strictEqual(calls.length, 4);
    assert.strictEqual(search.isTextRelevant('特斯拉降价', '今天天气不错，适合出门散步。'.repeat(10)), false);

    const secondWave = [];
    const mixed = await search.selectArticles(candidates, '特斯拉降价', {
        needed: 2,
        waveSize: 4,
        fetchText: async url => {
            secondWave.push(url);
            if (secondWave.length <= 4) return '今天天气晴朗，适合出门散步，全国气温回升。'.repeat(12);
            return body;
        }
    });
    assert.strictEqual(secondWave.length, 6);
    assert.strictEqual(mixed.length, 2);
}

async function main() {
    await testQueryAndParams();
    testScoringAndDedup();
    await testGoogleCallBudget();
    await testArticleSelection();
    console.log('newsSearch tests ok');
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
