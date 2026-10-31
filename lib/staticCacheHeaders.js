'use strict';

const path = require('path');

const HASHED_ASSET = /(?:[._-])[a-fA-F0-9]{8,}\.(js|css|mjs|woff2?|ttf|eot|png|jpe?g|gif|svg|ico|webp)$/i;
const LONG_LIVED_ASSET = /\.(woff2?|ttf|eot|png|jpe?g|gif|svg|ico|webp)$/i;
const REVALIDATING_ASSET = /\.(js|css|mjs|webmanifest)$/i;

const HASHED_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const LONG_LIVED_CACHE_CONTROL = 'public, max-age=2592000, stale-while-revalidate=31536000';
const REVALIDATING_CACHE_CONTROL = 'public, max-age=60, s-maxage=60, stale-while-revalidate=86400';

/**
 * Cache-Control for public/** files.
 * Hashed filenames (content hash in the name) are immutable for 1 year.
 * Unhashed JS/CSS stay short-lived so deploys are not stuck behind immutable.
 */
function getStaticCacheControl(filePath) {
    const name = path.basename(filePath || '');
    if (!name) {
        return null;
    }
    if (HASHED_ASSET.test(name)) {
        return HASHED_CACHE_CONTROL;
    }
    if (LONG_LIVED_ASSET.test(name)) {
        return LONG_LIVED_CACHE_CONTROL;
    }
    if (REVALIDATING_ASSET.test(name)) {
        return REVALIDATING_CACHE_CONTROL;
    }
    return null;
}

function setStaticAssetHeaders(res, filePath) {
    const cacheControl = getStaticCacheControl(filePath);
    if (cacheControl) {
        res.setHeader('Cache-Control', cacheControl);
    }
}

module.exports = {
    getStaticCacheControl,
    setStaticAssetHeaders,
    HASHED_CACHE_CONTROL,
    LONG_LIVED_CACHE_CONTROL,
    REVALIDATING_CACHE_CONTROL
};
