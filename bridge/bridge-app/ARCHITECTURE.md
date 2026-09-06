# bridge-app — Architecture

> **Confidence key**, used throughout: **[SHIPPED]** verified live/self-tested and in the code today ·
> **[TO TEST]** written, believed correct, never proven against the real thing · **[REMOVED]** existed once,
> deliberately deleted, kept here only as a pointer to why. Grounded in the code as it stands (checked
> against the actual module list and docstrings, not memory of past turns) — a claim with no tag is a bug in
> this file, not a hedge.

Job-lifecycle rules (queue/claim/restart/Drive-refusal) are **not** repeated here — the one source is
[`JOB-RULES.md`](JOB-RULES.md). The R2/status-object/CNCDISK-command contract is
[`shared/PROTOCOL.md`](shared/PROTOCOL.md). This file is the **module map**: every file, where it runs, what
it does — cross-linking those two rather than restating them.

- The contract between the apps: [`shared/PROTOCOL.md`](shared/PROTOCOL.md)
- Job lifecycle, claim gate, Drive-send rules: [`JOB-RULES.md`](JOB-RULES.md)
- Why cloud-poll (not an exposed endpoint): [`../TRANSPORT_DECISION.md`](../archive/TRANSPORT_DECISION.md)
- The confirmed facts this is built on: [`../controllers/expert-m350/FINDINGS.md`](../controllers/expert-m350/FINDINGS.md)

---

## 1. System overview

**[SHIPPED]** Two independent programs that never connect to each other directly — they meet only through a
rendezvous store. What changed since this doc was last accurate: **there are now THREE possible
rendezvous stores** (local-folder for testing, Cloudflare R2, and the user's own Google Drive), and the
Console (`web/`) can be served **by the gateway itself**, not only by Cloudflare — see §3.

```
        ╔═══════════ CONSOLE  (the operator-facing UI — several ways to serve it, §3) ═══════════╗
        ║  Submit · Queue · Files · History · Admin (web/ui/) — one client.js transport seam      ║
        ╚══════════════════════════════════╤═══════════════════════════════════════════╤═════════╝
                                            │ same-origin /api (local)      OR bearer-token /api (cloud)
                                            ▼                                           ▼
                         [ the gateway's own local server ]           [ Cloudflare Pages Function ] [TO TEST]
                                            │                                           │
                                            └──────────────┬────────────────────────────┘
                                                            ▼
                              ┌── the rendezvous — ONE of three, config.backend ──────────────┐
                              │  local (test)  ·  r2 (dev's bucket) [TO TEST, not in the exe]  │
                              │  drive (the USER'S OWN Google Drive) [SHIPPED] — the real path  │
                              └────────────────────────────┬───────────────────────────────────┘
                                                      GET job / LIST inbox   PUT status
                                                             ▼                    │
        ╔═══════════════ fairy/  (the gateway daemon — the only wired PC) ══════════════════════╗
        ║  Poller ─▶ Transfer (SMB) ─▶ Expert     Position/Tracking poll (Modbus, opt-in, M350)  ║
        ╚═══════════════════════════════════════════╤══════════════════════════════════════════╝
                                                      │ cable (192.168.0.x, isolated)
                                                      ▼
                                                 [ DDCS Expert ]
```

**The two apps never connect to each other directly.** The Console writes jobs to the rendezvous and reads
status back; the gateway reads jobs from it and writes status to it. This decoupling is what delivers the
queue, offline-tolerance ("submit while the gateway sleeps, it delivers on wake"), and the un-exposed
machine.

---

## 2. Design principles
1. **One rendezvous, several implementations.** No direct app-to-app connection; whichever backend is
   configured holds all shared state. **[SHIPPED]**
2. **Modular.** Each app is a set of small single-purpose modules with explicit inputs/outputs. The
   rendezvous backend, the Console's transport, and the cloud identity provider all sit behind interfaces.
3. **The machine is never internet-reachable.** `fairy/` makes only *outbound* calls. No inbound listener.
   **[SHIPPED]**
4. **Deliver, don't run.** The app lands files on the controller; the **operator presses Cycle Start**. No
   remote start, no jog, no live motion — out of scope (see §10 Safety). **[SHIPPED]**
5. **Testable without hardware or cloud.** The `local` backend lets the whole pipeline run on one PC.
   **[SHIPPED]**
6. **A user's own cloud, not the developer's.** The shippable exe's cloud path is the user's own Google
   Drive — `drive.file` scope, their quota, their trust boundary — not a shared bucket the developer pays
   for. **[SHIPPED]** See §4's Backend row.

---

## 3. The Console (`web/`) — one UI, several serving configs

**Function:** everything the operator touches — send code, queue, watch the tracker, browse CNCDISK, see
history, adjust Setup. **Tech:** plain HTML/CSS/JS, no framework. **Never runs on the machine's own PC**
except as the gateway serving it locally (below) — it has no direct machine access; its only outside contact
is `client.js`'s own `/api` seam.

### Two ways it actually gets served today
| Config | How | Backend behind it | Status |
|---|---|---|---|
| **Gateway-served (local/LAN)** | The gateway's own `fairy/server.py` serves the Studio web app (`DDCS-Studio/web/`) at `/`, plus the `/api/*` JSON surface, plus the monorepo `web/shared/` at `/shared/`. Binds `0.0.0.0:8765` by default (reachable from a phone on the same LAN). | Whatever `config.backend` is (`local`/`r2`/`drive`) — same-origin, `client.js`'s default `LocalClient`. | **[SHIPPED]** — this is what the desktop exe (`fairy_gateway.py`) runs; also runnable as a plain Python service. |
| **Cloud (Cloudflare Pages)** | `web/functions/api/[[path]].js`, a Pages Function, serves the SAME `/api/*` contract from the edge, backed directly by R2 (`env.BUCKET` binding + a bearer `ACCESS_TOKEN`). Colocated with the static console so the client needs no change. | R2 only (this Function talks to the bucket directly, not through a gateway). | **[TO TEST]** — written, "once the Pages project + R2 binding + token exist" per its own header; not confirmed live. |

**[SHIPPED]** `client.js` (`DDCS-Studio/web/shared/js/client.js` — genuinely shared JS between DDCS Studio and
this app, not just documentation) is the transport seam every view codes against. Today there is exactly
**one** implementation, `LocalClient` (same-origin `/api`, works against either serving config above
unchanged). A `CloudClient`/`DirectClient` for reaching a gateway that ISN'T same-origin (e.g. a phone
reaching a LAN gateway directly) are named in the seam's own comments as future work, **not built**.

