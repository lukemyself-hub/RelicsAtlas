export const ENV = {
  isProduction: process.env.NODE_ENV === "production",
  amapSecurityKey: process.env.AMAP_SECURITY_KEY ?? "",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
};
