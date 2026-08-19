/**
 * ui/headerAccount.js — THE ONE ACCOUNT DOOR, in the top header (t2077).
 *
 * ── WHY IT IS HERE, AND WHY IT IS ONE ────────────────────────────────────────────────────────────────────────────
 * Signing in was reachable from TWO places that looked independent and read DIFFERENT state — the Projects/Library
 * cloud account (localStorage) and the Gateway ▸ Setup "Connect Google Drive" (polls the gateway). In the exe they
 * secretly share ONE credential (`cloudAccount.connectGoogleDesktop()` and the Setup button both hit the gateway's
 * `/oauth/google/start`, and `oauth.py` persists to the same `~/.ddcs-bridge/google_token.json`) — so a user could
 * connect in one, see the other still say "not connected", and reasonably conclude it had failed. The human hit
 * exactly that and asked for one login.
 *
 * It sits in the HEADER because it is a first-run action ("one of the first things we do on a first use"), not a
 * setting you go hunting for. It is given real width — a signed-out state that reads "Sign in", not a bare glyph —
 * for the same reason.
 *
 * ⚠ ONE ACCOUNT, TWO FEATURES — the distinction the old two-button layout destroyed. Connecting here signs in the
 * ACCOUNT. What that account is then USED for stays where it belongs: saving projects (Library) and sending jobs
 * through Drive (Gateway ▸ Setup's backend toggle). This never turns a feature on by itself — signing in must not
 * silently start routing a user's G-code through the cloud.
 *
 * THE AVATAR costs no extra permission: `photoLink` comes from Drive's OWN `about.get` (see googleDrive.js
 * getUserInfo), so consent stays `drive.file`-only — asking for `userinfo.profile` to get a picture would widen the
 * consent screen into sensitive scopes and drag the app into Google verification. Initials are the fallback, and a
 * broken/expired photo URL falls back to them too rather than showing a dead image.
 */
import { getAccount, connect, disconnect } from './cloudAccount.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Initials from a display name or, failing that, an email — the avatar fallback. */
function initials(acct) {
    const src = (acct.name || acct.email || '').trim();
    if (!src) return '?';
    const parts = src.replace(/@.*$/, '').split(/[\s._-]+/).filter(Boolean);
    return ((parts[0] || '')[0] + (parts.length > 1 ? (parts[parts.length - 1] || '')[0] : '')).toUpperCase() || '?';
}

let _menuOpen = false;

function closeMenu() {
    const m = document.getElementById('hdrAcctMenu');
    if (m) m.remove();
    _menuOpen = false;
}

function openMenu(anchor, acct) {
    closeMenu();
    _menuOpen = true;
    const m = document.createElement('div');
    m.id = 'hdrAcctMenu';
    m.className = 'scale-pop hdr-acct-menu';
    m.setAttribute('role', 'menu');
    m.innerHTML =
        `<div class="hdr-acct-who">`
        + `<div class="hdr-acct-name">${esc(acct.name || 'Signed in')}</div>`
        + (acct.email ? `<div class="hdr-acct-mail">${esc(acct.email)}</div>` : '')
        + `</div>`
        // Says what the account IS FOR, because signing in does not by itself enable either feature.
        + `<div class="hdr-acct-note">Used for saving projects, and for sending jobs through Drive when that is turned on in Gateway → Setup.</div>`
        + `<button type="button" class="hdr-acct-act" data-act="signout">Sign out</button>`;
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect();
    m.style.position = 'fixed';
    m.style.top = (r.bottom + 6) + 'px';
    // keep it on screen when the header sits near the right edge
    m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - m.offsetWidth - 8)) + 'px';
    m.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        if (b.dataset.act === 'signout') { disconnect(); closeMenu(); }
    });
}

document.addEventListener('click', (e) => {
    if (!_menuOpen) return;
    if (e.target.closest('#hdrAcctMenu') || e.target.closest('#hdrAccount')) return;
    closeMenu();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && _menuOpen) closeMenu(); });

export function renderHeaderAccount() {
    const host = document.getElementById('hdrAccount');
    if (!host) return;
    const acct = getAccount();

    if (!acct.connected) {
        // t2077 (human: "when not logged in, use a login button or icon") — a plain LOGIN affordance: a
        // sign-in arrow + the word "Sign in", styled as an actual button. Deliberately NOT the Google
        // wordmark/logo here: the header should say what the CONTROL does ("sign in"), not advertise a
        // provider — and Drive is one backend among several the account layer already models
        // (providers.js carries Dropbox/OneDrive slots). Which provider is used is the flow's business.
        // The label collapses to the icon alone on a narrow header (.is-compact), so it degrades to an icon.
        // ⭐ JUST THE AVATAR — the universal convention (Google, GitHub): a generic silhouette when signed out,
        // the real photo when signed in. ONE round control in both states, so the header neither jumps nor
        // restyles itself the moment you sign in; only what is INSIDE the circle changes. No text label: the
        // header is dense, and a word here would be the only one of its kind among icon controls.
        // The silhouette is FILLED (not an outline) so it reads as an avatar placeholder rather than a button
        // glyph — an outline ring reads as "icon", a filled bust reads as "person".
        host.className = 'hdr-acct signed-out';
        host.innerHTML =
            `<button type="button" class="hdr-acct-btn" aria-label="Sign in" title="Sign in — save projects to your own cloud, and send jobs to the machine from anywhere">`
            + `<span class="hdr-acct-slot" aria-hidden="true">`
            + `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">`
            + `<circle cx="12" cy="8.6" r="3.9"/><path d="M12 13.6c-3.6 0-6.6 2.2-7.7 5.3a10 10 0 0 0 15.4 0c-1.1-3.1-4.1-5.3-7.7-5.3z"/>`
            + `</svg></span></button>`;
        host.querySelector('button').onclick = () => connect('google');
        return;
    }

    host.className = 'hdr-acct signed-in';
    const pic = acct.picture
        // referrerpolicy: Google's photo CDN 403s a request carrying an unexpected referrer, which would show a
        // broken image where a face should be. onerror falls back to initials rather than leaving a dead icon.
        ? `<img class="hdr-acct-pic" src="${esc(acct.picture)}" alt="" referrerpolicy="no-referrer"
              onerror="this.remove();this.closest('.hdr-acct-btn').querySelector('.hdr-acct-ini').hidden=false">`
        : '';
    // Signed in: the SAME single round control, now carrying the real photo (or initials if there is none /
    // the photo fails to load). The name and email live in the popover, not the header — one circle, always.
    host.innerHTML =
        `<button type="button" class="hdr-acct-btn" aria-label="Account: ${esc(acct.name || acct.email || 'signed in')}" title="${esc(acct.name || acct.email || 'Signed in')} — click for account options">`
        + `<span class="hdr-acct-slot">`
        + pic
        + `<span class="hdr-acct-ini"${acct.picture ? ' hidden' : ''}>${esc(initials(acct))}</span>`
        + `</span></button>`;
    host.querySelector('button').onclick = (e) => {
        if (_menuOpen) { closeMenu(); return; }
        openMenu(e.currentTarget, acct);
    };
}

// ONE source of truth for "is there an account": cloudAccount fires this on every connect/disconnect/identity
// resolve, so every surface that shows account state re-renders from the same event instead of polling.
window.addEventListener('ddcs:cloud-account', renderHeaderAccount);

export function initHeaderAccount() { renderHeaderAccount(); }
