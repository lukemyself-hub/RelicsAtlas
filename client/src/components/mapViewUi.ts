import type { MapSite } from "@/types";
import { renderSiteTypeIconSvg } from "@/lib/site-ui";
import type { RenderNode } from "@shared/map-clustering";

export const MAP_MARKER_TRANSITION_MS = 220;

export function createSiteInfoContent(
  site: MapSite,
  onDetailClick: () => void,
) {
  const infoContent = document.createElement("div");
  infoContent.style.cssText = `
    min-width: 260px;
    padding: 18px 18px 16px;
    background: #ffffff;
    border-radius: 24px;
    box-shadow: 0 24px 48px rgba(18, 31, 27, 0.18);
    border: 1px solid rgba(216, 219, 212, 0.9);
    position: relative;
    isolation: isolate;
    overflow: visible;
  `;

  const eyebrow = document.createElement("div");
  eyebrow.style.cssText =
    "font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#6a726d;margin-bottom:8px";
  eyebrow.textContent = "文保点位";
  infoContent.appendChild(eyebrow);

  const title = document.createElement("div");
  title.style.cssText =
    'font-family:"Noto Serif SC","Source Han Serif SC","Songti SC",serif;font-weight:600;font-size:22px;line-height:1.25;margin-bottom:8px;color:#181c1a';
  title.textContent = site.name;
  infoContent.appendChild(title);

  const meta = document.createElement("div");
  meta.style.cssText =
    "color:#58615c;font-size:14px;line-height:1.6;margin-bottom:8px;font-weight:500";
  meta.textContent = [site.type, site.batch].filter(Boolean).join(" · ");
  infoContent.appendChild(meta);

  if (site.address) {
    const address = document.createElement("div");
    address.style.cssText =
      "color:#6a726d;font-size:13px;line-height:1.65;margin-bottom:14px;max-width:260px";
    address.textContent = site.address;
    infoContent.appendChild(address);
  }

  const button = document.createElement("button");
  button.type = "button";
  button.style.cssText =
    "position:relative;z-index:1;width:100%;padding:12px 16px;background:#057a5d;color:white;border:none;border-radius:999px;cursor:pointer;font-size:14px;font-weight:700;box-shadow:0 14px 28px rgba(5,122,93,0.22)";
  button.textContent = "查看详情";
  button.addEventListener("click", onDetailClick);
  infoContent.appendChild(button);

  const infoArrow = document.createElement("div");
  infoArrow.style.cssText = `
    position: absolute;
    left: 50%;
    bottom: -10px;
    width: 20px;
    height: 20px;
    background: #ffffff;
    border-right: 1px solid rgba(216, 219, 212, 0.9);
    border-bottom: 1px solid rgba(216, 219, 212, 0.9);
    transform: translateX(-50%) rotate(45deg);
    z-index: 0;
  `;
  infoContent.appendChild(infoArrow);

  return infoContent;
}

export function createSiteMarkerContent(type: string | null) {
  const markerContent = document.createElement("div");
  markerContent.style.cssText = `
    width: 44px;
    height: 60px;
    position: relative;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    cursor: pointer;
    will-change: transform, opacity;
  `;

  const pin = document.createElement("div");
  pin.style.cssText = `
    width: 36px;
    height: 36px;
    background: linear-gradient(180deg, #1d2120 0%, #101312 100%);
    border: 2px solid rgba(255,255,255,0.95);
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 16px 26px rgba(0, 0, 0, 0.22);
  `;

  const iconHolder = document.createElement("div");
  iconHolder.style.cssText = `
    width: 18px;
    height: 18px;
    color: #ffffff;
    transform: rotate(45deg);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  `;
  iconHolder.innerHTML = renderSiteTypeIconSvg(type, {
    size: 18,
    strokeWidth: 2,
  });
  pin.appendChild(iconHolder);
  markerContent.appendChild(pin);

  return markerContent;
}

export function createClusterMarkerContent(count: number) {
  const clusterContent = document.createElement("div");
  clusterContent.style.cssText = `
    width: 52px;
    height: 52px;
    background: linear-gradient(180deg, #0b8767 0%, #057a5d 100%);
    border: 3px solid rgba(255, 255, 255, 0.95);
    border-radius: 50%;
    box-shadow: 0 18px 32px rgba(5, 122, 93, 0.26);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    color: white;
    font-size: 21px;
    cursor: pointer;
    will-change: transform, opacity;
  `;
  clusterContent.textContent = String(count);
  return clusterContent;
}

export function animateMarkerToNode(
  marker: any,
  node: RenderNode,
  hasSource: boolean,
) {
  const content = marker.getContent?.() as HTMLElement | null;
  if (content) {
    content.style.transition = `transform ${MAP_MARKER_TRANSITION_MS}ms ease-out, opacity ${MAP_MARKER_TRANSITION_MS}ms ease-out`;
    content.style.opacity = hasSource ? "0.55" : "1";
    const baseTransform = "translateZ(0)";
    content.style.transform = `${baseTransform} scale(${hasSource ? 0.82 : 1})`;
    window.requestAnimationFrame(() => {
      content.style.opacity = "1";
      content.style.transform = `${baseTransform} scale(1)`;
    });
  }

  if (hasSource && typeof marker.moveTo === "function") {
    marker.moveTo([node.anchorLng, node.anchorLat], {
      duration: MAP_MARKER_TRANSITION_MS,
      autoRotation: false,
    });
    return;
  }

  marker.setPosition([node.anchorLng, node.anchorLat]);
}
