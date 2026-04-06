import fs from "node:fs/promises";
import path from "node:path";
import report from "../reports/site-coordinate-sync.json" with { type: "json" };
import rawSites from "../heritage_sites.json" with { type: "json" };
import { gcj02ToWgs84 } from "../shared/coordinate-system";
import type { RawHeritageSite } from "../shared/heritage-sites";
import { parseAmapLocation, renderSiteCoordinateOverridesSource } from "../shared/site-coordinate-sync";
import {
  buildSiteCoordinateOverrideKey,
  SITE_COORDINATE_OVERRIDES,
  type SiteCoordinateOverrideMap,
} from "../shared/site-coordinate-overrides";

const OVERRIDES_PATH = path.resolve("shared/site-coordinate-overrides.ts");

type ReportItem = (typeof report.items)[number];

function roundCoordinate(value: number) {
  return Number(value.toFixed(6));
}

function resolveAppliedWgs84(item: ReportItem) {
  if (item.convertedWgs84) {
    return {
      longitude: roundCoordinate(item.convertedWgs84.longitude),
      latitude: roundCoordinate(item.convertedWgs84.latitude),
    };
  }

  const parsedLocation = item.candidate.location ? parseAmapLocation(item.candidate.location) : null;
  if (!parsedLocation) {
    throw new Error(`Applied item ${item.siteKey} is missing candidate.location and convertedWgs84.`);
  }

  const converted = gcj02ToWgs84(parsedLocation.lng, parsedLocation.lat);
  return {
    longitude: roundCoordinate(converted.lng),
    latitude: roundCoordinate(converted.lat),
  };
}

async function main() {
  const siteByKey = new Map(
    (rawSites as RawHeritageSite[]).map((site) => [
      buildSiteCoordinateOverrideKey({
        id: site.id,
        name: site.name,
        batch: site.batch ?? null,
      }),
      site,
    ])
  );

  const nextOverrides: SiteCoordinateOverrideMap = { ...SITE_COORDINATE_OVERRIDES };
  const now = new Date().toISOString();
  let appliedCount = 0;

  for (const item of report.items) {
    if (item.status !== "applied") {
      continue;
    }

    const site = siteByKey.get(item.siteKey);
    if (!site) {
      throw new Error(`Cannot find source site for report key ${item.siteKey}.`);
    }

    const convertedWgs84 = resolveAppliedWgs84(item);
    nextOverrides[item.siteKey] = {
      longitude: convertedWgs84.longitude,
      latitude: convertedWgs84.latitude,
      source: "amap-poi-v5",
      sourcePoiId: item.candidate.id ?? undefined,
      confidence: "high",
      updatedAt: now,
      note: `Applied from reviewed site-coordinate-sync report: ${item.reason}`,
    };
    appliedCount += 1;
  }

  const content = renderSiteCoordinateOverridesSource({
    overrides: nextOverrides,
    sites: rawSites as RawHeritageSite[],
  });
  await fs.writeFile(OVERRIDES_PATH, content, "utf8");

  console.log(
    `Applied ${appliedCount} reviewed coordinate overrides from reports/site-coordinate-sync.json`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
