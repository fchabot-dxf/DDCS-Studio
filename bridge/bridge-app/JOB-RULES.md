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

**A job may only be created when a gateway is running AND the CNC is powered.**

*(human, 2026-08-20: "if gateway is on but cnc off then it should be a no send policy".)*

⭐ **THE HEARTBEAT IS TWOFOLD**, and that is the whole mechanism — it answers both halves at once:

| the heartbeat says | from | if false |
|---|---|---|
| **a gateway is running** | freshness of `gateway/heartbeat.json` (written every 20s, stale at 60s) | no send |
| **the CNC is powered** | `controller_connected` — the gateway's own live disk probe | no send |

⇒ **Both true, or no send.** There is no "the job waits for the mill" state: waiting is exactly what this
policy refuses to create. **THE INBOX IS A WIRE, NOT A STORE.**

⚠ **AND A DROPPED STRAGGLER IS ACCEPTABLE** (human, explicit: *"i dont care if the file is dropped when the
cnc is off"*). The mill can still be switched off between a send and the next poll; the claim gate declines
to take it and it may be discarded. ⛔ Do NOT build machinery to rescue that case — it is a race, and the
human has ruled the outcome fine.

**THE POLICY APPLIES AT BOTH ENTRY POINTS, or it does not apply at all:**
- **Drive path** (phone / client) — the browser greys Send and refuses on click. `[SHIPPED]`
- **Local path** (`Ops.submit_job`) — refuse before `make_job_id`. `[RULED]` ⛔ **currently ungated**, so
  Studio on the gateway PC with the mill off still accepts a job that will never be claimed — the exact
  state this rule exists to prevent, arriving through the front door.

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

**`[DROPPED]`** ~~On startup, discard whatever is still undeliverable.~~ **NOT BUILT, DELIBERATELY.**
Two reasons, both from the human:
1. **Nothing ever auto-starts on a DDCS.** A delivered file waits on the controller's disk for an operator
   to select it, so a surviving job is delivered LATE, not dangerously. The original justification (stale
   G-code executing itself) was simply wrong.
2. **Section 5 makes the case nearly empty.** A job can only be created while a gateway is running, so to
   survive to a restart it must be sent while the gateway ran, then the mill switched off, then the gateway
   restarted before the mill came back - minutes, not days.
=> Discard logic plus per-job failure statuses would be machinery for a window that barely exists.
**PREVENTION AT SEND (section 5) REPLACES CLEANUP AT RESTART**, and is better for a reason worth keeping:
at send time the person is holding the phone and can act; at restart they walked away hours ago.
⛔ Do not reintroduce this without withdrawing section 5 first - they are alternatives, not partners.

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

**`[RULED]`** ⛔⛔ **A PHONE MAY NOT SEND WHEN NO GATEWAY IS RUNNING.** (human, 2026-08-20, explicit.)
Sending requires a **FRESH heartbeat** for that machine; anything else refuses, with the reason stated:

| heartbeat | meaning | send |
|---|---|---|
| **fresh** (<60s) | a gateway is alive and polling | **allowed** |
| stale | nobody is listening | refused - say when it last checked in |
| not visible | cannot see a gateway for this machine | refused - say exactly that |
| **unreadable** | cannot see Drive at all - we do not KNOW | **allowed, with a warning** (see below) |
| signed out | no Google account | disarmed, with its reason (unchanged, t2080) |

⭐⭐ **THIS IS THE STALE-G-CODE ARGUMENT APPLIED AT CREATION INSTEAD OF AT CLEANUP, and it is strictly
better.** §3 discards stale jobs because a Monday program reaching the controller on Thursday is a hazard;
this rule means such a job can never be CREATED. ⇒ the inbox only fills while something is there to drain
it, "waits indefinitely until you switch on" stops existing, and §3's restart-discard becomes a rare edge
rather than the normal path.

⭐⭐ **REFUSE ON A KNOWN ABSENCE, NEVER ON IGNORANCE.** This reuses the project's OWN existing doctrine
rather than inventing a second one - `controllerMatch.js`: *"UNKNOWN IS NOT A MISMATCH. If nothing
identified the controller we cannot claim it is wrong. Blocking on an absence would be a guess wearing a
safety hat."* Same shape here: a stale or missing heartbeat is EVIDENCE that nothing is listening; a failed
lookup is only evidence that we could not look.
⚠ **AND IT REMOVES THE ONE FATAL RISK IN THIS RULE.** The browser reading a DESKTOP-written heartbeat is
UNMEASURED (`driveJobs.js`'s header proved only the reverse direction). If that turns out not to work, a
refuse-on-everything rule would break sending entirely while blaming a gateway that is running fine.
Failing open on `unreadable` means the worst case is a warning, not a dead Send button.

⚠ **THE CAPABILITY THIS DELIBERATELY GIVES UP:** no "fire and forget from the couch" - you cannot queue a
job at home for a shop that is closed. Accepted knowingly, for the reason above.

⚠ **CURRENT BUILD DIFFERS AND MUST BE CHANGED.** t2080 shipped the opposite (a signed-in phone sends with
no gateway running anywhere - `client-send-2080.spec.js:39`, *"Send offers the DRIVE route instead of going
dead"*), and t2101 softened it only to a *warning* with a **Send anyway** button. ⇒ That confirm must become
a **refusal**, and the spec that asserts the old contract must be rewritten to the new one.
⚠ The advisor initially read this ruling as a factual claim about current behaviour and "corrected" the
human with spec evidence. It was a REQUIREMENT. Recorded so the next reader does not re-litigate it.

**`[SHIPPED]`** Without a Google account the button is disarmed **with its reason shown** - never silently
dead. That contract is unchanged and is the model the refusals above should follow.

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

---

## 6. DRIVE IS INBOUND-ONLY FOR A GATEWAY  `[RULED]`
*(human, 2026-08-20: "gateway should never send through drive". Reached by asking why the Drive toggle is a
toggle at all — "why turn it off?" — and finding that ON is a DOWNGRADE, not an addition.)*

**THE DEFECT.** `make_backend()` returns exactly ONE backend, and `ops.submit_job()` writes to it. So with
`backend = "drive"`, a job submitted **on the gateway PC itself** is uploaded to Google and polled back
down — internet dependency, quota, and a 15s floor for a job that never needed to leave the building.

⚠ **AND IT MAKES A PREFERENCE IN THE UI A LIE.** `send.js` reads as though it prefers the local path:
```js
if (this._gatewayReachable) { await ctx.client.submitJob(...) }   // "local"
else                        { submitJobToDrive(...) }             // fallback
```
But that local call hands the job to *the configured backend*, which is Drive. **There is no local-fast
path once the toggle is on** — the branch is real, the preference is not.

⭐ **THE RULE.** A gateway's `backend` is doing two unrelated jobs at once:

| | direction | must be |
|---|---|---|
| *where I put MY OWN jobs* | outbound | **ALWAYS LOCAL.** Never Drive. Never the internet. |
| *where I look for OTHER people's* | inbound | local **and/or** Drive — additive |

⇒ **Split them.** The gateway always has a local store for its own submissions; Drive becomes an
**additional inbound source**, polled alongside it. `_maybe_claim` then draws from both, FIFO by jobId
(the timestamp prefix already orders them globally, so no new ordering concept is needed).

⭐⭐ **WHY THIS IS THE RIGHT SHAPE, not just a faster one:** it deletes the question. "Send jobs through my
Drive" is a transport swap a user must reason about and can get wrong; **"let this machine receive jobs
from elsewhere"** is a capability that costs nothing to leave on. ⛔ A setting whose correct value depends
on where you happen to be standing is a setting that should not exist.

⚠ **NOT SMALL.** The Poller takes one backend and claims `ids[0]` from one inbox. This needs a composite
inbound source (or a poller that iterates sources), plus care that `delete_job` after delivery goes to the
source the job came FROM. ⛔ Do not start it inside another turn — it is its own slice.
⚠ **Until it lands, the toggle stays a genuine trade-off** and the current wording is honest: turning Drive
on really does route local sends through Google. Do not "simplify" the label before the behaviour changes.

---

## 7. SOUND ON A JOB — WHERE, NOT VOLUME  `[SHIPPED]` (t2125, SOUND-PLAN.md amendment 5)

**THE PRINCIPLE** *(human's own decisions, converging, now stated once)*: **sound where you are NOT
looking, visual where you ARE.** The 3D preview's end-of-loop beep became a visual glow pulse because you
are watching the preview when it fires. The job-event chime lives on the gateway because you are away from
the screen when a job actually lands. The client — where you ARE looking when you press Send — gets a
sound too, but only for the one moment that happens AT the click: the send itself.

**`[SHIPPED]`** The WHERE-split, exactly, no overlap and no dedupe rule needed:

| event | plays on | never on | why |
|---|---|---|---|
| `job.sent` | the CLIENT (the browser that pressed Send) | the gateway | marks the moment a job LEAVES this browser — a synthesized swoosh (`ui/sound.js`), not a learned sample |
| `job.arrived` / `job.delivered` / `job.failed` | the GATEWAY (`chime.py`) | the client | you're away from the screen; the door chime / register / buzzer are learned sounds a stranger can already read |

⭐ **A ONE-BOX SETUP (Studio + gateway on the same PC) NEEDS NO SUPPRESSION RULE.** An earlier draft of
SOUND-PLAN.md put `delivered`/`failed` on both sides, which would have fired twice from the same speakers
on localhost and needed an explicit dedupe to fix. Splitting by WHERE instead of by EVENT removes the
overlap by construction — there is nothing to suppress because there is nothing to collide.

⚠ **ACCEPTED CONSEQUENCE, named on purpose:** send a job from a phone and walk away, and you hear only the
swoosh. The job sounds are for whoever is AT THE MACHINE, not for the sender.

### The gap this leaves — client-side delivery confirmation  `[RULED]`, **NOT YET BUILT**

Today the client's last word on a sent job is the `Send` tab's toast (`Queued <jobId>`) plus the `info`
line — permanent, even though the job carries on to claimed → delivered/failed. *(human: "on the client we
can receive a visual confirmation the file was transferred correctly.")*

⭐ **THE MECHANISM ALREADY EXISTS — this is wiring, not a new gateway feature.** `poller.py` already calls
`put_status` at every stage transition, writing `claimed` / `delivering` / `delivered` / `failed` into
`status/<jobId>` (confirmed live by `bridge.py`'s own `self_test()`). The client side simply never reads
it: `driveJobs.js` has `submitJobToDrive`, `canSendViaDrive`, `readGatewayHeartbeat` — and no status reader
at all. ⛔ Do not invent a second gateway-side mechanism; add ONE new function mirroring
`readGatewayHeartbeat`, plus a small indicator under Send.

**The shape, once built:**
- Three advancing states — **sent → picked up → delivered**, with **failed** as the alternative terminal.
- ⛔ **THE HONESTY RULE (non-negotiable, same doctrine as §4/§5 above):** an unreadable status is
  IGNORANCE, not failure. Amber "cannot confirm" — **never** a green tick, **never** a red cross, on a
  failed lookup. Refuse on a known absence, never on ignorance.
- **Retry is mandatory, and two-part**: auto-poll with backoff (~3s → 6s → 12s → 24s, stopping the instant
  the state is terminal) **plus** a manual control for when auto-poll gives up or the job is still queued.
  ⚠ Polling MUST be bounded — `drive.py`'s own docstring already warns about hammering Drive's per-user
  quota; a client polling forever after the user walks away repeats that mistake.
- ⚠ **Label it "Check again", never "Retry".** It re-reads the status; it does not resend the job. "Retry"
  reads as "send it again", which on a mill is a dangerous misreading.
- ⭐ **Why this matters more than the usual amber case:** the client is often a phone on shop wifi, so a
  transient read failure is likely AND the job has almost certainly already succeeded — the state you most
  need to re-ask about is also the one most likely to be wrong on the first read.

⛔ **Deliberately deferred, not forgotten.** This is a distinct feature (client-side polling UI, a new
`driveJobs.js` function, Send-tab indicator state) from the sound work that surfaced it, and belongs in its
own turn rather than folded into a sound-system build. Recorded here — the declared one-source for job
lifecycle — rather than in SOUND-PLAN.md, per this file's own opening rule.
