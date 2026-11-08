'use strict';

const assert = require('assert');
const http = require('http');
const { Readable } = require('stream');
const axios = require('axios');

const calls = [];

function canceled() {
    const error = new Error('canceled');
    error.code = 'ERR_CANCELED';
    error.name = 'CanceledError';
    return error;
}

function baiduHtml() {
    return '<div class="result"><h3 class="t"><a href="https://news.example.com/a">光刻机</a></h3><div class="c-abstract">摘要</div></div>';
}

function articleHtml() {
    return '<article>' + ('这是一段足够长的新闻正文。'.repeat(40)) + '</article>';
}

function fulfill(config, data) {
    return {
        data: data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: config
    };
}

axios.defaults.adapter = function (config) {
    const url = config.url || '';
    calls.push(url);
    if (url.includes('api.deepseek.com')) {
        return new Promise((resolve, reject) => {
            let settled = false;
            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                resolve(fulfill(config, Readable.from([
                    'data: {"choices":[{"delta":{"content":"完整解读"}}]}\n\n',
                    'data: [DONE]\n\n'
                ])));
            }, 120);
            if (config.signal) {
                config.signal.addEventListener('abort', () => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    reject(canceled());
                }, { once: true });
            }
        });
    }
    if (url.includes('www.baidu.com/s')) {
        return new Promise((resolve, reject) => {
            const finish = () => {
                resolve(fulfill(config, Readable.from([baiduHtml()])));
            };
            if (config.signal && config.signal.aborted) {
                reject(canceled());
                return;
            }
            const timer = setTimeout(finish, 40);
            if (config.signal) {
                config.signal.addEventListener('abort', () => {
                    clearTimeout(timer);
                    reject(canceled());
                }, { once: true });
            }
        });
    }
    if (url.includes('news.example.com')) {
        return Promise.resolve(fulfill(config, articleHtml()));
    }
    if (url.includes('apis.tianapi.com')) {
        return new Promise((resolve, reject) => {
            const payload = fulfill(config, { code: 200, result: { list: [{ title: '热搜', hotnum: '1' }] } });
            if (config.signal && config.signal.aborted) {
                reject(canceled());
                return;
            }
            const timer = setTimeout(() => resolve(payload), 40);
            if (config.signal) {
                config.signal.addEventListener('abort', () => {
                    clearTimeout(timer);
                    reject(canceled());
                }, { once: true });
            }
        });
    }
    if (url.includes('api.siliconflow.cn')) {
        return new Promise((resolve, reject) => {
            const payload = fulfill(config, { data: [{ url: 'https://img.example/pic.png' }] });
            const timer = setTimeout(() => resolve(payload), 40);
            if (config.signal) {
                config.signal.addEventListener('abort', () => {
                    clearTimeout(timer);
                    reject(canceled());
                }, { once: true });
            }
        });
    }
    return Promise.reject(new Error('unexpected url ' + url));
};

process.env.BASE_PATH = '';
process.env.GOOGLE_SEARCH_SWITCH = '';
const app = require('../server');

function listen() {
    return new Promise((resolve) => {
        const server = app.listen(0, () => resolve(server));
    });
}

