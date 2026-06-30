import { addonInterface } from "./addon";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { serveHTTP } = require("stremio-addon-sdk");

const PORT = parseInt(process.env.PORT ?? "7000", 10);

serveHTTP(addonInterface, { port: PORT });
console.log(`TorLink addon running at http://localhost:${PORT}`);
console.log(`Install URL: http://localhost:${PORT}/manifest.json`);
