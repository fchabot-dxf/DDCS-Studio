/**
 * ui/cloudAccount.js — cloud account login (BYO: Google Drive; relay stays separate), shared by Settings
 * (Network tab) and the Project Manager drawer. The OAuth flow lives in the Worker (the only safe place for the
 * client secret); this UI starts it and captures the token the Worker redirects back with. PROJECTS only — the
 * connected account backs the ☁ Cloud volume. See [[gateway-cloud-architecture]].
 *
 * Backend status: the Worker `/api/oauth/google/{start,callback}` endpoints are the NEXT build step — until they
 * exist, Connect navigates to that URL (so it "just works" once deployed) but needs a configured service base.
 */
import { getService } from './gateway/service.js';

const TOK = 'ddcs_cloud_token', PROV = 'ddcs_cloud_provider', EMAIL = 'ddcs_cloud_email';

export function getAccount() {
    try {
        return { connected: !!localStorage.getItem(TOK), provider: localStorage.getItem(PROV) || '', email: localStorage.getItem(EMAIL) || '' };
    } catch (e) { return { connected: false, provider: '', email: '' }; }
}

export function disconnect() {
    try { localStorage.removeItem(TOK); localStorage.removeItem(PROV); localStorage.removeItem(EMAIL); } catch (e) { /* */ }
    window.dispatchEvent(new CustomEvent('ddcs:cloud-account'));
}

/** Start the OAuth flow: hand off to the Worker, which logs the user in and redirects back with the token. */
export function connect(provider = 'google') {
    const svc = getService();
    if (!svc.base) {
        window.alert('Connect a cloud service first: Gateway → Console → Service (set the service URL). Then connect your '
            + provider + ' account here.');
        return;
    }
    const back = encodeURIComponent(location.href.split('?')[0]);
    location.href = `${svc.base.replace(/\/$/, '')}/api/oauth/${provider}/start?redirect=${back}`;
}

/** On load, capture a token the Worker redirected back with (?cloud_token=…&provider=…&email=…) and clean the URL. */
export function captureOAuthReturn() {
    try {
        const q = new URLSearchParams(location.search);
        const t = q.get('cloud_token');
        if (!t) return;
        localStorage.setItem(TOK, t);
        if (q.get('provider')) localStorage.setItem(PROV, q.get('provider'));
        if (q.get('email')) localStorage.setItem(EMAIL, q.get('email'));
        for (const k of ['cloud_token', 'provider', 'email']) q.delete(k);
        history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q.toString() : ''));
        window.dispatchEvent(new CustomEvent('ddcs:cloud-account'));
    } catch (e) { /* */ }
}

/** Supported BYO cloud providers — each maps to a Worker OAuth route /api/oauth/<id>/start. */
export const PROVIDERS = [
    { id: 'google', label: 'Google Drive' },
    { id: 'dropbox', label: 'Dropbox' },
    { id: 'onedrive', label: 'OneDrive' },
];
const provLabel = (id) => (PROVIDERS.find((p) => p.id === id) || {}).label || id;

/** Shared login UI rendered into `container` — used by Settings (Network) and the Project Manager drawer. */
export function renderCloudLogin(container) {
    if (!container) return;
    const a = getAccount();
    const wrap = document.createElement('div');
    wrap.className = 'cloud-login';
    const status = document.createElement('div');
    status.className = 'cloud-status' + (a.connected ? '' : ' muted');
    status.textContent = a.connected
        ? `Connected · ${provLabel(a.provider)}${a.email ? ' · ' + a.email : ''}`
        : 'Not connected — projects stay local until you connect a cloud account.';
    wrap.appendChild(status);

    if (a.connected) {
        const dc = document.createElement('button');
        dc.className = 'op-btn'; dc.textContent = 'Disconnect';
        dc.addEventListener('click', () => disconnect());
        wrap.appendChild(dc);
    } else {
        const row = document.createElement('div');
        row.className = 'cloud-providers';
        for (const p of PROVIDERS) {
            const b = document.createElement('button');
            b.className = 'op-btn'; b.textContent = '🔗 Connect ' + p.label;
            b.addEventListener('click', () => connect(p.id));
            row.appendChild(b);
        }
        wrap.appendChild(row);
    }

    container.replaceChildren(wrap);
    if (!container._cloudWired) {   // keep this mount in sync with account changes from anywhere
        container._cloudWired = true;
        window.addEventListener('ddcs:cloud-account', () => renderCloudLogin(container));
    }
}
