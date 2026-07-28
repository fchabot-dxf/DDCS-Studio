# Tool library redesign — QUEUED (dispatch after [d] RPM passes back)

Captured from the user design conversation (advisor t995, worker mid-[d]). All of this
touches formWidgets.js + settingsPanel standardTools + the dataOps feed defaults — the
SAME files [d] is editing — so it MUST land after [d] passes back (collision).

## The pivot (user t995)
NOT a fixed seeded default table. Instead: a declared **tool CATALOG** + a GUI to
**add individual tools** from it. ("leaning toward tools to add" — individual tools,
not whole prebuilt tables. Prebuilt whole-table "starter sets" = a possible secondary
one-click convenience, NOT the primary.)

## Design (GUI-first, declare-not-infer)
- STORAGE: Ø always mm-native (1/2" = 12.7 exactly) — unchanged, one source.
- DISPLAY: Ø + feed shown in the user's unit pref (inch/IPM) via the dual-unit widget
  — extend the dual-unit widget to the tool-library editor's Ø/feed fields too (today
  it's on the op forms; the tool table editor still shows mm → an inch user shouldn't
  type 12.7).
- CATALOG = a declared data array of ~34 tool TEMPLATES (user t995: "at least 30"),
  grouped by type × unit:
  - Flat endmill: imperial 1/8 1/4 3/8 1/2 3/4 1" (6) + metric 3 6 8 10 12mm (5)
  - Ball nose: imperial 1/8 1/4 3/8 1/2" (4) + metric 3 6 8mm (3)
  - Tapered ball (carving): 0.25/0.5/1.0mm tip, 3.5°/4.5° taper, 1/8" shank (~4)
  - V-bit: 15° 30° 60° 90° (4)
  - Surfacing/slab (spoilboard): 1" 1.5" 2" (3)
  - Drill / Chamfer: a few common (~5, optional)
  - Each carries Ø(mm, exact), flutes, rpm, feed, plunge defaults.
- TOOL GEOMETRY = ITS OWN LOOP ITEM "when we're there" (user t995). Today a tool has
  `dia · flutes · angle(vbit)`. The `tipDia` + `taperAngle` fields for tapered bits AND
  their accurate sim/preview profiles land TOGETHER as one later geometry slice — NOT in
  Task 1. So Task 1's catalog ships tapered/V-bits with their basic Ø + feeds/rpm only
  (a tapered bit stores its tip Ø as `dia` for now); do NOT half-add the geometry fields.
- GUI: the tool-library modal (openToolLibrary) gets **＋ Add from catalog** → a browsable,
  unit-filtered, multi-select grid grouped by type → click adds to the user's table.
  Keep **＋ Blank** (manual custom tool) too.

## Locked values (user t995)
- rpm band: 10–14k (bigger tool → lower rpm). NOT 18000 (router-fast, rejected).
- feeds: AGGRESSIVE (the user rejected 2000–2500 as too slow). Imperial starting set:
  ```
  tool        Ø       rpm     feed(mm/min)  ~IPM   plunge(~1/4 feed)
  1/8" Flat   0.125"  14000   2500          98     600
  1/4" Flat   0.25"   12000   4000          157    1000
  3/8" Flat   0.375"  11000   5000          197    1250
  1/2" Flat   0.5"    10000   6000          236    1500
  1/4" Ball   0.25"   12000   3500          138    900
  60° V-Bit   —       13000   2000          79     500
  ```
  ("feed is good" — locked; per-tool editable in the table so no number is precious.)
- Metric catalog entries: 3/6/8/10/12mm flat + 6mm ball + 60° V-bit, same rpm band,
  feeds scaled to Ø.

## Separate polish (same bundle, also post-[d])
- Conversion display → **layout B** (the inch/IPM annotation LEFT of the input, input
  column stays the clean right edge), **4-digit** precision (e.g. 0.1575 in — the user
  wants the tenth-of-a-thou precision kept; my 2–3 trim was rejected).
- Op no-tool feed default → 2000 (the raw line/move/arc + surfacing/contour/pocket/slot
  cut-feed default; leave bore/drill peck/helical slow). This is the no-tool FALLBACK;
  a picked tool overrides it.

## Sequencing
One coherent "unit-aware tool catalog + feeds + conversion-layout" task, dispatched the
moment [d] passes back. May split into 2 turns (the catalog+GUI is a real feature; the
conversion-layout + feed-default bump is a smaller mechanical follow-on).
