import { describe, expect, it } from "vitest";
import type { Request } from "express";
import {
  appendVersionParam,
  buildShareMetadata,
  buildStaticShareMetadata,
  normalizeSiteUrl,
} from "./_core/share-metadata";

function createRequest(origin = "https://fallback.example.com") {
  const url = new URL(origin);
  return {
    protocol: url.protocol.replace(":", ""),
    header(name: string) {
      if (name.toLowerCase() === "x-forwarded-proto") {
        return null;
      }
      if (name.toLowerCase() === "x-forwarded-host") {
        return null;
      }
      return null;
    },
    get(name: string) {
      if (name.toLowerCase() === "host") {
        return url.host;
      }
      return undefined;
    },
  } as unknown as Request;
}

describe("share metadata helpers", () => {
  it("normalizes the site URL to the canonical root", () => {
    expect(normalizeSiteUrl("https://example.com/path?foo=bar#hash")).toBe(
      "https://example.com/",
    );
  });

  it("appends a cache-busting version parameter when configured", () => {
    expect(
      appendVersionParam("https://example.com/wechat-share.png", "20260406"),
    ).toBe("https://example.com/wechat-share.png?v=20260406");
  });

  it("prefers PUBLIC_SITE_URL and emits absolute OG/Twitter asset URLs", () => {
    const metadata = buildShareMetadata({
      req: createRequest("https://fallback.example.com"),
      publicSiteUrl: "https://atlas.example.com/some/path?foo=bar",
      shareAssetVersion: "42",
    });

    expect(metadata).toEqual({
      canonicalUrl: "https://atlas.example.com/",
      ogImageUrl: "https://atlas.example.com/wechat-share.png?v=42",
      twitterImageUrl: "https://atlas.example.com/og-cover.png?v=42",
    });
  });

  it("builds static share metadata with a production fallback URL", () => {
    const metadata = buildStaticShareMetadata({
      shareAssetVersion: "20260406",
    });

    expect(metadata).toEqual({
      canonicalUrl: "https://www.wenbaoditu.top/",
      ogImageUrl: "https://www.wenbaoditu.top/wechat-share.png?v=20260406",
      twitterImageUrl: "https://www.wenbaoditu.top/og-cover.png?v=20260406",
    });
  });
});
