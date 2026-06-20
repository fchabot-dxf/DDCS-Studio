# DDCS Studio analytics

A tiny Cloudflare Worker that collects **anonymous, cookieless** usage events from the web app and the
exe, and writes them to **Workers Analytics Engine**. Country is derived from `request.cf` at Cloudflare's
edge — the visitor's IP is never sent or stored. No personal data, no consent banner needed.

It answers: how many **visits**, from which **countries**, on which **version/OS**, **web vs exe**, and
which **basic functions** get used (open wizard, insert, export, tab switches…).

## One-time setup

1. **Deploy the Worker** (from this folder):
   ```
   npm i -g wrangler        # if you don't have it
   wrangler login
   wrangler deploy
   ```
   Wrangler prints a URL like `https://ddcs-analytics.<your-subdomain>.workers.dev`. The Analytics
   Engine dataset (`ddcs_events`) is created automatically on the first event — nothing else to set up.

2. **Point the clients at it** — set the URL (with `/e`) in two places:
   - `DDCS-Studio/web/ui/analytics.js` → `const ENDPOINT = '…workers.dev/e'`
   - `fairy_gateway.py` → `ANALYTICS_URL = '…workers.dev/e'`

   (Until set to a real URL, tracking is a silent no-op — safe to ship.)

That's it. Push the web change (auto-deploys to Pages); rebuild the exe with `build_fairy.ps1` to bake in
the exe beacon.

## What gets sent

`POST` JSON: `{ event, name, id, app, version, os }`

| field | meaning |
|-------|---------|
| `event` | `visit` · `feature` · `app_launch` |
| `name` | feature/page label, e.g. `wizard:drill`, `insert`, `tab:gateway`, `/` |
| `id` | anonymous random id (web: localStorage UUID · exe: `~/.ddcs-bridge/install_id`) — **not a person** |
| `app` | `web` · `exe` |
| `version` | Studio version, e.g. `10.23` |
| `os` | coarse platform string |

Stored in Analytics Engine as: `blob1`=event, `blob2`=name, `blob3`=country, `blob4`=app,
`blob5`=version, `blob6`=os, `blob7`=city, `blob8`=region; `double1`=1 (count).

## Querying

Use the Analytics Engine SQL API (Cloudflare dashboard → Workers & Pages → your account → Analytics
Engine, or the SQL API). Examples:

```sql
-- Visits by country, last 7 days
SELECT blob3 AS country, SUM(_sample_interval) AS visits
FROM ddcs_events
WHERE blob1 = 'visit' AND (blob9 != '1' OR blob9 IS NULL) AND timestamp > NOW() - INTERVAL '7' DAY
GROUP BY country ORDER BY visits DESC;

-- Most-used features
SELECT blob2 AS feature, SUM(_sample_interval) AS uses
FROM ddcs_events
WHERE blob1 = 'feature' AND (blob9 != '1' OR blob9 IS NULL) AND timestamp > NOW() - INTERVAL '30' DAY
GROUP BY feature ORDER BY uses DESC;

-- Web vs exe, and version spread
SELECT blob4 AS app, blob5 AS version, SUM(_sample_interval) AS n
FROM ddcs_events
WHERE timestamp > NOW() - INTERVAL '30' DAY
GROUP BY app, version ORDER BY n DESC;

-- Exe launches (unique-ish installs use blob via the anonymous id index)
SELECT blob3 AS country, SUM(_sample_interval) AS launches
FROM ddcs_events
WHERE blob1 = 'app_launch'
GROUP BY country ORDER BY launches DESC;
```

`_sample_interval` un-samples the counts (Analytics Engine samples at high volume). For low traffic it's 1.

## Separating your own activity (dev)

Your own usage is tagged `dev = 1` (blob9) so you can exclude it — or look at only it:

- **Each browser you test from:** visit your site once with `?dev=1` on the URL, e.g.
  `https://ddcs-studio.pages.dev/?dev=1`. It persists in that browser; `?dev=0` clears it. It's
  per-browser (not per-network), so do it once on each browser across your PCs.
- **Dev runs of the exe** (`python fairy_gateway.py`): auto-tagged `dev=1` (a non-frozen run). A
  released `.exe` counts as real; set env `DDCS_DEV=1` to exclude a specific installed copy.

Filter in any query:

```sql
... AND (blob9 != '1' OR blob9 IS NULL)   -- real users only (excludes you)
... AND blob9 = '1'                        -- only your own testing
```

## Privacy / opt-out

- No IP stored (country derived at the edge), no cookies, anonymous id only.
- Web: `localStorage.setItem('ddcs_no_analytics','1')` — also honours Do-Not-Track.
- Exe: set env `DDCS_NO_ANALYTICS=1`.
