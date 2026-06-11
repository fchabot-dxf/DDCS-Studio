/**
 * ui/gatewayStatus.js — live-gateway status LED in the header.
 *
 * Polls the gateway's /api/descriptor through the shared client seam. When the gateway answers, the
 * #gateway-led lights green (live controller), yellow (gateway/controller offline or sandbox folder), or
 * red (unreachable). When there is no gateway at all (Studio opened standalone) the fetch fails and the
 * LED stays hidden — so it only ever appears when Studio is actually bridged.
 */
import { makeClient, deriveStatus } from '../shared/js/client.js';

const DOT_CLASS = { ok: 'led-ok', warn: 'led-warn', bad: 'led-bad' };

export function initGatewayStatus() {
    const led = document.getElementById('gateway-led');
    if (!led) return;
    const client = makeClient();

    async function tick() {
        try {
            const d = await client.descriptor();
            const s = deriveStatus(client, d);
            led.className = 'gateway-led ' + (DOT_CLASS[s.dot] || 'led-warn');
            led.style.display = 'inline-block';
            led.title = 'Gateway: ' + s.label + (s.device ? ' · ' + s.device : '');
        } catch (e) {
            led.style.display = 'none';   // no gateway reachable (standalone / offline)
        }
    }
    tick();
    setInterval(tick, 5000);
}
