/* eslint-env node */
import express from "express";
import ViteExpress from "vite-express";
import { createProxyMiddleware } from 'http-proxy-middleware';
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

ViteExpress.listen(app, (Number(process.env.PORT) || 8080), () => {
    console.log("Server is listening on: http://localhost:" + (Number(process.env.PORT) || 8080));
});