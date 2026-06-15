/**
 * ui/cloud/providers.js — BYO cloud providers (browser-direct, NO server / no Worker). Each does PKCE OAuth
 * (public client, no secret) and exposes a files API for `.mjson` projects. Client IDs are PUBLIC (safe in the
 * browser) — register a PUBLIC / SPA OAuth app per provider, add the redirect URI below, and paste its client ID
 * (Settings → Network, stored in localStorage `ddcs_clientid_<id>`). No client SECRET is ever used or stored.
 *
 * Notes: Dropbox + Microsoft (OneDrive) do PKCE + the token exchange cleanly from a browser (CORS OK). Google's
 * token endpoint is fussier from a pure SPA — flagged `corsToken:false` (wire Google Identity Services later).
 */
const CFG = {
    google: {
        label: 'Google Drive',
        authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
        token: 'https://oauth2.googleapis.com/token',
        scope: 'https://www.googleapis.com/auth/drive.file',
        extraAuth: { access_type: 'offline', prompt: 'consent' },
        corsToken: false,   // Google's token endpoint blocks browser fetch — needs GIS (TODO)
    },
    dropbox: {
        label: 'Dropbox',
        authorize: 'https://www.dropbox.com/oauth2/authorize',
        token: 'https://api.dropboxapi.com/oauth2/token',
        scope: 'files.content.write files.content.read',
        extraAuth: { token_access_type: 'offline' },
        corsToken: true,
    },
    onedrive: {
        label: 'OneDrive',
        authorize: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        scope: 'Files.ReadWrite offline_access',
        extraAuth: {},
        corsToken: true,
    },
};

// Brand logos (inline SVG, 16px) for the connect buttons.
const ICONS = {
    google: '<svg width="16" height="16" viewBox="0 0 87.3 78" aria-hidden="true">'
        + '<path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>'
        + '<path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="#00ac47"/>'
        + '<path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>'
        + '<path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>'
        + '<path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>'
        + '<path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/></svg>',
    dropbox: '<svg width="16" height="16" viewBox="0 0 43 40" aria-hidden="true"><path fill="#0061FF" d="M12.6 0 0 8.1l8.7 7 12.8-7.9zM0 22.1l12.6 8.2 8.9-7.4-12.8-7.9zm21.5.8 8.9 7.4L43 22.1l-8.7-6.9zM43 8.1 30.4 0l-8.9 7.2 12.8 7.9zM21.5 24.5l-8.9 7.4-3.8-2.5v2.8l12.7 7.6 12.7-7.6v-2.8l-3.8 2.5z"/></svg>',
    onedrive: '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="#0364B8" d="M13.6 9.7a4.3 4.3 0 0 0-8.1-1.4A3.8 3.8 0 0 0 6 15.9h12.3a3.2 3.2 0 0 0 .4-6.4 3.7 3.7 0 0 0-5.1-.2z"/></svg>',
};

export const PROVIDER_IDS = Object.keys(CFG);
export function getProvider(id) { return CFG[id] || null; }
export function providerLabel(id) { return (CFG[id] || {}).label || id; }
export function providerIcon(id) { return ICONS[id] || ''; }

// Ship the developer's PUBLIC client IDs here (safe in the browser — no secret) so END USERS just click Connect,
// nothing to register. The SAME id serves every user (each authorizes it for their OWN cloud). Empty until you
// register the OAuth apps; a localStorage value overrides (dev / self-host). drive.file is non-sensitive → no
// Google app-verification needed.
const DEFAULT_CLIENT_IDS = { google: '', dropbox: '', onedrive: '' };

/** Public OAuth client ID for a provider — localStorage override, else the shipped default. */
export function clientId(id) {
    try { const v = localStorage.getItem('ddcs_clientid_' + id); if (v) return v; } catch (e) { /* */ }
    return DEFAULT_CLIENT_IDS[id] || '';
}
export function setClientId(id, v) {
    try { v ? localStorage.setItem('ddcs_clientid_' + id, v) : localStorage.removeItem('ddcs_clientid_' + id); } catch (e) { /* */ }
}

/** The redirect URI to register with each provider (our static relay page, on this origin). */
export const redirectUri = () => location.origin + '/oauth-callback.html';
