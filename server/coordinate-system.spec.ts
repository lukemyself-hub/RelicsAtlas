import { describe, expect, it } from "vitest";
import { gcj02ToWgs84, isInMainlandChina, wgs84ToGcj02 } from "@shared/coordinate-system";

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

  it("round-trips GCJ-02 coordinates back to WGS84 within a tight tolerance", () => {
    const original = { lng: 116.397026, lat: 39.923058 };
    const gcj = wgs84ToGcj02(original.lng, original.lat);
    const roundTripped = gcj02ToWgs84(gcj.lng, gcj.lat);

    expect(roundTripped.lng).toBeCloseTo(original.lng, 5);
    expect(roundTripped.lat).toBeCloseTo(original.lat, 5);
  });

  it("only marks mainland China bounds as convertible", () => {
    expect(isInMainlandChina(121.4737, 31.2304)).toBe(true);
    expect(isInMainlandChina(135.2, 35)).toBe(false);
    expect(isInMainlandChina(121.4737, 54)).toBe(false);
  });
});
