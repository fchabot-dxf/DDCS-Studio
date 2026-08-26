# CLAUDE.md — read this first, on every seat

⭐ **This file exists to DELIVER things.** A fact in the repo that nobody opens is worse than a memory that
surfaces on its own — repo documents have no delivery mechanism, and this is the one file every seat loads
automatically. So it stays **thin**: pointers, plus the few things that must be read every single time.

## THE CONTEXT FILES — the operating context, shared by every seat

| file | answers |
|---|---|
| ⭐ [`context/SEATS.md`](context/SEATS.md) | **who reaches which controller, from where** — and the VS Code setup |
| [`context/SETUP.md`](context/SETUP.md) | the studio, and home. what is wired to what. ⛔ the safety rules |
| [`context/CHANNELS.md`](context/CHANNELS.md) | the vendor and the community — what is pending with each |

⛔ **These are NOT project documentation.** They are the *operating context* — where the work happens, on what
hardware, with whom. The project itself is documented in `ROADMAP.md`, `ARCHITECTURE.md`, `BACKLOG.md`, and
`bridge/controllers/*/FINDINGS.md`.

## ⛔ THE THREE THAT MUST BE READ EVERY TIME

1. **TWO CONTROLLERS, and they behave differently** — the **DDCS V4.1** (bench, at home, motorless) and the
   **DDCS Expert / M350** (the studio, real). ⛔ Never carry a finding from one to the other without checking
   [`bridge/controllers/README.md`](bridge/controllers/README.md).
2. ⛔ **No write operations to a live controller when the owner is not at it.** ⚠ And whether they are at it
   **cannot be inferred** from which seat is talking — they are on a phone, in every conversation at once. Ask.
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
