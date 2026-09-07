# HANDOFF → ASUS (the ASUS TUF laptop — the second shard node)

**Written by the Ranchy seat** (the i7-13700F app/test box). This briefs the agent that will set up the ASUS
TUF with (1) the current state, and (2) the job: **make the ASUS an unattended Playwright shard node** so the
~39-min browser suite runs across both machines. The owner assists physical/GUI steps via **RustDesk**.

**The two machines:**
- **Ranchy** — the i7-13700F (16c/24t, 32 GB). Where the suite runs today; shard `1/N`.
- **ASUS TUF** — this handoff's target: the remote gaming laptop; shard `N/N`. Reached over RustDesk; to be
  set up unattended.

---

## 0. ⛔ GIT DISCIPLINE — two machines + a second agent, one repo, shared branch
- `git pull --rebase` before every commit; expect rejected pushes. ⛔ **Never force-push.** ⛔ **No `git stash`**
  (the stack is global/shared).
- ⛔ **Do NOT delete `DDCS-Studio/tests/TIER-MIGRATION-PLAN.md`** — it's the tracked migration plan (a worker
  once deleted it as a "stray"; it is not one).
- ⚠ **Don't leave an untracked file in the shared tree during a worker turn** — the worker sweeps strays.
  Working files → `scratchpad/`; to track one, commit it immediately in a clean window (worker idle).

## 1. STATE — migration DONE and GREEN (context for the setup work)
- Branch `wizards-as-data-blocks`, **cleanly ahead of `main`** (fast-forward-able, 0 divergence). 12 batches,
  0 regressions. Latest: batch 12 `dfcb0c95`, plan `c36ca2fe`.
- Node tier **236 → 795** tests (runs in ~5s); browser tier **3253 → 2695**. `npm test` → `scripts/test-all.cjs`
  runs BOTH tiers, so coverage is preserved by construction.
- ⭐ **MILESTONE full suite GREEN**: 2655 passed, **0 failed**, 12 flaky (all healed by retries), 28 skipped.
  e2e 38m27s, total 39m24s. **Merge gate CLEARED** — merge `wizards-as-data-blocks → main` whenever (no `.ver`
  bump, test-only; `pull --rebase`, coordinate with the other seat).
- ⚠ **Honest outcome**: the migration bought only **~5% of suite wall-time** (moved tests were the cheap ~0.7s
  ones; the ~3.4s-avg expensive tests — 3D/canvas/drag/sleeps — all stayed). Its real win is the **~5s node
  logic loop** + code health, NOT suite time. **The ~50% the owner wants is THIS sharding job**, not the moves.

## 2. ⭐ THE JOB — make the ASUS an unattended shard node (this is where the ~50% is)
Ranchy is **CPU-bound at 93% on 4 workers**. **RAM is NOT the bottleneck** (6 GB free mid-run) and **6 workers
measured WORSE** (contention → flake). So more workers on one box is out — the lever is the **second machine (the ASUS)**.

**Build:**
1. **Playwright sharding**: `--shard=1/2` on Ranchy, `--shard=2/2` on the ASUS. Weight it if the ASUS is slower
   (e.g. Ranchy 2/3 + ASUS 1/3). ⭐ Shards run INDEPENDENTLY — **zero inter-machine traffic during the run** — so
   remote-over-RustDesk is fine; latency is irrelevant.
2. **`test-all.cjs --shard` pass-through** — it runs the whole e2e tier today; add a shard arg it forwards to
   playwright. Only the **browser** tier shards (node is ~5s — run it once, on Ranchy).
3. **Merge**: add a **blob reporter** alongside `progressReporter` (⛔ don't override the reporter), collect both
   shards' blobs, `npx playwright merge-reports`.
4. **ASUS as an UNATTENDED runner** (the actual setup):
   - Needs first: the repo cloned + `npm install` + Playwright browsers + the `mem-server` webServer (test-all
     starts it).
   - *Clean:* a **self-hosted GitHub Actions runner** (repo's on GitHub) — auto-picks-up, runs headless, uploads
     artifacts, CI merges the shards.
   - *Simple:* a scheduled/polling wrapper — `git pull` to Ranchy's exact commit, run its shard, upload the blob.
   - ⛔ **POWER is the real gotcha**: disable sleep/hibernate, lid-close → "do nothing", keep it plugged in. A
     sleeping laptop = no runs.
   - Add a **WATCHDOG** (kill + report a hung run) and a **CLEAN-START** (kill any stale `mem-server` on port 3211
     BEFORE running — see Hazards). **Headless needs no display**; Playwright runs headless fine.
5. ⛔ **Same-commit discipline**: both shards MUST run the identical commit or the merged report is garbage.

Expected: **~1.5–1.8×** (not a clean 2× — the ASUS is likely slower + coordination overhead) → ~39 min down to
~22–26 min. The owner drives physical/RustDesk steps on the ASUS.

## 3. PHASE 2 — in-place suite speedups (separate from sharding). Detail: `DDCS-Studio/tests/TIER-MIGRATION-PLAN.md`
- ⭐ **DE-SLEEP** (~90–130s of fixed `waitForTimeout`): jackpot = **`gateway-quiet-offline-1307.spec.js` = 40s in
  ONE file** (22000+7000+11000). Replace fixed sleeps with `waitForFunction`/state waits. Regenerate the list on
  any machine: `grep -rn "waitForTimeout(" DDCS-Studio/tests`.
- **3D SCENE-GRAPH sweep** (more free node moves): many "3D" tests assert positions/matrices — Three.js math,
  **NO GL** — so they move to node free. Only true `readPixels`/screenshot 3D needs **headless-gl** (a later,
  measured spike — native dep + fidelity differs; prototype on ONE test first). **Check scene-graph FIRST.**
- **PNG FREEBIE**: 26 specs write **925 committed `verification/*.png` (70.6 MB), never asserted** → drop the
  `page.screenshot({path:'verification/…'})` calls, KEEP every data assertion. Repo-health (git churn), not time.

## 4. ⚠ WHAT I (RANCHY) GOT WRONG — trust measurement over projections
I sold ~**50%** suite-time, corrected to ~20–25%, and the milestone **measured ~5%**. Same error each time: I
under-modeled how CHEAP the movable tests were and how much the expensive UI/3D/sleep tests dominate. ⇒ The
migration is a **dev-feedback + health** win; the ~50% lives in **sharding (hardware)** — the job above.

## 5. STILL OPEN
- **Merge** `wizards-as-data-blocks → main` (green gate cleared; owner's timing).
- Optional: a **definitive before/after** suite measurement (pre-migration run, ~40 min) to nail the exact
  migration % (estimate ~5%).
- **Set up the ASUS shard node** (§2) — the headline job.
- **Phase 2** batches (§3).
- LATER spikes, prototype+measure first: **headless-gl** for true-pixel 3D; **jsdom** middle tier for the ~146
  DOM-logic tests still in the browser.

## Pointers
- Tracked migration plan: `DDCS-Studio/tests/TIER-MIGRATION-PLAN.md`
- Advisor/worker loop (per-machine, does NOT travel): `~/.claude/skills/multi-agent-handoff/handoff.py`
- Seat context: `context/SEATS.md`, `context/SETUP.md`. The Fairy (controller) channel:
  `context/HANDOFF-TO-FAIRY.md` / `HANDOFF-FROM-FAIRY.md`.
