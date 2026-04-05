export interface RawHeritageSite {
  id: number;
  name: string;
  era?: string | null;
  address?: string | null;
  type?: string | null;
  batch?: string | null;
  longitude: number;
  latitude: number;
}

export interface NormalizedHeritageSite {
  id: number;
  originalId: number;
  name: string;
  era: string | null;
  address: string | null;
  type: string | null;
  batch: string | null;
  longitude: number;
  latitude: number;
}

export function normalizeHeritageSites<T extends RawHeritageSite>(sites: T[]): Array<T & { originalId: number }> {
  return sites.map((site, index) => ({
    ...site,
    id: index + 1,
    originalId: site.id,
    era: site.era ?? null,
    address: site.address ?? null,
    type: site.type ?? null,
    batch: site.batch ?? null,
  }));
}
