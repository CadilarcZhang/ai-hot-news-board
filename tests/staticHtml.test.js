'use strict';

const assert = require('assert');
const http = require('http');
const { HTML_CACHE_CONTROL, HTML_PLATFORM_PATHS, REVALIDATING_CACHE_CONTROL } = require('../lib/staticCacheHeaders');
const vercel = require('../vercel.json');

process.env.GOOGLE_SEARCH_SWITCH = '';
if (process.env.STATIC_HTML_MODE === 'local') {
    process.env.BASE_PATH = '/hot-news';
} else {
    process.env.BASE_PATH = '';
}
const app = require('../server');

function listen() {
    return new Promise((resolve) => {
        const server = app.listen(0, () => resolve(server));
    });
}

function get(port, path) {
    return new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:' + port + path, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: Buffer.concat(chunks).toString('utf8')
                });
            });
        }).on('error', reject);
    });
}

function testVercelHtmlRoutes() {
    const api = vercel.routes.findIndex((route) => route.src === '/api/(.*)' && route.dest === '/server.js');
    const home = vercel.routes.findIndex((route) => route.src === '/' && route.dest === '/public/index.html');
    const platforms = vercel.routes.find((route) => route.dest === '/public/index.html' && route.src.includes('weibo'));
    const catchAll = vercel.routes.findIndex((route) => route.src === '/(.*)' && route.dest === '/server.js');
    assert.ok(api >= 0 && home > api && catchAll > home);
    assert.strictEqual(vercel.routes[home].headers['Cache-Control'], HTML_CACHE_CONTROL);
    assert.ok(!/immutable/.test(HTML_CACHE_CONTROL));
    assert.ok(HTML_PLATFORM_PATHS.every((name) => platforms.src.includes(name)));
    assert.strictEqual(platforms.headers['Cache-Control'], HTML_CACHE_CONTROL);
    assert.ok(!vercel.routes[api].headers);
    assert.deepStrictEqual(vercel.regions, ['iad1']);
    const scriptRoute = vercel.routes.find((route) => route.src.includes('webmanifest'));
    assert.strictEqual(scriptRoute.headers['Cache-Control'], REVALIDATING_CACHE_CONTROL);
}

function testLocalBasePath(port) {
    return get(port, '/').then((root) => {
        assert.strictEqual(root.status, 302);
        assert.ok(String(root.headers.location).includes('/hot-news'));
    }).then(() => get(port, '/hot-news/toutiao')).then((page) => {
        assert.strictEqual(page.status, 200);
        assert.strictEqual(page.headers['cache-control'], HTML_CACHE_CONTROL);
        assert.ok(page.body.includes('今日热搜榜'));
    }).then(() => get(port, '/hot-news/api/generate')).then((missing) => {
        assert.strictEqual(missing.status, 400);
        assert.strictEqual(JSON.parse(missing.body).error, '标题不能为空');
    }).then(() => get(port, '/styles.css')).then((css) => {
        assert.strictEqual(css.status, 200);
        assert.strictEqual(css.headers['cache-control'], REVALIDATING_CACHE_CONTROL);
    });
}

function testExpressHtmlAndApiSplit(port) {
    const pages = ['/', '/weibo', '/toutiao', '/douyin'];
    return pages.reduce((chain, path) => {
        return chain.then(() => get(port, path)).then((res) => {
            assert.strictEqual(res.status, 200, path);
            assert.strictEqual(res.headers['cache-control'], HTML_CACHE_CONTROL, path);
            assert.ok(res.body.includes('今日热搜榜'), path);
            assert.ok(res.body.includes('/script.js'), path);
            assert.ok(!res.body.includes('text/event-stream'), path);
        });
    }, Promise.resolve())
        .then(() => get(port, '/styles.css'))
        .then((css) => {
            assert.strictEqual(css.status, 200);
            assert.strictEqual(css.headers['cache-control'], REVALIDATING_CACHE_CONTROL);
        })
        .then(() => get(port, '/api/generate'))
        .then((missing) => {
            assert.strictEqual(missing.status, 400);
            assert.ok(!String(missing.headers['cache-control'] || '').includes('s-maxage'));
            const body = JSON.parse(missing.body);
            assert.strictEqual(body.error, '标题不能为空');
        })
        .then(() => get(port, '/favicon.svg'))
        .then((icon) => {
            assert.strictEqual(icon.status, 200);
            assert.ok(icon.headers['content-type'].includes('image/svg+xml'));
        });
}

function run() {
    const checks = process.env.STATIC_HTML_MODE === 'local'
        ? testLocalBasePath
        : function (port) {
            testVercelHtmlRoutes();
            return testExpressHtmlAndApiSplit(port);
        };
    return listen().then((server) => {
        const port = server.address().port;
        return Promise.resolve(checks(port)).then(() => {
            server.close(() => {
                if (process.env.STATIC_HTML_MODE === 'local') {
                    console.log('staticHtml local tests ok');
                    process.exit(0);
                }
                const { spawnSync } = require('child_process');
                const child = spawnSync(process.execPath, [__filename], {
                    env: Object.assign({}, process.env, {
                        STATIC_HTML_MODE: 'local',
                        BASE_PATH: '/hot-news',
                        GOOGLE_SEARCH_SWITCH: ''
                    }),
                    encoding: 'utf8'
                });
                if (child.stdout) process.stdout.write(child.stdout);
                if (child.stderr) process.stderr.write(child.stderr);
                if (child.status !== 0) {
                    process.exit(child.status || 1);
                }
                console.log('staticHtml tests ok');
                process.exit(0);
            });
        });
    });
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
