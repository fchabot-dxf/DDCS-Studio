# SOUND-PLAN — themed earcons, one toggle

**Status:** designed and approved by the human (2026-08-21), not yet built.
**Hear the target:** https://claude.ai/code/artifact/b3653ea6-f4e4-4eb6-9133-8cb9414c120c
⭐ **Play it before writing anything.** Every number below is lifted verbatim from that page, which is a
working WebAudio implementation — it is the spec, not an illustration of one.

---

## 1. The rulings (human, verbatim where it matters)

| | |
|---|---|
| **How many toggles** | ⚠ **REVISED 2026-08-21:** *"we need a global mute but also a sound by sound toggle"*. A **master mute** PLUS a **per-sound toggle**. The original *"all sound are enabled by the only toggle"* still governs the MASTER — it silences every producer, browser and gateway alike — but individual sounds can now also be turned off. Master off beats everything. |
| **Scope** | **every** producer: the browser's UI sounds AND the gateway's job chime |
| **Storage** | *"stored in workspace and persistent across machines"* — the workspace, **not** `localStorage` |
| **Theming** | *"can we make all sounds by theme too"* — sound follows the visual theme |

⛔ **THE GATEWAY'S OWN SETUP TOGGLE MUST GO.** Two switches for one fact is the duplicate-source shape this
codebase keeps deleting, and here they would disagree silently with no way to tell which was lying. One
declaration, two players.

⚠ **The gateway runs in a different process on a possibly different PC.** It cannot share a WebAudio graph —
but it does not need to, because the declaration below is *numbers*. Python renders the same waveform from
the same table. ⚠ Flipping the toggle while the gateway is offline leaves a window where Studio is silent and
the mill PC is not; **state that in the UI** (say when the gateway last picked it up) rather than implying
instant effect. Same twofold-heartbeat honesty the Send tab already uses.

---

## 2. Architecture — two orthogonal axes

```
  EVENT = contour + rhythm + octave      identical in every theme
  THEME = voice function + base pitch    identical across every event
```

Adding a sixth theme is **one voice function**. Adding a fifth event is **one contour row**. Nothing gets
rewritten N times. This is the whole reason it is shaped this way.

---

## 3. EVENTS — the exact table

⭐ **These separate on FIVE axes at once.** That is the point, and it is what the earlier drafts got wrong.

| axis | arrives | delivered | failed |
|---|---|---|---|
| notes | **2** | **4** | **7** |
| tempo | slow, spacious | quick run | very fast |
| interval | open 5th | resolving to octave | **tritone — DISSONANT** |
| register | mid | climbs high | **an octave down** |
| length | ~1.0 s | ~1.2 s | ~0.55 s |

```js
// steps = semitones from the theme's base. rhy = [onsetSec, durSec, gain] per note.
const EVENT = {
  // ARRIVES - sparse and patient. TWO notes, a rising perfect fifth left hanging.
  // Nothing else is this empty; the SILENCE is the identifier.
  in:   { oct: 0,
          steps: [0, 7],
          rhy: [[0, .30, .26], [.24, .80, .28]] },

  // DELIVERED - a quick rising run landing on the OCTAVE and ringing. Ending on the fifth
  // still sounds in transit; the octave is the cadence the ear hears as finished.
  done: { oct: 0,
          steps: [0, 4, 7, 12],
          rhy: [[0, .13, .22], [.09, .13, .22], [.18, .13, .24], [.27, .95, .30]] },

  // FAILED - SEVEN fast notes oscillating on a TRITONE, an octave below everything else.
  // Dissonance is CATEGORICAL, not a matter of degree: the ear flags it before it identifies
  // pitch or counts notes. This is the axis doing the real work.
  fail: { oct: -1,
          steps: [0, 6, 0, 6, 0, 6, 0],
          rhy: [[0, .10, .30], [.068, .10, .28], [.136, .10, .30], [.204, .10, .28],
                [.272, .10, .30], [.340, .10, .28], [.408, .20, .32]] },
};
```

**CLICK is not an earcon** — it is feedback, one transient, no contour: the theme's own voice at
`base * 2^(-5/12)`, `dur 0.055`, `gain 0.22`.

⛔ **Do not "simplify" these into one shared rhythm or one shared pitch set.** An earlier draft used the same
major triad rearranged for all three (`0-7-4` / `0-4-7-12` / `7-4-0`) and the human could not tell them apart
inside a theme — which is the only comparison that exists in real use.

---

## 3b. ACTIONS — the layer that makes this extensible ⭐

*(Human, 2026-08-21: "make sure that its easy to add new sounds to other button press and actions.")*

