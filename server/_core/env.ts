export const ENV = {
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  get amapSecurityKey() {
    return process.env.AMAP_SECURITY_KEY ?? "";
  },
  get arkApiKey() {
    return process.env.ARK_API_KEY ?? "";
  },
  get arkBaseUrl() {
    return process.env.ARK_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/v3";
  },
  get arkModel() {
    return process.env.ARK_MODEL ?? "";
  },
  get geminiApiKey() {
    return process.env.GEMINI_API_KEY ?? "";
  },
};
