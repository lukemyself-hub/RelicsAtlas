import { BATCH_ORDER } from "./const";
import { gcj02ToWgs84, wgs84ToGcj02, type Coordinate } from "./coordinate-system";
import type { RawHeritageSite } from "./heritage-sites";
import {
  buildSiteCoordinateOverrideKey,
  type SiteCoordinateOverride,
  type SiteCoordinateOverrideMap,
} from "./site-coordinate-overrides";

const CHINESE_PUNCTUATION_PATTERN = /[\s\u3000()（）\[\]【】{}《》〈〉“”"'"'"'‘’·,，.。:：;；、!！?？\-—_]/g;
const DISTRICT_PATTERN = /[^省市自治区特别行政区]+?(?:自治县|自治旗|区|县|旗)/;
const CITY_PATTERN = /[^省自治区特别行政区]+?市/;
const DIRECT_CONTROLLED_MUNICIPALITIES = ["北京市", "上海市", "天津市", "重庆市"] as const;
const UNKNOWN_BATCH_SORT_WEIGHT = Number.MAX_SAFE_INTEGER;
const POI_NAME_SUFFIX_REPLACEMENTS = [
  { pattern: /国家考古遗址公园$/, replacement: "遗址" },
  { pattern: /考古遗址公园$/, replacement: "遗址" },
  { pattern: /遗址公园$/, replacement: "遗址" },
  { pattern: /博物院$/, replacement: "" },
  { pattern: /博物馆$/, replacement: "" },
  { pattern: /公园$/, replacement: "" },
  { pattern: /景区$/, replacement: "" },
  { pattern: /风景名胜区$/, replacement: "" },
  { pattern: /风景区$/, replacement: "" },
] as const;

export type AMapPoiCandidate = {
  id: string;
  name: string;
  location: string;
  address?: string;
  pname?: string;
  cityname?: string | string[];
  adname?: string;
};

export type SiteCoordinateSyncStatus = "applied" | "skipped" | "review" | "unmatched";

export type SiteCoordinateSyncReportItem = {
  siteKey: string;
  batch: string | null;
  batchSequence: number | null;
  status: SiteCoordinateSyncStatus;
  reason: string;
  originalWgs84: {
    longitude: number;
    latitude: number;
  };
  originalDisplayGcj02: {
    longitude: number;
    latitude: number;
  };
  candidate: {
    id: string | null;
    name: string | null;
    location: string | null;
    address: string | null;
    pname: string | null;
    cityname: string | null;
    adname: string | null;
  };
  convertedWgs84: {
    longitude: number;
    latitude: number;
  } | null;
  displacementMeters: number | null;
};

export type SiteCoordinateSyncResolution = {
  status: SiteCoordinateSyncStatus;
  reason: string;
  overrideKey: string;
  override: SiteCoordinateOverride | null;
  reportItem: SiteCoordinateSyncReportItem;
};

type SiteAdministrativeContext = {
  cityName: string | null;
  districtName: string | null;
};

type EvaluatedCandidate = {
  candidate: AMapPoiCandidate;
  parsedLocation: Coordinate | null;
  nameMatched: boolean;
  nameMatchKind: "strict" | "alias" | "none";
  adminMatched: boolean;
  qualified: boolean;
};

export function getBatchSequence(batch: string | null | undefined) {
  if (!batch) return null;
  const index = BATCH_ORDER.indexOf(batch as (typeof BATCH_ORDER)[number]);
  return index === -1 ? null : index + 1;
}

export function sortSitesForCoordinateSync<T extends RawHeritageSite>(sites: readonly T[]) {
  return sites
    .map((site, index) => ({
      site,
      batchSequence: getBatchSequence(site.batch ?? null) ?? UNKNOWN_BATCH_SORT_WEIGHT,
      originalOrder: index,
    }))
    .sort((left, right) => {
      if (left.batchSequence !== right.batchSequence) {
        return left.batchSequence - right.batchSequence;
      }
      return left.originalOrder - right.originalOrder;
    })
    .map((entry) => entry.site);
}

export function normalizePoiName(value: string) {
  return value.replace(CHINESE_PUNCTUATION_PATTERN, "").trim();
}

export function normalizePoiNameForAliasMatch(value: string) {
  let normalized = normalizePoiName(value);
  let previous = "";

  while (normalized !== previous) {
    previous = normalized;
    for (const { pattern, replacement } of POI_NAME_SUFFIX_REPLACEMENTS) {
      normalized = normalized.replace(pattern, replacement);
    }
  }

  return normalized.trim();
}