Two layers is not enough. Without a third, giving a new button a sound means editing synthesis code — which
is precisely the trap this architecture exists to avoid. **Add a declared action map and ONE entry point.**

⭐ **One map, TWO kinds of source** — a themed synthesised `voice`, or a learned `sample`. That is what lets
§5's split live in one declaration instead of two parallel systems.

```js
// LAYER 3 — WHICH ACTION MAKES WHICH SOUND. Pure inert data; the only file anyone edits
// to give something a voice.
export const ACTION = {
  // ── UI: themed synthesis. You are looking at the screen. ──
  'ui.click':        { voice: 'click' },
  'ui.toggle':       { voice: 'click' },
  'wizard.opened':   { voice: 'click', semitones: +5 },   // lifted — something began
  'wizard.closed':   { voice: 'click', semitones: -5 },   // the old "reverse", now declared
  'keyboard.opened': { voice: 'click', semitones: +5 },
  'wizard.inserted': { voice: 'commit' },                 // ⭐ LIGHTER than `done` - see below
  'file.saved':      { voice: 'commit' },

  // ── JOB: the LEARNED sounds. NOT themed, NOT synthesised. `where` decides which side plays.
  'job.sent':        { sample: '<swoosh>.wav',                                where: 'client'  },
  'job.arrived':     { sample: '361564__matthewwong__ding-dong.wav',          where: 'gateway' },
  'job.delivered':   { sample: '209578__zott820__cash-register-purchase.wav', where: 'gateway' },
  'job.failed':      { sample: '700641__producing_raylite__incorrect-buzzer.wav', where: 'gateway' },
};
```

### ⭐ `where` — and why nothing is 'both' (human, 2026-08-21)

```
  CLIENT              GATEWAY (the mill PC)
  ──────              ─────────────────────
  sent  swoosh   →    arrived    ding-dong
                      delivered  register
                      failed     buzzer
```

The person who *sent* it hears the send; everything after that is for whoever is **at the machine**.

⭐ **Because no sound is ever `'both'`, the one-box case needs NO dedupe rule.** Studio and the gateway on
one PC is permanent, and an earlier draft had `delivered`/`failed` on both sides — which would have fired
twice from the same speakers and needed a suppression rule to fix. This is simply better.

⚠ **Known consequence, accepted:** send from a phone and walk away and you hear the swoosh and nothing else.
Correct — remote status is what the UI is for, and a phone chirping about a mill three rooms away is noise.

⚠ **`job.sent` needs one new asset**: a CC0 swoosh, PCM 16-bit mono 44.1 kHz, same
`<freesound-id>__<uploader>__<name>.wav` convention. A swoosh is one of the few learned sounds that also
synthesises convincingly (filtered noise plus a sweep) — acceptable fallback, not a compromise.

⭐ **`commit` is a NEW, LIGHTER event** *(human: "op insert yes lighter")*. `done` is the 4-note run to the
octave, ~1.2 s — right for a job delivered a few times an hour, too much for an insert you do fifty times an
afternoon. Make `commit` a short rising pair that still resolves: **`steps: [0, 12]`,
`rhy: [[0,.10,.24],[.07,.34,.28]]`** — the same *meaning* as `done` at a third of the length.
⚠ Keep `done` in the table; it stays available and may be wanted elsewhere.

**The entire call site becomes:**

```js
import { sfx } from './ui/sound.js';
sfx('file.saved');
```

### What `sfx()` owns, so no caller ever has to think about it
- ⭐ **The toggle is checked HERE, in one place.** No call site can forget it, and there is exactly one
  place to look when sound misbehaves.
- ⭐ **An unknown action is SILENT, never a throw.** A typo in a string must not break a save button. Log
  once in dev; never raise.
- ⭐ **Debounce.** A held or double-clicked button must not stack twenty overlapping voices. Coalesce
  repeats of the same action inside a short window (~60 ms) and cap concurrent voices.
- **Theme resolution.** `sfx` reads the live theme; callers never name a voice.

### The test of whether this succeeded
> **Giving any button in the app a sound must be: one line in `ACTION`, one `sfx('name')` at the call site.
> Zero edits to synthesis, zero edits to any theme.**

If a new sound requires touching `EVENT` or `THEME`, the layering is wrong. Adding a genuinely *new kind* of
sound is one `EVENT` row — and that is the only case that should ever need one.

⚠ **Do not let `sfx` grow options** (volume, pan, delay, priority). Every one of those belongs in the
declaration, not the call. A call site that can tune playback is a call site that will drift from its
siblings.

---

## 4. THEMES — the exact voices

