// ui/sound.js — themed earcon suite (t2125, SOUND-PLAN.md).
//
// Two KINDS of sound, on purpose (SOUND-PLAN.md section 5 — an earlier "zero samples" draft was wrong
// and got corrected): UI actions (click, wizard open/close/insert) are looked at, not just heard, so they
// get THEMED SYNTHESIS — you're already watching the screen, and theming is the whole point. JOB events
// (arrived/delivered/failed) happen while you're away from the screen, so they keep the existing LEARNED
// WAV samples (a door chime / a cash register / a buzzer — see assets/audio/PROVENANCE.md): pitch/contour
// differences don't survive a running spindle, but a sound people already know a vocabulary for does. Both
// ends (this file, the gateway's chime.py) play the exact same three WAV files for job events.
//
// Four declared layers, none inlined into call sites:
//   ACTION = which action makes which sound, and which KIND (voice|sample)   (edit this for a new button)
//   EVENT  = a contour + a rhythm + an octave, for VOICE actions             identical in every theme
//   THEME  = a voice function + a base pitch                                identical across every event
//   (job samples are looked up straight from ACTION — no EVENT/THEME involvement; they're unthemed)
//
// EVENT/THEME are ported verbatim from the artifact SOUND-PLAN.md cites as its own spec
// (https://claude.ai/code/artifact/b3653ea6-f4e4-4eb6-9133-8cb9414c120c) — every number here is lifted
// from that page, not reinterpreted.

import { makeClient } from '../shared/js/client.js';   // t2129 — the declared transport seam; see syncGatewaySound

let ctx = null;
const live = [];

function ac() { return ctx || (ctx = new (window.AudioContext || window.webkitAudioContext)()); }

// t2134 — iOS SAFARI UNLOCK. resume().then(go) (renderAction, below) fixes the Android bug (a schedule raced
// ahead of the context's own clock) but does NOT fix iOS: Safari's autoplay policy requires the FIRST audio
// activity on a page to be a buffer STARTED synchronously inside a real touch/click gesture, or the hardware
// never opens for ANY later programmatic sound — no error, just permanent silence (confirmed on-device:
// Android worked before this listener existed, iOS did not). One document-level listener, fired once on the
// first real pointer/touch, constructs the (still-lazy) context and starts a 1-sample silent buffer — that
// single synchronous `start()` inside the gesture is what iOS actually checks; resume() alone is not enough.
if (typeof document !== 'undefined') {
    let unlocked = false;
    const unlock = () => {
        if (unlocked) return;
        unlocked = true;
        document.removeEventListener('pointerdown', unlock);
        document.removeEventListener('touchstart', unlock);
        try {
            const a = ac();
            const s = a.createBufferSource();
            s.buffer = a.createBuffer(1, 1, a.sampleRate);
            s.connect(a.destination);
            s.start(0);
            if (a.state === 'suspended') a.resume().catch(() => {});
        } catch (_) { /* audio unavailable — never break the page */ }
    };
    document.addEventListener('pointerdown', unlock, { passive: true });
    document.addEventListener('touchstart', unlock, { passive: true });
}

function noiseBuffer(a, ms) {
    const n = Math.max(1, Math.floor(a.sampleRate * ms / 1000));
    const b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
}
function env(a, t, g, atk, dur) {
    const n = a.createGain();
    n.gain.setValueAtTime(0, t);
    n.gain.linearRampToValueAtTime(g, t + atk);
    n.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return n;
}
// The standard waveshaper distortion curve. Higher k = more grit.
function shaper(a, k) {
    const ws = a.createWaveShaper(), n = 2048, c = new Float32Array(n), deg = Math.PI / 180;
    for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x)); }
    ws.curve = c; ws.oversample = '4x';
    return ws;
}
function osc(a, t, type, f, g, atk, dur, filt, ff, q, thru) {
    const o = a.createOscillator(), n = env(a, t, g, atk, dur);
    o.type = type; o.frequency.setValueAtTime(f, t);
    let head = o;
    if (thru) { o.connect(thru); head = thru; }
    if (filt) {
        const b = a.createBiquadFilter();
        b.type = filt; b.frequency.value = ff; if (q) b.Q.value = q;
        head.connect(b); b.connect(n);
    } else head.connect(n);
    n.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
    live.push(o);
}
function burst(a, t, ms, filt, ff, q, g, dur) {
    const s = a.createBufferSource(), b = a.createBiquadFilter(), n = a.createGain();
    s.buffer = noiseBuffer(a, ms);
    b.type = filt; b.frequency.value = ff; if (q) b.Q.value = q;
    n.gain.setValueAtTime(g, t);
    n.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(b); b.connect(n); n.connect(a.destination);
    s.start(t);
    live.push(s);
}

