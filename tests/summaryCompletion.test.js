'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    SUMMARY_MODEL,
    buildSearchSummaryCompletion
} = require('../lib/summaryCompletion');

function testOutgoingRequestDisablesThinking() {
    const messages = [
        { role: 'system', content: '系统提示保持原样' },
        { role: 'user', content: '请基于以下真实新闻文章内容生成摘要' }
    ];
    const body = buildSearchSummaryCompletion(messages);

    assert.strictEqual(body.model, SUMMARY_MODEL);
    assert.strictEqual(body.model, 'deepseek-flash');
    assert.strictEqual(body.stream, true);
    assert.strictEqual(body.temperature, 0.7);
    assert.strictEqual(body.top_p, 0.95);
    assert.deepStrictEqual(body.thinking, { type: 'disabled' });
    assert.strictEqual(body.thinking.type, 'disabled');
    assert.notStrictEqual(body.thinking.type, 'enabled');
    assert.deepStrictEqual(body.response_format, { type: 'text' });
    assert.strictEqual(body.messages, messages);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(body, 'reasoning_effort'), false);
    assert.strictEqual(JSON.stringify(body).includes('reasoning_effort'), false);
    assert.strictEqual(JSON.stringify(body).includes('"high"'), false);
}

function testLiveRouteUsesDisabledBuilder() {
    const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
    assert.ok(source.includes('buildSearchSummaryCompletion'));
    assert.strictEqual(source.includes('reasoning_effort'), false);
    assert.strictEqual(source.includes('"type": "enabled"'), false);
    assert.strictEqual(source.includes("type: 'enabled'"), false);
    const disabledCount = source.split('"type": "disabled"').length - 1;
    assert.ok(disabledCount >= 2, '普通生成和缓存预热仍应显式关闭思考');
}

function run() {
    testOutgoingRequestDisablesThinking();
    testLiveRouteUsesDisabledBuilder();
    console.log('summaryCompletion tests passed');
}

run();
