import "dotenv/config";
import express from "express";
import { getWeChatShareConfig } from "../../server/_core/wechat-share";

const app = express();

app.get("/", async (req, res) => {
  const url = typeof req.query.url === "string" ? req.query.url : "";

  if (!url) {
    res.status(400).json({ enabled: false });
    return;
  }

  const result = await getWeChatShareConfig(url);
  res.status(200).json(result);
});

export default app;
