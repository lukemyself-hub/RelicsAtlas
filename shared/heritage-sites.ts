import { getSiteCoordinateOverride } from "./site-coordinate-overrides";

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
  mapLongitude: number;
  mapLatitude: number;
  coordinateSource: "raw" | "override";
}

type CoordinateAwareSite = {
  originalId: number;
  mapLongitude: number;
  mapLatitude: number;
  coordinateSource: "raw" | "override";
};

export function normalizeHeritageSites<T extends RawHeritageSite>(
  sites: T[]
): Array<T & CoordinateAwareSite> {
  return sites.map((site, index) => {
    const batch = site.batch ?? null;
    const override = getSiteCoordinateOverride({
      id: site.id,
      name: site.name,
      batch,
    });

    return {
      ...site,
      id: index + 1,
      originalId: site.id,
      era: site.era ?? null,
      address: site.address ?? null,
      type: site.type ?? null,
      batch,
      mapLongitude: override?.longitude ?? site.longitude,
      mapLatitude: override?.latitude ?? site.latitude,
      coordinateSource: override ? "override" : "raw",
    };
  });
}
