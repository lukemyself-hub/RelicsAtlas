export interface HeritageSite {
  id: number;
  name: string;
  era: string | null;
  address: string | null;
  type: string | null;
  batch: string | null;
  longitude: number;
  latitude: number;
}

export type MapSite = HeritageSite;

export interface SiteListItem extends HeritageSite {
  distance?: number;
}

export type SiteDetail = HeritageSite;

export interface FilterOptions {
  batches: string[];
  types: string[];
  eras: string[];
}

export interface SearchFilters {
  keyword: string;
  batches: string[];
  types: string[];
  era: string;
}
