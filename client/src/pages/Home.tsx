import { useState, useCallback, useMemo, useEffect, startTransition } from "react";
import {
  Map,
  List,
  Locate,
  Loader2,
  Landmark,
  SearchX,
  SlidersHorizontal,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useLocation } from "@/contexts/LocationContext";
import MapView from "@/components/MapView";
import SearchBar from "@/components/SearchBar";
import SiteListItem from "@/components/SiteListItem";
import SiteDetail from "@/components/SiteDetail";
import LocationPrompt from "@/components/LocationPrompt";
import {
  BATCH_ORDER,
  DEFAULT_BATCHES,
  buildFilterOptionsFromSites,
  fetchNormalizedSites,
  haversineKm,
} from "@/lib/site-data";
import {
  deriveSearchAssist,
  prepareSitesForSearch,
} from "@/lib/site-search";
import type { HeritageSite, SearchFilters } from "@/types";

type ViewMode = "map" | "list";
type MapViewport = {
  center: { lat: number; lng: number };
  zoom: number;
};

type SearchMessage = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
};

function isSameFilters(a: SearchFilters, b: SearchFilters) {
  return (
    a.keyword === b.keyword &&
    a.era === b.era &&
    a.batches.length === b.batches.length &&
    a.types.length === b.types.length &&
    a.batches.every((batch, index) => batch === b.batches[index]) &&
    a.types.every((type, index) => type === b.types[index])
  );
}

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [highlightSiteId, setHighlightSiteId] = useState<number | null>(null);
  const [locateRequest, setLocateRequest] = useState<number | null>(null);
  const [mapViewport, setMapViewport] = useState<MapViewport | null>(null);
  const [mapFitRequest, setMapFitRequest] = useState(0);
  const [pendingSearchFit, setPendingSearchFit] = useState<SearchFilters | null>(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [hasPrompted, setHasPrompted] = useState(false);
  const [draftKeyword, setDraftKeyword] = useState("");
  const [filters, setFilters] = useState<SearchFilters>({
    keyword: "",
    batches: [...DEFAULT_BATCHES],
    types: [],
    era: "",
  });
  const [listOffset, setListOffset] = useState(0);
  const LIST_LIMIT = 50;

  const location = useLocation();

  useEffect(() => {
    if (
      location.hasCheckedPermission &&
      !location.granted &&
      !location.denied &&
      !hasPrompted
    ) {
      setShowLocationPrompt(true);
    }
  }, [location.hasCheckedPermission, location.granted, location.denied, hasPrompted]);

  const {
    data: allSites,
    isLoading: sitesLoading,
    error: sitesError,
  } = useQuery({
    queryKey: ["static-map-sites"],
    queryFn: () => fetchNormalizedSites("/data/map-sites.json"),
    staleTime: Infinity,
  });

  const loadError = sitesError;

  const preparedSites = useMemo(
    () => (allSites ? prepareSitesForSearch(allSites) : []),
    [allSites]
  );

  const searchAssist = useMemo(
    () => deriveSearchAssist(preparedSites, filters),
    [filters, preparedSites]
  );
  const filteredMapData = searchAssist.strictResults;

  const sortedList = useMemo(() => {
    const withDistance = filteredMapData.map((site) => ({
      ...site,
      distance:
        location.granted && location.latitude !== null && location.longitude !== null
          ? haversineKm(
              location.latitude,
              location.longitude,
              site.mapLatitude,
              site.mapLongitude
            )
          : undefined,
    }));

    withDistance.sort((a, b) => {
      if (a.distance !== undefined && b.distance !== undefined) {
        return a.distance - b.distance;
      }
      const batchA = a.batch ?? "";
      const batchB = b.batch ?? "";
      const batchCmp = batchA.localeCompare(batchB, "zh-CN");
      return batchCmp !== 0 ? batchCmp : a.name.localeCompare(b.name, "zh-CN");
    });

    return withDistance;
  }, [filteredMapData, location.granted, location.latitude, location.longitude]);

  const listData = useMemo(
    () => ({
      total: sortedList.length,
      items: sortedList.slice(listOffset, listOffset + LIST_LIMIT),
    }),
    [LIST_LIMIT, listOffset, sortedList]
  );

  const resolvedFilterOptions = useMemo(
    () => (allSites ? buildFilterOptionsFromSites(allSites) : undefined),
    [allSites]
  );

  const listLoading = sitesLoading;
  const mapLoading = sitesLoading;
  const selectedSite = useMemo(
    () =>
      filteredMapData.find((site) => site.id === selectedSiteId) ??
      allSites?.find((site) => site.id === selectedSiteId) ??
      null,
    [allSites, filteredMapData, selectedSiteId]
  );

  const applyFilters = useCallback(
    (
      nextFilters: SearchFilters,
      options?: {
        fitMap?: boolean;
        syncDraftKeyword?: boolean;
      }
    ) => {
      startTransition(() => {
        setFilters(nextFilters);
      });
      if (options?.syncDraftKeyword) {
        setDraftKeyword(nextFilters.keyword);
      }
      setListOffset(0);
      if (options?.fitMap) {
        setPendingSearchFit(viewMode === "map" ? nextFilters : null);
      }
    },
    [viewMode]
  );

  const handleSiteClick = useCallback((id: number) => {
    setSelectedSiteId(id);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedSiteId(null);
  }, []);

  const handleLocateOnMap = useCallback((siteId: number) => {
    setViewMode("map");
    setSelectedSiteId(null);
    setHighlightSiteId(siteId);
  }, []);

  const handleViewportChange = useCallback((viewport: MapViewport) => {
    setMapViewport(viewport);
  }, []);

  const handleHighlightHandled = useCallback((siteId: number) => {
    setHighlightSiteId((current) => (current === siteId ? null : current));
  }, []);

  const handleFiltersChange = useCallback(
    (newFilters: SearchFilters) => {
      applyFilters(newFilters);
    },
    [applyFilters]
  );

  const handleSearchSubmit = useCallback(() => {
    applyFilters(
      {
        ...filters,
        keyword: draftKeyword.trim(),
      },
      {
        fitMap: true,
      }
    );
  }, [applyFilters, draftKeyword, filters]);

  const handleResetDefaultFilters = useCallback(() => {
    applyFilters(
      {
        keyword: filters.keyword,
        batches: [...DEFAULT_BATCHES],
        types: [],
        era: "",
      },
      {
        fitMap: true,
      }
    );
  }, [applyFilters, filters.keyword]);

  const handleRelaxFilters = useCallback(() => {
    applyFilters(
      {
        ...filters,
        batches: [...BATCH_ORDER],
        types: [],
        era: "",
      },
      {
        fitMap: true,
      }
    );
  }, [applyFilters, filters]);

  const handleApplySuggestedFilters = useCallback(() => {
    const topSuggestion = searchAssist.suggestions[0];
    if (!topSuggestion) return;

    applyFilters(topSuggestion.nextFilters, {
      fitMap: true,
    });
  }, [applyFilters, searchAssist.suggestions]);

  const handleLocationAllow = useCallback(() => {
    location.requestLocation();
    setShowLocationPrompt(false);
    setHasPrompted(true);
  }, [location.requestLocation]);

  const handleLocationDismiss = useCallback(() => {
    setShowLocationPrompt(false);
    setHasPrompted(true);
  }, []);

  const userLocation = useMemo(() => {
    if (location.granted && location.latitude !== null && location.longitude !== null) {
      return { lat: location.latitude, lng: location.longitude };
    }
    return null;
  }, [location.granted, location.latitude, location.longitude]);

  const totalPages = listData ? Math.ceil(listData.total / LIST_LIMIT) : 0;
  const currentPage = Math.floor(listOffset / LIST_LIMIT) + 1;

  useEffect(() => {
    if (!pendingSearchFit) return;
    if (!isSameFilters(filters, pendingSearchFit)) return;

    if (filteredMapData.length > 0) {
      setMapFitRequest((current) => current + 1);
    }
    setPendingSearchFit(null);
  }, [filteredMapData.length, filters, pendingSearchFit]);

  const searchMessage = useMemo<SearchMessage | null>(() => {
    if (filteredMapData.length > 0) return null;

    if (searchAssist.hasKeyword && searchAssist.relaxedResults.length > 0) {
      const topSuggestion = searchAssist.suggestions[0];
      return {
        title: "当前关键词在其他筛选条件下有结果",
        description: topSuggestion
          ? `放宽“${topSuggestion.label.replace("放宽", "").replace("筛选", "")}”后可找到 ${topSuggestion.count} 处文保单位。你也可以直接清空其他筛选条件查看全部 ${searchAssist.relaxedResults.length} 条相关结果。`
          : `如果放宽批次、类型或时代筛选，可找到 ${searchAssist.relaxedResults.length} 条相关结果。`,
        actionLabel: topSuggestion ? topSuggestion.label : "放宽筛选查看",
        onAction: topSuggestion ? handleApplySuggestedFilters : handleRelaxFilters,
        secondaryLabel: "恢复默认筛选",
        onSecondaryAction: handleResetDefaultFilters,
      };
    }

    if (searchAssist.hasKeyword) {
      return {
        title: "未找到相关文保单位",
        description: "没有找到与当前关键词匹配的文保单位，请尝试更换关键词后重新搜索。",
      };
    }

    return {
      title: "当前筛选条件下暂无文保单位",
      description: "可以尝试恢复默认筛选条件，或放宽批次、类型、时代限制。",
      actionLabel: "恢复默认筛选",
      onAction: handleResetDefaultFilters,
    };
  }, [
    filteredMapData.length,
    handleApplySuggestedFilters,
    handleRelaxFilters,
    handleResetDefaultFilters,
    searchAssist.hasKeyword,
    searchAssist.relaxedResults.length,
    searchAssist.suggestions,
  ]);

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background">
      {showLocationPrompt && (
        <LocationPrompt onAllow={handleLocationAllow} onDismiss={handleLocationDismiss} />
      )}

      <header className="z-20 shrink-0 border-b border-border/40 bg-white shadow-sm">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="shrink-0 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Landmark className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="hidden text-base font-semibold text-foreground sm:block">文保地图</h1>
          </div>
          <div className="min-w-0 flex-1">
            <SearchBar
              filters={filters}
              draftKeyword={draftKeyword}
              onDraftKeywordChange={setDraftKeyword}
              onSearchSubmit={handleSearchSubmit}
              onFiltersChange={handleFiltersChange}
              filterOptions={resolvedFilterOptions}
            />
          </div>
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden">
        {viewMode === "map" && !selectedSiteId && (
          <div className="absolute inset-0">
            {loadError ? (
              <div className="flex h-full items-center justify-center px-6 text-center">
                <div className="max-w-sm rounded-xl border border-destructive/20 bg-white p-4 shadow-sm">
                  <p className="text-sm font-medium text-foreground">POI 数据加载失败</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    页面已渲染，但文保点位数据暂时没有成功返回。刷新后若仍为空，通常是服务端数据源没有被正确打包到部署环境。
                  </p>
                </div>
              </div>
            ) : mapLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <MapView
                sites={filteredMapData}
                onSiteClick={handleSiteClick}
                userLocation={userLocation}
                highlightSiteId={highlightSiteId}
                locateRequest={locateRequest}
                fitRequest={mapFitRequest}
                initialViewport={mapViewport}
                onViewportChange={handleViewportChange}
                onHighlightHandled={handleHighlightHandled}
                onLocateHandled={() => setLocateRequest(null)}
              />
            )}

            <div className="absolute left-3 top-3 z-10">
              <div className="rounded-lg bg-white/90 px-3 py-1.5 text-xs text-muted-foreground shadow-md backdrop-blur-sm">
                共 <span className="font-semibold text-foreground">{filteredMapData.length}</span> 处文保单位
                {filters.keyword && (
                  <span className="ml-1 text-[11px] text-muted-foreground/90">
                    搜索词: {filters.keyword}
                  </span>
                )}
              </div>
            </div>

            {searchMessage && !mapLoading && !loadError && (
              <div className="absolute left-3 right-3 top-16 z-10 sm:left-1/2 sm:max-w-xl sm:-translate-x-1/2">
                <SearchFeedbackCard message={searchMessage} />
              </div>
            )}

            {!location.granted && !location.denied && (
              <button
                onClick={() => setShowLocationPrompt(true)}
                className="absolute bottom-20 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg transition-colors hover:bg-accent"
                title="获取我的位置"
              >
                <Locate className="h-5 w-5 text-muted-foreground" />
              </button>
            )}
            {location.granted && (
              <button
                onClick={() => {
                  if (userLocation) {
                    setHighlightSiteId(null);
                    setLocateRequest(Date.now());
                  }
                }}
                className="absolute bottom-20 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg transition-colors hover:bg-accent"
                title="我的位置"
              >
                <Locate className="h-5 w-5 text-primary" />
              </button>
            )}
          </div>
        )}

        {viewMode === "list" && !selectedSiteId && (
          <div className="absolute inset-0 flex flex-col bg-white">
            <div className="flex items-center justify-between border-b border-border/30 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <span>
                共 {listData?.total ?? 0} 条结果
                {location.granted ? "（按距离排序）" : "（按批次排序）"}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {listLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : loadError ? (
                <div className="flex h-32 flex-col items-center justify-center px-6 text-center text-muted-foreground">
                  <p className="text-sm text-foreground">列表数据加载失败</p>
                  <p className="mt-1 text-xs">请稍后刷新重试；如果部署刚更新，通常重新部署后即可恢复。</p>
                </div>
              ) : listData?.items.length === 0 ? (
                <div className="px-3 py-4">
                  {searchMessage ? (
                    <SearchFeedbackCard message={searchMessage} />
                  ) : (
                    <div className="flex h-32 flex-col items-center justify-center text-muted-foreground">
                      <p className="text-sm">未找到匹配的文保单位</p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {listData?.items.map((site) => (
                    <SiteListItem
                      key={site.id}
                      site={site}
                      onClick={handleSiteClick}
                    />
                  ))}

                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 border-t border-border/30 p-3">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage <= 1}
                        onClick={() => setListOffset(Math.max(0, listOffset - LIST_LIMIT))}
                      >
                        上一页
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage >= totalPages}
                        onClick={() => setListOffset(listOffset + LIST_LIMIT)}
                      >
                        下一页
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {selectedSiteId && (
          <div className="absolute inset-0 z-30 overflow-hidden bg-white">
            <SiteDetail
              site={selectedSite}
              onBack={handleBack}
              onLocateOnMap={handleLocateOnMap}
            />
          </div>
        )}
      </div>

      {!selectedSiteId && (
        <nav className="z-20 shrink-0 border-t border-border/40 bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.05)]">
          <div className="mx-auto flex max-w-md items-center justify-around">
            <button
              onClick={() => setViewMode("map")}
              className={`flex flex-col items-center gap-0.5 px-6 py-2 transition-colors ${
                viewMode === "map"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Map className="h-5 w-5" />
              <span className="text-xs font-medium">地图</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex flex-col items-center gap-0.5 px-6 py-2 transition-colors ${
                viewMode === "list"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-5 w-5" />
              <span className="text-xs font-medium">列表</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

function SearchFeedbackCard({ message }: { message: SearchMessage }) {
  return (
    <Alert className="border-border/70 bg-white/95 shadow-md backdrop-blur-sm">
      <SearchX className="h-4 w-4 text-muted-foreground" />
      <AlertTitle>{message.title}</AlertTitle>
      <AlertDescription>
        <p>{message.description}</p>
        {(message.actionLabel || message.secondaryLabel) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.actionLabel && message.onAction && (
              <Button size="sm" onClick={message.onAction}>
                <SlidersHorizontal className="mr-1 h-4 w-4" />
                {message.actionLabel}
              </Button>
            )}
            {message.secondaryLabel && message.onSecondaryAction && (
              <Button size="sm" variant="outline" onClick={message.onSecondaryAction}>
                {message.secondaryLabel}
              </Button>
            )}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
