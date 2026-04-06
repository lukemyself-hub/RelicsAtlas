import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { wgs84ToGcj02 } from "@shared/coordinate-system";
import type { RawHeritageSite } from "@shared/heritage-sites";
import {
  getHighConfidenceNameMatchKind,
  isHighConfidenceNameMatch,
  renderSiteCoordinateOverridesSource,
  resolveCoordinateSyncForSite,
  sortSitesForCoordinateSync,
  type AMapPoiCandidate,
} from "@shared/site-coordinate-sync";
import { buildSiteCoordinateOverrideKey } from "@shared/site-coordinate-overrides";
import { runSiteCoordinateOverrideSync } from "../scripts/sync-site-coordinate-overrides";

function toPoiCandidate(siteName: string, wgsLongitude: number, wgsLatitude: number, overrides?: Partial<AMapPoiCandidate>) {
  const gcj = wgs84ToGcj02(wgsLongitude, wgsLatitude);
  return {
    id: overrides?.id ?? `${siteName}-poi`,
    name: siteName,
    location: `${gcj.lng},${gcj.lat}`,
    pname: overrides?.pname ?? "北京市",
    cityname: overrides?.cityname ?? "北京市",
    adname: overrides?.adname ?? "东城区",
    address: overrides?.address ?? "景山前街4号",
  } satisfies AMapPoiCandidate;
}

