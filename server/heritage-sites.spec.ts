import { describe, expect, it } from "vitest";
import { normalizeHeritageSites } from "../shared/heritage-sites";

describe("normalizeHeritageSites", () => {
  it("assigns stable runtime ids while preserving original ids", () => {
    const sites = [
      {
        id: 72,
        name: "六和塔",
        era: "南宋",
        address: "浙江省杭州市",
        type: "古建筑",
        batch: "第一批",
        longitude: 120.129549700125,
        latitude: 30.1986521823546,
      },
      {
        id: 72,
        name: "卓克基土司官寨",
        era: "清",
        address: "四川省马尔康县",
        type: "古建筑",
        batch: "第三批",
        longitude: 102.29063434425,
        latitude: 31.8677064145739,
      },
    ];

    const normalized = normalizeHeritageSites(sites);

    expect(normalized[0].id).toBe(1);
    expect(normalized[1].id).toBe(2);
    expect(normalized[0].originalId).toBe(72);
    expect(normalized[1].originalId).toBe(72);
  });

  it("is deterministic for the same input order", () => {
    const sites = [
      {
        id: 5,
        name: "A",
        longitude: 100,
        latitude: 30,
      },
      {
        id: 5,
        name: "B",
        longitude: 101,
        latitude: 31,
      },
    ];

    expect(normalizeHeritageSites(sites)).toEqual(normalizeHeritageSites(sites));
  });
});
