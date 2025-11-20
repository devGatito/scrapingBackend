"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const pino_http_1 = __importDefault(require("pino-http"));
const axios_1 = __importDefault(require("axios"));
const cheerio_1 = require("cheerio");
const zod_1 = require("zod");
const promises_1 = require("dns/promises");
const ipaddr_js_1 = __importDefault(require("ipaddr.js"));
const app = (0, express_1.default)();
app.set('trust proxy', true);
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '200kb' }));
app.use((0, pino_http_1.default)());
app.use((0, express_rate_limit_1.default)({
    windowMs: 60000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
}));
const PORT = Number(process.env.PORT || 3000);
const SCRAPE_TIMEOUT_MS = Number(process.env.SCRAPE_TIMEOUT_MS || 15000);
const SCRAPE_MAX_BYTES = Number(process.env.SCRAPE_MAX_BYTES || 2000000);
const USER_AGENTS = [
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
];
const QuerySchema = zod_1.z.object({ url: zod_1.z.string().url().max(2048) });
function isPrivateIp(address) {
    try {
        const ip = ipaddr_js_1.default.parse(address);
        return ip.range() !== 'unicast'; // anything not public unicast is private/special
    }
    catch {
        return true; // treat unparsable as unsafe
    }
}
// Health check
app.get('/health', (_req, res) => {
    res.json({ ok: true });
});
// Basic scrape endpoint: GET /scrape?url=https://example.com
app.get('/scrape', async (req, res) => {
    try {
        const parsed = QuerySchema.safeParse({ url: req.query.url });
        if (!parsed.success) {
            return res.status(400).json({ error: 'INVALID_URL', details: parsed.error.flatten() });
        }
        const url = parsed.data.url;
        const u = new URL(url);
        if (!['http:', 'https:'].includes(u.protocol)) {
            return res.status(400).json({ error: 'UNSUPPORTED_PROTOCOL' });
        }
        const hn = u.hostname.toLowerCase();
        if (hn === 'localhost' || hn === '127.0.0.1' || hn === '::1' || hn.endsWith('.local')) {
            return res.status(400).json({ error: 'BLOCKED_HOST' });
        }
        try {
            const { address } = await (0, promises_1.lookup)(hn, { all: false });
            if (isPrivateIp(address)) {
                return res.status(400).json({ error: 'BLOCKED_PRIVATE_IP' });
            }
        }
        catch {
            return res.status(400).json({ error: 'DNS_RESOLUTION_FAILED' });
        }
        const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        const response = await axios_1.default.get(url, {
            timeout: SCRAPE_TIMEOUT_MS,
            maxRedirects: 5,
            maxContentLength: SCRAPE_MAX_BYTES,
            maxBodyLength: SCRAPE_MAX_BYTES,
            headers: {
                'User-Agent': ua,
                'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            responseType: 'text',
            validateStatus: (s) => s >= 200 && s < 400,
        });
        const html = response.data;
        const $ = (0, cheerio_1.load)(html);
        const title = $('title').first().text().trim();
        const description = $('meta[name="description"]').attr('content') || '';
        // Return a minimal payload to verify the pipeline works
        return res.json({
            ok: true,
            status: response.status,
            url,
            data: {
                title,
                description,
                length: html.length,
            },
        });
    }
    catch (err) {
        if (axios_1.default.isAxiosError(err)) {
            const status = err.response?.status || 500;
            const code = err.code || 'AXIOS_ERROR';
            return res.status(status >= 400 && status < 600 ? status : 500).json({
                ok: false,
                error: code,
                message: err.message,
            });
        }
        return res.status(500).json({ ok: false, error: 'UNKNOWN', message: String(err?.message || err) });
    }
});
// Centralized error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, _req, res, _next) => {
    const status = typeof err?.status === 'number' ? err.status : 500;
    res.status(status).json({ ok: false, error: 'INTERNAL_ERROR', message: err?.message || 'Unexpected error' });
});
app.listen(PORT, () => {
    console.log(`scraper listening on http://localhost:${PORT}`);
});
