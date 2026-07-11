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

import { submitRating } from './analytics.js';   // t698 — POST stars+comment to the Worker /rate (D1 + AE)

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
/** The mailto for the "send by email" path — pre-fills the stars + comment (the offline / no-Worker fallback). */
function mailtoHref(stars, comment) {
    const subject = encodeURIComponent('DDCS Studio feedback');
    const starLine = stars ? '★'.repeat(stars) + '☆'.repeat(5 - stars) + ` (${stars}/5)\n\n` : '';
    const body = encodeURIComponent(starLine + (comment ? comment + '\n' : '') + '\n— — —\nDDCS Studio ' + (appVersion() ? 'V' + appVersion() : '(version unknown)'));
    return `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
}
/** Send feedback by email — the no-GitHub / offline path. A mailto pre-addressed to the maintainer, stars + comment prefilled. */
export function sendFeedback(stars, comment) {
    try { window.location.href = mailtoHref(stars, comment); } catch (_) { /* no mail client — the anchor href is the fallback */ }
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

/** Submit the rating form → POST to the Worker (stars 1–5 + optional comment), record done, thank, close. */
function submitForm(bar) {
    const stars = +bar.dataset.stars || 0;
    if (stars < 1) { bar.querySelector('.rate-stars').classList.add('rate-shake'); setTimeout(() => bar.querySelector('.rate-stars').classList.remove('rate-shake'), 400); return; }
    const comment = String((bar.querySelector('.rate-comment') || {}).value || '').slice(0, 500);
    submitRating({ stars, comment });   // fire-and-forget to the Worker (D1+AE); the offline path is "send by email"
    const s = loadState(); s.state = 'done'; saveState(s);
    track('rate_feedback');
    bar.innerHTML = '<div class="rate-head" style="margin:0;">🙏 Thanks for the feedback!</div>';
    setTimeout(removeToast, 1600);
}

export function showRateToast() {
    if (document.querySelector('.ddcs-rate-toast')) return;
    const bar = document.createElement('div');
    bar.className = 'ddcs-rate-toast';
    bar.dataset.stars = '0';
    // in-app-dialog styling (var tokens) — a small non-modal card. 5 stars (1–5) + an optional ≤500-char comment → Send.
    bar.innerHTML =
        '<div class="rate-head">Enjoying DDCS Studio?</div>'
        + '<div class="rate-stars" role="radiogroup" aria-label="Rating">'
        + [1, 2, 3, 4, 5].map((i) => `<button type="button" class="rate-star" data-v="${i}" role="radio" aria-checked="false" aria-label="${i} star${i > 1 ? 's' : ''}" title="${i}/5">★</button>`).join('')
        + '</div>'
        + '<textarea class="rate-comment" rows="2" maxlength="500" placeholder="Anything you\'d like to say? (optional)"></textarea>'
        + '<div class="rate-actions">'
        + '<button class="rate-btn rate-later" type="button">Later</button>'
        + '<button class="rate-btn rate-never" type="button">Never</button>'
        + '<span style="flex:1"></span>'
        + '<button class="rate-btn rate-submit primary" type="button">Send</button>'
        + '</div>'
        + '<div class="rate-alt">'
        + `<a class="rate-email" href="${mailtoHref(0, '')}">or send by email</a>`
        + `<a class="rate-github" href="${REPO_URL}" target="_blank" rel="noopener" title="Star the project on GitHub">⭐ star the project</a>`
        + '</div>';
    // stars: click sets 1–5, fills up to the chosen one
    const paint = () => { const v = +bar.dataset.stars; bar.querySelectorAll('.rate-star').forEach((b) => { const on = +b.dataset.v <= v; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(+b.dataset.v === v)); }); };
    bar.querySelectorAll('.rate-star').forEach((b) => b.addEventListener('click', () => { bar.dataset.stars = b.dataset.v; paint(); }));
    bar.querySelector('.rate-submit').addEventListener('click', () => submitForm(bar));
    bar.querySelector('.rate-email').addEventListener('click', (e) => { e.preventDefault(); sendFeedback(+bar.dataset.stars || 0, (bar.querySelector('.rate-comment') || {}).value || ''); });
    bar.querySelector('.rate-github').addEventListener('click', () => openRate('toast'));   // let the link navigate; also record done
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
    window.__ddcsRate = { shouldShowRate, RATE_TRIGGER, loadState, bumpSession, bumpInsert, onInsertComplete, openRate, sendFeedback, mailtoHref, submitRating };   // test hook
}
