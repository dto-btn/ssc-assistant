import express from "express";
import ViteExpress from "vite-express";
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from "dotenv";

config();

const app = express();

const blobStorageUrl = process.env.VITE_BLOB_STORAGE_URL; // Base URL for the blob storage
const sasToken = process.env.VITE_SAS_TOKEN; // The SAS token with all query parameters

const onProxyReqMiddleware = (proxyReq, req, res) => {
    // Add the X-API-Key header to the outgoing proxy request
    proxyReq.setHeader('X-API-Key', process.env.VITE_API_KEY);
};

app.use('/api/1.0/*', createProxyMiddleware({
    target: process.env.VITE_API_BACKEND,
    changeOrigin: true,
    onProxyReq: onProxyReqMiddleware,
}));

/**
 * Creates a route that proxies requests to the blob storage URL with the SAS token.
 * @returns Proxy middleware for blob storage routes
 */
const blobStorageProxyRoute = () => createProxyMiddleware({
    target: blobStorageUrl,
    changeOrigin: true,
    pathRewrite: (path) => {
        // Append the SAS token directly to the path
        return path + '?' + sasToken; // Append the SAS token as a query string
    },
});

app.use('/assistant-chat-files/*', blobStorageProxyRoute());
app.use('/pmcoe-(dev|sept-2025|latest)/*', blobStorageProxyRoute());

ViteExpress.listen(app, (Number(process.env.PORT) || 8080), () => {
    console.log("Server is listening on: http://localhost:" + (Number(process.env.PORT) || 8080));
});