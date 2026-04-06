import type { Request } from "express";

type ShareMetadataOptions = {
  req: Request;
  publicSiteUrl?: string;
  shareAssetVersion?: string;
};

type StaticShareMetadataOptions = {
  publicSiteUrl?: string;
  shareAssetVersion?: string;
  fallbackSiteUrl?: string;
};

export type ShareMetadata = {
  canonicalUrl: string;
  ogImageUrl: string;
  twitterImageUrl: string;
};

const WECHAT_SHARE_IMAGE_PATH = "/wechat-share.png";
const TWITTER_SHARE_IMAGE_PATH = "/og-cover.png";
export const DEFAULT_PUBLIC_SITE_URL = "https://www.wenbaoditu.top/";

export function getRequestOrigin(req: Request) {
  const forwardedProto = req.header("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = req.header("x-forwarded-host")?.split(",")[0]?.trim();
  const protocol = forwardedProto || req.protocol;
  const host = forwardedHost || req.get("host");

  return host ? `${protocol}://${host}` : "";
}

export function normalizeSiteUrl(url: string) {
  if (!url.trim()) {
    throw new Error("Share site URL is required");
  }

  const normalized = new URL(url.trim());
  normalized.search = "";
  normalized.hash = "";
  normalized.pathname = "/";
  return normalized.toString();
}

export function appendVersionParam(url: string, version?: string) {
  const trimmedVersion = version?.trim();
  if (!trimmedVersion) {
    return url;
  }

  const resolvedUrl = new URL(url);
  resolvedUrl.searchParams.set("v", trimmedVersion);
  return resolvedUrl.toString();
}

export function buildStaticShareMetadata({
  publicSiteUrl,
  shareAssetVersion,
  fallbackSiteUrl = DEFAULT_PUBLIC_SITE_URL,
}: StaticShareMetadataOptions): ShareMetadata {
  const siteUrl = normalizeSiteUrl(publicSiteUrl?.trim() || fallbackSiteUrl);

  return {
    canonicalUrl: siteUrl,
    ogImageUrl: appendVersionParam(
      new URL(WECHAT_SHARE_IMAGE_PATH, siteUrl).toString(),
      shareAssetVersion,
    ),
    twitterImageUrl: appendVersionParam(
      new URL(TWITTER_SHARE_IMAGE_PATH, siteUrl).toString(),
      shareAssetVersion,
    ),
  };
}

export function buildShareMetadata({
  req,
  publicSiteUrl,
  shareAssetVersion,
}: ShareMetadataOptions): ShareMetadata {
  const fallbackOrigin = getRequestOrigin(req);
  return buildStaticShareMetadata({
    publicSiteUrl,
    shareAssetVersion,
    fallbackSiteUrl: fallbackOrigin,
  });
}