describe("site coordinate sync helpers", () => {
  it("sorts sites by batch order and preserves original order within a batch", () => {
    const sorted = sortSitesForCoordinateSync<RawHeritageSite>([
      { id: 1, name: "第五批A", batch: "第五批", longitude: 1, latitude: 1 },
      { id: 2, name: "第一批A", batch: "第一批", longitude: 1, latitude: 1 },
      { id: 3, name: "第一批B", batch: "第一批", longitude: 1, latitude: 1 },
      { id: 4, name: "未知批次", batch: null, longitude: 1, latitude: 1 },
    ]);

    expect(sorted.map((site) => site.name)).toEqual(["第一批A", "第一批B", "第五批A", "未知批次"]);
  });

  it("applies a high-confidence candidate and converts it back to WGS84", () => {
    const site: RawHeritageSite = {
      id: 100,
      name: "故宫",
      batch: "第一批",
      address: "北京市东城区",
      longitude: 116.389613749128,
      latitude: 39.9218620254633,
    };
    const resolution = resolveCoordinateSyncForSite({
      site,
      primaryCandidates: [
        toPoiCandidate("故宫", 116.397026, 39.923058),
        toPoiCandidate("景山公园", 116.3962, 39.9274, { id: "other-poi" }),
      ],
      updatedAt: "2026-04-06T00:00:00.000Z",
    });

    expect(resolution.status).toBe("applied");
    expect(resolution.override?.longitude).toBeCloseTo(116.397026, 4);
    expect(resolution.override?.latitude).toBeCloseTo(39.923058, 4);
    expect(resolution.override?.source).toBe("amap-poi-v5");
    expect(resolution.override?.sourcePoiId).toBe("故宫-poi");
    expect(resolution.reason).toContain("strict name match");
  });

  it("treats common AMap institution suffixes as high-confidence aliases", () => {
    expect(isHighConfidenceNameMatch("故宫", "故宫博物院")).toBe(true);
    expect(isHighConfidenceNameMatch("圆明园遗址", "圆明园遗址公园")).toBe(true);
    expect(isHighConfidenceNameMatch("颐和园", "颐和园")).toBe(true);
    expect(isHighConfidenceNameMatch("故宫", "景山公园")).toBe(false);
    expect(getHighConfidenceNameMatchKind("故宫", "故宫博物院")).toBe("alias");
    expect(getHighConfidenceNameMatchKind("颐和园", "颐和园")).toBe("strict");
  });

  it("applies aliases like 故宫博物院 when the rest of the checks still pass", () => {
    const site: RawHeritageSite = {
      id: 100,
      name: "故宫",
      batch: "第一批",
      address: "北京市东城区",
      longitude: 116.389613749128,
      latitude: 39.9218620254633,
    };
    const gcj = wgs84ToGcj02(116.397026, 39.923058);
    const resolution = resolveCoordinateSyncForSite({
      site,
      primaryCandidates: [
        {
          id: "B000A8UIN8",
          name: "故宫博物院",
          location: `${gcj.lng},${gcj.lat}`,
          address: "景山前街4号",
          pname: "北京市",
          cityname: "北京市",
          adname: "东城区",
        },
      ],
      updatedAt: "2026-04-06T00:00:00.000Z",
    });

    expect(resolution.status).toBe("applied");
    expect(resolution.override?.sourcePoiId).toBe("B000A8UIN8");
    expect(resolution.reason).toContain("safe alias match");
  });

  it("allows a strict top candidate even when the second primary candidate is also qualified", () => {
    const site: RawHeritageSite = {
      id: 122,
      name: "颐和园",
      batch: "第一批",
      address: "北京市海淀区",
      longitude: 116.250758076942,
      latitude: 39.9843113716556,
    };
    const primaryCandidates: AMapPoiCandidate[] = [
      toPoiCandidate("颐和园", 116.274870, 39.999580, {
        id: "yiheyuan-top",
        adname: "海淀区",
        address: "新建宫门路19号",
      }),
      toPoiCandidate("颐和园", 116.273900, 39.998900, {
        id: "yiheyuan-second",
        adname: "海淀区",
        address: "颐和园路",
      }),
    ];

    const resolution = resolveCoordinateSyncForSite({
      site,
      primaryCandidates,
      updatedAt: "2026-04-06T00:00:00.000Z",
    });

    expect(resolution.status).toBe("applied");
    expect(resolution.override?.sourcePoiId).toBe("yiheyuan-top");
    expect(resolution.reason).toContain("strict name match");
  });

  it("marks exact-name candidates with mismatched districts for review", () => {
    const site: RawHeritageSite = {
      id: 122,
      name: "颐和园",
      batch: "第一批",
      address: "北京市海淀区",
      longitude: 116.250758076942,
      latitude: 39.9843113716556,
    };
    const resolution = resolveCoordinateSyncForSite({
      site,
      primaryCandidates: [
        toPoiCandidate("颐和园", 116.273, 39.999, {
          id: "yiheyuan-mismatch",
          adname: "朝阳区",
          address: "北京市朝阳区模拟地址",
        }),
      ],
      updatedAt: "2026-04-06T00:00:00.000Z",
    });

    expect(resolution.status).toBe("review");
    expect(resolution.override).toBeNull();
  });

  it("skips overrides when the candidate is already within 200 meters", () => {
    const site: RawHeritageSite = {
      id: 100,
      name: "故宫",
      batch: "第一批",
      address: "北京市",
      longitude: 116.389613749128,
      latitude: 39.9218620254633,
    };
    const currentDisplay = wgs84ToGcj02(site.longitude, site.latitude);
    const resolution = resolveCoordinateSyncForSite({
      site,
      primaryCandidates: [
        {
          id: "same-point",
          name: "故宫",
          location: `${currentDisplay.lng},${currentDisplay.lat}`,
          pname: "北京市",
          cityname: "北京市",
          adname: "东城区",
          address: "北京市东城区",
        },
      ],
      updatedAt: "2026-04-06T00:00:00.000Z",
    });

    expect(resolution.status).toBe("skipped");
    expect(resolution.override).toBeNull();
  });

  it("flags far-away high-confidence candidates for review", () => {
    const site: RawHeritageSite = {
      id: 100,
      name: "故宫",
      batch: "第一批",
      address: "北京市",
      longitude: 116.389613749128,
      latitude: 39.9218620254633,
    };
    const resolution = resolveCoordinateSyncForSite({
      site,
      primaryCandidates: [toPoiCandidate("故宫", 116.6101, 40.2205, { id: "far-away-poi" })],
      updatedAt: "2026-04-06T00:00:00.000Z",
    });

    expect(resolution.status).toBe("review");
    expect(resolution.override).toBeNull();
  });

  it("renders override source deterministically without mutating input data", () => {
    const site: RawHeritageSite = {
      id: 100,
      name: "故宫",
      batch: "第一批",
      longitude: 116.389613749128,
      latitude: 39.9218620254633,
    };
    const originalLongitude = site.longitude;
    const key = buildSiteCoordinateOverrideKey({
      id: site.id,
      name: site.name,
      batch: site.batch ?? null,
    });
    const overrides = {
      [key]: {
        longitude: 116.397026,
        latitude: 39.923058,
        source: "amap-poi-v5" as const,
        sourcePoiId: "B000A8UIN8",
        confidence: "high" as const,
        updatedAt: "2026-04-06T00:00:00.000Z",
        note: "High-confidence sync from AMap POI v5 (故宫).",
      },
    };

    const firstRender = renderSiteCoordinateOverridesSource({
      overrides,
      sites: [site],
    });
    const secondRender = renderSiteCoordinateOverridesSource({
      overrides,
      sites: [site],
    });

    expect(firstRender).toBe(secondRender);
    expect(site.longitude).toBe(originalLongitude);
  });
});

