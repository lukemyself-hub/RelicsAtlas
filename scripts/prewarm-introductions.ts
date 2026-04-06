import { config as loadDotenv } from "dotenv";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSiteIntroductionKey } from "../shared/site-introductions";
import {
  type PrewarmFailure,
  getRateLimitRetryAfterMs,
  getPrewarmTargetSites,
  isRateLimitedIntroductionFailure,
  prewarmIntroductions,
} from "../server/heritage-introductions";

type CliOptions = {
  limit?: number;
  batch?: string;
  siteIds?: number[];
  siteKeys?: string[];
  batchSize?: number;
  concurrency?: number;
  intervalMs?: number;
  dailyLimit?: number;
  perMinuteLimit?: number;
  loop?: boolean;
};

type RequestState = {
  requestTimestamps: number[];
};

const MINUTE_WINDOW_MS = 60_000;
const DAY_WINDOW_MS = 24 * 60 * 60 * 1000;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");

loadDotenv({ path: resolve(REPO_ROOT, ".env") });

async function readRequestState(path: string): Promise<RequestState> {
  try {
    const raw = await readFile(path, "utf-8");
    const parsed = JSON.parse(raw) as Partial<RequestState>;
    return {
      requestTimestamps: Array.isArray(parsed.requestTimestamps)
        ? parsed.requestTimestamps.filter((value): value is number => typeof value === "number")
        : [],
    };
  } catch {
    return { requestTimestamps: [] };
  }
}

async function readExistingIntroductions(path: string) {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--limit") {
      const value = argv[index + 1];
      if (value) {
        options.limit = Number(value);
        index += 1;
      }
      continue;
    }

    if (arg === "--batch") {
      const value = argv[index + 1];
      if (value) {
        options.batch = value;
        index += 1;
      }
      continue;
    }

    if (arg === "--site-id") {
      const value = argv[index + 1];
      if (value) {
        options.siteIds ??= [];
        options.siteIds.push(Number(value));
        index += 1;
      }
      continue;
    }

    if (arg === "--site-key") {
      const value = argv[index + 1];
      if (value) {
        options.siteKeys ??= [];
        options.siteKeys.push(value);
        index += 1;
      }
      continue;
    }

    if (arg === "--batch-size") {
      const value = argv[index + 1];
      if (value) {
        options.batchSize = Number(value);
        index += 1;
      }
      continue;
    }

    if (arg === "--concurrency") {
      const value = argv[index + 1];
      if (value) {
        options.concurrency = Number(value);
        index += 1;
      }
      continue;
    }

    if (arg === "--interval-ms") {
      const value = argv[index + 1];
      if (value) {
        options.intervalMs = Number(value);
        index += 1;
      }
      continue;
    }

    if (arg === "--daily-limit") {
      const value = argv[index + 1];
      if (value) {
        options.dailyLimit = Number(value);
        index += 1;
      }
      continue;
    }

    if (arg === "--per-minute-limit") {
      const value = argv[index + 1];
      if (value) {
        options.perMinuteLimit = Number(value);
        index += 1;
      }
      continue;
    }

    if (arg === "--loop") {
      options.loop = true;
    }
  }

  return options;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pruneRequestTimestamps(
  timestamps: number[],
  now: number
) {
  return timestamps.filter((timestamp) => now - timestamp < DAY_WINDOW_MS);
}

function getQuotaSnapshot(
  timestamps: number[],
  now: number,
  options: CliOptions
) {
  const activeTimestamps = pruneRequestTimestamps(timestamps, now);
  const minuteRequests = activeTimestamps.filter((timestamp) => now - timestamp < MINUTE_WINDOW_MS).length;
  const dayRequests = activeTimestamps.length;
  const remainingPerMinute = typeof options.perMinuteLimit === "number"
    ? Math.max(0, options.perMinuteLimit - minuteRequests)
    : Number.POSITIVE_INFINITY;
  const remainingPerDay = typeof options.dailyLimit === "number"
    ? Math.max(0, options.dailyLimit - dayRequests)
    : Number.POSITIVE_INFINITY;

  return {
    activeTimestamps,
    minuteRequests,
    dayRequests,
    remainingPerMinute,
    remainingPerDay,
  };
}

