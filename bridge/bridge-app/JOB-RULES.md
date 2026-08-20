# JOB RULES — what happens to a program between "Send" and the controller

**This is the ONE source for job-lifecycle behaviour.** Other documents should *reference* this file, never
restate it — a rule written down twice is a rule that will disagree with itself.

> ⚠⚠ **EVERY RULE BELOW IS TAGGED. READ THE TAG BEFORE YOU RELY ON IT.**
> **`[SHIPPED]`** — verified in code, works today.
> **`[RULED]`** — decided by the human, **NOT YET BUILT**. Do not assume the app behaves this way.
>
> This distinction is the whole point of the file. Roughly half of what follows is a decision, and treating
> a decision as a fact is how this project has repeatedly shipped on something that never ran.

---

## THE ONE-SENTENCE RULE

**A gateway never takes a job it cannot deliver, and a job that is discarded always says so.**

Everything below is that sentence applied to specific moments.

---

## 1. THE TWO AXES — the distinction everything else rests on

These are separate questions and must never be collapsed into one. Collapsing them is the mistake that
caused the claim-then-destroy defect.

| | asks | source | changes |
|---|---|---|---|
| **ROLE** | *is this PC set up as the gateway?* | configuration (`expert_dest`, `role_override`) | only when a human edits Setup |
| **STATUS** | *can it deliver right now?* | `ops.controller_reachable()` | constantly — power, cable, network |

**`[SHIPPED]`** Role is DERIVED, never asked: a controller disk is configured ⇒ gateway, otherwise ⇒ client.
`role_override` exists only for stale config and is empty by default (`config.effective_role`).

**`[SHIPPED]`** ⛔ **Unplugging the mill does NOT change the role.** `effective_role`'s own docstring: *"a
gateway with its controller unplugged is still a gateway; that is a STATUS question, a different axis."*
It must work this way — if unplugging demoted a PC to client, powering the mill down overnight would stop
that gateway claiming anything at all, and two PCs would hand ownership back and forth on power state.

**`[RULED]`** The UI states them **separately**: *"gateway — controller offline"*.
⛔ Never display "client" for an unplugged gateway — it reads as a demotion nobody asked for, and the
controller settings must not vanish at exactly the moment someone may want to check them.

---

## 2. THE LIFECYCLE

```
  SENDER                    THE INBOX                  THE GATEWAY              THE CONTROLLER
  ──────                    ─────────                  ───────────              ──────────────
  Studio (local gateway) ─┐
  phone / PC via Drive ───┴──►  <machine>/inbox/  ──►  _maybe_claim()  ──────►  <expert_dest>/
                                 the job waits here      role == gateway?         the .nc lands
                                 ⭐ THIS IS THE QUEUE.    disk configured?
                                 There is no other.      REACHABLE?  [RULED]
                                                              │
                                                    no ───────┘
                                                    leave it in the inbox.
                                                    NOT claimed, NOT deleted.
```

**`[SHIPPED]`** The gateway claims `ids[0]` — the jobId's timestamp prefix **is** the FIFO order. It takes
one job at a time and works the inbox off across successive ticks.

