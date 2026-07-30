# REPO SANITATION PLAN (advisor, 2026-07-29 — surveyed, not guessed)

Survey facts: 534 tracked PNGs under DDCS-Studio are spec-WRITTEN artifacts (screenshot({path}) —
no spec reads them back), re-committed by every release's `git add -A`. Pack = 87 MiB. Root carries
~12 spec/backlog .md files, built exes, `scratch`/`task list`/`CAM menu` (153 tracked files, space
in the name), `__pycache__`, `dist`, `build`. 14 branches; 3 stale .claude agent worktrees +
ddcs-glow-wt. `secrets/` IS gitignored (verified). Cyrillic corpus filenames are data — untouched.

## Rules that bound every step
- NO history rewrite (87 MiB is tolerable; a rewrite breaks CI, clones, worktrees). We stop the
  GROWTH, we don't rewrite the past.
- `DDCS-Studio/web/**` is OFF-LIMITS to hygiene — it deploys RAW to Cloudflare Pages; every path is
  a URL. Any web/ reorganization is product work, never hygiene.
- Protocol files STAY at repo root: HANDOFF.md, NEXT-SESSION.md, ROADMAP.md, README.md (handoff.py
  anchors to the root).
- git mv only, no content edits in the same commit (reviewable history). Verify references BEFORE
  every move (icons/fonts may be build-script or CI inputs; grep .github + build_fairy.ps1 first).
- Not ours to touch without asking: ANALYTICS-BOT-DETECTION.md + snippets.js (the analytics agent's
  untracked files); DDCS-Studio.exe (the user may run this copy); secrets/ contents.

## TIER 0 — stop the bleeding (one hygiene turn; full suite gates because it touches specs)
1. Specs write screenshots to a gitignored `DDCS-Studio/tests/_out/` via one shared helper
   (mechanical path change; the suite run IS the verification).
2. `git rm --cached` the 534 tracked artifact PNGs + committed scratchpad outputs; .gitignore gains:
   tests/_out/, DDCS-Studio/scratchpad/, __pycache__/, dist/, build/, /*.exe, *.exe.old.
3. Delete DDCS-Studio.exe.old outright; untrack (keep on disk) anything the user still runs.
   Releases stop churning screenshots from this turn on.

## TIER 1 — root declutter (same or the next hygiene turn; low risk)
4. Root spec/backlog docs → `docs/specs/` (FEATURE-CANVAS-PROBE-SCOPE, MIDDLE-PROBE-BACKLOG,
   PARAM-WRITE-STRATEGY, RIG-EXPERIMENTS, SIM-BLOCK-STACK-BACKLOG, SPATIAL-MODEL-SPEC,
   TAPPING-CAPABILITY, TOOL-SETTER, TRAVEL-START-SPEC, WIZARD-PORTING-MAP).
5. Root WORK-LOG.md is the OLD log (the live one is DDCS-Studio/WORK-LOG.md) → verify, then
   `docs/archive/WORK-LOG-early.md`. One live log, one archived, never two ambiguous.
6. `CAM menu/` (source dumps) → `bridge/controllers/expert-m350/assets/cam-menu/` (git mv; grep for
   referers first).
7. Loose root assets (ariblk.ttf, ddcs.ico/png/svg, ddcs-icon-preview.png, opt*-preview.png,
   options-sheet.png, g90_absolute.nc) → `assets/` or delete where they were one-off scratch —
   EACH ONE: grep build scripts + CI first; the .ico is almost certainly the pywebview/exe icon.
8. Root `tests/` (2 python tests) → beside their subject (bridge/tools/). `scratch/`, `task list/`:
   review contents with the user, archive-or-delete.
9. fairy_gateway.py / build_fairy.ps1 / requirements-build.txt: the exe build chain — LEAVE unless
   CI references are updated in the same commit (deploy-adjacent; low value in moving).

## TIER 2 — branch + worktree hygiene (advisor-run, attribution-gated, user confirms the list)
10. Verify-then-delete dead branches (candidates: corner-clean-prerelease-backup,
    backup/worker-group-feature, corner-notepad-enrich, feat/cam-builder, feat/cam-declare-once,
    feat/spatial-gui-number-roles, feat/gateway-csrf-guard, feat/vscode-ext-transport-and-seams,
    analytics-bot-detection, glow-gcode) — `git branch --merged` + a look at each unmerged tip;
    anything unmerged gets a one-line disposition (merge/archive-tag/delete) recorded, never a
    silent delete.
11. Stale worktrees: the three .claude/worktrees agents + ddcs-glow-wt — check each tree for
    unmerged work, then `git worktree remove` + branch disposition. `../ddcs-studio-lane-b` STAYS
    (seat B).
12. Ask the analytics agent/user about ANALYTICS-BOT-DETECTION.md + snippets.js (adopt into
    analytics/ or delete).

## Sequencing
Tier 0+1 = ONE dedicated hygiene turn on a QUIET repo (both seats idle), right AFTER the
drill-family switch ships — it touches every spec file's screenshot path, so the full suite gates
it and nothing else may be in flight. Tier 2 = advisor idle-time with the user's confirm on the
branch list. Nothing here blocks the arc; nothing in the arc blocks this.
