---
name: northstar-principles
description: A distillation of the core principles and workflow ethics from the advisor/worker handoff. Use this skill to anchor your work in evidence, declarative design, durable trails, and principled execution, even when working outside of a strict duo loop.
---

# 🌟 Northstar Principles & Workflow Ethics

Working memory is volatile; momentum and context-compaction erode principles. This skill distills the core ethics of the advisor/worker workflow so they can be applied universally to any task. 

Whenever you are writing code, making decisions, or reviewing work, re-anchor yourself on these principles.

## 1. Evidence-first Execution (Verify, don't guess)
- **Ground Truth:** Always reconstruct context from the ground truth (`git diff`, `git log`, direct file inspection). Do not rely solely on summaries, which can drift.
- **Verify the REAL symptom:** When diagnosing a bug or verifying a fix, drive the actual gesture the way a user would, in the right surface. A green test that asserts the wrong thing is a failure mode. 
- **No Speculative Fixes:** Never dispatch a fix based on a guess. Gather the evidence first.

## 2. The Declare-or-Hand-roll Gate
Before building ANY feature or fix, run it through this gate: *Is this a one-off, or a reusable concept that should be DECLARED?*
- **Default to DECLARE:** A declaration is cheap, near-free data. The cost lives on the hand-roll side (maintenance, divergence, single-use logic).
- **A "bug" is often a missing declaration**, not a missing patch.
- Hand-roll only when it is genuinely below the project's abstraction floor or in a throwaway spike. 

## 3. Leave a Durable Trail
- **The "Why" Matters:** `git diff` records *what* changed; your job is to record the *why*.
- Log micro-decisions, what you tried and abandoned, and anything not visible in the code itself.
- If you don't write it to a durable log (like `WORK-LOG.md` or detailed commit messages), it dies at the end of the session.

## 4. Gate Irreversible Moves
- **Stop and Synthesize:** Before a big restructure, deletion, or contract change, stop and formulate a plan. 
- **Options over Guesses:** If you hit ambiguity, formulate closed options (A/B/C) and wait for a decision.
- **Synthesis:** The best answer is rarely just picking from a menu; it's often a composite ("go with A, but graft this one thing from B").

## 5. Hold the Line
- **No Shortcuts:** Never let momentum, a deadline, or a quick win justify a hand-rolled one-off where a declaration fits.
- **No Hacks:** Do not use host-private hacks where a shared `#core`/`#ui` module belongs.
- **Verify:** Don't rubber-stamp work. Read the diff and verify it yourself.

## 6. Keep the Process Tree Clean
- **Leave no trace:** Detached dev servers, watch-modes, and lingering tests pile up. Tidy up ephemeral processes when your task is done.
