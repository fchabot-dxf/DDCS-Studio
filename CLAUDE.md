# CLAUDE.md — read this first, on every seat

⭐ **This file exists to DELIVER things.** A fact in the repo that nobody opens is worse than a memory that
surfaces on its own — repo documents have no delivery mechanism, and this is the one file every seat loads
automatically. So it stays **thin**: pointers, plus the few things that must be read every single time.

## ⛔ FIRST: READ [`AGENTS.md`](AGENTS.md)

**It holds the rules**, and its own header says why: *"Each one is here because breaking it has already cost
real time or shipped a real bug."*

⚠⚠ **It is NOT auto-loaded — MEASURED, 2026-08-25.** A fresh session at the repo root was asked, without
reading or searching anything, which files were already in its context. `AGENTS.md` was not among them. Only
`CLAUDE.md` is delivered automatically.

⇒ **So the repo's canonical rules file reaches nobody unless someone opens it**, and this line is the only
thing that makes that happen. ⭐ That is the same defect `MEMORY-PROTOCOL.md` §1 names: a repo document has no
delivery mechanism. **Open it now.**

## THE CONTEXT FILES — the operating context, shared by every seat

| file | answers |
|---|---|
| ⭐ [`context/SEATS.md`](context/SEATS.md) | **who reaches which controller, from where** — and the VS Code setup |
| [`context/SETUP.md`](context/SETUP.md) | the studio, and home. what is wired to what. ⛔ the safety rules |
| [`context/CHANNELS.md`](context/CHANNELS.md) | the vendor and the community — what is pending with each |
| [`context/VERIFICATION.md`](context/VERIFICATION.md) | **which suite to run and what it costs** — the tier policy, where to watch progress, and the two traps that silently disable the tooling |
| ⭐ [`context/RUNNING-THE-LOOP.md`](context/RUNNING-THE-LOOP.md) | **advisor/worker mechanics that have already cost real time** — never idle the worker on a non-decision · narrow scope at dispatch not mid-turn · `git add <path>` does not protect a shared FILE · name the tier |
| [`context/GIT-AND-TOOLING-HAZARDS.md`](context/GIT-AND-TOOLING-HAZARDS.md) | shell/git/test-runner traps in THIS repo — heredoc escapes, the shared git stash, the mem-server's stale preload, CSS token defaults |
| [`context/VERIFICATION-DISCIPLINE.md`](context/VERIFICATION-DISCIPLINE.md) | what "green" has to mean here — verify the real symptom not a proxy, assert the value not the change, review the whole surface |
| [`context/PRODUCT-PRINCIPLES.md`](context/PRODUCT-PRINCIPLES.md) | standing owner rulings on the product itself — nothing is precious, GUI over fields, no unrequested affordances |
| [`context/DECISION-FRAMEWORK.md`](context/DECISION-FRAMEWORK.md) | the goal is a PERSON authoring, not the app declaring — and the 5-gate sieve a design fork resolves through before it's a subjective call |

⛔ **These are NOT project documentation.** They are the *operating context* — where the work happens, on what
hardware, with whom. The project itself is documented in `ROADMAP.md`, `ARCHITECTURE.md`, `BACKLOG.md`, and
`bridge/controllers/*/FINDINGS.md`.

## ⏸ CURRENT SESSION STATE

⭐ **[`context/HANDOFF-FROM-FAIRY.md`](context/HANDOFF-FROM-FAIRY.md) → the SESSION STATE block.**
Whichever seat you are, that is what a returning session should open first: the machine's state, the single
next action, and what the last session settled or got wrong. The outbound half is
[`context/HANDOFF-TO-FAIRY.md`](context/HANDOFF-TO-FAIRY.md).

## ⛔ THE THREE THAT MUST BE READ EVERY TIME

1. **TWO CONTROLLERS, and they behave differently** — the **DDCS V4.1** (bench, at home, motorless) and the
   **DDCS Expert / M350** (the studio, real). ⛔ Never carry a finding from one to the other without checking
   [`bridge/controllers/README.md`](bridge/controllers/README.md).
2. ⛔ **No write operations to a live controller when the owner is not at it.** ⭐ **And the owner ruled HOW TO
   KNOW (2026-08-26): on the Expert, REACHABLE MEANS PRESENT** — they power it down when they leave, so the
   machine answering *is* the presence signal. ⛔ **Do not ask "are you at it?"** — that tax is exactly what the
   ruling removed, and asking again reads as not having listened. ⚠ Presence still **cannot be inferred from
   *which seat* is talking** (phone, every conversation at once) — it is the *controller being on* that says it.
   ⭐ The bench **V4.1 is exempt entirely** (motorless, on 24/7). Full text: [`context/SETUP.md`](context/SETUP.md).
3. ⛔ **Two seats share this repo, concurrently.** `git pull --rebase` before committing, expect a rejected
   push, **never force-push**. Normal condition, not an edge case.

## WHERE A NEW FACT GOES

Full rules: [`MEMORY-PROTOCOL.md`](MEMORY-PROTOCOL.md). The short version:

```
about a CONTROLLER          → bridge/controllers/<name>/FINDINGS.md, tagged [CONFIRMED]/[TO TEST]/[HYPOTHESIS]
about WHERE/WHO/WITH WHAT   → context/  (this is the category that had no home until 2026-08-25)
about the CODE              → the doc that owns that area
about THIS MACHINE only     → stays a local memory
```

⚠ **A local memory is invisible to every other seat.** That is not a discipline problem to be solved by
remembering harder — it is why `context/` exists.
