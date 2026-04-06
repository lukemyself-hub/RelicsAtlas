import { BATCH_ORDER } from "@/lib/site-data";
import type { HeritageSite, SearchFilters } from "@/types";

type PreparedSite = {
  site: HeritageSite;
  batch: string | null;
  type: string | null;
  eraText: string;
  searchText: string;
};

export type SearchSuggestion = {
  nextFilters: SearchFilters;
  label: string;
  count: number;
};

export type SearchAssist = {
  strictResults: HeritageSite[];
  relaxedResults: HeritageSite[];
  suggestions: SearchSuggestion[];
  hasKeyword: boolean;
};

export function prepareSitesForSearch(sites: HeritageSite[]): PreparedSite[] {
  return sites.map((site) => ({
    site,
    batch: site.batch,
    type: site.type,
    eraText: site.era?.toLowerCase() ?? "",
    searchText: [site.name, site.address ?? "", site.type ?? "", site.era ?? ""]
      .join(" ")
      .toLowerCase(),
  }));
}

export function applySiteFilters(
  preparedSites: PreparedSite[],
  filters: SearchFilters,
) {
  let filtered = preparedSites;
  const keyword = filters.keyword.trim().toLowerCase();

  if (keyword) {
    filtered = filtered.filter((entry) => entry.searchText.includes(keyword));
  }

  if (filters.batches.length > 0) {
    filtered = filtered.filter(
      (entry) => entry.batch !== null && filters.batches.includes(entry.batch),
    );
  } else {
    filtered = [];
  }

  if (filters.types.length > 0) {
    filtered = filtered.filter((entry) =>
      filters.types.includes(entry.type ?? ""),
    );
  }

  if (filters.era) {
    const eraQuery = filters.era.toLowerCase();
    filtered = filtered.filter((entry) => entry.eraText.includes(eraQuery));
  }

  return filtered.map((entry) => entry.site);
}

export function deriveSearchAssist(
  preparedSites: PreparedSite[],
  filters: SearchFilters,
): SearchAssist {
  const strictResults = applySiteFilters(preparedSites, filters);
  const hasKeyword = filters.keyword.trim().length > 0;

  if (strictResults.length > 0 || !hasKeyword) {
    return {
      strictResults,
      relaxedResults: strictResults,
      suggestions: [],
      hasKeyword,
    };
  }

  const relaxedFilters: SearchFilters = {
    ...filters,
    batches: [...BATCH_ORDER],
    types: [],
    era: "",
  };
  const relaxedResults = applySiteFilters(preparedSites, relaxedFilters);
  const suggestions: SearchSuggestion[] = [];

  if (filters.batches.length > 0) {
    const nextFilters = {
      ...filters,
      batches: [...BATCH_ORDER],
    };
    const count = applySiteFilters(preparedSites, nextFilters).length;
    if (count > 0) {
      suggestions.push({
        nextFilters,
        count,
        label: "放宽批次筛选",
      });
    }
  }

  if (filters.types.length > 0) {
    const nextFilters = {
      ...filters,
      types: [],
    };
    const count = applySiteFilters(preparedSites, nextFilters).length;
    if (count > 0) {
      suggestions.push({
        nextFilters,
        count,
        label: "放宽文物类型筛选",
      });
    }
  }

  if (filters.era) {
    const nextFilters = {
      ...filters,
      era: "",
    };
    const count = applySiteFilters(preparedSites, nextFilters).length;
    if (count > 0) {
      suggestions.push({
        nextFilters,
        count,
        label: "放宽时代筛选",
      });
    }
  }

  suggestions.sort((a, b) => b.count - a.count);

  return {
    strictResults,
    relaxedResults,
    suggestions,
    hasKeyword,
  };
}
