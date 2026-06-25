/**
 * ui/bridgeTransfer.js — the header TRANSFER button: send the current editor program to the gateway
 * (docs/archive/addstudiotransfer.md, updated for the one-app architecture: Studio is same-origin with the
 * gateway, so there is no URL/token config — the shared client seam resolves the base, and the button
 * greys out when no gateway answers, mirroring the GATEWAY tab).
 *
 * Deliver-only on purpose (no beacon map): the gateway copies the file to the controller's CNCDISK and
 * marks it delivered. Deliver ≠ run — the operator selects it and presses Cycle Start at the machine.
 */
import { makeClient } from '../shared/js/client.js';
import { toast } from './gateway/util.js';

export function initBridgeTransfer() {
    const btn = document.getElementById('transferBtn');
    if (!btn) return;
    const client = makeClient();
    let bridged = false;
    let inFlight = false;

    // gatewayStatus.js broadcasts each poll — same signal that drives the LED and the GATEWAY tab.
    // TRANSFER only exists when bridged (hidden otherwise — the greyed GATEWAY tab is the funnel).
    document.addEventListener('ddcs:gateway-status', (e) => {
        bridged = !!e.detail?.bridged;
        btn.classList.toggle('hidden', !bridged);
    });

    btn.addEventListener('click', async () => {
        if (!bridged || inFlight) return;
        const { name, code } = window.editorManager?.buildProgram?.() || { name: '', code: '' };
        if (!code.trim() || !name) return toast('Nothing to send — the editor is empty.', true);
        inFlight = true;
        btn.classList.add('unavailable');
        try {
            const r = await client.submitJob(name, code);   // no map => deliver-only
            toast(`Sent ${r.name || name} — press Cycle Start at the machine.`);
        } catch (e) {
            toast('Transfer failed: ' + e.message, true);
        } finally {
            inFlight = false;
            btn.classList.toggle('unavailable', !bridged);
        }
    });
}
