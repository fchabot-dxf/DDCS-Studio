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

- ☐ **Decision pending:** build the Machine-frame toggle now, or stay program-centric for now.
- ☑ Preview is program-centric (active WCS at origin) — works for cuts + probes.
- ☐ Machine frame (envelope + origin + `G53` + limit check).
- ☐ I/O state-stepping (sensor-wait / output simulation).
