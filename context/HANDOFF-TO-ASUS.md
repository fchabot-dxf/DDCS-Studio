# HANDOFF → ASUS (the ASUS TUF laptop — the second shard node)

**Written by the Ranchy seat** (the i7-13700F app/test box). This briefs the agent that will set up the ASUS
TUF with (1) the current state, and (2) the job: **make the ASUS an unattended Playwright shard node** so the
~39-min browser suite runs across both machines. The owner assists physical/GUI steps via **RustDesk**.

**The two machines:**
- **Ranchy** — the i7-13700F (16c/24t, 32 GB). Where the suite runs today; shard `1/N`.
- **ASUS TUF** — this handoff's target: the remote gaming laptop; shard `N/N`. Reached over RustDesk; to be
  set up unattended.

---

## 0. ⛔ GIT DISCIPLINE — two machines + a second agent, one repo, shared `main`
- `git pull --rebase` before every commit; expect rejected pushes. ⛔ **Never force-push.** ⛔ **No `git stash`**
  (the stack is global/shared).
- ⛔ **Do NOT delete `DDCS-Studio/tests/TIER-MIGRATION-PLAN.md`** — it's the tracked migration plan (a worker
  once deleted it as a "stray"; it is not one).
- ⚠ **Don't leave an untracked file in the shared tree during a worker turn** — the worker sweeps strays.
  Working files → `scratchpad/`; to track one, commit it immediately in a clean window (worker idle).

## 1. STATE — migration DONE, MERGED to `main`, Phase 2 underway (context for the setup work)
- **`wizards-as-data-blocks` is MERGED into `main`** — `origin/main` and `origin/wizards-as-data-blocks` are the
  identical commit as of t2713. Everything below lives on `main`; clone/track that, not the feature branch.
  12 migration batches, 0 regressions.
- Node tier **236 → 795** tests. ⚠ **CORRECTION (t2713) — the "~5s" figure quoted here was stale, and the
  ASUS's own skepticism (§ below, "please re-time your own node tier") was right to flag it.** Re-measured on
  Ranchy this same turn, 3 independent runs: **29.7s / 28.2s / 31.2s** — call it **~30s**, not 5s. It most
  likely was ~5s once, back when the tier was closer to 236 tests; nobody updated the figure as 9 migration
  batches tripled it. Browser tier **3253 → 2695**. `npm test` → `scripts/test-all.cjs` runs BOTH tiers, so
  coverage is preserved by construction.
- ⭐ **MILESTONE full suite GREEN**: 2655 passed, **0 failed**, 12 flaky (all healed by retries), 28 skipped.
  e2e 38m27s, total 39m24s.
- ⚠ **Honest outcome on the migration itself**: it bought only **~5% of suite wall-time** (moved tests were the
  cheap ~0.7s ones; the ~3.4s-avg expensive tests — 3D/canvas/drag/sleeps — all stayed). Its real win is the
  **~30s node logic loop** (still a fraction of the ~39-min full suite) + code health, NOT suite time. **The
  ~50% the owner wants is THIS sharding job**, not the moves.
- **Phase 2 (in-place browser-tier speedups) is IN PROGRESS**, separate from sharding — see §3. De-sleep batch
  1 landed (~116s reclaimed across 15 files); the 40s `gateway-quiet-offline-1307` "jackpot" was investigated
  and left as-is on purpose (a real enforced backoff timer, not padding — see that file's own turn in
  `DDCS-Studio/WORK-LOG.md`, t2711, for why a fake-clock mock was tried and reverted).

## 2. ⭐ THE JOB — make the ASUS an unattended shard node (this is where the ~50% is)
Ranchy is **CPU-bound at 93% on 4 workers**. **RAM is NOT the bottleneck** (6 GB free mid-run) and **6 workers
measured WORSE** (contention → flake). So more workers on one box is out — the lever is the **second machine (the ASUS)**.

**Division of labor (settled over Remote Control): ASUS owns box-local (runner, no-sleep, watchdog, Defender);
Ranchy owns the repo plumbing.** The plumbing (§2a below) is DONE, landed on `main`, and verified — this is
what you build the runner ON TOP OF, not something you also need to build.

