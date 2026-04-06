import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  startTransition,
} from "react";
import { Landmark, List, Loader2, Locate, Map } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import LocationPrompt from "@/components/LocationPrompt";
import MapView from "@/components/MapView";
import SearchBar from "@/components/SearchBar";
import SiteDetail from "@/components/SiteDetail";
import SiteListItem from "@/components/SiteListItem";
import { useLocation } from "@/contexts/LocationContext";
import {
  BATCH_ORDER,
  DEFAULT_BATCHES,
  buildFilterOptionsFromSites,
  fetchNormalizedSites,
  haversineKm,
} from "@/lib/site-data";
import { deriveSearchAssist, prepareSitesForSearch } from "@/lib/site-search";
import type { SearchFilters } from "@/types";

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

const LIST_LIMIT = 50;

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

function SearchFeedbackCard({ message }: { message: SearchMessage }) {
  return (
    <Alert className="editorial-card rounded-[28px] border-border/70 bg-white/92 px-5 py-4 shadow-[0_20px_40px_rgba(19,34,29,0.12)]">
      <AlertTitle className="text-base font-semibold text-foreground">
        {message.title}
      </AlertTitle>
      <AlertDescription className="mt-2 text-sm leading-7 text-muted-foreground">
        {message.description}
      </AlertDescription>
      {(message.actionLabel || message.secondaryLabel) && (
        <div className="mt-4 flex flex-wrap gap-3">
          {message.actionLabel && message.onAction && (
            <Button size="sm" onClick={message.onAction}>
              {message.actionLabel}
            </Button>
          )}
          {message.secondaryLabel && message.onSecondaryAction && (
            <Button
              variant="outline"
              size="sm"
              onClick={message.onSecondaryAction}
            >
              {message.secondaryLabel}
            </Button>
          )}
        </div>
      )}
    </Alert>
  );
}

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [highlightSiteId, setHighlightSiteId] = useState<number | null>(null);
  const [locateRequest, setLocateRequest] = useState<number | null>(null);
  const [mapViewport, setMapViewport] = useState<MapViewport | null>(null);
  const [mapFitRequest, setMapFitRequest] = useState(0);
  const [pendingSearchFit, setPendingSearchFit] =
    useState<SearchFilters | null>(null);
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
  }, [
    hasPrompted,
    location.denied,
    location.granted,
    location.hasCheckedPermission,
  ]);

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
    [allSites],
  );

  const searchAssist = useMemo(
    () => deriveSearchAssist(preparedSites, filters),
    [filters, preparedSites],
  );
  const filteredMapData = searchAssist.strictResults;

  const sortedList = useMemo(() => {
    const withDistance = filteredMapData.map((site) => ({
      ...site,
      distance:
        location.granted &&
        location.latitude !== null &&
        location.longitude !== null
          ? haversineKm(
              location.latitude,
              location.longitude,
              site.mapLatitude,
              site.mapLongitude,
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
  }, [
    filteredMapData,
    location.granted,
    location.latitude,
    location.longitude,
  ]);

  const listData = useMemo(
    () => ({
      total: sortedList.length,
      items: sortedList.slice(listOffset, listOffset + LIST_LIMIT),
    }),
    [listOffset, sortedList],
  );

  const resolvedFilterOptions = useMemo(
    () => (allSites ? buildFilterOptionsFromSites(allSites) : undefined),
    [allSites],
  );

  const selectedSite = useMemo(
    () =>
      filteredMapData.find((site) => site.id === selectedSiteId) ??
      allSites?.find((site) => site.id === selectedSiteId) ??
      null,
    [allSites, filteredMapData, selectedSiteId],
  );

  const applyFilters = useCallback(
    (
      nextFilters: SearchFilters,
      options?: {
        fitMap?: boolean;
        syncDraftKeyword?: boolean;
      },
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
    [viewMode],
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
    [applyFilters],
  );

  const handleSearchSubmit = useCallback(() => {
    applyFilters(
      {
        ...filters,
        keyword: draftKeyword.trim(),
      },
      {
        fitMap: true,
      },
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
      },
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
      },
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
  }, [location]);

  const handleLocationDismiss = useCallback(() => {
    setShowLocationPrompt(false);
    setHasPrompted(true);
  }, []);

  const userLocation = useMemo(() => {
    if (
      location.granted &&
      location.latitude !== null &&
      location.longitude !== null
    ) {
      return { lat: location.latitude, lng: location.longitude };
    }
    return null;
  }, [location.granted, location.latitude, location.longitude]);

  const totalPages = Math.ceil(listData.total / LIST_LIMIT);
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
        onAction: topSuggestion
          ? handleApplySuggestedFilters
          : handleRelaxFilters,
        secondaryLabel: "恢复默认筛选",
        onSecondaryAction: handleResetDefaultFilters,
      };
    }

    if (searchAssist.hasKeyword) {
      return {
        title: "未找到相关文保单位",
        description:
          "没有找到与当前关键词匹配的文保单位，请尝试更换关键词后重新搜索。",
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

  const statusTitle = `${filteredMapData.length} 处文保单位`;
  const statusSubtitle = location.granted
    ? "按距离优先排序"
    : "按批次与名称排序";
  const activeFilterText = [
    filters.keyword ? `关键词「${filters.keyword}」` : null,
    filters.types.length > 0 ? `${filters.types.length} 个类别` : null,
    filters.era ? `时代：${filters.era}` : null,
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <div className="page-shell flex h-dvh w-full flex-col overflow-hidden bg-background">
      {showLocationPrompt && (
        <LocationPrompt
          onAllow={handleLocationAllow}
          onDismiss={handleLocationDismiss}
        />
      )}

      <header className="relative z-20 shrink-0 border-b border-black/10 bg-[linear-gradient(180deg,#0b765e_0%,#045744_100%)] text-white shadow-[0_20px_40px_rgba(4,39,31,0.18)]">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+0.95rem)] md:px-6 md:pb-5 md:pt-6">
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/16 bg-white/10 shadow-[0_12px_24px_rgba(0,0,0,0.12)] backdrop-blur">
              <Landmark className="h-6 w-6 text-white" />
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/68">
                Relics Atlas
              </p>
              <h1 className="mt-1 font-display text-3xl font-semibold leading-none text-white">
                文保地图
              </h1>
            </div>
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

      {!selectedSiteId && (
        <section className="shrink-0 border-b border-border/70 bg-[rgba(248,244,237,0.9)] backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-end justify-between gap-4 px-4 py-3 md:px-6 md:py-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                当前检索
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h2 className="font-display text-[1.75rem] font-semibold text-foreground md:text-[2rem]">
                  {statusTitle}
                </h2>
                {activeFilterText && (
                  <Badge
                    variant="outline"
                    className="border-primary/15 bg-primary/8 px-3 py-1.5 text-[11px] text-primary"
                  >
                    {activeFilterText}
                  </Badge>
                )}
              </div>
            </div>
            <div className="hidden text-right md:block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                排序方式
              </p>
              <p className="mt-1 text-base font-semibold text-foreground">
                {statusSubtitle}
              </p>
            </div>
          </div>
        </section>
      )}

      <div className="relative flex-1 overflow-hidden">
        {viewMode === "map" && !selectedSiteId && (
          <div className="absolute inset-0">
            {loadError ? (
              <div className="flex h-full items-center justify-center px-6 text-center">
                <div className="editorial-card max-w-md rounded-[30px] p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    地图数据异常
                  </p>
                  <h3 className="mt-2 font-display text-3xl font-semibold text-foreground">
                    暂时无法载入文保点位
                  </h3>
                  <p className="mt-3 text-base leading-8 text-muted-foreground">
                    页面主体已成功打开，但地图数据没有返回。刷新后若仍为空，通常需要检查部署环境中的静态数据是否被正确打包。
                  </p>
                </div>
              </div>
            ) : sitesLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="editorial-card flex items-center gap-3 rounded-full px-5 py-3 text-foreground">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm font-semibold">
                    正在整理文保点位…
                  </span>
                </div>
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

            <div className="pointer-events-none absolute left-4 top-4 z-10 md:left-6 md:top-6">
              <div className="editorial-card rounded-[24px] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  地图模式
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {statusTitle}
                </p>
              </div>
            </div>

            {searchMessage && !sitesLoading && !loadError && (
              <div className="absolute left-4 right-4 top-24 z-10 md:left-6 md:right-auto md:top-28 md:max-w-md">
                <SearchFeedbackCard message={searchMessage} />
              </div>
            )}

            <div className="absolute bottom-6 right-4 z-10 flex flex-col gap-3 md:bottom-8 md:right-6">
              {!location.granted && !location.denied && (
                <button
                  onClick={() => setShowLocationPrompt(true)}
                  className="editorial-card flex h-14 w-14 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                  title="获取我的位置"
                >
                  <Locate className="h-6 w-6" />
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
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_16px_32px_rgba(5,122,93,0.28)] transition-colors hover:bg-primary/92"
                  title="我的位置"
                >
                  <Locate className="h-6 w-6" />
                </button>
              )}
            </div>
          </div>
        )}

        {viewMode === "list" && !selectedSiteId && (
          <div className="absolute inset-0 overflow-y-auto">
            {sitesLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="editorial-card flex items-center gap-3 rounded-full px-5 py-3 text-foreground">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm font-semibold">
                    正在编排结果列表…
                  </span>
                </div>
              </div>
            ) : loadError ? (
              <div className="flex h-full items-center justify-center px-6 text-center">
                <div className="editorial-card max-w-md rounded-[30px] p-6">
                  <h3 className="font-display text-3xl font-semibold text-foreground">
                    列表数据加载失败
                  </h3>
                  <p className="mt-3 text-base leading-8 text-muted-foreground">
                    请稍后刷新重试；如果刚完成部署，通常重新部署或重新打包静态资源后即可恢复。
                  </p>
                </div>
              </div>
            ) : listData.items.length === 0 ? (
              <div className="flex h-full items-center justify-center px-6 text-center">
                <div className="max-w-md">
                  {searchMessage ? (
                    <SearchFeedbackCard message={searchMessage} />
                  ) : (
                    <div className="editorial-card rounded-[30px] p-6">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                        没有命中结果
                      </p>
                      <h3 className="mt-2 font-display text-3xl font-semibold text-foreground">
                        当前筛选下暂无文保单位
                      </h3>
                      <p className="mt-3 text-base leading-8 text-muted-foreground">
                        你可以放宽关键词、扩大批次范围，或者清除类别与时代筛选后再试一次。
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 pb-28 md:px-6 md:py-6">
                <div className="editorial-card sticky top-0 z-10 flex items-center justify-between gap-4 rounded-[26px] px-5 py-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      列表模式
                    </p>
                    <p className="mt-1 text-base font-semibold text-foreground">
                      共 {listData.total} 条结果，{statusSubtitle}
                    </p>
                  </div>
                  <Badge className="bg-primary/10 text-primary">
                    {currentPage} / {totalPages || 1}
                  </Badge>
                </div>

                {listData.items.map((site) => (
                  <SiteListItem
                    key={site.id}
                    site={site}
                    onClick={handleSiteClick}
                  />
                ))}

                {totalPages > 1 && (
                  <div className="editorial-card sticky bottom-4 flex items-center justify-between gap-3 rounded-full px-4 py-3">
                    <Button
                      variant="outline"
                      disabled={currentPage <= 1}
                      onClick={() =>
                        setListOffset(Math.max(0, listOffset - LIST_LIMIT))
                      }
                    >
                      上一页
                    </Button>
                    <span className="text-sm font-semibold text-muted-foreground">
                      第 {currentPage} 页，共 {totalPages} 页
                    </span>
                    <Button
                      disabled={currentPage >= totalPages}
                      onClick={() => setListOffset(listOffset + LIST_LIMIT)}
                    >
                      下一页
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {selectedSiteId && (
          <div className="absolute inset-0 z-30 overflow-hidden">
            <SiteDetail
              site={selectedSite}
              onBack={handleBack}
              onLocateOnMap={handleLocateOnMap}
            />
          </div>
        )}
      </div>

      {!selectedSiteId && (
        <nav className="shrink-0 border-t border-border/70 bg-[rgba(248,244,237,0.94)] px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-10px_30px_rgba(19,34,29,0.08)] backdrop-blur-md md:px-6">
          <div className="mx-auto flex max-w-md rounded-full border border-border/70 bg-white/80 p-1.5 shadow-[0_18px_36px_rgba(19,34,29,0.08)]">
            <button
              onClick={() => setViewMode("map")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-colors ${
                viewMode === "map"
                  ? "bg-primary text-primary-foreground shadow-[0_12px_28px_rgba(5,122,93,0.22)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Map className="h-4 w-4" />
              地图
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-colors ${
                viewMode === "list"
                  ? "bg-primary text-primary-foreground shadow-[0_12px_28px_rgba(5,122,93,0.22)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-4 w-4" />
              列表
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
