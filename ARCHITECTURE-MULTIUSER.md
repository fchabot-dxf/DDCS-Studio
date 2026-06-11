# DDCS Studio — multi-user architecture & liability boundary

_The load-bearing product decision. Every future piece (cloud Studio, the gateway, the Setup tab, the
ATC generator) must respect it. June 2026._

---

## The end goal

A **multi-user hosted app** where **the host is NOT responsible for other users' controllers.**

## The liability boundary

That single constraint dictates the whole architecture: **the hosted app must be structurally incapable of
moving anyone's machine.** So it is a **CAM-class tool** (like Fusion / any CAM): it **generates + simulates**;
the user takes the output to *their* machine. Host exposure = "the generated code or sim could be wrong"
(same as any CAM) — **never** "your service moved my spindle."

## The rule: cloud generates, local controls

| Tier | Does | Never does |
|---|---|---|
| **Cloud / hosted (multi-user)** | generate G-code/macros · simulate · 3D preview · store & share **data** (profiles, programs, accounts) | connect to, relay to, or command **any** controller |
| **Local, per-user (Studio `.exe` + the user's own gateway)** | talk to **that user's own** controller on **their own LAN** | — |

- **The controller link is 100% user-local & user-owned.** Each user runs their own gateway/`.exe` to their
  own controller. **The host is never in that path** — no motion relays through the host's servers.
- **Even "Pull from controller" is local-only** — the user's *own* gateway reads the user's *own* controller;
  the cloud never sees it.
- **The trap to avoid:** a cloud that *relays jobs* to a remote gateway puts the host back in the control path
  (liability + security). Keep **cloud = data, local = control.**

## Why the hosted Studio must NOT connect to a gateway (two independent reasons)

1. **Browser:** an HTTPS page (Cloudflare) cannot fetch `http://127.0.0.1:…` — mixed-content + CORS block it.
   So "hosted talks to your local gateway" isn't just unwise, it's **impossible in a browser.**
2. **Liability:** per above, the cloud must be **structurally unable** to move a machine.

## Two faces of Studio (same codebase, different config)

- **Hosted Studio (Cloudflare)** = the **simulator / profile-builder**. No gateway — the status LED stays
  hidden and "Pull from controller" is inert. This is the multi-user, zero-liability face.
- **Studio `.exe` (pywebview) or gateway-served Studio** = the **bridged** face. Local app → reaches
  `127.0.0.1` / the LAN gateway with no mixed-content problem. This is where the LED lights, Pull works,
  and live status appears. **Connects to the LOCAL gateway only.**

The `client.js` seam (Local / Direct / Cloud clients) self-selects: features light up only when a gateway
actually answers — so the same build is safe hosted *and* useful as the `.exe`. No hosted-vs-exe branching.

## The gateway is a local, per-user concern

Because control never touches the cloud, everything about the gateway is **local**:
- **Setup** (controller type Expert/4.1/3.1 + dest + **port** + host/binding + Modbus/COM + identity),
- **"what if I run two"** (a same-box port clash — fix with a configurable port),
- **security** (binds `127.0.0.1`; identity-verifies the controller so a job can't land on the wrong machine).

None of those are cloud questions.

## Current alignment ✅

The code already respects this boundary — nothing to undo:
- Hosted Studio has no gateway (LED hidden, Pull "not bridged").
- The `.exe` / local gateway is the **only** thing that ever touches a controller.

## Implications for the roadmap

- **Flexible Setup tab + gateway detect/adapt** → local / gateway-side work (never cloud).
- **Cloud Studio** stays sim / generate / data — add accounts + profile & program sharing there, not control.
- **ATC `T.nc` generator** → pure client-side generation; it produces a file the user saves to *their*
  controller. No machine contact from Studio or the cloud.
