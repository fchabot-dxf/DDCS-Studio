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
