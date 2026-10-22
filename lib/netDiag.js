/**
 * Temporary connectivity probe. Returns timings and status only.
 * Callers must not log the TianAPI key or any URL that contains it.
 */

const dns = require('dns').promises;
const net = require('net');
const tls = require('tls');
const https = require('https');
const axios = require('axios');
const cheerio = require('cheerio');

const TIAN_HOST = 'apis.tianapi.com';
const LEGACY_HOST = 'api.tianapi.com';
const STEP_TIMEOUT_MS = 4000;
const BAIDU_QUERY = '纪念长征胜利90周年';

function elapsed(start) {
    return Date.now() - start;
}

function redact(value) {
    let text = String(value == null ? '' : value);
    const key = process.env.TIANAPI_KEY || '';
    if (key.length > 4) text = text.split(key).join('[redacted]');
    return text.replace(/key=[^&\s"']+/gi, 'key=[redacted]').slice(0, 180);
}

function proxyFlags() {
    const names = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy'];
    const present = {};
    names.forEach((name) => {
        present[name] = Boolean(process.env[name]);
    });
    return present;
}

async function resolveHost(host) {
    const result = { host, a: [], aaaa: [], lookup: [] };
    try {
        result.a = await dns.resolve4(host);
    } catch (error) {
        result.aError = error.code || redact(error.message);
    }
    try {
        result.aaaa = await dns.resolve6(host);
    } catch (error) {
        result.aaaaError = error.code || redact(error.message);
    }
    try {
        const looked = await dns.lookup(host, { all: true, verbatim: true });
        result.lookup = looked.map((item) => ({ address: item.address, family: item.family }));
    } catch (error) {
        result.lookupError = error.code || redact(error.message);
    }
    return result;
}

function tcpConnect(address, family) {
    return new Promise((resolve) => {
        const start = Date.now();
        const socket = net.connect({ host: address, port: 443, family });
        const done = (row) => {
            socket.destroy();
            resolve(row);
        };
        socket.setTimeout(STEP_TIMEOUT_MS);
        socket.once('connect', () => done({
            ok: true,
            address,
            family,
            ms: elapsed(start),
            remoteAddress: socket.remoteAddress,
            remoteFamily: socket.remoteFamily,
            localAddress: socket.localAddress
        }));
        socket.once('timeout', () => done({ ok: false, address, family, code: 'ETIMEDOUT', ms: elapsed(start) }));
        socket.once('error', (error) => done({
            ok: false,
            address,
            family,
            code: error.code || 'ERROR',
            ms: elapsed(start),
            message: redact(error.message)
        }));
    });
}

function tlsHandshake(host, address) {
    return new Promise((resolve) => {
        const start = Date.now();
        let settled = false;
        const finish = (row) => {
            if (settled) return;
            settled = true;
            resolve(row);
        };
        const socket = tls.connect({
            host: address,
            servername: host,
            port: 443,
            rejectUnauthorized: true
        });
        socket.setTimeout(STEP_TIMEOUT_MS);
        socket.once('secureConnect', () => {
            const cert = socket.getPeerCertificate() || {};
            const subject = cert.subject || {};
            const issuer = cert.issuer || {};
            finish({
                ok: true,
                address,
                sni: host,
                ms: elapsed(start),
                authorized: socket.authorized,
                authorizationError: socket.authorizationError || null,
                protocol: socket.getProtocol(),
                alpn: socket.alpnProtocol || null,
                subject: subject.CN || null,
                issuer: issuer.O || issuer.CN || null,
                validTo: cert.valid_to || null,
                remoteAddress: socket.remoteAddress
            });
            socket.end();
        });
        socket.once('timeout', () => {
            socket.destroy();
            finish({ ok: false, address, sni: host, code: 'ETIMEDOUT', ms: elapsed(start) });
        });
        socket.once('error', (error) => {
            socket.destroy();
            finish({
                ok: false,
                address,
                sni: host,
                code: error.code || 'ERROR',
                ms: elapsed(start),
                message: redact(error.message)
            });
        });
    });
}

function httpsGet(options) {
    return new Promise((resolve) => {
        const start = Date.now();
        let ttfb = null;
        const requestOptions = {
            host: options.address || options.host,
            servername: options.host,
            port: 443,
            method: 'GET',
            path: options.path,
            headers: Object.assign({ Host: options.host }, options.headers || {}),
            timeout: options.timeout || STEP_TIMEOUT_MS,
            rejectUnauthorized: true
        };
        if (options.family) requestOptions.family = options.family;
        const req = https.request(requestOptions, (res) => {
            ttfb = elapsed(start);
            const chunks = [];
            let size = 0;
            res.on('data', (chunk) => {
                size += chunk.length;
                if (size <= 400000) chunks.push(chunk);
            });
            res.on('end', () => {
                const socket = res.socket;
                resolve({
                    ok: true,
                    status: res.statusCode,
                    ttfbMs: ttfb,
                    totalMs: elapsed(start),
                    bytes: size,
                    remoteAddress: socket && socket.remoteAddress,
                    localAddress: socket && socket.localAddress,
                    alpn: socket && socket.alpnProtocol,
                    headers: res.headers,
                    body: Buffer.concat(chunks)
                });
            });
        });
        req.on('timeout', () => req.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })));
        req.on('error', (error) => resolve({
            ok: false,
            code: error.code || 'ERROR',
            message: redact(error.message),
            ttfbMs: ttfb,
            totalMs: elapsed(start)
        }));
        req.end();
    });
}