Base pitches: `studio 392` · `futuristic 587` · `organic 330` · `steampunk 523` · `normal 440`.

- **studio** — felt. Sine through a lowpass at `max(900, f*3)`, plus the 2nd harmonic at `0.18` gain.
- **futuristic** — distorted. Sawtooth through a **waveshaper (k=55)** band-passed at `f*2.1 Q1.4`, plus a
  distorted fifth (k=30) at `f*1.5`, **plus a CLEAN SINE at 0.30 gain**.
  ⚠ **The clean sine is load-bearing.** Distortion smears pitch, and pitch carries the contour — without the
  anchor the melody stops reading and the earcon structure collapses into texture.
- **organic** — wood. A 10 ms noise burst band-passed at `f*3.2 Q5`, a triangle at the fundamental, and a
  partial at `f*2.76` (`0.16` gain).
- **steampunk** — a **cast bell**, not a brass tone. ⚠ The previous version used `[1, 2.03, 2.98, 4.12, 5.43]`
  — near-integer, i.e. a harmonic series, which sounds like an organ stop. Real bells are strongly
  **INHARMONIC** and the identifying partial is the **tierce at 1.2, a minor third above the prime**.
  `ratio · gain · ring` = `[0.5,0.34,2.00] [1.0,1.00,1.70] [1.2,0.62,1.35] [1.5,0.44,1.15] [2.0,0.40,0.95]
  [2.5,0.20,0.62] [3.0,0.14,0.48] [4.2,0.08,0.32]`, partial duration `(dur*0.55 + 1.05) * ring`, plus a
  7 ms highpass-4400 clapper transient. High partials die first, as in a real casting.
- **normal** — plain sine, nothing else. Deliberately forgettable.

---

## 5. ⛔ CORRECTION — samples already exist, and the JOB sounds keep them

**An earlier draft of this plan said "zero samples". That was wrong and it nearly destroyed a considered
design.** `DDCS-Studio/web/assets/audio/` already holds four CC0 WAVs, and
[`PROVENANCE.md`](DDCS-Studio/web/assets/audio/PROVENANCE.md) records why — it is the human's own ruling:

> *"use sounds people have **ALREADY LEARNED**… An operator needs no training and no manual. The earlier
> proposal (a tick, a bell, a buzz at different pitches) required someone to LEARN a vocabulary, and
> **pitch differences do not survive a running spindle**."*

⛔ **DO NOT replace the job sounds with synthesis.** The door chime, the register and the buzzer come from
three different *families* a stranger already interprets. My synthesised earcons separate by contour and
interval — exactly what a running spindle eats. PROVENANCE pre-registers the rule for any replacement:
**"three different FAMILIES that a stranger could already interpret — not three pleasant tones."**

### THE SPLIT (human, 2026-08-21)

| | sound | why |
|---|---|---|
| **JOB events** — arrived / delivered / failed | the existing **WAVs**, unthemed | you are away from the screen; a learned sound needs no teaching and survives noise |
| **UI actions** — click, wizard open/close, insert | **themed synthesis** (§3, §4) | you are looking at the screen; no vocabulary to teach, and theming is the point |

⚠ **BOTH ENDS PLAY THE SAME FILES.** A browser watching a job must play the same WAVs the gateway does.

### ⛔ HARD FORMAT CONSTRAINT
**WAV, PCM 16-bit, mono, 44.1 kHz. Not MP3, not OGG.** The gateway plays through Python's `winsound`, which
handles PCM WAV only. The browser would accept anything; the daemon would not.
⚠ Filename convention is `<freesound-id>__<uploader>__<name>.wav` — the id alone recovers the licence.
Keep it, and keep any new file CC0.

---

## 5b. Every other sound in the app — swept, and each one ruled

⚠ These were **not** in the original plan because I had not looked. All human-ruled 2026-08-21.

| source | what it is | ruling |
|---|---|---|
| `ui/sound.js` `playClick` / `playClickReverse` | 6 call sites (`app.js:195`, `wizardManager.js:226/446/500/513/564`) | **convert to `sfx()`.** ⚠ Today *opening a wizard* and *inserting an op* play the IDENTICAL sound — semantically opposite events. `wizard.opened` and `wizard.inserted` now differ. |
| `ui/globalFunctions.js` `playCommBeepPreview` (850 Hz square) | previews what the **controller's own beeper** does for an emitted M-code | ⛔ **LEAVE ALONE. Do NOT theme it.** It simulates the machine; theming it would make Studio lie about what the mill will sound like. It is not app feedback. |
| `viz/gcodeViz3d.js` `_beep()` (880 Hz, end of every animation loop) | audible "preview finished" | ⛔ **REMOVE IT — replace with a VISUAL cue** *(human: "remove it but change it to something visual")*. You are watching the preview; a sound for a visible event is redundant. Something quiet — a brief pulse or fade on the toolpath end, not a banner. |
| `vendor/blockly/blockly.min.js` | Blockly's OWN audio: click, delete, disconnect, `playErrorBeep(260)` — with its own `muted` flag | **Mute Blockly's system, drive the equivalents through `sfx()`** *(human)*. One vocabulary everywhere, and it is required by the one-toggle ruling: our switch must genuinely silence the Blocks tab. |
| `bridge/.../chime.py` | the gateway's door/register/buzzer | keep the sounds; ⛔ **remove its separate Setup toggle** (§1). |