// ── THEME = a voice function + a base register. Identical across every EVENT. ──────────────────────────
export const THEME = {
    studio: { base: 392, voice(a, t, f, dur, g) {
        osc(a, t, 'sine', f, g * 1.0, 0.012, dur, 'lowpass', Math.max(900, f * 3));
        osc(a, t, 'sine', f * 2, g * 0.18, 0.014, dur * 0.7, 'lowpass', f * 4);
    } },
    futuristic: { base: 587, voice(a, t, f, dur, g) {
        // DISTORTED. The clean sine underneath is load-bearing: distortion smears pitch, and pitch is
        // what carries the contour — without the anchor the earcon structure collapses into texture.
        osc(a, t, 'sawtooth', f, g * 0.42, 0.003, dur, 'bandpass', f * 2.1, 1.4, shaper(a, 55));
        osc(a, t, 'square', f * 1.5, g * 0.16, 0.004, dur * 0.7, 'bandpass', f * 3, 2, shaper(a, 30));
        osc(a, t, 'sine', f, g * 0.30, 0.004, dur * 0.9);
        burst(a, t, 6, 'highpass', f * 3, 0, g * 0.45, 0.03);
    } },
    organic: { base: 330, voice(a, t, f, dur, g) {
        burst(a, t, 10, 'bandpass', f * 3.2, 5, g * 1.5, 0.05);
        osc(a, t, 'triangle', f, g * 1.05, 0.004, dur);
        osc(a, t, 'sine', f * 2.76, g * 0.16, 0.004, dur * 0.45);
    } },
    steampunk: { base: 523, voice(a, t, f, dur, g) {
        // A REAL BELL, not a brass tone: strongly INHARMONIC partials — a near-integer series sounds like
        // an organ stop. The tierce at 1.2 (a minor third above the prime) is the signature partial. High
        // partials die first, as in a real casting.
        //                    ratio  gain  ring
        const P = [ [0.50, 0.34, 2.00],    // hum, an octave below — the body
                    [1.00, 1.00, 1.70],    // prime
                    [1.20, 0.62, 1.35],    // TIERCE — the bell signature
                    [1.50, 0.44, 1.15],    // quint
                    [2.00, 0.40, 0.95],    // nominal
                    [2.50, 0.20, 0.62],
                    [3.00, 0.14, 0.48],
                    [4.20, 0.08, 0.32] ];
        P.forEach((p) => osc(a, t, 'sine', f * p[0], g * p[1] * 0.46, 0.002, (dur * 0.55 + 1.05) * p[2]));
        burst(a, t, 7, 'highpass', 4400, 0, g * 0.85, 0.032);   // the clapper: a short bright transient
    } },
    normal: { base: 440, voice(a, t, f, dur, g) { osc(a, t, 'sine', f, g, 0.006, dur); } },
};

// ── EVENT = a contour (semitones) + a rhythm (onset, dur, gain), for VOICE (synthesized) actions.
// Identical across every THEME. Separates on FIVE axes at once — note count, tempo, interval quality,
// register, length (SOUND-PLAN.md section 3). ⛔ Do not "simplify" these into a shared rhythm or a shared
// pitch set — an earlier draft used the same major triad rearranged for all three and the human could not
// tell them apart inside one theme, which is the only comparison that exists in real use.
const st = (n) => Math.pow(2, n / 12);
export const EVENT = {
    // ARRIVES — sparse and patient. TWO notes, a rising perfect fifth left hanging.
    in: { oct: 0,
        steps: [0, 7],
        rhy: [[0, .30, .26], [.24, .80, .28]] },
    // DELIVERED — a quick rising run landing on the OCTAVE and ringing.
    done: { oct: 0,
        steps: [0, 4, 7, 12],
        rhy: [[0, .13, .22], [.09, .13, .22], [.18, .13, .24], [.27, .95, .30]] },
    // COMMIT — a LIGHTER event for things done often (an op insert, a file save): the same rising-to-the-
    // octave meaning as `done`, at a third of the length. `done` stays declared and available — an insert
    // you do fifty times an afternoon needs something shorter than a job delivered a few times an hour.
    commit: { oct: 0,
        steps: [0, 12],
        rhy: [[0, .10, .24], [.07, .34, .28]] },
    // FAILED — SEVEN fast notes oscillating on a TRITONE, an octave below everything else. Dissonance is
    // CATEGORICAL, not a matter of degree — this is the axis doing the real work.
    fail: { oct: -1,
        steps: [0, 6, 0, 6, 0, 6, 0],
        rhy: [[0, .10, .30], [.068, .10, .28], [.136, .10, .30], [.204, .10, .28],
              [.272, .10, .30], [.340, .10, .28], [.408, .20, .32]] },
};

