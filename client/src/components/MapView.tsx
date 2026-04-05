import { useEffect, useRef, useCallback, useState } from "react";
import type { MapSite } from "@/types";

interface MapViewProps {
  sites: MapSite[];
  onSiteClick: (siteId: number) => void;
  userLocation?: { lat: number; lng: number } | null;
  highlightSiteId?: number | null;
}

// 简单的聚合算法
function clusterSites(sites: MapSite[], zoomLevel: number) {
  if (zoomLevel >= 15 || sites.length <= 1) {
    return sites.map(site => ({ sites: [site], count: 1, lat: site.latitude, lng: site.longitude }));
  }

  const clusters: Array<{ sites: MapSite[]; count: number; lat: number; lng: number }> = [];
  const processed = new Set<number>();
  const clusterDistance = 100 / Math.pow(2, zoomLevel - 3);

  sites.forEach(site => {
    if (processed.has(site.id)) return;

    const cluster = [site];
    processed.add(site.id);

    sites.forEach(other => {
      if (processed.has(other.id)) return;
      
      const dx = (other.longitude - site.longitude) * 111 * Math.cos((site.latitude * Math.PI) / 180);
      const dy = (other.latitude - site.latitude) * 111;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < clusterDistance) {
        cluster.push(other);
        processed.add(other.id);
      }
    });

    const avgLat = cluster.reduce((sum, s) => sum + s.latitude, 0) / cluster.length;
    const avgLng = cluster.reduce((sum, s) => sum + s.longitude, 0) / cluster.length;
    clusters.push({ sites: cluster, count: cluster.length, lat: avgLat, lng: avgLng });
  });

  return clusters;
}

export default function MapView({ sites, onSiteClick, userLocation, highlightSiteId }: MapViewProps) {
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
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

    // 监听缩放事件以更新聚合
    map.on("zoomchange", () => {
      updateMarkers();
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, [mapLoaded]);

  // 更新标记
  const updateMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !sites.length) return;

    const AMap = (window as any).AMap;
    if (!AMap) return;

    // 清除旧标记
    markersRef.current.forEach(marker => {
      map.remove(marker);
    });
    markersRef.current = [];

    const zoomLevel = map.getZoom();
    const clusters = clusterSites(sites, zoomLevel);

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
          infoContent.style.cssText = "padding:10px;min-width:180px;font-size:13px;";
          infoContent.innerHTML = `
            <div style="font-weight:600;font-size:14px;margin-bottom:6px;color:#333">${site.name}</div>
            <div style="color:#666;font-size:12px;margin-bottom:3px">${site.era || ""}</div>
            <div style="color:#666;font-size:12px;margin-bottom:8px">${site.type || ""} · ${site.batch || ""}</div>
            <button id="detail-btn-${site.id}" style="width:100%;padding:6px;background:#3b82f6;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:500">查看详情</button>
          `;

          const infoWindow = new AMap.InfoWindow({
            content: infoContent,
            isCustom: true,
            offset: new AMap.Pixel(0, -30),
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

        map.add(marker);
        markersRef.current.push(marker);
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

        map.add(marker);
        markersRef.current.push(marker);
      }
    });
  }, [sites, onSiteClick]);

  // 当 sites 改变时更新标记
  useEffect(() => {
    updateMarkers();
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
