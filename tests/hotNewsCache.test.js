'use strict';

const assert = require('assert');
const {
    HotNewsMemoryCache,
    HOT_NEWS_TTL_SECONDS,
    HOT_NEWS_STALE_TTL_SECONDS
} = require('../lib/hotNewsCache');
const {
    getStaticCacheControl,
    HASHED_CACHE_CONTROL,
    LONG_LIVED_CACHE_CONTROL,
    REVALIDATING_CACHE_CONTROL
} = require('../lib/staticCacheHeaders');

function createClock(startMs) {
    let now = startMs;
    return {
        now: () => now,
        advance(seconds) {
            now += seconds * 1000;
        }
    };
}

function testFreshHitAndMiss() {
    const clock = createClock(1_000_000);
    const cache = new HotNewsMemoryCache({ now: clock.now, ttlSeconds: 180, staleTtlSeconds: 3600 });
    const payload = { code: 200, result: { list: [{ word: 'ok' }] } };

    assert.strictEqual(cache.get('weibo'), null);
    cache.set('weibo', payload);
    assert.deepStrictEqual(cache.get('weibo'), payload);

    clock.advance(179);
    assert.deepStrictEqual(cache.get('weibo'), payload);

    clock.advance(2);
    assert.strictEqual(cache.get('weibo'), null);
    assert.deepStrictEqual(cache.getStale('weibo'), payload);
}

function testStaleExpires() {
    const clock = createClock(1_000_000);
    const cache = new HotNewsMemoryCache({ now: clock.now, ttlSeconds: 3, staleTtlSeconds: 10 });
    cache.set('toutiao', { code: 200, result: { list: [] } });

    clock.advance(11);
    assert.strictEqual(cache.get('toutiao'), null);
    assert.strictEqual(cache.getStale('toutiao'), null);
}

function testPlatformIsolation() {
    const cache = new HotNewsMemoryCache({ ttlSeconds: 180, staleTtlSeconds: 3600 });
    cache.set('weibo', { platform: 'weibo' });
    cache.set('douyin', { platform: 'douyin' });
    assert.strictEqual(cache.get('weibo').platform, 'weibo');
    assert.strictEqual(cache.get('douyin').platform, 'douyin');
    assert.strictEqual(cache.get('networkhot'), null);
}

function testTtlConstants() {
    assert.ok(HOT_NEWS_TTL_SECONDS >= 60 && HOT_NEWS_TTL_SECONDS <= 300);
    assert.ok(HOT_NEWS_STALE_TTL_SECONDS > HOT_NEWS_TTL_SECONDS);
}

function testStaticCachePolicy() {
    assert.strictEqual(getStaticCacheControl('public/app.a1b2c3d4.js'), HASHED_CACHE_CONTROL);
    assert.strictEqual(getStaticCacheControl('chunk-deadbeef.css'), HASHED_CACHE_CONTROL);
    assert.strictEqual(getStaticCacheControl('script.js'), REVALIDATING_CACHE_CONTROL);
    assert.strictEqual(getStaticCacheControl('styles.css'), REVALIDATING_CACHE_CONTROL);
    assert.strictEqual(getStaticCacheControl('js/api.js'), REVALIDATING_CACHE_CONTROL);
    assert.strictEqual(getStaticCacheControl('site.webmanifest'), REVALIDATING_CACHE_CONTROL);
    assert.strictEqual(getStaticCacheControl('favicon.svg'), LONG_LIVED_CACHE_CONTROL);
    assert.strictEqual(getStaticCacheControl('font.woff2'), LONG_LIVED_CACHE_CONTROL);
}

function testVercelKeepsDefaultIad1() {
    const vercel = require('../vercel.json');
    assert.strictEqual(vercel.regions, undefined);
    assert.ok(vercel.routes.some((route) => route.src === '/api/(.*)' && route.dest === '/server.js'));
    const hashed = vercel.routes.find((route) => route.headers && /immutable/.test(route.headers['Cache-Control']));
    assert.ok(hashed && /\[a-fA-F0-9\]\{8,\}/.test(hashed.src));
    const unhashedJs = vercel.routes.find((route) => route.src.includes('webmanifest'));
    assert.ok(unhashedJs);
    assert.ok(!/immutable/.test(unhashedJs.headers['Cache-Control']));
}

function run() {
    testFreshHitAndMiss();
    testStaleExpires();
    testPlatformIsolation();
    testTtlConstants();
    testStaticCachePolicy();
    testVercelKeepsDefaultIad1();
    console.log('hotNewsCache tests ok');
}

run();