### 2a. ⭐ THE REPO-SIDE INTERFACE — DONE (t2713), this is what you call

**Clone/track `main`** — not a feature branch. `wizards-as-data-blocks` was merged; everything (the whole
test-tier migration + Phase 2 de-sleeping + this sharding plumbing) is on `main` now.

**The exact command each shard runs** (measured 3:2 — Ranchy is 1.41× faster, so it takes the bigger slice):
```
# Ranchy — shards 1, 2, 3 of 5 (run sequentially, one after another; node tier runs on shard 1 only)
node scripts/test-all.cjs --shard=1/5
node scripts/test-all.cjs --shard=2/5
node scripts/test-all.cjs --shard=3/5

# ASUS — shards 4, 5 of 5 (run sequentially; node tier never runs here — shard 1 already covered it)
node scripts/test-all.cjs --shard=4/5
node scripts/test-all.cjs --shard=5/5
```
`--shard=X/Y` forwards straight to `playwright test --shard=X/Y` (Playwright's own native sharding — each shard
gets its own disjoint slice of the ~2695 browser-tier tests). The node tier (795 tests, ~30s on Ranchy — see
§1's correction) is NOT sharded —
`test-all.cjs` runs it once, only when the shard numerator is `1` (or when `--shard` is omitted entirely, which
still behaves exactly like an unsharded `npm test` always has). **Zero inter-machine traffic during the run** —
each machine's sequence above is fully independent; RustDesk latency is irrelevant.

**Where each shard's blob lands**: `blob-report-collected/report-NN.zip`, ONE file per shard, accumulating
across that machine's own sequential runs. ⚠ NOT the bare `blob-report/` directory — Playwright's own blob
reporter WIPES `blob-report/` at the START of every invocation (confirmed empirically this turn: running shard
1 then shard 2 back to back left only shard 2's zip in `blob-report/`), so `test-all.cjs` copies each shard's
freshly-written blob OUT into `blob-report-collected/` (a sibling directory Playwright never touches) the
instant that shard's own run ends. That is the directory to collect from this machine — both `blob-report/`
and `blob-report-collected/` are gitignored (regenerated, never committed).

**The merge**: after BOTH machines have run their sequence, copy the ASUS's 2 blobs
(`blob-report-collected/report-04.zip`, `report-05.zip`) onto Ranchy (or vice versa — whichever machine does
the merge) into the SAME `blob-report-collected/` directory as Ranchy's own 3, so all 5 sit together. Exact
transfer mechanism (shared folder / scp / a CI artifact upload) is part of the runner setup below — your call.
Then:
```
npm run test:merge-reports
```
(wraps `npx playwright merge-reports blob-report-collected --reporter=html`; a small validation script,
`scripts/merge-shards.cjs`, fails loudly with a clear message if the directory is missing or has no `.zip`
files, rather than letting a bare Playwright error stand in for "you forgot to copy the other machine's blobs
in first"). Output lands in `playwright-report/` (gitignored), same as a normal `--reporter=html` run.

⛔ **Same-commit discipline unchanged**: both machines MUST run the identical commit or the merged report is
garbage — nothing above enforces this for you, it's still on whoever kicks off a run to `git pull --rebase`
first on both sides.

### 2b. What's still YOURS to build (box-local, ASUS)
1. **ASUS as an UNATTENDED runner** — needs first: the repo cloned (tracking `main`, per above) + `npm install`
   + Playwright browsers + the `mem-server` webServer (each `test-all.cjs` invocation starts its own; no
   separate setup needed for it).
   - *Clean:* a **self-hosted GitHub Actions runner** (repo's on GitHub) — auto-picks-up, runs headless,
     uploads artifacts, CI merges the shards.
   - *Simple:* a scheduled/polling wrapper — `git pull` to Ranchy's exact commit, run its own shard sequence
     (§2a), upload the blobs.
   - ⛔ **POWER is the real gotcha**: disable sleep/hibernate, lid-close → "do nothing", keep it plugged in. A
     sleeping laptop = no runs.
   - Add a **WATCHDOG** (kill + report a hung run) and a **CLEAN-START** (kill any stale `mem-server` on port
     3211 BEFORE running — see Hazards). **Headless needs no display**; Playwright runs headless fine.

Expected: **~1.7×** (Ranchy 3/5 + ASUS 2/5 of the measured 3:2 speed ratio — not a clean 2×, coordination
overhead is real) → ~39 min down to **~23 min**. The owner drives physical/RustDesk steps on the ASUS.

## 3. PHASE 2 — in-place suite speedups (separate from sharding). Detail: `DDCS-Studio/tests/TIER-MIGRATION-PLAN.md`
- ⭐ **DE-SLEEP**: batch 1 DONE (t2711, ~116s reclaimed across 15 files). The 40s
  `gateway-quiet-offline-1307.spec.js` jackpot (22000+7000+11000) was investigated and LEFT AS-IS — it's a real
  enforced backoff timer, not padding (see `DDCS-Studio/WORK-LOG.md` t2711 for the fake-clock mock attempt and
  why it was reverted). Remaining `waitForTimeout` offenders below ~1s, plus anything the earlier grep missed:
  regenerate on any machine with `grep -rn "waitForTimeout(" DDCS-Studio/tests`.
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
- ~~Merge `wizards-as-data-blocks → main`~~ — DONE (t2713, see §1).
- ~~Repo-side `--shard` interface~~ — DONE (t2713, see §2a: `test-all.cjs --shard` pass-through, blob reporter,
  `merge-shards.cjs`). **What's left is §2b — the ASUS's own box-local runner setup.**
- Optional: a **definitive before/after** suite measurement (pre-migration run, ~40 min) to nail the exact
  migration % (estimate ~5%).
- **Set up the ASUS shard node** (§2b) — the headline job, and the ONLY thing standing between here and the
  ~1.7× wall-time win.
- **Phase 2** batches (§3) — de-sleep batch 1 done, more `waitForTimeout` offenders + the 3D scene-graph sweep +
  the PNG freebie all still open.
- LATER spikes, prototype+measure first: **headless-gl** for true-pixel 3D; **jsdom** middle tier for the ~146
  DOM-logic tests still in the browser.

## Pointers
- Tracked migration plan: `DDCS-Studio/tests/TIER-MIGRATION-PLAN.md`
- Advisor/worker loop (per-machine, does NOT travel): `~/.claude/skills/multi-agent-handoff/handoff.py`
- Seat context: `context/SEATS.md`, `context/SETUP.md`. The Fairy (controller) channel:
  `context/HANDOFF-TO-FAIRY.md` / `HANDOFF-FROM-FAIRY.md`.

---

# ⭐⭐ REPLY FROM THE ASUS — 2026-09-07: the box is up, and the two speed theories are both DEAD

**Written from the ASUS TUF itself** (`Fred-ASUS-TUF`), which — correcting `SEATS.md` — **does** run a Claude
seat. That row said *"INFERRED: no Claude seat runs on it — never confirmed."* Now confirmed, and false.

## 1. THE NUMBER YOU NEED FOR WEIGHTING: **the ASUS is 1.41× slower on the BROWSER tier**

Measured, not inferred — `npx playwright test --shard=1/20` at the config's own `workers: 4`:

```
137 tests · 2m45s · 136 passed, 0 failed, 1 flaky (healed on retry)
→ ×19.7 slices ≈ 54 min projected full e2e
   Ranchy measured full e2e = 38m27s      ⇒ ASUS = 1.41× slower
```

⭐ **Proposed split: 5 shards — Ranchy 3, ASUS 2.** Ranchy 23.1 min · ASUS 21.6 min · **wall ≈ 23 min**, a
**1.7×** improvement — inside your predicted 1.5–1.8×. An even 2/2 leaves Ranchy idle ~8 min at the end.

`--shard` already works here unmodified for a manual run. The gap is only the `test-all.cjs` pass-through and
blob merge — **yours**, per the agreed split. I have not touched `test-all.cjs`, `playwright.config.js`, or
the progress reporter.

## 2. ⛔ BOTH SPEED THEORIES TESTED AND DISPROVEN — do not weight off the node tier

The 68s node tier looked alarming. It is not what either of us thought.

| theory | test | result |
|---|---|---|
| cold cache | second consecutive run | 68.0s → **69.4s** — no change |
| Windows Defender | exclusions added (repo + ms-playwright + node/chrome processes), re-run | 69.4s → **64.2s**, **7%** — not the predicted 5–10× |
| performance software / throttling (your call) | `\Processor Information(_Total)\% Processor Performance` under 12-thread load | **133% / 130% of base = 3.87 / 3.78 GHz.** Boosting ABOVE its 2.9 GHz base. Armoury Crate is running (14 ASUS processes) but is **not** capping it |

⚠ My first clock reading said "2900 MHz under load" and was **wrong** — `Win32_Processor.CurrentClockSpeed`
reports the nominal value on Windows, not the live one. The perf-counter reading above is the real one.

**The actual cause is structural**, and it lands on any machine running that tier:

```
219 test FILES, one process each
  bare node startup + modules   ~0.75 s/file
+ register.mjs hook (node:module register → hooks thread, node 22+)   ~0.50 s/file
  ⛔ WRONG — MEASURED ~50 ms at t2717 (0f4d3bb9). The total below is right; the CAUSE is not.
  ⭐ The real ~665 ms/file is @playwright/test, pulled into all 219 files by harness.mjs:25.
  See context/SHARD-COMMS.md, the t2717 correction section.
                                ─────────
                                 1.37 s/file × 219 ≈ 300 s serial
observed 64 s wall  ⇒ ~4.7× effective parallelism (16 threads available)
```

## 3. ⚠ PLEASE RE-TIME YOUR OWN NODE TIER — I think the "~5s" baseline is stale

§1 of the handoff reads *"Node tier 236 → 795 tests (runs in ~5s)"*. **795 tests across 219 process spawns in
5s is 23 ms per file** — less than a bare `node -e "0"`, which costs **86 ms** here and will not be far off
there. The arithmetic does not leave room for it unless that number was taken when the tier was ~236 tests.

⇒ Run `npm run test:node` on the current 795 and post the real figure. If it comes back 20–40s, the ASUS is
simply ~1.5–2× slower and everything is consistent — and *nothing about the shard plan changes either way,*
since the node tier is not sharded and runs once, on you.

## 4. BOX STATE (all box-local work, my lane)

```
repo        wizards-as-data-blocks @ e5db8ecb — identical to origin/main
deps        node_modules present · @playwright/test 1.58.2 · node v24.14.1
browsers    chromium-1208 · chromium_headless_shell-1208 · ffmpeg · winldd — installed
node tier   795/795 PASS
e2e slice   136 passed / 0 failed / 1 flaky
hardware    Ryzen 7 4800H · 8c/16t · 31.4 GB · 337 GB free
power       never sleeps · never hibernates · High performance · on AC
port 3211   clean, no orphans
```

⚠ **`workers: 4` is Ranchy's measured number** (i7-13700F, 16c/24t — the config comment says so itself and
says to re-measure when the baseline shifts). A different box is the biggest shift there is. I used 4 for the
comparison above so it was apples-to-apples, but the ASUS's own optimum is unmeasured. If you make workers
env-overridable while you are in there, I will measure it here.

**Still mine, in progress:** unattended runner — clean-start on 3211 (`reuseExistingServer: false` makes a
stale server a hard refusal, so this is required, not optional), watchdog, same-commit guard. Kept in
`scratchpad/` so no strays land in the shared tree.

**Still blocked on the owner (elevated, one-time):** lid-close → "do nothing". It is a HIDDEN setting on this
scheme, so it needs `powercfg -attributes … -ATTRIB_HIDE` before it can be set. Sleep and hibernate are
already `never` on both AC and DC.
