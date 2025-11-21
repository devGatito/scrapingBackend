import { EventEmitter } from 'events';

// Aumentar el límite de listeners para evitar advertencias
const DEFAULT_MAX_LISTENERS = 30;

// Configurar los límites globales de EventEmitter
EventEmitter.defaultMaxListeners = DEFAULT_MAX_LISTENERS;

// Configurar límites para instancias específicas de EventEmitter
const configureEmitter = (emitter: EventEmitter) => {
  emitter.setMaxListeners(DEFAULT_MAX_LISTENERS);
  return emitter;
};

export { configureEmitter, DEFAULT_MAX_LISTENERS };

// Este archivo debe importarse lo antes posible en tu aplicación
// Agrégalo como la primera importación en tu punto de entrada principal