// ── JOB SAMPLES — the existing LEARNED WAVs (SOUND-PLAN.md section 5: an earlier "zero samples" draft
// nearly destroyed this design — pitch/contour differences don't survive a running spindle, but a sound
// people already know a vocabulary for does; see assets/audio/PROVENANCE.md for the human's own ruling).
// Unthemed, played straight — the exact same three files the gateway's chime.py plays for the same event.
const SAMPLE_DIR = 'assets/audio/';
const sampleCache = new Map();   // filename -> HTMLAudioElement, loaded once
function sampleFor(filename) {
    let a = sampleCache.get(filename);
    if (!a) { a = new Audio(SAMPLE_DIR + filename); a.preload = 'auto'; sampleCache.set(filename, a); }
    return a;
}

// ── SWOOSH (job.sent) — a CLIENT-ONLY sound, synthesized rather than sourced (SOUND-PLAN.md amendment 3):
// filtered noise plus a falling frequency sweep, the same "acceptable fallback" shape the plan names for a
// learned sound that also synthesises convincingly. Unthemed, like the other job sounds — this marks the
// moment a job LEAVES this browser; job.arrived/delivered/failed are the gateway's own, at the machine.
function playSwoosh(a, t) {
    const s = a.createBufferSource(), b = a.createBiquadFilter(), n = a.createGain();
    s.buffer = noiseBuffer(a, 220);
    b.type = 'bandpass'; b.Q.value = 0.9;
    b.frequency.setValueAtTime(2600, t);
    b.frequency.exponentialRampToValueAtTime(450, t + 0.2);   // falling sweep — "departing"
    n.gain.setValueAtTime(0.0001, t);
    n.gain.linearRampToValueAtTime(0.34, t + 0.03);
    n.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    s.connect(b); b.connect(n); n.connect(a.destination);
    s.start(t);
    live.push(s);
}

// ── ACTION = which action makes which sound, and which KIND. Pure inert data — the only file anyone
// edits to give a button a voice. Giving any button in the app a sound: one line here, one sfx('name') at
// the call site — zero edits to synthesis, zero edits to EVENT/THEME (SOUND-PLAN.md section 3b). TWO
// kinds of source live in this one declaration: a themed synthesised `voice` (+ optional semitone shift —
// a variant costs one line and no new synthesis), or a learned `sample` (job events only, never themed).
export const ACTION = {
    // UI: themed synthesis. You are looking at the screen.
    // t2229 (BACKLOG F3a, human ruling 2026-08-22) — DELETED: ui.click/ui.toggle/wizard.opened/wizard.closed/
    // keyboard.opened. The generalised rule: a sound is only justified when the state it reports is NOT
    // already visible on screen — every one of these five fires for something the eye already sees the
    // instant it happens (a click landing, a panel opening/closing). ui.click/ui.toggle already had zero live
    // callers (grepped the whole web/ tree). wizard.opened/wizard.closed (wizardManager.js) and
    // keyboard.opened (app.js) DID have real callers — those calls are removed in the same turn, not left
    // dangling to silently no-op + console.warn forever.
    // block.snap is the human's own named EXCEPTION ("ambiguous enough to be kept audible" — a dragged block
    // connecting into a stack has no other on-screen confirmation as immediate as the snap itself). Wired at
    // its one real source, blocks/blocksApp.js's own workspace change listener (Blockly's MOVE event with
    // reason including 'connect' — verified live, not assumed from the vendored .d.ts, which doesn't cover
    // event shapes at all).
    'block.snap': { voice: 'click', semitones: 2 },        // a light lift, distinct from wizard.opened's +5 (already gone) — a snap is a small confirmation, not a scene change
    'wizard.inserted': { voice: 'commit' },                // ⭐ lighter than `done` — see EVENT.commit above
    'file.saved': { voice: 'commit' },
    // t2125 (section 5b) — the Blocks-canvas equivalent of Blockly's OWN playErrorBeep(), now muted (see
    // blocksApp.js's inject options): a refused connection (blocks/blockly/tokenGuard.js).
    'error': { voice: 'click', semitones: -5 },

    // JOB, GATEWAY SIDE: the LEARNED sounds. You are away from the screen. NOT themed, NOT synthesised.
    // WHERE: these three play on the GATEWAY ONLY (chime.py) — never called from this browser's own code.
    // Declared here anyway so the Settings Sound tab can still show + preview them (SOUND-PLAN.md amendment 3/4).
    'job.arrived': { sample: '361564__matthewwong__ding-dong.wav' },
    'job.delivered': { sample: '209578__zott820__cash-register-purchase.wav' },
    'job.failed': { sample: '700641__producing_raylite__incorrect-buzzer.wav' },
    // JOB, CLIENT SIDE: marks the moment a job LEAVES this browser. WHERE: CLIENT ONLY — the gateway never
    // plays this. Synthesized, not sourced (human-chosen fallback, t2125).
    'job.sent': { synth: 'swoosh' },
};

