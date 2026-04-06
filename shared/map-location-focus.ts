import {
  getClusterFocusBounds,
  type ClusterFocusBounds,
} from "./map-clustering";

type CoordinatePoint = {
  lat: number;
  lng: number;
};

type FocusSite = {
  id: number;
  latitude: number;
  longitude: number;
};

type BuildUserAreaFocusPlanOptions<T extends FocusSite> = {
  userLocation: CoordinatePoint;
  sites: T[];
  nearbyRadiusKm?: number;
  maxNearbySites?: number;
  fallbackZoom?: number;
  minFitZoom?: number;
  maxFitZoom?: number;
};

export type UserAreaFocusPlan =
  | {
      type: "fit-bounds";
      bounds: ClusterFocusBounds;
      nearbySiteIds: number[];
      minZoom: number;
      maxZoom: number;
    }
  | {
      type: "center";
      center: CoordinatePoint;
      zoom: number;
      nearbySiteIds: number[];
    };

const DEFAULT_NEARBY_RADIUS_KM = 120;
const DEFAULT_MAX_NEARBY_SITES = 20;
const DEFAULT_FALLBACK_ZOOM = 10;
const DEFAULT_MIN_FIT_ZOOM = 8;
const DEFAULT_MAX_FIT_ZOOM = 11;

export function buildUserAreaFocusPlan<T extends FocusSite>({
  userLocation,
  sites,
  nearbyRadiusKm = DEFAULT_NEARBY_RADIUS_KM,
  maxNearbySites = DEFAULT_MAX_NEARBY_SITES,
  fallbackZoom = DEFAULT_FALLBACK_ZOOM,
  minFitZoom = DEFAULT_MIN_FIT_ZOOM,
  maxFitZoom = DEFAULT_MAX_FIT_ZOOM,
}: BuildUserAreaFocusPlanOptions<T>): UserAreaFocusPlan {
  const nearbySites = sites
    .map((site) => ({
      site,
      distanceKm: haversineKm(
        userLocation.lat,
        userLocation.lng,
        site.latitude,
        site.longitude,
      ),
    }))
    .filter((entry) => entry.distanceKm <= nearbyRadiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, maxNearbySites)
    .map((entry) => entry.site);

  if (nearbySites.length === 0) {
    return {
      type: "center",
      center: userLocation,
      zoom: fallbackZoom,
      nearbySiteIds: [],
    };
  }

  const bounds = getClusterFocusBounds([
    {
      id: -1,
      latitude: userLocation.lat,
      longitude: userLocation.lng,
    },
    ...nearbySites,
  ]);

  if (!bounds) {
    return {
      type: "center",
      center: userLocation,
      zoom: fallbackZoom,
      nearbySiteIds: nearbySites.map((site) => site.id),
    };
  }

  return {
    type: "fit-bounds",
    bounds,
    nearbySiteIds: nearbySites.map((site) => site.id),
    minZoom: minFitZoom,
    maxZoom: maxFitZoom,
  };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
