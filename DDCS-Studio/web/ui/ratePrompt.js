/**
 * ui/ratePrompt.js — the "Rate / Feedback" prompt (t598). A success-moment ask, DECLARED not scattered.
 *
 * One data object (RATE_TRIGGER) holds every threshold/cooldown — no `if` sprinkled across the app. The trigger GATE
 * (shouldShowRate) is a PURE function of the persisted state + config + now + version, so every combo is unit-testable.
 * The prompt fires ONLY right after a successful wizard INSERT (the success moment) when the gate passes and no sim is
 * running; a small dismissible TOAST (GUI-first, no modal) offers Rate / Later / Never. An always-available '⭐ Rate /
 * Feedback' header-menu entry is the unprompted path. Analytics are fire-and-forget via window.ddcsTrack (a no-op until
 * the analytics Worker URL is configured).
 */

// The ONE declared trigger config — thresholds + cooldowns, readable + tweakable in one place.
export const RATE_TRIGGER = { minSessions: 2, minInserts: 5, cooldownLaterDays: 14, oncePerVersion: true };

const REPO_URL = 'https://github.com/fchabot-dxf/DDCS-Studio';
// t598 (human amendment) — 'Send feedback' reaches the maintainer directly (for users without a GitHub account). The
// address is BAKED into the shipped app (accepted scraper exposure — swappable for an alias later).
const FEEDBACK_EMAIL = 'dansemur@gmail.com';
const STORE_KEY = 'ddcs_rate';
const DAY_MS = 24 * 60 * 60 * 1000;

// --- state (persisted in localStorage) -----------------------------------------------------------------------------
// { sessionCount, successfulInserts, lastSessionDay, state: ''|'later'|'never'|'done', laterUntil, shownForVersion }
function loadState() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (_) { return {}; }
}
function saveState(s) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (_) { /* private mode / quota — the prompt is optional */ }
}

// The app version (the header .ver chip, e.g. "V10.99" → "10.99") for oncePerVersion. '' when absent.
function appVersion() {
    try { const m = (document.querySelector('.ver')?.textContent || '').match(/(\d+(?:\.\d+)+)/); return m ? m[1] : ''; } catch (_) { return ''; }
}
const track = (ev) => { try { (window.ddcsTrack || (() => {}))(ev); } catch (_) { /* analytics is fire-and-forget */ } };
// A sim is "running" when any preview's Play button is active (createPreviewPanel toggles .pp-run.on) — suppress the ask then.
function simRunning() { try { return !!document.querySelector('.pp-run.on'); } catch (_) { return false; } }

/**
 * THE PURE TRIGGER GATE. Given the persisted `state`, the `cfg` (RATE_TRIGGER), `nowMs`, and the current `version`,
 * should the rate prompt show? No side effects — every threshold/cooldown/version/state combo is a pure-data case.
 */
export function shouldShowRate(state, cfg, nowMs, version) {
    const s = state || {}, c = cfg || RATE_TRIGGER;
    if (s.state === 'never' || s.state === 'done') return false;             // permanent opt-out / already rated
    if ((s.sessionCount || 0) < c.minSessions) return false;                 // not enough sessions yet
    if ((s.successfulInserts || 0) < c.minInserts) return false;            // not enough successful inserts yet
    if (s.state === 'later' && s.laterUntil && nowMs < s.laterUntil) return false;   // in the "Later" cooldown
    if (c.oncePerVersion && s.shownForVersion && s.shownForVersion === version) return false;   // already shown this version
    return true;
}

// --- counters ------------------------------------------------------------------------------------------------------
/** Bump the session counter ONCE per calendar day (per app boot/day), not per navigation. */
export function bumpSession() {
    const s = loadState();
    const today = new Date().toISOString().slice(0, 10);
    if (s.lastSessionDay !== today) { s.sessionCount = (s.sessionCount || 0) + 1; s.lastSessionDay = today; saveState(s); }
    return s;
}
/** Bump the successful-insert counter (called on a completed wizard INSERT). */
export function bumpInsert() {
    const s = loadState(); s.successfulInserts = (s.successfulInserts || 0) + 1; saveState(s); return s;
}