function playVoice(a, t, themeName, voiceName, semitoneShift) {
    const th = THEME[themeName] || THEME.normal;
    if (voiceName === 'click') {
        // Feedback, not an earcon: one transient, no contour.
        th.voice(a, t, th.base * st(-5 + (semitoneShift || 0)), 0.055, 0.22);
        return;
    }
    const ev = EVENT[voiceName];
    if (!ev) return;
    const oct = Math.pow(2, ev.oct || 0);
    ev.rhy.forEach((r, i) => {
        const f = th.base * oct * st(ev.steps[i] + (semitoneShift || 0));
        th.voice(a, t + r[0], f, r[1], r[2]);
    });
}

function currentTheme() {
    try {
        const tm = window.ddcsStudio && window.ddcsStudio.themeManager;
        return (tm && tm.getCurrent && tm.getCurrent()) || 'normal';
    } catch (_) { return 'normal'; }
}
// t2125 (SOUND-PLAN.md amendments 3/4) — a MASTER mute plus a PER-SOUND toggle. Storage is EXCEPTIONS ONLY:
// `sound.off` lists just the action names someone silenced. A new ACTION defaults ON with zero migration,
// and a saved workspace's stored prefs stay tiny no matter how many sounds the app grows.
function masterOn() {
    try { const s = window.ddcsGetSettings(); return !s.sound || s.sound.enabled !== false; } catch (_) { return true; }
}
export function isActionOn(actionName) {
    try {
        const s = window.ddcsGetSettings();
        return !(s.sound && Array.isArray(s.sound.off) && s.sound.off.includes(actionName));
    } catch (_) { return true; }
}

const MAX_CONCURRENT = 8, DEBOUNCE_MS = 60;
let concurrent = 0;
const lastFired = new Map();     // action name -> ms timestamp, for the coalesce window
const warnedUnknown = new Set(); // log an unknown action once, not once per click

function renderAction(action, themeName) {
    if (action.sample) {
        try {
            const el = sampleFor(action.sample);
            el.currentTime = 0;
            el.play().catch(() => {});
        } catch (_) { /* audio unavailable — never break the caller */ }
        return;
    }
    try {
        const a = ac();
        // t2134 — MOBILE SILENCE FIX (found live on a phone, V2026.08.22.1). A fresh/suspended AudioContext's
        // `currentTime` stays frozen at (near) 0 until `resume()` actually settles. The old code read
        // `a.currentTime` and scheduled `.start(t)` on it BEFORE `resume()` was even called — by the time
        // resume completes and the clock starts moving, `t` is already in the past, so the node plays into
        // dead air with no error (silent, not broken-looking — why every check here passed). `resume()` is
        // still CALLED synchronously, inside the caller's gesture (that's the part autoplay policy actually
        // checks) — only the SCHEDULING (which reads currentTime) waits for the promise to settle, so `t` is
        // read fresh, after the clock is actually running.
        const go = () => {
            if (action.synth === 'swoosh') playSwoosh(a, a.currentTime + 0.01);
            else playVoice(a, a.currentTime + 0.01, themeName, action.voice, action.semitones || 0);
        };
        if (a.state === 'suspended') a.resume().then(go).catch(() => {});
        else go();
    } catch (_) { /* audio unavailable — never break the caller */ }
}

