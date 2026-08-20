# BACKLOG — small, self-contained things to pick up in downtime

**What this file is:** the SHORT LIST of known, scoped, nobody-is-blocked-on-it work. Created 2026-08-19 at
the human's request — *"it needs to be a list for stuff to do in the downtime"* — because backlog items were
being appended to `NEXT-SESSION.md`, a 6,600-line running handoff where a to-do list is unfindable.

**What goes here:** something noticed in passing, already diagnosed, and small enough to finish in one sitting.
**What does NOT:** an arc, a decision the human owes, or anything needing hardware. Those stay in
[`NEXT-SESSION.md`](NEXT-SESSION.md) (the live handoff) and [`ROADMAP.md`](ROADMAP.md) (the canonical backlog
of features).

**The rule that keeps this honest:** an item is DONE when it leaves this file, not when a commit mentions it.
Each entry names where the evidence is, so nobody re-derives it.

---

## OPEN

### 1. ~~The avatar shows initials even when a photo exists~~ ✅ **CLOSED — t2113**
> Cause (1), plus a second nobody had spotted. The boot backfill EXISTED but its guard was
> `!name && !email` (pre-t2077, when identity had no picture), so an already-connected session never
> qualified; and it lived in `renderCloudLogin()`, which the header avatar never calls. Both fixed:
> `backfillIdentity()` re-asks when ANY part is missing, and `initHeaderAccount()` calls it.
> An account with no photo asks once per load and keeps initials. `avatar-backfill-2113.spec.js`.

*(human, 2026-08-19: "the avatar icon, it is my initials when I'm connected, but can it actually be my avatar image?")*

`headerAccount.js` ALREADY renders `acct.picture` when present and only falls back to initials — and
`googleDrive.getUserInfo()` now requests `photoLink` (t2077). So the plumbing is there; the likely causes are
mechanical, in order of probability:
1. **The picture was never cached for an EXISTING sign-in.** `captureGoogleIdentity()` runs on CONNECT only, so
   anyone who connected before t2077 has `ddcs_cloud_name`/`_email` stored but no `ddcs_cloud_pic`. ⇒ **Re-fetch
   identity on boot when the account is connected but the picture is missing**, rather than making the user
   disconnect and reconnect.
2. `photoLink` came back empty — a Google account with no photo set. Initials are correct there.
3. The `<img>` 403'd and the `onerror` fallback fired (Google's photo CDN rejects some referrers; the tag
   already sends `referrerpolicy="no-referrer"`).
**Check which it is before changing anything:** read `localStorage.ddcs_cloud_pic` — empty means (1), a URL
means (2)/(3).

### 2. Move the theme selector out of the quick menu into Settings
*(human, 2026-08-19)* — `headerPost.js` `themeSection` renders a heading + five `.hq-theme-chip`s in a menu the
t851 "menu diet" cut to ~9 rows. A theme is chosen once; Settings is where appearance preferences live. ⚠ Leave
NOTHING behind (a "Theme…" row that opens Settings keeps the row it was meant to free). ⚠ Reuse
`setQuickTheme()` — do not re-implement switching — and keep the active-theme ring reflecting live `data-theme`.

### 3. Hide the console window when launching the exe
*(human, 2026-08-19)* — `build_fairy.ps1` passes neither `--windowed` nor `--console`, so PyInstaller defaults to
a console build and a black log window sits beside the app all session. ⛔ **Do not just add `--windowed`**: that
log is load-bearing (bound host/port, a FAILED serial probe, `[poller]` delivery/stall lines) and on a frozen
Windows build stdout then goes nowhere — a bare `print()` can even raise when `sys.stdout` is None. **Log to a
file first** (`~/.ddcs-bridge/gateway.log`, rotated) with a "show log" affordance in Setup, *then* hide the window.

### 4. The exe only checks for updates at boot
*(human, 2026-08-19)* — `initUpdateCheck()` is called once from `index.html` ("one check per launch"); a release
cut while Studio is open is invisible until restart. The WEB build already re-checks on `visibilitychange`
(`initWebVersionNudge`) — the exe, which cannot reload itself and most needs telling, has no equivalent. Reuse
that pattern, throttled (`_lastWebCheck` is the precedent). ⚠ Must not re-nag a version already dismissed —
`update-check.spec.js` asserts that.

