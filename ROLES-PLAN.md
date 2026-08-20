# PLAN — PC ROLES: gateway vs client

**Raised by the human 2026-08-19**, while the Drive send path was being proven:
> *"we also need to consider we're about to build a role system for pc machines, gateway vs client"*
> *"two gateways are never going to be for two separate controllers. Just that two PCs can be hooked to the
> same controller one after the other and never simultaneously."*
> *"any workspace can only have one controller. That's by design."*
> *"one aspect of roles is that the client has much fewer tabs and settings in the gateway tab."*

---

## THE MODEL, as the human stated it

```
  WORKSPACE ─── exactly ONE controller (by design, already true)
      │
      ├── GATEWAY PC   the one physically wired to that controller.
      │                Claims jobs and delivers them. One at a time; a second PC may take
      │                the role later, never simultaneously.
      │
      └── CLIENT PCs   everything else. Author and submit. NEVER claim.
```

### ⚠ "CLIENT" DOES NOT MEAN "NO GATEWAY PROCESS" (human, 2026-08-19: *"client also still are technically gateways"*)
**Every exe runs the gateway daemon** — it serves Studio's own UI on localhost and answers `/api/*` whether or
not a controller is attached. So a client is **a gateway with no controller**, never a different program.
⛔ **Do NOT implement the client role by not starting the daemon.** That would take the UI down with it.
The role governs whether the poller CLAIMS and whether controller-wiring settings are shown — nothing else.

**Consequence, and it corrects an under-statement in t2080:** a job reaches Drive by two different routes
depending on whether a LOCAL daemon exists, and both are correct:

| device | local gateway? | route to the Drive inbox |
|---|---|---|
| phone / browser, no exe | no | `driveJobs.js` writes the inbox directly (built t2080) |
| a PC running the exe, client role | **yes** | `submitJob` → its OWN local daemon → `backend=drive` → Drive |

⇒ t2080b's "Send is dead with no gateway" only ever applied to the browser-without-exe case. On a client PC
running the exe the button was never dead — its own daemon answers. ⚠ A client-role exe still TICKS its
poller, which is exactly why S0's claim gate must live in `_maybe_claim()` and not in the UI.

⭐ **THIS IS MOSTLY NAMING WHAT IS ALREADY TRUE, not new machinery.** `poller._maybe_claim()` already
returns immediately when `cfg.expert_dest` is empty — *"no controller configured yet — leave jobs queued"*.
So an unconfigured PC is ALREADY a client mechanically. What is missing is that the role is implicit,
unnamed, unchosen and invisible, so nothing prevents a client from being configured into claiming and
nothing adapts the UI to it.

### A hazard I raised and then RETRACTED — recorded so it is not re-raised
I warned that two gateways sharing one Drive inbox could deliver a job to the WRONG controller (CNC-FAIRY
→ Expert, ASUS → the V4.1 bench share it still points at). **The human's design rules that out:** one
controller per workspace, so every job in a workspace's inbox has exactly one valid destination. Two
gateways for the SAME controller both deliver to the same place, and the first claimer deletes the job from
the inbox (`delete_job` after delivery), so the second finds nothing — **the race is benign**. The hazard
existed only in ASUS's stale bench config, not in the design. ⚠ Still worth clearing that stale `dest` when
ASUS becomes a client, but it is hygiene, not a safety fix.

---

## WHAT THE ROLE ACTUALLY CHANGES

### 1. The Gateway tab, which is mostly meaningless on a client
Today `gatewayPanel.js` registers SEVEN views unconditionally:

```js
const VIEWS = [statusView, sendView, mergeView, trackerView, filesView, jobsView, consoleView];
```

Sorted by whether they mean anything with no controller attached:

