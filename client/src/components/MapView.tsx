import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import type { MapSite } from "@/types";
import { wgs84ToGcj02 } from "@shared/coordinate-system";
import {
  buildRenderNodes,
  clampZoomLevel,
  clusterProjectedSites,
  getClusterFocusBounds,
  getDynamicClusterRadius,
  matchTransitionSources,
  projectVisibleSites,
  resolveClusterExpansionZoom,
  type ClusterGroup,
  type RenderNode,
} from "@shared/map-clustering";
import {
  animateMarkerToNode,
  createClusterMarkerContent,
  createSiteInfoContent,
  createSiteMarkerContent,
  MAP_MARKER_TRANSITION_MS,
} from "./mapViewUi";

interface MapViewProps {
  sites: MapSite[];
  onSiteClick: (siteId: number) => void;
  userLocation?: { lat: number; lng: number } | null;
  highlightSiteId?: number | null;
  locateRequest?: number | null;
  initialViewport?: {
    center: { lat: number; lng: number };
    zoom: number;
  } | null;
  onViewportChange?: (viewport: {
    center: { lat: number; lng: number };
    zoom: number;
  }) => void;
  onHighlightHandled?: (siteId: number) => void;
  onLocateHandled?: () => void;
}

type MarkerRecord = {
  marker: any;
  node: RenderNode;
};

type MapViewport = {
  center: { lat: number; lng: number };
  zoom: number;
};

type DisplayMapSite = MapSite & {
  displayLongitude: number;
  displayLatitude: number;
};

type ClusterDisplaySite = DisplayMapSite & {
  longitude: number;
  latitude: number;
};

const CLUSTER_FIT_PADDING = [96, 96, 96, 96] as const;
const CLUSTER_ZOOM_STEP = 2;
const MAP_MIN_ZOOM = 3;
const POI_VISIBLE_MAX_ZOOM = 18;
const SITE_FOCUS_ZOOM = 15;
const DEFAULT_VIEWPORT = {
  center: { lng: 104.2, lat: 35.86 },
  zoom: 5,
} as const;

