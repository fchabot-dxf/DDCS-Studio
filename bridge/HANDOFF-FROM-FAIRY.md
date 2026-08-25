# HANDOFF ← FAIRY (returning work to the Studio-side seat)

**The return channel.** `HANDOFF-TO-FAIRY.md` sends work to the gateway machine; this is how it comes back.

⚠ **Why a file and not a message:** the two machines share a repo but **not** a loop. `.handoff/` and its
epoch are per-machine, so there is no turn marker connecting them and no notification when one side finishes.
**The branch is the only channel.** A finding that exists only in Fairy's session transcript does not exist.

---

## 0. ⛔ GIT DISCIPLINE — two machines, one repo

- **`git pull --rebase` before you commit.** The Studio side commits frequently, sometimes several times an
  hour, and it releases from `main`.
- ⛔ **Never force-push.** A second agent also works in this repo. A force-push over someone's work is the one
  mistake here that cannot be undone by pulling.
- ⛔ **No `git stash`.** The stash stack is GLOBAL and shared — there are already orphaned entries on it from
  two different seats. Use `git checkout <ref> -- <paths>` or a scratch clone to compare against another
  revision.
- **Stay in your own files.** Gateway work lives under `bridge/`. If a change genuinely needs a Studio-side
  file (`DDCS-Studio/web/…`), say so in §2 below rather than making it — the Studio seat is usually mid-turn on
  those and a surprise edit lands as a conflict in someone's release.

---

## 1. ⭐ WHAT THE STUDIO SIDE IS ACTUALLY WAITING FOR

**This one is BLOCKING** — a queued Studio turn cannot be built without it:

> **The safe comment-character list, derived from the real dumps.** Studio is adding a setting that replaces an
> illegal character in a G-code comment, with a user-chosen replacement. The candidate list must come from
> characters that DEMONSTRABLY appear inside comments in working factory programs — not from reasoning, and not
> from the advisor, who explicitly ruled himself out as a source.
>
> - `(` and `)` are structurally illegal (they delimit). `%` and `/` are risky at line start. That is the
>   extent of what was known without the machine.
> - ⚠ Square brackets are POOR candidates and this is already established: DDCS uses `[ ]` for EXPRESSIONS and
>   nests them (`#70=[805+[#72*5]]`), so a note reading `see fixture [B]` would look like a computed address to
>   whoever is reading the file at the controller. Legal but misleading is its own kind of unsafe.
> - **Report the list WITH its evidence** — which characters, seen where, in which dumps. A vetted list whose
>   vetting nobody can check is a longer guess.
> - ⚠ **And say whether it differs per dialect.** Expert, V4.1, V3/DM500, centroid and grbl are not one machine,
>   and grbl ignores parenthesised comments entirely.

**Also useful, not blocking:** whether the bracket-for-expressions / parens-for-comments split holds on the
other controllers, and anything the real machine says that contradicts a Studio-side assumption. **The standing
rule is that the dumps outrank the wizard code**, because code encodes what somebody believed and dumps encode
what the machine accepted.

---

## 2. WHAT TO WRITE WHEN HANDING BACK

Keep it short. Four headings, and the third is the one that gets skipped and shouldn't be:

1. **BUILT** — what shipped, with commit hashes. Anything that changes the gateway's behaviour toward a client
   belongs here, because the Studio side renders that behaviour.
2. **MEASURED** — facts established from the real hardware, with how they were established. These are worth
   more than the builds: the Studio seat cannot produce them at all.
3. ⚠ **WHAT I GOT WRONG, OR COULD NOT VERIFY** — premises that turned out false, and anything left unproven and
   named as such. On the Studio side this section has repeatedly been the most valuable part of a hand-back;
   four advisor premises were wrong in one session and every one was caught this way.
4. **STILL OPEN** — with a runnable check where possible, so the next reader can decide it in one command
   instead of re-deriving it.

⛔ **Do not report a green test as proof for anything hardware-shaped.** This project has twice closed a bug by
adding a regression test that passed while the owner was still looking at the defect. On Fairy that risk is
worse, not better: a test that passes on a bench is not a test that passes on a machine with a tool in the
spindle.

---

## 3. IF YOU CHANGED SOMETHING THE STUDIO SIDE RENDERS

The client draws the gateway's state — status, transport, job list, the disk index. If any of those payloads
change shape:

- **Say the OLD shape and the NEW one.** The client has to keep reading a gateway that has not been updated
  yet, and both ends ship independently.
- ⚠ **The heartbeat already carries `backend`**, and the client is supposed to use it to say *which road* a
  gateway is on. If you change what that field can contain, the client's wording depends on it.
- ⚠ **A job's origin is being added to `<job_id>.map.json`** per TRANSPORT.md §4. If the client should read it,
  say so — otherwise it will not know it exists.
