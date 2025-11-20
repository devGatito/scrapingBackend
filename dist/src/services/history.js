"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoryService = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const STORAGE_DIR = path_1.default.resolve('storage');
const HISTORY_FILE = path_1.default.join(STORAGE_DIR, 'history.jsonl');
async function ensureStorage() {
    await promises_1.default.mkdir(STORAGE_DIR, { recursive: true });
    try {
        await promises_1.default.access(HISTORY_FILE);
    }
    catch {
        await promises_1.default.writeFile(HISTORY_FILE, '', 'utf8');
    }
}
class HistoryService {
    static async append(entry) {
        await ensureStorage();
        const full = {
            id: (0, crypto_1.randomUUID)(),
            timestamp: new Date().toISOString(),
            ...entry,
        };
        const line = JSON.stringify(full) + '\n';
        await promises_1.default.appendFile(HISTORY_FILE, line, 'utf8');
        return full;
    }
    static async list(limit = 50) {
        await ensureStorage();
        const content = await promises_1.default.readFile(HISTORY_FILE, 'utf8');
        const lines = content.split('\n').filter(Boolean);
        const parsed = [];
        for (let i = Math.max(0, lines.length - limit); i < lines.length; i++) {
            try {
                parsed.push(JSON.parse(lines[i]));
            }
            catch { }
        }
        return parsed.reverse();
    }
    static async getById(id) {
        await ensureStorage();
        const content = await promises_1.default.readFile(HISTORY_FILE, 'utf8');
        const lines = content.split('\n').filter(Boolean).reverse();
        for (const line of lines) {
            try {
                const obj = JSON.parse(line);
                if (obj.id === id)
                    return obj;
            }
            catch { }
        }
        return null;
    }
}
exports.HistoryService = HistoryService;
