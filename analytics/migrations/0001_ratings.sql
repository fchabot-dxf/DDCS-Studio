-- DDCS Studio analytics — D1 schema (t700).
-- Two tables in the ddcs_ratings database (env.RATINGS):
--   ratings — one row per submitted star rating (permanent; the raw feedback).
--   rollups — one row per (day, event type): yesterday's usage counts, folded nightly by scheduled().
-- Apply:
--   npx wrangler d1 execute ddcs_ratings --remote --file=migrations/0001_ratings.sql
-- (drop --remote to seed a LOCAL dev DB instead).

CREATE TABLE IF NOT EXISTS ratings (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       INTEGER NOT NULL,          -- server-received time, ms since epoch
  stars    INTEGER NOT NULL,          -- 1..5 (validated at the edge)
  comment  TEXT,                      -- optional, control-chars stripped, <=500 chars
  version  TEXT,                      -- Studio version, e.g. "10.136"
  app      TEXT,                      -- "web" | "exe"
  os       TEXT,                      -- coarse platform string
  anon_id  TEXT                       -- anonymous id (NOT a person)
);
CREATE INDEX IF NOT EXISTS ix_ratings_ts ON ratings (ts);

-- Pre-aggregated daily usage totals. PRIMARY KEY (date,event) makes a day's rows unique; the nightly
-- job DELETEs the day then re-INSERTs, so a re-run REPLACES the day's totals (idempotent, never doubles).
-- The forever-record SPLITS dev traffic so it answers BOTH "how are users?" (count - devCount) AND
-- "how much was me?" (devCount) — you can't recover a split you never stored (the KV-mystery lesson).
CREATE TABLE IF NOT EXISTS rollups (
  date      TEXT NOT NULL,            -- YYYY-MM-DD (UTC)
  event     TEXT NOT NULL,            -- event type (blob1): "visit" | "feature" | "rating" | ...
  count     INTEGER NOT NULL,         -- estimated TOTAL count (AE _sample_interval sum, all traffic)
  devCount  INTEGER NOT NULL DEFAULT 0, -- the developer's portion of count (blob9='1'); real users = count - devCount
  PRIMARY KEY (date, event)
);