export function isHighConfidenceNameMatch(siteName: string, candidateName: string) {
  const strictSiteName = normalizePoiName(siteName);
  const strictCandidateName = normalizePoiName(candidateName);
  if (strictSiteName === strictCandidateName) {
    return true;
  }

  const aliasSiteName = normalizePoiNameForAliasMatch(siteName);
  const aliasCandidateName = normalizePoiNameForAliasMatch(candidateName);
  return aliasSiteName.length > 0 && aliasSiteName === aliasCandidateName;
}

export function getHighConfidenceNameMatchKind(siteName: string, candidateName: string) {
  const strictSiteName = normalizePoiName(siteName);
  const strictCandidateName = normalizePoiName(candidateName);
  if (strictSiteName === strictCandidateName) {
    return "strict" as const;
  }

  const aliasSiteName = normalizePoiNameForAliasMatch(siteName);
  const aliasCandidateName = normalizePoiNameForAliasMatch(candidateName);
  if (aliasSiteName.length > 0 && aliasSiteName === aliasCandidateName) {
    return "alias" as const;
  }

  return "none" as const;
}

export function extractAdministrativeContext(address?: string | null): SiteAdministrativeContext {
  const normalizedAddress = address?.replace(/\s+/g, "") ?? "";
  if (!normalizedAddress) {
    return {
      cityName: null,
      districtName: null,
    };
  }

  const cityName =
    DIRECT_CONTROLLED_MUNICIPALITIES.find((city) => normalizedAddress.includes(city)) ??
    normalizedAddress.match(CITY_PATTERN)?.[0] ??
    null;

  const districtName = normalizedAddress.match(DISTRICT_PATTERN)?.[0] ?? null;

  return {
    cityName,
    districtName,
  };
}

export function buildFallbackKeywords(siteName: string, address?: string | null) {
  const { districtName, cityName } = extractAdministrativeContext(address);
  const suffix = districtName ?? cityName;
  return suffix ? `${siteName} ${suffix}` : siteName;
}

export function parseAmapLocation(location: string): Coordinate | null {
  const [lngText, latText] = location.split(",");
  const lng = Number(lngText);
  const lat = Number(latText);

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }

  return { lng, lat };
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1000;
}

function toCandidateSnapshot(candidate: AMapPoiCandidate | null) {
  return {
    id: candidate?.id ?? null,
    name: candidate?.name ?? null,
    location: candidate?.location ?? null,
    address: candidate?.address ?? null,
    pname: candidate?.pname ?? null,
    cityname: Array.isArray(candidate?.cityname)
      ? candidate.cityname.join("")
      : candidate?.cityname ?? null,
    adname: candidate?.adname ?? null,
  };
}

function roundCoordinate(value: number) {
  return Number(value.toFixed(6));
}

function buildCandidateAdminText(candidate: AMapPoiCandidate) {
  const city = Array.isArray(candidate.cityname) ? candidate.cityname.join("") : candidate.cityname ?? "";
  return [candidate.pname ?? "", city, candidate.adname ?? "", candidate.address ?? ""].join("");
}

function evaluateCandidate(
  candidate: AMapPoiCandidate,
  siteName: string,
  administrativeContext: SiteAdministrativeContext
): EvaluatedCandidate {
  const parsedLocation = parseAmapLocation(candidate.location);
  const nameMatchKind = getHighConfidenceNameMatchKind(siteName, candidate.name);
  const nameMatched = nameMatchKind !== "none";
  const adminText = buildCandidateAdminText(candidate);
  const adminMatched = administrativeContext.districtName
    ? adminText.includes(administrativeContext.districtName)
    : administrativeContext.cityName
      ? adminText.includes(administrativeContext.cityName)
      : true;

  return {
    candidate,
    parsedLocation,
    nameMatched,
    nameMatchKind,
    adminMatched,
    qualified: nameMatched && adminMatched && parsedLocation !== null,
  };
}

function selectHighConfidenceCandidate(
  primaryCandidates: EvaluatedCandidate[],
  fallbackCandidates: EvaluatedCandidate[]
) {
  const firstPrimaryCandidate = primaryCandidates[0] ?? null;
  const secondPrimaryCandidate = primaryCandidates[1] ?? null;
  if (
    firstPrimaryCandidate?.qualified &&
    (firstPrimaryCandidate.nameMatchKind === "strict" || firstPrimaryCandidate.nameMatchKind === "alias")
  ) {
    return {
      winner: firstPrimaryCandidate,
      reason:
        firstPrimaryCandidate.nameMatchKind === "strict"
          ? "Top primary candidate satisfied a strict name match and administrative checks."
          : "Top primary candidate satisfied a safe alias match and administrative checks.",
    };
  }

  if (firstPrimaryCandidate?.qualified && !secondPrimaryCandidate?.qualified) {
    return {
      winner: firstPrimaryCandidate,
      reason: "Top primary candidate uniquely satisfied the name and administrative checks.",
    };
  }

  const firstQualifiedPrimary = primaryCandidates.find((candidate) => candidate.qualified) ?? null;
  const firstQualifiedFallback = fallbackCandidates.find((candidate) => candidate.qualified) ?? null;
  if (
    firstQualifiedPrimary &&
    firstQualifiedFallback &&
    firstQualifiedPrimary.candidate.id === firstQualifiedFallback.candidate.id
  ) {
    return {
      winner: firstQualifiedPrimary,
      reason: "Primary and fallback queries converged on the same high-confidence AMap POI.",
    };
  }

  return {
    winner: null,
    reason: null,
  };
}

