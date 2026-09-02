# RUNNING THE LOOP — advisor/worker mechanics that have already cost real time

⭐ **This file exists because the lessons in it were written to a LOCAL memory first**, in
`~/.claude/projects/.../memory/` — invisible to the worker, invisible to the other seat, invisible to the
same role on another machine. `CLAUDE.md` already says why that is wrong:

> *"A local memory is invisible to every other seat. That is not a discipline problem to be solved by
> remembering harder — it is why `context/` exists."*

⇒ Anything about **how the loop is run** belongs here. A local memory is only for facts about one machine.

---

## 1. ⛔ Never idle the worker on a non-decision

**An idle worker is the cost of the advisor's deliberation.** The loop's throughput is the worker being
busy; every question that does not change what gets built is paid for in idle time.

**The test before asking the owner anything: does the answer change WHAT gets built?** If every option is
required and they do not block each other, the only variable is ORDER — and ordering is the advisor's
job, not something to escalate.

⚠ **2026-09-02.** After the t2513 audit the advisor asked *"unify the renderers, or #71 handle blocks?"* —
having already written, in that same message, that both were needed and that they were independent. The
answer was *"do both then"*, after two round-trips (one of them spent re-explaining the question) with
the worker idle throughout. The owner: *"you knew we needed both, that wasn't useful, we wasted hours on
idle worker."*

⇒ **When unsure of order, dispatch the smaller/safer one and think while it runs.** Thinking is free
during a worker turn and expensive between them. Reserve questions for forks where different answers
produce different work: a product-shape call, a scope cut, something only the owner can observe.

⚠ Note the rule that pulls the other way and where the line is: **ask before dispatching when the SPEC is
ambiguous** (which surface, which axis, which baseline — a circled screenshot IS the spec). Do **not** ask
when only the ORDER is open.

## 2. Narrow scope at DISPATCH time, not mid-turn

Amendments are **polled at checkpoints, not delivered instantly**. A note that ADDS information is fine
mid-turn; a note that REMOVES or narrows scope usually arrives too late — the worker polls at the next
boundary, which can be after a 35-minute suite run, by which point the work is committed and pushed.

⚠ **t2481.** The owner said *"finish one thing at a time"*; the advisor sent an amendment narrowing the
turn to one item; it surfaced at the worker's final pre-pass poll with everything already done, tested and
pushed. The worker correctly refused to revert sound pushed work and flagged the conflict rather than
absorbing it silently.

⇒ Decide scope BEFORE dispatching and put it in the `pass` note. Use `amend` for information the worker
cannot otherwise get, not for re-scoping. When an amendment does lose the race, **the error is the
sender's scheduling** — not the worker ignoring instructions.

## 3. `git add <path>` does NOT protect a shared FILE

Path-scoped staging narrows *which files*. It does nothing when both seats edit the **same** file — the
whole working-tree version gets staged, including the other seat's uncommitted work.

⚠ **t2505.** The advisor committed a `BACKLOG.md` correction by explicit path while the worker's own
uncommitted `BACKLOG.md` entry for that turn sat in the tree. It landed under the advisor's commit
message. Nothing was lost; the worker verified via `git show`, excluded the file from their own commit,
and said so plainly.

⇒ `BACKLOG.md`, `WORK-LOG.md` and `ROADMAP.md` are **shared-write**. Run `git diff -- <file>` before
staging one, and prefer waiting for the hand-back — a doc correction is never urgent enough to risk it.

## 4. Name the TIER in the dispatch; the default is not "full suite"