export default function MapView({
  sites,
  onSiteClick,
  userLocation,
  highlightSiteId,
  locateRequest,
  initialViewport,
  onViewportChange,
  onHighlightHandled,
  onLocateHandled,
}: MapViewProps) {
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, MarkerRecord>>(new Map());
  const infoWindowRef = useRef<any>(null);
  const refreshFrameRef = useRef<number | null>(null);
  const pendingViewportReportRef = useRef(false);
  const pendingFocusSiteIdRef = useRef<number | null>(highlightSiteId ?? null);
  const pendingInfoSiteIdRef = useRef<number | null>(highlightSiteId ?? null);
  const userMarkerRef = useRef<any>(null);
  const suppressMapClickRef = useRef(false);
  const suppressMapClickTimerRef = useRef<number | null>(null);
  const transitionTimersRef = useRef<number[]>([]);
  const initialViewportRef = useRef(initialViewport ?? null);
  const onViewportChangeRef = useRef(onViewportChange);
  const lastViewportRef = useRef<MapViewport | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const displaySites = useMemo(
    () =>
      sites.map((site) => {
        const displayPoint = wgs84ToGcj02(site.mapLongitude, site.mapLatitude);
        return {
          ...site,
          displayLongitude: displayPoint.lng,
          displayLatitude: displayPoint.lat,
        };
      }),
    [sites]
  );
  const displayUserLocation = useMemo(() => {
    if (!userLocation) return null;
    return wgs84ToGcj02(userLocation.lng, userLocation.lat);
  }, [userLocation]);

  const clearTransitionTimers = useCallback(() => {
    for (const timer of transitionTimersRef.current) {
      window.clearTimeout(timer);
    }
    transitionTimersRef.current = [];
  }, []);

  const suppressNextMapClick = useCallback(() => {
    suppressMapClickRef.current = true;
    if (suppressMapClickTimerRef.current !== null) {
      window.clearTimeout(suppressMapClickTimerRef.current);
    }
    suppressMapClickTimerRef.current = window.setTimeout(() => {
      suppressMapClickRef.current = false;
      suppressMapClickTimerRef.current = null;
    }, 0);
  }, []);

  const closeInfoWindow = useCallback(() => {
    if (infoWindowRef.current) {
      infoWindowRef.current.close();
      infoWindowRef.current = null;
    }
  }, []);

  const openSiteInfo = useCallback(
    (site: MapSite, marker: any, lngLat?: any) => {
      const map = mapRef.current;
      const AMap = (window as any).AMap;
      if (!map || !AMap) return;

      closeInfoWindow();

      const infoWindow = new AMap.InfoWindow({
        content: createSiteInfoContent(site, () => onSiteClick(site.id)),
        isCustom: true,
        offset: new AMap.Pixel(0, -42),
      });

      const position = lngLat ?? marker.getPosition?.();
      if (position) {
        infoWindow.open(map, position);
        infoWindowRef.current = infoWindow;
      }
    },
    [closeInfoWindow, onSiteClick]
  );

  const focusSite = useCallback(
    (siteId: number) => {
      const map = mapRef.current;
      const AMap = (window as any).AMap;
      if (!map || !AMap) {
        pendingFocusSiteIdRef.current = siteId;
        pendingInfoSiteIdRef.current = siteId;
        return;
      }

      const displaySite = displaySites.find((item) => item.id === siteId);
      if (!displaySite) return;

      pendingFocusSiteIdRef.current = null;
      pendingInfoSiteIdRef.current = siteId;
      const maxZoom = getMapMaxZoom(map);
      map.setZoomAndCenter(
        clampZoomLevel(SITE_FOCUS_ZOOM, MAP_MIN_ZOOM, maxZoom),
        new AMap.LngLat(displaySite.displayLongitude, displaySite.displayLatitude),
        true
      );
      onHighlightHandled?.(siteId);
    },
    [displaySites, onHighlightHandled]
  );

  const updateMarkersRef = useRef<(() => void) | null>(null);

  const getCurrentViewport = useCallback((): MapViewport | null => {
    const map = mapRef.current;
    const center = map?.getCenter?.();
    const zoom = map?.getZoom?.();
    if (!center || typeof zoom !== "number") return null;

    return {
      center: { lat: center.getLat(), lng: center.getLng() },
      zoom,
    };
  }, []);

  const reportViewportChange = useCallback(() => {
    const viewport = getCurrentViewport();
    if (!viewport) return;
    if (isSameViewport(lastViewportRef.current, viewport)) return;

    lastViewportRef.current = viewport;
    onViewportChangeRef.current?.(viewport);
  }, [getCurrentViewport]);

  const scheduleRefresh = useCallback((shouldReportViewport = false) => {
    pendingViewportReportRef.current = pendingViewportReportRef.current || shouldReportViewport;
    if (refreshFrameRef.current !== null) {
      return;
    }

    refreshFrameRef.current = window.requestAnimationFrame(() => {
      refreshFrameRef.current = null;
      updateMarkersRef.current?.();

      if (pendingViewportReportRef.current) {
        pendingViewportReportRef.current = false;
        reportViewportChange();
      }
    });
  }, [reportViewportChange]);

  useEffect(() => {
    pendingFocusSiteIdRef.current = highlightSiteId ?? null;
    pendingInfoSiteIdRef.current = highlightSiteId ?? null;
  }, [highlightSiteId]);

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  useEffect(() => {
    if ((window as any).AMap) {
      setMapLoaded(true);
      return;
    }

    (window as any)._AMapSecurityConfig = {
      serviceHost: "/_AMapService",
    };

    const script = document.createElement("script");
    script.src = "https://webapi.amap.com/maps?v=2.0&key=006cfca5044ae7c111675b920aabdfc5";
    script.async = true;
    script.onload = () => {
      setMapLoaded(true);
    };
    script.onerror = () => {
      console.error("Failed to load AMap SDK");
    };
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    if (!mapLoaded || !containerRef.current || mapRef.current) return;

    const AMap = (window as any).AMap;
    if (!AMap) return;

    const map = new AMap.Map(containerRef.current, {
      viewMode: "2D",
      zoom: clampZoomLevel(
        initialViewportRef.current?.zoom ?? DEFAULT_VIEWPORT.zoom,
        MAP_MIN_ZOOM,
        POI_VISIBLE_MAX_ZOOM
      ),
      center: [
        initialViewportRef.current?.center.lng ?? DEFAULT_VIEWPORT.center.lng,
        initialViewportRef.current?.center.lat ?? DEFAULT_VIEWPORT.center.lat,
      ],
      mapStyle: "amap://styles/light",
      zooms: [MAP_MIN_ZOOM, POI_VISIBLE_MAX_ZOOM],
    });

    mapRef.current = map;
    AMap.plugin(["AMap.MoveAnimation"], () => {});

    map.on("complete", () => scheduleRefresh(true));
    map.on("moveend", () => scheduleRefresh(true));
    map.on("zoomend", () => scheduleRefresh(true));
    map.on("resize", () => scheduleRefresh(true));
    map.on("click", () => {
      if (suppressMapClickRef.current) return;
      closeInfoWindow();
    });

    scheduleRefresh(true);

    return () => {
      if (refreshFrameRef.current !== null) {
        window.cancelAnimationFrame(refreshFrameRef.current);
        refreshFrameRef.current = null;
      }
      if (suppressMapClickTimerRef.current !== null) {
        window.clearTimeout(suppressMapClickTimerRef.current);
        suppressMapClickTimerRef.current = null;
      }
      clearTransitionTimers();
      closeInfoWindow();
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, [clearTransitionTimers, closeInfoWindow, mapLoaded, scheduleRefresh]);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = (window as any).AMap;
    if (!map || !AMap || !initialViewport) return;

    const currentViewport = getCurrentViewport();
    if (isSameViewport(currentViewport, initialViewport)) {
      lastViewportRef.current = currentViewport;
      return;
    }

    map.setZoomAndCenter(
      clampZoomLevel(initialViewport.zoom, MAP_MIN_ZOOM, getMapMaxZoom(map)),
      new AMap.LngLat(initialViewport.center.lng, initialViewport.center.lat),
      true
    );
    scheduleRefresh(true);
  }, [getCurrentViewport, initialViewport, scheduleRefresh]);

  const updateMarkers = useCallback(() => {
    const map = mapRef.current;
    const AMap = (window as any).AMap;
    if (!map || !AMap || !containerRef.current) return;

    if (!displaySites.length) {
      if (markersRef.current.size > 0) {
        map.remove(Array.from(markersRef.current.values(), (entry) => entry.marker));
        markersRef.current.clear();
      }
      closeInfoWindow();
      return;
    }

    const size = map.getSize?.();
    const viewport = {
      width: size?.width ?? containerRef.current.clientWidth,
      height: size?.height ?? containerRef.current.clientHeight,
    };

    const clusterDisplaySites: ClusterDisplaySite[] = displaySites.map((site) => ({
      ...site,
      longitude: site.displayLongitude,
      latitude: site.displayLatitude,
    }));

    const projectedSites = projectVisibleSites(clusterDisplaySites, viewport, (site) => {
      const point = map.lngLatToContainer(new AMap.LngLat(site.longitude, site.latitude));
      if (!point) return null;
      return { x: point.getX(), y: point.getY() };
    });

    const radiusPx = getDynamicClusterRadius(viewport);
    const clusters = clusterProjectedSites(projectedSites, radiusPx, (point) => {
      const lngLat = map.containerToLngLat(new AMap.Pixel(point.x, point.y));
      if (!lngLat) return null;
      return { lat: lngLat.getLat(), lng: lngLat.getLng() };
    });

    const siteById = new Map(displaySites.map((site) => [site.id, site]));
    const nextNodes = matchTransitionSources(
      Array.from(markersRef.current.values(), (entry) => entry.node),
      buildRenderNodes(clusters)
    );
    const previousMarkersByKey = new Map(markersRef.current);
    const nextMarkerRecords = new Map<string, MarkerRecord>();

    clearTransitionTimers();

    for (const node of nextNodes) {
      const existing = previousMarkersByKey.get(node.key);
      if (existing) {
        previousMarkersByKey.delete(node.key);
        updateMarkerRecord({
          node,
          record: existing,
          siteById,
        });
        nextMarkerRecords.set(node.key, {
          marker: existing.marker,
          node,
        });
        continue;
      }

      const newRecord = createMarkerRecord({
        AMap,
        node,
        siteById,
        sourceNode: node.sourceKey ? markersRef.current.get(node.sourceKey)?.node : undefined,
        onClusterClick: (cluster) => {
          suppressNextMapClick();
          focusCluster(map, AMap, cluster);
        },
        onSiteMarkerClick: (site, marker, lngLat) => {
          suppressNextMapClick();
          pendingInfoSiteIdRef.current = site.id;
          openSiteInfo(site, marker, lngLat);
        },
      });

      if (!newRecord) {
        continue;
      }

      nextMarkerRecords.set(node.key, newRecord);
      map.add(newRecord.marker);
    }

    if (previousMarkersByKey.size > 0) {
      map.remove(Array.from(previousMarkersByKey.values(), (entry) => entry.marker));
    }

    for (const entry of Array.from(nextMarkerRecords.values())) {
      animateMarkerToNode(entry.marker, entry.node, entry.node.sourceKey !== undefined);

      if (pendingInfoSiteIdRef.current !== null && entry.node.type === "site") {
        const site = siteById.get(pendingInfoSiteIdRef.current);
        if (site && entry.node.siteIds[0] === site.id) {
          const timer = window.setTimeout(() => {
            openSiteInfo(site, entry.marker);
            pendingInfoSiteIdRef.current = null;
          }, MAP_MARKER_TRANSITION_MS);
          transitionTimersRef.current.push(timer);
        }
      }
    }

    markersRef.current = nextMarkerRecords;

    if (pendingFocusSiteIdRef.current !== null) {
      const siteToFocus = pendingFocusSiteIdRef.current;
      pendingFocusSiteIdRef.current = null;
      focusSite(siteToFocus);
    }
  }, [
    clearTransitionTimers,
    closeInfoWindow,
    displaySites,
    focusSite,
    openSiteInfo,
    suppressNextMapClick,
  ]);

  updateMarkersRef.current = updateMarkers;

  useEffect(() => {
    scheduleRefresh();
  }, [displaySites, scheduleRefresh, updateMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = (window as any).AMap;
    if (!map || !AMap) return;

    if (userMarkerRef.current) {
      map.remove(userMarkerRef.current);
      userMarkerRef.current = null;
    }

    if (!displayUserLocation) return;

    const userContent = document.createElement("div");
    userContent.style.cssText = `
      width: 16px;
      height: 16px;
      background: #3b82f6;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 0 0 2px rgba(59,130,246,0.3), 0 2px 4px rgba(0,0,0,0.2);
    `;

    const userMarker = new AMap.Marker({
      position: new AMap.LngLat(displayUserLocation.lng, displayUserLocation.lat),
      content: userContent,
      offset: new AMap.Pixel(-8, -8),
      zIndex: 1000,
    });

    userMarkerRef.current = userMarker;
    map.add(userMarker);

    return () => {
      if (userMarkerRef.current) {
        map.remove(userMarkerRef.current);
        userMarkerRef.current = null;
      }
    };
  }, [displayUserLocation]);

  useEffect(() => {
    if (locateRequest == null) return;

    const map = mapRef.current;
    const AMap = (window as any).AMap;
    if (!map || !AMap || !displayUserLocation) return;

    closeInfoWindow();
    map.setZoomAndCenter(
      clampZoomLevel(12, MAP_MIN_ZOOM, getMapMaxZoom(map)),
      new AMap.LngLat(displayUserLocation.lng, displayUserLocation.lat),
      true
    );
    onLocateHandled?.();
  }, [closeInfoWindow, displayUserLocation, locateRequest, mapLoaded, onLocateHandled]);

  useEffect(() => {
    if (highlightSiteId == null) return;
    focusSite(highlightSiteId);
  }, [focusSite, highlightSiteId]);

  return <div ref={containerRef} className="w-full h-full" style={{ minHeight: "300px" }} />;
}

