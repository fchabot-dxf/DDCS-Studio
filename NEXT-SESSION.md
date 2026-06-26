# NEXT SESSION — handoff

**Current state (2026-06-25):** **V10.36 shipped** — web is live via GitHub Pages; the desktop exe + `v10.36` tag
are built/published by `desktop-release.yml`. On `main`, in sync with `origin`. The wizard-maker is built
end-to-end (fork an op → expose values as widget knobs → reuse the built-in wizard panel → edit from Studio →
save/re-author). The region editor, selection model, and coordinate-list positioner are banked in V10.36.

**The backlog lives in one place now:** [`ROADMAP.md`](ROADMAP.md) — the code-verified canonical roadmap
(NEAR / MID / STRATEGIC + non-wizard + gaps + parked). This handoff is only *"where we are + the next task."*
The old planning docs (`NEXT-TASKS`, the vision, `CRAZY-IDEAS`, `FUSION-INTEGRATION`, `docs/*`) were archived to
[`docs/archive/`](docs/archive/) and folded into ROADMAP.md — that sprawl is exactly why they went stale.

## ⚑ Reframe worth carrying
The "wizards-as-data engine" the vision treated as future is mostly **already built**: expressions (`expr.js`),
loops/control (`count`/`iff`/`array`/`flow`), and raw-emit atoms (`macro.js`) all ship. What remains is **Stages 4–6**
— express ONE built-in *as data* + assert output-equivalence → port the rest → self-host. See ROADMAP "Key reframe."

## ▶ Immediate next task
**ROADMAP → NEAR #4 — Field-targeting / non-numeric param mechanism** `[L]` — the load-bearing unlock. Everything
assumes a numeric value socket (valid-by-construction); this gates text/corner-grid knobs, enum/string region
values, spatial CAM, AND completes coordlist-as-a-saved-knob (the coupled gap from #2). Scope a plan before coding;
form-side widgets already exist, so an enum-via-existing-dropdown first slice could land as `[M]`.

*(NEAR #3 — the app-wide Merge/Replace/Cancel generalisation — was **resolved-by-analysis**: the new-op insert path
is append-only (`appendIntoProgram` never replaces), so it can't clobber block edits; the edit-path notice already
centralises the guard at the single `insert()` chokepoint. See ROADMAP #3.)*

**Shipped this session:**
- NEAR #1 — re-icon any wizard (built-ins incl.) + line-art icon picker (`ef0ee43`); shared `web/ui/wizIcons.js` registry.
- NEAR #2 — in-block ✎ editor for the coordlist positioner (`105c837`); `buildCoordEditor`/`openCoordEditor` shared by the form widget + the block ✎ affordance.

## Environment — fresh-checkout gotchas (cost real time this session)
- Git root has a **doubled `DDCS-Studio/` dir**; the npm project + app code is under `DDCS-Studio/DDCS-Studio/`. Use absolute paths — a stray relative `cd DDCS-Studio` lands you one level too deep.
- `node_modules` is gitignored → run `npm ci` **and** `npx playwright install chromium` before the suite (a bare `npx playwright test` silently fetches a mismatched throwaway and fails on `@playwright/test`).
- Running the suite churns tracked `tests/_*.png` screenshots → `git restore 'DDCS-Studio/tests/*.png'` before any release commit.
- **Release flow:** `npm run bump-version` (bumps the `.ver` chip in `web/index.html`) → push the chip change to `main` → `desktop-release.yml` builds the exe and **creates the `v<chip>` tag + release itself** (idempotent). Don't tag locally; push the bump commit as the tip (a batched push tags the wrong commit — that's how `v10.35` drifted).

## Test baseline (2026-06-25)
**279 passed, 2 skipped, 1 known-stale failing:** `macros-tabs.spec.js` (asserts the old flat-tab macros layout;
the UI is a sidebar+tree now — pending the macrosApp restructure). `middle-animator.spec.js` is flaky (passes in
isolation). The `header-responsive:47` off-by-one was a stale assertion (Copy moved to a floating button) — fixed
this session.

## Traps / rules (also in ROADMAP "Conventions")
- **Blockly v13 Class-B render trap** — a valid block model isn't drawn until the async render queue runs; load via `ddcsLoadBlockStack` and add a render-guard (`getHeightWidth().height > 0`), not just an emit assertion.
- **Valid by construction** — `BUILDERS(op.params) == op.children`; GUI param pills resolve to numbers in `instantiate` so committed ops stay clean.
- **GUI over fields** — default to a visual/canvas picker, not a text field.
- **Verify the real symptom at runtime** — a green emit ≠ a working app; reproduce the user's exact symptom in the right viewport.
