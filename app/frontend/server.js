import express from "express";
import request from 'request'; 
import ViteExpress from "vite-express";
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from "dotenv";

config();

const app = express();

const onProxyReqMiddleware = (proxyReq, req, res) => {
    // Add the X-API-Key header to the outgoing proxy request
    proxyReq.setHeader('X-API-Key', process.env.VITE_API_KEY);
};

app.use('/api/1.0/*', createProxyMiddleware({
    target: process.env.VITE_API_BACKEND,
    changeOrigin: true,
    onProxyReq: onProxyReqMiddleware,
}));

app.use(express.json()); // Parse JSON request bodies
app.post('/bookReservation', (req, res) => {
    const url = 'http://archibusapi-dev.hnfpejbvhhbqenhy.canadacentral.azurecontainer.io/api/v1/reservations/';
    const username = process.env.ARCHIBUS_API_USERNAME
    const password = process.env.ARCHIBUS_API_PASSWORD
  
    const base64Credentials = Buffer.from(username + ":" + password).toString('base64');
    
    const headers = {
        'Authorization': 'Basic ' + base64Credentials,
        'Content-Type': 'application/json',
    };

    request.post({
      url: url,
      headers: headers,
      body: JSON.stringify(req.body),
    }).pipe(res); 
});

ViteExpress.listen(app, (Number(process.env.PORT) || 8080), () => {
    console.log("Server is listening on: http://localhost:" + (Number(process.env.PORT) || 8080));
});