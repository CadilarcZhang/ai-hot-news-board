const assert = require('assert');
const tianApi = require('../lib/tianApi');

function timeoutError() {
    const error = new Error('timeout');
    error.code = 'ECONNABORTED';
    return error;
}

async function testRetriesThenSucceeds() {
    const calls = [];
    const sleeps = [];
    const data = await tianApi.fetchHotList('douyinhot', 'test-key', {
        httpGet: async (url) => {
            calls.push(url);
            if (calls.length < 3) throw timeoutError();
            return { status: 200, data: { code: 200, result: { list: [{ word: 'ok' }] } } };
        },
        sleep: async (ms) => { sleeps.push(ms); }
    });
    assert.strictEqual(calls.length, 3);
    assert.deepStrictEqual(sleeps, [400, 1000]);
    assert.strictEqual(data.result.list[0].word, 'ok');
    assert.ok(calls.every((url) => url.includes('douyinhot') && url.includes('key=test-key')));
}

async function testDoesNotRetryClientError() {
    let calls = 0;
    await assert.rejects(() => tianApi.fetchHotList('douyinhot', 'test-key', {
        httpGet: async () => {
            calls += 1;
            const error = new Error('bad key');
            error.response = { status: 403 };
            throw error;
        },
        sleep: async () => { throw new Error('should not sleep'); }
    }));
    assert.strictEqual(calls, 1);
}

async function testBadPayloadDoesNotRetryAndHidesUrl() {
    let calls = 0;
    try {
        await tianApi.fetchHotList('douyinhot', 'secret-key', {
            httpGet: async () => {
                calls += 1;
                return { status: 200, data: { code: 150, msg: 'key invalid secret-key' } };
            },
            sleep: async () => { throw new Error('should not sleep'); }
        });
        assert.fail('expected rejection');
    } catch (error) {
        assert.strictEqual(calls, 1);
        assert.strictEqual(error.code, 'BAD_PAYLOAD');
        assert.strictEqual(String(error.stack || '').includes('secret-key'), false);
        assert.strictEqual(String(error.message).includes('secret-key'), false);
        const summary = tianApi.summarizeUpstreamError(error);
        assert.deepStrictEqual(summary, { code: 'BAD_PAYLOAD', status: 200 });
        assert.strictEqual(JSON.stringify(summary).includes('secret-key'), false);
    }
}

async function testExhaustedRetries() {
    let calls = 0;
    try {
        await tianApi.fetchHotList('networkhot', 'test-key', {
            httpGet: async () => {
                calls += 1;
                throw timeoutError();
            },
            sleep: async () => {}
        });
        assert.fail('expected rejection');
    } catch (error) {
        assert.strictEqual(calls, 3);
        assert.strictEqual(error.code, 'ECONNABORTED');
        assert.strictEqual(error.message.includes('http'), false);
    }
}

async function run() {
    await testRetriesThenSucceeds();
    await testDoesNotRetryClientError();
    await testBadPayloadDoesNotRetryAndHidesUrl();
    await testExhaustedRetries();
    console.log('tianApi tests ok');
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