`context/VERIFICATION.md` records the policy: `test:changed` + `test:node` by default. The advisor
overrode it by writing *"full suite before you conclude"* into nearly every dispatch — including turns
that changed no code at all. The worker said so three times (t2487, t2503: *"run anyway per the
dispatch's own unconditional VERIFY ask, even with zero code changes"*). Roughly 35 minutes a turn, for
no information.

⭐ **The sharper rule than "it touches a shared file": run the full suite when the FAILURE MODE IS
SILENT.** A type-string rename, a node-type change, anything where a missed consumer *renders nothing*
instead of erroring. That still catches t2371's blanked preview panes — same shape, silent absence — and
it does not fire on measurement turns.

⇒ The dispatch names the tier. The worker states **why** they ran what they ran, so a wrong choice is
visible rather than silent. Rule 1b (AGENTS.md) stays unconditional for its named files.

---

## t2519 — MIGRATED FROM LOCAL MEMORY (86 feedback-type memories triaged; this section covers the
ones about how the loop itself runs). Full triage record: `WORK-LOG.md`'s own t2519 entry.

### 5. The advisor must run `wait` to claim its turn, and sign every reply

`handoff.py pass`, `status`, `amend`, `sig` never advance the advisor's own "last handled" marker — only
`wait`/`watch` do. Reading `status` and acting directly is invisible to the marker: work gets done but
`.handoff/advisor.last` sits stuck, and the loop reads as stalled to anyone checking it (it happened for two
days straight, 2026-08-21). Sign every reply `🧭 turn N` for the turn you **handled**, not the one your own
`pass` just created — the higher number is the latest response, the lower one owes the next move. Same rule
applies to the worker, signing `🔨 turn N`.

### 6. Branch pruning is advisor hygiene, and verify by CONTENT not commit count

Worker branches pile up (28 refs seen at once, 12 with unmerged-looking commits) because the worker opens
them and nobody closes them. `git rev-list --count trunk..branch` showing "ahead" does **not** mean unmerged
work — most are content-merged (re-applied/squashed) but not commit-merged, so git still counts the originals
as unreachable. Before deleting, grep the trunk for the branch's own claimed function/file/WORK-LOG turn id.
Never prune another agent's branch (a concurrent analytics agent shares this repo — see §12) or anything whose
content you can't find — "not found" means don't delete, not "probably fine."

### 7. Ask the clarifying question BEFORE dispatching, not after — especially when a screenshot is the spec

A terse request acted on by inference costs more round-trips than one upfront question. When a screenshot or
a number IS the spec (a circled element, "bigger, like 8-10%"), confirm three things before dispatching: which
surface/referent exactly, which dimension/axis, and against what baseline. Read a circled screenshot as a
literal answer, not a prompt to guess the nearby cluster. Balance against over-asking: the test is whether the
answer changes what gets built — routine judgment calls still get made, not escalated.

### 8. A flaky-test investigation checks in with the advisor SOONER, not later

Flake-hunting has poor internal stopping signals — each new diagnostic feels like "one more check away," so a
solo worker can burn many turns without a natural pause point. Once there's SOME concrete progress (a narrowed
repro, a candidate cause, a swallowed exception), pass it back and ask for direction rather than continuing to
chase the exact root alone. This is specific to non-deterministic failures — a deterministic bug with a clear
repro doesn't need the extra check-in.

### 9. Dispatch specs go in the repo's own `scratchpad/`, never a session-local temp path

`DDCS-Studio/scratchpad/` is gitignored and shared between the two seats on one machine; a spec written to a
session's own `~/.../Temp/claude/<session-id>/scratchpad/` is invisible to the other seat — it cost two lost
specs in one session before this was caught. Quote the path in the pass note exactly as
`DDCS-Studio/scratchpad/<name>.md`, and still carry the essential ruling inline in the note itself — the note
always reaches the reader; a file might not.

### 10. A ~15-30 min quiet stretch with 0 tracked procs is the gate running, not a stall

The full Playwright gate runs long (14-40+ min under load) with no file edits and no processes attributable to
the worker's own tracked root PID (`proc_health.py` only sees descendants of the root it registered). Don't
diagnose a stall from idle time or 0-procs — that heuristic over-fired roughly a dozen times in one session
before the rule stuck. On a waiter timeout, just re-arm and wait; the worker will report a genuine hiccup in
its own pass-back if one occurred, that's the only stall signal to trust.