| view | client? | why |
|---|---|---|
| **send** | ✅ KEEP | the client's whole purpose — author, submit |
| **jobs** | ✅ KEEP | queue + history are shared state, readable from anywhere |
| **status** | ⚠ REFRAME | today it reports THIS PC's controller link. On a client it should report the WORKSPACE's gateway (is one alive, is it reachable) — a different question, not a hidden tab |
| **tracker** | ⚠ REFRAME or hide | live progress comes off the gateway's serial cable; a client can only mirror what the gateway published |
| **files** (CNCDISK) | ⚠ **POSSIBLE, NOT WIRED** | ⭐ **CORRECTED TWICE — read this whole cell before acting.** First I said HIDE ("no path to the disk"); then, told the disk should be remotely manageable, I said KEEP because the gateway publishes an index and a delete-command channel exists. Both were too fast. **Traced: the producer exists, the consumer is a DIFFERENT APP.** `put_cncdisk_index` is implemented (incl. `DriveBackend`) and the gateway polls `list_commands`, but Studio's Files view calls `ctx.client.listFiles()` → **`/api/files`, the GATEWAY's own HTTP API** — which simply fails with no gateway. The ONLY consumer of the published index is `bridge/bridge-app/web/functions/api/[[path]].js`, the retired Phase-3 R2 console. ⇒ On a client today the tab is DEAD; making it work is a small, real piece of wiring, not a hide/show decision. |
| **merge** | ⚠ VERIFY, do not assume | I claimed it "operates on controller-side files" without checking — after being wrong twice tonight (see above and the `drive.file` scope), that claim is unverified and must be read from the code before it is acted on. |
| **console** (admin/Setup) | ⚠ REDUCE, never hide | the client still needs Setup — but only the parts that apply |

### 2. Setup, which is mostly controller configuration
`views/admin.js` currently shows, to everyone: machine name · **controller disk** · **beacons (Modbus)** ·
LAN serving · **serve port** · cloud storage + account · controller profile.

A client needs: **machine name**, **cloud storage / account**, and the service (daemon URL) row.
A client does NOT need: controller disk, beacons, the controller profile block — all of which describe a
controller it is not attached to. ⚠ *Reduce, do not hide the tab*: Setup is where the role itself is chosen.

### 2a. ⚠ A PATTERN IN MY OWN ERRORS, worth stating because it shaped this plan
Three times in one session I asserted a CAPABILITY LIMIT without testing it, and was wrong each time:
`drive.file` visibility (per project, not per client), release-note screenshots (versioned, so staleness is
fine), and CNCDISK on a client (already publishable + commandable). Each time the human's plainer model was
the correct one. ⇒ **Before this plan hides ANY tab, read the code for that tab.** "It needs the controller"
has been wrong more often than right — the gateway already publishes most of what a client would want.

### 2a-ii. ⭐ THE SEAM THIS KEEPS EXPOSING — the actual shape of the roles work
Three features tonight have the SAME defect, and it is not a UI defect:

| feature | gateway-mediated path (exists) | backend-mediated path (a client needs) |
|---|---|---|
| send a job | `POST /api/jobs` | ✅ BUILT t2080 (`driveJobs.js` writes the inbox) |
| browse CNCDISK | `GET /api/files` | ❌ missing (the gateway publishes an index nothing reads) |
| delete a file | `POST /api/files/delete` | ❌ missing (the command channel exists, unused by Studio) |

⇒ **A CLIENT IS NOT "STUDIO WITH TABS HIDDEN". It is Studio talking to the BACKEND instead of to a local
gateway.** Every capability already has, or needs, a backend-mediated twin; the gateway publishes most of
the data already. Framing roles as tab-hiding would ship a crippled client and leave the real work undone.

### 2b. ⭐ EVIDENCE THE ROLE IS MISSING, not a nice-to-have (t2080b, live from the human's phone)
> *"On my phone, I'm connected, and the send button doesn't do anything. Not even fail or success. Just silence."*

`t1327` DISARMS Send whenever no gateway answers, and greys it with a reason. That rule is **correct for a
gateway machine and wrong for a client** — but the code cannot tell them apart, so it applied the gateway
rule to a phone and killed the button on the exact device the Drive path was built for. The banner
underneath said *"sending needs a machine"*, which had silently become false.

The fix shipped as a `viaDrive` special-case bolted onto the disarm rule — **a patch standing in for the
missing concept.** With roles it is not a special case at all: a CLIENT expects no gateway, so there is no
"unreachable" state to disarm on. ⇒ **Roles would have PREVENTED this, not merely tidied it.** Every question
tonight — which tabs, which settings, may the poller claim, which Drive folder — is *"what kind of machine is
this?"* asked in four ad-hoc ways.

### 3. Where the role is DECIDED — the one real design question
Two candidates, and this wants the human's ruling before code:
- **(a) DERIVED from the controller disk** — non-empty = gateway, empty = client. Zero new state, matches
  what the poller already does, impossible to contradict itself. But it is implicit: a user who clears the
  field to "tidy up" silently changes role.
