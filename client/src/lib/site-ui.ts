import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Building2,
  Landmark,
  MapPinned,
  Mountain,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

type SiteIconKey =
  | "ancientBuilding"
  | "modernHistoric"
  | "site"
  | "tomb"
  | "grotto"
  | "default";

const SITE_ICON_MAP: Record<SiteIconKey, LucideIcon> = {
  ancientBuilding: Landmark,
  modernHistoric: Building2,
  site: MapPinned,
  tomb: ScrollText,
  grotto: Mountain,
  default: Landmark,
};

function resolveSiteIconKey(type: string | null): SiteIconKey {
  const normalizedType = type?.replace(/\s+/g, "") ?? "";

  if (!normalizedType) return "default";
  if (/(石窟|石刻|摩崖)/.test(normalizedType)) return "grotto";
  if (/(近现代|史迹|代表性)/.test(normalizedType)) return "modernHistoric";
  if (/(墓|葬)/.test(normalizedType)) return "tomb";
  if (/(遗址|遗迹|窑址)/.test(normalizedType)) return "site";
  if (/(古建筑|楼|阁|寺|庙|塔|祠|书院|建筑)/.test(normalizedType))
    return "ancientBuilding";
  return "default";
}

export function resolveSiteTypeIcon(type: string | null): LucideIcon {
  return SITE_ICON_MAP[resolveSiteIconKey(type)];
}

export function renderSiteTypeIconSvg(
  type: string | null,
  options?: {
    size?: number;
    className?: string;
    strokeWidth?: number;
  },
) {
  const Icon = resolveSiteTypeIcon(type);

  return renderToStaticMarkup(
    createElement(Icon, {
      className: options?.className,
      size: options?.size ?? 18,
      strokeWidth: options?.strokeWidth ?? 1.85,
      "aria-hidden": true,
    }),
  );
}

export function formatSiteDistance(distance?: number) {
  if (distance === undefined) return null;
  if (distance < 1) return `${(distance * 1000).toFixed(0)}m`;
  if (distance < 100) return `${distance.toFixed(1)}km`;
  return `${distance.toFixed(0)}km`;
}
