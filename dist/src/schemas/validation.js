"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PropertyExtractionSchema = exports.UrlQuerySchema = void 0;
const zod_1 = require("zod");
// Esquema para validar la URL de entrada
exports.UrlQuerySchema = zod_1.z.object({
    url: zod_1.z.string().url().max(2048)
});
// Esquema para la extracción de propiedades inmobiliarias
exports.PropertyExtractionSchema = {
    title: 'string',
    price: 'number|null',
    currency: 'string|null',
    address: 'string|null',
    city: 'string|null',
    state: 'string|null',
    postalCode: 'string|null',
    country: 'string|null',
    bedrooms: 'number|null',
    bathrooms: 'number|null',
    parkingSpots: 'number|null',
    areaM2: 'number|null',
    lotM2: 'number|null',
    amenities: 'string[]',
    contactName: 'string|null',
    contactPhone: 'string|null',
    description: 'string|null',
    images: 'string[]',
    url: 'string',
};
