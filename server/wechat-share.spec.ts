import { afterEach, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { buildWeChatSignature } from "./_core/wechat-share";

const originalEnv = {
  publicSiteUrl: process.env.PUBLIC_SITE_URL,
  wechatAppId: process.env.WECHAT_APP_ID,
  wechatAppSecret: process.env.WECHAT_APP_SECRET,
};

function restoreEnvVariable(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

function createContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

afterEach(() => {
  restoreEnvVariable("PUBLIC_SITE_URL", originalEnv.publicSiteUrl);
  restoreEnvVariable("WECHAT_APP_ID", originalEnv.wechatAppId);
  restoreEnvVariable("WECHAT_APP_SECRET", originalEnv.wechatAppSecret);
});

describe("wechat share helpers", () => {
  it("builds the expected SHA1 signature payload", () => {
    expect(
      buildWeChatSignature({
        jsApiTicket: "jsapi_ticket_value",
        nonceStr: "nonce1234",
        timestamp: 1710000000,
        url: "https://atlas.example.com/#/ignored-fragment",
      }),
    ).toBe("f578f4eee8ab7af3e47a45fff765cc3f70092606");
  });

  it("returns disabled share config when WeChat credentials are not configured", async () => {
    delete process.env.PUBLIC_SITE_URL;
    delete process.env.WECHAT_APP_ID;
    delete process.env.WECHAT_APP_SECRET;

    const caller = appRouter.createCaller(createContext());
    const result = await caller.wechat.shareConfig({
      url: "https://atlas.example.com/",
    });

    expect(result).toEqual({ enabled: false });
  });
});
