import { describe, expect, it } from "vitest";
import { wgs84ToGcj02 } from "@shared/coordinate-system";
import { buildNavigationUrl } from "@/lib/navigation";

describe("buildNavigationUrl", () => {
  it("uses Apple Maps directions on iOS instead of a search-style pin URL", () => {
    const url = buildNavigationUrl({
      name: "故宫",
      latitude: 39.923058,
      longitude: 116.397026,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15",
    });

    const parsed = new URL(url);

    expect(parsed.origin).toBe("https://maps.apple.com");
    expect(parsed.searchParams.get("dirflg")).toBe("d");
    expect(parsed.searchParams.get("q")).toBeNull();
    expect(parsed.searchParams.get("ll")).toBeNull();
  });

  it("translates mainland China Apple Maps destinations to GCJ-02", () => {
    const wgsLongitude = 116.397026;
    const wgsLatitude = 39.923058;
    const gcj = wgs84ToGcj02(wgsLongitude, wgsLatitude);

    const url = buildNavigationUrl({
      name: "故宫",
      latitude: wgsLatitude,
      longitude: wgsLongitude,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15",
    });

    const parsed = new URL(url);

    expect(parsed.searchParams.get("daddr")).toBe(`${gcj.lat},${gcj.lng}`);
  });

  it("keeps non-iOS navigation on AMap and marks the payload as WGS84", () => {
    const url = buildNavigationUrl({
      name: "故宫",
      latitude: 39.923058,
      longitude: 116.397026,
      userAgent:
        "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/135.0.0.0 Mobile Safari/537.36",
    });

    const parsed = new URL(url);

    expect(parsed.origin).toBe("https://uri.amap.com");
    expect(parsed.pathname).toBe("/navigation");
    expect(parsed.searchParams.get("coordinate")).toBe("wgs84");
    expect(parsed.searchParams.get("callnative")).toBe("1");
    expect(parsed.searchParams.get("to")).toBe("116.397026,39.923058,故宫");
  });
});
