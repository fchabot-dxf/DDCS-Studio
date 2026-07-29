/**
 * ui/gatewayPanel.js — the GATEWAY app behind the header's app-switcher.
 *
 * The in-Studio face of the bridge: a sub-tab registry over the machine-side views, rendered into
 * #gateway-app, talking the shared /api seam via shared/js/client.js. Same seam serves a LOCAL gateway
 * (desktop app) or the CLOUD Worker (R2-backed) — set ?api=… to point at the cloud; the views don't change.
 * Only mounted when a gateway answers (gatewayStatus.js gates the tab), and only polls while visible.
 *
 * Layout (Studio workflow): Status · Send · Merge · Tracking · Files · Jobs · Console.
 */
import { makeClient, deriveStatus } from '../shared/js/client.js';
import { getService, adoptLocal, probeLocalGateway } from './gateway/service.js';   // t1325 — the loopback auto-probe + the adopted base
import { el, clear } from './gateway/util.js';
import statusView from './gateway/views/status.js';
import sendView from './gateway/views/send.js';
import mergeView from './gateway/views/merge.js';
import trackerView from './gateway/views/tracker.js';
import filesView from './gateway/views/files.js';
import jobsView from './gateway/views/jobs.js';
import consoleView from './gateway/views/admin.js';

const VIEWS = [statusView, sendView, mergeView, trackerView, filesView, jobsView, consoleView];
const POLL_MS = 1500;

let inited = false;
let visible = false;
let active = statusView;
let ctx = null;
let tabsEl = null;

export function initGatewayPanel() {
    if (inited) return;
    inited = true;
    const panel = document.getElementById('gateway-app');
    const head = el('div', { class: 'settings-head' });
    tabsEl = el('div', { class: 'settings-tabs' });
    head.append(tabsEl);
    const root = el('div', { class: 'gw-view' });
    panel.append(head, root);

    ctx = { client: makeClient(), root, status: null, refresh: () => activate(active) };
    VIEWS.forEach((v) => tabsEl.append(el('button', { class: 'settings-main-tab', onclick: () => activate(v) }, v.label)));
    activate(statusView);
    // t1325 — the affordance chain the Status message promises: it links here, this lands on the Console with the
    // daemon field focused. Proven to the pixel in the spec rather than left as two surfaces that merely agree in
    // wording ([[no-unasked-affordances-prove-wiring]]).
    window.ddcsGatewayGoConsole = () => {
        const console_ = VIEWS.find((v) => v.id === 'admin');
        if (!console_) return;
        activate(console_);
        setTimeout(() => { const f = document.getElementById('gw-daemon-url'); if (f) { f.focus(); f.scrollIntoView({ block: 'center' }); } }, 60);
    };
    setInterval(poll, POLL_MS);
}

export function setGatewayPanelVisible(on) {
    visible = on;
    if (on && inited) poll();
}

function activate(view) {
    active = view;
    [...tabsEl.children].forEach((t, i) => t.classList.toggle('active', VIEWS[i] === view));
    clear(ctx.root);
    view.mount(ctx);
}

// t1325 (USER, blocked live) — THE UNREACHABLE TICK GOES LOOKING. A page served from pages.dev has no gateway on
// its own origin, so "Local (this PC)" could only ever fail there — the concept predates the web deploy. On a tick
// that finds nothing, probe 127.0.0.1 on the registered ports; a gateway that answers its descriptor is adopted and
// remembered, and the panel rebuilds its client on the new base. ZERO configuration for the common case.
//
// It runs only when the user has NOT typed a base (theirs wins and must survive a failed probe), and only while the
// panel is visible — the poll's own gate — so a background tab never sprays loopback requests.
let probing = false;
async function autoAdoptLocal() {
    if (probing) return false;
    const svc = getService();
    if (svc.typed) return false;                     // an explicit URL is the user's word; never probe over it
    if (svc.adopted && ctx.client.mode === 'remote') return false;   // already on an adopted base that just failed — let the backoff ride
    probing = true;
    try {
        const found = await probeLocalGateway();
        if (!found) return false;
        adoptLocal(found.base);
        ctx.client = makeClient({ base: found.base });   // rebuild on the new base — no reload, the panel is live
        return true;
    } finally { probing = false; }
}

async function poll() {
    if (!visible) return;
    let desc = null;
    try { desc = await ctx.client.descriptor(); } catch { desc = null; }
    if (!desc) {
        // nothing answering where we are looking → look where a local daemon actually lives, then re-ask ONCE
        try { if (await autoAdoptLocal()) { try { desc = await ctx.client.descriptor(); } catch { desc = null; } } }
        catch { /* the probe is best-effort; a failed one must never break the tick */ }
    }
    ctx.status = deriveStatus(ctx.client, desc);
    if (active.onPoll) { try { await active.onPoll(ctx); } catch { /* transient */ } }
}
