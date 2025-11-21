"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Importar parches primero
require("./utils/patch-event-emitter");
const app_1 = require("./app");
const axios_config_1 = require("./utils/axios-config");
const PORT = parseInt(process.env.PORT || '3000', 10);
// Iniciar el servidor
const server = app_1.app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor escuchando en http://0.0.0.0:${PORT}`);
});
// Configurar manejadores para cierre limpio
const shutdown = async (signal) => {
    console.log(`Recibida señal ${signal}. Cerrando servidor...`);
    try {
        // Cerrar el servidor HTTP
        await new Promise((resolve, reject) => {
            server.close((err) => {
                if (err) {
                    console.error('Error al cerrar el servidor:', err);
                    reject(err);
                }
                else {
                    console.log('Servidor HTTP cerrado correctamente');
                    resolve();
                }
            });
        });
        // Limpiar recursos de axios
        (0, axios_config_1.cleanupAxios)();
        console.log('Recursos liberados. Saliendo...');
        process.exit(0);
    }
    catch (error) {
        console.error('Error durante el cierre:', error);
        process.exit(1);
    }
};
// Manejadores de señales
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (error) => {
    console.error('Excepción no capturada:', error);
    shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Promesa rechazada no manejada en:', promise, 'Razón:', reason);
});
