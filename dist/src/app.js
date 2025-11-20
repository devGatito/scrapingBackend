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
// Configuración de proxy para manejar correctamente las cabeceras de AWS
exports.app.set('trust proxy', true);
exports.app.use((0, helmet_1.default)());
exports.app.use((0, cors_1.default)());
exports.app.use(express_1.default.json({ limit: '200kb' }));
exports.app.use((0, pino_http_1.default)());
exports.app.use((0, express_rate_limit_1.default)({ windowMs: 60000, max: 60, standardHeaders: true, legacyHeaders: false }));
// Serve local storage (PDFs and extracted images)
exports.app.use('/static', express_1.default.static(path_1.default.resolve('storage')));
// Root health endpoint for load balancer
exports.app.get('/', (_req, res) => {
    res.json({ ok: true });
});
exports.app.use(scrape_1.scrape);
// Centralized error handler
exports.app.use(error_handler_1.errorHandler);
