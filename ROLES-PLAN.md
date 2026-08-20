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
| **files** (CNCDISK) | ✅ **KEEP** | ⭐ **CORRECTED — I was wrong twice about this.** A client does NOT need a path to the disk: the gateway PUBLISHES the listing (`put_cncdisk_index`, implemented by `DriveBackend`) and the client issues DELETE through the command channel (`list_commands`/`clear_command`) which the gateway polls and executes. Remote disk management is already designed in, end to end. ⚠ It is a SNAPSHOT (the gateway's last publish, ~15s), not the live disk — say so in the UI. ⛔ `SAFE_OPS = {"delete"}` with bare-filename-only validation: a remote client can never RUN anything, and that line stays. |
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
