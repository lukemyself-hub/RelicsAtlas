import { useEffect, useRef, useCallback, useState } from "react";
import type { MapSite } from "@/types";

interface MapViewProps {
  sites: MapSite[];
  onSiteClick: (siteId: number) => void;
  userLocation?: { lat: number; lng: number } | null;
  highlightSiteId?: number | null;
}

interface ClusterGroup {
  sites: MapSite[];
  count: number;
  lat: number;
  lng: number;
}

function getClusterDistanceKm(zoomLevel: number) {
  if (zoomLevel <= 4) return 280;
  if (zoomLevel <= 5) return 180;
  if (zoomLevel <= 6) return 120;
  if (zoomLevel <= 7) return 80;
  if (zoomLevel <= 8) return 52;
  if (zoomLevel <= 10) return 30;
  return Math.max(6, 100 / Math.pow(2, zoomLevel - 3));
}

// 基于网格的 O(n) 聚合算法，支持视口裁剪
function clusterSites(
  sites: MapSite[],
  zoomLevel: number,
  bounds?: { swLat: number; swLng: number; neLat: number; neLng: number }
): ClusterGroup[] {
  // 视口裁剪：只处理当前可见区域（加 20% 内边距）内的点位
  let visible = sites;
  if (bounds) {
    const padLat = (bounds.neLat - bounds.swLat) * 0.2;
    const padLng = (bounds.neLng - bounds.swLng) * 0.2;
    visible = sites.filter(
      (s) =>
        s.latitude >= bounds.swLat - padLat &&
        s.latitude <= bounds.neLat + padLat &&
        s.longitude >= bounds.swLng - padLng &&
        s.longitude <= bounds.neLng + padLng
    );
  }

  if (zoomLevel >= 15 || visible.length <= 1) {
    return visible.map((s) => ({ sites: [s], count: 1, lat: s.latitude, lng: s.longitude }));
  }

  // 全国视角下使用更激进的网格聚合，并按纬度修正经度跨度，减少首屏 DOM 压力。
  const clusterDistKm = getClusterDistanceKm(zoomLevel);
  const cellLatDeg = clusterDistKm / 111;

  const cells = new Map<string, MapSite[]>();
  for (const site of visible) {
    const lngDivisor = Math.max(0.25, Math.cos((site.latitude * Math.PI) / 180));
    const cellLngDeg = clusterDistKm / (111 * lngDivisor);
    const key = `${Math.floor(site.latitude / cellLatDeg)},${Math.floor(site.longitude / cellLngDeg)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key)!.push(site);
  }

  return Array.from(cells.values()).map((group) => ({
    sites: group,
    count: group.length,
    lat: group.reduce((sum, s) => sum + s.latitude, 0) / group.length,
    lng: group.reduce((sum, s) => sum + s.longitude, 0) / group.length,
  }));
}

export default function MapView({ sites, onSiteClick, userLocation, highlightSiteId }: MapViewProps) {
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // 加载高德地图 SDK
  useEffect(() => {
    if ((window as any).AMap) {
      setMapLoaded(true);
      return;
    }

    // Must be set before the SDK script loads; routes AMap service calls through
    // our server proxy so the jscode security key is never exposed to the client.
    (window as any)._AMapSecurityConfig = {
      serviceHost: "/_AMapService",
    };

    const script = document.createElement("script");
    script.src = `https://webapi.amap.com/maps?v=2.0&key=006cfca5044ae7c111675b920aabdfc5`;
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

  // 初始化地图
  useEffect(() => {
    if (!mapLoaded || !containerRef.current || mapRef.current) return;

    const AMap = (window as any).AMap;
    if (!AMap) return;

    const map = new AMap.Map(containerRef.current, {
      viewMode: "2D",
      zoom: 5,
      center: [104.2, 35.86],
      mapStyle: "amap://styles/light",
      zooms: [3, 20],
    });

    mapRef.current = map;

    const scheduleRefresh = () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        updateMarkers();
      }, 16);
    };

    // 首次加载和视口稳定后再刷新，避免数据已到但地图还没真正完成首帧时 marker 不显示。
    map.on("complete", scheduleRefresh);
    map.on("moveend", scheduleRefresh);
    map.on("zoomend", scheduleRefresh);
    map.on("resize", scheduleRefresh);

    scheduleRefresh();

    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, [mapLoaded]);

  // 更新标记
  const updateMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const AMap = (window as any).AMap;
    if (!AMap) return;

    // 批量清除旧标记
    if (markersRef.current.length > 0) {
      map.remove(markersRef.current);
      markersRef.current = [];
    }

    if (!sites.length) return;

    const zoomLevel = map.getZoom();

    // 获取当前视口范围用于裁剪
    let bounds: { swLat: number; swLng: number; neLat: number; neLng: number } | undefined;
    try {
      const mapBounds = map.getBounds();
      const sw = mapBounds.getSouthWest();
      const ne = mapBounds.getNorthEast();
      bounds = { swLat: sw.getLat(), swLng: sw.getLng(), neLat: ne.getLat(), neLng: ne.getLng() };
    } catch {
      // getBounds 在地图初始化阶段可能失败，此时不裁剪
    }

    const clusters = clusterSites(sites, zoomLevel, bounds);
    const nextMarkers: any[] = [];
    clusters.forEach(cluster => {
      if (cluster.count === 1) {
        // 单个标记
        const site = cluster.sites[0];
        
        // 创建自定义标记内容
        const markerContent = document.createElement("div");
        markerContent.style.cssText = `
          width: 28px;
          height: 28px;
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          border: 2.5px solid white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        `;
        
        const innerDot = document.createElement("div");
        innerDot.style.cssText = `
          width: 10px;
          height: 10px;
          background: white;
          border-radius: 50%;
          transform: rotate(45deg);
        `;
        markerContent.appendChild(innerDot);

        const marker = new AMap.Marker({
          position: new AMap.LngLat(site.longitude, site.latitude),
          title: site.name,
          content: markerContent,
          offset: new AMap.Pixel(-14, -28),
        });

        marker.setExtData({ siteId: site.id, site });

        // 使用高德地图的事件系统
        marker.on("click", (e: any) => {
          // 关闭之前的信息窗口
          if (infoWindowRef.current) {
            infoWindowRef.current.close();
          }

          // 创建信息窗口内容
          const infoContent = document.createElement("div");
          infoContent.style.cssText = `
            min-width: 220px;
            padding: 14px 14px 12px;
            background: #ffffff;
            border-radius: 14px;
            box-shadow: 0 16px 36px rgba(15, 23, 42, 0.18);
            border: 1px solid rgba(148, 163, 184, 0.22);
            font-size: 13px;
            position: relative;
          `;
          infoContent.innerHTML = `
            <div style="font-weight:600;font-size:14px;margin-bottom:6px;color:#333">${site.name}</div>
            <div style="color:#666;font-size:12px;margin-bottom:3px">${site.era || ""}</div>
            <div style="color:#666;font-size:12px;margin-bottom:8px">${site.type || ""} · ${site.batch || ""}</div>
            <button id="detail-btn-${site.id}" style="width:100%;padding:6px;background:#3b82f6;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:500">查看详情</button>
          `;

          const infoArrow = document.createElement("div");
          infoArrow.style.cssText = `
            position: absolute;
            left: 50%;
            bottom: -8px;
            width: 16px;
            height: 16px;
            background: #ffffff;
            border-right: 1px solid rgba(148, 163, 184, 0.22);
            border-bottom: 1px solid rgba(148, 163, 184, 0.22);
            transform: translateX(-50%) rotate(45deg);
          `;
          infoContent.appendChild(infoArrow);

          const infoWindow = new AMap.InfoWindow({
            content: infoContent,
            isCustom: true,
            offset: new AMap.Pixel(0, -42),
          });
          infoWindow.open(map, e.lnglat);
          infoWindowRef.current = infoWindow;

          // 添加按钮点击事件
          setTimeout(() => {
            const btn = document.getElementById(`detail-btn-${site.id}`);
            if (btn) {
              btn.addEventListener("click", () => {
                onSiteClick(site.id);
              });
            }
          }, 0);
        });

        nextMarkers.push(marker);
      } else {
        // 聚合标记
        const clusterContent = document.createElement("div");
        clusterContent.style.cssText = `
          width: 40px;
          height: 40px;
          background: #ef4444;
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: white;
          font-size: 16px;
          cursor: pointer;
        `;
        clusterContent.textContent = String(cluster.count);

        const marker = new AMap.Marker({
          position: new AMap.LngLat(cluster.lng, cluster.lat),
          content: clusterContent,
          offset: new AMap.Pixel(-20, -20),
        });

        marker.on("click", (e: any) => {
          map.setZoomAndCenter(map.getZoom() + 1, e.lnglat);
        });

        nextMarkers.push(marker);
      }
    });

    if (nextMarkers.length > 0) {
      map.add(nextMarkers);
      markersRef.current = nextMarkers;
    }
  }, [sites, onSiteClick]);

  // 当 sites 改变时更新标记
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const refresh = () => updateMarkers();
    window.requestAnimationFrame(refresh);
    const timeoutId = window.setTimeout(refresh, 120);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [sites, updateMarkers]);

  // 处理用户位置
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;

    const AMap = (window as any).AMap;
    if (!AMap) return;

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

    map.add(userMarker);

    return () => {
      map.remove(userMarker);
    };
  }, [userLocation]);

  // 高亮特定位置
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !highlightSiteId) return;

    const AMap = (window as any).AMap;
    if (!AMap) return;

    const site = sites.find(s => s.id === highlightSiteId);
    if (site) {
      const position = new AMap.LngLat(site.longitude, site.latitude);
      map.setZoomAndCenter(15, position, true);

      // 查找并点击对应的标记
      setTimeout(() => {
        const marker = markersRef.current.find(m => m.getExtData?.()?.siteId === highlightSiteId);
        if (marker) {
          marker.emit("click");
        }
      }, 500);
    }
  }, [highlightSiteId, sites]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ minHeight: "300px" }}
    />
  );
}
