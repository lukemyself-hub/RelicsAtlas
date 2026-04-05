import { BATCH_ORDER, DEFAULT_BATCHES, PREGENERATED_INTRO_BATCHES } from "@shared/const";
import { normalizeHeritageSites, type RawHeritageSite } from "@shared/heritage-sites";
import { buildSiteIntroductionKey } from "@shared/site-introductions";
import type { FilterOptions, HeritageSite, SiteIntroductionMap } from "@/types";

export { BATCH_ORDER, DEFAULT_BATCHES, PREGENERATED_INTRO_BATCHES };

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

export async function fetchNormalizedSites(url: string) {
  const sites = await fetchJson<RawHeritageSite[]>(url);
  return normalizeHeritageSites(sites) as HeritageSite[];
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

export function isPreGeneratedIntroSite(site: HeritageSite) {
  return site.batch !== null && PREGENERATED_INTRO_BATCHES.some((batch) => batch === site.batch);
}

export function getSiteIntroduction(site: HeritageSite, introductions: SiteIntroductionMap) {
  return introductions[buildSiteIntroductionKey(site)] ?? null;
}

export function buildBaiduSearchUrl(site: HeritageSite) {
  const query = [site.name, site.address, site.era].filter(Boolean).join(" ");
  return `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`;
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
