export const ENV = {
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  get publicSiteUrl() {
    return process.env.PUBLIC_SITE_URL?.trim() ?? "";
  },
  get shareAssetVersion() {
    return process.env.SHARE_ASSET_VERSION?.trim() ?? "";
  },
  get amapSecurityKey() {
    return process.env.AMAP_SECURITY_KEY ?? "";
  },
  get amapWebServiceKey() {
    return process.env.AMAP_WEB_SERVICE_KEY ?? "";
  },
  get arkApiKey() {
    return process.env.ARK_API_KEY ?? "";
  },
  get arkBaseUrl() {
    return (
      process.env.ARK_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/v3"
    );
  },
  get arkModel() {
    return process.env.ARK_MODEL ?? "";
  },
  get geminiApiKey() {
    return process.env.GEMINI_API_KEY ?? "";
  },
  get wechatAppId() {
    return process.env.WECHAT_APP_ID?.trim() ?? "";
  },
  get wechatAppSecret() {
    return process.env.WECHAT_APP_SECRET?.trim() ?? "";
  },
};