function createMarkerRecord({
  AMap,
  node,
  siteById,
  sourceNode,
  onClusterClick,
  onSiteMarkerClick,
}: {
  AMap: any;
  node: RenderNode;
  siteById: Map<number, DisplayMapSite>;
  sourceNode?: RenderNode;
  onClusterClick: (cluster: ClusterGroup<DisplayMapSite>) => void;
  onSiteMarkerClick: (site: DisplayMapSite, marker: any, lngLat?: any) => void;
}): MarkerRecord | null {
  const position = sourceNode ?? node;
  const marker = new AMap.Marker({
    position: new AMap.LngLat(position.anchorLng, position.anchorLat),
    content:
      node.type === "site"
        ? createSiteMarkerContent()
        : createClusterMarkerContent(node.count),
    offset: node.type === "site" ? new AMap.Pixel(-14, -28) : new AMap.Pixel(-20, -20),
  });

  const extData = buildMarkerExtData(node, siteById);
  if (!extData) return null;

  marker.setExtData(extData);
  marker.on("click", (event: any) => {
    const currentExtData = marker.getExtData?.();
    if (!currentExtData) return;

    if (currentExtData.kind === "site") {
      onSiteMarkerClick(currentExtData.site, marker, event?.lnglat);
      return;
    }

    onClusterClick(currentExtData.cluster);
  });

  if (extData.kind === "site") {
    marker.setTitle?.(extData.site.name);
  }

  return { marker, node };
}

