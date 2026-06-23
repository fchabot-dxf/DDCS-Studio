# DDCS Studio — Next Tasks

Working backlog as of 2026-06-23. Shipped this session: **v10.27** (theme-consistent browser tabs, wizard-bar
grouping, theme chips, BLOCKS preview/G-code divider, editable 3D-probe dimensions diagram, Align→Transform) and
**v10.28** (Homing wizard + Settings→Hardware→Machine homing config). Suite green (228).

---

## In flight (on branches — review → merge)

- **Just-in-time "add a part" prompt** — branch `feat/wizard-prereq` (agent building).
  When a wizard needs hardware that isn't configured (probe wizards → a probe input; ATC wizards → an ATC), prompt
  **"Add it / Open anyway"** at the chokepoint (`wizardManager`/`openWiz`). Non-obligatory (Open anyway proceeds),
  but warns the wizard won't work well without it. → Review emitted UX + the detection, then merge.

## To build

- **SVG copy of the app icon** — vector recreation of `ddcs.ico` (dark rounded badge, gold "DDCS / CNC MACRO
  STUDIO" wordmark + glyph) for scalable in-app use. *Blocked on viewing the icon:* ICO is binary; view the
  preview PNG or extract a frame, then recreate as SVG (glow via an SVG filter).

## Awaiting input (can't proceed without it)

- **BLOCKS + GATEWAY tabs "show a little"** — need a specific: a thin line? a gap? a colour mismatch? and which
  theme? My probe + screenshots show those tabs structurally identical to STUDIO/MACROS (panel below, flush, feet
  render), so I can't target the defect blind.

## Follow-ups / deferred

- **Homing — Blockly reverse-sync.** `homingStack` round-trips structurally (renders as generic comment/assign/raw
  atoms) but has no dedicated semantic "home" block + reconciler. Add a first-class Homing block.
- **Probe sim dims → 3D render.** The editable 3D-probe dimensions persist + draw the 2D diagram, but aren't wired
  into the actual 3D probe render (it's on the shared tool-profile path used by the ATC rack — do it deliberately).
- **Profile export/import to a file.** So "Local" is a durable, portable save (matching how `.mjson` projects work)
  rather than only `localStorage`.
- **Setup checklist — real "configured" flag.** Envelope + stock currently show ⚠ by comparing to shipped defaults
  (300×300×120 / 100×80×20 boss), so a user legitimately running those exact values sees a false ⚠. A genuine
  "user touched this" flag would be more robust.
- **Repo-root scratch cleanup.** `ddcs-opt1..4.ico`, `opt1..4-preview.png`, `ddcs-icon-preview.png`,
  `options-sheet.png` are untracked icon experiments — remove once the icon is finalized.

## Onboarding — decided (no upfront nag)

The shape we converged on, for reference:
- **Defaults work out of the box** — 3-axis, spindle, a controller are sensible defaults; nothing to announce.
- **Just-in-time** — push the user to add a part exactly when a wizard needs it (the `feat/wizard-prereq` work).
- **On-demand** — the Setup checklist stays in the header quick-menu for a "where am I" overview. Its first-run
  **auto-open is disabled** (committed). No startup notification (it would only restate defaults).
