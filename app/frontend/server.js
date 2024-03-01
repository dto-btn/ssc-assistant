import express from "express";
import ViteExpress from "vite-express";
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from "dotenv";
import bodyParser from 'body-parser';
import { NextPlan } from "@mui/icons-material";
// import { MongoClient } from 'mongodb'
// import { ExpressAuth, getSession } from "@auth/express"
// import AzureADProvider from "@auth/express/providers/azure-ad"

config();

const app = express();

const onProxyReqMiddleware = (proxyReq, req, res) => {
    // Add the X-API-Key header to the outgoing proxy request
    proxyReq.setHeader('X-API-Key', process.env.VITE_API_KEY);
    // console.log('Headers sent:', proxyReq.getHeaders());
};

//https://authjs.dev/reference/express
// app.set('trust proxy', 1);
// app.use("/auth/*", ExpressAuth({ providers: [ AzureADProvider({
//     clientId: process.env.AZURE_AD_CLIENT_ID,
//     clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
//     tenantId: process.env.AZURE_AD_TENANT_ID
// }) ] }));

app.use('/api/1.0/completion/*', createProxyMiddleware({
    target: process.env.VITE_API_BACKEND,
    changeOrigin: true,
    onProxyReq: onProxyReqMiddleware,
}));

// export async function authSession(req, res, next) {
//     res.locals.session = await getSession(req)
//     next()
//   }
  
// app.use(authSession)

// Session check endpoint
// app.get('/api/session', async (req, res) => {
//     const session = await getSession({ req });
//     if (session) {
//       res.json({ isLoggedIn: true, user: session.user });
//     } else {
//       res.json({ isLoggedIn: false });
//     }
// });

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

ViteExpress.listen(app, (Number(process.env.PORT) | 8080), () => console.log("Server is listening on: http://localhost:" + (Number(process.env.PORT) | 8080)));