function updateMarkerRecord({
  node,
  record,
  siteById,
}: {
  node: RenderNode;
  record: MarkerRecord;
  siteById: Map<number, DisplayMapSite>;
}) {
  const extData = buildMarkerExtData(node, siteById);
  if (!extData) {
    return;
  }

  record.marker.setExtData(extData);
  record.marker.setTitle?.(extData.kind === "site" ? extData.site.name : "");
  record.node = node;
}

function buildMarkerExtData(node: RenderNode, siteById: Map<number, DisplayMapSite>) {
  if (node.type === "site") {
    const site = siteById.get(node.siteIds[0]);
    if (!site) return null;

    return {
      kind: "site" as const,
      site,
    };
  }

  const clusterSites = node.siteIds
    .map((siteId) => siteById.get(siteId))
    .filter((site): site is DisplayMapSite => Boolean(site));
  if (clusterSites.length === 0) return null;

  return {
    kind: "cluster" as const,
    cluster: {
      sites: clusterSites,
      count: clusterSites.length,
      lat: node.lat,
      lng: node.lng,
      anchorLat: node.anchorLat,
      anchorLng: node.anchorLng,
      point: node.point,
    } satisfies ClusterGroup<DisplayMapSite>,
  };
}

function focusCluster(map: any, AMap: any, cluster: ClusterGroup<DisplayMapSite>) {
  const bounds = getClusterFocusBounds(
    cluster.sites.map((site) => ({
      ...site,
      latitude: site.displayLatitude,
      longitude: site.displayLongitude,
    }))
  );
  const zoomRange = map.getZooms?.();
  const maxZoom = Array.isArray(zoomRange) ? zoomRange[1] : POI_VISIBLE_MAX_ZOOM;
  const currentZoom = map.getZoom();
  const safeCurrentZoom = typeof currentZoom === "number" ? currentZoom : MAP_MIN_ZOOM;

  if (!bounds) {
    map.setZoomAndCenter(
      Math.min(safeCurrentZoom + CLUSTER_ZOOM_STEP, maxZoom),
      new AMap.LngLat(cluster.lng, cluster.lat),
      true
    );
    return;
  }

  const [zoom, center] = map.getFitZoomAndCenterByBounds(
    new AMap.Bounds(bounds.southWest, bounds.northEast),
    [...CLUSTER_FIT_PADDING]
  );

  const nextZoom = resolveClusterExpansionZoom(
    safeCurrentZoom,
    typeof zoom === "number" ? zoom : null,
    maxZoom
  );

  if (center) {
    map.setZoomAndCenter(nextZoom, center, true);
    return;
  }

  map.setZoomAndCenter(
    Math.min(safeCurrentZoom + CLUSTER_ZOOM_STEP, maxZoom),
    new AMap.LngLat(cluster.lng, cluster.lat),
    true
  );
}

function getMapMaxZoom(map: any) {
  const zoomRange = map?.getZooms?.();
  return Array.isArray(zoomRange) ? zoomRange[1] : POI_VISIBLE_MAX_ZOOM;
}

function isSameViewport(a: MapViewport | null | undefined, b: MapViewport | null | undefined) {
  if (!a || !b) return false;

  return (
    Math.abs(a.center.lat - b.center.lat) < 1e-6 &&
    Math.abs(a.center.lng - b.center.lng) < 1e-6 &&
    Math.abs(a.zoom - b.zoom) < 1e-6
  );
}
