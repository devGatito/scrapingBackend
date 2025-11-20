"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const PORT = parseInt(process.env.PORT || '3000', 10);
app_1.app.listen(PORT, '0.0.0.0', () => {
    console.log(`scraper listening on http://0.0.0.0:${PORT}`);
});
