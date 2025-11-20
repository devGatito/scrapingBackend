"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const extraction_1 = require("./services/extraction");
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
// Middleware básico
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Instancia del servicio de extracción
const extractionService = new extraction_1.ExtractionService();
// Ruta de prueba
app.get('/', (req, res) => {
    res.json({
        ok: true,
        message: 'Cotizador API is running',
        endpoints: [
            'GET /extract?url=<url> - Extract property info with Gemini AI',
            'GET /scrape?url=<url> - Scrape page content only'
        ]
    });
});
// Endpoint para extracción completa (scraping + Gemini AI)
app.get('/extract', async (req, res) => {
    try {
        console.log('Extract request:', req.query);
        const { status, body } = await extractionService.extractFromUrl(req.query);
        return res.status(status).json(body);
    }
    catch (error) {
        console.error('Extraction error:', error);
        return res.status(500).json({
            ok: false,
            error: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Endpoint para solo scraping (sin AI)
app.get('/scrape', async (req, res) => {
    try {
        console.log('Scrape request:', req.query);
        const { status, body } = await extractionService.scrapeOnly(req.query);
        return res.status(status).json(body);
    }
    catch (error) {
        console.error('Scraping error:', error);
        return res.status(500).json({
            ok: false,
            error: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Manejo de errores global
app.use((error, req, res, next) => {
    console.error('Global error:', error);
    res.status(500).json({
        ok: false,
        error: 'INTERNAL_ERROR',
        message: error.message || 'Unknown error'
    });
});
app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
    console.log(`📋 Endpoints available:`);
    console.log(`   GET /extract?url=<url> - Extract with Gemini AI`);
    console.log(`   GET /scrape?url=<url> - Scrape only`);
});
