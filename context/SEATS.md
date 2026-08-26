# SEATS — who reaches which controller, from where

**Both Claude seats read this.** It answers one question: *when something needs the hardware, whose job is it?*
Getting this wrong wastes a seat's evening — it has already happened in both directions on one day (2026-08-25).

| seat | machine | where | controller it reaches |
|---|---|---|---|
| **Fairy** | `CNC-FAIRY` (Toughbook) | the studio | ⭐ **DDCS Expert / M350** — wired, motors, tools, a real table. Runs the **gateway**. SMB `\192.168.0.99`, Modbus on **COM6** (on-site only). |
| **Ranchy** | `RENDERRANCHY` | **home** | ⭐ **bench DDCS V4.1 — MOTORLESS**, home LAN `10.0.0.50` over SMB. Mostly on 24/7. The main dev seat (~90% of dev). |
| — | **ASUS TUF** | the studio | none. A laptop on the same WiFi, metres from Fairy. *(INFERRED: no Claude seat runs on it — never confirmed.)* |

## ⭐ THE AUTHORITY SPLIT IS BY CONTROLLER, NOT BY "HAS HARDWARE"

```
Expert / M350   →  FAIRY    ⛔ Ranchy cannot reach it. Do not reason out a hardware answer here.
bench V4.1      →  RANCHY   ⛔ Fairy does not have one. Do not route V4.1 questions to the studio.
```

⚠ **Both seats got this wrong simultaneously on 2026-08-25.** Fairy filed *"is the tool-offset row nonzero on a
V4.1?"* as needing the studio; Ranchy told the owner it had *"no path to a controller"* — while
`bridge/AGENTS.md` had said *"Reachable from home LAN 10.0.0.50"* the whole time. **The fact was present,
correct, and read past by both.**

⭐ **MOTORLESS changes what is testable.** Nothing can crash on the bench V4.1 — no tool, no table. Tests that
need a human present on the Expert may simply be RUNNABLE at Ranchy. ⚠ *Motorless* was said about **motors**;
do not extend it to the spindle or outputs without asking.

⭐ **This matters more than the machine count suggests: V4.1 + V3 users OUTNUMBER Expert users**, so a
V4.1-only defect is an escalation — and it is reproducible at the dev seat, not two hours away.

⛔ **Check before depending on it** — one command: `ping -n 2 10.0.0.50`

## THE OWNER IS A LIVE ROUTER

They talk to **every seat at once, from their phone, over Claude Code Remote Control.**

⛔ **Which seat you are does NOT tell you where they are.** *"I'm at the studio"* says where **they** are; it
moves no seat. Normally they are at home at Ranchy — treat that as a prior, ⚠ **never as a fact inside a
sentence about what is safe to run.** Ask.

⇒ ⭐ **They can relay between seats in seconds.** Never say *"I'll wait for the other seat"* as though it were
a session boundary. Name the blocker to them — that is the whole routing protocol, and it beats any document.

## ⭐ THE VS CODE SETUP — both seats work inside it

Claude Code runs as the **VS Code extension**, not a bare terminal. Three consequences that have each cost
real time, and none of them are obvious from inside the editor.

### ⛔ 1. The chat CANNOT render an image inline
Writing a path, or a markdown image link, shows the owner **nothing**. To actually show them a screenshot,
**open it as an editor tab**:

```bash
code -r "path/to/shot.png"     # -r reuses the window instead of opening a new one
```

⇒ Every verification screenshot has to be surfaced this way or it may as well not have been taken.

### ⚠ 2. VS Code's Live Preview CACHES ES MODULES
A `web/` file edited on disk can keep serving its OLD version in the Live Preview pane — so a fix looks like
it did not work, and the natural next move is to "fix" it again.

⇒ ⭐ **When the owner reports something that contradicts the code, ask: *"does it look right in a real
browser?"*** That one question has separated a real defect from a caching artifact more than once.

### ⚠ 3. The test server preloads `web/` ONCE, and a NEW file 404s
`tests/support/mem-server.cjs` serves the app on port **`3211`** and does its `fs` walk **at startup**.

```
a file created AFTER it booted is NOT served
  → the app still boots (window.ddcsStudio sets)
  → but import('/data/new.js') fails: "Failed to fetch dynamically imported module"
```

⚠ Playwright runs with `reuseExistingServer:true`, so it will happily reuse a **stale** server. A `node -e`
port check does **not** free it. The fix is to kill the process holding `3211` — but ⛔ **look before you
kill**: a suite may be running in it right now, possibly the other agent's.

```bash
netstat -ano | grep ":3211" | grep LISTENING     # the PID is the LAST column, and it CHANGES every boot
```

⚠ *(The port is stable at 3211; the PID is not. A PID written down in any document is stale by the next
boot — read it fresh.)*

⚠ **Fairy's own editor setup is UNCONFIRMED** — this section is written from Ranchy. If it differs there,
correct it here rather than keeping a second copy.

## VOCABULARY

- **Fairy** / CNC Fairy · **Ranchy** = RenderRanchy · **the studio** = the owner's **artist studio**, where the CNC is
- ⛔ **"Studio" is the PLACE and the APP. Never a machine or a seat.** That third meaning was invented on
  2026-08-25 and reached six committed documents before the owner caught it.
