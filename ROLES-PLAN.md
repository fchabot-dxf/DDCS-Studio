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
| **files** (CNCDISK) | ❌ HIDE | it browses a controller disk this PC has no path to |
| **merge** | ❌ HIDE | operates on controller-side files |
| **console** (admin/Setup) | ⚠ REDUCE, never hide | the client still needs Setup — but only the parts that apply |

### 2. Setup, which is mostly controller configuration
`views/admin.js` currently shows, to everyone: machine name · **controller disk** · **beacons (Modbus)** ·
LAN serving · **serve port** · cloud storage + account · controller profile.

A client needs: **machine name**, **cloud storage / account**, and the service (daemon URL) row.
A client does NOT need: controller disk, beacons, the controller profile block — all of which describe a
controller it is not attached to. ⚠ *Reduce, do not hide the tab*: Setup is where the role itself is chosen.

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
