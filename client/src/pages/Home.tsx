import { useState, useCallback, useMemo, useEffect } from "react";
import { Map, List, Locate, Loader2, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useLocation } from "@/contexts/LocationContext";
import MapView from "@/components/MapView";
import SearchBar from "@/components/SearchBar";
import SiteListItem from "@/components/SiteListItem";
import SiteDetail from "@/components/SiteDetail";
import LocationPrompt from "@/components/LocationPrompt";
import type { SearchFilters } from "@/types";

type ViewMode = "map" | "list";

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [highlightSiteId, setHighlightSiteId] = useState<number | null>(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [hasPrompted, setHasPrompted] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    keyword: "",
    batch: "",
    types: [],
    era: "",
  });
  const [listOffset, setListOffset] = useState(0);
  const LIST_LIMIT = 50;

  const location = useLocation();

  // Show location prompt on first load if not yet granted/denied
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

  // Fetch map data
  const {
    data: mapData,
    isLoading: mapLoading,
    error: mapError,
  } = trpc.heritage.mapData.useQuery();

  // Fetch filter options
  const { data: filterOptions, error: filterError } = trpc.heritage.filters.useQuery();

  // Fetch list data
  const searchInput = useMemo(
    () => ({
      keyword: filters.keyword || undefined,
      batch: filters.batch || undefined,
      types: filters.types.length > 0 ? filters.types : undefined,
      era: filters.era || undefined,
      limit: LIST_LIMIT,
      offset: listOffset,
      userLat: location.granted ? (location.latitude ?? undefined) : undefined,
      userLng: location.granted ? (location.longitude ?? undefined) : undefined,
    }),
    [filters, listOffset, location.granted, location.latitude, location.longitude]
  );

  const {
    data: listData,
    isLoading: listLoading,
    error: listError,
  } = trpc.heritage.search.useQuery(searchInput);
  const loadError = mapError ?? listError ?? filterError;

  // Filter map data based on search/filter criteria
  const filteredMapData = useMemo(() => {
    if (!mapData) return [];
    let filtered = mapData;
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase();
      filtered = filtered.filter((s) => s.name.toLowerCase().includes(kw));
    }
    if (filters.batch) {
      filtered = filtered.filter((s) => s.batch === filters.batch);
    }
    if (filters.types.length > 0) {
      filtered = filtered.filter((s) => filters.types.includes(s.type ?? ""));
    }
    if (filters.era) {
      filtered = filtered.filter((s) => s.era?.includes(filters.era) ?? false);
    }
    return filtered;
  }, [mapData, filters]);

  const handleSiteClick = useCallback((id: number) => {
    setSelectedSiteId(id);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedSiteId(null);
  }, []);

  const handleLocateOnMap = useCallback((lat: number, lng: number) => {
    setViewMode("map");
    setSelectedSiteId(null);
    // Find site by coordinates to highlight
    const site = mapData?.find(
      (s) => Math.abs(s.latitude - lat) < 0.0001 && Math.abs(s.longitude - lng) < 0.0001
    );
    if (site) {
      setHighlightSiteId(site.id);
    }
  }, [mapData]);

  const handleFiltersChange = useCallback((newFilters: SearchFilters) => {
    setFilters(newFilters);
    setListOffset(0);
  }, []);

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
    if (location.granted && location.latitude && location.longitude) {
      return { lat: location.latitude, lng: location.longitude };
    }
    return null;
  }, [location.granted, location.latitude, location.longitude]);

  const totalPages = listData ? Math.ceil(listData.total / LIST_LIMIT) : 0;
  const currentPage = Math.floor(listOffset / LIST_LIMIT) + 1;

  return (
    <div className="h-dvh w-full flex flex-col overflow-hidden bg-background">
      {/* Location prompt */}
      {showLocationPrompt && (
        <LocationPrompt onAllow={handleLocationAllow} onDismiss={handleLocationDismiss} />
      )}

      {/* Top bar */}
      <header className="bg-white border-b border-border/40 shadow-sm z-20 shrink-0">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Landmark className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="text-base font-semibold text-foreground hidden sm:block">文保地图</h1>
          </div>
          <div className="flex-1 min-w-0">
            <SearchBar
              filters={filters}
              onFiltersChange={handleFiltersChange}
              filterOptions={filterOptions}
            />
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 relative overflow-hidden">
        {/* Map view */}
        {viewMode === "map" && !selectedSiteId && (
          <div className="absolute inset-0">
            {loadError ? (
              <div className="flex items-center justify-center h-full px-6 text-center">
                <div className="max-w-sm rounded-xl border border-destructive/20 bg-white p-4 shadow-sm">
                  <p className="text-sm font-medium text-foreground">POI 数据加载失败</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    页面已渲染，但文保点位数据暂时没有成功返回。刷新后若仍为空，通常是服务端数据源没有被正确打包到部署环境。
                  </p>
                </div>
              </div>
            ) : mapLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <MapView
                sites={filteredMapData}
                onSiteClick={handleSiteClick}
                userLocation={userLocation}
                highlightSiteId={highlightSiteId}
              />
            )}

            {/* Map overlay: result count */}
            <div className="absolute top-3 left-3 z-10">
              <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-md text-xs text-muted-foreground">
                共 <span className="font-semibold text-foreground">{filteredMapData.length}</span> 处文保单位
              </div>
            </div>

            {/* User location button */}
            {!location.granted && !location.denied && (
              <button
                onClick={() => setShowLocationPrompt(true)}
                className="absolute bottom-20 right-3 z-10 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-accent transition-colors"
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
                  }
                }}
                className="absolute bottom-20 right-3 z-10 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-accent transition-colors"
                title="我的位置"
              >
                <Locate className="h-5 w-5 text-primary" />
              </button>
            )}
          </div>
        )}

        {/* List view */}
        {viewMode === "list" && !selectedSiteId && (
          <div className="absolute inset-0 bg-white flex flex-col">
            {/* Sort indicator */}
            <div className="px-3 py-2 border-b border-border/30 bg-muted/30 text-xs text-muted-foreground flex items-center justify-between">
              <span>
                共 {listData?.total ?? 0} 条结果
                {location.granted ? "（按距离排序）" : "（按批次排序）"}
              </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {listLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : loadError ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground px-6 text-center">
                  <p className="text-sm text-foreground">列表数据加载失败</p>
                  <p className="mt-1 text-xs">请稍后刷新重试；如果部署刚更新，通常重新部署后即可恢复。</p>
                </div>
              ) : listData?.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <p className="text-sm">未找到匹配的文保单位</p>
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

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 p-3 border-t border-border/30">
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

        {/* Detail view */}
        {selectedSiteId && (
          <div className="absolute inset-0 bg-white z-30 overflow-hidden">
            <SiteDetail
              siteId={selectedSiteId}
              onBack={handleBack}
              onLocateOnMap={handleLocateOnMap}
            />
          </div>
        )}
      </div>

      {/* Bottom tab bar */}
      {!selectedSiteId && (
        <nav className="bg-white border-t border-border/40 shadow-[0_-2px_8px_rgba(0,0,0,0.05)] z-20 shrink-0">
          <div className="flex items-center justify-around max-w-md mx-auto">
            <button
              onClick={() => setViewMode("map")}
              className={`flex flex-col items-center gap-0.5 py-2 px-6 transition-colors ${
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
              className={`flex flex-col items-center gap-0.5 py-2 px-6 transition-colors ${
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
