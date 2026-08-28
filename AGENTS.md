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

#### ⛔ 1b. A change to a SHARED RENDER PATH is not verifiable by targeted checks. Run the full suite BEFORE you believe it.

⚠ **Paid for twice.** A shared CSS token once reached further than the smoke tier looked. Then on
**2026-08-28 (t2371)** a fix that widened `hasTreeLayout()` passed every targeted check its author ran —
and **regressed 21 tests**: blanked preview panes, and dropped section-grouping for surfacing, contour,
slot and text. ⭐ **Nothing but the required full-suite run caught it.** It was reverted and replaced with
a narrower fix touching zero lines of the tree/flat decision.

**The files where this applies** — a change here is shared until proven otherwise:

```
ui/formWidgets.js      wizards/views/userOpView.js     blocks/blocksApp.js
ui/paneAccordion.js    blocks/blockEmitter.js          styles.css tokens at :root
```

⇒ **The rule is about ORDER, not effort.** Targeted checks tell you your change works. They cannot tell
you what else it reached — every one of those 21 tests exercised a wizard the author had no reason to
open. ⭐ **Run the full suite before you conclude, not after** — a green targeted check on a shared
render path is not evidence, and a fix you already believe in is the expensive kind to be wrong about.

⭐ **A narrower fix that touches no shared decision beats a wider one that passes.** t2371's shipped fix
mounts the widget directly in the path that needed it. Prefer that shape whenever it exists.

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


### 7. Bump the version with the SCRIPT, never by hand

```bash
cd DDCS-Studio && npm run bump-version
```

It writes **all three** places a version lives — the `.ver` chip **and** the `<title>` in `web/index.html`,
`package.json`, and `web/version.json` — from one source of truth. `tests/version-sync-1311.spec.js` fails
if they disagree.

⛔ **Do not `sed` them.** On 2026-08-26 nine releases were cut by hand-editing `version.json` and
`index.html` only. `package.json` sat on the previous day's date for all nine, and **the suite stayed green
the entire time** — the spec compares a date relationship, so a stale `package.json` only became visible when
the date rolled over at midnight.

⭐ **The general form, and it is why this is a rule and not a note:** when a routine already exists as a
SCRIPT, restating its steps in prose — in a doc, a memory, or a commit message — creates a second copy that
drifts. **Run the script; point at it.** This script's own header records that its predecessor had already
drifted the same way once.


### 8. Closing a backlog item means editing its HEADING, not appending to its body

```
### 14. [✅ SHIPPED t2221 — `hash`] THE THING          ← the heading carries the verdict
```

**The heading is what anyone scanning `BACKLOG.md` reads.** An update appended to the body is invisible to
that scan, so a finished item keeps advertising itself as open — and the next person either re-investigates
it or plans around a problem that no longer exists.

⚠ **On 2026-08-26 SEVEN entries were closed in the code and open in the file** — #6, #8, #10, #14, #22, #24,
#26. Every one had a `✅ UPDATE` in its body. **Not one had a tagged heading.** Two of them had been fixed
three weeks earlier.

**When you close one:**
- tag the heading: `[✅ SHIPPED tNNNN — <commit>]`, or `[STALE]` / `[REFUTED]` / `[NOT A BUG]`
- keep the body — the reasoning is worth more than the tidiness, and a REFUTED entry teaches more than a
  deleted one. ⚠ This is the opposite of rule 6: a PLAN is deleted when it ships, a BACKLOG ENTRY is tagged.
  The plan describes work to do; the entry records what was wrong and why, which stays useful.
- ⛔ if its `STILL REAL IF` check would now give a FALSE POSITIVE, say so in the entry. #22's check still
  matches its own fix, because the sanitisation happens a line above the interpolation it greps for.

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
