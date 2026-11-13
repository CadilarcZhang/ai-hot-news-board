'use strict';

const assert = require('assert');
const {
    trimArticleBody,
    selectArticles,
    MIN_REAL_TEXT
} = require('../lib/deepseekArticleSelect');
const {
    SEARCH_URL,
    SEARCH_COUNT,
    RAW_RESULT_TTL_MS,
    requestDeepseekSearch,
    createDeepseekSearchGate,
    providerMessage,
    summaryCacheKey
} = require('../lib/deepseekSearch');

const NOW = Date.parse('2026-11-13T09:00:00.000Z');
const QUERY = '中美农业合作藏着三个关键词';

function article(title, date, content, extra) {
    return Object.assign({
        title,
        url: `https://news.example.com/${encodeURIComponent(title)}`,
        date,
        content,
        snippet: '这是短摘要，不能当正文',
        summary: '这是长摘要，不能拿来凑满两百字。'.repeat(20)
    }, extra || {});
}

function testTrimKeepsShortNewsAndDropsTrailingChrome() {
    const raw = [
        '首页',
        '分享',
        '外交部回应中美俄元首会晤，发言人说明了会晤安排。',
        '热门推荐',
        '半年前的大豆回顾'
    ].join('\n');
    const body = trimArticleBody(raw);
    assert.ok(body.includes('发言人说明了会晤安排'));
    assert.ok(!body.includes('热门推荐'));
    assert.ok(!body.includes('大豆回顾'));
    assert.ok(!body.startsWith('首页'));
}

function testSelectUsesContentNotSummaryAndDropsStale() {
    const fresh = '中美农业合作藏着三个关键词。双方谈了采购、技术和标准。'.repeat(8);
    const selected = selectArticles([
        article('中美农业合作藏着三个关键词', '2026-11-13T00:00:00Z', `导语\n${fresh}\n热门推荐\n打开APP看更多`),
        article('中美大豆贸易回顾', '2026-05-01T00:00:00Z', `${'中美农业合作藏着三个关键词'.repeat(30)}`),
        article('中美农业部长通话', '2026-11-10T00:00:00Z', `${'中美农业部长昨天通话，谈了大豆到港。'.repeat(10)}`),
        article('无关天气新闻', '2026-11-13T00:00:00Z', '今天有雨。'.repeat(40)),
        article('中美农业合作藏着三个关键词', '2026-11-13T00:00:00Z', '', { summary: '摘要'.repeat(100) })
    ], QUERY, NOW);

    assert.strictEqual(selected.articles.length, 1);
    assert.strictEqual(selected.articles[0].title, '中美农业合作藏着三个关键词');
    assert.ok(selected.articles[0].content.includes('采购、技术和标准'));
    assert.ok(!selected.articles[0].content.includes('热门推荐'));
    assert.ok(!selected.articles[0].content.includes('这是长摘要'));
    assert.ok(selected.textLength >= MIN_REAL_TEXT);
    assert.strictEqual(selected.sufficient, true);
    assert.deepStrictEqual(selected.dropped.map((item) => item.reason), ['stale', 'stale', 'title', 'short']);
}

function testShortBodyIsNotPaddedToThreshold() {
    const selected = selectArticles([
        article('中美农业合作藏着三个关键词', '2026-11-13T00:00:00Z', '中美农业合作今天只公布了一句话。', {
            summary: '长摘要'.repeat(80)
        })
    ], QUERY, NOW);
    assert.strictEqual(selected.articles.length, 0);
    assert.ok(selected.textLength < MIN_REAL_TEXT);
    assert.strictEqual(selected.sufficient, false);
    assert.ok(!selected.merged.includes('长摘要'));
}

function testCapsThreeBodiesAt5000() {
    const body = `中美农业合作藏着三个关键词。${'正文'.repeat(3000)}`;
    const results = [1, 2, 3, 4].map((n) => article(
        `中美农业合作藏着三个关键词${n}`,
        '2026-11-13T00:00:00Z',
        body
    ));
    const selected = selectArticles(results, QUERY, NOW);
    assert.strictEqual(selected.articles.length, 3);
    selected.articles.forEach((item) => {
        assert.ok(item.content.length <= 5000);
    });
}

function okResults(content) {
    return {
        status: 200,
        data: {
            results: [article('中美农业合作藏着三个关键词', '2026-11-13T00:00:00Z', content)]
        }
    };
}

