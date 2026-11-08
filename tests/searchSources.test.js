'use strict';

const assert = require('assert');
const {
    toSourceList,
    sameSources,
    isConnectionReset,
    shouldRetryReset,
    collectSettled,
    createFetchBudget,
    chooseSearchWinner,
    SEARCH_SOURCE_LIMIT,
    FETCH_CANDIDATE_LIMIT,
    MAX_ARTICLES
} = require('../lib/searchSources');

function testToSourceListCapsAndSkipsBadLinks() {
    const results = [
        { title: 'a', link: '/relative' },
        { title: 'b', link: 'https://example.com/b' },
        { title: '', link: 'https://example.com/empty' },
        { title: 'c', link: 'https://example.com/c' },
        { title: 'd', link: 'https://example.com/d' },
        { title: 'e', link: 'https://example.com/e' }
    ];
    const sources = toSourceList(results);
    assert.strictEqual(sources.length, SEARCH_SOURCE_LIMIT);
    assert.deepStrictEqual(sources.map((item) => item.title), ['b', 'c', 'd']);
    assert.deepStrictEqual(toSourceList(null), []);
}

function testSameSources() {
    const left = [{ title: 'b', link: 'https://example.com/b' }];
    assert.strictEqual(sameSources(left, [{ title: 'b', link: 'https://example.com/b' }]), true);
    assert.strictEqual(sameSources(left, []), false);
    assert.strictEqual(sameSources(left, [{ title: 'b', link: 'https://example.com/other' }]), false);
}

function testCandidateLimitCoversFourthHit() {
    assert.strictEqual(FETCH_CANDIDATE_LIMIT, 5);
    assert.strictEqual(MAX_ARTICLES, 3);
    assert.ok(FETCH_CANDIDATE_LIMIT > SEARCH_SOURCE_LIMIT);
}

function testBudgetAbortsWhenFull() {
    const budget = createFetchBudget(5000, 2);
    budget.note({ title: 'a' });
    assert.strictEqual(budget.signal.aborted, false);
    budget.note({ title: 'b' });
    assert.strictEqual(budget.signal.aborted, true);
    budget.clear();
}

function testParentAbortDoesNotRetry() {
    const parent = new AbortController();
    let calls = 0;
    const pending = collectSettled(['a', 'b'], (item, index, signal) => {
        calls += 1;
        return new Promise((resolve) => {
            if (signal.aborted) {
                resolve(null);
                return;
            }
            signal.addEventListener('abort', () => resolve(null), { once: true });
        });
    }, { signal: parent.signal, graceMs: 60000 });
    parent.abort();
    return pending.then((articles) => {
        assert.deepStrictEqual(articles, []);
        assert.strictEqual(calls, 2);
    }).then(() => collectSettled(['c'], async () => ({ title: 'c', link: 'https://example.com/c' }), { graceMs: 50 }))
        .then((articles) => {
            assert.strictEqual(articles.length, 1);
            assert.strictEqual(calls, 2);
        });
}

function testRetryResetSkipsAbortedSignal() {
    const aborted = new AbortController();
    aborted.abort();
    assert.strictEqual(shouldRetryReset({ code: 'ECONNRESET' }, aborted.signal), false);
    assert.strictEqual(shouldRetryReset({ code: 'ECONNRESET' }, undefined), true);
    assert.strictEqual(shouldRetryReset({ code: 'ECONNABORTED', message: 'timeout' }, undefined), false);
}

function testConnectionReset() {
    assert.strictEqual(isConnectionReset({ code: 'ECONNRESET' }), true);
    assert.strictEqual(isConnectionReset({ message: 'socket hang up' }), true);
    assert.strictEqual(isConnectionReset({ code: 'ECONNABORTED', message: 'timeout of 8000ms exceeded' }), false);
    assert.strictEqual(isConnectionReset(null), false);
}

function testChooseSearchWinner() {
    const baiduHits = [{ title: 'b', link: 'https://example.com/b' }];
    const googleHits = [{ title: 'g', link: 'https://example.com/g' }];

    const googleFirst = chooseSearchWinner({
        googleDone: true,
        googleResults: googleHits,
        baiduDone: false,
        baiduResults: []
    });
    assert.strictEqual(googleFirst.decided, true);
    assert.strictEqual(googleFirst.via, 'google');
    assert.strictEqual(googleFirst.abort, 'baidu');

    const baiduFirst = chooseSearchWinner({
        googleDone: false,
        googleResults: [],
        baiduDone: true,
        baiduResults: baiduHits
    });
    assert.strictEqual(baiduFirst.via, 'baidu');
    assert.strictEqual(baiduFirst.abort, 'google');
    assert.strictEqual(baiduFirst.results.length, 1);

    const waitForBaidu = chooseSearchWinner({
        googleDone: true,
        googleResults: [],
        baiduDone: false,
        baiduResults: []
    });
    assert.strictEqual(waitForBaidu.decided, false);

    const googleEmpty = chooseSearchWinner({
        googleDone: true,
        googleResults: [],
        baiduDone: true,
        baiduResults: baiduHits
    });
    assert.strictEqual(googleEmpty.via, 'baidu');
    assert.strictEqual(googleEmpty.abort, null);

    const bothEmpty = chooseSearchWinner({
        googleDone: true,
        googleResults: [],
        baiduDone: true,
        baiduResults: []
    });
    assert.strictEqual(bothEmpty.decided, true);
    assert.deepStrictEqual(bothEmpty.results, []);
}

function run() {
    testToSourceListCapsAndSkipsBadLinks();
    testSameSources();
    testCandidateLimitCoversFourthHit();
    testBudgetAbortsWhenFull();
    testRetryResetSkipsAbortedSignal();
    testConnectionReset();
    testChooseSearchWinner();
    return testParentAbortDoesNotRetry().then(() => {
        console.log('searchSources tests ok');
    });
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