/**
 * The ONE entry point every call site uses: `sfx('job.delivered')`. Owns the toggle check — BOTH the
 * master switch and this action's own per-sound off-list, so no caller can forget either — the theme
 * resolution for voice actions (callers never name a voice), debounce, and the concurrent-voice cap. An
 * unknown action is silent, never a throw — a typo in a string must not break a save button.
 */
export function sfx(actionName) {
    if (!masterOn() || !isActionOn(actionName)) return;
    const action = ACTION[actionName];
    if (action === undefined) {
        if (!warnedUnknown.has(actionName)) { warnedUnknown.add(actionName); console.warn('sfx: unknown action', actionName); }
        return;
    }
    const now = Date.now();
    const last = lastFired.get(actionName);
    if (last != null && now - last < DEBOUNCE_MS) return;   // coalesce a held/double-clicked button
    lastFired.set(actionName, now);
    if (concurrent >= MAX_CONCURRENT) return;
    concurrent++;
    setTimeout(() => { concurrent = Math.max(0, concurrent - 1); }, 1500);
    renderAction(action, currentTheme());
}

/**
 * Preview a sound from the Settings Sound tab REGARDLESS of the master switch or this action's own
 * off-list — "nobody can decide what to silence without hearing it first" only works if muting a sound
 * doesn't also mute its own preview button.
 */
export function previewSfx(actionName) {
    const action = ACTION[actionName];
    if (action === undefined) return;
    renderAction(action, currentTheme());
}

// ── Gateway sync (SOUND-PLAN.md section 1 + amendment 3) ────────────────────────────────────────────
// The gateway runs in a different process, possibly on a different PC. Its chime.py plays the SAME three
// job-event WAV files this module does (SAMPLE_DIR above) — unthemed, so there is no theme to push, only
// the master toggle AND the per-sound off-list (a silenced job.arrived must stay silenced on the mill PC
// too, or the switch lies on one machine). Push both whenever either changes, from the one place they
// change (the Settings Sound tab). Fire-and-forget: nothing ever blocks on this, and callers read the
// outcome via getGatewaySyncStatus() rather than assuming success — flipping a toggle while the gateway is
// offline must not be reported as instant.
let _lastSync = { at: null, ok: null, error: '' };
export function getGatewaySyncStatus() { return { ..._lastSync }; }

export async function syncGatewaySound() {
    let enabled = true, off = [];
    try {
        const s = window.ddcsGetSettings();
        enabled = !s.sound || s.sound.enabled !== false;
        off = (s.sound && Array.isArray(s.sound.off)) ? s.sound.off : [];
    } catch (_) { /* settings not loaded yet */ }
    try {
        // t2129 (review, BLOCKER B) — a bare fetch('/api/config') is same-origin ONLY, so on the hosted
        // deploy (ddcs-studio.pages.dev) it posts to pages.dev, never to the adopted gateway at
        // 127.0.0.1:8765 — sound prefs silently stop reaching the mill PC while jobs (routed through
        // makeClient()) keep working, exactly the "switch that lies on one machine" SOUND-PLAN.md section
        // 5c warns about. makeClient()'s own resolveBase() picks up the SAME auto-adopted base every other
        // gateway call already uses. Its call()/postJSON also does the HTTP-level r.ok check a bare fetch
        // skipped (a 403 CSRF refusal or a non-JSON body now throws here instead of silently reading as
        // success — closes B-prime too).
        const client = makeClient();
        const j = await client.setConfig({ sound_enabled: enabled, sound_off: off });
        _lastSync = { at: Date.now(), ok: !(j && j.ok === false), error: (j && j.error) || '' };
    } catch (e) {
        // No gateway reachable on this device (the common case for a browser-only session), or the request
        // itself failed (bad HTTP status, malformed JSON) — either way, honestly unconfirmed, not success.
        _lastSync = { at: Date.now(), ok: false, error: (e && e.message) || 'gateway unreachable' };
    }
    return _lastSync;
}