function summarizeTian(row) {
    const summary = {
        ok: row.ok,
        status: row.status || null,
        code: row.code || null,
        message: row.message || null,
        ttfbMs: row.ttfbMs == null ? null : row.ttfbMs,
        totalMs: row.totalMs,
        bytes: row.bytes || 0,
        remoteAddress: row.remoteAddress || null,
        localAddress: row.localAddress || null,
        alpn: row.alpn || null
    };
    if (!row.body) return summary;
    const text = row.body.toString('utf8');
    try {
        const parsed = JSON.parse(text);
        const list = parsed && parsed.result && (parsed.result.list || parsed.result.newslist);
        summary.businessCode = parsed.code;
        summary.msg = redact(parsed.msg || '');
        summary.listCount = Array.isArray(list) ? list.length : null;
    } catch (error) {
        summary.snippet = redact(text);
    }
    return summary;
}

function tianPath() {
    const key = process.env.TIANAPI_KEY || '';
    return { path: `/douyinhot/index?key=${encodeURIComponent(key)}`, hasKey: key.length > 0 };
}

async function httpProbe() {
    const resolved = await resolveHost(TIAN_HOST);
    const { path, hasKey } = tianPath();
    const v4 = resolved.a[0];
    const v6 = resolved.aaaa[0];
    const probes = {};
    if (v4) {
        probes.pinnedV4 = summarizeTian(await httpsGet({
            host: TIAN_HOST,
            address: v4,
            path,
            timeout: 8000
        }));
        probes.rootV4 = summarizeTian(await httpsGet({
            host: TIAN_HOST,
            address: v4,
            path: '/',
            timeout: STEP_TIMEOUT_MS
        }));
    }
    if (v6) {
        probes.pinnedV6 = summarizeTian(await httpsGet({
            host: TIAN_HOST,
            address: v6,
            path,
            timeout: STEP_TIMEOUT_MS
        }));
    }
    probes.hostnameDefault = summarizeTian(await httpsGet({
        host: TIAN_HOST,
        path,
        timeout: STEP_TIMEOUT_MS,
        headers: { 'User-Agent': 'axios/1.6.2', Accept: 'application/json, text/plain, */*' }
    }));
    return { hasKey, resolved, probes };
}

async function legacyProbe() {
    const legacy = await resolveHost(LEGACY_HOST);
    const { path, hasKey } = tianPath();
    const address = legacy.a[0];
    const row = address
        ? summarizeTian(await httpsGet({ host: LEGACY_HOST, address, path, timeout: STEP_TIMEOUT_MS }))
        : { ok: false, code: 'NO_A' };
    return { hasKey, legacy: { a: legacy.a, aaaa: legacy.aaaa, aaaaError: legacy.aaaaError || null }, probe: row };
}

