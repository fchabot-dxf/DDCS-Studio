# CLAUDE.md

**Read [`AGENTS.md`](AGENTS.md) first.** It is the canonical entry point for this repo.

Critical reminder, repeated here because it is the easiest mistake to make:

> This repo covers **two different controllers** — the **DDCS V4.1** (bench sandbox @ `10.0.0.50`)
> and the **DDCS Expert / M350** (the real target). **They behave differently.** Never apply a
> finding from one to the other without checking [`controllers/README.md`](controllers/README.md).

Record new findings under the correct controller's `FINDINGS.md` with a confidence tag
(`[CONFIRMED]` / `[TO TEST]` / `[HYPOTHESIS]`).

For DDCS G-code / macro questions, consult the installed **`ddcs-expert`** skill (reference only).


---

## ⭐ HANDOFF FROM THE STUDIO SEAT — 2026-08-25

Three documents landed on the branch from the Studio-side machine. They do not announce themselves, so they
are listed here, in the file this seat loads automatically:

| file | what it is |
|---|---|
| [`HANDOFF-TO-FAIRY.md`](HANDOFF-TO-FAIRY.md) | **Start here.** Orientation: what only this machine can do, the machine-switch mechanics, and the live-CNC safety rule that outranks every task. |
| [`TRANSPORT.md`](TRANSPORT.md) | The spec. Fully ruled — five open questions went to the owner and all five came back answered. **Not built.** |
| [`FAIRY-MEMORY-DUMP-INSTRUCTION.md`](FAIRY-MEMORY-DUMP-INSTRUCTION.md) | Dump this seat's memory store so the two can be compared. **Contradictions between the seats are the point** — nothing else detects them. |
| [`HANDOFF-FROM-FAIRY.md`](HANDOFF-FROM-FAIRY.md) | The return channel, and the git discipline for two machines on one repo. |

⚠ **One Studio turn is BLOCKED on this seat**: the safe comment-character list, derived from real dumps rather
than reasoning. See `HANDOFF-FROM-FAIRY.md` §1.

⭐ **And note where cross-seat facts should end up.** This file already names the right home —
`controllers/<name>/FINDINGS.md`, tagged `[CONFIRMED]` / `[TO TEST]` / `[HYPOTHESIS]`. That convention is
better than the Studio side's own memory store for anything hardware-shaped, because it lives in the repo, it
travels to every seat, and it records confidence rather than asserting flatly. **Prefer it over a memory for
any fact about a controller.**