### 5. The update banner is not well balanced
*(human, 2026-08-19, on the real exe — twice, second time with the specific symptom: "the buttons seem to
clutter to the left and have a big empty space on the right")*

**The measured symptom:** the bar is WIDER than its content and everything is left-packed, so the controls bunch
up on the left with dead space trailing off to the right. Two candidate causes, and they want checking before
either is "fixed": the container is being stretched (a `width`/`min-width` or a stretching flex parent) rather
than hugging its content, and/or there is no `justify-content`/`margin-left:auto` giving the ✕ its own corner.

**Compounding it, from the first report:** the version prints TWICE — in the label AND inside the primary
button, which carries the longer copy ("Update to v2026.08.19.2 and restart"). So the widest element is also
the most redundant one, and its width grows with the version string, meaning the layout reflows differently per
release and cannot be judged at one width. Dropping the version from the button ("Update and restart") both
shortens the row and removes the duplication.

⚠ Do not "fix" it by shrinking or demoting the primary action — t2066 deliberately made the in-place update
prominent over the dated manual Download, which users kept grabbing by mistake. It is a proportion problem, not
a priority one. ⚠ `update-check.spec.js` asserts button classes and the exact "Download manually" label, so a
copy change is a test change — read it first.

### 6. The welcome / "What's new" panel: shorter, and link to the thing it describes
*(human, 2026-08-19: "the panel on boot can be a little bit less lines and perhaps a link on each panel to go to
the function associated with the note whenever possible… maybe it's nice to have a screenshot of the function or
the menu for each note.")*

Three separable asks, in increasing cost — the first is worth doing alone:
1. **Fewer lines.** `RELEASE_NOTES[v][].full` is currently a paragraph per entry (the t2075 schema deliberately
   allowed the modal to say the HOW). It has drifted long — the t2078 notes run 4-5 lines each. Tighten the
   authored copy; no code change.
2. **A link per panel to the feature.** ⚠ OPTIONAL BY THE HUMAN'S OWN WORDS — *"not an obligation… if it's
   convenient or easy"*. Cheap version: an optional `go` field on a note (`{ short, full, go }`) whose value is
   an existing global the app already exposes (`window.openSettings`, `showApp('gateway')`, the quick menu).
   ⛔ Do NOT invent a navigation layer for this; if a note's target has no existing door, it simply gets no link.
3. **A screenshot per note.** ⚠ **MY FIRST OBJECTION HERE WAS WRONG AND IS CORRECTED, so it does not get
   re-raised:** I argued images would go stale against a weekly-changing UI. The human's answer —
   *"of course they go stale, but that's why we release new updates"* — is right, and it dissolves the problem:
   **release notes are VERSIONED AND IMMUTABLE.** A picture in the V2026.08.19.4 notes documents what
   V2026.08.19.4 introduced; it is a historical record, not a live document, and it is CORRECT for it to keep
   showing that release's layout forever.

   That reframing also makes it cheap, via a fact about the surface: **the welcome modal only ever fires for the
   version just installed** (`checkWelcomeNotice` compares stored-vs-current at boot). So only the CURRENT
   release's images can ever render — historical ones are never displayed and must NOT be accumulated in the
   bundle. ⇒ **Ship images for the newest release only; drop the previous release's when cutting a new one.**
   The note TEXT stays for history (the banner still reads older entries); the images do not.

   Remaining real costs, neither fatal: (a) someone must capture + crop at release time — a per-release chore
   the ritual has to name, or it silently stops happening; (b) they must be BUNDLED, not fetched — the gateway is
   offline-first, so a CDN URL would break exactly the shop-with-no-internet user this is for. Budget a few tens
   of KB for ~3 cropped PNGs and keep them out of `--onefile` growth by replacing rather than appending.

Files: `web/data/releaseNotes.js` (the authored source), `web/ui/updateCheck.js` (`checkWelcomeNotice` renders
one panel per entry). ⚠ `update-check.spec.js` asserts the modal's panel-per-entry structure and the
no-notes fallback — read it before changing the schema.

---

## RECENTLY CLOSED  *(kept briefly so a re-report is recognised, not re-investigated)*

- ~~**Two Google Drive connect surfaces sharing one credential**~~ — closed by **t2077**: one account door in the
  header, both features (save projects / send jobs) hang off it.
- ~~**The editor's bottom-left button cluster is overgrown**~~ — closed by **t2078**: one flex toolbar row above
  the editor; indent/comment buttons retired to their keyboard shortcuts.

## OPEN (continued)
*(⚠ these numbered items were appended BELOW the RECENTLY CLOSED list by earlier turns and
read as closed at a glance. They are not. Header restored 2026-08-20.)*

### 7. The lathe icon doesn't read as a lathe setup
*(human, 2026-08-19: "the lathe icon is not really looking like a lathe setup")*

⚠ **Establish WHICH icon before touching anything — there are two distinct families and they have different
histories:**
- **The lathe OP icons** (`ui/wizIcons.js`, `user_lathe_facing` / `odturn` / `parting` / `centerdrill` /
  `polygon`) — a deliberately-designed set (t1911) sharing one constant: a steel bar on a red dashed
  centreline, each op differing by what the CUT removes. ⚠ These were ALREADY revised once (t1918) after the
  human found the first pass too small at the real 14px render — the fix was heavier, fewer marks, re-derived
  from `rotary_center`'s proven weight. Do not quietly undo that.
- **The lathe MACHINE-KIND mark** — whatever represents "this workspace is a lathe" (the identity line renders
  `· Lathe` as TEXT today; `settingsPanel.js` has `latheEnvelopeSvg`). If the complaint is about the machine
  rather than the ops, this is the one, and it may not exist as an icon at all.

**Ask the human which, and get the specific "doesn't look like":** a lathe setup reads as chuck + bar +
tool-on-a-cross-slide; the current op family draws bar + centreline + cut only, with no chuck and no tool
post — which is a plausible reason it reads as "a rod" rather than "a lathe". ⚠ Whatever changes, it must
survive **14px** — that constraint is what t1918 was entirely about, and it is where the first attempt died.

### 8. ~~Let the BROWSER send jobs through Drive too (not just the exe)~~ ✅ **CLOSED — t2080**
> Shipped: `ui/cloud/driveJobs.js` writes straight into the machine's Drive inbox; `client-send-2080.spec.js`
> covers both contract cases. Since extended by S4 (per-machine folder) and by the no-send policy below.
*(human, 2026-08-19: "what if i want the browser to send too", then — cutting through my overcomplication —
"cant we make the gateway simply watch a folder on my drive")*

⭐ **THE BLOCKER I DESCRIBED DOES NOT EXIST. MEASURED 2026-08-19, correcting my own claim.** I asserted that
`drive.file` scopes visibility per OAUTH CLIENT, so a job written by the browser (Web client `…mapt`) would
be invisible to the gateway (Desktop client `…607m`) and would fail SILENTLY. **Tested instead of argued:
the gateway's Desktop client listed and read `DDCS Studio/` — a folder created 2026-06-15 by the BROWSER's
Web client — including its contents.** ⇒ `drive.file` visibility is scoped to the **Cloud project**, not the
client. Both clients live in project `895572525139`, so the two ends ALREADY share one visibility domain.
No client unification, no re-registering redirect URIs, no reverting t2079.

⚠ The lesson worth more than the item: this was ONE API call away for the entire session and I designed
around it instead of testing it. The human's "can't we simply watch a folder" was the correct model all
along — the gateway already does exactly that (`DriveBackend` polls `DDCS Bridge/inbox/`).

**What actually remains — small:** the browser must WRITE a job in the layout the gateway polls. Mirror
`backend/drive.py`'s `put_job`: `DDCS Bridge/inbox/<jobId>.nc` + the `.map.json` sidecar, the same
`make_job_id` timestamp convention, and the `content_hash` `send.js` already computes (so History still
links repeat runs). `ui/cloud/googleDrive.js` already has the upload/list primitives.
⚠ Reuse the UPSERT discipline — Drive permits duplicate names, so a blind create duplicates a job.
⚠ Prove it end to end (a real browser submit → a real gateway claim → a real controller delivery) before
believing it; that rule is what months of `[TO TEST]` on r2.py earned.

### 9. ~~A job sent while the controller is OFF is discarded, not queued~~ ✅ **CLOSED — t2105/t2107**
> ⛔ **DO NOT BUILD WHAT THIS ENTRY PROPOSES.** The retry queue, attempt ceiling and persisted retry state
> described below were all explicitly rejected by the human. The defect was real; the fix was the opposite
> of elaborate:
> - `poller._maybe_claim` now checks `transfer.reachable()` beside the `expert_dest` check, so an
>   undeliverable job is simply **NOT CLAIMED** — and **the inbox IS the queue**, so not claiming already
>   means waiting. No counter, no ceiling, no backoff, no state.
> - and the job should not exist in the first place: **a send is refused unless a gateway is running AND
>   the CNC is powered** (the twofold heartbeat). Prevention at the moment of action beat cleanup after it.
>
> ⭐ The full reasoning, including an advisor objection that was **backwards**, is in
> [`bridge/bridge-app/JOB-RULES.md`](bridge/bridge-app/JOB-RULES.md) — the one source for this behaviour.
> The original text is kept below only so a re-report is recognised, not re-investigated.

#### (original report, superseded)
*(found 2026-08-19 while answering the human's "is CNC-FAIRY a gateway when the controller is on and a
client when it's shut down?" — the role answer is no, but the instinct behind it exposed this.)*

`poller._claim()`: when `transfer.deliver()` raises `OSError` (share unreachable = controller powered down,
cable out, network blip) the job is marked **`failed`** and **`delete_job()`d from the inbox** — comment:
*"don't wedge the queue on a bad job"*. Correct for a genuinely bad job (malformed, wrong machine); **wrong
for a machine that is merely OFF**, which is the ordinary case of authoring in the evening.

⚠ **The Drive path makes this materially worse, and it is new as of t2080:** a client sends from a phone,
the UI honestly says "queued — the machine picks it up when it next runs", and the first poll of a sleeping
gateway *deletes it*. The user is told to expect asynchrony and then silently loses the job. **A client's
send is supposed to be offline-tolerant BY CONSTRUCTION** (ROLES-PLAN.md) — this is the one thing that
breaks that promise.

**Shape of a fix:** distinguish TRANSIENT from FATAL. Unreachable/`OSError` ⇒ leave the job in the inbox and
retry on a later tick (the queue is FIFO and the job is already durable, so "wedging" is not what happens —
it simply waits, which is the correct behaviour). Reserve delete-and-fail for a job that cannot ever
succeed: refused identity, unreadable content.
⚠ Keep a real ceiling so a genuinely dead destination does not retry forever in silence — an attempt count
or an age, and when it trips, fail it LOUDLY with the reason (`t2073`'s honesty rule: never a silent drop).
⚠ `test_poller_track_gate.py` and `test_history_real_path_2065.py` both drive this path — read them first;
one asserts the failed-job cleanup that this changes.

---

## SOUND — ONE MASTER TOGGLE IN SETTINGS
*(human, 2026-08-20: "backlog general sound toggle in setting")*

**One user intent — "make it quiet" — but there are TWO sound producers, in two processes, potentially on
two different machines.** That split is the whole design problem; the toggle itself is trivial.

| producer | what it plays | where it runs | today |
|---|---|---|---|
| `DDCS-Studio/web/ui/sound.js` | UI click feedback (`playClick`, `playClickReverse`), 8 call sites in `app.js` + `wizardManager.js` | the BROWSER | always on, no setting at all |
| the gateway daemon's chime | door / register / buzzer on job received, delivered, failed | the GATEWAY PC's Python process | being added now, with its own Setup toggle |

⭐ **WHAT TO BUILD:** a single user-facing "Sounds" control in Studio's settings that reads as one switch,
even though it has to reach two places. ⚠ **Do NOT ship two unrelated checkboxes in two panels** — that is
the shape the roles work is currently deleting elsewhere.

⚠ **The one real question to settle first:** the browser's clicks and the gateway's chimes are genuinely
different things, and someone may reasonably want clicks OFF and job chimes ON (the chime is a
NOTIFICATION about the machine; the click is keypress feedback). ⇒ Likely **one master off-switch plus two
sub-toggles**, not a single boolean. Decide this before writing the setting, not after.

⚠ **A gateway on another PC cannot read a browser localStorage setting.** If the master switch must govern
a remote gateway's chime, it has to live somewhere both read — the same join problem as
[[the machine-identity join]]. **Cheapest honest answer: the toggle governs THIS machine's sounds**, and
the gateway's own chime is set in that gateway's Setup. State that in the UI rather than implying reach it
does not have.

**Also worth folding in while there:** `sound.js` hardcodes one asset and a fixed `VOLUME = 0.5` with no
way to change either. A volume slider is the obvious neighbour of an on/off switch, and the module already
routes WebAudio through a `gainNode` that nothing currently adjusts.

---

## THE JOBS FOLDER IS SETTABLE — FOLD THE "SYNC FOLDER" ROUTE INTO **LOCAL**, NOT A THIRD OPTION
*(human, 2026-08-20: "i dont like that it would look like a 3rd option can we fold this in the local folder
option". Correct, and the reason is structural: **a synced folder IS a local folder.**)*

⭐ **THE GATEWAY DOES NOT KNOW OR CARE THAT A FOLDER SYNCS.** `LocalFolderBackend` polls whatever directory
it is handed. Pointing `local_root` at `C:\Users\you\Google Drive\DDCS Bridge` gives PC-to-PC transport with
**no adapter, no OAuth, no quota, no new code** — the sync client does the moving, and that arrangement is
between the user and Dropbox/Google, invisible to the app. ⛔ So it must NOT appear as a third transport
beside Local and Drive; that would invent a mode where there is only a path.

### THE ONLY THING MISSING: `local_root` HAS NO SETTER
⛔ Not in `Config._PERSIST_KEYS`. ⛔ Not in `Ops.set_config`. ⛔ Not in the Setup UI. ✅ Only the CLI
`--root`, which the exe never passes. ⇒ The capability exists and is unreachable from the app.

⚠ **THIS IS THE SECOND FIELD WITH EXACTLY THIS SHAPE** — `drive_folder` was the same (declared, no setter,
resets every restart; corrected during S4 by using `machine_name` instead). **Two is a pattern, not a
coincidence:** a `Config` field is cheap to add and easy to leave unwired, and nothing fails loudly when it
is. ⭐ Worth a check that every `_PERSIST_KEYS`-eligible field is either wired to `set_config` or explicitly
marked CLI-only — the same family as the connectivity check already on this list.

### THE BUILD
1. `local_root` into `_PERSIST_KEYS` + `Ops.set_config`, validated as a writable directory.
   ⚠ `dest` validates as a network share; this is the opposite — a LOCAL path, and a UNC would be a
   different (untested) story. Say which you accept.
2. One field in `admin.js` **under the existing Local radio**, showing the current root, with a one-line
   hint that a synced folder reaches other PCs. ⛔ No new radio. ⛔ No "sync" mode anywhere in the code.
3. ⚠ **Changing the root ORPHANS whatever sits in the old inbox** — same class as S4's migration question.
   Detect and report; ⛔ never move files on the user's behalf.

### ⚠ THREE SYNC-SPECIFIC HAZARDS, only once this is a SUPPORTED path
- **Write ORDER is load-bearing and sync does not preserve it.** `put_job` writes `.map.json` BEFORE `.nc`
  because `list_inbox` keys off the `.nc` — the moment it appears the job is claimable. A sync client gives
  no ordering guarantee between two files, so a job can be claimed before its sidecar lands.
- **Conflict copies become jobs.** `job (1).nc` matches the `.nc` suffix and would be claimed as real.
- **Both PCs must sync the same folder** — the part users genuinely do work out themselves.
⇒ ⭐ **None of these block a user doing it manually today.** They are the cost of making it discoverable,
and they are the honest reason it is a documented path rather than a promoted feature.

---

## WIZARD PREVIEW PANES: A SENSIBLE DEFAULT FOR SOMEONE WHO HAS NEVER DRAGGED
*(the residue of t2113. The reported defect — "both panes open at ~40px" — is FIXED; this is what is left.)*

**FIXED, do not re-report:** the app's fit-to-screen clamp was being WRITTEN BACK over the user's dragged
height (`applyVisualHeight` persisted the heal), so a drag survived until the next tight layout and then
vanished — reopening at the 160px floor, which after ~92px of pane headers leaves **~40px per pane**. That
number was reproduced exactly (51 then 34 across opens) and matches the human's report. The heal now
APPLIES without being SAVED. ⭐ **Last-used size wins** (human: *"the last used size is great"*).

⬜ **WHAT REMAINS — the first-time case: 140px PER PANE** (human: *"can new user panel be 140"*).
⚠ **ATTEMPTED AND REVERTED 2026-08-20 — read this before trying again, it fails in a specific way.**
A default of `panes x 140 + chrome` when nothing is stored WORKS (measured: 140/140 at 390x780, form still
fully reachable — `.wiz-body` scrolls, 201 fields, the last one and INSERT both reachable). ⛔ But it
**breaks t1468's collapse contract** and `collapsible-panes-752` catches it in two places:

- Counting only the OPEN panes makes the visual TOTAL shrink when one is folded. t1468's contract is the
  opposite: **the total stays put and the SURVIVOR grows into the freed height.**
- Counting ALL panes fixes that, but then the survivor lands at 146px against a spec demanding >150.
  ⇒ the freed height is not reaching the survivor; something downstream still caps it. **That is the
  actual open question — find what caps the survivor before touching the default again.**

⚠ AND THE FLOOR MUST APPLY TO A STORED DRAG TOO, or a drag is WORSE than no drag: measured at 390x780,
nothing stored gave 140px panes while a deliberate drag to 500 was clamped to 51px by `visualMaxHeight`'s
leftover-space cap. Whoever builds this must make both paths share one floor.

⭐ Safe to push the form down: the phone layout puts previews on TOP of a scrolling body, verified — ⛔
unlike the command-deck bug, where content was clipped with no scroll path.

---

*(original note follows)*
⬜ **the first-time case.** `getVisualHeight()` returns null when the user has never dragged,
and the code then falls through to *"the layout's own flex sizing holds"*. On a phone that is whatever is
left after the form, so **someone opening a wizard on a phone for the first time can still get strips** —
with no reason to suspect the panes are draggable at all.
⇒ Give the never-dragged case a **sensible minimum** rather than the leftover. ⛔ NOT a new setting: a
stored drag already overrides it, and the human explicitly wanted no third knob.
⚠ Safe to do because the phone layout already puts the previews ON TOP of a scrollable body
(`.two-pane .wiz-body { overflow-y: auto }`, `.wiz-visual { order: 1 }`), so a taller minimum pushes the
form down rather than clipping anything — ⛔ unlike the command-deck bug, where content was cut off with no
scroll path at all. **Verify that property still holds before changing the number.**
⚠ Check whether the previews are STICKY on a phone (the CSS comment says they "stay sticky"): a tall
minimum plus sticky could pin most of the screen while the form scrolls under it. Deliberate either way.

---

## AUDIT: WHICH GATEWAY TABS A V4.1 (AND A V3) CAN ACTUALLY USE
*(human, 2026-08-20: "backlog audit which gateway tab the 4.1 actually can use" — after finding beacons
costing 1-2s each on a V4.1, and the Tracking tab showing a job at 63% from a status record two months old.)*

⭐ **THE CAPABILITY THAT DECIDES MOST OF IT: Modbus RTU is EXPERT-ONLY.** The V4.1 has none, and
`bridge/controllers/dm500/FINDINGS.md` records that grepping the whole 311-param DM500 eng for
`modbus|master|slave|serial.*mode|comm.*mode` gives **ZERO hits**. ⛔ So never write this as a v4.1
blacklist — name what HAS the capability, or the next controller inherits a permission by default.

| tab | Expert | V4.1 / V3 | status |
|---|---|---|---|
| **Send** | ✅ | ✅ deliver-only | works. Beacons now gated off without Modbus (t2113) |
| **Status** | ✅ | ✅ | works |
| **Jobs** | ✅ | ✅ | queue + history are backend state, controller-agnostic |
| **Files (CNCDISK)** | ✅ | ✅ | a file share, no Modbus involved |
| **Console / Setup** | ✅ | ✅ | works |
| **Tracking** | ✅ | ⛔ **GATED (t2113)** | needs Modbus; dimmed + explains itself |
| **Merge** | ? | ? | ⚠ **UNAUDITED — the one genuine unknown** |

⬜ **THE REMAINING WORK IS MERGE.** ROLES-PLAN.md flags it *"VERIFY, do not assume"* because an earlier
claim about it ("operates on controller-side files") was made without reading the code and was never
checked. It is the last tab whose controller-dependence nobody has established.
⚠ `state.js:45` declares it `keeps:''/clears:true`, which pre-bakes wiping the operator's own staged list —
worth understanding before touching it.

⚠ **ALSO SPOTTED, NOT YET RULED: BEACON COUNT DEFAULTS TO 255**, the maximum. On an Expert that is 255
Modbus round-trips inserted into one program; on anything else it was 255 timeouts. Even where beacons DO
work, 255 checkpoints is far more progress resolution than anyone reads. ⇒ **pick a sane default** (a dozen
or so) and let the field go to 255 for someone who wants it.
