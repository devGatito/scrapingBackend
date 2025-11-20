import axios, { AxiosError, AxiosResponse, AxiosRequestConfig } from 'axios';
import { load } from 'cheerio';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as https from 'https';
import * as http from 'http';
import { env } from '../config/env';
import { isBlockedHost } from '../utils/net';
import { ScrapedData, ImageData, FigureData } from '../types/scraping';

export class WebScraperService {
  private static readonly USER_AGENTS = [
    // Chrome Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    
    // Chrome Mac
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    
    // Firefox Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    
    // Safari Mac
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
    
    // Linux
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
  ];
  
  // Helper method to generate a random IP address
  private generateRandomIp(): string {
    return Array(4).fill(0)
      .map(() => Math.floor(Math.random() * 255) + 1)
      .join('.');
  }
  
  // Helper method to get a random platform
  private getRandomPlatform(): string {
    const platforms = ['"Windows"', '"macOS"', '"Linux"', '"Chrome OS"'];
    return platforms[Math.floor(Math.random() * platforms.length)];
  }

  private static readonly MOBILE_UA =
    'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

  private static readonly MIN_DIMENSION_PX = 150;

  private getRandomUserAgent(): string {
    const userAgents = [
      // Windows
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
      // MacOS
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      // Linux
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
      // Add the static USER_AGENTS as fallback
      ...WebScraperService.USER_AGENTS
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  /**
   * Obtiene la configuración del proxy a utilizar
   * Prioridad: 1. Proxy móvil (si está configurado) 2. Proxy residencial 3. Sin proxy
   */
  private getProxyConfig() {
    // 1. Intentar con proxy móvil si está configurado
    if (process.env.MOBILE_PROXY) {
      try {
        return this.parseProxyUrl(process.env.MOBILE_PROXY);
      } catch (error) {
        console.warn('Error al parsear MOBILE_PROXY, usando proxy de respaldo');
      }
    }

    // 2. Intentar con proxy residencial
    const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
    if (proxyUrl) {
      try {
        return this.parseProxyUrl(proxyUrl);
      } catch (error) {
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
  private parseProxyUrl(proxyUrl: string) {
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
  async scrapeUrl(url: string): Promise<ScrapedData> {
    // Validar protocolo
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('UNSUPPORTED_PROTOCOL');
    }

    // Verificar si el host está bloqueado
    const blockCheck = await isBlockedHost(urlObj.hostname);
    if (blockCheck.blocked) {
      throw new Error(blockCheck.reason || 'BLOCKED_HOST');
    }

    try {
      // Realizar petición HTTP
      const html = await this.fetchPage(url);
      
      // Procesar HTML con Cheerio
      return this.parseHtml(html, url);

    } catch (error) {
      if (axios.isAxiosError(error)) {
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
  // Ensure URL uses HTTPS and handle CORS preflight
  private ensureHttps(url: string): string {
    if (url.startsWith('http://')) {
      return url.replace('http://', 'https://');
    } else if (!url.startsWith('https://')) {
      return `https://${url}`;
    }
    return url;
  }

  // Handle CORS preflight and set appropriate headers
  private getCorsHeaders(isInmuebles24: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      'Access-Control-Allow-Origin': isInmuebles24 ? 'https://www.inmuebles24.com' : '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400' // 24 hours
    };
    return headers;
  }

  private async fetchPage(url: string): Promise<string> {
    // Ensure URL uses HTTPS
    url = this.ensureHttps(url);
    const urlObj = new URL(url);
    const isInmuebles24 = urlObj.hostname.includes('inmuebles24.com');
    
    // Get CORS headers
    const corsHeaders = this.getCorsHeaders(isInmuebles24);

    // Obtener configuración del proxy
    const proxy = this.getProxyConfig();
    
    // Generar un número aleatorio para variar los headers
    const randomValue = Math.random().toString(36).substring(2, 8);
    
    // Configuración de headers mejorada y más realista
    const baseHeaders: Record<string, string> = {
      'User-Agent': this.getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
      'Accept-Language': 'es-MX,es-ES;q=0.9,es;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'max-age=0',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'sec-ch-ua': '"Google Chrome";v="120", "Not)A;Brand";v="8", "Chromium";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': this.getRandomPlatform(),
      'DNT': Math.random() > 0.5 ? '1' : '0',
      'Referer': 'https://www.google.com/',
      'Pragma': 'no-cache',
      'TE': 'trailers',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Forwarded-For': this.generateRandomIp(),
      'X-Forwarded-Host': urlObj.hostname,
      'X-Forwarded-Proto': 'https',
      'X-Real-IP': this.generateRandomIp(),
      'X-Custom-Id': randomValue,
      'X-Request-Id': randomValue,
      'X-Timestamp': Date.now().toString(),
    };

    // Headers específicos para inmuebles24
    if (isInmuebles24) {
      // Añadir headers adicionales específicos para inmuebles24
      baseHeaders['Referer'] = 'https://www.google.com/';
      baseHeaders['Sec-Fetch-Site'] = 'same-origin';
      baseHeaders['Origin'] = 'https://www.inmuebles24.com';
      baseHeaders['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9';
      
      // Añadir cookies si están disponibles
      if (!baseHeaders['Cookie']) {
        baseHeaders['Cookie'] = `_ga=GA1.2.${Math.floor(Math.random() * 1000000000)}.${Math.floor(Date.now() / 1000)}; ` +
                              `_gid=GA1.2.${Math.floor(Math.random() * 1000000000)}.${Math.floor(Date.now() / 1000)}; ` +
                              `_fbp=fb.1.${Date.now()}.${Math.floor(Math.random() * 1000000000)}; ` +
                              `_hjid=${Math.random().toString(36).substring(2, 15)}`;
      }
    }

    // Common axios configuration with enhanced security
    const axiosConfig: AxiosRequestConfig = {
      timeout: env.scrapeTimeoutMs || 30000, // 30 seconds default
      maxRedirects: 5,
      maxContentLength: env.scrapeMaxBytes || 50 * 1024 * 1024, // 50MB default
      maxBodyLength: env.scrapeMaxBytes || 50 * 1024 * 1024,
      responseType: 'text',
      headers: {
        ...baseHeaders,
        ...corsHeaders, // Add CORS headers
        'Origin': isInmuebles24 ? 'https://www.inmuebles24.com' : urlObj.origin,
        'Referer': isInmuebles24 ? 'https://www.inmuebles24.com/' : `${urlObj.origin}/`,
      },
      validateStatus: (status: number) => status >= 200 && status < 400, // Solo aceptar códigos 2xx y 3xx
      httpsAgent: new https.Agent({ 
        rejectUnauthorized: process.env.NODE_ENV !== 'production', // Only in development
        keepAlive: true,
        maxFreeSockets: 15,
        timeout: env.scrapeTimeoutMs || 30000,
        ...(urlObj.hostname ? { servername: urlObj.hostname } : {})
      }),
      httpAgent: new http.Agent({
        keepAlive: true,
        timeout: env.scrapeTimeoutMs || 30000
      })
    };

    // Configure proxy if available
    if (proxy) {
      const proxyUrl = proxy.auth?.username 
        ? `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.host}:${proxy.port}`
        : `http://${proxy.host}:${proxy.port}`;
      
      const agent = new HttpsProxyAgent(proxyUrl, {
        timeout: env.scrapeTimeoutMs || 30000,
        ...(urlObj.hostname ? { servername: urlObj.hostname } : {})
      }) as any; // Type assertion to access https.Agent properties
      
      // Set rejectUnauthorized on the underlying https.Agent
      if (agent.httpsAgent) {
        agent.httpsAgent.rejectUnauthorized = process.env.NODE_ENV === 'production';
      }
      
      axiosConfig.httpsAgent = agent;
      axiosConfig.httpAgent = agent;
      axiosConfig.proxy = false; // Important to avoid conflicts
      
      // Add proxy headers if needed
      if (isInmuebles24) {
        axiosConfig.headers = {
          ...axiosConfig.headers,
          'X-Forwarded-Proto': 'https',
          'X-Forwarded-Host': urlObj.hostname,
          'X-Forwarded-Port': '443'
        };
      }
    }

    const attempt = async (headers: Record<string, string>): Promise<string> => {
      // Merge headers with priority to the most specific ones
      const mergedHeaders = {
        ...corsHeaders,
        ...axiosConfig.headers,
        ...headers,
        // Ensure these critical headers are always set
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      };
      
      const config: AxiosRequestConfig = { 
        ...axiosConfig,
        headers: mergedHeaders,
        timeout: env.scrapeTimeoutMs || 30000,
        // Add request transformer for additional processing
        transformRequest: [
          // @ts-ignore - Axios types are a bit wonky here
          (data, headers) => {
            if (headers) {
              // Add timestamp to prevent caching
              headers['X-Request-Timestamp'] = Date.now().toString();
              
              // Add unique request ID
              if (!headers['X-Request-ID']) {
                headers['X-Request-ID'] = `req_${Math.random().toString(36).substr(2, 9)}`;
              }
            }
            return data;
          }
        ]
      };
      
      try {
        const response = await axios.get<string>(url, config);
        return response.data;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          if (error.response) {
            // La petición fue hecha y el servidor respondió con un código de estado
            const { status, statusText } = error.response;
            
            if (status === 403) {
              throw new Error('Acceso denegado (403) - Puede que el sitio esté bloqueando peticiones automatizadas');
            } else if (status === 429) {
              throw new Error('Demasiadas peticiones (429) - Por favor, inténtalo de nuevo más tarde');
            } else {
              throw new Error(`Error HTTP ${status}: ${statusText}`);
            }
          } else if (error.request) {
            // La petición fue hecha pero no se recibió respuesta
            throw new Error('No se recibió respuesta del servidor');
          }
        }
        
        throw new Error(`Error en la petición: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      }
    };

    // 0) Warm-up para obtener cookies si es un dominio con WAF (e.g., inmuebles24)
    let warmedCookie: string | undefined;
    if (isInmuebles24) {
      try {
        const warmConfig = { ...axiosConfig };
        warmConfig.timeout = Math.min(8000, env.scrapeTimeoutMs);
        warmConfig.maxRedirects = 3;
        
        if (proxy) {
          const HttpsProxyAgent = require('https-proxy-agent').HttpsProxyAgent;
          const proxyUrl = `${proxy.protocol}://${proxy.auth?.username}:${proxy.auth?.password}@${proxy.host}:${proxy.port}`;
          warmConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
          warmConfig.proxy = false;
        }
        
        const warmResp = await axios.get<string>('https://www.inmuebles24.com/', warmConfig);
        const setCookie = warmResp.headers['set-cookie'];
        if (Array.isArray(setCookie) && setCookie.length) {
          // Convertir Set-Cookie[] a cabecera Cookie simple
          warmedCookie = setCookie
            .map((c) => String(c).split(';')[0])
            .filter(Boolean)
            .join('; ');
        }
      } catch {
        // Ignorar errores de warm-up
      }
    }

    // 1) Intento con UA de escritorio (reutilizando cookies si las obtuvimos)
    const firstHeaders = warmedCookie ? { ...baseHeaders, Cookie: warmedCookie } : baseHeaders;
    
    try {
      let response = await attempt(firstHeaders);
      return response; // Success case - return the response data (string)
    } catch (error) {
      // 2) Si falla y es inmuebles24, reintentar con UA móvil y mismos headers
      if (isInmuebles24 && axios.isAxiosError(error) && error.response) {
        const mobileHeaders = {
          ...firstHeaders,
          'User-Agent': WebScraperService.MOBILE_UA,
          'sec-ch-ua-mobile': '?1',
        };
        
        try {
          const retryResponse = await attempt(mobileHeaders);
          return retryResponse; // Success on retry - return the response data (string)
        } catch (retryError) {
          // If retry also fails, handle the error
          if (axios.isAxiosError(retryError) && retryError.response) {
            const { status, statusText, data } = retryError.response;
            const bodyLen = typeof data === 'string' ? data.length : 0;
            throw new Error(
              `HTTP_ERROR: STATUS_${status} - ${statusText} [host=${urlObj.hostname} path=${urlObj.pathname} len=${bodyLen}]`
            );
          }
          throw retryError;
        }
      }
      
      // Handle the original error if not an axios error or no response
      if (axios.isAxiosError(error) && error.response) {
        const { status, statusText, data } = error.response;
        const bodyLen = typeof data === 'string' ? data.length : 0;
        throw new Error(
          `HTTP_ERROR: STATUS_${status} - ${statusText} [host=${urlObj.hostname} path=${urlObj.pathname} len=${bodyLen}]`
        );
      }
      
      // For non-axios errors or errors without response
      throw error instanceof Error 
        ? error 
        : new Error('An unknown error occurred while fetching the page');
    }
  }

  /**
   * Procesa el HTML y extrae el contenido estructurado
   */
  private parseHtml(html: string, baseUrl: string): ScrapedData {
    const $ = load(html);

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
  private extractImages($: any, baseUrl: string): ImageData[] {
    return $('img')
      .map((_: any, el: any) => {
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
  private extractFigures($: any, baseUrl: string): FigureData[] {
    return $('figure')
      .map((_: any, el: any) => {
        const $fig = $(el);
        const caption = $fig.find('figcaption').text().replace(/\s+/g, ' ').trim();
        
        const figImages = $fig
          .find('img')
          .map((__: any, img: any) => {
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
  private processImageElement($el: any, baseUrl: string): ImageData {
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

    const srcsetParsed = this.parseSrcSet(srcsetRaw, baseUrl).filter(
      (e) => !this.isSvgUrl(e.url)
    );

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
  private isValidImage(imageData: ImageData): boolean {
    const { width, height, absSrc, srcset } = imageData;

    // Verificar dimensiones mínimas
    if (
      (width !== undefined && width <= WebScraperService.MIN_DIMENSION_PX) ||
      (height !== undefined && height <= WebScraperService.MIN_DIMENSION_PX)
    ) {
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
  private resolveUrl(maybeUrl?: string, baseUrl?: string): string | undefined {
    if (!maybeUrl || !baseUrl) return undefined;
    try {
      return new URL(maybeUrl, baseUrl).toString();
    } catch {
      return undefined;
    }
  }

  /**
   * Parsea el atributo srcset
   */
  private parseSrcSet(raw?: string, baseUrl?: string): Array<{ url: string; descriptor?: string }> {
    if (!raw) return [];
    
    return raw
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((part) => {
        const [u, d] = part.split(/\s+/, 2);
        const abs = this.resolveUrl(u, baseUrl);
        return abs ? { url: abs, descriptor: d } : undefined;
      })
      .filter(Boolean) as Array<{ url: string; descriptor?: string }>;
  }

  /**
   * Verifica si una URL es de SVG
   */
  private isSvgUrl(url?: string): boolean {
    if (!url) return false;
    const s = url.toLowerCase();
    return s.startsWith('data:image/svg+xml') || /\.svg(?:$|[?#])/.test(s) || s.includes('image/svg+xml');
  }

  /**
   * Extrae valores en píxeles de CSS
   */
  private cssPx(style?: string, prop?: string): number | undefined {
    if (!style || !prop) return undefined;
    const m = style.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*(\\d+)px`, 'i'));
    return m ? Number(m[1]) : undefined;
  }
}
