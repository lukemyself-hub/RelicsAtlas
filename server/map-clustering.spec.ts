import { describe, expect, it } from "vitest";
import {
  buildRenderNodes,
  clampZoomLevel,
  clusterProjectedSites,
  getClusterFocusBounds,
  getDynamicClusterRadius,
  matchTransitionSources,
  projectVisibleSites,
  resolveClusterExpansionZoom,
} from "../shared/map-clustering";

describe("map clustering helpers", () => {
  it("computes a radius that adapts to viewport size and stays clamped", () => {
    expect(getDynamicClusterRadius({ width: 320, height: 568 })).toBe(44);
    expect(getDynamicClusterRadius({ width: 1024, height: 768 })).toBeCloseTo(80);
    expect(getDynamicClusterRadius({ width: 430, height: 932 })).toBeCloseTo(51.6);
  });

  it("only projects points inside the current viewport", () => {
    const sites = [
      { id: 1, latitude: 30.1986, longitude: 120.1295 },
      { id: 2, latitude: 30.2086, longitude: 120.1495 },
      { id: 3, latitude: 43.7931, longitude: 87.6288 },
    ];

    const projected = projectVisibleSites(sites, { width: 400, height: 800 }, (site) => {
      if (site.id === 1) return { x: 120, y: 180 };
      if (site.id === 2) return { x: 168, y: 228 };
      return { x: 520, y: 900 };
    });

    expect(projected.map((entry) => entry.site.id)).toEqual([1, 2]);
  });

  it("clusters same-area points and returns safe padded focus bounds", () => {
    const sites = [
      { id: 1, latitude: 30.1986, longitude: 120.1295 },
      { id: 2, latitude: 30.1991, longitude: 120.1302 },
    ];

    const clusters = clusterProjectedSites(
      [
        { site: sites[0], point: { x: 120, y: 180 } },
        { site: sites[1], point: { x: 130, y: 188 } },
      ],
      44,
      (point) => ({
        lng: 120 + point.x / 1000,
        lat: 30 + point.y / 1000,
      })
    );
    const focusBounds = getClusterFocusBounds(sites);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].count).toBe(2);
    expect(clusters[0].point).toEqual({ x: 125, y: 184 });
    expect(focusBounds).not.toBeNull();
    expect(focusBounds!.southWest[0]).toBeLessThan(120.1295);
    expect(focusBounds!.northEast[0]).toBeGreaterThan(120.1302);
  });

  it("keeps a single-site node anchored to the site coordinates", () => {
    const site = { id: 1, latitude: 39.923058, longitude: 116.397026 };

    const [cluster] = clusterProjectedSites(
      [{ site, point: { x: 240.5, y: 180.25 } }],
      44,
      () => ({
        lng: 0,
        lat: 0,
      })
    );
    const [node] = buildRenderNodes([cluster]);

    expect(cluster.lng).toBeCloseTo(site.longitude, 12);
    expect(cluster.lat).toBeCloseTo(site.latitude, 12);
    expect(node.anchorLng).toBeCloseTo(site.longitude, 12);
    expect(node.anchorLat).toBeCloseTo(site.latitude, 12);
  });

  it("prefers the parent cluster as the transition source for split nodes", () => {
    const prevNodes = buildRenderNodes([
      {
        sites: [
          { id: 1, latitude: 30.1, longitude: 120.1 },
          { id: 2, latitude: 30.2, longitude: 120.2 },
        ],
        count: 2,
        lat: 30.15,
        lng: 120.15,
        anchorLat: 30.15,
        anchorLng: 120.15,
        point: { x: 140, y: 220 },
      },
    ]);

    const nextNodes = buildRenderNodes([
      {
        sites: [{ id: 1, latitude: 30.1, longitude: 120.1 }],
        count: 1,
        lat: 30.1,
        lng: 120.1,
        anchorLat: 30.1,
        anchorLng: 120.1,
        point: { x: 120, y: 200 },
      },
      {
        sites: [{ id: 2, latitude: 30.2, longitude: 120.2 }],
        count: 1,
        lat: 30.2,
        lng: 120.2,
        anchorLat: 30.2,
        anchorLng: 120.2,
        point: { x: 160, y: 240 },
      },
    ]);

    const matched = matchTransitionSources(prevNodes, nextNodes);

    expect(matched[0].sourceKey).toBe(prevNodes[0].key);
    expect(matched[1].sourceKey).toBe(prevNodes[0].key);
  });

  it("keeps expanding cluster zoom until the map reaches its real max zoom", () => {
    expect(resolveClusterExpansionZoom(12, 12, 20)).toBe(14);
    expect(resolveClusterExpansionZoom(12, 15, 20)).toBe(15);
    expect(resolveClusterExpansionZoom(19, 19, 20)).toBe(20);
    expect(resolveClusterExpansionZoom(20, 20, 20)).toBe(20);
  });

  it("clamps all programmatic zoom targets to the POI-visible range", () => {
    const minZoom = 3;
    const maxZoom = 18;

    expect(clampZoomLevel(21, minZoom, maxZoom)).toBe(18);
    expect(clampZoomLevel(18, minZoom, maxZoom)).toBe(18);
    expect(clampZoomLevel(12, minZoom, maxZoom)).toBe(12);
    expect(clampZoomLevel(1, minZoom, maxZoom)).toBe(3);
  });
});
