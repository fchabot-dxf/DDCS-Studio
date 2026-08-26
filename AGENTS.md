# AGENTS.md — read this before changing anything


**For every agent and every human working in this repo**, whichever tool you are using — Claude,
Antigravity, an IDE, or a plain terminal. These are not preferences. Each one is here because
breaking it has already cost real time or shipped a real bug.

---

## The rules

### 1. Run the tests, and check CI afterwards

```bash
cd DDCS-Studio && npm test        # both tiers, honest exit code
```

`.github/workflows/test.yml` also runs this on **every push**, from any machine or tool. It is
**report-only** for now (a known residual is under triage), so a red run does not block you — but a
**new** failure that was not there before is a real regression and yours to own.

Pushing is not the end of a change. **Check the run.** Six deploys went out on 2026-08-06 without
anyone looking, and three of them never produced a desktop build.

### 2. Never force-push a shared branch

Three workstations sync through this repo, sequentially. A `--force` push silently discards whatever
another machine pushed. It has happened; nothing was lost, but only by luck.

### 3. Keep the `Co-Authored-By` trailer on commits

It is the only way to answer *"which session made this?"*. On 2026-08-06, thirty-one of the last
thirty-four commits carried no trailer, and tracing two production regressions to their origin took
hours longer than it should have.

### 4. One commit, one concern

`c5769a20` bundled three unrelated fixes and smuggled a bug in with them. `867135c0` retired one
feature and killed an unrelated one in the same commented-out block. Bundled commits hide defects
from review and make `git log -S` archaeology far slower when something surfaces later.

### 5. Do not "clean up" code you have not traced

Before deleting or commenting out anything that looks unused: **find its consumers first.** A grep for
callers is thirty seconds. Both of the worst regressions this week were confident removals of code
that was load-bearing.

### 6. A plan lives at the repo root while it is being built, and is DELETED the day it ships

Git keeps it — a completed plan is worse than no plan, because a reader cannot tell intent from
description, and a stale plan invites the next reader to build from a picture of the repo that no
longer exists. The one-time sweep in `docs/REPO-SANITATION-PLAN.md` (2026-07-29) cleaned root
completely; root grew **seven new `*-PLAN.md` files in the four weeks after**, because nothing said
where a new plan goes or when it leaves. A sweep without a rule refills — the t2295 doc-cleaning turn
deleted 18 more DONE/STALE/DUPLICATE docs for exactly this reason (verdict table in `DDCS-Studio/
WORK-LOG.md`). When a plan ships: delete it in its own commit (`git rm`, no content edits alongside),
carrying forward only what is still genuinely undone (to `BACKLOG.md` or a fresh, scoped doc) — never
archive a finished plan "just in case."

---

## ⚠ Load-bearing code — do not remove

Specific things that look vestigial and are not:

- **`devMode.js`'s `augment()` field-creation block and `restoreExpose`.** These render the Blocks-tab
  expose-as-knob checkboxes — the t391 provenance display *and* the live create path. Commented out on
  2026-08-04 "in favor of param_group"; custom-wizard authoring was dead until 2026-08-06.
  `blocks-knob-binding.spec.js` covers it.
- **`ddcs:ready`'s timing.** Delayed deliberately at t1279 to close a header/menu race. If you need
  "the app is usable", listen for **`ddcs:interactive`** instead — that is what it is for.

---

## What lives where

| File | Purpose |
|---|---|
| `ROADMAP.md` | the plan and the arcs — read before proposing direction |
| `DDCS-Studio/WORK-LOG.md` | append-only trail of *why*; never rewrite prior entries |
| `PORTING.md` | the controller-porting arc's progress ledger |
| `HANDOFF.md` / `NEXT-SESSION.md` | the advisor/worker loop's coordination — written by tooling, not by hand |

Architectural conventions live in `ROADMAP.md` and in the code's own comments. This project comments
*why*, not *what* — those comments are the design record, so read them before overriding them.
