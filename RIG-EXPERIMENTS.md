# V4.1 rig experiments — the three observations that gate the Params design
*(see PARAM-WRITE-STRATEGY.md for why; run in order; report observations verbatim)*

## 1 — Soft limits (config only)
1. Fill ALL SIX values FIRST: X--/Y--/Z-- = real negative travels; X++/Y++ = positive ends; **Z++ = -0.2**.
   (#234 is ONE global switch — enabling over factory zeros can refuse all motion.)
2. Enable #234.
3. Jog slowly to Z top → expect a polite stop at -0.2, no alarm.
4. Run `G90 / G53 Z0` → expect refusal/alarm; note where the axis held.

## 2 — Restore behavior
Export settings via the controller's own export → import the SAME unmodified file →
observe: silent apply / reboot prompt / reboot required before values show?

## 3 — Mapping discovery (READ-FIRST — the V4.1 factory macros never write settings params;
##      no blind writes on this rig)
1. On the screen: set an MPG X1 speed to a distinctive 1234.
2. Run the read-probe (copies candidates into user-vars, writes nothing else):
   `#490=#561`  `#491=#661`  `#492=#761`  `#493=#861`  `M30`
3. Controller variable monitor: whichever of #490-493 shows 1234 = the runtime bank.
   No match → record all four values; we bracket differently.
4. ONLY on a proven mapping: one save→change→restore WRITE to that same innocent param
   (the factory's own pattern) + reboot → does the write persist?

Findings decide: Strategy A's role (reboot?), Strategy B's coverage (writable? persistent?),
and the soft-limit block's live values.
