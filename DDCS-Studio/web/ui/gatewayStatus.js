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
    const settingsTab = document.querySelector('.hdr-tabs .tab[data-app="settings"]');
    const blocksTab = document.querySelector('.hdr-tabs .tab[data-app="blocks"]');
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
            led.className = 'gateway-led';   // unlit — no gateway (standalone / hosted / dev preview)
            led.title = 'Gateway: off';
            bridged = false;
            // Don't auto-kick out of the Gateway tab when nothing answers — its Console → Service picker is
            // how you point at one (a local daemon, the desktop exe's gateway, or a remote service).
        }
        // The tab always opens now (the LED shows connection state), so it stays styled like the other tabs —
        // no 'unavailable' dimming. Only the tooltip reflects status.
        if (tab) tab.title = bridged ? 'Gateway' : 'Gateway — connect a service in the Console tab';
        // Anything else that gates on the gateway (TRANSFER button, …) listens for this.
        document.dispatchEvent(new CustomEvent('ddcs:gateway-status', { detail: { bridged } }));
    }

    async function showApp(which) {
        const studioApp = document.getElementById('studio-app');
        const gatewayApp = document.getElementById('gateway-app');
        const settingsApp = document.getElementById('settings-app');
        const blocksApp = document.getElementById('blocks-app');

        const isStudio = which === 'studio';
        const isGateway = which === 'gateway';
        const isSettings = which === 'settings';
        const isBlocks = which === 'blocks';

        // Any tab change stops every preview's run — otherwise a run keeps executing off-screen and its snapshot
        // can clobber the editor on the way back (see REMINDERS / decode-standby). The event reaches every mounted
        // preview panel; ddcsStopPreview covers Studio's drawer engine specifically.
        window.dispatchEvent(new CustomEvent('ddcs:stop-previews'));
        if (!isStudio && window.ddcsStopPreview) window.ddcsStopPreview();

        if (isGateway) {
            const mod = await import('./gatewayPanel.js');
            mod.initGatewayPanel();
            mod.setGatewayPanelVisible(true);
        } else {
            try { (await import('./gatewayPanel.js')).setGatewayPanelVisible(false); } catch { /* not loaded */ }
        }

        if (isSettings) {
            const mod = await import('./settingsPanel.js');
            mod.openSettings();
        }

        // (Blocks → STUDIO round-trip is now LIVE: the Blocks tab projects its G-code straight into the editor
        // on every change — see blocksApp.reproject. No tab-switch copy/reconcile needed here.)

        studioApp?.classList.toggle('hidden', !isStudio);
        gatewayApp?.classList.toggle('hidden', !isGateway);
        settingsApp?.classList.toggle('hidden', !isSettings);
        blocksApp?.classList.toggle('hidden', !isBlocks);

        studioTab?.classList.toggle('active', isStudio);
        tab?.classList.toggle('active', isGateway);
        settingsTab?.classList.toggle('active', isSettings);
        blocksTab?.classList.toggle('active', isBlocks);

        // Build/refresh the Blocks tab only after it's visible (canvas + three.js need layout). All Blocks logic
        // lives in blocksApp.showBlocks — this router just routes (the showApp router itself moves out of this
        // gateway-status module when the Gateway UI is built).
        if (isBlocks) {
            try {
                await (await import('../blocks/blocksApp.js')).showBlocks();
            } catch (err) { console.error('blocks init failed', err); }
        }
    }

    window.showApp = showApp;

    if (tab) tab.addEventListener('click', () => showApp('gateway'));   // always opens; connect a service in Console
    if (studioTab) studioTab.addEventListener('click', () => showApp('studio'));
    if (settingsTab) settingsTab.addEventListener('click', () => showApp('settings'));
    if (blocksTab) blocksTab.addEventListener('click', () => showApp('blocks'));

    tick();
    setInterval(tick, 5000);
}
