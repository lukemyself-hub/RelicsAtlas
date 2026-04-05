export interface MapSite {
  id: number;
  name: string;
  era: string | null;
  type: string | null;
  batch: string | null;
  longitude: number;
  latitude: number;
}

export interface SiteListItem {
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
  distance?: number;
}

export interface SiteDetail {
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
}

export interface FilterOptions {
  batches: string[];
  types: string[];
  eras: string[];
}

export interface SearchFilters {
  keyword: string;
  batch: string;
  types: string[];
  era: string;
}
