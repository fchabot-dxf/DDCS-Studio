/**
 * ui/cloud/pkce.js — browser-direct OAuth 2.0 PKCE (RFC 7636), no client secret, no server. Used for BYO cloud
 * (the user logs into their own Google/Dropbox/OneDrive). The verifier never leaves the browser; the code↔token
 * exchange is a plain fetch to the provider's token endpoint (public client). See ui/cloud/providers.js.
 */
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function randBytes(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; }
const randToken = (n = 32) => [...randBytes(n)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Make a PKCE verifier + its S256 challenge. */
export async function makeChallenge() {
    const verifier = b64url(randBytes(48).buffer);
    const dig = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return { verifier, challenge: b64url(dig) };
}

export const makeState = () => randToken(16);

/** Build the provider authorize URL (popup target). */
export function buildAuthUrl(p, { clientId, redirectUri, challenge, state }) {
    const q = new URLSearchParams({
        client_id: clientId, redirect_uri: redirectUri, response_type: 'code',
        scope: p.scope, code_challenge: challenge, code_challenge_method: 'S256', state,
        ...(p.extraAuth || {}),
    });
    return `${p.authorize}?${q.toString()}`;
}

/** Exchange the auth code for tokens (public client + PKCE verifier — no secret). Returns the provider's JSON. */
export async function exchangeCode(p, { code, clientId, redirectUri, verifier }) {
    const body = new URLSearchParams({
        grant_type: 'authorization_code', code, client_id: clientId,
        redirect_uri: redirectUri, code_verifier: verifier,
    });
    const r = await fetch(p.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    if (!r.ok) throw new Error(`token exchange ${r.status}`);
    return r.json();   // { access_token, refresh_token?, expires_in, ... }
}
