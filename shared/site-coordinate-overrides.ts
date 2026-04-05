type SiteCoordinateKeyInput = {
  id: number;
  name: string;
  batch?: string | null;
};

export type SiteCoordinateOverride = {
  longitude: number;
  latitude: number;
  note?: string;
};

export function buildSiteCoordinateOverrideKey(site: SiteCoordinateKeyInput) {
  return `${site.batch ?? ""}:${site.id}:${site.name}`;
}

export const SITE_COORDINATE_OVERRIDES: Record<string, SiteCoordinateOverride> = {
  [buildSiteCoordinateOverrideKey({
    batch: "第一批",
    id: 100,
    name: "故宫",
  })]: {
    longitude: 116.397026,
    latitude: 39.923058,
    note: "Representative map anchor near the Forbidden City north gate.",
  },
};

export function getSiteCoordinateOverride(site: SiteCoordinateKeyInput) {
  return SITE_COORDINATE_OVERRIDES[buildSiteCoordinateOverrideKey(site)] ?? null;
}
