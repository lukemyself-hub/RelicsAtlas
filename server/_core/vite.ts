import express, { type Express, type Request } from "express";
import fs from "fs";
import { type Server } from "http";
import path from "path";
import {
  createServer as createViteServer,
  type InlineConfig,
  type UserConfig,
} from "vite";
import viteConfig from "../../vite.config";
import { ENV } from "./env";
import { buildShareMetadata } from "./share-metadata";

const CANONICAL_URL_PLACEHOLDER = "__CANONICAL_URL__";
const OG_IMAGE_URL_PLACEHOLDER = "__OG_IMAGE_URL__";
const TWITTER_IMAGE_URL_PLACEHOLDER = "__TWITTER_IMAGE_URL__";

function shouldServeHtml(req: Request) {
  if (req.method !== "GET") {
    return false;
  }

  const accept = req.headers.accept ?? "";
  if (!accept.includes("text/html")) {
    return false;
  }

  const pathname = req.path || req.originalUrl || "";
  if (pathname.startsWith("/@vite/")) {
    return false;
  }

  return path.extname(pathname) === "";
}

function injectHeadMetadata(template: string, req: Request) {
  const shareMetadata = buildShareMetadata({
    req,
    publicSiteUrl: ENV.publicSiteUrl,
    shareAssetVersion: ENV.shareAssetVersion,
  });

  return template
    .replaceAll(CANONICAL_URL_PLACEHOLDER, shareMetadata.canonicalUrl)
    .replaceAll(OG_IMAGE_URL_PLACEHOLDER, shareMetadata.ogImageUrl)
    .replaceAll(TWITTER_IMAGE_URL_PLACEHOLDER, shareMetadata.twitterImageUrl);
}

async function resolveInlineViteConfig(): Promise<UserConfig> {
  if (typeof viteConfig === "function") {
    return await viteConfig({
      command: "serve",
      mode: "development",
      isSsrBuild: false,
      isPreview: false,
    });
  }

  return viteConfig;
}

export async function setupVite(app: Express, server: Server) {
  const resolvedViteConfig = await resolveInlineViteConfig();
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const viteServerConfig: InlineConfig = {
    ...resolvedViteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  };

  const vite = await createViteServer(viteServerConfig);

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    if (!shouldServeHtml(req)) {
      next();
      return;
    }

    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = injectHeadMetadata(template, req);
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath, { index: false }));

  // fall through to index.html if the file doesn't exist
  app.get("*", async (req, res, next) => {
    try {
      const template = await fs.promises.readFile(
        path.resolve(distPath, "index.html"),
        "utf-8",
      );
      res
        .status(200)
        .set({ "Content-Type": "text/html" })
        .end(injectHeadMetadata(template, req));
    } catch (error) {
      next(error);
    }
  });
}
