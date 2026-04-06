import { createHash, randomBytes } from "node:crypto";
import { ENV } from "./env";

type WeChatAccessTokenResponse = {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
};

type WeChatJsApiTicketResponse = {
  ticket?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
};

type CachedValue = {
  value: string;
  expiresAt: number;
};

export type WeChatShareConfigResult =
  | {
      enabled: true;
      appId: string;
      timestamp: number;
      nonceStr: string;
      signature: string;
    }
  | {
      enabled: false;
    };

const CACHE_EARLY_REFRESH_MS = 5 * 60 * 1000;

let accessTokenCache: CachedValue | null = null;
let accessTokenPromise: Promise<string> | null = null;
let jsApiTicketCache: CachedValue | null = null;
let jsApiTicketPromise: Promise<string> | null = null;

function isCacheValid(cache: CachedValue | null) {
  return Boolean(cache && cache.expiresAt > Date.now());
}

function buildCachedValue({
  value,
  expiresInSeconds,
  errcode,
  errmsg,
}: {
  value?: string;
  expiresInSeconds?: number;
  errcode?: number;
  errmsg?: string;
}) {
  if (!value || !expiresInSeconds || errcode) {
    throw new Error(
      `WeChat API error: ${errcode ?? "unknown"} ${errmsg ?? "missing response value"}`,
    );
  }

  return {
    value,
    expiresAt:
      Date.now() +
      Math.max(expiresInSeconds * 1000 - CACHE_EARLY_REFRESH_MS, 1000),
  };
}

async function fetchWeChatJson<T>(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `WeChat API request failed: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as T;
}

async function getAccessToken() {
  if (isCacheValid(accessTokenCache)) {
    return accessTokenCache!.value;
  }

  if (!accessTokenPromise) {
    accessTokenPromise = (async () => {
      const response = await fetchWeChatJson<WeChatAccessTokenResponse>(
        `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(
          ENV.wechatAppId,
        )}&secret=${encodeURIComponent(ENV.wechatAppSecret)}`,
      );

      const cachedValue = buildCachedValue({
        value: response.access_token,
        expiresInSeconds: response.expires_in,
        errcode: response.errcode,
        errmsg: response.errmsg,
      });
      accessTokenCache = cachedValue;
      return cachedValue.value;
    })().finally(() => {
      accessTokenPromise = null;
    });
  }

  return await accessTokenPromise;
}

async function getJsApiTicket() {
  if (isCacheValid(jsApiTicketCache)) {
    return jsApiTicketCache!.value;
  }

  if (!jsApiTicketPromise) {
    jsApiTicketPromise = (async () => {
      const accessToken = await getAccessToken();
      const response = await fetchWeChatJson<WeChatJsApiTicketResponse>(
        `https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${encodeURIComponent(
          accessToken,
        )}&type=jsapi`,
      );

      const cachedValue = buildCachedValue({
        value: response.ticket,
        expiresInSeconds: response.expires_in,
        errcode: response.errcode,
        errmsg: response.errmsg,
      });
      jsApiTicketCache = cachedValue;
      return cachedValue.value;
    })().finally(() => {
      jsApiTicketPromise = null;
    });
  }

  return await jsApiTicketPromise;
}

export function normalizeWeChatShareUrl(url: string) {
  const resolvedUrl = new URL(url);
  resolvedUrl.hash = "";
  return resolvedUrl.toString();
}

export function buildWeChatSignature({
  jsApiTicket,
  nonceStr,
  timestamp,
  url,
}: {
  jsApiTicket: string;
  nonceStr: string;
  timestamp: number;
  url: string;
}) {
  const payload = `jsapi_ticket=${jsApiTicket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${normalizeWeChatShareUrl(
    url,
  )}`;

  return createHash("sha1").update(payload).digest("hex");
}

function isAllowedShareUrl(url: string) {
  if (!ENV.publicSiteUrl) {
    return false;
  }

  const allowedOrigin = new URL(ENV.publicSiteUrl).origin;
  return new URL(normalizeWeChatShareUrl(url)).origin === allowedOrigin;
}

export async function getWeChatShareConfig(
  url: string,
): Promise<WeChatShareConfigResult> {
  if (!ENV.wechatAppId || !ENV.wechatAppSecret || !ENV.publicSiteUrl) {
    return { enabled: false };
  }

  if (!isAllowedShareUrl(url)) {
    return { enabled: false };
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonceStr = randomBytes(8).toString("hex");
    const jsApiTicket = await getJsApiTicket();

    return {
      enabled: true,
      appId: ENV.wechatAppId,
      timestamp,
      nonceStr,
      signature: buildWeChatSignature({
        jsApiTicket,
        nonceStr,
        timestamp,
        url,
      }),
    };
  } catch (error) {
    console.error("[wechat.shareConfig]", error);
    return { enabled: false };
  }
}
