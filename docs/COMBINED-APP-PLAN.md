# One App — embedded gateway + Studio + personal cloud

> **Status:** DECIDED (June 2026). Supersedes the P4–P6 phasing in `MONOREPO_PLAN.md`.
> Respects `ARCHITECTURE-MULTIUSER.md` (cloud generates, local controls) — nothing here changes that boundary.

---

## The decision

The local face becomes **one exe = embedded gateway + Studio UI + optional LAN serving**:

- **One process.** The exe starts the gateway in-process and opens a window on the Studio it serves.
  Closing the window shuts everything down (AXYZ-style lifecycle — chosen deliberately).
- **The separate fairy local UI is end-of-life.** Its views (Files, History, Setup, gateway control,
  live Queue/Tracker) move into Studio behind gateway detection. One UI from then on.
- **"Personal cloud" = LAN serving.** A setup toggle binds the LAN IP instead of `127.0.0.1`; any
  phone/tablet/laptop on the user's wifi opens `http://192.168.x.x:<port>` in a plain browser — full
  Studio, live tracker, no install. The user's own PC hosts it; the host is never in the path.
- **Hosted Studio (Cloudflare) is untouched** — same `web/` folder, machine *views* gated absent.
  The header's **GATEWAY tab stays visible but greyed**; clicking it offers the **full-exe download**
  (the funnel from hosted → desktop). It gains profile **import** (and later account sync) — data
  only, never control.

### Lifecycle rule (one rule, no surprises)
Window close = full shutdown, **including** LAN serving — everyone's tablet goes dark when the
machine-PC window closes. The machine-PC window stays open while the shop runs. If that ever chafes,
"minimize to tray, keep serving" is a small later add, not an architecture change.

### Why the profile-to-cloud is fine
The boundary forbids **control flowing down** (cloud → controller). A controller profile is **data
flowing up** (controller → local Studio → cloud) — explicitly in the cloud column of the
`ARCHITECTURE-MULTIUSER.md` table. Direction also works in the browser: an `http://` LAN page may
call an `https://` API (only the reverse is blocked); the Worker just needs CORS.

---

## Steps

Ordered so every step ships working and nothing breaks mid-way. P1–P3 of `MONOREPO_PLAN.md` are done
and unchanged (seam frozen · `shared/js/` established · no-build serving wired).

### Step 0 — Record the decision ✅
This file. Cross-reference from `MONOREPO_PLAN.md` and `ARCHITECTURE-MULTIUSER.md`.

### Step 1 — Gateway serves Studio ✅ (2026-06-11)
`server.py` serves `Config.studio_dir` (= `DDCS-Studio/web/`) at `/`; the legacy fairy console moved
to `/fairy/`; `--studio` CLI flag + repo auto-detect; `benchgateway.spec` bundles `web/` as `studio`.
**Verified:** Studio loads at `http://127.0.0.1:<port>` same-origin with `/api` — LED lights, GATEWAY
tab un-greys, `/fairy/` still answers. (Live-controller Pull check pending the bench being on.)

### Step 2 — Studio absorbs the machine-side views ✅ (2026-06-11)
The fairy views (Queue/Tracker · Submit · Files · History · Setup) are ported verbatim to
`web/ui/gateway/` and rendered by `ui/gatewayPanel.js` inside `#gateway-app`, behind the header's
STUDIO/GATEWAY app-switcher. `ui/gatewayStatus.js` gates it all on gateway detection; the panel is
lazy-loaded and only polls while visible. Hosted Studio never shows any of it.
**Verified (Playwright, both faces):** bridged — panel mounts, 5 sub-tabs, view switching, back to
Studio; standalone — LED hidden, tab greyed, download popover, no panel, no JS errors.

### Step 3 — LAN binding toggle (the personal cloud) ✅ (2026-06-11)
Setup gained "Allow other devices on my network" → saves `host` `"0.0.0.0"`/`"127.0.0.1"` (validated,
persisted via `_PERSIST_KEYS`, applied on gateway restart). `get_config` exposes `host`/`port`/`lan_ip`
so the Setup view shows the exact phone URL. `fairy_gateway.py` no longer forces `--host`.
**Verified:** API round-trip + Setup UI (toggle, off-state hint, live LAN URL). Real phone-on-wifi
check pending a LAN-bound run.

### Step 4 — The single exe ✅ code + build (2026-06-12); window-cycle test pending
`fairy_gateway.py` gained: **single-instance check** (HTTP probe of the port before starting — a
second copy shows a native "already running" box and exits; two gateways double-binding 8765 was
observed live, so this is not theoretical), **close-confirm** (pywebview `closing` event: if a job is
tracking, native Yes/No "the machine keeps running, but tracking and LAN serving stop" — No cancels
the close), and **guaranteed exit** (`os._exit(0)` after the window closes — no orphan process, COM
released). Job state is already durable (the poller persists status continuously), so no extra flush
is needed. `build_fairy.ps1` + `benchgateway.spec` bundle `DDCS-Studio/web` as `studio`;
**`fairy.exe` (14.5 MB) builds clean.**
**Still to verify by hand (GUI):** open/close cycles, second-launch refusal box, close-mid-job prompt.

