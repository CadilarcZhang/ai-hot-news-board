'use strict';

const assert = require('assert');
const { Readable } = require('stream');
const {
    extractBaiduNewsResults,
    collectHtmlUntilResults,
    countResultMarkers,
    stripScriptsAndStyles
} = require('../lib/baiduSerp');

function resultBlock(title, href, extraClass) {
    return `<div class="${extraClass}"><h3 class="t"><a href="${href}">${title}</a></h3><div class="c-abstract">${title}摘要</div></div>`;
}

function testExtractsSameSelectors() {
    const html = [
        resultBlock('甲', 'https://example.com/a', 'result'),
        resultBlock('乙', '/link?url=https%3A%2F%2Fexample.com%2Fb', 'result-op'),
        '<div class="c-result"><a href="https://example.com/no-title">无标题</a></div>',
        resultBlock('丙', 'https://example.com/c', 'c-result'),
        resultBlock('丁', '/relative', 'result'),
        resultBlock('戊', 'https://example.com/e', 'result'),
        resultBlock('己', 'https://example.com/f', 'result')
    ].join('');

    const results = extractBaiduNewsResults(html, 5);
    assert.deepStrictEqual(results.map((item) => item.title), ['甲', '乙', '丙', '戊', '己']);
    assert.strictEqual(results[1].link, 'https://example.com/b');
    assert.strictEqual(results[0].snippet, '甲摘要');
    assert.ok(countResultMarkers(html) >= 5);
}

function testStopsReadingAfterEnoughResults() {
    const head = [
        resultBlock('甲', 'https://example.com/a', 'result'),
        resultBlock('乙', 'https://example.com/b', 'result'),
        resultBlock('丙', 'https://example.com/c', 'result-op'),
        resultBlock('丁', 'https://example.com/d', 'result'),
        resultBlock('戊', 'https://example.com/e', 'c-result')
    ].join('');
    const tail = 'TAIL'.repeat(5000);
    const html = head + tail;
    const mid = Math.floor(head.length / 2);
    const stream = Readable.from([
        Buffer.from(html.slice(0, mid)),
        Buffer.from(html.slice(mid, head.length)),
        Buffer.from(tail)
    ]);

    return collectHtmlUntilResults(stream, extractBaiduNewsResults, {
        limit: 5,
        checkBytes: 64,
        maxBytes: html.length
    }).then((collected) => {
        assert.strictEqual(collected.results.length, 5);
        assert.strictEqual(collected.early, true);
        assert.ok(collected.bytes < html.length);
        assert.ok(!collected.html.includes('TAILTAIL'));
    });
}

function testScriptTextDoesNotHideLaterResults() {
    const fake = '<script>' + 'class="result" '.repeat(400) + '</script>';
    const head = fake + [
        resultBlock('甲', 'https://example.com/a', 'result'),
        resultBlock('乙', 'https://example.com/b', 'result'),
        resultBlock('丙', 'https://example.com/c', 'result-op'),
        resultBlock('丁', 'https://example.com/d', 'result'),
        resultBlock('戊', 'https://example.com/e', 'c-result')
    ].join('');
    const tail = 'TAIL'.repeat(4000);
    const html = head + tail;
    assert.ok(countResultMarkers(fake) > 0);
    assert.strictEqual(countResultMarkers(stripScriptsAndStyles(fake)), 0);
    const seen = [];
    const stream = Readable.from([
        Buffer.from(fake),
        Buffer.from(head.slice(fake.length)),
        Buffer.from(tail)
    ]);
    return collectHtmlUntilResults(stream, extractBaiduNewsResults, {
        limit: 5,
        checkBytes: 128,
        maxBytes: html.length,
        onResults: (results) => seen.push(results.map((item) => item.title).join(','))
    }).then((collected) => {
        assert.deepStrictEqual(collected.results.map((item) => item.title), ['甲', '乙', '丙', '丁', '戊']);
        assert.ok(seen.length >= 1);
        assert.ok(seen[0].includes('甲'));
        assert.strictEqual(collected.early, true);
        assert.ok(!collected.html.includes('TAILTAIL'));
        assert.ok(collected.firstHitBytes > 0);
        assert.ok(collected.firstHitBytes < html.length);
    });
}

function run() {
    testExtractsSameSelectors();
    return testStopsReadingAfterEnoughResults()
        .then(() => testScriptTextDoesNotHideLaterResults())
        .then(() => {
            console.log('baiduSerp tests ok');
        });
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
