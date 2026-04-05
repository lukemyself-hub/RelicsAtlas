import { useEffect, useRef, useCallback, useState } from "react";
import type { MapSite } from "@/types";
import {
  buildRenderNodes,
  clusterProjectedSites,
  getClusterFocusBounds,
  getDynamicClusterRadius,
  matchTransitionSources,
  projectVisibleSites,
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
  initialViewport?: {
    center: { lat: number; lng: number };
    zoom: number;
  } | null;
  onViewportChange?: (viewport: {
    center: { lat: number; lng: number };
    zoom: number;
  }) => void;
  onHighlightHandled?: (siteId: number) => void;
}

type MarkerRecord = {
  marker: any;
  node: RenderNode;
};

const CLUSTER_FIT_PADDING = [96, 96, 96, 96] as const;
const CLUSTER_MAX_ZOOM = 12;
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
  initialViewport,
  onViewportChange,
  onHighlightHandled,
}: MapViewProps) {
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<MarkerRecord[]>([]);
  const infoWindowRef = useRef<any>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const pendingFocusSiteIdRef = useRef<number | null>(highlightSiteId ?? null);
  const pendingInfoSiteIdRef = useRef<number | null>(highlightSiteId ?? null);
  const userMarkerRef = useRef<any>(null);
  const suppressMapClickRef = useRef(false);
  const suppressMapClickTimerRef = useRef<number | null>(null);
  const transitionTimersRef = useRef<number[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

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

      const site = sites.find((item) => item.id === siteId);
      if (!site) return;

      pendingFocusSiteIdRef.current = null;
      pendingInfoSiteIdRef.current = siteId;
      map.setZoomAndCenter(SITE_FOCUS_ZOOM, new AMap.LngLat(site.longitude, site.latitude), true);
      onHighlightHandled?.(siteId);
    },
    [onHighlightHandled, sites]
  );

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      updateMarkersRef.current?.();
    }, 16);
  }, []);

  const updateMarkersRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    pendingFocusSiteIdRef.current = highlightSiteId ?? null;
    pendingInfoSiteIdRef.current = highlightSiteId ?? null;
  }, [highlightSiteId]);

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
      zoom: initialViewport?.zoom ?? DEFAULT_VIEWPORT.zoom,
      center: [
        initialViewport?.center.lng ?? DEFAULT_VIEWPORT.center.lng,
        initialViewport?.center.lat ?? DEFAULT_VIEWPORT.center.lat,
      ],
      mapStyle: "amap://styles/light",
      zooms: [3, 20],
    });

    mapRef.current = map;
    AMap.plugin(["AMap.MoveAnimation"], () => {});

    map.on("complete", scheduleRefresh);
    map.on("moveend", scheduleRefresh);
    map.on("zoomchange", scheduleRefresh);
    map.on("resize", scheduleRefresh);
    map.on("moveend", () => {
      const center = map.getCenter?.();
      const zoom = map.getZoom?.();
      if (!center || typeof zoom !== "number") return;
      onViewportChange?.({
        center: { lat: center.getLat(), lng: center.getLng() },
        zoom,
      });
    });
    map.on("zoomchange", () => {
      const center = map.getCenter?.();
      const zoom = map.getZoom?.();
      if (!center || typeof zoom !== "number") return;
      onViewportChange?.({
        center: { lat: center.getLat(), lng: center.getLng() },
        zoom,
      });
    });
    map.on("click", () => {
      if (suppressMapClickRef.current) return;
      closeInfoWindow();
    });

    scheduleRefresh();

    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
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
  }, [clearTransitionTimers, closeInfoWindow, initialViewport, mapLoaded, onViewportChange, scheduleRefresh]);

  const updateMarkers = useCallback(() => {
    const map = mapRef.current;
    const AMap = (window as any).AMap;
    if (!map || !AMap || !containerRef.current) return;

    if (!sites.length) {
      if (markersRef.current.length > 0) {
        map.remove(markersRef.current.map((entry) => entry.marker));
        markersRef.current = [];
      }
      closeInfoWindow();
      return;
    }

    const size = map.getSize?.();
    const viewport = {
      width: size?.width ?? containerRef.current.clientWidth,
      height: size?.height ?? containerRef.current.clientHeight,
    };

    const projectedSites = projectVisibleSites(sites, viewport, (site) => {
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

    const nextNodes = matchTransitionSources(
      markersRef.current.map((entry) => entry.node),
      buildRenderNodes(clusters)
    );
    const previousMarkersByKey = new Map(markersRef.current.map((entry) => [entry.node.key, entry]));
    const nextMarkerRecords = nextNodes.map((node) =>
      createMarkerRecord({
        AMap,
        node,
        sites,
        sourceNode: node.sourceKey ? previousMarkersByKey.get(node.sourceKey)?.node : undefined,
        onClusterClick: (cluster) => {
          suppressNextMapClick();
          focusCluster(map, AMap, cluster);
        },
        onSiteMarkerClick: (site, marker, lngLat) => {
          suppressNextMapClick();
          pendingInfoSiteIdRef.current = site.id;
          openSiteInfo(site, marker, lngLat);
        },
      })
    );

    clearTransitionTimers();
    if (markersRef.current.length > 0) {
      map.remove(markersRef.current.map((entry) => entry.marker));
    }
    if (nextMarkerRecords.length > 0) {
      map.add(nextMarkerRecords.map((entry) => entry.marker));
    }

    for (const entry of nextMarkerRecords) {
      animateMarkerToNode(entry.marker, entry.node, entry.node.sourceKey !== undefined);

      if (pendingInfoSiteIdRef.current !== null && entry.node.type === "site") {
        const site = sites.find((item) => item.id === pendingInfoSiteIdRef.current);
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
  }, [clearTransitionTimers, closeInfoWindow, focusSite, onSiteClick, openSiteInfo, sites, suppressNextMapClick]);

  updateMarkersRef.current = updateMarkers;

  useEffect(() => {
    scheduleRefresh();
  }, [scheduleRefresh, sites, updateMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = (window as any).AMap;
    if (!map || !AMap) return;

    if (userMarkerRef.current) {
      map.remove(userMarkerRef.current);
      userMarkerRef.current = null;
    }

    if (!userLocation) return;

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
      position: new AMap.LngLat(userLocation.lng, userLocation.lat),
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
  }, [userLocation]);

  useEffect(() => {
    if (highlightSiteId == null) return;
    focusSite(highlightSiteId);
  }, [focusSite, highlightSiteId]);

  return <div ref={containerRef} className="w-full h-full" style={{ minHeight: "300px" }} />;
}

function createMarkerRecord({
  AMap,
  node,
  sites,
  sourceNode,
  onClusterClick,
  onSiteMarkerClick,
}: {
  AMap: any;
  node: RenderNode;
  sites: MapSite[];
  sourceNode?: RenderNode;
  onClusterClick: (cluster: ClusterGroup<MapSite>) => void;
  onSiteMarkerClick: (site: MapSite, marker: any, lngLat?: any) => void;
}): MarkerRecord {
  const position = sourceNode ?? node;
  const marker = new AMap.Marker({
    position: new AMap.LngLat(position.lng, position.lat),
    content:
      node.type === "site"
        ? createSiteMarkerContent()
        : createClusterMarkerContent(node.count),
    offset: node.type === "site" ? new AMap.Pixel(-14, -28) : new AMap.Pixel(-20, -20),
  });

  if (node.type === "site") {
    const site = sites.find((item) => item.id === node.siteIds[0]);
    if (!site) {
      return { marker, node };
    }

    marker.setExtData({ siteId: site.id, site });
    marker.on("click", (event: any) => {
      onSiteMarkerClick(site, marker, event.lnglat);
    });
    marker.setTitle?.(site.name);
  } else {
    const clusterSites = sites.filter((site) => node.siteIds.includes(site.id));
    const cluster: ClusterGroup<MapSite> = {
      sites: clusterSites,
      count: clusterSites.length,
      lat: node.lat,
      lng: node.lng,
      point: node.point,
    };

    marker.on("click", () => {
      onClusterClick(cluster);
    });
  }

  return { marker, node };
}

function focusCluster(map: any, AMap: any, cluster: ClusterGroup<MapSite>) {
  const bounds = getClusterFocusBounds(cluster.sites);
  if (!bounds) return;

  const [zoom, center] = map.getFitZoomAndCenterByBounds(
    new AMap.Bounds(bounds.southWest, bounds.northEast),
    [...CLUSTER_FIT_PADDING],
    CLUSTER_MAX_ZOOM
  );

  if (zoom && center) {
    map.setZoomAndCenter(zoom, center, true);
    return;
  }

  map.setZoomAndCenter(
    Math.min(map.getZoom() + 2, CLUSTER_MAX_ZOOM),
    new AMap.LngLat(cluster.lng, cluster.lat),
    true
  );
}
