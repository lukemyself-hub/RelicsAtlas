import type { FilterOptions, HeritageSite } from "@/types";

export const BATCH_ORDER = [
  "第一批",
  "第二批",
  "第三批",
  "第四批",
  "第五批",
  "第六批",
  "第七批",
  "第八批",
] as const;

export const DEFAULT_BATCHES = BATCH_ORDER.slice(0, 3);

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function buildFallbackIntroduction(site: HeritageSite) {
  const parts = [
    `${site.name}是${site.batch || "已公布"}全国重点文物保护单位，`,
    site.type ? `属于${site.type}类别，` : "",
    site.address ? `位于${site.address}，` : "",
    site.era ? `年代可追溯至${site.era}。` : "具有明确的历史文化价值。",
  ];

  const valueParts = [
    site.type ? `作为${site.type}类文保单位，` : "作为重要文物保护单位，",
    "它在区域历史、建筑工艺和文化传承方面具有较高研究与参观价值。",
  ];

  return `${parts.join("")}${valueParts.join("")}`;
}

export function buildFilterOptionsFromSites(sites: HeritageSite[]): FilterOptions {
  const typeSet = new Set<string>();
  const eraSet = new Set<string>();

  for (const site of sites) {
    if (site.type) typeSet.add(site.type);
    if (site.era) eraSet.add(site.era);
  }

  return {
    batches: [...BATCH_ORDER],
    types: Array.from(typeSet).sort((a, b) => a.localeCompare(b, "zh-CN")),
    eras: Array.from(eraSet).sort((a, b) => a.localeCompare(b, "zh-CN")),
  };
}
