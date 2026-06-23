"""oauth.py — desktop (loopback) OAuth so the EXE's embedded webview can sign in to Google Drive.

The webview can't run Google's GIS popup flow (popup_failed_to_open, and Google blocks OAuth inside
embedded webviews), so we use the installed-app pattern: consent in the SYSTEM browser, redirect to
http://127.0.0.1:<gateway-port>/oauth/google/callback, and exchange the code SERVER-SIDE here — no
browser CORS, no embedded-UA block. Public PKCE client (no secret).

Tokens persist in ~/.ddcs-bridge/google_token.json — NEVER in the profile (the refresh token is a
secret and the profile syncs to the cloud). Requires a Google "Desktop app" OAuth client id in
config.google_client_id (public; the dev registers it in Google Cloud Console).

Stdlib only (urllib/hashlib/secrets/webbrowser) so it bundles into the exe with no extra deps.
"""
import base64
import hashlib
import json
import os
import secrets
import time
import urllib.parse
import urllib.request
import webbrowser

_AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
_TOKEN = "https://oauth2.googleapis.com/token"
_SCOPE = "https://www.googleapis.com/auth/drive.file"
_TOKEN_FILE = os.path.join(os.path.expanduser("~"), ".ddcs-bridge", "google_token.json")
_pending = {}   # state -> {verifier, redirect_uri}; in-memory, one sign-in at a time is fine


def _b64url(b):
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def _pkce():
    verifier = _b64url(secrets.token_bytes(32))
    challenge = _b64url(hashlib.sha256(verifier.encode()).digest())
    return verifier, challenge


def auth_url(client_id, redirect_uri, state, challenge):
    """The Google consent URL (pure builder — no side effects, so it's unit-testable)."""
    params = {
        "client_id": client_id, "redirect_uri": redirect_uri, "response_type": "code",
        "scope": _SCOPE, "code_challenge": challenge, "code_challenge_method": "S256",
        "state": state, "access_type": "offline", "prompt": "consent",
    }
    return _AUTH + "?" + urllib.parse.urlencode(params)


def start(client_id, redirect_uri):
    """Begin sign-in: stash PKCE state, open the consent URL in the SYSTEM browser. Returns the url."""
    if not client_id:
        raise ValueError("no Google Desktop client id (set config.google_client_id)")
    state = secrets.token_urlsafe(16)
    verifier, challenge = _pkce()
    _pending[state] = {"verifier": verifier, "redirect_uri": redirect_uri}
    url = auth_url(client_id, redirect_uri, state, challenge)
    try:
        webbrowser.open(url)
    except Exception:
        pass   # caller can still surface the url
    return url


def _post_token(data):
    body = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(_TOKEN, data=body,
                                 headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.load(r)


def callback(client_id, client_secret, state, code):
    """Loopback handler: exchange code+verifier -> tokens, persist refresh+access. True on success."""
    p = _pending.pop(state, None)
    if not p or not code:
        return False
    data = {
        "client_id": client_id, "code": code, "code_verifier": p["verifier"],
        "redirect_uri": p["redirect_uri"], "grant_type": "authorization_code",
    }
    if client_secret:
        data["client_secret"] = client_secret   # Google Desktop clients include the (non-confidential) secret
    try:
        tok = _post_token(data)
    except Exception:
        return False
    if "access_token" not in tok:
        return False
    prev = _load()
    _save({
        "refresh_token": tok.get("refresh_token") or prev.get("refresh_token", ""),
        "access_token": tok["access_token"],
        "expiry": time.time() + int(tok.get("expires_in", 3600)) - 60,
    })
    return True


def _load():
    try:
        with open(_TOKEN_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def _save(d):
    os.makedirs(os.path.dirname(_TOKEN_FILE), exist_ok=True)
    with open(_TOKEN_FILE, "w", encoding="utf-8") as f:
        json.dump(d, f)


def access_token(client_id, client_secret=""):
    """Current access token, silently refreshed from the stored refresh_token if expired. '' if none."""
    t = _load()
    if t.get("access_token") and time.time() < t.get("expiry", 0):
        return t["access_token"]
    rt = t.get("refresh_token")
    if not rt:
        return ""
    data = {"client_id": client_id, "refresh_token": rt, "grant_type": "refresh_token"}
    if client_secret:
        data["client_secret"] = client_secret
    try:
        tok = _post_token(data)
    except Exception:
        return ""
    if "access_token" not in tok:
        return ""
    t["access_token"] = tok["access_token"]
    t["expiry"] = time.time() + int(tok.get("expires_in", 3600)) - 60
    _save(t)
    return t["access_token"]


def connected():
    return bool(_load().get("refresh_token"))


def disconnect():
    try:
        os.remove(_TOKEN_FILE)
    except OSError:
        pass
