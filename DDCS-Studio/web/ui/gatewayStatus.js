/**
 * ui/gatewayStatus.js — live-gateway status LED + GATEWAY tab gating in the header.
 *
 * Polls the gateway's /api/descriptor through the shared client seam. The LED is always visible:
 * green when a gateway answers (controller detail in the tooltip), red when it reports a fault, and
 * unlit grey when there is no gateway at all (hosted Studio / standalone) — in that state the GATEWAY
 * tab greys out too, and clicking it offers the desktop download (the full exe bundles the gateway;
 * the cloud never touches a machine).
 */
import { makeClient, deriveStatus } from '../shared/js/client.js';

export const EXE_DOWNLOAD_URL = 'https://github.com/fchabot-dxf/DDCS-Studio/releases/latest';

export function initGatewayStatus() {
    const led = document.getElementById('gateway-led');
    if (!led) return;
    const tab = document.querySelector('.hdr-tabs .tab[data-app="gateway"]');
    const studioTab = document.querySelector('.hdr-tabs .tab[data-app="studio"]');
    const client = makeClient();
    let bridged = false;

    async function tick() {
        try {
            const d = await client.descriptor();
            const s = deriveStatus(client, d);
            // Gateway answers => green (controller detail lives in the tooltip); red only on a fault.
            led.className = 'gateway-led ' + (s.dot === 'bad' ? 'led-bad' : 'led-ok');
            led.title = 'Gateway: ' + s.label + (s.device ? ' · ' + s.device : '');
            bridged = true;
        } catch (e) {
            led.className = 'gateway-led';   // unlit — no gateway (standalone / hosted)
            led.title = 'Gateway: off';
            bridged = false;
            if (document.getElementById('gateway-app')?.classList.contains('hidden') === false) showApp('studio');
        }
        if (tab) {
            tab.classList.toggle('unavailable', !bridged);
            tab.title = bridged ? 'Gateway' : 'Gateway runs in the desktop app — click to download';
        }
        // Anything else that gates on the gateway (TRANSFER button, …) listens for this.
        document.dispatchEvent(new CustomEvent('ddcs:gateway-status', { detail: { bridged } }));
    }

    async function showApp(which) {
        const panel = document.getElementById('gateway-app');
        const shells = document.querySelectorAll('.app-shell');
        const gateway = which === 'gateway';
        if (gateway) {
            const mod = await import('./gatewayPanel.js');
            mod.initGatewayPanel();
            mod.setGatewayPanelVisible(true);
        } else {
            try { (await import('./gatewayPanel.js')).setGatewayPanelVisible(false); } catch { /* not loaded */ }
        }
        panel?.classList.toggle('hidden', !gateway);
        shells.forEach((s) => s.classList.toggle('hidden', gateway));
        tab?.classList.toggle('active', gateway);
        studioTab?.classList.toggle('active', !gateway);
    }

    if (tab) tab.addEventListener('click', () => { bridged ? showApp('gateway') : toggleDownloadPop(tab); });
    if (studioTab) studioTab.addEventListener('click', () => showApp('studio'));

    tick();
    setInterval(tick, 5000);
}

/** Small popover under the greyed GATEWAY tab offering the full-exe download. */
function toggleDownloadPop(tab) {
    const open = document.getElementById('gateway-dl-pop');
    if (open) { open.remove(); return; }
    const pop = document.createElement('div');
    pop.id = 'gateway-dl-pop';
    pop.className = 'gateway-dl-pop';
    pop.innerHTML =
        '<p>The <b>Gateway</b> talks to your controller, so it runs on your own PC — not in the cloud.</p>' +
        '<a class="dl-btn" href="' + EXE_DOWNLOAD_URL + '" target="_blank" rel="noopener">⬇ Download DDCS Studio for desktop</a>' +
        '<p class="dl-note">Full app — Studio + Gateway in one exe.</p>';
    document.body.appendChild(pop);
    const r = tab.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8)) + 'px';
    pop.style.top = (r.bottom + 6) + 'px';
    setTimeout(() => document.addEventListener('click', function close(e) {
        if (!document.body.contains(pop)) { document.removeEventListener('click', close); return; }
        if (!pop.contains(e.target) && !tab.contains(e.target)) {
            pop.remove();
            document.removeEventListener('click', close);
        }
    }), 0);
}
