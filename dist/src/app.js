"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const pino_http_1 = __importDefault(require("pino-http"));
const scrape_1 = require("./routes/scrape");
const error_handler_1 = require("./middleware/error-handler");
exports.app = (0, express_1.default)();
// Configuración del puerto
const PORT = process.env.PORT || 3000;
// Configuración de proxy
exports.app.set('trust proxy', 1);
// Force HTTPS in production
exports.app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
        return res.redirect(301, `https://${req.hostname}${req.originalUrl}`);
    }
    return next();
});
// Enhanced security headers with helmet
exports.app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'"],
            imgSrc: ["'self'"],
            connectSrc: ["'self'"],
        },
    },
    crossOriginEmbedderPolicy: { policy: 'require-corp' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-site' },
    originAgentCluster: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
// CORS configuration
exports.app.use((0, cors_1.default)({
    origin: [
        'https://www.inmuebles24.com',
        'https://inmuebles24.com',
        ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : [])
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 204,
    maxAge: 86400 // 24 hours
}));
// Additional security headers
exports.app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});
exports.app.use(express_1.default.json({ limit: '200kb' }));
exports.app.use((0, pino_http_1.default)());
exports.app.use((0, express_rate_limit_1.default)({
    windowMs: 60000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
}));
// Serve local storage (PDFs and extracted images)
exports.app.use('/static', express_1.default.static(path_1.default.resolve('storage')));
// Root health endpoint
exports.app.get('/', (_req, res) => {
    res.json({
        status: 'ok',
        message: 'API is running',
        timestamp: new Date().toISOString()
    });
});
// Iniciar el servidor solo si no estamos en un entorno de pruebas
if (process.env.NODE_ENV !== 'test') {
    exports.app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
}
exports.app.use(scrape_1.scrape);
// Centralized error handler
exports.app.use(error_handler_1.errorHandler);
