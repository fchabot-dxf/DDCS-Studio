# MONOREPO ARCHITECTURE PLAN — DDCS Studio + Bridge

> **Status:** draft for review — *edit this freely.* Authoritative plan for the merged repo.
> Supersedes the early draft at `bridge/bridge-app/MONOREPO_PLAN.md` (delete that once this is agreed).
> Markers: ✅ **DECIDED** · 🔶 **PROPOSED** (default unless you change it) · ⬚ **OPEN** (needs your call).

---

## 0. One-paragraph summary
The bridge moved into the DDCS Studio repo (one monorepo). The single web console splits into **two
faces over a shared core**: a **fairy local UI** that never leaves CNC-FAIRY (monitor + gateway control),
and **Studio**, which gains the **remote function** (Submit + Track). Truly-shared code lives in
`shared/js/` and is consumed **with no build step** — each app's *server* exposes `shared/`. The
gateway, cloud Worker, R2, and `PROTOCOL.md` are unchanged: they're the frozen seam both faces obey.

---

## 1. Decisions
- ✅ **Monorepo, rooted in DDCS Studio.** `DDCS-Studio/` is the repo; the bridge lives at
  `DDCS-Studio/bridge/` beside `ddcs-studio-modular/`. The standalone `ddcs-pc-bridge` repo is frozen.
- ✅ **Two faces.** fairy **local UI** (CNC-FAIRY only) + **Studio** (anywhere).
- ✅ **Studio gets Submit + Track** (the remote function; replaces the Cloudflare Pages bare console).
- ✅ **Maximal `shared/js/`** for future flexibility — `client.js` + `instrument/` + tracker view +
  style tokens, single source at the monorepo root. (Maximal partly *because* fairy-submit is open —
  see ⬚ below; if fairy ever submits, the instrumenter is already shared.)
- ✅ **No build pipeline.** Sharing is solved by **serve config**, not a bundler (§4). The standalone
  HTML / pywebview exe stays an *optional commodity*, not a dependency.
- 🔶 **Cloud face = Studio.** The bare Pages console is retired; Studio (on Pages) becomes the remote
  face, talking the same `/api` contract via the existing Worker + R2.

---

## 2. North-star architecture
```
   fairy LOCAL UI  (CNC-FAIRY only)            STUDIO  (design PC / phone — anywhere)
   served by server.py @ localhost             served by http-server / Cloudflare Pages
   ┌──────────────────────────┐               ┌──────────────────────────────┐
   │ Queue · Tracker (live)    │               │ authoring + wizards (today)  │
   │ Files (CNCDISK)           │               │ + Submit (instrument→queue)  │
   │ History                   │               │ + Track (mirror progress)    │
   │ Setup / gateway control   │               └──────────────┬───────────────┘
   │ ⬚ Submit? (maybe)         │                              │
   └──────────────┬────────────┘                              │
        imports /shared/…       ┌──── shared/js (max) ────────┴── imports ../../shared/…
                  └─────────────►│ client.js · instrument/ · tracker view · tokens │◄──┘
                                 └──────────────────────────────────────────────────┘
   talk to:  localhost /api (server.py)        R2 via Worker /api  (+ localhost when on-box)
   SEAM (frozen): shared/PROTOCOL.md · the /api ops surface (ops.py) · beacon frame
```
Neither face talks to the other. They rendezvous at **R2** (remote) or **localhost** (local). The
contract is already built and proven — nothing new to invent in the seam.

---

## 3. View allocation
| View | fairy local UI | Studio | Notes |
|---|:---:|:---:|---|
| Queue · Tracker | ✅ live, zero-lag | ✅ mirror | both render their own view over the same status JSON |
| **Submit** (+ instrumenter) | ⬚ **OPEN** | ✅ | Studio is the primary author→submit path; fairy-local submit is undecided |
| Files (CNCDISK) | ✅ | ❌ | file ops belong at the machine |
| History | ✅ | ⬚ open (read-only remote?) | both could show it |
| Setup / Admin (gateway cfg) | ✅ local-only | ❌ | cloud can't configure the gateway, by design |
| Gateway control (pause/cancel/clear/reconnect) | ✅ | ❌ | the operator's at-machine controls |

---

## 4. The shared core + how it's consumed (no build)
**Location:** `DDCS-Studio/shared/js/` — single source.
**Contents (maximal):** `client.js` (the `/api` seam) · `instrument/` (`gcode-parse.js`, `instrument.js`,
`selftest.mjs` — the `checkpoint_insert.py` port) · the tracker/queue **view** · style tokens.

