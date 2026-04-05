import rawSites from "../heritage_sites.json" with { type: "json" };
import filterOptionsData from "../filter_options.json" with { type: "json" };
import { normalizeHeritageSites, type RawHeritageSite } from "../shared/heritage-sites";

type RawSite = RawHeritageSite & {
  categoryId?: string | null;
};

export type SiteRecord = {
  id: number;
  originalId: number;
  categoryId: string | null;
  name: string;
  era: string | null;
  address: string | null;
  type: string | null;
  batch: string | null;
  longitude: number;
  latitude: number;
  mapLongitude: number;
  mapLatitude: number;
  coordinateSource: "raw" | "override";
};

const allSites: SiteRecord[] = normalizeHeritageSites(rawSites as RawSite[]).map((site) => ({
  id: site.id,
  originalId: site.originalId,
  categoryId: (site.categoryId ?? null) as string | null,
  name: site.name as string,
  era: (site.era ?? null) as string | null,
  address: (site.address ?? null) as string | null,
  type: (site.type ?? null) as string | null,
  batch: (site.batch ?? null) as string | null,
  longitude: site.longitude as number,
  latitude: site.latitude as number,
  mapLongitude: site.mapLongitude as number,
  mapLatitude: site.mapLatitude as number,
  coordinateSource: site.coordinateSource,
}));

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
  return allSites.map(
    ({
      id,
      originalId,
      name,
      era,
      address,
      type,
      batch,
      longitude,
      latitude,
      mapLongitude,
      mapLatitude,
      coordinateSource,
    }) => ({
      id,
      originalId,
      name,
      era,
      address,
      type,
      batch,
      longitude,
      latitude,
      mapLongitude,
      mapLatitude,
      coordinateSource,
    })
  );
}

export async function getSitesByBatches(batches: readonly string[]) {
  return allSites.filter((site) => site.batch !== null && batches.includes(site.batch));
}

export async function searchSites(params: {
  keyword?: string;
  batch?: string;
  types?: string[];
  era?: string;
  limit?: number;
  offset?: number;
  userLat?: number;
  userLng?: number;
}) {
  let filtered = allSites;

  if (params.keyword) {
    const kw = params.keyword.toLowerCase();
    filtered = filtered.filter((site) => site.name.toLowerCase().includes(kw));
  }
  if (params.batch) {
    filtered = filtered.filter((site) => site.batch === params.batch);
  }
  if (params.types?.length) {
    filtered = filtered.filter((site) => params.types!.includes(site.type ?? ""));
  }
  if (params.era) {
    const era = params.era.toLowerCase();
    filtered = filtered.filter((site) => site.era?.toLowerCase().includes(era) ?? false);
  }

  const total = filtered.length;

  if (params.userLat !== undefined && params.userLng !== undefined) {
    const withDistance = filtered.map((site) => ({
      ...site,
      distance: haversineKm(params.userLat!, params.userLng!, site.mapLatitude, site.mapLongitude),
    }));
    withDistance.sort((a, b) => a.distance - b.distance);

    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;
    return { items: withDistance.slice(offset, offset + limit), total };
  }

  filtered = [...filtered].sort((a, b) => {
    const batchCmp = (a.batch ?? "").localeCompare(b.batch ?? "");
    return batchCmp !== 0 ? batchCmp : a.name.localeCompare(b.name);
  });

  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  return { items: filtered.slice(offset, offset + limit), total };
}

export async function getSiteById(id: number) {
  return allSites.find((site) => site.id === id) ?? null;
}

export async function getFilterOptions() {
  return filterOptionsData as { batches: string[]; types: string[]; eras: string[] };
}
