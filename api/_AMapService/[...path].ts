import "dotenv/config";
import express from "express";
import { ENV } from "../../server/_core/env.ts";

const app = express();

app.use("/", async (req, res) => {
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
});

export default app;
