import { useEffect } from "react";
import { getWeChatSharePayload } from "@/lib/share";

type WeChatShareConfig = {
  debug?: boolean;
  appId: string;
  timestamp: number;
  nonceStr: string;
  signature: string;
  jsApiList: string[];
};

type WeChatShareData = {
  title: string;
  desc?: string;
  link: string;
  imgUrl: string;
};

type WeChatSdk = {
  config: (config: WeChatShareConfig) => void;
  ready: (callback: () => void) => void;
  error: (callback: (error: unknown) => void) => void;
  updateAppMessageShareData: (
    data: WeChatShareData & { success?: () => void },
  ) => void;
  updateTimelineShareData: (
    data: Omit<WeChatShareData, "desc"> & { success?: () => void },
  ) => void;
};

declare global {
  interface Window {
    wx?: WeChatSdk;
  }
}

let sdkPromise: Promise<WeChatSdk | null> | null = null;

async function fetchWeChatShareConfig(url: string) {
  const response = await fetch(
    `/api/wechat/share-config?url=${encodeURIComponent(url)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    return { enabled: false } as const;
  }

  return (await response.json()) as
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
}

function isWeChatBrowser() {
  return /MicroMessenger/i.test(window.navigator.userAgent);
}

function loadWeChatSdk() {
  if (window.wx) {
    return Promise.resolve(window.wx);
  }

  if (!sdkPromise) {
    sdkPromise = new Promise<WeChatSdk | null>((resolve) => {
      const script = document.createElement("script");
      script.src = "https://res.wx.qq.com/open/js/jweixin-1.6.0.js";
      script.async = true;
      script.onload = () => resolve(window.wx ?? null);
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });
  }

  return sdkPromise;
}

export function useWeChatShare() {
  useEffect(() => {
    if (typeof window === "undefined" || !isWeChatBrowser()) {
      return;
    }

    let cancelled = false;

    const setupWeChatShare = async () => {
      try {
        const pageUrl = window.location.href.split("#")[0];
        const shareConfig = await fetchWeChatShareConfig(pageUrl);

        if (!shareConfig.enabled || cancelled) {
          return;
        }

        const wx = await loadWeChatSdk();
        if (!wx || cancelled) {
          return;
        }

        wx.config({
          debug: false,
          appId: shareConfig.appId,
          timestamp: shareConfig.timestamp,
          nonceStr: shareConfig.nonceStr,
          signature: shareConfig.signature,
          jsApiList: ["updateAppMessageShareData", "updateTimelineShareData"],
        });

        const sharePayload = getWeChatSharePayload();

        wx.ready(() => {
          if (cancelled) {
            return;
          }

          wx.updateAppMessageShareData(sharePayload);
          wx.updateTimelineShareData({
            title: sharePayload.title,
            link: sharePayload.link,
            imgUrl: sharePayload.imgUrl,
          });
        });

        wx.error(() => {});
      } catch {
        // Share setup should never block the app when WeChat config is unavailable.
      }
    };

    void setupWeChatShare();

    return () => {
      cancelled = true;
    };
  }, []);
}