export function resolveCoordinateSyncForSite(params: {
  site: RawHeritageSite;
  primaryCandidates: AMapPoiCandidate[];
  fallbackCandidates?: AMapPoiCandidate[];
  updatedAt: string;
}) {
  const { site, primaryCandidates, fallbackCandidates = [], updatedAt } = params;
  const overrideKey = buildSiteCoordinateOverrideKey({
    id: site.id,
    name: site.name,
    batch: site.batch ?? null,
  });
  const batchSequence = getBatchSequence(site.batch ?? null);
  const rawDisplayPoint = wgs84ToGcj02(site.longitude, site.latitude);
  const administrativeContext = extractAdministrativeContext(site.address);
  const evaluatedPrimaryCandidates = primaryCandidates.map((candidate) =>
    evaluateCandidate(candidate, site.name, administrativeContext)
  );
  const evaluatedFallbackCandidates = fallbackCandidates.map((candidate) =>
    evaluateCandidate(candidate, site.name, administrativeContext)
  );
  const { winner, reason: winnerReason } = selectHighConfidenceCandidate(
    evaluatedPrimaryCandidates,
    evaluatedFallbackCandidates
  );

  if (!winner || !winner.parsedLocation || !winnerReason) {
    const hasNameMatch = [...evaluatedPrimaryCandidates, ...evaluatedFallbackCandidates].some(
      (candidate) => candidate.nameMatched
    );
    const hasQualifiedCandidates = [...evaluatedPrimaryCandidates, ...evaluatedFallbackCandidates].some(
      (candidate) => candidate.qualified
    );
    const topCandidate =
      primaryCandidates[0] ?? fallbackCandidates[0] ?? null;
    const reason =
      hasQualifiedCandidates || hasNameMatch
        ? "AMap returned similar candidates, but none passed the high-confidence uniqueness rules."
        : topCandidate
          ? "AMap returned candidates, but none matched the site name closely enough."
          : "AMap returned no POI candidates for this site.";
    const status: SiteCoordinateSyncStatus = hasQualifiedCandidates || hasNameMatch ? "review" : "unmatched";

    return {
      status,
      reason,
      overrideKey,
      override: null,
      reportItem: {
        siteKey: overrideKey,
        batch: site.batch ?? null,
        batchSequence,
        status,
        reason,
        originalWgs84: {
          longitude: site.longitude,
          latitude: site.latitude,
        },
        originalDisplayGcj02: {
          longitude: roundCoordinate(rawDisplayPoint.lng),
          latitude: roundCoordinate(rawDisplayPoint.lat),
        },
        candidate: toCandidateSnapshot(topCandidate),
        convertedWgs84: null,
        displacementMeters: null,
      },
    } satisfies SiteCoordinateSyncResolution;
  }

  const displacementMeters = haversineMeters(
    rawDisplayPoint.lat,
    rawDisplayPoint.lng,
    winner.parsedLocation.lat,
    winner.parsedLocation.lng
  );
  const convertedWgs84 = gcj02ToWgs84(winner.parsedLocation.lng, winner.parsedLocation.lat);
  const roundedConvertedWgs84 = {
    longitude: roundCoordinate(convertedWgs84.lng),
    latitude: roundCoordinate(convertedWgs84.lat),
  };

  let status: SiteCoordinateSyncStatus = "applied";
  let reason = winnerReason;
  if (displacementMeters < 200) {
    status = "skipped";
    reason = "AMap candidate is already within 200 meters of the current display coordinate.";
  } else if (displacementMeters > 20_000) {
    status = "review";
    reason = "AMap candidate is farther than 20 km from the current display coordinate.";
  }

  return {
    status,
    reason,
    overrideKey,
    override:
      status === "applied"
        ? {
            longitude: roundedConvertedWgs84.longitude,
            latitude: roundedConvertedWgs84.latitude,
            source: "amap-poi-v5",
            sourcePoiId: winner.candidate.id,
            confidence: "high",
            updatedAt,
            note: `High-confidence sync from AMap POI v5 (${winner.candidate.name}).`,
          }
        : null,
    reportItem: {
      siteKey: overrideKey,
      batch: site.batch ?? null,
      batchSequence,
      status,
      reason,
      originalWgs84: {
        longitude: site.longitude,
        latitude: site.latitude,
      },
      originalDisplayGcj02: {
        longitude: roundCoordinate(rawDisplayPoint.lng),
        latitude: roundCoordinate(rawDisplayPoint.lat),
      },
      candidate: toCandidateSnapshot(winner.candidate),
      convertedWgs84: roundedConvertedWgs84,
      displacementMeters: Math.round(displacementMeters * 100) / 100,
    },
  } satisfies SiteCoordinateSyncResolution;
}

