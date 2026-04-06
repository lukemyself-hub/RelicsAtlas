import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { buildStaticShareMetadata } from "./server/_core/share-metadata";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const shareMetadata = buildStaticShareMetadata({
    publicSiteUrl: env.VITE_PUBLIC_SITE_URL || env.PUBLIC_SITE_URL,
    shareAssetVersion: env.VITE_SHARE_ASSET_VERSION || env.SHARE_ASSET_VERSION,
  });

  return {
    plugins: [
      react(),
      tailwindcss(),
      jsxLocPlugin(),
      {
        name: "share-meta-html-transform",
        transformIndexHtml(html) {
          return html
            .replaceAll("__CANONICAL_URL__", shareMetadata.canonicalUrl)
            .replaceAll("__OG_IMAGE_URL__", shareMetadata.ogImageUrl)
            .replaceAll("__TWITTER_IMAGE_URL__", shareMetadata.twitterImageUrl);
        },
      },
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "client", "src"),
        "@shared": path.resolve(__dirname, "shared"),
        "@assets": path.resolve(__dirname, "attached_assets"),
      },
    },
    envDir: path.resolve(__dirname),
    root: path.resolve(__dirname, "client"),
    publicDir: path.resolve(__dirname, "client", "public"),
    build: {
      outDir: path.resolve(__dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      host: true,
      allowedHosts: true,
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