**Default state:** sound is **ON** for a new user *(human)*. Matches today — UI clicks are unconditional and
the gateway chime defaults on. Discoverable by hearing it; off is one click away.

---

## 5c. The Sound tab in Settings ⭐

*(Human: "we need a global mute but also a sound by sound toggle, and thus maybe a sound … tab in setting")*

⚠ **NOT a new main tab.** Settings is TWO levels, and Sound belongs on the second:

```
  Look and feel  │  Controller  │  Hardware        main tabs
  ───────────────┴──────────────┴───────────
   Appearance │ Preview │ Editor │ ▸ Sound         SUB-tabs — Sound is the new one
```

*(Human: "maybe sound isnt as big a feature for a full tab and maybe can be added to existing one".)* ~11
toggle rows is too thin for a main tab and too big to bolt onto an existing page — a **sub-tab of Look and
feel, peer to Appearance**, is both.

⭐ And it is the semantically right home, not just a convenient one: **sound follows the theme**, and the
theme lives in Appearance. BACKLOG #2 moves the theme selector into Settings, which puts the picker in
Appearance **directly adjacent to Sound** — choosing `steampunk` picks a look AND a voice, and those should
be one click apart.

```
┌─ SOUND ──────────────────────────────────────┐
│  ☑ Sounds                       master mute  │
│  ──────────────────────────────────────────  │
│  Voice follows your theme  ·  studio         │
│                                              │
│  INTERFACE                                   │
│    ☑ Button click                      ▶     │
│    ☑ Wizard opened                     ▶     │
│    ☑ Operation inserted                ▶     │
│                                              │
│  JOBS                                        │
│    ☑ Job sent              swoosh      ▶     │
│    ☑ Job arrived        ding-dong      ▶     │
│    ☑ Job delivered       register      ▶     │
│    ☑ Job failed            buzzer      ▶     │
└──────────────────────────────────────────────┘
```

⭐⭐ **THE TAB RENDERS ITSELF FROM `ACTION`.** Add an entry to the map and the row appears here automatically,
with its toggle and its preview. **No per-sound UI work, ever.** This is the whole return on the layered
design — do not hand-write the list.

- ⭐ **The ▶ preview is not decoration.** Nobody can decide what to silence without hearing it first.
- ⭐ **Store only the EXCEPTIONS:** `sound: { master: true, off: ['ui.click'] }`. New actions then default
  ON, stored prefs stay tiny, and adding an action never needs a migration of saved workspaces.
- ⚠ **The per-sound prefs must reach the GATEWAY**, not just the browser. If the user silences
  `job.arrived`, the mill PC has to respect it — same channel as the master, or you ship a switch that lies
  on one machine.
- Group rows by the prefix in the action name (`ui.*`, `job.*`) so grouping is also derived, not hand-kept.

---

## 6. Not decided

- **Organic's accent is a separate open question** — its `--accent: #d97a5c` is commented *"coral / arterial"*
  and the human called it out as out of place. Candidates on the real ground are in the icon/colour thread;
  **honey `#c9973c`** is the recommendation, and `--edit-glow-rgb: 217,122,92` must move with it or the pink
  survives in the animation. ⛔ Not part of this build.
- Whether the toggle needs a per-producer readout beyond "gateway last picked this up at HH:MM".

---

## 7. Definition of done

1. One toggle, in the workspace, governing every producer. The gateway's own toggle removed.
2. `EVENT` and `THEME` as **declared data**, exactly the numbers above — not inlined into call sites.
3. All five themes × four events reachable, matching the artifact by ear.
4. A test asserting the five-axis separation holds: note counts `2/4/7`, `fail.oct === -1`, and `fail.steps`
   containing the tritone (`6`). These are what stop a later "tidy-up" from collapsing them back together.
5. `cd DDCS-Studio && npm test` — check the FAILED COUNT, not just the tail.
