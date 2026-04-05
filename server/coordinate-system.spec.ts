import { describe, expect, it } from "vitest";
import { isInMainlandChina, wgs84ToGcj02 } from "@shared/coordinate-system";

describe("coordinate system helpers", () => {
  it("converts mainland China WGS84 coordinates into GCJ-02 display coordinates", () => {
    const result = wgs84ToGcj02(116.397389, 39.908722);

    expect(result.lng).toBeCloseTo(116.40363255334069, 6);
    expect(result.lat).toBeCloseTo(39.91012547567846, 6);
  });

  it("keeps coordinates outside mainland China unchanged", () => {
    const result = wgs84ToGcj02(72, 10);

    expect(result).toEqual({ lng: 72, lat: 10 });
  });

  it("only marks mainland China bounds as convertible", () => {
    expect(isInMainlandChina(121.4737, 31.2304)).toBe(true);
    expect(isInMainlandChina(135.2, 35)).toBe(false);
    expect(isInMainlandChina(121.4737, 54)).toBe(false);
  });
});