### Views (`web/ui/views/`)
| View | Function |
|---|---|
| **submit** | Send a `.nc` — local queue or Drive, per `JOB-RULES.md`'s send-gate rules. |
| **queue** | The pending/claimed jobs, FIFO by jobId. |
| **files** | The CNCDISK explorer — list + safe delete (PROTOCOL §7). |
| **history** | Finished-job log (PROTOCOL §3's `history/` key). |
| **admin** | Setup: controller path, machine name/id, backend choice, Google sign-in, sound, role override. |

**Deploys:** the gateway config ships inside the desktop exe (no separate deploy step); the cloud config
deploys via Cloudflare Pages (git-based) + `wrangler`/Pages Functions for the API.

---

## 4. `fairy/` — the gateway daemon

**Location:** the one PC physically cabled to the controller (`192.168.0.x`, isolated). Runs as a background
service (Task Scheduler on boot + resume) or as the desktop exe's own bundled process. **Function:** the
hardware bridge — poll the rendezvous → write the `.nc` to the Expert (SMB) → optionally poll the
controller's own Modbus registers for live position/run-state → serve the local Console + JSON API.
Outbound-only; never internet-reachable. **Tech:** Python 3; `pymodbus==3.6.9` (pinned); SMB via a mapped
drive; `urllib` for both R2 (dev path) and Drive (shipped path) — see the Backend row below for why R2 needs
`boto3` and Drive deliberately does not.

### Modules
| Module | Function | Confidence |
|---|---|---|
| **`bridge.py`** | Entry point / service loop. `run` (real), `--self-test` (offline logic checks), `--demo` (full pipeline on a temp LocalFolder). Wires everything below. | **[SHIPPED]** |
| **`config.py`** | Every knob in one dataclass: backend choice, R2 creds (env-only), Drive folder name, controller disk path, Modbus poll settings, machine identity, OAuth client id/secret, local-server host/port, sound, role override. `Config.from_env()` layers defaults < env < persisted `config.json` < CLI overrides, and does the OAuth-client bootstrap/repair + legacy-data migration described in §4.1 below. | **[SHIPPED]** |
| **`poller.py`** | The heart: `LIST inbox → claim oldest → Transfer → delete inbox entry → status delivered/failed`, synchronously within one tick (PROTOCOL §4; JOB-RULES.md §2 for the claim gate). No more "active job" concept — see §8. | **[SHIPPED]** |
| **`transfer.py`** | The ONLY module that writes to the controller. Plain SMB file copy to CNCDISK; `controller_disk_reachable()` is the one live-reachability check both the claim gate and the UI's own status read share. | **[SHIPPED]**, confirmed live 2026-06-06 |
| **`tracker.py`** | Pure function: `(job_id, name, state, events) → status object` (PROTOCOL §5). No side effects. | **[SHIPPED]** |
| **`identity.py`** | Writes/verifies `.bridge-machine.json` on the controller's own disk, so a job can never land on the wrong machine (identity travels WITH the controller, not the gateway). | **[SHIPPED]** |
| **`cncdisk.py`** | Publishes a CNCDISK listing to the rendezvous and executes web-issued `delete` commands — the one web→controller action, gated by an op-allowlist + no-traversal filename check. | **[SHIPPED]**, proven live on the V4.1 2026-06-07 |
| **`master.py`** | Modbus RTU **master/client** — the opposite direction from the old (removed) `slave.py`: this PC *polls* the controller's own Modbus slave-mode registers (needs controller param `P279=Slave`, Expert M350 firmware ≥2025-12-11 only — **not available on the V4.1**, which has no Modbus at all). `PositionPoller` runs continuously, decodes run-state + executing line number (float32 CDAB, confirmed on the owner's own machine). Read-only; never issues a blocking macro-side read, so it cannot wedge the controller the way the old beacon mechanism's risk profile did (see the module's own header for the full argument). Opt-in (`config.enable_position_poll`, default off). | **[SHIPPED]**, confirmed live 2026-09-05 |
| **`ops.py`** | The API-first operations surface — **two distinct capability groups**, both here so every caller (the local HTTP server today; a future MCP/embedded client) shares one definition: (a) **job/CNCDISK ops** — submit/list/status/history/files/delete, position + tracking status, log access; (b) **controller-profile ops** — SMB-scan for a reachable controller, read + parse its `.eng`/`coord1`/`camsetting`/`uservar` files, and map that into the shared profile shape DDCS Studio's own "import a controller" flow consumes (V4.1 and Expert each have their own mapping path). | **[SHIPPED]** for (a); controller-profile mapping in (b) is **[SHIPPED]** for the paths DDCS Studio's own import flow already drives live — see that feature's own docs for per-field confidence, not repeated here |
| **`server.py`** | Stdlib-only local HTTP server: serves the Console at `/`, the Ops surface as JSON at `/api/*`, and the monorepo `web/shared/` at `/shared/`. Binds `0.0.0.0` by default (LAN-reachable — a phone on the same wifi can reach it) unless configured to `127.0.0.1`. This is the "one-app face": the legacy standalone fairy console (pre-unification) still exists at `/fairy/` until it's retired. | **[SHIPPED]** |
| **`chime.py`** | Audio feedback on job events (`received`/`delivered`/`failed`) — a door chime / register / buzzer, chosen by the human, never a synthesized tone. Only ever reached through `Poller.on_sound`; fairy's own test surface (`--self-test`, unit tests) never calls it, so nothing in CI can play a sound. | **[SHIPPED]** |
| **`oauth.py`** | Desktop (loopback) Google OAuth so the embedded webview can sign in to Drive — Google blocks OAuth inside embedded webviews, so consent happens in the SYSTEM browser and the code is exchanged server-side here (public PKCE client, no secret needed at the client). Tokens persist in `~/.ddcs-bridge/google_token.json`, never in the synced profile. | **[SHIPPED]** |
| **`selfupdate.py`** | The desktop exe replaces itself: download beside the running exe → verify the sha256 → rename the running exe out of the way → move the new one into its place → relaunch. Ordering is the safety — anything failing before step 3 leaves the install untouched. | **[SHIPPED]** |
| **`webview_storage.py`** | Forces the embedded pywebview browser out of private mode into a persistent, per-user profile directory — otherwise the app's own workspace state (which lives in browser storage, not a server) is wiped on every close. One function, called by every launcher, so there is exactly one policy. | **[SHIPPED]** |
| **`backend/`** | The rendezvous seam — see the table below. |