### Step 4b — TRANSFER from Studio's editor ✅ (2026-06-12)
The `docs/addstudiotransfer.md` feature, collapsed by the one-app architecture (same-origin client —
no URL/token settings needed): a 📡 **TRANSFER** header button left of DOWNLOAD sends the current
editor program **deliver-only** via `client.submitJob` (no beacon map — deliver ≠ run; the operator
presses Cycle Start). `editorManager.buildProgram()` is shared by EXPORT and TRANSFER so the file on
the controller is byte-identical to the download. Gated by the same gateway detection as the LED/tab
(via a `ddcs:gateway-status` event from `gatewayStatus.js`).
**Verified (Playwright):** bridged — un-greys, sends, toast, job lands in the queue; standalone —
greyed and inert, no errors. Pre-flight lint hook deferred until the VERIFY panel
(`addstudioverify.md`) exists.

### Step 5 — Retire the fairy local UI
Once Step 2 covers everything it did, archive `bridge-app/web/ui/`. One UI from here on.
**Verify:** a full job cycle (submit → run → track → history) done entirely from gateway-served Studio.

### Step 6 — Profile to the cloud, v1: export/import ✅ (2026-06-12)
Already mostly existed (`profileStore.js` export/import + Settings "Pull from controller") — what was
stale was the bridged check: Pull and the auto-offer gated on the old `?api=`/`ddcs_api` localStorage
override, so the same-origin (gateway-served / exe) face wrongly said "not bridged". Both now just try
the client seam and fall back silently — bridged works with zero config, hosted stays inert.
**Verified (Playwright):** gateway-served — Pull applies the profile; Export downloads it (hardwareTabs
present, **no bridge token** — the token-hygiene rule holds); standalone — Import applies it;
round-trip matches exactly. Live-controller pull (pins from the real bench) pending hardware.

### Step 7 — Repoint Cloudflare Pages → Studio
The old P6, unchanged: Pages publishes `DDCS-Studio/web/`; the bare cloud console retires.
**Verify:** hosted URL shows Studio with machine views absent and the GATEWAY tab greyed
(click → exe download); no request from that page ever targets a local address.

### Step 8 — Accounts + profile sync, v2
Worker endpoint (+ CORS for `http://` LAN origins) and accounts; local Studio gains "Send profile
to cloud"; any logged-in Studio reads it back. The only step with real new cloud surface — which is
why it's last.
**Verify:** profile pushed from the LAN exe appears in hosted Studio on another device; the Worker
has no endpoint that could ever carry a command toward a gateway.

### Step 8b — Cloud-storage seam (Google Drive · OneDrive · Dropbox)
A *storage seam* in Studio, mirroring the `client.js` transport seam: one interface
(`list / read / write` for programs + profiles) with pluggable backends — local file (today's
open/save), the gateway's CNCDISK (exists via `/api/files`), and OAuth providers (Google Drive
first). Pure **data**, so it lives cleanly on the cloud side of the liability boundary — no control
implications. Caveat that decides the design: provider OAuth allows `https://` origins and
`http://localhost`, but **not** `http://<lan-ip>` — so Drive works in hosted Studio and on the
machine PC, while phones on the LAN face route Drive access through… (options: gateway-side token
broker, or "open the hosted Studio on the phone for Drive"). Decide when building it; design the
seam interface first so backends slot in.

### Step 8c — Remote job submit: the three-tier decision (DECIDED 2026-06-12)
The R2/Worker relay (hosted page → Worker → R2 inbox → gateway polls → delivers) exists and is
proven. "Deliver ≠ run" holds everywhere (files only; operator presses Cycle Start; push-only).
Who *operates* the relay is the liability line:
1. **Personal (today):** our own Worker + R2 driving our own machines — keep, it's the remote face
   of the personal setup.
2. **Multi-user hosted Studio:** ships with **no** remote submit at all. Strangers get
   generate/simulate/profiles only. The host never operates a relay toward anyone's machine.
3. **BYO rendezvous (offer as code, never as service):** users who want remote submit run their own:
   - **Synced-folder mode (zero new code):** point the gateway's existing `local` backend `--root`
     at a folder inside the user's Google Drive / OneDrive / Dropbox sync folder — the sync client
     *is* the relay, under the user's own account. One guard to build first: **partial-sync
     protection** (write-to-temp-then-rename on the producer + size-stable check in the poller) so a
     half-synced `.nc` can never deliver truncated.
   - **Provider API backends (later):** `DriveBackend` etc. implementing the same `backend/`
     interface as `local_folder.py`/`r2.py`, using the user's own OAuth credentials; or BYO R2 keys.
   We ship the code and the guide; the user operates the account. The host stays out of the path.

### Step 9 — Live on the Expert
The old P7: the one hardware-only pass — full cycle on the real M350 over Modbus, **including the
close-mid-job behavior**, before calling the exe releasable.

---

## Known trade-offs (accepted)

- **No tracking while the window is closed.** Close Studio mid-job and beacons have nowhere to land;
  history gets a gap. Known trade of the AXYZ-style lifecycle, not a flaw.
- **LAN binding widens exposure** — deliberate, off by default, user-toggled in Setup.
- **Release coupling:** every Studio release re-ships the gateway. The seam (`PROTOCOL.md` / `/api`
  ops) stays frozen, so the static files just ride along.
