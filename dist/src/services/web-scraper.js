"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebScraperService = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio_1 = require("cheerio");
const env_1 = require("../config/env");
const net_1 = require("../utils/net");
const https_proxy_agent_1 = require("https-proxy-agent");
const https = __importStar(require("https"));
class WebScraperService {
    /**
     * Obtiene la configuración del proxy a utilizar
     * Prioridad: 1. Proxy móvil (si está configurado) 2. Proxy residencial 3. Sin proxy
     */
    getProxyConfig() {
        // 1. Intentar con proxy móvil si está configurado
        if (process.env.MOBILE_PROXY) {
            try {
                return this.parseProxyUrl(process.env.MOBILE_PROXY);
            }
            catch (error) {
                console.warn('Error al parsear MOBILE_PROXY, usando proxy de respaldo');
            }
        }
        // 2. Intentar con proxy residencial
        const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
        if (proxyUrl) {
            try {
                return this.parseProxyUrl(proxyUrl);
            }
            catch (error) {
                console.warn('Error al parsear proxy HTTP/HTTPS', error);
            }
        }
        // 3. Sin proxy
        return undefined;
    }
    /**
     * Parsea una URL de proxy en el formato:
     * protocolo://usuario:contraseña@host:puerto
     */
    parseProxyUrl(proxyUrl) {
        const u = new URL(proxyUrl);
        const protocol = u.protocol.replace(':', '');
        return {
            protocol: protocol === 'https' ? 'https' : 'http',
            host: u.hostname,
            port: Number(u.port || (protocol === 'https' ? 443 : 80)),
            auth: u.username ? {
                username: decodeURIComponent(u.username),
                password: decodeURIComponent(u.password || '')
            } : undefined
        };
    }
    /**
     * Realiza el scraping de una URL y extrae el contenido
     */
    async scrapeUrl(url) {
        // Validar protocolo
        const urlObj = new URL(url);
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
            throw new Error('UNSUPPORTED_PROTOCOL');
        }
        // Verificar si el host está bloqueado
        const blockCheck = await (0, net_1.isBlockedHost)(urlObj.hostname);
        if (blockCheck.blocked) {
            throw new Error(blockCheck.reason || 'BLOCKED_HOST');
        }
        try {
            // Realizar petición HTTP
            const response = await this.fetchPage(url);
            // Procesar HTML con Cheerio
            return this.parseHtml(response.data, url);
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                const status = error.response?.status || 500;
                const code = error.code || 'AXIOS_ERROR';
                throw new Error(`HTTP_ERROR: ${code} - ${error.message}`);
            }
            throw error;
        }
    }
    /**
     * Realiza la petición HTTP a la URL
     */
    async fetchPage(url) {
        const urlObj = new URL(url);
        const isInmuebles24 = urlObj.hostname.includes('inmuebles24.com');
        const desktopUA = WebScraperService.USER_AGENTS[Math.floor(Math.random() * WebScraperService.USER_AGENTS.length)];
        const baseHeaders = {
            'User-Agent': desktopUA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'sec-ch-ua': '"Chromium";v="120", "Not=A?Brand";v="24", "Google Chrome";v="120"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Linux"',
        };
        if (isInmuebles24) {
            baseHeaders['Referer'] = 'https://www.google.com/';
            baseHeaders['Sec-Fetch-Site'] = 'cross-site';
        }
        // Obtener configuración del proxy
        const proxy = this.getProxyConfig();
        // Configuración común para axios
        const axiosConfig = {
            timeout: env_1.env.scrapeTimeoutMs,
            maxRedirects: 5,
            maxContentLength: env_1.env.scrapeMaxBytes,
            maxBodyLength: env_1.env.scrapeMaxBytes,
            responseType: 'text',
            httpsAgent: new https.Agent({
                rejectUnauthorized: false, // Ignorar errores de certificado
            }),
            headers: { ...baseHeaders },
            validateStatus: () => true, // Manejar todos los códigos de estado
        };
        // Configurar proxy si está disponible
        if (proxy) {
            const proxyUrl = `${proxy.protocol}://${proxy.auth?.username}:${proxy.auth?.password}@${proxy.host}:${proxy.port}`;
            axiosConfig.httpsAgent = new https_proxy_agent_1.HttpsProxyAgent(proxyUrl);
            axiosConfig.httpsAgent.rejectUnauthorized = false;
        }
        const attempt = async (headers) => {
            const config = { ...axiosConfig };
            config.headers = { ...config.headers, ...headers };
            try {
                const resp = await axios_1.default.get(url, config);
                return resp;
            }
            catch (error) {
                console.error('Error en la petición:', error.message);
                if (error.response) {
                    // La petición fue hecha y el servidor respondió con un código de estado
                    // que no está en el rango 2xx
                    console.error('Error response data:', error.response.data);
                    console.error('Error status:', error.response.status);
                    console.error('Error headers:', error.response.headers);
                }
                else if (error.request) {
                    // La petición fue hecha pero no se recibió respuesta
                    console.error('No se recibió respuesta del servidor');
                }
                else {
                    // Algo pasó al configurar la petición que desencadenó un error
                    console.error('Error al configurar la petición:', error.message);
                }
                throw error;
            }
        };
        // 0) Warm-up para obtener cookies si es un dominio con WAF (e.g., inmuebles24)
        let warmedCookie;
        if (isInmuebles24) {
            try {
                const warmConfig = { ...axiosConfig };
                warmConfig.timeout = Math.min(8000, env_1.env.scrapeTimeoutMs);
                warmConfig.maxRedirects = 3;
                if (proxy) {
                    const HttpsProxyAgent = require('https-proxy-agent').HttpsProxyAgent;
                    const proxyUrl = `${proxy.protocol}://${proxy.auth?.username}:${proxy.auth?.password}@${proxy.host}:${proxy.port}`;
                    warmConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
                    warmConfig.proxy = false;
                }
                const warmResp = await axios_1.default.get('https://www.inmuebles24.com/', warmConfig);
                const setCookie = warmResp.headers['set-cookie'];
                if (Array.isArray(setCookie) && setCookie.length) {
                    // Convertir Set-Cookie[] a cabecera Cookie simple
                    warmedCookie = setCookie
                        .map((c) => String(c).split(';')[0])
                        .filter(Boolean)
                        .join('; ');
                }
            }
            catch {
                // Ignorar errores de warm-up
            }
        }
        // 1) Intento con UA de escritorio (reutilizando cookies si las obtuvimos)
        const firstHeaders = warmedCookie ? { ...baseHeaders, Cookie: warmedCookie } : baseHeaders;
        let response = await attempt(firstHeaders);
        // 2) Si falla y es inmuebles24, reintentar con UA móvil y mismos headers
        if (isInmuebles24 && (response.status < 200 || response.status >= 400)) {
            const mobileHeaders = {
                ...firstHeaders,
                'User-Agent': WebScraperService.MOBILE_UA,
                'sec-ch-ua-mobile': '?1',
            };
            response = await attempt(mobileHeaders);
        }
        if (response.status >= 200 && response.status < 400) {
            return response;
        }
        const statusText = response.statusText || 'Request failed';
        const bodyLen = typeof response.data === 'string' ? response.data.length : 0;
        throw new Error(`HTTP_ERROR: STATUS_${response.status} - ${statusText} [host=${urlObj.hostname} path=${urlObj.pathname} len=${bodyLen}]`);
    }
    /**
     * Procesa el HTML y extrae el contenido estructurado
     */
    parseHtml(html, baseUrl) {
        const $ = (0, cheerio_1.load)(html);
        // Remover elementos no deseados
        $('script,style,noscript,template,svg,canvas,iframe,meta,link,head').remove();
        const title = $('title').first().text().trim();
        // Extraer imágenes
        const images = this.extractImages($, baseUrl);
        // Extraer figures
        const figures = this.extractFigures($, baseUrl);
        // Extraer texto del body
        const bodyTextRaw = $('body').text();
        const text = bodyTextRaw.replace(/\s+/g, ' ').trim();
        const wordCount = text ? text.split(/\s+/).length : 0;
        return {
            title,
            text,
            charCount: text.length,
            wordCount,
            images,
            figures,
        };
    }
    /**
     * Extrae información de imágenes del HTML
     */
    extractImages($, baseUrl) {
        return $('img')
            .map((_, el) => {
            const $el = $(el);
            const imageData = this.processImageElement($el, baseUrl);
            return this.isValidImage(imageData) ? imageData : undefined;
        })
            .get()
            .filter(Boolean);
    }
    /**
     * Extrae información de figures del HTML
     */
    extractFigures($, baseUrl) {
        return $('figure')
            .map((_, el) => {
            const $fig = $(el);
            const caption = $fig.find('figcaption').text().replace(/\s+/g, ' ').trim();
            const figImages = $fig
                .find('img')
                .map((__, img) => {
                const $img = $(img);
                const imageData = this.processImageElement($img, baseUrl);
                return this.isValidImage(imageData) ? imageData : undefined;
            })
                .get()
                .filter(Boolean);
            return { caption, images: figImages };
        })
            .get();
    }
    /**
     * Procesa un elemento de imagen individual
     */
    processImageElement($el, baseUrl) {
        const src = $el.attr('src')?.trim();
        const absSrc = this.resolveUrl(src, baseUrl);
        const srcsetRaw = $el.attr('srcset')?.trim();
        const alt = $el.attr('alt')?.trim();
        const title = $el.attr('title')?.trim();
        const loading = $el.attr('loading')?.trim();
        const decoding = $el.attr('decoding')?.trim();
        const widthAttr = Number($el.attr('width')) || undefined;
        const heightAttr = Number($el.attr('height')) || undefined;
        const style = $el.attr('style')?.trim();
        const widthStyle = this.cssPx(style, 'width');
        const heightStyle = this.cssPx(style, 'height');
        const width = widthAttr ?? widthStyle;
        const height = heightAttr ?? heightStyle;
        const referrerpolicy = $el.attr('referrerpolicy')?.trim();
        const crossorigin = $el.attr('crossorigin')?.trim();
        const sizes = $el.attr('sizes')?.trim();
        const srcsetParsed = this.parseSrcSet(srcsetRaw, baseUrl).filter((e) => !this.isSvgUrl(e.url));
        return {
            src: src || undefined,
            absSrc,
            alt,
            title,
            width,
            height,
            loading,
            decoding,
            referrerPolicy: referrerpolicy,
            crossorigin,
            sizes,
            srcset: srcsetParsed,
        };
    }
    /**
     * Valida si una imagen es válida para incluir
     */
    isValidImage(imageData) {
        const { width, height, absSrc, srcset } = imageData;
        // Verificar dimensiones mínimas
        if ((width !== undefined && width <= WebScraperService.MIN_DIMENSION_PX) ||
            (height !== undefined && height <= WebScraperService.MIN_DIMENSION_PX)) {
            return false;
        }
        // Verificar si es SVG
        if (absSrc && this.isSvgUrl(absSrc)) {
            return false;
        }
        // Debe tener al menos una URL válida
        return !!(absSrc || srcset.length > 0);
    }
    /**
     * Resuelve URLs relativas a absolutas
     */
    resolveUrl(maybeUrl, baseUrl) {
        if (!maybeUrl || !baseUrl)
            return undefined;
        try {
            return new URL(maybeUrl, baseUrl).toString();
        }
        catch {
            return undefined;
        }
    }
    /**
     * Parsea el atributo srcset
     */
    parseSrcSet(raw, baseUrl) {
        if (!raw)
            return [];
        return raw
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean)
            .map((part) => {
            const [u, d] = part.split(/\s+/, 2);
            const abs = this.resolveUrl(u, baseUrl);
            return abs ? { url: abs, descriptor: d } : undefined;
        })
            .filter(Boolean);
    }
    /**
     * Verifica si una URL es de SVG
     */
    isSvgUrl(url) {
        if (!url)
            return false;
        const s = url.toLowerCase();
        return s.startsWith('data:image/svg+xml') || /\.svg(?:$|[?#])/.test(s) || s.includes('image/svg+xml');
    }
    /**
     * Extrae valores en píxeles de CSS
     */
    cssPx(style, prop) {
        if (!style || !prop)
            return undefined;
        const m = style.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*(\\d+)px`, 'i'));
        return m ? Number(m[1]) : undefined;
    }
}
exports.WebScraperService = WebScraperService;
WebScraperService.USER_AGENTS = [
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
];
WebScraperService.MOBILE_UA = 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
WebScraperService.MIN_DIMENSION_PX = 150;
