import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../");

const rawSites: any[] = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "heritage_sites.json"), "utf-8")
);

const filterOptionsData: { batches: string[]; types: string[]; eras: string[] } = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "filter_options.json"), "utf-8")
);

const allSites = rawSites.map((s) => ({
  id: s.id as number,
  originalId: s.id as number,
  categoryId: (s.categoryId ?? null) as string | null,
  name: s.name as string,
  era: (s.era ?? null) as string | null,
  address: (s.address ?? null) as string | null,
  type: (s.type ?? null) as string | null,
  batch: (s.batch ?? null) as string | null,
  longitude: s.longitude as number,
  latitude: s.latitude as number,
}));

const introCache = new Map<number, {
  id: number;
  siteId: number;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}>();

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getAllSitesForMap() {
  return allSites.map(({ id, name, era, type, batch, longitude, latitude }) => ({
    id, name, era, type, batch, longitude, latitude,
  }));
}

export async function searchSites(params: {
  keyword?: string;
  batch?: string;
  type?: string;
  era?: string;
  limit?: number;
  offset?: number;
  userLat?: number;
  userLng?: number;
}) {
  let filtered = allSites;

  if (params.keyword) {
    const kw = params.keyword.toLowerCase();
    filtered = filtered.filter(s => s.name.toLowerCase().includes(kw));
  }
  if (params.batch) {
    filtered = filtered.filter(s => s.batch === params.batch);
  }
  if (params.type) {
    filtered = filtered.filter(s => s.type === params.type);
  }
  if (params.era) {
    const era = params.era.toLowerCase();
    filtered = filtered.filter(s => s.era?.toLowerCase().includes(era) ?? false);
  }

  const total = filtered.length;

  if (params.userLat !== undefined && params.userLng !== undefined) {
    const userLat = params.userLat;
    const userLng = params.userLng;
    const withDistance = filtered.map(s => ({
      ...s,
      distance: haversineKm(userLat, userLng, s.latitude, s.longitude),
    }));
    withDistance.sort((a, b) => a.distance - b.distance);

    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;
    return { items: withDistance.slice(offset, offset + limit), total };
  } else {
    filtered = [...filtered].sort((a, b) => {
      const batchCmp = (a.batch ?? "").localeCompare(b.batch ?? "");
      return batchCmp !== 0 ? batchCmp : a.name.localeCompare(b.name);
    });

    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;
    return { items: filtered.slice(offset, offset + limit), total };
  }
}

export async function getSiteById(id: number) {
  return allSites.find(s => s.id === id) ?? null;
}

export async function getSiteIntroduction(siteId: number) {
  return introCache.get(siteId) ?? null;
}

export async function saveSiteIntroduction(siteId: number, content: string) {
  const existing = introCache.get(siteId);
  introCache.set(siteId, {
    id: siteId,
    siteId,
    content,
    createdAt: existing?.createdAt ?? new Date(),
    updatedAt: new Date(),
  });
}

export async function getFilterOptions() {
  return filterOptionsData;
}
