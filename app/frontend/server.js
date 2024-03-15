import express from "express";
import ViteExpress from "vite-express";
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from "dotenv";

config();

const app = express();

const onProxyReqMiddleware = (proxyReq, req, res) => {
    // Add the X-API-Key header to the outgoing proxy request
    proxyReq.setHeader('X-API-Key', process.env.VITE_API_KEY);
};

app.use('/api/1.0/completion/*', createProxyMiddleware({
    target: process.env.VITE_API_BACKEND,
    changeOrigin: true,
    onProxyReq: onProxyReqMiddleware,
}));

ViteExpress.listen(app, (Number(process.env.PORT) | 8080), () => console.log("Server is listening on: http://localhost:" + (Number(process.env.PORT) | 8080)));