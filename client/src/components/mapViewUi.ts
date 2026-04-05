import type { MapSite } from "@/types";
import type { RenderNode } from "@shared/map-clustering";

export const MAP_MARKER_TRANSITION_MS = 220;

export function createSiteInfoContent(site: MapSite, onDetailClick: () => void) {
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

  const title = document.createElement("div");
  title.style.cssText = "font-weight:600;font-size:14px;margin-bottom:6px;color:#333";
  title.textContent = site.name;
  infoContent.appendChild(title);

  if (site.era) {
    const era = document.createElement("div");
    era.style.cssText = "color:#666;font-size:12px;margin-bottom:3px";
    era.textContent = site.era;
    infoContent.appendChild(era);
  }

  const meta = document.createElement("div");
  meta.style.cssText = "color:#666;font-size:12px;margin-bottom:8px";
  meta.textContent = [site.type, site.batch].filter(Boolean).join(" · ");
  infoContent.appendChild(meta);

  const button = document.createElement("button");
  button.type = "button";
  button.style.cssText =
    "width:100%;padding:6px;background:#3b82f6;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:500";
  button.textContent = "查看详情";
  button.addEventListener("click", onDetailClick);
  infoContent.appendChild(button);

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

  return infoContent;
}

export function createSiteMarkerContent() {
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
    will-change: transform, opacity;
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

  return markerContent;
}

export function createClusterMarkerContent(count: number) {
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
    will-change: transform, opacity;
  `;
  clusterContent.textContent = String(count);
  return clusterContent;
}

export function animateMarkerToNode(marker: any, node: RenderNode, hasSource: boolean) {
  const content = marker.getContent?.() as HTMLElement | null;
  if (content) {
    content.style.transition = `transform ${MAP_MARKER_TRANSITION_MS}ms ease-out, opacity ${MAP_MARKER_TRANSITION_MS}ms ease-out`;
    content.style.opacity = hasSource ? "0.55" : "1";
    const baseTransform = node.type === "site" ? "rotate(-45deg)" : "translateZ(0)";
    content.style.transform = `${baseTransform} scale(${hasSource ? 0.82 : 1})`;
    window.requestAnimationFrame(() => {
      content.style.opacity = "1";
      content.style.transform = `${baseTransform} scale(1)`;
    });
  }

  if (hasSource && typeof marker.moveTo === "function") {
    marker.moveTo([node.lng, node.lat], {
      duration: MAP_MARKER_TRANSITION_MS,
      autoRotation: false,
    });
    return;
  }

  marker.setPosition([node.lng, node.lat]);
}