function getQuotaWaitMs(
  timestamps: number[],
  now: number,
  options: CliOptions
) {
  const waits: number[] = [];

  if (typeof options.perMinuteLimit === "number") {
    const minuteTimestamps = timestamps.filter((timestamp) => now - timestamp < MINUTE_WINDOW_MS);
    if (minuteTimestamps.length >= options.perMinuteLimit) {
      const earliestMinuteTimestamp = Math.min(...minuteTimestamps);
      waits.push(MINUTE_WINDOW_MS - (now - earliestMinuteTimestamp));
    }
  }

  if (typeof options.dailyLimit === "number" && timestamps.length >= options.dailyLimit) {
    const earliestDayTimestamp = Math.min(...timestamps);
    waits.push(DAY_WINDOW_MS - (now - earliestDayTimestamp));
  }

  return waits.length > 0 ? Math.max(0, Math.max(...waits)) : 0;
}

async function writeRequestState(path: string, state: RequestState) {
  await writeFile(path, JSON.stringify(state, null, 2) + "\n", "utf-8");
}

async function persistOutputs(
  outputPath: string,
  failuresPath: string,
  introductions: Record<string, string>,
  failures: PrewarmFailure[]
) {
  await writeFile(outputPath, JSON.stringify(introductions, null, 2) + "\n", "utf-8");
  await writeFile(failuresPath, JSON.stringify(failures, null, 2) + "\n", "utf-8");
}

function getNextWaitMs(
  intervalMs: number,
  failures: Array<{ error: string }>
) {
  const rateLimitedFailures = failures.filter((failure) =>
    isRateLimitedIntroductionFailure(failure.error)
  );

  if (rateLimitedFailures.length === 0) {
    return intervalMs;
  }

  const retryAfterMs = rateLimitedFailures
    .map((failure) => getRateLimitRetryAfterMs(failure.error))
    .filter((value): value is number => value !== null);

  const suggestedWaitMs = retryAfterMs.length > 0
    ? Math.max(...retryAfterMs)
    : intervalMs * 6;

  return Math.max(intervalMs, suggestedWaitMs);
}

