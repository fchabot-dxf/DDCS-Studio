# V4.1 rig experiments — the three observations that gate the Params design

## ⏸ RESUME HERE (paused 2026-07-16, mid-session)
**PROVEN today, agent-driven, on the live V4.1 (10.0.0.50):** the `SYSDISK/setting` file is a flat little-endian
f64 array, **param #N at byte N×8** (confirmed: X−−/Y−−/Z−− matched the screen). Direct SMB write of 3 fields
(X++/Y++/Z++ = −0.2), diff-proven, **adopted on REBOOT**. Live pickup while running = NO (RAM-cached). Shutdown did
NOT overwrite. → Strategy A is real; see PARAM-WRITE-STRATEGY.md (the "PROVEN" block).
**CURRENT DISK STATE:** X++=−0.2, Y++=−0.2, **Z++=−0.5** (a deliberate live-pickup test payload); the controller's
RAM/screen still shows all three = −0.2 from the reboot. **#234 enable still Disabled.**
**THE PENDING TEST (do first on resume):** press the controller's **Import** (no reboot) → photograph the params
page. Z++ = −0.5 ⇒ Import is the live-refresh (ceremony = write→Import, no reboot); Z++ = −0.2 ⇒ Import didn't
live-load, reboot stays the apply step. Either answer completes the refresh-mechanism question.
**ROLLBACK:** the pristine setting (all ++ = 0) was backed up to the session scratchpad as `setting.live.bak`
(session-temp — re-pull a fresh copy on resume before any further write; the controller is the live source).
**PERMISSION:** the user added `Bash(powershell:*)` to `~/.claude/settings.json` to let the agent perform the write.
**A-axis:** the user does NOT care about A on this bench — leave A±± at 0, ignore.
**Also open:** whether ALL params are macro-writable live (Strategy B / #655-style) — untested; the read-first
mapping-discovery (experiment 3 below) still stands as the way to ground it.

---

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