function testRequestShapeAndNoRetry() {
    const calls = [];
    return requestDeepseekSearch({
        query: QUERY,
        apiKey: 'test-key',
        httpPost(config) {
            calls.push(config);
            return Promise.resolve({ status: 500, data: {} });
        },
        nowMs: NOW
    }).then((result) => {
        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].url, SEARCH_URL);
        assert.strictEqual(calls[0].method, 'post');
        assert.deepStrictEqual(calls[0].data, {
            query: QUERY,
            count: SEARCH_COUNT,
            need_content: true
        });
        assert.strictEqual(calls[0].headers.Authorization, 'Bearer test-key');
        assert.strictEqual(result.ok, false);
        assert.strictEqual(result.kind, 'provider');
        assert.strictEqual(result.calls, 1);
        assert.ok(providerMessage('balance').includes('余额'));
        assert.ok(!providerMessage('timeout').includes('未能找到足够的新闻内容'));
    });
}

function testStatuses() {
    const statuses = [
        [401, 'auth'],
        [402, 'balance'],
        [429, 'rate'],
        [504, 'timeout']
    ];
    return Promise.all(statuses.map(([status, kind]) => {
        return requestDeepseekSearch({
            query: QUERY,
            apiKey: 'test-key',
            httpPost() {
                return Promise.resolve({ status, data: {} });
            },
            nowMs: NOW
        }).then((result) => {
            assert.strictEqual(result.kind, kind);
            assert.strictEqual(result.calls, 1);
        });
    }));
}

