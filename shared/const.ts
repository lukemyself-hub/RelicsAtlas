export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

export const BATCH_ORDER = [
  "第一批",
  "第二批",
  "第三批",
  "第四批",
  "第五批",
  "第六批",
  "第七批",
  "第八批",
] as const;

export const DEFAULT_BATCHES = BATCH_ORDER.slice(0, 3);
export const PREGENERATED_INTRO_BATCHES = BATCH_ORDER.slice(0, 5);
