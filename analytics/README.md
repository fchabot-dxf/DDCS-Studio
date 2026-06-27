# DDCS Studio analytics

A tiny Cloudflare Worker that collects **anonymous, cookieless** usage events from the web app and the
exe, and writes them to **Workers Analytics Engine**. Country is derived from `request.cf` at Cloudflare's
edge — visitors' IPs are never stored. No personal data, no cookies, no consent banner needed. (One
exception: when you register a *dev* network, your OWN IP is kept privately to exclude your traffic — below.)

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

`POST` JSON: `{ event, name, id, app, version, os, dev }`

| field | meaning |
|-------|---------|
| `event` | `visit` · `feature` · `app_launch` (+ internal `dev_register` / `dev_unregister`) |
| `name` | feature/page label, e.g. `wizard:drill`, `insert`, `tab:gateway`, `/` |
| `id` | anonymous random id (web: localStorage UUID · exe: `~/.ddcs-bridge/install_id`) — **not a person** |
| `app` | `web` · `exe` |
| `version` | Studio version, e.g. `10.23` |
| `os` | coarse platform string |
| `dev` | `1` = the developer's own traffic (else `0`) — see "Separating your own activity" |

Stored in Analytics Engine as: `blob1`=event, `blob2`=name, `blob3`=country, `blob4`=app,
`blob5`=version, `blob6`=os, `blob7`=city, `blob8`=region, `blob9`=dev; `double1`=1 (count).

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

## Dashboard (`/dash`)

A private, remote dashboard is served by the same worker at **`/dash`** — charts (visits/day, top
countries, web vs exe, top features, versions), gated by a secret URL key. It reads the data
server-side via the Analytics Engine SQL API (the API token never reaches the browser).

**One-time setup** (from `analytics/`):

```
wrangler secret put AE_TOKEN     # a Cloudflare API token with permission: Account Analytics → Read
wrangler secret put DASH_KEY     # a long random string — your private dashboard key
wrangler deploy
```

`ACCOUNT_ID` is already set in `wrangler.toml` (not secret). Then open:

```
https://ddcs-analytics.dansemur.workers.dev/dash?key=<DASH_KEY>
```

- `&days=7|30|90` — lookback window (default 30; buttons in the header).
- `&dev=1` — INCLUDE your own/dev traffic (default: real users only). Toggle in the header.
- Wrong/missing key → `404` (the route stays invisible without the link). "Revoke" = `wrangler secret put DASH_KEY` with a new value + redeploy.
- Each chart's query runs independently — if Analytics Engine rejects one (SQL-dialect quirk), the rest still render and the failed query + its error show in a debug panel at the bottom.
- Want real login instead of a secret link later: put **Cloudflare Access** (Zero Trust, free) in front of the `/dash` path — no code change.

## Separating your own activity (dev)

Your own usage is tagged `dev = 1` (blob9) so you can exclude it — or look at only it:

- **Per network (covers all your devices):** from any one device on a network, visit
  <https://ddcs-studio.pages.dev/?dev=1> once. That marks that browser as yours **and** registers the
  network's IP (privately, in KV) so every other device on the same wifi — phone, tablet, other PCs —
  counts as you too. Undo with <https://ddcs-studio.pages.dev/?dev=0>.
  - **Self-healing:** any tagged browser re-registers the network on every visit, so if your ISP rotates
    your IP it fixes itself the next time you open the app on a tagged device. (Worst case after an IP
    change: *untagged* devices on that network count as real until you next open a tagged one there.)
- **Dev runs of the exe** (`python fairy_gateway.py`): auto-tagged `dev=1` (a non-frozen run). A
  released `.exe` counts as real; set env `DDCS_DEV=1` to exclude a specific installed copy.

Filter in any query:

```sql
... AND (blob9 != '1' OR blob9 IS NULL)   -- real users only (excludes you)
... AND blob9 = '1'                        -- only your own testing
```

## Privacy / opt-out

- No visitor IP stored (country derived at the edge), no cookies, anonymous id only. The one exception
  is your OWN IP, kept privately in KV (TTL'd ~120 days) only when you register a dev network — used
  solely to exclude your own traffic.
- Web: `localStorage.setItem('ddcs_no_analytics','1')` — also honours Do-Not-Track.
- Exe: set env `DDCS_NO_ANALYTICS=1`.