- **(b) DECLARED — an explicit Role selector in Setup**, defaulting to derived. Visible, self-documenting,
  and lets the UI adapt before a controller is ever configured. Costs one persisted field.

⇒ **Recommend (b) with (a) as the default** — declare it, seed it from the existing signal, and never let the
two disagree silently: if the role says client but a controller disk is set, say so rather than picking one.

---

## CONSTRAINTS / TRAPS

- ⛔ **The client must never claim.** Whatever the UI does, `_maybe_claim` must stay gated. A role that only
  hides tabs while the poller still claims is worse than no role at all.
- ⚠ **One workspace = one controller is already true; do not re-model it.** The role attaches to the PC, not
  to the workspace.
- ⚠ **`machine_id` is empty on the human's machines, so `identity.verify()` is inert** (it returns ok when no
  id is configured). That guard is orthogonal to roles but worth turning on while here — it is the only thing
  that would refuse a delivery to an unexpected controller.
- ⚠ **Do not gate on "is a gateway reachable"** — that is a connection state (`ddcs:gateway-status`), not a
  role. A gateway with its controller unplugged is still a gateway.

## GATE
`gatewayPanel.js` view registration, `views/admin.js` Setup fields, and the poller's claim gate. Existing
specs that touch these: `gateway-state-contract-1327` (every data tab clear when unreachable — a role must
not confuse that contract), `gateway-quiet-offline-1307`, `header-account-2077`.

---

## ⚠ MULTI-CONTROLLER — THE HAZARD RETURNS (human, 2026-08-19: "we need to make this work for 4.1 too")

**I retracted the wrong-controller hazard above on the strength of "two gateways are never for two separate
controllers." Wanting the V4.1 on this path RESTORES it, so the retraction is itself hereby narrowed:** it
holds for one controller, and fails the moment a second gateway joins the same Google account.

