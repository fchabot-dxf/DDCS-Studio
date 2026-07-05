/**
 * ui/tncInstallStatus.js — the DECLARED "is T.nc installed on the controller?" status (guardrail [B]).
 *
 * A T# M6 automatic tool change CALLS the T.nc macro the operator installs on the controller — a bare T# M6 does
 * NOTHING if it isn't there. When a gateway is CONNECTED we can VERIFY the macro exists via a READ-ONLY presence
 * check on the SYSDISK (client.readSysfile('T.nc') — the same seam the Macros sync uses; NEVER scraped from UI text,
 * and read-only [[live-cnc-readonly-when-away]]). Tri-state:
 *   'installed' — found + non-empty on the controller (verified)
 *   'missing'   — gateway connected, but T.nc not found
 *   'unknown'   — no gateway connected → can't verify (the atc_change banner keeps its amber "install it" text)
 *
 * The atc_change install banner READS getTncStatus() and calls refreshTncStatus() when it shows; this module owns the
 * check + caches the result, re-verifying on (dis)connect and broadcasting `ddcs:tnc-status` so the view re-renders.
 */
import { makeClient } from '../shared/js/client.js';

let _bridged = false;
let _status = 'unknown';   // 'installed' | 'missing' | 'unknown'
let _inflight = null;

function emit() { document.dispatchEvent(new CustomEvent('ddcs:tnc-status', { detail: { status: getTncStatus() } })); }

// gatewayStatus.js polls the gateway and broadcasts the connection state — track it, and re-verify on a (dis)connect.
document.addEventListener('ddcs:gateway-status', (e) => {
    const b = !!(e.detail && e.detail.bridged);
    if (b === _bridged) return;
    _bridged = b;
    if (b) { refreshTncStatus(); } else { _status = 'unknown'; emit(); }
});

/** The last-known install status (declared, cached). Always 'unknown' when no gateway is connected. */
export function getTncStatus() { return _bridged ? _status : 'unknown'; }

/** READ-ONLY re-check: readSysfile('T.nc') → installed (found + non-empty) / missing / unknown (no gateway or error). */
export async function refreshTncStatus() {
    if (!_bridged) { _status = 'unknown'; emit(); return _status; }
    if (_inflight) return _inflight;
    _inflight = (async () => {
        try {
            const res = await makeClient().readSysfile('T.nc');
            _status = (res && res.ok && res.content && String(res.content).trim()) ? 'installed' : 'missing';
        } catch (_) { _status = 'unknown'; }   // a network/gateway error is unverifiable, NOT "missing"
        _inflight = null;
        emit();
        return _status;
    })();
    return _inflight;
}