describe("runSiteCoordinateOverrideSync", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true }))
    );
  });

  it("writes reports and override source in batch order and remains idempotent", async () => {
    const sites: RawHeritageSite[] = [
      {
        id: 195,
        name: "潭柘寺",
        batch: "第五批",
        address: "北京市门头沟区",
        longitude: 116.048540267795,
        latitude: 39.87555404388,
      },
      {
        id: 122,
        name: "颐和园",
        batch: "第一批",
        address: "北京市海淀区",
        longitude: 116.250758076942,
        latitude: 39.9843113716556,
      },
      {
        id: 100,
        name: "故宫",
        batch: "第一批",
        address: "北京市东城区",
        longitude: 116.389613749128,
        latitude: 39.9218620254633,
      },
    ];
    const originalSnapshot = JSON.parse(JSON.stringify(sites));
    const poiByName: Record<string, AMapPoiCandidate> = {
      颐和园: toPoiCandidate("颐和园", 116.274870, 39.999580, {
        id: "yiheyuan-poi",
        adname: "海淀区",
        address: "北京市海淀区新建宫门路19号",
      }),
      故宫: toPoiCandidate("故宫", 116.397026, 39.923058, {
        id: "gugong-poi",
        adname: "东城区",
        address: "北京市东城区景山前街4号",
      }),
      潭柘寺: toPoiCandidate("潭柘寺", 116.030610, 39.910790, {
        id: "tanzhesi-poi",
        adname: "门头沟区",
        address: "北京市门头沟区潭柘寺镇",
      }),
    };
    const requestedKeywords: string[] = [];
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
      const keywords = url.searchParams.get("keywords") ?? "";
      requestedKeywords.push(keywords);
      const baseName = keywords.split(" ")[0];
      const candidate = poiByName[baseName];

      return new Response(
        JSON.stringify({
          status: "1",
          info: "OK",
          pois: candidate ? [candidate] : [],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }
      );
    });

    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "site-coordinate-sync-"));
    temporaryDirectories.push(tempDirectory);
    const overridesPath = path.join(tempDirectory, "site-coordinate-overrides.ts");
    const reportPath = path.join(tempDirectory, "site-coordinate-sync.json");

    const firstRun = await runSiteCoordinateOverrideSync({
      apiKey: "test-api-key",
      write: true,
      fetchFn: fetchMock,
      now: new Date("2026-04-06T00:00:00.000Z"),
      overridesPath,
      reportPath,
      sites,
      currentOverrides: {},
      logger: {
        log: () => undefined,
        error: () => undefined,
      },
    });

    const secondRun = await runSiteCoordinateOverrideSync({
      apiKey: "test-api-key",
      write: true,
      fetchFn: fetchMock,
      now: new Date("2026-04-06T00:00:00.000Z"),
      overridesPath,
      reportPath,
      sites,
      currentOverrides: firstRun.nextOverrides,
      logger: {
        log: () => undefined,
        error: () => undefined,
      },
    });

    const report = JSON.parse(await fs.readFile(reportPath, "utf8")) as {
      items: Array<{ siteKey: string; batchSequence: number | null; status: string }>;
    };
    const overridesSource = await fs.readFile(overridesPath, "utf8");
    const primaryQueries = requestedKeywords.filter((keyword) => !keyword.includes(" "));

    expect(primaryQueries.slice(0, 3)).toEqual(["颐和园", "故宫", "潭柘寺"]);
    expect(report.items.map((item) => item.batchSequence)).toEqual([1, 1, 5]);
    expect(report.items.every((item) => item.status === "applied")).toBe(true);
    expect(overridesSource.indexOf("颐和园")).toBeLessThan(overridesSource.indexOf("潭柘寺"));
    expect(await fs.readFile(overridesPath, "utf8")).toBe(
      renderSiteCoordinateOverridesSource({
        overrides: secondRun.nextOverrides,
        sites,
      })
    );
    expect(sites).toEqual(originalSnapshot);
  });
});