### The Backend seam (`fairy/backend/`)
| Backend | For | Dependency | Ships in the exe? | Confidence |
|---|---|---|---|---|
| **`local_folder.py`** | Testing the whole pipeline on one PC, no cloud account | none | yes | **[SHIPPED]** |
| **`r2.py`** | The developer's own Cloudflare bucket | `boto3` | **no** — `desktop/build_fairy.ps1` explicitly excludes `boto3`/`botocore` to slim the build | **[TO TEST]** — logic mirrors `local_folder.py` 1:1, never proven against a real bucket, and structurally can't be from the shipped exe at all |
| **`drive.py`** | The user's OWN Google Drive — their quota, their account, their trust boundary | `urllib` + `json` only (stdlib) — deliberately no `requests`/Google client libraries, so it bundles into the exe for free | **yes — this is the real, working cloud path every shipped user actually gets** | **[SHIPPED]** |

All three implement the same small method set (`list_inbox`/`put_job`/`get_job`/`put_status`/`get_status`/
`list_statuses`/`delete_job`/`put_cncdisk_index`/`list_commands`/`clear_command`/`put_heartbeat`/
`append_history`/`list_history`) — the Poller/Tracker/Ops layer is backend-agnostic and cannot tell them
apart. **`config.backend` now defaults to `"drive"` automatically** once the user has signed in and never
explicitly chosen a backend (BACKLOG #81, t2659) — a user who never signs in stays on `local`, untouched.

**Deploys to:** wherever the operator runs the exe/service — install Python + `requirements.txt` (source) or
run the built exe (`desktop/build_fairy.ps1`); register as a Task Scheduler task (triggers: startup,
workstation unlock, system resume) for the always-on service shape.

---

## 5. `shared/`  (the protocol contract)
**Location:** repo only. **Function:** define the rendezvous seam so the Console and the gateway agree
without ever talking directly.
- [`shared/PROTOCOL.md`](shared/PROTOCOL.md) — bucket/store layout (§3), status object (§5), CNCDISK command
  channel (§7). The beacon-era checkpoint frame and per-job map it once defined are removed; that file's own
  §1-2/§4 record why, preserved as evidence rather than deleted.

Note: `web/shared/js/client.js` (§3 above) is a **different** "shared" — genuinely shared JavaScript between
this Console and DDCS Studio's own web app, not documentation. Two different things sharing one word; do not
conflate them.

---

## 6. End-to-end data flow

**Outbound (submit a job):**
1. Operator drops a `.nc` on the **submit** view (whichever serving config — §3).
2. **Queue client** (`client.js` + `submit.js`) → `POST /api/jobs` → the configured backend's `inbox/`.
3. **Poller** (fairy) LISTs `inbox/`, takes the oldest jobId.
4. **Transfer** copies the `.nc` onto the Expert's CNCDISK over SMB. Status → `delivered` (or `failed`) —
   terminal, in the same tick (JOB-RULES.md §2-3 for the claim-gate rules that guard this step).
5. Operator selects it on the panel and **presses Start** (the only manual step).

**Inbound (watch progress) — two independent channels, neither required by the other:**
- **Job status** — the Poller's own `delivered`/`failed` terminal state, mirrored to `status/<jobId>.json`.
  The **queue**/**history** views poll this. No live percent/ETA lives here anymore (see §8).
- **Live machine state** *(opt-in, Expert M350 only)* — `master.py`'s `PositionPoller` continuously polls the
  controller's own Modbus registers; `/api/position` (raw) and `/api/tracking` (decoded run-state + line)
  expose it. Process-wide, not attached to any one job.

---

## 7. Folder / module map
```
bridge-app/
  ARCHITECTURE.md            ← this file (module map)
  README.md                  ← overview
  JOB-RULES.md               ← job-lifecycle rules (the one source; see its own tags)
  CONFIGS.md                 ← vocabulary + deployment configs + future seams
  ROADMAP.md                 ← build phases
  shared/
    PROTOCOL.md              ← the rendezvous contract (Console ⇄ gateway)
  web/                       ── the Console ──
    ui/        index.html · app.js (view registry) · util.js ·
               views/{submit,queue,files,history,admin}.js
    functions/api/[[path]].js   Cloudflare Pages Function — the cloud config's own /api, R2-backed [TO TEST]
    wrangler.toml
  fairy/                     ── the gateway daemon ──
    bridge.py                  entry / service loop
    config.py                  every knob (backend, OAuth, Modbus poll, role, sound, server, ...)
    poller.py                  queue drainer (synchronous claim → deliver → terminal)
    transfer.py                SMB write to the Expert
    tracker.py                 (job_id, state) -> status object
    identity.py                machine identity (provision + verify-before-deliver)
    cncdisk.py                 CNCDISK listing + safe delete-command channel (PROTOCOL §7)
    master.py                  Modbus MASTER — position/run-state/line poll (Expert M350 only)
    ops.py                     API-first operations surface: job/CNCDISK ops + controller-profile ops
    server.py                  local HTTP server — serves the Console + /api/* + /shared/
    chime.py                   gateway-side audio feedback on job events
    oauth.py                   desktop loopback Google OAuth (Drive sign-in)
    selfupdate.py               desktop exe self-replacement
    webview_storage.py         persistent pywebview storage location (once, for every launcher)
    backend/   __init__.py (interface) · local_folder.py · r2.py [TO TEST] · drive.py
    requirements.txt
```

---

## 8. What changed since the beacon-era design (context for anyone reading old commits)
The original design (2026-06) had a Modbus **slave** the controller pushed instrumented checkpoints into,
decoded via a per-job map into `%`/op/line/ETA, with a "single active job" constraint because the beacon
frame carried no job id. **All of that is removed** (BACKLOG #78, t2649, owner-directed 2026-09-04 — the
feature never demonstrably ran end-to-end; the transport-level proof it left behind is preserved in
`shared/PROTOCOL.md` §1-2 as evidence, not instruction). What replaced it:
- **Delivery is now synchronous** — no watch phase, no "active" job, every claim reaches a terminal state in
  the tick that claimed it (§4's Poller row; JOB-RULES.md §2-3 for the rules governing when a claim is even
  allowed).
- **Live machine state (BACKLOG #79) is a separate, process-wide Modbus poll** (§4's `master.py` row) —
  continuous, needs no per-job map, never rewrites the user's `.nc`, and is Expert-M350-only.

Everything else in this section header used to live in the beacon design's own module list (`slave.py`,
`telemetry.py`, `checkpoint_insert.py`, `web/instrument/`) — those files are deleted, not archived.

---

## 9. Where every module runs (location summary)
| Module | Machine / platform | Language | Touches the machine? |
|---|---|---|---|
| web/ui/*, web/functions/api | browser (any) / Cloudflare edge | JS | no |
| fairy/poller, /tracker, /backend, /config, /ops (job half) | the gateway PC | Python | no (orchestration) |
| **fairy/transfer** | the gateway PC | Python | **yes — SMB write to CNCDISK** |
| **fairy/master** | the gateway PC | Python | **yes — serial Modbus poll (Expert only)** |
| **fairy/cncdisk** | the gateway PC | Python | **yes — SMB list + delete on CNCDISK** |
| fairy/ops (controller-profile half) | the gateway PC | Python | **yes — SMB read of `.eng`/`coord1`/etc.** |
| fairy/oauth, /selfupdate, /chime, /server | the gateway PC | Python | no |

Only **four** capabilities touch the controller — file delivery, the Modbus position poll, the CNCDISK
list/delete channel, and the read-only controller-profile scan. All isolated to specific modules so the
hardware surface stays small and auditable. Only `cncdisk`'s delete is web-triggered, gated by an
op-allowlist + target validation (PROTOCOL §7).

---

## 10. Safety boundaries
- **Deliver ≠ run.** No module presses Start. Files land on the controller; a human runs them.
- **The Modbus poll is read-only and PC-initiated**, the opposite relationship from the removed beacon slave
  — see `master.py`'s own header for why this direction cannot wedge the controller the way `MGETDATA`
  (a blocking macro-side call) can.
- **No jog / live control.** Explicitly out of scope; a future *separate, local, low-latency, E-stopped*
  module — never this path (see `../controllers/shared/ARCHITECTURE.md`).
- **Controller isolated.** `transfer`/`master`/`cncdisk`/the profile scan are the only paths to it, over the
  private cable; its `guest=root` SMB share never reaches a shared/public network.
- **Machine un-exposed.** `fairy/` is outbound-only; nothing on the gateway PC listens to the internet.
- **A user's own Drive, scoped tight.** The `drive` backend's OAuth scope is `drive.file` — this app can only
  ever see files IT created, never the rest of the user's Drive.

---

## 11. Build order & status
1. [x] `shared/PROTOCOL.md` — the rendezvous seam.
2. [x] `fairy/` against the **local** backend → self-test + demo pass, no hardware/cloud.
3. [x] SMB delivery + CNCDISK explorer, proven live on real hardware.
4. [x] The **Drive** backend — the real, shippable cloud path (stdlib-only, no exe build change).
5. [~] The **R2** backend — written, **[TO TEST]** live, and structurally excluded from the shipped exe.
6. [x] The gateway serves the Console itself (local/LAN config) — the desktop exe's actual shape today.
7. [~] The **Cloudflare Pages** cloud config (`web/functions/api/[[path]].js`) — written, **[TO TEST]** live.
8. [x] Live Modbus position/run-state/line polling (BACKLOG #79), Expert M350 only.
9. [ ] A `CloudClient`/`DirectClient` for a phone reaching a LAN gateway that isn't same-origin.