function axiosSocket(result) {
    const response = result && result.response ? result.response : result;
    const request = response && response.request;
    const socket = request && (request.socket || request.res && request.res.socket);
    const config = (response && response.config) || (result && result.config) || {};
    const headers = config.headers || {};
    return {
        remoteAddress: socket && socket.remoteAddress || null,
        localAddress: socket && socket.localAddress || null,
        reusedSocket: Boolean(request && request.reusedSocket),
        userAgent: headers['User-Agent'] || headers['user-agent'] || null
    };
}

async function axiosOnce(label, config) {
    const { path } = tianPath();
    const url = `https://${TIAN_HOST}${path}`;
    const start = Date.now();
    try {
        const response = await axios.get(url, config);
        const data = response.data || {};
        const list = data.result && (data.result.list || data.result.newslist);
        return Object.assign({
            label,
            ok: true,
            status: response.status,
            totalMs: elapsed(start),
            businessCode: data.code,
            msg: redact(data.msg || ''),
            listCount: Array.isArray(list) ? list.length : null
        }, axiosSocket(response));
    } catch (error) {
        return Object.assign({
            label,
            ok: false,
            status: error.response ? error.response.status : null,
            code: error.code || null,
            message: redact(error.message),
            totalMs: elapsed(start)
        }, axiosSocket(error));
    }
}

async function axiosProbe() {
    const exact = { timeout: STEP_TIMEOUT_MS, validateStatus: () => true };
    const family4 = new https.Agent({ keepAlive: false, family: 4 });
    const family6 = new https.Agent({ keepAlive: false, family: 6 });
    const shared = new https.Agent({ keepAlive: true, family: 4 });
    const rows = [];
    rows.push(await axiosOnce('app-config', exact));
    rows.push(await axiosOnce('family4', Object.assign({}, exact, { httpsAgent: family4, proxy: false })));
    rows.push(await axiosOnce('family6', Object.assign({}, exact, { httpsAgent: family6, proxy: false })));
    rows.push(await axiosOnce('keepalive-1', Object.assign({}, exact, { httpsAgent: shared, proxy: false })));
    rows.push(await axiosOnce('keepalive-2', Object.assign({}, exact, { httpsAgent: shared, proxy: false })));
    family4.destroy();
    family6.destroy();
    shared.destroy();
    return {
        axiosVersion: axios.VERSION,
        proxyFlags: proxyFlags(),
        defaults: {
            proxy: axios.defaults.proxy || null,
            httpAgent: Boolean(axios.defaults.httpAgent),
            httpsAgent: Boolean(axios.defaults.httpsAgent),
            family: axios.defaults.family || null
        },
        rows
    };
}

function baiduSummary(label, response, error) {
    if (error) {
        return {
            label,
            ok: false,
            status: error.response ? error.response.status : null,
            code: error.code || null,
            message: redact(error.message),
            finalHost: null
        };
    }
    const body = typeof response.data === 'string' ? response.data : '';
    const $ = cheerio.load(body);
    const finalUrl = (response.request && response.request.res && response.request.res.responseUrl) || response.config.url;
    let finalHost = null;
    try {
        finalHost = new URL(finalUrl).host;
    } catch (parseError) {
        finalHost = null;
    }
    const setCookie = response.headers && response.headers['set-cookie'];
    const cookieNames = Array.isArray(setCookie)
        ? setCookie.map((item) => String(item).split('=')[0]).slice(0, 8)
        : [];
    const requestHeaders = response.config && response.config.headers ? response.config.headers : {};
    return {
        label,
        ok: true,
        status: response.status,
        bytes: Buffer.byteLength(body),
        finalHost,
        title: $('title').first().text().trim().slice(0, 80),
        resultCount: $('.result').length,
        cResultCount: $('.c-result').length,
        resultOpCount: $('.result-op').length,
        hasWappass: /wappass\.baidu\.com|百度安全验证|安全验证/.test(body),
        hasCaptcha: /captcha|验证码/.test(body),
        hasNoResult: /没有找到|抱歉，没有/.test(body),
        cookieNames,
        sent: {
            userAgent: requestHeaders['User-Agent'] || requestHeaders['user-agent'] || null,
            accept: requestHeaders.Accept || requestHeaders.accept || null,
            acceptLanguage: requestHeaders['Accept-Language'] || null,
            referer: requestHeaders.Referer || requestHeaders.referer || null,
            cookie: Boolean(requestHeaders.Cookie || requestHeaders.cookie)
        }
    };
}

