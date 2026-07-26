# Testing — the tiered gate

The full Playwright suite is **603 spec files / ~1489 tests (~15 min)** — too slow to run on every change. It is
**tiered** so routine work gets fast feedback while nothing merges unverified.

| Tier | Command | Runs | ~Time | When |
|------|---------|------|-------|------|
| **Smoke** | `npm run test:smoke` | the declared broad-breakage set (`tests/smoke.manifest.mjs`) | ~30 s | every change |
| **Changed** | `npm run test:changed` | spec files changed vs HEAD (`--only-changed`) | varies | when you edit specs |
| **Full** | `npm run test:e2e` | everything | ~15 min | at the **merge boundary** |

## How to use it

- **Per change:** run **smoke** + the specs for the area you touched (e.g. `npx playwright test cam-slot-icon-s5`).
  Smoke catches wide breakage; the feature specs catch the specific change. Together that is the fast per-change gate.
- **Before a merge:** run the **full** suite. It is the backstop that must be green before code merges — smoke is a
  canary, not a substitute.

## The smoke tier — what's in it and why

`tests/smoke.manifest.mjs` is a **declared list** (inert data) of one canonical spec per major subsystem — app shell,
blocks round-trip, CAM, persistence, wizard emit, parser, sim, probe, layout, theme. It tracks **subsystems, not
features**, so it stays small and rarely changes: a new *feature* does not need a smoke entry (its own specs + the full
merge gate cover it); a new *subsystem* might.

Add an entry only if it is fast, stable (not load-flaky), and the best single canary for its subsystem.
`playwright.smoke.config.js` **validates every entry exists**, so a renamed/removed spec fails loudly rather than
silently dropping coverage. The list is meant to be tuned freely — it is just data.
