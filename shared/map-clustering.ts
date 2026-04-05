type CoordinateSite = {
  id: number;
  latitude: number;
  longitude: number;
};

export interface ViewBounds {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface ProjectedSite<T extends CoordinateSite> {
  site: T;
  point: Point;
}

export interface ClusterGroup<T extends CoordinateSite> {
  sites: T[];
  count: number;
  lat: number;
  lng: number;
  point: Point;
}

export interface ClusterFocusBounds {
  southWest: [number, number];
  northEast: [number, number];
}

export interface RenderNode {
  key: string;
  type: "site" | "cluster";
  siteIds: number[];
  lat: number;
  lng: number;
  point: Point;
  count: number;
  sourceKey?: string;
}

export function getDynamicClusterRadius(size: ViewportSize) {
  return clamp(Math.min(size.width, size.height) * 0.12, 44, 80);
}

export function projectVisibleSites<T extends CoordinateSite>(
  sites: T[],
  viewport: ViewportSize,
  projectPoint: (site: T) => Point | null
) {
  return sites
    .map((site) => {
      const point = projectPoint(site);
      if (!point) return null;
      if (
        point.x < 0 ||
        point.x > viewport.width ||
        point.y < 0 ||
        point.y > viewport.height
      ) {
        return null;
      }

      return { site, point } satisfies ProjectedSite<T>;
    })
    .filter((entry): entry is ProjectedSite<T> => entry !== null);
}

export function clusterProjectedSites<T extends CoordinateSite>(
  projectedSites: ProjectedSite<T>[],
  radiusPx: number,
  unprojectPoint: (point: Point) => { lat: number; lng: number } | null
): ClusterGroup<T>[] {
  if (projectedSites.length <= 1) {
    return projectedSites.map(({ site, point }) => ({
      sites: [site],
      count: 1,
      lat: site.latitude,
      lng: site.longitude,
      point,
    }));
  }

  const cellSize = radiusPx;
  const cells = new Map<string, ProjectedSite<T>[]>();

  for (const projected of projectedSites) {
    const key = `${Math.floor(projected.point.x / cellSize)},${Math.floor(projected.point.y / cellSize)}`;
    if (!cells.has(key)) {
      cells.set(key, []);
    }
    cells.get(key)!.push(projected);
  }

  return Array.from(cells.values()).map((group) => {
    const point = {
      x: group.reduce((sum, item) => sum + item.point.x, 0) / group.length,
      y: group.reduce((sum, item) => sum + item.point.y, 0) / group.length,
    };
    const center = unprojectPoint(point);

    return {
      sites: group.map((item) => item.site),
      count: group.length,
      lat:
        center?.lat ??
        group.reduce((sum, item) => sum + item.site.latitude, 0) / group.length,
      lng:
        center?.lng ??
        group.reduce((sum, item) => sum + item.site.longitude, 0) / group.length,
      point,
    };
  });
}

export function buildRenderNodes<T extends CoordinateSite>(clusters: ClusterGroup<T>[]): RenderNode[] {
  return clusters.map((cluster) => {
    const siteIds = cluster.sites.map((site) => site.id).sort((a, b) => a - b);
    const type = cluster.count === 1 ? "site" : "cluster";

    return {
      key: type === "site" ? `site-${siteIds[0]}` : `cluster-${siteIds.join(".")}`,
      type,
      siteIds,
      lat: cluster.lat,
      lng: cluster.lng,
      point: cluster.point,
      count: cluster.count,
    };
  });
}

export function matchTransitionSources(prevNodes: RenderNode[], nextNodes: RenderNode[]) {
  return nextNodes.map((node) => ({
    ...node,
    sourceKey: findTransitionSource(prevNodes, node)?.key,
  }));
}

export function getClusterFocusBounds<T extends { latitude: number; longitude: number }>(
  sites: T[]
): ClusterFocusBounds | null {
  if (!sites.length) {
    return null;
  }

  let minLat = sites[0].latitude;
  let maxLat = sites[0].latitude;
  let minLng = sites[0].longitude;
  let maxLng = sites[0].longitude;

  for (const site of sites.slice(1)) {
    minLat = Math.min(minLat, site.latitude);
    maxLat = Math.max(maxLat, site.latitude);
    minLng = Math.min(minLng, site.longitude);
    maxLng = Math.max(maxLng, site.longitude);
  }

  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;
  const padLat = Math.max(latSpan * 0.25, 0.02);
  const padLng = Math.max(lngSpan * 0.25, 0.02);

  return {
    southWest: [minLng - padLng, minLat - padLat],
    northEast: [maxLng + padLng, maxLat + padLat],
  };
}

export function resolveClusterExpansionZoom(
  currentZoom: number,
  suggestedZoom: number | null | undefined,
  maxZoom: number
) {
  if (currentZoom >= maxZoom) {
    return maxZoom;
  }

  const minimumNextZoom = Math.min(currentZoom + 2, maxZoom);
  if (suggestedZoom == null || suggestedZoom <= currentZoom) {
    return minimumNextZoom;
  }

  return Math.min(Math.max(suggestedZoom, minimumNextZoom), maxZoom);
}

function findTransitionSource(prevNodes: RenderNode[], nextNode: RenderNode) {
  let parentMatch: RenderNode | null = null;

  for (const prevNode of prevNodes) {
    if (
      prevNode.siteIds.length > nextNode.siteIds.length &&
      nextNode.siteIds.every((siteId) => prevNode.siteIds.includes(siteId))
    ) {
      if (!parentMatch || prevNode.siteIds.length < parentMatch.siteIds.length) {
        parentMatch = prevNode;
      }
    }
  }

  if (parentMatch) {
    return parentMatch;
  }

  let nearestNode: RenderNode | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const prevNode of prevNodes) {
    const distance = Math.hypot(
      prevNode.point.x - nextNode.point.x,
      prevNode.point.y - nextNode.point.y
    );
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestNode = prevNode;
    }
  }

  return nearestNode;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