async function baiduRequest(label, config) {
    const start = Date.now();
    try {
        const response = await axios.get(`https://www.baidu.com/s?wd=${encodeURIComponent(BAIDU_QUERY)}&tn=news`, config);
        return Object.assign(baiduSummary(label, response, null), { totalMs: elapsed(start) });
    } catch (error) {
        return Object.assign(baiduSummary(label, null, error), { totalMs: elapsed(start) });
    }
}

async function baiduFirstHop(label, headers) {
    const start = Date.now();
    try {
        const response = await axios.get(`https://www.baidu.com/s?wd=${encodeURIComponent(BAIDU_QUERY)}&tn=news`, {
            headers,
            timeout: 8000,
            maxRedirects: 0,
            validateStatus: () => true
        });
        const location = response.headers.location || response.headers.Location || '';
        let locationHost = null;
        if (location) {
            try {
                locationHost = new URL(location, 'https://www.baidu.com').host;
            } catch (error) {
                locationHost = 'unparsed';
            }
        }
        return {
            label,
            status: response.status,
            locationHost,
            bytes: typeof response.data === 'string' ? Buffer.byteLength(response.data) : 0,
            totalMs: elapsed(start)
        };
    } catch (error) {
        return { label, ok: false, code: error.code || null, message: redact(error.message), totalMs: elapsed(start) };
    }
}

async function baiduProbe() {
    const oldHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        Referer: 'https://www.baidu.com/'
    };
    const v2Headers = {
        'User-Agent': oldHeaders['User-Agent'],
        Accept: 'text/html',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        Referer: 'https://www.baidu.com/'
    };
    const [oldPath, v2Path, oldHop, v2Hop] = await Promise.all([
        baiduRequest('searchNews', { headers: oldHeaders, timeout: 10000, maxRedirects: 5, validateStatus: () => true }),
        baiduRequest('newsSearchV2', { headers: v2Headers, timeout: 8000, maxRedirects: 3, validateStatus: () => true }),
        baiduFirstHop('searchNews-first-hop', oldHeaders),
        baiduFirstHop('newsSearchV2-first-hop', v2Headers)
    ]);
    return { query: BAIDU_QUERY, oldPath, v2Path, oldHop, v2Hop };
}

async function connectProbe() {
    const resolved = await resolveHost(TIAN_HOST);
    const addresses = resolved.a.map((address) => ({ address, family: 4 }))
        .concat(resolved.aaaa.map((address) => ({ address, family: 6 })));
    const tcp = [];
    const handshakes = [];
    for (const item of addresses) {
        tcp.push(await tcpConnect(item.address, item.family));
        handshakes.push(await tlsHandshake(TIAN_HOST, item.address));
    }
    return { resolved, tcp, handshakes };
}

async function run(section) {
    const base = {
        section,
        vercelRegion: process.env.VERCEL_REGION || null,
        node: process.version
    };
    if (section === 'meta') {
        return Object.assign(base, {
            axiosVersion: axios.VERSION,
            proxyFlags: proxyFlags(),
            defaults: {
                proxy: axios.defaults.proxy || null,
                httpAgent: Boolean(axios.defaults.httpAgent),
                httpsAgent: Boolean(axios.defaults.httpsAgent)
            }
        });
    }
    if (section === 'dns') {
        return Object.assign(base, {
            tian: await resolveHost(TIAN_HOST),
            legacy: await resolveHost(LEGACY_HOST),
            baidu: await resolveHost('www.baidu.com')
        });
    }
    if (section === 'connect') return Object.assign(base, await connectProbe());
    if (section === 'http') return Object.assign(base, await httpProbe());
    if (section === 'legacy') return Object.assign(base, await legacyProbe());
    if (section === 'axios') return Object.assign(base, await axiosProbe());
    if (section === 'baidu') return Object.assign(base, await baiduProbe());
    const error = new Error('unknown section');
    error.code = 'BAD_SECTION';
    throw error;
}

module.exports = { run };
