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
    tabsEl = el('div', { class: 'tabs' });
    const root = el('div', { class: 'gw-view' });
    panel.append(tabsEl, root);

    ctx = { client: makeClient(), root, status: null, refresh: () => activate(active) };
    VIEWS.forEach((v) => tabsEl.append(el('div', { class: 'tab', onclick: () => activate(v) }, v.label)));
    activate(statusView);
    setInterval(poll, POLL_MS);
}

export function setGatewayPanelVisible(on) {
    visible = on;
    if (on && inited) poll();
}

function activate(view) {
    active = view;
    [...tabsEl.children].forEach((t, i) => t.classList.toggle('on', VIEWS[i] === view));
    clear(ctx.root);
    view.mount(ctx);
}

async function poll() {
    if (!visible) return;
    let desc = null;
    try { desc = await ctx.client.descriptor(); } catch { desc = null; }
    ctx.status = deriveStatus(ctx.client, desc);
    if (active.onPoll) { try { await active.onPoll(ctx); } catch { /* transient */ } }
}
