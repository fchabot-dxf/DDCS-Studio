# bridge-app — DDCS Expert job bridge

⚠ **STALE, t2651: this file's own "beacons"/"Instrument" mentions below describe the progress-tracking
mechanism REMOVED by BACKLOG #78 (t2649, owner-directed 2026-09-04 — never demonstrably ran end-to-end).**
Every job now delivers synchronously — no "tracked vs deliver-only" split, no map, no watch phase. The
replacement is BACKLOG #79's live Modbus position/run-state polling. Current contract:
[`shared/PROTOCOL.md`](shared/PROTOCOL.md).

Push a CNC job from anywhere, watch it run on the **DDCS Expert (M350)** — without exposing the
machine to the internet. This is the application the rest of the repo's findings were building toward.

> Targets the **Expert** specifically (uses Expert-only Modbus `MSETDATA` + the confirmed SMB write to
> CNCDISK). Not for the V4.1 bench. See [`../controllers/expert-m350/FINDINGS.md`](../controllers/expert-m350/FINDINGS.md).

> **Scope (t2649, BACKLOG #78, 2026-09-04):** every job delivers the same way — claim, write to the
> controller, mark `delivered`/`failed`. No per-job map, no watch phase (the beacon mechanism this "two job
> types" scope note used to describe — tracked-via-beacons vs. deliver-only — is REMOVED; see
> [`shared/PROTOCOL.md`](shared/PROTOCOL.md) §1-2/§4).
>
> **No bucket retention either way:** the `.nc` is deleted from the bucket the instant it's delivered — the
> file then lives on the **controller's CNCDISK**, which is where same-session re-runs come from (re-select +
> Start); days later you regenerate. Only the tiny `status/<jobId>.json` (no G-code) persists.

## Two parallel apps, one bucket
The system is **two independent programs** that never talk directly — they rendezvous through a cloud
bucket (Cloudflare **R2**). That decoupling is what gives us a queue and "submit while CNC-FAIRY is
asleep, it auto-completes on wake."

```
   web/  ──writes jobs / reads status──▶  R2  ◀──reads jobs / writes status──  fairy/
   (Cloudflare app, the UI)            (bucket)                         (CNC-FAIRY, the hardware)
```

- **`web/`** — the centralized web app (Cloudflare Pages + Worker). Everything the operator touches:
  **send code · queue · live tracker.** Open from the ASUS, a phone, anywhere.
- **`fairy/`** — the headless bridge on CNC-FAIRY (the only PC cabled to the Expert). No UI. A loop:
  **poll R2 → write `.nc` to the Expert (SMB) → mark delivered.** Optionally also polls the controller's own
  Modbus registers for live position/run-state (BACKLOG #79). Outbound-only, never internet-reachable.
- **`shared/`** — [`PROTOCOL.md`](shared/PROTOCOL.md): the contract both apps obey (R2 bucket layout, status
  object, job lifecycle). Read this first — it's the seam.

**Design docs:** [`CONFIGS.md`](CONFIGS.md) (vocabulary · deployment configs · shells · distribution · future
seams) · [`ROADMAP.md`](ROADMAP.md) (build phases) · [`ARCHITECTURE.md`](ARCHITECTURE.md) (module map).
Vocabulary: **Console** (web app) ↔ **Gateway** (fairy) ↔ **Rendezvous** (R2); the Worker is the **API**.

## Why this shape (decisions on record)
- Transport = **cloud-poll via R2**, chosen over an exposed token endpoint to keep the CNC machine
  un-exposed. Full argument: [`../TRANSPORT_DECISION.md`](../archive/TRANSPORT_DECISION.md).
- The **transfer to the Expert is a plain SMB file copy** to `\\192.168.0.99\CNCDISK` (confirmed R/W
  2026-06-06). The cloud hop only gets bytes *to* CNC-FAIRY across the isolating guest WiFi.
- **[REMOVED t2649] Beacons** used to be `MSETDATA` progress pushes decoded into `%`/op/line/ETA — the
  transport was proven wedge-free, but the feature itself never demonstrably ran end-to-end (BACKLOG #78's
  own evidence table). Replaced by BACKLOG #79's live Modbus position/run-state polling — continuous, no
  file instrumentation.

## Safety (non-negotiable)
- **Delivery is automatic; running is not.** The file lands on the controller hands-free, but the
  **operator presses Cycle Start** at the machine. Remote auto-start is not confirmed — and is the gate.
- **No jog / no live motion control** here. That's a future, *separate*, local low-latency module with a
  hardware E-stop + watchdog (see [`../controllers/shared/ARCHITECTURE.md`](../controllers/shared/ARCHITECTURE.md)). This app is deliver + observe only.
- The controller stays **isolated** on its private cable; its wide-open `guest=root` SMB never touches a
  shared/public network.

## Status
- [x] Beacon instrumenter (Python reference, `checkpoint_insert.py`) — built, tested.
- [x] UI mockup ([`../controllers/expert-m350/tools/bridge_ui_mock.html`](../controllers/expert-m350/tools/bridge_ui_mock.html)) — open in a browser.
- [ ] `shared/PROTOCOL.md` — the contract (this scaffold).
- [x] `fairy/` — bridge loop on the **LocalFolder** backend (Poller/Transfer/Tracker/Slave seam); `--self-test` + `--demo` pass end-to-end, no hardware/cloud. R2 backend written ([TO TEST] live).
- [ ] `web/` — submit + beacon (browser) + queue + tracker, on R2.

## Build order
1. Lock `shared/PROTOCOL.md` (the seam).
2. `fairy/` against a **LocalFolder** backend → run instrument → "upload" → relay → tracker end-to-end here, no cloud account needed.
3. Swap in the **R2** backend.
4. `web/` (Pages + Worker), reusing the mockup as the frontend.
