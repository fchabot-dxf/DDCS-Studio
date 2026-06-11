# 3D Preview & Simulation Notes

_How the toolpath preview works today, and what it would take to grow it into a real
machine simulation (WCS + origin + envelope). June 2026._

---

## How the preview works today

The 3D preview parses the editor G-code and draws the toolpath. It is **automatic**:

- While the 3D view is open, it re-draws as you type — ~300 ms after you stop
  ([`DDCS-Studio/web/ui/gcodePreviewTab.js`](DDCS-Studio/web/ui/gcodePreviewTab.js#L156)).
- Switching **to** the 3D tab re-draws the current editor content
  ([`gcodePreviewTab.js:241`](DDCS-Studio/web/ui/gcodePreviewTab.js#L241)).
- It only re-renders when the 3D view is the active one (`if (gpView !== '3d') return;`).

Everything is drawn in the **active WCS**, with program-zero at world `(0,0,0)`.

### "Nothing shows" ≠ broken code

The preview only draws **motion it can resolve into coordinates**: `G0/G1/G2/G3` moves and
`G31` probes with X/Y/Z. It legitimately draws **nothing** (and the status bar shows
**"No drawable moves in this program"** — [`gcodePreviewTab.js:61`](DDCS-Studio/web/ui/gcodePreviewTab.js#L61))
when the program is:

- setup / M-codes / comments / `#variable` assignments only — no motion;
- all moves in **machine coordinates (`G53`)** — skipped, because the machine origin is unknown;
- moves whose `#variables` can't be resolved to numbers.

So an empty preview means *"there's no toolpath to draw here,"* not *"your code is wrong."*
A macro that just **waits on a sensor input or toggles an output** (e.g. an ATC / tool-change
handshake) has no XYZ motion, so its preview is correctly blank.

---

## Do we need WCS + origin simulation?

**Not for the basic toolpath preview.** Cuts and probes are all relative to program-zero, so
they render fine without a machine frame. That's why the wizard previews work.

**It becomes necessary only for the bigger picture:**

| Want to… | Needs machine frame? |
|---|---|
| Show the toolpath relative to the part | ❌ works today |
| Draw `G53` / machine moves (park, tool-change positions) | ✅ |
| Show where the part actually sits on the table | ✅ |
| Check the program against the **envelope / soft limits** | ✅ |
| Handle multiple work offsets (`G54–G59` / `#805+`) | ✅ |
| "Test before installing" (the goal from user requests) | ✅ |

---

## We already have the building blocks

Settings (⚙) already store everything the machine frame needs, persisted as JSON:

- **Machine envelope** — travel X/Y/Z.
- **Origin offset** — `ox/oy/oz` = program-zero position within the envelope.
- **Stock** — block dimensions + shape (boss/pocket).

So this is an **incremental add, not a rewrite**.

### Proposed "Machine frame" mode (toggle)

Keep the preview program-centric by default; add a toggle that:

1. Anchors the scene to the machine envelope (already drawable).
2. Places the **WCS origin** at the settings origin → offsets the stock + toolpath there.
3. Gives `G53` moves a frame → **draw** them instead of skipping.
4. Flags anything **outside the envelope** (soft-limit check).

### A useful subtlety

For **probing** macros, the WCS is *set by the probe touching the stock* — and the preview
already simulates that contact (the probe clamping). So the resulting WCS offset is effectively
known from the contact points; surfacing it is a natural next step.

---

## Connection to I/O simulation (requested on socials)

Users have asked for **test/simulation including the controller's inputs/outputs** — e.g. a
tool-change that waits for the spindle ATC sensor before proceeding. This is a separate layer
from geometry:

- The DDCS Expert macro language can poll inputs / drive outputs and branch on them
  (`IF`/`GOTO`, system `#variables`). _(Confirm exact I/O variable addresses against the
  variable DB before relying on this.)_
- Simulating it means stepping the program and letting the user **assert input states** to
  exercise the `IF`/`GOTO` paths — independent of the toolpath drawing.

The machine-frame work above is the geometric foundation; I/O state-stepping is the logic layer
on top.

---

## Status / decision

- ☑ **Decided (June 2026):** stay program-centric for now — machine frame deferred.
- ☑ Preview is program-centric (active WCS at origin) — works for cuts + probes.
- ☐ Machine frame (envelope + origin + `G53` + limit check) — **deferred**.
- ☑ **I/O state-stepping (sensor-wait / output simulation) — built.**
  - Floating **Virtual I/O panel** (draggable, resizable; `I/O` button in the 3D drawer):
    24 inputs (click-to-toggle) + 24 outputs, replaces the Settings I/O tab.
  - **⏭ Step** button runs one line at a time; **▶ Run / Resume / ⏸ Stop** for continuous.
  - `M31/M33` waits park execution, auto-show the panel and pulse the waited pin.
  - **Auto sensors** (default ON): any waited input is answered by a virtual sensor
    (~0.8 s) — truth-table handshakes still fire with realistic delays. Turn OFF to
    hand-drive sensors and exercise `IF`/`GOTO` failure branches.
  - `G31` probe contact now flips the actual probe input pin on the panel (fired at
    the moment the paced move reaches the contact point).
  - Tests: `verification/io-sim-test.mjs` (engine, 5 cases) + `tests/io-sim.spec.js` (e2e, 5 pass).
- ☑ **Feedrate-true playback.**
  - Engine Run interpolates each move in real time: distance ÷ programmed `F`
    (rapids at 6000 mm/min) — slow probes crawl, rapids zip. **Speed** selector in
    the drawer (1× / 2× / 5× / 10× / MAX), changeable mid-move.
  - Status shows the move: `G31 probe 10.0 mm at F50 — 12.0 s`.
  - The looping ▶ Play preview animation is also feedrate-proportional now
    (segment time ∝ length/feed within the ~5 s loop).
- ☑ **⟳ Loop** toggle — restart the program automatically on completion (Run only).
- ☑ Beep fix: the preview loop no longer beeps every cycle; one beep when an
  engine run completes.
- ☑ Viewer: middle-drag pans, Shift+middle orbits (CAD-style).
