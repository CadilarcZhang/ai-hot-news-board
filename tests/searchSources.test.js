'use strict';

const assert = require('assert');
const {
    toSourceList,
    sameSources,
    isConnectionReset,
    SEARCH_SOURCE_LIMIT
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

function testConnectionReset() {
    assert.strictEqual(isConnectionReset({ code: 'ECONNRESET' }), true);
    assert.strictEqual(isConnectionReset({ message: 'socket hang up' }), true);
    assert.strictEqual(isConnectionReset({ code: 'ECONNABORTED', message: 'timeout of 8000ms exceeded' }), false);
    assert.strictEqual(isConnectionReset(null), false);
}

function run() {
    testToSourceListCapsAndSkipsBadLinks();
    testSameSources();
    testConnectionReset();
    console.log('searchSources tests ok');
}

run();
