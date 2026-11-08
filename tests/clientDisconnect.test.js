'use strict';

const assert = require('assert');
const http = require('http');
const express = require('express');
const { bindClientAbort, linkAbortSignal } = require('../lib/clientDisconnect');
const { createLatestGate } = require('../public/js/latestResponse');
const { canStoreCompletedContent, decideSearchSummary } = require('../lib/generationFlow');

function listen(app) {
    return new Promise((resolve) => {
        const server = app.listen(0, () => resolve(server));
    });
}

function testFinishedResponseDoesNotAbort() {
    const app = express();
    let signal;
    app.get('/ok', (req, res) => {
        const upstream = bindClientAbort(res);
        signal = upstream.signal;
        req.on('close', () => {
            // 请求体消费完或连接结束都会 close。这里不能据此取消。
        });
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.write('start');
        setTimeout(() => res.end('done'), 30);
    });
    return listen(app).then((server) => {
        const port = server.address().port;
        return new Promise((resolve, reject) => {
            http.get('http://127.0.0.1:' + port + '/ok', (res) => {
                res.resume();
                res.on('end', () => setTimeout(resolve, 40));
            }).on('error', reject);
        }).then(() => {
            assert.strictEqual(signal.aborted, false);
            server.close();
        });
    });
}

function testClientDestroyAbortsOnlyThatResponse() {
    const app = express();
    const signals = {};
    app.get('/slow/:name', (req, res) => {
        const upstream = bindClientAbort(res);
        signals[req.params.name] = upstream.signal;
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write('data: a\n\n');
    });
    return listen(app).then((server) => {
        const port = server.address().port;
        const drop = http.get('http://127.0.0.1:' + port + '/slow/left', () => {});
        const keep = http.get('http://127.0.0.1:' + port + '/slow/right', (res) => {
            res.on('data', () => {});
        });
        return new Promise((resolve) => {
            setTimeout(() => {
                drop.destroy();
                setTimeout(resolve, 50);
            }, 20);
        }).then(() => {
            assert.strictEqual(signals.left.aborted, true);
            assert.strictEqual(signals.right.aborted, false);
            keep.destroy();
            server.close();
        });
    });
}

function testLinkDoesNotAbortADifferentController() {
    const parent = new AbortController();
    const mine = new AbortController();
    const other = new AbortController();
    linkAbortSignal(parent.signal, mine);
    parent.abort();
    assert.strictEqual(mine.signal.aborted, true);
    assert.strictEqual(other.signal.aborted, false);
}

function testLatestGateDropsStaleList() {
    const gate = createLatestGate();
    const first = gate.issue();
    const second = gate.issue();
    assert.strictEqual(first.isCurrent(), false);
    assert.strictEqual(second.isCurrent(), true);
    gate.invalidate();
    assert.strictEqual(second.isCurrent(), false);
    const applied = [];
    [first, second].forEach((ticket, index) => {
        if (ticket.isCurrent()) applied.push(index);
    });
    assert.deepStrictEqual(applied, []);
}

function testDisconnectDoesNotCacheOrFallback() {
    const aborted = new AbortController();
    aborted.abort();
    assert.strictEqual(canStoreCompletedContent(aborted.signal, '已经写了一半'), false);
    assert.strictEqual(canStoreCompletedContent(undefined, '  完整  '), true);
    assert.strictEqual(canStoreCompletedContent(undefined, '   '), false);
    assert.strictEqual(decideSearchSummary(aborted.signal, ''), 'stop');
    assert.strictEqual(decideSearchSummary(aborted.signal, 'x'.repeat(400)), 'stop');
    assert.strictEqual(decideSearchSummary(undefined, ''), 'fallback');
    assert.strictEqual(decideSearchSummary(undefined, 'x'.repeat(199)), 'fallback');
    assert.strictEqual(decideSearchSummary(undefined, 'x'.repeat(200)), 'summarize');
}

function run() {
    testLinkDoesNotAbortADifferentController();
    testLatestGateDropsStaleList();
    testDisconnectDoesNotCacheOrFallback();
    return testFinishedResponseDoesNotAbort()
        .then(() => testClientDestroyAbortsOnlyThatResponse())
        .then(() => {
            console.log('clientDisconnect tests ok');
        });
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
