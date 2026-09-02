# DECISION FRAMEWORK — the north star, and how a fork actually resolves

**Both seats read this.** It answers two different questions that are easy to conflate: *what is this project
actually FOR* (the goal), and *when a design forks, what decides it* (the sieve). Getting the first one wrong
looks like real progress and isn't; getting the second one wrong looks like a stall.

## ⭐⭐ THE GOAL IS A PERSON AUTHORING, NOT THE APP DECLARING

**Corrected 2026-09-02, after 25 turns run against the wrong goal.** The north star for the wizards-as-data
work is **a PERSON building a built-in-equivalent wizard out of blocks** — a form, a live-handle canvas, a 3D
preview, assembled through the real Blocks UI, no code. It is **not** "the app's own internals being expressed
as declared data" — that reframing sounds almost identical and is a different goal entirely, because it can be
satisfied by machinery a human never touches.

⇒ **Judge a turn's work by whether an AUTHORING PATH now exists, and what it costs** (actions counted through
the real UI — see `context/VERIFICATION.md`/the handle-block turns' own "t2517/t2525 bar": author from the
palette, save, reload, drag, confirm the emitted G-code changed) — never by an internal "N of 32 declared"
count on its own. A high declaration count with no authoring path behind it is not progress toward this goal,
even though every individual step that produced it may have been correct engineering.

⚠ **This is exactly the trap that is easy to fall into**: each of the 25 turns that ran against the wrong goal
was individually reasonable — the mistake was invisible turn-to-turn and only legible once someone asked "does
a person actually gain anything from this."

## THE DECISION SIEVE — how a design fork resolves, in order

When two viable designs disagree, work through these gates BEFORE falling back to owner judgment on value/cost/
priority — most forks resolve at one of the first four and never need to reach a subjective call at all:

1. **Safety** — does either option touch something that can hurt a person, ruin stock, or crash hardware? A
   safety difference wins outright, no further gate needed.
2. **Declare, don't infer** — does one option let the app read the answer from a declaration, while the other
   reconstructs it by reverse-engineering output or sniffing state? The declaring option wins by default (see
   the global CLAUDE.md's own "Declare over Hand-roll" rule — this is the SAME principle applied at design-fork
   time, not just at implementation time).
3. **One source** — does one option keep a single place that can be wrong, while the other lets two
   representations of the same fact drift apart? Single-source wins.
4. **Valid by construction** — does one option make the wrong state structurally unreachable, while the other
   merely checks for it after the fact? Construction-time validity wins over a runtime guard.
5. **Verify the real symptom** — if the first four don't decide it, which option is provably tested against
   the actual user-visible behavior, not a proxy for it?

Only once none of the five gates separates the two options does it become a genuine owner call on value, cost,
or priority — and at that point, that IS the right call to make, not a sign the sieve failed.
