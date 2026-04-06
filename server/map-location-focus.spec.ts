import { describe, expect, it } from "vitest";
import { buildUserAreaFocusPlan } from "../shared/map-location-focus";

describe("buildUserAreaFocusPlan", () => {
  it("fits the user and nearby POIs when at least one site is within range", () => {
    const plan = buildUserAreaFocusPlan({
      userLocation: { lat: 39.9042, lng: 116.4074 },
      sites: [
        { id: 1, latitude: 39.9142, longitude: 116.4174 },
        { id: 2, latitude: 39.9242, longitude: 116.4274 },
        { id: 3, latitude: 31.2304, longitude: 121.4737 },
      ],
    });

    expect(plan.type).toBe("fit-bounds");
    expect(plan.nearbySiteIds).toEqual([1, 2]);
    if (plan.type === "fit-bounds") {
      expect(plan.minZoom).toBe(8);
      expect(plan.maxZoom).toBe(11);
      expect(plan.bounds.southWest[1]).toBeLessThan(39.9042);
      expect(plan.bounds.northEast[0]).toBeGreaterThan(116.4274);
    }
  });

  it("keeps a single nearby POI in the fit-bounds flow", () => {
    const plan = buildUserAreaFocusPlan({
      userLocation: { lat: 30.2741, lng: 120.1551 },
      sites: [{ id: 9, latitude: 30.2841, longitude: 120.1651 }],
    });

    expect(plan.type).toBe("fit-bounds");
    expect(plan.nearbySiteIds).toEqual([9]);
  });

  it("falls back to a city-level center zoom when no POI is nearby", () => {
    const plan = buildUserAreaFocusPlan({
      userLocation: { lat: 43.8256, lng: 87.6168 },
      sites: [{ id: 7, latitude: 31.2304, longitude: 121.4737 }],
    });

    expect(plan).toEqual({
      type: "center",
      center: { lat: 43.8256, lng: 87.6168 },
      zoom: 10,
      nearbySiteIds: [],
    });
  });

  it("respects the nearby site limit before building fit bounds", () => {
    const plan = buildUserAreaFocusPlan({
      userLocation: { lat: 39.9042, lng: 116.4074 },
      maxNearbySites: 2,
      sites: [
        { id: 1, latitude: 39.905, longitude: 116.408 },
        { id: 2, latitude: 39.906, longitude: 116.409 },
        { id: 3, latitude: 39.907, longitude: 116.41 },
      ],
    });

    expect(plan.nearbySiteIds).toEqual([1, 2]);
  });
});
