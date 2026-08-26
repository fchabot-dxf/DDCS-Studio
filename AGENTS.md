# AGENTS.md — read this before changing anything

<!-- AUTOLOAD-CANARY-K9V2 -- temporary, see below -->
> ⚠ **AUTOLOAD TEST — placed 2026-08-25, delete once answered.**
>
> **If you are an agent and this text is already in your context WITHOUT you having opened `AGENTS.md`
> yourself, say exactly:** `AGENTS-AUTOLOAD-CONFIRMED-K9V2`
>
> ⛔ If you are only seeing it because you read the file, say nothing — that proves nothing.
>
> *Why: we do not know whether this tool auto-loads `AGENTS.md` the way it auto-loads `CLAUDE.md`. It
> matters, because if it does, the substance belongs here (tool-neutral, already the repo's canonical entry
> point) and `CLAUDE.md` can shrink to a stub. Record the answer in `context/SEATS.md` and delete this block.*


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