export function renderSiteCoordinateOverridesSource(params: {
  overrides: SiteCoordinateOverrideMap;
  sites: readonly RawHeritageSite[];
}) {
  const { overrides, sites } = params;
  const siteMetadataByKey = new Map(
    sites.map((site, index) => [
      buildSiteCoordinateOverrideKey({
        id: site.id,
        name: site.name,
        batch: site.batch ?? null,
      }),
      {
        site,
        batchSequence: getBatchSequence(site.batch ?? null) ?? UNKNOWN_BATCH_SORT_WEIGHT,
        originalOrder: index,
      },
    ])
  );

  const entries = Object.entries(overrides).sort(([leftKey], [rightKey]) => {
    const leftMetadata = siteMetadataByKey.get(leftKey);
    const rightMetadata = siteMetadataByKey.get(rightKey);
    if (leftMetadata && rightMetadata) {
      if (leftMetadata.batchSequence !== rightMetadata.batchSequence) {
        return leftMetadata.batchSequence - rightMetadata.batchSequence;
      }
      return leftMetadata.originalOrder - rightMetadata.originalOrder;
    }
    if (leftMetadata) return -1;
    if (rightMetadata) return 1;
    return leftKey.localeCompare(rightKey, "zh-CN");
  });

  const serializedEntries = entries
    .map(([key, override]) => {
      const metadata = siteMetadataByKey.get(key);
      const objectLines = serializeOverrideObject(override).map((line) => `    ${line}`);

      if (!metadata) {
        return [
          `  ${JSON.stringify(key)}: {`,
          ...objectLines,
          "  },",
        ].join("\n");
      }

      return [
        "  [buildSiteCoordinateOverrideKey({",
        `    batch: ${JSON.stringify(metadata.site.batch ?? null)},`,
        `    id: ${metadata.site.id},`,
        `    name: ${JSON.stringify(metadata.site.name)},`,
        "  })]: {",
        ...objectLines,
        "  },",
      ].join("\n");
    })
    .join("\n");

  return `type SiteCoordinateKeyInput = {
  id: number;
  name: string;
  batch?: string | null;
};

export type SiteCoordinateOverride = {
  longitude: number;
  latitude: number;
  source?: "amap-poi-v5";
  sourcePoiId?: string;
  confidence?: "high";
  updatedAt?: string;
  note?: string;
};

export type SiteCoordinateOverrideMap = Record<string, SiteCoordinateOverride>;

export function buildSiteCoordinateOverrideKey(site: SiteCoordinateKeyInput) {
  return \`\${site.batch ?? ""}:\${site.id}:\${site.name}\`;
}

export const SITE_COORDINATE_OVERRIDES: SiteCoordinateOverrideMap = {
${serializedEntries}
};

export function getSiteCoordinateOverride(site: SiteCoordinateKeyInput) {
  return SITE_COORDINATE_OVERRIDES[buildSiteCoordinateOverrideKey(site)] ?? null;
}
`;
}

function serializeOverrideObject(override: SiteCoordinateOverride) {
  const lines = [
    `longitude: ${roundCoordinate(override.longitude)},`,
    `latitude: ${roundCoordinate(override.latitude)},`,
  ];

  if (override.source) {
    lines.push(`source: ${JSON.stringify(override.source)},`);
  }
  if (override.sourcePoiId) {
    lines.push(`sourcePoiId: ${JSON.stringify(override.sourcePoiId)},`);
  }
  if (override.confidence) {
    lines.push(`confidence: ${JSON.stringify(override.confidence)},`);
  }
  if (override.updatedAt) {
    lines.push(`updatedAt: ${JSON.stringify(override.updatedAt)},`);
  }
  if (override.note) {
    lines.push(`note: ${JSON.stringify(override.note)},`);
  }

  return lines;
}
