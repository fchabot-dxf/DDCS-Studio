/**
 * ui/gatewayPanel.js — the GATEWAY app behind the header's app-switcher (COMBINED-APP-PLAN Step 2).
 *
 * Ports the fairy console shell: a sub-tab registry over the machine-side views (Submit, Queue/Tracker,
 * Files, History, Setup) rendered into #gateway-app. Views are verbatim copies from the fairy UI
 * (ui/gateway/views/) talking the same /api seam via shared/js/client.js. Only mounted when a gateway
 * answers (gatewayStatus.js gates the tab), and only polls while visible.
 */
import { makeClient, deriveStatus } from '../shared/js/client.js';
import { el, clear } from './gateway/util.js';
import trackerView from './gateway/views/tracker.js';
import submitView from './gateway/views/submit.js';
import queueView from './gateway/views/queue.js';
import filesView from './gateway/views/files.js';
import historyView from './gateway/views/history.js';
import adminView from './gateway/views/admin.js';
import watchView from './gateway/views/watch.js';

const VIEWS = [trackerView, watchView, queueView, submitView, filesView, historyView, adminView];
const POLL_MS = 1500;

let inited = false;
let visible = false;
let active = trackerView;
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
    activate(trackerView);
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