### 11. Every dispatch = the arc step PLUS one small backlog item, in its own commit

Small items rot behind whichever arc is running unless deliberately tailed onto each turn. The tail runs AFTER
the main task is green, commits SEPARATELY (never sharing a diff with the arc step), and must be genuinely
small and already-diagnosed — a tail that needs investigation is a turn, not a tail. If it's risky or touches
the same files as the arc step, give it its own turn instead and say so.

### 12. The old advisor/worker file split is retired — the worker writes everything

Ruled 2026-08-21: there is no advisor-owned code directory anymore. The worker writes `web/`, `bridge/`,
`desktop/`, docs, `BACKLOG.md` — no default off-limits area. The advisor plans, reviews with fresh eyes, gates
risky moves, and cuts releases, and does **not** write code — that is what keeps the loop's one independent
review intact. Don't self-impose a "stay out of X" restriction from an older or stale note; a future dispatch
that explicitly scopes something as advisor-owned is a deliberate one-turn exception, not a reversion.

The REAL hazard this replaced was never file ownership — it's **concurrent `git add`.** Both seats stage in
one working tree; an unscoped or badly-timed add on a shared file (`NEXT-SESSION.md`, `ROADMAP.md`,
`BACKLOG.md`, `WORK-LOG.md`) sweeps the other seat's uncommitted edits into your commit, silently, exit 0 —
it has happened in both directions. Stage only explicit paths, never `-A`/`.`; treat an empty commit as "the
other seat already took it," never "nothing changed." A concurrent research agent (see §12b below) also
shares this repo — don't assume every unexpected commit is the advisor; check `git log --format="%h %an %s"`.