async function main() {
  const startedAt = Date.now();
  const outputPath = resolve(REPO_ROOT, "client/src/generated/site-introductions.json");
  const failuresPath = resolve(REPO_ROOT, "client/src/generated/site-introduction-failures.json");
  const statePath = resolve(REPO_ROOT, ".cache/intro-prewarm-state.json");
  const options = parseArgs(process.argv.slice(2));
  const shouldLoop = options.loop || options.batchSize !== undefined;
  const intervalMs = options.intervalMs ?? 5_000;
  const perRoundLimit = options.batchSize ?? options.limit;
  let round = 0;

  await mkdir(dirname(outputPath), { recursive: true });
  await mkdir(dirname(statePath), { recursive: true });

  while (true) {
    round += 1;
    const existingIntroductions = await readExistingIntroductions(outputPath);
    const requestState = await readRequestState(statePath);
    const now = Date.now();
    const quotaSnapshot = getQuotaSnapshot(requestState.requestTimestamps, now, options);
    const targetSites = await getPrewarmTargetSites(options);
    const pendingSites = targetSites.filter(
      (site) => !existingIntroductions[buildSiteIntroductionKey(site)]
    );

    if (pendingSites.length === 0) {
      const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log("Introduction prewarm complete.");
      if (options.batch) {
        console.log(`Batch filter: ${options.batch}`);
      }
      if (options.siteIds?.length) {
        console.log(`Site IDs: ${options.siteIds.join(", ")}`);
      }
      if (options.siteKeys?.length) {
        console.log(`Site keys: ${options.siteKeys.join(", ")}`);
      }
      if (typeof perRoundLimit === "number") {
        console.log(`Per-round limit: ${perRoundLimit}`);
      }
      if (typeof options.concurrency === "number") {
        console.log(`Concurrency: ${options.concurrency}`);
      }
      if (typeof options.perMinuteLimit === "number") {
        console.log(`Per-minute limit: ${options.perMinuteLimit}`);
      }
      if (typeof options.dailyLimit === "number") {
        console.log(`Daily limit: ${options.dailyLimit}`);
      }
      if (shouldLoop) {
        console.log(`Loop interval: ${intervalMs}ms`);
      }
      console.log(`Rounds: ${round - 1}`);
      console.log(`Total target sites: ${targetSites.length}`);
      console.log(`Generated so far: ${Object.keys(existingIntroductions).length}`);
      console.log(`Requests used in last 24h: ${quotaSnapshot.dayRequests}`);
      console.log(`Elapsed: ${elapsedSeconds}s`);
      break;
    }

    const quotaCapacity = Math.min(quotaSnapshot.remainingPerMinute, quotaSnapshot.remainingPerDay);
    if (quotaCapacity <= 0) {
      const waitMs = getQuotaWaitMs(quotaSnapshot.activeTimestamps, now, options);
      if (!shouldLoop) {
        console.log("Request quota reached; exiting without sending new Gemini requests.");
        console.log(`Requests used in last minute: ${quotaSnapshot.minuteRequests}`);
        console.log(`Requests used in last 24h: ${quotaSnapshot.dayRequests}`);
        break;
      }
      console.log(
        `Request quota reached (minute: ${quotaSnapshot.minuteRequests}, day: ${quotaSnapshot.dayRequests}); waiting ${waitMs}ms before retrying.`
      );
      await sleep(waitMs);
      continue;
    }

    const roundSiteKeys = pendingSites
      .slice(0, Math.min(perRoundLimit ?? pendingSites.length, quotaCapacity))
      .map((site) => buildSiteIntroductionKey(site));
    const incrementalFailures: PrewarmFailure[] = [];

    const runOptions = {
      ...options,
      limit: undefined,
      siteKeys: roundSiteKeys,
      onGenerated: async ({
        siteKey,
        content,
      }: {
        siteKey: string;
        content: string;
      }) => {
        existingIntroductions[siteKey] = content;
        await persistOutputs(outputPath, failuresPath, existingIntroductions, []);
      },
      onFailed: async (failure: PrewarmFailure) => {
        incrementalFailures.push(failure);
        await persistOutputs(outputPath, failuresPath, existingIntroductions, incrementalFailures);
      },
    };

    const result = await prewarmIntroductions(existingIntroductions, runOptions);
    const roundFailures = result.failures.filter(
      (failure) => pendingSites.some((site) => buildSiteIntroductionKey(site) === failure.siteKey)
    );

    await persistOutputs(outputPath, failuresPath, result.introductions, roundFailures);
    const requestAttempts = result.summary.generated + result.summary.failed;
    if (requestAttempts > 0) {
      const requestTimestamp = Date.now();
      const nextState: RequestState = {
        requestTimestamps: pruneRequestTimestamps([
          ...quotaSnapshot.activeTimestamps,
          ...Array.from({ length: requestAttempts }, () => requestTimestamp),
        ], requestTimestamp),
      };
      await writeRequestState(statePath, nextState);
    } else {
      await writeRequestState(statePath, {
        requestTimestamps: quotaSnapshot.activeTimestamps,
      });
    }

    console.log(`Round ${round} complete.`);
    console.log(`Pending before round: ${pendingSites.length}`);
    console.log(`Generated this round: ${result.summary.generated}`);
    console.log(`Skipped this round: ${result.summary.skipped}`);
    console.log(`Failed this round: ${roundFailures.length}`);
    console.log(`Requests used in last minute: ${quotaSnapshot.minuteRequests + requestAttempts}`);
    console.log(`Requests used in last 24h: ${quotaSnapshot.dayRequests + requestAttempts}`);

    if (!shouldLoop) {
      break;
    }

    const waitMs = getNextWaitMs(intervalMs, roundFailures);
    const rateLimitedFailures = roundFailures.filter((failure) =>
      isRateLimitedIntroductionFailure(failure.error)
    );

    if (rateLimitedFailures.length > 0) {
      console.log(
        `Rate limit detected in round ${round} (${rateLimitedFailures.length} failures); waiting ${waitMs}ms before retrying.`
      );
    } else if (result.summary.generated === 0 && roundFailures.length > 0) {
      console.log(`No new introductions generated in round ${round}; retrying after ${waitMs}ms.`);
    } else {
      console.log(`Waiting ${waitMs}ms before next round...`);
    }
    await sleep(waitMs);
  }
}

main()
  .catch((error) => {
    console.error("Introduction prewarm failed:", error);
    process.exitCode = 1;
  });
