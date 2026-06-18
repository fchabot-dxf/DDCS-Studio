# MONOREPO ARCHITECTURE PLAN — DDCS Studio + Bridge

> **Status:** repo structure + shared-core reference (June 2026). The **active product plan** is
> **`COMBINED-APP-PLAN.md`** (one exe = embedded gateway + Studio + optional LAN serving); the
> liability boundary is `ARCHITECTURE-MULTIUSER.md`. This file keeps what they build on: the
> monorepo layout, the no-build shared core, and the completed foundation phases.
> Markers: ✅ **DECIDED** · ⬚ **OPEN** (needs your call).

---

## 1. Decisions
- ✅ **Monorepo.** `ddcs-studio-project/` is the repo (remote: `fchabot-dxf/DDCS-Studio`); the Studio app
  lives at `DDCS-Studio/` beside `bridge/`. The standalone `ddcs-pc-bridge` repo is frozen.
- ✅ **One app** (June 2026): the gateway serves Studio; the separate fairy local UI is end-of-life.
  All views live in **one Studio UI**, shown/hidden by gateway detection. See `COMBINED-APP-PLAN.md`.
- ✅ **Maximal `shared/js/`** — `client.js` + `instrument/` + `validate/` + tracker view + style tokens,
  single source.
- ✅ **No build pipeline.** Sharing is solved by **serve config**, not a bundler (§2).
- ✅ **Cloud face = Studio.** Studio on Cloudflare Pages is the hosted face (machine functions gated
  invisible), talking the same `/api` contract via the existing Worker + R2.

The seam stays frozen: `shared/PROTOCOL.md` · the `/api` ops surface (`ops.py`) · the beacon frame.

---

## 2. The shared core + how it's consumed (no build)
**Location:** `DDCS-Studio/web/shared/js/` — single source.
**Contents (maximal):** `client.js` (the `/api` seam) · `instrument/` (`gcode-parse.js`, `instrument.js`,
`selftest.mjs` — the `checkpoint_insert.py` port) · `validate/` (DDCS M350 quirk linter — a JS
port of `controllers/expert-m350/tools/ddcs_lint.py`, consumed pre-submit) · the tracker/queue **view** ·
style tokens.

**Consumption — serve config, not a bundler:**
- **Gateway-served (local/LAN):** `server.py` mounts `shared/` (P3) and, per `COMBINED-APP-PLAN.md`
  Step 1, the whole `DDCS-Studio/web/` at `/`.
- **Hosted:** Cloudflare Pages publishes `DDCS-Studio/web/` directly; `shared/` is just part of the tree.
- The shared modules use **internal relative imports** (`instrument.js` → `./gcode-parse.js`), so they
  don't care how they're mounted.
- **Optional bundle** (`bundle_standalone.py`): follows those imports later if/when we ship a one-file
  download. Not a dependency.

**Single-source discipline:** the JS instrumenter keeps its `selftest.mjs` parity with the Python
`checkpoint_insert.py`, and the JS `validate/` keeps parity with `ddcs_lint.py` (the two anti-drift
contracts — change the rule in both files, keep the selftests in lockstep).

---

## 3. Monorepo layout
```
ddcs-studio-project/              monorepo root (remote: fchabot-dxf/DDCS-Studio)
  DDCS-Studio/                    the Studio app — its own npm project
    web/                          ← served everywhere: Cloudflare publishes it; the gateway mounts it at /
      shared/js/                  THE shared ES6 modules (client, instrument, validate, tracker view, tokens)
      app.js · ui/ · wizards/ · engine/ · …   the app modules
    scripts/ · tools/ · tests/ · data/ · docs/   Studio's dev tooling (NOT served)
    package.json                  npm root stays here; web/ is just the deploy folder
  bridge/                         the bridge (imported; source only, no nested .git)
    bridge-app/
      fairy/                      Python gateway (serves web/ + shared/; embedded in the exe)
      web/ui/                     fairy LOCAL UI — end-of-life; archived at COMBINED-APP-PLAN Step 5
      shared/PROTOCOL.md          the contract (doc)
    controllers/ …                research + findings
  release.py                      Studio's existing release flow
  COMBINED-APP-PLAN.md            the active plan (one exe · LAN serving · cloud profile)
  ARCHITECTURE-MULTIUSER.md       the liability boundary (cloud generates, local controls)
  MONOREPO_PLAN.md                this file
```

---

## 4. Foundation phases (done)
- **P1 — Seam frozen.** `/api` ops + `PROTOCOL.md`. ✅
- **P2 — Establish `shared/js/`.** ✅ `client.js` + `instrument/` live only in `shared/js/`
  (duplicate copies removed). `node shared/js/instrument/selftest.mjs` passes.
- **P3 — Wire the no-build serving.** ✅ `server.py` gained a `/shared/` static mount (via
  `Config.shared_dir`, served as `text/javascript`); the exe build bundles `shared/`; Studio gained
  `npm run start:shared`.

Everything after P3 is carried by `COMBINED-APP-PLAN.md` Steps 1–9.

---

## 5. Open questions
- ⬚ **Instrumenter beacon placement.** The shared `instrument/` places a beacon on *any* Z-rise; the
  `eee.nc` finding showed that lands ~2/3 of beacons mid-cut in a morphed spiral. Add a
  **pure-vertical-retract** option (require X/Y held), gated on the live stall-test? (Lives in
  `shared/js/instrument/` — benefits every consumer.)
- ⬚ **Studio's standalone bundle** — do we keep `bundle_standalone.py` working through the move, or
  let the commodity lag until needed?

---

## 6. Risks / notes
- **Don't recreate the duplication trap:** all work happens in `DDCS-Studio`; the old `ddcs-pc-bridge`
  folder + `ddcs-studio-project` copies are frozen/deleted.
- **Studio release flow** (`release.py`, versioning) is untouched by the monorepo; note the release
  coupling in `COMBINED-APP-PLAN.md` (every Studio release re-ships the gateway; the frozen seam makes
  that safe).