**12b.** A separate "analytics" agent runs in parallel on this same repo/working tree (a Cloudflare Worker
under `analytics/`, unrelated to `DDCS-Studio/web`) and rewrites `main` history (rebase/amend) on its own
schedule. Unexpected `analytics/*` changes, your own commits vanishing from local `main`, local/origin
divergence — this is normal, not a problem to fix: stage only your own files, never blindly sweep a dirty
`analytics/*` tree. `node_modules` can get wiped to empty mid-turn by their own `npm ci`; recover with your
own `npm ci` (deterministic, doesn't touch the lockfile) and re-run the suite to confirm before continuing a
big uncommitted change. Be decisive on already-authorized git actions (a standing "commit and push" doesn't
need re-confirming the mechanics each time) — but see §13, never `git stash` regardless of who authorized what.

### 13. Never `git stash` in this repo — the stack is global across every worktree and agent

Hit at least five times across both roles despite the standing rule each time. `refs/stash` is repo-global; a
`pop` can take ANOTHER agent's or worktree's entry, spraying `UU` conflicts into files you never touched (a
conflicted pop KEEPS the entry — recover with `git restore --staged --worktree <paths>`, never
`git stash drop`, which would destroy someone else's work). The trigger phrase to catch in your own reasoning:
*"let me stash this to compare against HEAD / the pre-change tree."* The moment that thought forms, use
`git checkout <ref> -- <paths>` (or `git show <ref>:<path>` to just read the old version) instead — swap, run
the check, swap back. If a stash happens anyway, pop it back in the very next command before any other git
operation.

### 14. A backticked (or `$`/`\`-escaped) string in ANY Bash-tool call silently loses words

Not just `--note` — `git commit -m`, Python heredocs, any string the Bash tool passes through a shell. A
backtick triggers command substitution; the shell runs the "command," gets nothing back, and the word vanishes
from the written text with no error — hit at least eight times across both roles, including once in a shipped
commit message and twice in the same `--note` after the rule was already known. Content containing backticks,
`$`, backslash escapes, or nested quotes goes through the **Write or Edit tool**, which never touches a shell;
use Bash only for the mechanical splice afterward (`git commit -F <file>` from a file the Write tool wrote).
After any risky string, grep the result back — the failure is silent, so reading it is the only real check.

### 15. `cd` inside a compound handoff/proc_health command forks a split-brain state — and orphans a nested waiter

`handoff.py`/`proc_health.py` anchor to the CURRENT WORKING DIRECTORY. A bare `cd <subdir> && npx playwright …`
in the same Bash call as (or before) a `handoff.py` call leaves cwd changed for every later call in the
session — the next `pass`/`wait` writes a fresh, forked `HANDOFF.md` in that subdir instead of the repo-root
one, and the loop silently stalls with the ball apparently still yours. Wrap any subdir command in its own
subshell (`(cd sub && …)`) or use absolute paths; never a bare `cd` sharing a line with anything else. A guard
now hard-exits on `HANDOFF.md` found only in a parent dir, but it can't detect a fork already sitting in a
subdir — delete those on sight.

**Separately, and just as costly:** `handoff.py wait` (or any long-running command) must be its OWN
Bash tool call with `run_in_background: true` and **nothing else** in the command string — no trailing `&`,
`disown`, or pipe. Double-backgrounding (harness-level `run_in_background` PLUS a shell-level `&`) makes the
OUTER shell return almost instantly with "completed, exit 0" — reading exactly like a normal finished
background command — while the REAL process (the waiter, or a full test suite) keeps running fully detached,
invisible to `proc_health.py watch` (which only sees descendants of the tracked root). This has happened on
`handoff.py wait` specifically and, separately, on a full `npm test` run backgrounded the same double way —
the rule is general: before setting `run_in_background: true` on any command, scan the command string itself
for `&`/`disown`/a trailing background pipe and strip it. The tool's own backgrounding replaces it entirely,
never stacks with it. Verify a waiter is genuinely alive with PowerShell (`Get-CimInstance Win32_Process`),
not `ps | grep` (Git Bash `ps` can't see Windows process args) — and re-verify later, since a nested waiter can
look alive on an immediate check and still die minutes later with no timeout reached.

### 16. A worker seat that restarts mid-turn deadlocks the loop — check for an armed waiter with no work behind it

`wait`'s own claim-on-wake (`set_handled`) fires the instant a turn is picked up, before any work exists. If
the seat dies between wake and pass, `HANDOFF.md` still says the ball is theirs while their own "last handled"
marker already shows the current turn — indistinguishable from a genuinely completed turn to the marker alone.
The tell: the ball is with a role AND that role's own "last" already equals the current turn AND a `wait`
process for that role is alive — that combination means the seat restarted and is waiting for a turn that will
never arrive. Fix: `pass` to that role again with the same task. Check `git status` first — a died-mid-turn
seat can leave real uncommitted work that would otherwise be silently redone or lost. Never bump the epoch to
"make sure"; only bump it when a genuinely fresh window opens.

### 17. A release is never the last thing in a message — dispatch, or say the loop is parked and why

Cutting a version (sign, review, bump, push, report) is a satisfying end-of-cycle act with no automatic
trigger for the NEXT dispatch — nothing feels missing when the advisor stops there, and the waiter can't catch
it (`wait` only watches AFTER a `pass`, so a missing pass leaves no watcher and no notification; it looks
identical to normal work). This produced three consecutive stalls in one session, all at the identical point,
all caught only by the owner asking "is the loop stopped?" After every version push, the same message must
end with EITHER the next dispatch (with the waiter re-armed as its own background call, per §15) OR an
explicit sentence naming that the loop is parked and why (gated on the owner, out of scope, end of session).
Diagnose with `handoff.py status` — `"ADVISOR holds the latest turn (N) and has NOT passed"` is this exact bug.

### 18. Release mechanics: the script, the timing, and the cadence

**Timing** — release (bump/commit/push) only while the worker is idle (ball with the advisor, tree quiet). A
mid-task bump edits the same shared tree the worker is editing; the worker's own commit can sweep the
uncommitted version-bump files into itself, producing a half-bump (one file bumped, the sibling stamp stale).
Sequence it: release before dispatching the next task, or wait for the hand-back.

**Cadence** — two-mode, owner-chosen: a LIVE session (the owner testing in real time) bumps+pushes `main` at
every verified milestone; an AUTONOMOUS run bumps only every ~3rd turn and always at the hold point, pushing a
per-turn BRANCH the rest of the time — `main` never receives code that skipped the full gate. The owner can
say "release" at any point to force a gate+ship on the spot. Merging to `main` and releasing are NOT the same
act — fast-forward `main` after every reviewed, passed turn (not only at a version bump), using a refspec push
(`git push origin <branch>:main`, no checkout — survives a dirty tree, which this repo almost always has) so
the deployed site doesn't sit arbitrarily far behind reviewed work between releases.

**Mechanics** — `cd DDCS-Studio && npm run bump-version` (AGENTS.md rule 7) is the ONLY way to bump; it writes
all three stamps (`.ver` chip + title in `index.html`, `package.json`, `version.json`) from one source, and
`version-sync-1311.spec.js` fails if they disagree — hand-editing any two of the three has shipped nine
releases with a silently stale third file. Stage and confirm all three are actually staged before committing
(`git status` the bump) — a release commit is the one commit the preceding green suite structurally cannot
vouch for, since the bump happens after the suite ran. On a long-running feature branch, "push to main" means
fetch → confirm 0 commits behind (a fast-forward) → merge → push → **verify it actually went live** (md5 a
changed file against `git show HEAD:<path>` — a flipped version chip alone does not prove the deploy; modules
can serve stale bytes underneath a fresh chip).

### 19. Editing a skill file needs the owner's explicit confirm first — propose the text, wait for the yes

Skill files (`~/.claude/skills/`, or a project's own skill repo) are the loop's constitution — durable,
cross-project, loaded by every future session. A conversational insight is a draft until the owner ratifies
it; auto-folding it into a skill file promotes an interpretation to law without review. When a discussion
yields something skill-worthy, propose the exact text in chat and wait for the confirm before writing or
committing it. An explicit ask ("put that in the skill") IS the confirm. This does not apply to a role's own
project memory files, which stay that role's to write freely.

### 20. Advisor review is two-method, always: read the diff AND drive the real app yourself

Never accept a worker's own "verified" claim as the review — a worker's own screenshots can frame the passing
case (a programmatic drag, a config that happens to dodge the bug). Every pass-back review is (1) the diff
read with fresh eyes plus the actual asserted VALUES, not the worker's summary, and (2) the advisor's OWN
real-app screenshots against the committed tree (never mid-turn — the worker owns the tree until it passes
back). Report the verdict to the owner as a picture + plain words; keep file:line citations as backing links,
never as the explanation itself. Treat "suite green, some flaky from load" as an unverified claim until the
flaky specs are re-run in isolation — a hard, deterministic failure has hidden behind that framing before.
Before ANY release, grep the suite log for the explicit failed-count line (never trust a piped `tail`, which
eats the count that prints above the failed-test list — strip ANSI/NULs first: reporters can prefix a summary
line with a cursor-move escape that defeats an anchored grep pattern too).

### 21. `npm test` from the repo root (no `package.json` there) silently walks up and tests the wrong tree

This repo's git root has no `package.json` — the npm project lives one level down in `DDCS-Studio/`. Run
`npm test` from the root and npm walks UP to the user's home directory, runs the test runner across unrelated
caches and repos, and **exits 0** — a 30-minute "gate" that never touched a single project spec, caught only
by noticing foreign paths in the output. The trap is `cd`'s persistence across Bash calls: an earlier
`cd <repo-root>` (needed for a `handoff.py` call) silently re-anchors a later `npm`/`npx` command too. Anchor
test commands explicitly in the SAME command (`cd <repo-root>/DDCS-Studio && npm test`), and before trusting
any gate, confirm the output actually names project specs (the mem-server on 3211, a `N passed` line) — exit 0
alone is not evidence, and neither is a tail.

### 22. Read an alarming cross-seat finding sceptically, not urgently — and a grep result only gives a line, not its scope

An alarming claim from the other seat (or your own grep) gets acted on FASTER than an ordinary one precisely
because it feels irresponsible to question — both directions of this failed on the same day once: a scary
"stale data" finding from the other seat got promoted to a redesigned pull mechanism in one exchange, and
turned out to be two readings compared across time with nothing holding state still; separately, a `grep -n`
hit was read as belonging to a file's first labeled section when the file had a second section starting
later, and the whole downstream claim was wrong. Before letting either kind of finding change a plan: ask
which MOMENT each number came from, what the actual boundary/section is (find where each section starts, then
compare line numbers), and whether it's OBSERVED or INFERRED (see also §23). A dump/log outranks reasoning —
but only for what it actually says; the inference step from a raw hit to a claim about it is reasoning like
any other and inherits none of the dump's authority. Mark a withdrawal, don't delete it — the wrong turn
staying visible is the only reason the pattern is catchable at all.

### 23. A plan document's own severity claim is not evidence — mark every entry OBSERVED or INFERRED

A sentence written into a planning doc reads in the same voice whether it records something seen or something
worried about, so a later reader (including the same author) can't tell them apart — one such sentence
outranked real work for weeks before someone traced it back to a docs-only commit with no underlying
observation behind it at all. A "REMAINING FRONTIER" / "not yet possible" note carries the same defect in the
other direction: it's a snapshot of what was unsolved when it was written, and nothing updates it when another
part of the codebase closes the gap — treat any such claim as stale until re-checked, never escalate an "open"
item to the owner without grepping for the capability first (the file that solved it will not have updated the
file that named the gap). Where a frontier can be pinned as an executable assertion instead of prose, do that
— a prose list rots silently; a failing test announces itself.

### 24. Poll amendments at EVERY part boundary in a multi-part task, not only right before commit

A three-part dispatch got built straight through (A → B → B2) with amendments checked only at the final
pre-commit checkpoint — where a mid-task owner amendment ("drop part B") was sitting, unseen, the whole time.
By then B was fully built (specs migrated, rows slimmed, tests updated) and had to be reverted entirely. The
worker skill already says to poll at each natural checkpoint (before commit, at a phase/gate boundary, right
before pass) — for a task with genuinely independent parts, treat each part's own completion as one of those
boundaries and poll THEN, especially before starting a part that's expensive to build or hard to revert. An
amendment that contradicts an already-built part gets reconciled or reverted cleanly, never half-applied.

### 25. The docs commit lands EMPTY unless `WORK-LOG.md` is staged first — `--allow-empty` hides the mistake

The two-commit turn pattern (a feature commit, then a docs commit) has a recurring trap: the feature commit
stages specific SOURCE files, so `WORK-LOG.md` — edited via Write/Edit, which modifies the working tree but
never stages anything — is still unstaged when the docs commit runs. Using `git commit --allow-empty -m
"docs(work-log): ..."` then produces a genuinely empty commit: the WORK-LOG entry never lands, and
`--allow-empty` silences the "nothing to commit" error that would otherwise have caught it. For the docs
commit, always `git add WORK-LOG.md && git commit -m "docs..."` with NO `--allow-empty` — a real add, a
non-empty commit. If one already landed empty, fix it with `git add WORK-LOG.md && git commit --amend
--no-edit` (only safe because the empty commit was never pushed/shared).

### 26. Don't auto-open scratchpad or scout docs as editor tabs each turn

Writing a scratchpad doc or a scout report does not mean opening it as a visible editor tab — the owner found
that habit cluttering their editor every single turn and asked for it to stop. Keep writing scratchpad docs
and screenshots as before; just reference their PATH in the pass-back note or WORK-LOG rather than opening
them. The one standing exception is an IMAGE, which chat genuinely can't render inline — open a tab only for
that, or whenever the owner explicitly asks to see something.

### 27. Don't gate execution on the owner's own hands-on app testing — drive on correctness + review instead

The owner does not want to be the QA gate for every increment, and does not want work sequenced around when
they'll personally click through it — stated directly: "don't worry about my use of the app, do it correct and
efficiently." The honest response to owner-eyes catching gaps headless tests missed (a route dead-ended, a
missing render) is STRONGER real-symptom verification (§1 of `VERIFICATION-DISCIPLINE.md`) plus fresh-eyes
review, not building "human-eyes" checkpoints into the sequencing. Batch pattern-identical work, resolve
engineering forks on merit rather than asking, and surface a milestone as an evidence-based sign-off rather
than a QA request. This default holds only until the owner explicitly CLAIMS the verify gate for something —
see §28, which is the one time to stop and wait.

### 28. Once the owner claims the verify gate, every next pass waits for their EXPLICIT go

When the owner says any form of "let me verify this before you continue," their subsequent defect reports are
INPUT STILL BEING COLLECTED, not the gate opening — a defect report is not itself the go-ahead to dispatch a
fix. Caught directly: two defects were reported, immediately treated as "the verification outcome," and a
fix-back pass was dispatched — then a third item arrived a minute later and missed the batch entirely, and the
owner corrected it plainly ("wait for my actual comment"). Once the owner has claimed the gate, collect
everything they report (grounded and specced) and do NOT pass — even a fully-grounded fix — until they
explicitly say go ("ok," "go," "send it"). Ask "ready to dispatch, or more coming?" only if they seem to have
stopped, never assume readiness from silence alone.

### 29. When the owner questions or pushes back on work, STOP acting — discuss first, don't immediately edit

A question or pushback ("not sure that's right," "I don't understand what you fixed," "wait," "stop editing")
is a signal to explain and align, not to act further. Charging ahead with more edits or investigation while
being questioned reads as not listening, and has needed the owner to repeat "stop" multiple times before it
actually stopped. Treat it as a hard pause: no code edits, no investigative greps or traces, no tool runs,
until a clear instruction follows the discussion. The one exception is cleanly undoing a change the owner just
explicitly rejected — and even that is worth confirming first if there's any doubt about scope. This extends
to doc/queue writes too, not just code: a live report in conversation is not yet a commission to write it into
a durable doc — propose the interpretation or wording in chat first, let the owner nod or correct it, THEN
record it. Recording first locks in an interpretation before they can steer it and turns a one-line
conversational correction into a doc-edit review instead.

### 30. The worker arms a watcher on the turn marker before stopping — the loop has no message inbox

After finishing a task and writing the WORK-LOG entry, the worker arms a listener on the shared turn marker
(`HANDOFF.md`) before handing the ball back and going quiet — coordination here is entirely file-based, there
is no message inbox between sessions. The worker's own loop is finite (one task per wake, bounded by whatever
the advisor dispatches); without an armed watcher, a hand-back stalls until the owner manually re-prompts,
since nothing else is listening for the flip back to `to: worker`. Re-point the watcher after every hand-back
so a worker's own turn-marker edit doesn't immediately re-trigger itself. This is the passive listening half of
one-way control (advisor → worker) — the worker only ever listens and edits the marker, never summons the
advisor directly.

### 31. Every waiter re-arm is a chance for a free, read-only PULSE — use it

Reading the shared tree costs nothing and never touches the ball, so every re-arm of the advisor's own waiter
is a natural moment to check in on the worker's live progress rather than sitting in total silence until the
pass arrives: `git status --porcelain`/`git diff --stat` at the repo root (uncommitted changes show real
mid-task progress), the worker's own session transcript (its most-recently-modified `.jsonl`, tailed for the
current tool call), and a process check for a live Playwright swarm (a gate running, not a stall — see §10).
Report one compact line per channel at each re-arm: files touched, building-or-gating, latest worker action.
Never act on what a pulse observes (no kills, no amendments) without going through the usual gates first — it
is strictly a read.

---
