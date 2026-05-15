/* eslint-env node */
import express from "express";
import ViteExpress from "vite-express";
import { createProxyMiddleware } from 'http-proxy-middleware';
import net from "node:net";
import { config } from "dotenv";

config();

const app = express();

const blobStorageUrl = process.env.VITE_BLOB_STORAGE_URL; // Base URL for the blob storage
const rawSasToken = process.env.VITE_SAS_TOKEN; // The SAS token with all query parameters
const sasToken = rawSasToken ? rawSasToken.replace(/^\?/, '') : '';

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
 * Creates a route that proxies requests to the blob storage URL with the SAS token.
 * @returns Proxy middleware for blob storage routes
 */
if (!blobStorageUrl) {
    console.warn("VITE_BLOB_STORAGE_URL is not defined. Blob previews will be unavailable.");
}

/**
 * Build a proxy middleware that appends the SAS token so previews do not expose secrets.
 */
const blobStorageProxyRoute = () => createProxyMiddleware({
    target: blobStorageUrl,
    changeOrigin: true,
    selfHandleResponse: false,
    onProxyReq: (proxyReq) => {
        if (sasToken) {
            const separator = proxyReq.path.includes('?') ? '&' : '?';
            proxyReq.path += separator + sasToken;
        }
    },
});

const blobStorageProxy = blobStorageUrl ? blobStorageProxyRoute() : null;

if (blobStorageProxy) {
    app.use('/assistant-chat-files/*', blobStorageProxy);
    app.use('/assistant-chat-files-v2/*', blobStorageProxy);
    app.use('/pmcoe-(dev|sept-2025|latest)/*', blobStorageProxy);
}

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