```
  Expert  @ the studio  ── gateway on CNC-FAIRY  ─┐
                                                  ├─► ONE Drive folder: DDCS Bridge/inbox/
  V4.1    @ home        ── gateway on RENDERRANCHY┘
```
`poller._maybe_claim()` claims `ids[0]` from the shared inbox with no notion of which machine a job is FOR,
and `identity.verify()` is inert while `machine_id` is unset (it returns ok when no id is configured — and
both of the human's machines have it empty). ⇒ **A program authored for the Expert can be delivered to the
V4.1** — a different envelope AND a different dialect. This is the one genuinely unsafe combination in the
whole Drive design.

⛔ **Until this is built: do not run Drive mode on a second gateway.** One gateway on Drive is safe.

### The fix, and most of it already exists
- **The gateway's folder is ALREADY per-config**: `config.drive_folder` (default `"DDCS Bridge"`),
  read by `DriveBackend.__init__`. Two gateways pointed at two folders already cannot see each other's jobs.
- **The browser client HARDCODES it**: `driveJobs.js` `ROOT_NAME = 'DDCS Bridge'`. This is the only place
  that must change to make targeting possible.
- **The naming is decided by the human's own rule** — *"any workspace can only have one controller"* — so the
  WORKSPACE (its machine name) names the folder. No new concept: `cfg.machine_name` already exists and the
  Setup UI already collects it.

### What that makes the client's job
A client must SEND TO A MACHINE, not merely "to Drive": pick the target workspace/machine, write into that
machine's inbox. With one machine configured it should stay invisible (pick it automatically); the choice
only has to surface once a second exists.

⚠ **Turn `machine_id` on while doing this.** Namespacing prevents the mix-up by construction; the identity
check is the belt-and-braces that REFUSES a delivery if a job ever reaches the wrong gateway anyway. Both,
not either — the folder is a convention, the identity file is a verification.

⚠ **Beacons are NOT the V4.1 blocker people will assume.** V4.1 has no Modbus RTU, so tracked sends already
degrade honestly to "delivered" (t2020, `poller._claim`'s `enable_slave` branch) — and a Drive send is
deliver-only by construction anyway. Delivery itself is controller-agnostic: `transfer.deliver()` writes
bytes to `<expert_dest>/<name>` and cares about nothing else. **The V4.1 works on this path today; it is the
SECOND GATEWAY that is the problem, not the V4.1.**

---

## ⭐⭐ THE TWO GATING AXES — the human's own framing, and the design conclusion
> *"the client is really hiding the settings that help connect the gateway to the controller"*
> *"if we gate settings by roles we should also gate settings by status of gateway being online"*

**The crisp definition of a client, in the human's words:** it is not "fewer tabs" — it is **no
gateway↔controller wiring configuration**. Controller disk, beacons/COM, controller profile: all describe a
cable this machine does not have. Everything else stays.

**And gating has TWO ORTHOGONAL AXES. Conflating them is the bug already paid for once:**

| axis | question | governs | lifetime |
|---|---|---|---|
| **ROLE** | *what kind of machine is this?* | what EXISTS (settings, tabs) | permanent, declared |
| **STATUS** | *is the gateway reachable right now?* | what is AVAILABLE (actions) | momentary, observed |

⚠ **t1327 implemented ONLY the status axis and then used it to answer a ROLE question** — "no gateway
answering ⇒ you cannot send". True for a gateway machine, false for a client, and that single conflation is
what left a phone with a dead Send button and no error (t2080b).

### The composed matrix — each cell has a DIFFERENT right answer
|  | gateway ONLINE | gateway OFFLINE |
|---|---|---|
| **GATEWAY role** | everything live | ⚠ controller settings STAY VISIBLE — they are how the user FIXES it; sending/browsing disarmed with the reason (today's t1327 behaviour, correct here) |
| **CLIENT role** | everything live except controller wiring | ⭐ **SEND STILL WORKS** — it queues in Drive and the gateway claims it whenever it wakes; live status/tracking honestly unavailable |

⭐ **THE PROPERTY THIS UNCOVERS, worth building deliberately rather than stumbling into:** a client's send is
**asynchronous and offline-tolerant BY CONSTRUCTION** — the job sits in the inbox until a gateway appears.
The machine does not have to be on, or even in the same country. The current UI actively HIDES this by
greying Send whenever the gateway is unreachable; the correct client-side message is *"queued — the machine
picks it up when it next runs"*, not *"sending needs a machine"*.

⛔ **Do not collapse the axes into one enum** ("online-gateway / offline-gateway / client"). They vary
independently and at different rates — role changes when a PC is re-purposed, status changes every poll. One
enum would have to be recomputed on every heartbeat and would silently re-introduce exactly the conflation
above.

---

# THE BUILD PLAN — slices in dependency order

**Sequenced so each slice ships something usable and provable on its own, and so the two mistakes this
session already paid for cannot recur:** (a) do not hide a tab without reading its code — "it needs the
controller" has been wrong more often than right; (b) do not answer a ROLE question with a STATUS signal.

**✅ RULED (human, 2026-08-19): THE ROLE IS AUTOMATIC.** *"cant the roles be automatically given"* — yes, and
it is the better answer: nobody should have to think about roles. **The rule:** a controller disk is
configured ⇒ GATEWAY; none ⇒ CLIENT. A phone or a fresh browser has no config at all and is therefore
correctly a client with zero user input.

⚠ **It gets exactly ONE case wrong, and it is live right now:** a machine carrying STALE controller config
(ASUS still holds `\10.0.0.50\cncdisk` from bench work) is auto-classified a GATEWAY and will claim jobs.
Stale config is indistinguishable from intent. ⇒ **State the derivation and allow an override** — not a
selector the user must answer, but a visible line (*"Gateway — because a controller disk is configured"*)
with a way to say otherwise. Automatic by default, correctable when the guess is wrong.

⛔ **DERIVE FROM CONFIGURATION ONLY, NEVER FROM REACHABILITY.** "Is the controller responding" is the STATUS
axis; using it to pick a role re-introduces the exact conflation that killed the phone's Send button. A
gateway with its controller unplugged is still a gateway.

---

## ⭐ S4 RUNS FIRST — the human is about to test the V4.1 (2026-08-19)
*"i will be testing the 4.1 yes"* ⇒ a SECOND gateway is imminent, which is the one genuinely unsafe
combination in this design (see S4). It is the only slice with a safety edge; the rest are quality-of-life.
**Do S4 before S0-S3, or run the V4.1 with Drive mode OFF until it lands.**

## S0 — THE ROLE EXISTS, AUTOMATICALLY  *(small; almost nothing user-visible)*
**Build:** derive the role from configuration (`expert_dest` non-empty ⇒ gateway), expose it to the UI the
way connection state already is, and persist an OPTIONAL override for the stale-config case above. No
mandatory selector — a stated derivation plus a way to correct it.
**⛔ The claim gate stays authoritative:** `poller._maybe_claim()` must ALSO refuse when role is client —
never rely on the UI. A role that hides tabs while the poller still claims is worse than no role.
**⚠ Surface disagreement, never resolve it silently:** role=client WITH a controller disk set is a
misconfiguration the user should see stated, not have quietly picked for them.
**Gate:** a client never claims (drive a real inbox with a client-role poller and assert it stays queued);
the derived default reproduces today's behaviour for every existing install.

## S1 — GATE THE SETTINGS BY ROLE  *(the human's own definition of the feature)*
> *"the client is really hiding the settings that help connect the gateway to the controller"*

**Hide on a client** (`views/admin.js`): controller disk · beacons (Modbus) · the controller-profile block.
COM port too if exposed. **Keep:** machine name · cloud storage + account · daemon URL · serve port.
**⚠ REDUCE, never hide, the Setup tab itself** — it is where the role is chosen.
**Gate:** the client Setup renders with no controller-wiring field present (not merely disabled); the
gateway Setup is byte-for-byte what it is today.

## S2 — COMPOSE THE TWO AXES  *(the correctness slice; this is the bug already paid for)*
Implement the matrix above: ROLE decides what EXISTS, STATUS decides what is AVAILABLE.
- **Client + gateway offline ⇒ Send STAYS ARMED.** The job queues in Drive and is claimed whenever the
  gateway wakes. Message: *"queued — the machine picks it up when it next runs"*, never *"sending needs a
  machine"*.
- **Gateway + controller offline ⇒ controller settings STAY VISIBLE** (they are how the user fixes it) while
  send/browse disarm with the reason — today's t1327 behaviour, which is correct for this cell only.
- **Retire the t2080b special case**: `viaDrive` in `send.js` is a patch standing in for the missing role and
  should dissolve into it.
⛔ **Do not collapse the axes into one enum.** They vary independently and at different rates.
**Gate:** `gateway-state-contract-1327` must still pass unchanged for the GATEWAY role (it is the contract
for that cell); `client-send-2080` covers the client cell.

## S3 — THE BACKEND-MEDIATED FILE VIEW  *(makes the client genuinely useful)*
The real shape of a client: **Studio talking to the BACKEND instead of a local gateway.** The gateway is
already publishing more than Studio consumes.
- **Browse** — read the published `cncdisk/index.json` instead of `GET /api/files`. 🟢 producer already
  exists (incl. `DriveBackend`); the only consumer today is the retired Phase-3 R2 console.
- **Delete** — write a command instead of `POST /api/files/delete`. 🟢 the gateway already polls
  `list_commands`, executes, and clears.
- ⚠ **Say it is a SNAPSHOT** (~15s, `updated_at` is in the index) — a file deleted at the machine lingers in
  the view until the next publish. An honest staleness label, not a pretence of live.
- ⛔ **`SAFE_OPS = {"delete"}` STAYS.** A remote client must never be able to RUN anything. Roles must not
  widen this line.
- 🔴 **Reading file CONTENTS is NOT in this slice** — `build_index` publishes a listing only. A
  request/response channel (client asks, gateway uploads that one file) is a separate feature.
**Gate:** a client with no gateway lists the disk and deletes a file, end to end, against a real gateway.

## S4 — NAMESPACE THE DRIVE INBOX PER MACHINE  *(unblocks the V4.1; SAFETY)*
⛔ **Until this ships, only ONE gateway may run Drive mode.** Two gateways share one inbox,
`_maybe_claim()` takes `ids[0]` with no notion of which machine a job is for, and `identity.verify()` is
inert while `machine_id` is unset ⇒ an Expert program can be delivered to the V4.1.
**Build:** the inbox folder is named per machine — `config.drive_folder` is ALREADY per-config, so only
`driveJobs.js`'s hardcoded `ROOT_NAME` and a target picker are missing. The human's own rule ("any workspace
can only have one controller") names the folder; `machine_name` already exists and Setup already collects it.
**Client-side:** sending becomes *"send to a MACHINE"*, invisible with one machine configured, a choice once
there are two.
**⚠ Turn `machine_id` on while here** — namespacing prevents the mix-up by convention; `identity.verify()`
REFUSES it by verification. Both, not either.
**Gate:** two gateways with distinct folders cannot see each other's jobs; a job placed in the wrong one is
refused by identity rather than delivered.

## S5 — LATER, ONLY IF WANTED
Read a file's contents from a client (needs the request/response channel above) · a client-side Tracking view
that mirrors the gateway's published status · promoting `status` to *"is the workspace's gateway alive"*.

---

## WHAT THIS PLAN DELIBERATELY DOES NOT DO
- **No new transport.** Everything rides the backend that is already there and already proven live (t2076).
- **No widening of the remote command surface.** Delete stays the only remote op.
- **No tab-hiding as a substitute for wiring.** S3 exists precisely because hiding Files would have shipped a
  crippled client and left the real work undone.

---

# ⚖ THE ARGUMENT (2026-08-19) — where the plan was wrong, and the law that came out of it

The human called this *"a major turnpoint"* and asked to argue it. Three challenges were put to the plan;
two stood, one was overturned BY the human. Recorded as reasoning, not conclusions, so it can be re-argued.

## 1. "Don't STORE the role, compute it" — PARTLY WRONG, overturned by the human
The argument was: the role is fully determined by whether a controller disk is configured, so storing it
creates a second source of truth that can disagree, and the override merely papers over stale config —
*"the honest fix is to clear it."*

⚠ **The human's answer kills that: "changing roles should not allow data to be lost."** Clearing the
controller disk to become a client IS the data loss — ASUS's `\10.0.0.50\cncdisk` is CORRECT config for
when it goes back to bench duty, and deleting it means retyping it later. **Proposing destruction as the
mechanism for changing role was the error.**
⇒ **The override stands, for a better reason than it was first given:** not to contradict the derivation,
but so a user NEVER has to destroy configuration to change role. It is a "not right now", not a "clear".

## 2. The role is per (PC, WORKSPACE), not per PC — STANDS
`expert_dest` lives in `~/.ddcs-bridge/config.json` — **per PC**. A workspace carries its OWN controller and
can be opened on any PC. So: open the V4.1 workspace on CNC-FAIRY, which is wired to the Expert. That PC is
a gateway *for the Expert* and a client *for that workspace* — same machine, same moment, two answers.
Not hypothetical: `compareController()` and `gateway-mismatch-gate-1229` exist because someone already hit it.
⇒ **The question is not "what kind of PC is this" but "is THIS PC's gateway wired to the controller THIS
workspace targets?"** Which is inherently computed — it changes when you switch workspaces.

## 3. The Drive inbox keys on the CONTROLLER, not the PC — STANDS
The human's own rule: two PCs may serve one controller, one after the other. An inbox named per PC ORPHANS
THE QUEUE the moment the gateway role moves machines — jobs sit in the retired PC's folder forever.
⇒ Key it on the controller/workspace identity (`machine_name` = the CNC machine, e.g. "Ultimate Bee" —
NOT the PC). ⚠ S4 said "per machine", which is dangerously ambiguous: it means the CNC machine.

## ⭐ THE LAW THIS PRODUCES — the constraint that governs the whole feature
> **A ROLE CHANGE MUST BE SIDE-EFFECT-FREE. Role affects DISPLAY and CLAIM BEHAVIOUR only — never data
> lifecycle.**

It follows from (2): if the role is per (PC, workspace), it changes EVERY TIME THE USER SWITCHES WORKSPACES.
Anything a role change touches — cleanup, migration, clearing a queue — would then fire on an ordinary
workspace switch and silently destroy state. ⇒ The computed model is not merely simpler, it is SAFER: making
role changes routine forces them to be harmless.

⛔ **Nothing may be deleted, migrated, cleared or re-homed on a role change.** Not the inbox, not history,
not the controller disk setting, not credentials.

## ⚠ THE NEARBY DATA-LOSS VECTOR THAT IS NOT THE ROLE'S FAULT — but will be blamed on it
Switching `backend` between `local` and `drive` STRANDS THE QUEUE: jobs in the local inbox are invisible to
the Drive backend and vice versa. Nothing migrates them and nothing says so. If that happens right after a
role change (likely — the two get configured together), roles will take the blame for a pre-existing defect.
⇒ **Name it before shipping roles**: at minimum warn when switching backend with a non-empty inbox; better,
report what is stranded and where. It is BACKLOG material in its own right, not part of roles.
