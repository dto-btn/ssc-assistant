/* eslint-env node */
import express from "express";
import ViteExpress from "vite-express";
import { createProxyMiddleware } from 'http-proxy-middleware';
import net from "node:net";
import { config } from "dotenv";

config();

const app = express();

const onApiProxyReq = (proxyReq) => {
    // Add the X-API-Key header to the outgoing proxy request
    proxyReq.setHeader('X-API-Key', process.env.VITE_API_KEY);
};

app.use('/api/*', createProxyMiddleware({
    target: process.env.VITE_API_BACKEND,
    changeOrigin: true,
    onProxyReq: onApiProxyReq,
}));

/**
 * Blob previews are streamed by the API backend using its managed identity, so the browser
 * only ever talks to the API and no SAS token is exposed. The container-prefixed request
 * path is rewritten onto the API's blob route.
 */
const blobApiProxy = createProxyMiddleware({
    target: process.env.VITE_API_BACKEND,
    changeOrigin: true,
    onProxyReq: (proxyReq, req) => {
        proxyReq.setHeader('X-API-Key', process.env.VITE_API_KEY);
        proxyReq.path = '/api/playground/blob' + (req.originalUrl || req.url);
    },
});

if (!process.env.VITE_API_BACKEND) {
    console.warn("VITE_API_BACKEND is not defined. Blob previews will be unavailable.");
}

app.use('/assistant-chat-files/*', blobApiProxy);
app.use('/assistant-chat-files-v2/*', blobApiProxy);
app.use('/pmcoe-(dev|sept-2025|latest)/*', blobApiProxy);

const isPortAvailable = (port) => new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
        resolve(false);
    });

    server.once("listening", () => {
        server.close(() => resolve(true));
    });

    server.listen(port, "0.0.0.0");
});

const findAvailablePort = async (startPort, maxAttempts = 20) => {
    for (let offset = 0; offset <= maxAttempts; offset += 1) {
        const candidate = startPort + offset;
        // Probe ports first to avoid crashing with EADDRINUSE.
        // eslint-disable-next-line no-await-in-loop
        const available = await isPortAvailable(candidate);
        if (available) {
            return candidate;
        }
    }

    throw new Error(`No available port found between ${startPort} and ${startPort + maxAttempts}`);
};

const requestedPort = Number(process.env.PORT) || 8080;
const port = await findAvailablePort(requestedPort);
if (port !== requestedPort) {
    console.warn(`Port ${requestedPort} is in use. Falling back to ${port}.`);
}

ViteExpress.listen(app, port, () => {
    console.log("Server is listening on: http://localhost:" + port);
});