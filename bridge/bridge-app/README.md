# bridge-app — DDCS Expert job bridge

Push a CNC job from anywhere, watch it run on the **DDCS Expert (M350)** — without exposing the machine to
the internet. This is the application the rest of the repo's findings were building toward.

> Targets the **Expert** specifically for its live Modbus position/tracking poll (needs controller param
> `P279=Slave`, firmware ≥2025-12-11). SMB job delivery works on any controller sharing CNCDISK; the **V4.1
> bench has no Modbus at all**, so it gets delivery without the live-tracking half. See
> [`../controllers/expert-m350/FINDINGS.md`](../controllers/expert-m350/FINDINGS.md).

> **Job lifecycle — one source, not repeated here:** [`JOB-RULES.md`](JOB-RULES.md). Every job delivers the
> same way today (claim → write to the controller → `delivered`/`failed`) — no per-job map, no watch phase.
> **No bucket/store retention either way:** the `.nc` is removed from the rendezvous the instant it's
> delivered — it then lives on the **controller's own CNCDISK**, which is where a same-session re-run comes
> from (re-select + Start); regenerate for anything later. Only the tiny `status/<jobId>.json` persists.

## Two parallel apps, one rendezvous
The system is **two independent programs** that never talk directly — they meet through a **rendezvous
store**, which can be any of three things depending on setup (see below). That decoupling is what gives us a
queue and "submit while the gateway is asleep, it delivers on wake."

```
   Console (web/)  ──writes jobs / reads status──▶  rendezvous  ◀──reads jobs / writes status──  fairy/
   (the operator's UI, several ways to serve it)   (local / R2 / Drive)      (the gateway PC, cabled to the mill)
```

- **`web/`** — the Console. Submit · Queue · Files · History · Admin. Served either by the gateway itself
  (the desktop exe's actual shape — reachable from a phone on the same LAN) or, for a fully cloud config, by
  a Cloudflare Pages Function `[TO TEST]`. Open from wherever the operator is.
- **`fairy/`** — the gateway daemon on the PC cabled to the Expert. No separate UI of its own anymore (it
  serves the Console — see above). A loop: **poll the rendezvous → write the `.nc` to the Expert (SMB) →
  mark delivered.** Optionally also polls the controller's own Modbus registers for live position/run-state.
  Outbound-only, never internet-reachable.
- **`shared/`** — [`PROTOCOL.md`](shared/PROTOCOL.md): the rendezvous contract both sides obey (store layout,
  status object, job lifecycle pointer). Read this first — it's the seam.

**The rendezvous is one of three backends** (`config.backend`): `local` (single-PC testing), `r2` (the
developer's own Cloudflare bucket — written, **[TO TEST]** live, and structurally excluded from the shipped
exe), or `drive` (the operator's **own** Google Drive — stdlib-only, ships in the exe, and is the real cloud
path every user actually gets; auto-selected once they sign in and never explicitly choose otherwise).

**Design docs:** [`ARCHITECTURE.md`](ARCHITECTURE.md) (full module map, with confidence tags) ·
[`CONFIGS.md`](CONFIGS.md) (vocabulary · deployment configs · distribution) · [`ROADMAP.md`](ROADMAP.md)
(build phases) · [`JOB-RULES.md`](JOB-RULES.md) (job lifecycle — the one source).
Vocabulary: **Console** (`web/`) ↔ **Gateway** (`fairy/`) ↔ **Rendezvous** (local/R2/Drive).

## Why this shape (decisions on record)
- Transport = **cloud-poll**, chosen over an exposed token endpoint to keep the CNC machine un-exposed. Full
  argument: [`../TRANSPORT_DECISION.md`](../archive/TRANSPORT_DECISION.md).
- The **transfer to the Expert is a plain SMB file copy** to the controller's own CNCDISK share (confirmed
  R/W 2026-06-06). The cloud hop only gets bytes *to* the gateway across an isolating network.
- **[REMOVED, BACKLOG #78, t2649] Beacons** — `MSETDATA` progress pushes decoded into `%`/op/line/ETA. The
  transport itself was proven wedge-free, but the feature never demonstrably ran end-to-end. Replaced by
  **live Modbus position/run-state polling** (BACKLOG #79) — continuous, no file instrumentation, Expert
  M350 only. Full account: [`ARCHITECTURE.md`](ARCHITECTURE.md) §8.
- **A user's own cloud, not the developer's** (BACKLOG #76) — the shipped exe's cloud path is the operator's
  own Google Drive (`drive.file` scope: this app sees only files it created), not a bucket the developer
  pays for. Auth is a desktop loopback OAuth flow (`fairy/oauth.py`) — consent in the system browser, since
  Google blocks its own sign-in popup inside an embedded webview.

## Safety (non-negotiable)
- **Delivery is automatic; running is not.** The file lands on the controller hands-free, but the
  **operator presses Cycle Start** at the machine.
- **No jog / no live motion control** here. That's a future, *separate*, local low-latency module with a
  hardware E-stop + watchdog (see [`../controllers/shared/ARCHITECTURE.md`](../controllers/shared/ARCHITECTURE.md)). This app is deliver + observe only.
- The Modbus poll is **read-only and PC-initiated** — the opposite relationship from the removed beacon
  mechanism, and the reason it cannot wedge the controller. Full argument: `fairy/master.py`'s own header.
- The controller stays **isolated** on its private cable; its wide-open `guest=root` SMB never touches a
  shared/public network.

## Status — see [`ARCHITECTURE.md`](ARCHITECTURE.md) §11 for the full, tagged build order
- **[SHIPPED]** `fairy/` daemon: delivery, CNCDISK explorer, `local`/`drive` backends, desktop OAuth,
  live Modbus position/tracking poll (Expert only), the gateway serving the Console itself.
- **[TO TEST]** The `r2` backend live against a real bucket; the Cloudflare Pages cloud config end-to-end.
- **[ ]** A `CloudClient`/`DirectClient` for a phone reaching a LAN gateway that isn't same-origin.