function testEmptyIsNotCachedAndCacheHitSkipsCall() {
    let calls = 0;
    const gate = createDeepseekSearchGate({
        getApiKey: () => 'test-key',
        now: () => NOW,
        httpPost() {
            calls += 1;
            if (calls === 1) return Promise.resolve({ status: 200, data: { results: [] } });
            return Promise.resolve(okResults('中美农业合作藏着三个关键词。'.repeat(20)));
        }
    });
    return gate.load(QUERY).then((empty) => {
        assert.strictEqual(empty.ok, true);
        assert.strictEqual(empty.sufficient, false);
        assert.strictEqual(empty.calls, 1);
        return gate.load(QUERY);
    }).then((second) => {
        assert.strictEqual(second.calls, 1);
        assert.strictEqual(second.sufficient, true);
        assert.strictEqual(calls, 2);
        return gate.load(QUERY);
    }).then((third) => {
        assert.strictEqual(third.fromCache, true);
        assert.strictEqual(third.calls, 0);
        assert.strictEqual(calls, 2);
        assert.ok(summaryCacheKey(QUERY).startsWith('deepseek-summary:v1:'));
        assert.ok(!summaryCacheKey(QUERY).startsWith('content-'));
    });
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

function testConcurrentDedupAndIndependentCancel() {
    const pending = deferred();
    let calls = 0;
    let seenSignal = null;
    const gate = createDeepseekSearchGate({
        getApiKey: () => 'test-key',
        now: () => NOW,
        httpPost(config) {
            calls += 1;
            seenSignal = config.signal;
            config.signal.addEventListener('abort', () => {
                pending.reject(Object.assign(new Error('aborted'), { code: 'ERR_CANCELED' }));
            });
            return pending.promise;
        }
    });
    const first = new AbortController();
    const second = new AbortController();
    const a = gate.load(QUERY, first.signal);
    const b = gate.load(QUERY, second.signal);
    assert.strictEqual(calls, 1);
    first.abort();
    assert.strictEqual(seenSignal.aborted, false);
    pending.resolve(okResults('中美农业合作藏着三个关键词。'.repeat(20)));
    return Promise.all([a, b]).then((results) => {
        assert.strictEqual(results[0].aborted, true);
        assert.strictEqual(results[1].sufficient, true);
        assert.strictEqual(calls, 1);
        assert.strictEqual(gate.inflightSize(), 0);
    });
}

function testNavigationOverlapDoesNotCount() {
    const headline = '官方通报外国人高铁上探头吸烟';
    const selected = selectArticles([
        article(headline, '2026-11-13T00:00:00Z', [
            '这是一篇只讨论股市指数涨跌的评论，没有提到列车或吸烟。'.repeat(6),
            '热门推荐',
            headline
        ].join('\n'))
    ], headline, NOW);
    assert.strictEqual(selected.articles.length, 0);
    assert.strictEqual(selected.dropped[0].reason, 'body');
    assert.ok(!selected.merged.includes(headline));
}

function testBeijingDayBoundaryKeepsFreshAndDropsStale() {
    const headline = '中美农业合作藏着三个关键词';
    const body = `${headline}。双方谈了采购、技术和标准。`.repeat(8);
    const beijingEarlyMorning = Date.parse('2026-11-13T17:30:00.000Z');
    const threeDays = selectArticles([
        article(headline, '2026-11-11T00:00:00Z', body)
    ], QUERY, beijingEarlyMorning);
    assert.strictEqual(threeDays.dropped[0].reason, 'stale');

    const today = selectArticles([
        article(headline, '2026-11-14', body)
    ], QUERY, beijingEarlyMorning);
    assert.strictEqual(today.articles.length, 1);
    assert.strictEqual(today.sufficient, true);

    const unknownDate = selectArticles([
        article(headline, null, body)
    ], QUERY, beijingEarlyMorning);
    assert.strictEqual(unknownDate.articles.length, 1);
}

function testFilteredNonemptyDoesNotRepayUntilExpiry() {
    let calls = 0;
    let nowMs = NOW;
    const httpPost = () => {
        calls += 1;
        return Promise.resolve({
            status: 200,
            data: {
                results: [
                    article('无关天气新闻', '2026-11-13T00:00:00Z', '今天有雨。'.repeat(40)),
                    article('中美大豆贸易回顾', '2026-05-01T00:00:00Z', '中美农业合作藏着三个关键词'.repeat(30))
                ]
            }
        });
    };
    const gate = createDeepseekSearchGate({
        getApiKey: () => 'test-key',
        now: () => nowMs,
        httpPost
    });
    return gate.load(QUERY).then((first) => {
        assert.strictEqual(first.sufficient, false);
        assert.strictEqual(first.articles.length, 0);
        assert.ok(!first.results);
        assert.strictEqual(calls, 1);
        return gate.load(QUERY);
    }).then((second) => {
        assert.strictEqual(second.fromCache, true);
        assert.strictEqual(second.calls, 0);
        assert.strictEqual(second.sufficient, false);
        assert.strictEqual(calls, 1);
        nowMs += RAW_RESULT_TTL_MS + 1;
        return gate.load(QUERY);
    }).then((third) => {
        assert.strictEqual(third.fromCache, undefined);
        assert.strictEqual(calls, 2);
        const otherInstance = createDeepseekSearchGate({
            getApiKey: () => 'test-key',
            now: () => nowMs,
            httpPost
        });
        return otherInstance.load(QUERY);
    }).then((freshInstance) => {
        assert.strictEqual(freshInstance.calls, 1);
        assert.strictEqual(calls, 3);
    });
}

function testProviderErrorIsNotCached() {
    let calls = 0;
    const gate = createDeepseekSearchGate({
        getApiKey: () => 'test-key',
        now: () => NOW,
        httpPost() {
            calls += 1;
            return Promise.resolve({ status: 500, data: {} });
        }
    });
    return gate.load(QUERY).then((first) => {
        assert.strictEqual(first.ok, false);
        assert.strictEqual(first.kind, 'provider');
        return gate.load(QUERY);
    }).then((second) => {
        assert.strictEqual(second.ok, false);
        assert.strictEqual(calls, 2);
        assert.strictEqual(gate.cacheSize(), 0);
    });
}

function testLastWaiterAbortDoesNotCache() {
    const pending = deferred();
    let calls = 0;
    const gate = createDeepseekSearchGate({
        getApiKey: () => 'test-key',
        now: () => NOW,
        httpPost(config) {
            calls += 1;
            config.signal.addEventListener('abort', () => {
                pending.reject(Object.assign(new Error('aborted'), { code: 'ERR_CANCELED' }));
            });
            return pending.promise;
        }
    });
    const controller = new AbortController();
    const pendingLoad = gate.load(QUERY, controller.signal);
    controller.abort();
    return pendingLoad.then((result) => {
        assert.strictEqual(result.aborted, true);
        return gate.load(QUERY);
    }).then((again) => {
        assert.strictEqual(again.aborted, true);
        assert.strictEqual(calls, 2);
        assert.strictEqual(gate.cacheSize(), 0);
    });
}

Promise.resolve()
    .then(() => testTrimKeepsShortNewsAndDropsTrailingChrome())
    .then(() => testSelectUsesContentNotSummaryAndDropsStale())
    .then(() => testShortBodyIsNotPaddedToThreshold())
    .then(() => testCapsThreeBodiesAt5000())
    .then(() => testRequestShapeAndNoRetry())
    .then(() => testStatuses())
    .then(() => testEmptyIsNotCachedAndCacheHitSkipsCall())
    .then(() => testNavigationOverlapDoesNotCount())
    .then(() => testBeijingDayBoundaryKeepsFreshAndDropsStale())
    .then(() => testFilteredNonemptyDoesNotRepayUntilExpiry())
    .then(() => testProviderErrorIsNotCached())
    .then(() => testConcurrentDedupAndIndependentCancel())
    .then(() => testLastWaiterAbortDoesNotCache())
    .then(() => {
        console.log('deepseekSearch tests ok');
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