function readResponse(res) {
    return new Promise((resolve) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('close', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
}

function get(port, path, abortAfterMs) {
    return new Promise((resolve) => {
        const req = http.get('http://127.0.0.1:' + port + path, (res) => {
            readResponse(res).then((body) => {
                resolve({ status: res.statusCode, headers: res.headers, body: body });
            });
        });
        req.on('error', () => resolve({ aborted: true }));
        if (abortAfterMs != null) {
            setTimeout(() => req.destroy(), abortAfterMs);
        }
    });
}

function post(port, path, payload, abortAfterMs) {
    const body = JSON.stringify(payload);
    return new Promise((resolve) => {
        const req = http.request({
            host: '127.0.0.1',
            port: port,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, (res) => {
            readResponse(res).then((text) => {
                resolve({ status: res.statusCode, body: text });
            });
        });
        req.on('error', () => resolve({ aborted: true }));
        if (abortAfterMs != null) setTimeout(() => req.destroy(), abortAfterMs);
        req.end(body);
    });
}

function count(part) {
    return calls.filter((url) => url.includes(part)).length;
}

function testHealthyGenerate(port) {
    const before = count('api.deepseek.com');
    return get(port, '/api/generate?title=' + encodeURIComponent('普通生成完成')).then((res) => {
        assert.strictEqual(res.status, 200);
        assert.ok(String(res.headers['cache-control']).includes('no-cache'));
        assert.ok(!String(res.headers['cache-control']).includes('s-maxage'));
        assert.ok(res.body.includes('"content":"完整解读"'));
        assert.ok(res.body.includes('"done":true'));
        assert.strictEqual(count('api.deepseek.com'), before + 1);
    });
}

function testAbortedGenerateDoesNotCacheOrRetry(port) {
    const before = count('api.deepseek.com');
    return get(port, '/api/generate?title=' + encodeURIComponent('普通生成中断'), 30).then(() => {
        return new Promise((resolve) => setTimeout(resolve, 80));
    }).then(() => {
        assert.strictEqual(count('api.deepseek.com'), before + 1);
        const afterAbort = count('api.deepseek.com');
        return get(port, '/api/generate?title=' + encodeURIComponent('普通生成中断')).then((res) => {
            assert.ok(res.body.includes('"done":true'));
            assert.strictEqual(count('api.deepseek.com'), afterAbort + 1);
        });
    });
}

function testAbortedSearchDoesNotFallback(port) {
    const beforeDeepseek = count('api.deepseek.com');
    const beforeBaidu = count('www.baidu.com/s');
    return get(port, '/api/generate-with-search?title=' + encodeURIComponent('搜索中断'), 20).then(() => {
        return new Promise((resolve) => setTimeout(resolve, 120));
    }).then(() => {
        assert.ok(count('www.baidu.com/s') >= beforeBaidu + 1);
        assert.strictEqual(count('api.deepseek.com'), beforeDeepseek);
        assert.strictEqual(count('news.example.com'), 0);
    });
}

function testHealthySearch(port) {
    const before = count('api.deepseek.com');
    return get(port, '/api/generate-with-search?title=' + encodeURIComponent('搜索完成')).then((res) => {
        assert.strictEqual(res.status, 200);
        assert.ok(res.body.includes('"type":"sources"'));
        assert.ok(res.body.includes('news.example.com/a'));
        assert.ok(!res.body.includes('未能找到足够的新闻内容'));
        assert.ok(res.body.includes('"done":true'));
        assert.strictEqual(count('api.deepseek.com'), before + 1);
        assert.ok(String(res.headers['cache-control']).includes('no-cache'));
    });
}

function testHotNewsAbortDoesNotCancelSibling(port) {
    const before = count('apis.tianapi.com');
    const left = get(port, '/api/hot-news?platform=weibo', 10);
    const right = get(port, '/api/hot-news?platform=douyin');
    return Promise.all([left, right]).then((results) => {
        const kept = results[1];
        assert.strictEqual(kept.status, 200);
        const body = JSON.parse(kept.body);
        assert.strictEqual(body.result.list[0].title, '热搜');
        assert.strictEqual(kept.headers['x-hot-news-cache'], 'MISS');
        assert.ok(String(kept.headers['cache-control']).includes('no-store'));
        return new Promise((resolve) => setTimeout(resolve, 80)).then(() => {
            assert.strictEqual(count('apis.tianapi.com'), before + 2);
        });
    });
}

function testImageAbortAndCompletion(port) {
    const before = count('api.siliconflow.cn');
    return post(port, '/api/generate-image', { prompt: '新闻图片', title: '配图中断' }, 10).then(() => {
        return new Promise((resolve) => setTimeout(resolve, 80));
    }).then(() => {
        assert.strictEqual(count('api.siliconflow.cn'), before + 1);
        return post(port, '/api/generate-image', { prompt: '新闻图片', title: '配图完成' });
    }).then((res) => {
        assert.strictEqual(res.status, 200);
        assert.strictEqual(JSON.parse(res.body).image, 'https://img.example/pic.png');
        assert.strictEqual(count('api.siliconflow.cn'), before + 2);
        return post(port, '/api/generate-image', { prompt: '新闻图片', title: '配图完成' });
    }).then((cached) => {
        assert.strictEqual(JSON.parse(cached.body).image, 'https://img.example/pic.png');
        assert.strictEqual(count('api.siliconflow.cn'), before + 2);
    });
}

function run() {
    return listen().then((server) => {
        const port = server.address().port;
        return testAbortedSearchDoesNotFallback(port)
            .then(() => testHealthySearch(port))
            .then(() => testAbortedGenerateDoesNotCacheOrRetry(port))
            .then(() => testHealthyGenerate(port))
            .then(() => testHotNewsAbortDoesNotCancelSibling(port))
            .then(() => testImageAbortAndCompletion(port))
            .then(() => {
                server.close(() => {
                    console.log('staleWork tests ok');
                    process.exit(0);
                });
            });
    });
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
