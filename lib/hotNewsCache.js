'use strict';

/**
 * In-process short-TTL memory cache for TianAPI hot-news list JSON.
 *
 * TTL choice: 180 seconds (3 minutes).
 * - Fresh enough for rapidly changing hot lists
 * - Long enough that repeat /api/hot-news hits on a warm Vercel instance
 *   skip TianAPI and avoid intermittent upstream latency/timeouts
 * - Within the 1–5 minute window for this latency plan
 *
 * No Redis/Upstash. Each serverless isolate has its own Map; a cold start
 * starts empty. A longer last-success copy (1 hour) is kept only as a
 * stale fallback when TianAPI fails — not served on a normal cache hit.
 */

const HOT_NEWS_TTL_SECONDS = 180;
const HOT_NEWS_STALE_TTL_SECONDS = 3600;

class HotNewsMemoryCache {
    constructor(options = {}) {
        this.ttlMs = (options.ttlSeconds == null ? HOT_NEWS_TTL_SECONDS : options.ttlSeconds) * 1000;
        this.staleTtlMs = (options.staleTtlSeconds == null ? HOT_NEWS_STALE_TTL_SECONDS : options.staleTtlSeconds) * 1000;
        this.now = options.now || Date.now;
        this.store = new Map();
    }

    _entry(platform) {
        const key = String(platform || 'networkhot');
        const item = this.store.get(key);
        if (!item) {
            return null;
        }
        if (this.now() > item.staleUntil) {
            this.store.delete(key);
            return null;
        }
        return item;
    }

    get(platform) {
        const item = this._entry(platform);
        if (!item) {
            return null;
        }
        if (this.now() > item.freshUntil) {
            return null;
        }
        return item.value;
    }

    getStale(platform) {
        const item = this._entry(platform);
        return item ? item.value : null;
    }

    set(platform, value) {
        const key = String(platform || 'networkhot');
        const t = this.now();
        this.store.set(key, {
            value,
            freshUntil: t + this.ttlMs,
            staleUntil: t + this.staleTtlMs
        });
        return value;
    }

    clear() {
        this.store.clear();
    }
}

const hotNewsCache = new HotNewsMemoryCache();

module.exports = {
    HotNewsMemoryCache,
    hotNewsCache,
    HOT_NEWS_TTL_SECONDS,
    HOT_NEWS_STALE_TTL_SECONDS
};