// --- the toast UI (dismissible; NO modal) --------------------------------------------------------------------------
function removeToast() { const t = document.querySelector('.ddcs-rate-toast'); if (t) t.remove(); }

/** Open the GitHub repo (star / feedback) + record done — shared by the toast Rate button AND the header-menu entry. */
export function openRate(source) {
    try { window.open(REPO_URL, '_blank', 'noopener'); } catch (_) { /* popup blocked — the anchor href is the fallback */ }
    const s = loadState(); s.state = 'done'; saveState(s);
    track('rate_clicked');
    removeToast();
}
/** Send feedback by email — the no-GitHub path. A mailto pre-addressed to the maintainer, subject + version-prefilled body. */
export function sendFeedback() {
    const subject = encodeURIComponent('DDCS Studio feedback');
    const body = encodeURIComponent('\n\n\n— — —\nDDCS Studio ' + (appVersion() ? 'V' + appVersion() : '(version unknown)'));
    try { window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`; } catch (_) { /* no mail client — the anchor href is the fallback */ }
    const s = loadState(); s.state = 'done'; saveState(s);
    track('rate_feedback');
    removeToast();
}
function later() {
    const s = loadState(); s.state = 'later'; s.laterUntil = Date.now() + RATE_TRIGGER.cooldownLaterDays * DAY_MS; saveState(s);
    track('rate_later'); removeToast();
}
function never() {
    const s = loadState(); s.state = 'never'; saveState(s);
    track('rate_never'); removeToast();
}

export function showRateToast() {
    if (document.querySelector('.ddcs-rate-toast')) return;
    const bar = document.createElement('div');
    bar.className = 'ddcs-rate-toast';
    bar.innerHTML = '<span class="rate-msg">Enjoying DDCS Studio? </span>'
        + `<a class="rate-btn rate-go" href="${REPO_URL}" target="_blank" rel="noopener">⭐ Rate on GitHub</a>`
        + `<a class="rate-btn rate-feedback" href="mailto:${FEEDBACK_EMAIL}">✉ Send feedback</a>`
        + '<button class="rate-btn rate-later" type="button">Later</button>'
        + '<button class="rate-btn rate-never" type="button">Never</button>';
    bar.querySelector('.rate-go').addEventListener('click', (e) => { e.preventDefault(); openRate('toast'); });
    bar.querySelector('.rate-feedback').addEventListener('click', (e) => { e.preventDefault(); sendFeedback(); });
    bar.querySelector('.rate-later').addEventListener('click', later);
    bar.querySelector('.rate-never').addEventListener('click', never);
    document.body.appendChild(bar);
}

// --- the trigger: called right AFTER a successful insert (the success moment) --------------------------------------
function onInsertComplete() {
    const s = bumpInsert();
    if (simRunning()) return;                                     // a sim is mid-run — don't interrupt the success moment
    const v = appVersion();
    if (!shouldShowRate(s, RATE_TRIGGER, Date.now(), v)) return;
    s.shownForVersion = v; saveState(s);                          // record the shown version so oncePerVersion holds
    track('rate_shown');
    showRateToast();
}

/** Wire the prompt: bump the session on boot, listen for a completed insert, expose the always-available menu opener. */
export function initRatePrompt() {
    bumpSession();
    window.addEventListener('ddcs:op-inserted', onInsertComplete);
    // the header ⋮ menu "⭐ Rate / Feedback" entry (unprompted path) — shows the toast so the user picks EITHER destination
    // (GitHub star OR email feedback). Distinct from the auto-prompt (this never records shownForVersion — it's on demand).
    window.ddcsOpenRate = () => showRateToast();
    window.__ddcsRate = { shouldShowRate, RATE_TRIGGER, loadState, bumpSession, bumpInsert, onInsertComplete, openRate, sendFeedback };   // test hook
}
