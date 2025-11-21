import axios, { AxiosInstance } from 'axios';
import https from 'https';
import http from 'http';
import { configureEmitter } from './patch-event-emitter';

// Configurar agentes HTTP/HTTPS con límites de conexión
const httpAgent = new http.Agent({ 
  keepAlive: true,
  maxSockets: 10,
  keepAliveMsecs: 60000,
  timeout: 30000,
  maxFreeSockets: 10,
  maxTotalSockets: 20
});

const httpsAgent = new https.Agent({ 
  keepAlive: true,
  maxSockets: 10,
  keepAliveMsecs: 60000,
  timeout: 30000,
  maxFreeSockets: 10,
  maxTotalSockets: 20,
  rejectUnauthorized: process.env.NODE_ENV !== 'production'
});

// Configurar la instancia de axios
const axiosInstance: AxiosInstance = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 30000,
  maxRedirects: 5,
  maxContentLength: 50 * 1024 * 1024, // 50MB
  validateStatus: (status) => status >= 200 && status < 400,
});

// Configurar los emisores de eventos para axios
configureEmitter(httpAgent);
configureEmitter(httpsAgent);
configureEmitter(process);

// Función para limpiar recursos
export function cleanupAxios() {
  httpAgent.destroy();
  httpsAgent.destroy();
}

export default axiosInstance;