**`[RULED]`** ⭐⭐ **THE INBOX IS THE QUEUE. THERE IS NOTHING TO BUILD.** "Not claiming" already means
"waiting". ⛔ No retry counter, no ceiling, no backoff, no persisted retry state — that machinery was
proposed (BACKLOG #9) and is explicitly **not wanted**; this rule supersedes its implementation half.

### The claim gate — three checks, in order

1. **`[SHIPPED]`** role is `gateway` (`poller.py`) — the claim gate is authoritative, never the UI. *A role
   that hides tabs while the poller still claims is worse than no role at all.*
2. **`[SHIPPED]`** `expert_dest` is configured — *"no controller configured yet — leave jobs queued"*.
3. **`[RULED]`** `controller_reachable()` — **the mill is actually there.** ⛔ **Currently missing**, and its
   absence is the defect: with the mill off, the job is claimed, `transfer.deliver` raises `OSError`, and
   `poller.py` calls `delete_job`. **The job is destroyed because a machine was switched off.**

---

## 3. RESTART AND SHUTDOWN — the queue is SESSION-SCOPED

**`[RULED]`** **A job survives while its gateway runs. It does not survive that gateway restarting.**
One sentence, statable to a user, and it is the rule the rest of this section implements.

**`[SHIPPED]`** A restart needs no special code to deliver: the poller simply starts ticking and drains the
inbox. There is no "resume" logic and none is needed.

**`[RULED]`** On startup: **poll once, deliver everything the mill can take, then discard whatever is still
undeliverable** — and write each discarded job a status (`failed`, reason *"the gateway restarted before
this could be delivered"*) so the sender finds out.

⭐ **WHY DISCARD AT ALL — and the reason is safety, not tidiness.** A job sent Monday to a mill that is off,
surviving a restart, and landing on the controller's disk on Thursday is **a program the operator does not
remember sending**, quite possibly for a setup that has since been torn down. **Stale G-code is a hazard in
a way a stale email is not.** That, not [[nothing-is-precious-delete-freely]], is the justification.

⛔ **DO NOT discard unconditionally on restart.** With the mill ON at startup those jobs are perfectly
deliverable, and binning them would mean a 3am Windows update destroys work that would have gone through at
3:01. Deliver first; discard only what remains stuck.

**`[RULED]`** On shutdown, if the inbox is not empty, **say so**: *"3 jobs are waiting and nothing will
deliver them while this is closed."* It is the one moment the person can still act.

**`[SHIPPED]`** Scope is per machine, not global: after S4 each mill has its own
`DDCS Bridge/<machine name>/inbox`, so restarting CNC-FAIRY touches Ultimate Bee's queue and not the V4.1's.

---

## 4. WHAT THE SENDER IS TOLD — the honesty rules

⛔ **Never report a state you have not checked, and never promise a time you cannot keep.**

| situation | what the sender must be told | tag |
|---|---|---|
| gateway reachable, controller matches | queued / tracked, as today | `[SHIPPED]` |
| **wrong controller** on the other end | **HARD BLOCK** — one statement, one button (`Cancel`). No override, no "send anyway": a push is a write to a physical machine (t1229 A2) | `[SHIPPED]` local · `[SHIPPED]` Drive |
| controller **unidentified** | not a mismatch. *"If the gateway cannot say what it is, we cannot claim it is wrong."* Blocking on an absence is a guess wearing a safety hat | `[SHIPPED]` |
| no gateway visible on Drive | *"Studio cannot see a gateway for this machine"* — ⛔ **never "no gateway has ever run"**: `drive.file` scoping makes an invisible folder and an absent one identical from the browser, so the second sentence is a guess stated as a fact | `[SHIPPED]` |
| gateway **stale** (>60s since heartbeat) | say when it last checked in, and that the job will wait | `[SHIPPED]` |
| gateway up, **mill off** | *"the gateway is running but the mill is off — this will wait"* ⛔ **NOT** "picks it up within ~15s" | `[RULED]` — gap in the current build |
| discarded on restart | a `failed` status carrying the reason | `[RULED]` |

**`[SHIPPED]`** Freshness is judged from Drive's server-side `modifiedTime`, **never** the heartbeat's own
`last_seen` — that field is the gateway's clock compared against the reader's, and a few minutes of skew
makes a live gateway look dead. `last_seen` is for display only.

---

## 5. THE DRIVE PATH — a phone with no gateway anywhere

**`[SHIPPED]`** A signed-in phone sends with **no gateway running at all** (t2080): it writes straight into
`DDCS Bridge/<machine name>/inbox/`, and whichever gateway serves that mill picks it up when it next runs.
Without a Google account the button is disarmed **with its reason shown** — never silently dead.

**`[SHIPPED]`** ⛔ The browser **refuses to send when the workspace has no machine name** rather than falling
back to a flat `DDCS Bridge/inbox/`. That fallback is the entire hazard S4 removes: `_maybe_claim` takes
`ids[0]` with no notion of which machine a job is *for*, so a shared inbox can deliver an Expert program to
a V4.1.

⚠ **THE JOIN IS BY CONVENTION AND IS NOT ENFORCED.** The browser writes under the **workspace name**; the
gateway polls under **`cfg.machine_name`**, typed into Setup. Both mean *the CNC machine* — but they are two
separately-typed strings, and Drive creates a missing folder on write. ⇒ `"Ultimate Bee"` vs
`"ultimate bee"` produces **two folders, no error, and a job nothing will ever collect.**
**`[RULED]`** Studio warns about the mismatch in Setup, where both values are in hand and it is fixable.
⛔ Do not "fix" this by normalising case or slugging: that is one transform implemented twice that must
agree byte-for-byte forever.

---

## 6. WHAT IS DELIBERATELY NOT BUILT

⛔ Retry queues, attempt counters, ceilings, backoff, retry state surviving a restart.
⛔ Job expiry / age-based cleanup (a waiting job is one small file in the user's own Drive).
⛔ Any policy that makes a **restart** an event needing special handling beyond §3.
⛔ Live position (DRO) over the cloud — deferred; Drive carries **job state** only, never a 2s cadence.

---

## PROVENANCE
Rules here were settled 2026-08-19/20 across the advisor/worker loop. The reasoning — including an advisor
objection that turned out to be **backwards** (arguing jobs would "pile up unclaimed" as a drawback, when
the status quo destroys them outright) — is recorded in `NEXT-SESSION.md` under the claim-gate ruling.
⭐ That wrong turn is kept on purpose: it is why §1's two axes are stated so emphatically.