**Consumption — serve config, not a bundler:**
- **fairy** — `server.py` is *ours*, so it gains a small **`/shared/` static mount** (a server feature,
  not a build). The fairy UI imports `import … from '/shared/js/client.js'` (absolute, gateway-served).
- **Studio** — served by `http-server`/Pages; root the server **one level up** so `shared/` is in the
  served tree, and import `'../../shared/js/…'` (relative). No bundler needed.
- The shared modules use **internal relative imports** (`instrument.js` → `./gcode-parse.js`), so they
  don't care *how* they're mounted — only the two *entry* references differ (absolute vs relative).
- **Optional bundle** (`bundle_standalone.py`): follows those imports later if/when we ship a one-file
  download. Not a dependency.

**Single-source discipline:** the JS instrumenter keeps its `selftest.mjs` parity with the Python
`checkpoint_insert.py` (the existing anti-drift contract).

---

## 5. Monorepo layout
```
DDCS-Studio/                      monorepo root (remote: fchabot-dxf/DDCS-Studio)
  ddcs-studio-modular/            the Studio app (authoring; gains Submit + Track)
    src/ …                        served from a root that includes ../../shared (no build)
  bridge/                         the bridge (imported; source only, no nested .git)
    bridge-app/
      fairy/                      Python gateway (+ /shared static mount)
      web/ui/                     fairy LOCAL UI — monitor + control (+ ⬚ submit?)
      shared/PROTOCOL.md          the contract (doc)
    controllers/ …                research + findings
  shared/js/                      THE shared ES6 modules (client, instrument, tracker view, tokens)
  release.py                      Studio's existing release flow (unchanged)
  MONOREPO_PLAN.md                this file
```

---

## 6. Migration phases (incremental; nothing breaks mid-way)
- **P1 — Seam frozen.** `/api` ops + `PROTOCOL.md`. ✅ done.
- **P2 — Establish `shared/js/`.** Move `client.js` + `instrument/` (+ later tracker view, tokens) to
  `shared/js/`. Verify `node shared/js/instrument/selftest.mjs` passes. *No UI wired yet.*
- **P3 — Wire the no-build serving.** Add the `/shared/` mount to `server.py`; re-point the fairy UI's
  imports to `/shared/…`; set Studio's serve-root to include `shared/`. Both apps still render exactly
  what they render today — just sourcing shared modules from one place.
- **P4 — Slim the fairy local UI.** Monitor + control + Files + History + Setup. Resolve ⬚ submit.
  Lock `server.py` to `127.0.0.1`; bundle into `fairy.exe`.
- **P5 — Studio Submit + Track.** Studio imports the shared `instrument/` + `client.js` + tracker view;
  builds its Submit and Track tabs (on its existing `addstudiotransfer.md` / `addstudioverify.md` specs).
- **P6 — Repoint the remote face.** Cloudflare Pages → Studio. Retire the bare cloud console.
- **P7 — Live on the Expert.** Real Modbus beacons end-to-end (the one hardware-only test).

---

## 7. Open questions (your calls — edit freely)
- ⬚ **Does the fairy local UI submit?** (e.g. a local fallback to run a job from CNC-FAIRY without
  Studio.) If yes, fairy also imports the shared `instrument/` — already covered by maximal-shared.
- ⬚ **Remote History/Files in Studio?** Read-only views, or keep them at-machine only?
- ⬚ **Tracker view: shared code or per-app render?** One shared view component vs each face renders its
  own over the same status JSON. (Maximal-shared assumes a shared component; easy to back out.)
- ⬚ **Instrumenter beacon placement.** The shared `instrument/` places a beacon on *any* Z-rise; the
  `eee.nc` finding showed that lands ~2/3 of beacons mid-cut in a morphed spiral. Add a
  **pure-vertical-retract** option (require X/Y held), gated on the live stall-test? (Lives in
  `shared/js/instrument/` — benefits every consumer.)
- ⬚ **Studio's standalone bundle** — do we keep `bundle_standalone.py` working through the move (follow
  `../../shared` imports), or let the commodity lag until needed?

---

## 8. Risks / notes
- **Two entry import styles** for `shared/` (fairy absolute `/shared/…`, Studio relative `../../shared/…`)
  — cosmetic; the modules themselves are mount-agnostic.
- **Don't recreate the duplication trap:** all work happens in `DDCS-Studio`; the old `ddcs-pc-bridge`
  folder + `ddcs-studio-project` copies are frozen/deleted.
- **fairy stays outbound-only + isolated** — the `/shared/` mount serves static files on `localhost`
  only; it does not widen the machine's exposure.
- **Studio release flow** (`release.py`, versioning) is untouched by adding `bridge/` + `shared/`.
