import express from "express";
import ViteExpress from "vite-express";
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from "dotenv";
import bodyParser from 'body-parser';
import { NextPlan } from "@mui/icons-material";
// import { MongoClient } from 'mongodb'

config();

const app = express();

const onProxyReqMiddleware = (proxyReq, req, res) => {
    // Add the X-API-Key header to the outgoing proxy request
    proxyReq.setHeader('X-API-Key', process.env.VITE_API_KEY);
    // console.log('Headers sent:', proxyReq.getHeaders());
};

app.use('/api/1.0/completion/*', createProxyMiddleware({
    target: process.env.VITE_API_BACKEND,
    changeOrigin: true,
    onProxyReq: onProxyReqMiddleware,
}));

// const client = await MongoClient.connect(process.env.DB_CONN);
// const db = client.db("chatbot");

// app.post('/feedback', bodyParser.json(), async (req, res) => {
//     try {
//         const result = await db.collection('feedback').insertOne(req.body);
//         res.send("Saved successfully!")
//     } catch (e) {
//         throw e;
//     }
// });

ViteExpress.listen(app, (process.env.PORT | '8080'), () => console.log("Server is listening on: http://localhost:" + (process.env.PORT | '8080')));