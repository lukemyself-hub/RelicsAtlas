import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import rawSites from "../heritage_sites.json" with { type: "json" };
import type { RawHeritageSite } from "../shared/heritage-sites";
import {
  buildFallbackKeywords,
  extractAdministrativeContext,
  renderSiteCoordinateOverridesSource,
  resolveCoordinateSyncForSite,
  sortSitesForCoordinateSync,
  type AMapPoiCandidate,
  type SiteCoordinateSyncReportItem,
} from "../shared/site-coordinate-sync";
import {
  SITE_COORDINATE_OVERRIDES,
  type SiteCoordinateOverrideMap,
} from "../shared/site-coordinate-overrides";

const AMAP_TEXT_SEARCH_URL = "https://restapi.amap.com/v5/place/text";
const DEFAULT_OVERRIDES_PATH = path.resolve("shared/site-coordinate-overrides.ts");
const DEFAULT_REPORT_PATH = path.resolve("reports/site-coordinate-sync.json");
const AMAP_QPS_ERROR = "CUQPS_HAS_EXCEEDED_THE_LIMIT";
const REQUEST_INTERVAL_MS = 220;
const QPS_RETRY_DELAY_MS = 1200;
const MAX_QPS_RETRIES = 3;

type FetchLike = typeof fetch;

type RunSyncOptions = {
  apiKey: string;
  write?: boolean;
  limit?: number;
  fetchFn?: FetchLike;
  logger?: Pick<Console, "log" | "error">;
  now?: Date;
  overridesPath?: string;
  reportPath?: string;
  sites?: RawHeritageSite[];
  currentOverrides?: SiteCoordinateOverrideMap;
};

type AMapPoiSearchResponse = {
  status?: string;
  info?: string;
  pois?: AMapPoiCandidate[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type SiteCoordinateSyncReport = {
  generatedAt: string;
  dryRun: boolean;
  summary: {
    total: number;
    applied: number;
    skipped: number;
    review: number;
    unmatched: number;
  };
  items: SiteCoordinateSyncReportItem[];
};

async function searchAmapPois(params: {
  apiKey: string;
  keywords: string;
  region?: string | null;
  fetchFn: FetchLike;
}) {
  for (let attempt = 0; attempt <= MAX_QPS_RETRIES; attempt += 1) {
    const searchParams = new URLSearchParams({
      key: params.apiKey,
      keywords: params.keywords,
      page_size: "10",
    });

    if (params.region) {
      searchParams.set("region", params.region);
      searchParams.set("city_limit", "true");
    }

    const response = await params.fetchFn(`${AMAP_TEXT_SEARCH_URL}?${searchParams.toString()}`);
    if (!response.ok) {
      throw new Error(`AMap request failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as AMapPoiSearchResponse;
    if (payload.status === "1") {
      await sleep(REQUEST_INTERVAL_MS);
      return payload.pois ?? [];
    }

    if (payload.info === AMAP_QPS_ERROR && attempt < MAX_QPS_RETRIES) {
      await sleep(QPS_RETRY_DELAY_MS * (attempt + 1));
      continue;
    }

    throw new Error(`AMap error: ${payload.info ?? "Unknown error"}`);
  }

  return [];
}

function createErrorReportItem(params: {
  site: RawHeritageSite;
  reason: string;
  generatedAt: string;
}): SiteCoordinateSyncReportItem {
  const baseReportItem = resolveCoordinateSyncForSite({
    site: params.site,
    primaryCandidates: [],
    updatedAt: params.generatedAt,
  }).reportItem;

  return {
    ...baseReportItem,
    status: "review",
    reason: params.reason,
  };
}

async function writeReport(reportPath: string, report: SiteCoordinateSyncReport) {
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function writeOverrides(overridesPath: string, overrides: SiteCoordinateOverrideMap, sites: RawHeritageSite[]) {
  const content = renderSiteCoordinateOverridesSource({ overrides, sites });
  await fs.writeFile(overridesPath, content, "utf8");
}

export async function runSiteCoordinateOverrideSync(options: RunSyncOptions) {
  const {
    apiKey,
    fetchFn = fetch,
    logger = console,
    now = new Date(),
    write = false,
    limit,
    overridesPath = DEFAULT_OVERRIDES_PATH,
    reportPath = DEFAULT_REPORT_PATH,
    sites = rawSites as RawHeritageSite[],
    currentOverrides = SITE_COORDINATE_OVERRIDES,
  } = options;

  if (!apiKey) {
    throw new Error("AMAP_WEB_SERVICE_KEY is required.");
  }

  const generatedAt = now.toISOString();
  const sortedSites = sortSitesForCoordinateSync(sites);
  const limitedSites =
    typeof limit === "number" && Number.isFinite(limit) && limit > 0
      ? sortedSites.slice(0, Math.floor(limit))
      : sortedSites;
  const nextOverrides: SiteCoordinateOverrideMap = { ...currentOverrides };
  const items: SiteCoordinateSyncReportItem[] = [];

  for (let index = 0; index < limitedSites.length; index += 1) {
    const site = limitedSites[index];
    logger.log(
      `[${index + 1}/${limitedSites.length}] ${site.batch ?? "未分批"} ${site.name}`
    );

    try {
      const administrativeContext = extractAdministrativeContext(site.address);
      const primaryCandidates = await searchAmapPois({
        apiKey,
        keywords: site.name,
        region: administrativeContext.cityName,
        fetchFn,
      });

      let fallbackCandidates: AMapPoiCandidate[] = [];
      const fallbackKeywords = buildFallbackKeywords(site.name, site.address);
      if (fallbackKeywords !== site.name) {
        fallbackCandidates = await searchAmapPois({
          apiKey,
          keywords: fallbackKeywords,
          region: administrativeContext.cityName,
          fetchFn,
        });
      }

      const resolution = resolveCoordinateSyncForSite({
        site,
        primaryCandidates,
        fallbackCandidates,
        updatedAt: generatedAt,
      });

      items.push(resolution.reportItem);

      if (write && resolution.override) {
        nextOverrides[resolution.overrideKey] = resolution.override;
      }
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Unknown sync error while querying AMap.";
      items.push(
        createErrorReportItem({
          site,
          reason,
          generatedAt,
        })
      );
      logger.error(`Failed to sync ${site.name}: ${reason}`);
    }
  }

  const report: SiteCoordinateSyncReport = {
    generatedAt,
    dryRun: !write,
    summary: {
      total: items.length,
      applied: items.filter((item) => item.status === "applied").length,
      skipped: items.filter((item) => item.status === "skipped").length,
      review: items.filter((item) => item.status === "review").length,
      unmatched: items.filter((item) => item.status === "unmatched").length,
    },
    items,
  };

  await writeReport(reportPath, report);
  if (write) {
    await writeOverrides(overridesPath, nextOverrides, sites);
  }

  logger.log(
    `Coordinate sync complete. applied=${report.summary.applied} skipped=${report.summary.skipped} review=${report.summary.review} unmatched=${report.summary.unmatched} dryRun=${report.dryRun}`
  );

  return {
    report,
    nextOverrides,
  };
}

async function main() {
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.slice("--limit=".length)) : undefined;

  await runSiteCoordinateOverrideSync({
    apiKey: process.env.AMAP_WEB_SERVICE_KEY ?? "",
    write: process.argv.includes("--write"),
    limit,
  });
}

const isDirectExecution =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
