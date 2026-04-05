import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { ENV } from "./_core/env";

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

async function handleAMapProxy(req: express.Request, res: express.Response) {
  const targetUrl = new URL(`https://restapi.amap.com${req.path}`);
  const params = new URLSearchParams(req.query as Record<string, string>);
  params.set("jscode", ENV.amapSecurityKey);
  targetUrl.search = params.toString();

  try {
    const response = await fetch(targetUrl.toString());
    const contentType = response.headers.get("content-type") ?? "application/json";
    res.setHeader("Content-Type", contentType);
    res.status(response.status);
    res.send(await response.text());
  } catch {
    res.status(502).json({ error: "AMap proxy error" });
  }
}

// AMap security proxy - appends jscode server-side so it never reaches the client
app.use("/_AMapService", handleAMapProxy);
app.use("/api/index/_AMapService", handleAMapProxy);

// tRPC API
const trpcMiddleware = createExpressMiddleware({ router: appRouter, createContext });
app.use("/api/trpc", trpcMiddleware);
app.use("/api/index/api/trpc", trpcMiddleware);
app.use("/api/index/trpc", trpcMiddleware);

// Vercel serves dist/public/ as static assets via CDN — no serveStatic() needed here.
export default app;
