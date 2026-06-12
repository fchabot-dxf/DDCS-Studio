/**
 * ui/downloadMenu.js — the header DOWNLOAD button: a small menu with the two ways to take the app
 * home. Shown on every face (hosted, LAN, exe):
 *   - HTML: the standalone single-file Studio with the user's defaults baked in (saveDefaults).
 *           Opened locally it can still bridge — gateway detection is runtime, not a build flag.
 *   - EXE:  the full desktop app (Studio + embedded gateway), from the releases page.
 * Programs are not downloads — the editor's export and TRANSFER handle those.
 */
import { EXE_DOWNLOAD_URL } from './gatewayStatus.js';

export function initDownloadMenu() {
    const btn = document.getElementById('downloadBtn');
    const wrap = btn?.closest('.dl-ctl');
    if (!btn || !wrap) return;
    btn.addEventListener('click', () => {
        const open = document.getElementById('dl-menu');
        if (open) { open.remove(); return; }
        const pop = document.createElement('div');
        pop.id = 'dl-menu';
        pop.className = 'scale-pop dl-menu';
        pop.innerHTML =
            '<button type="button" class="op-btn" id="dl-html" title="Single-file Studio with your current defaults baked in">' +
            '🌐 App as HTML — portable, your defaults</button>' +
            '<a class="op-btn" id="dl-exe" href="' + EXE_DOWNLOAD_URL + '" target="_blank" rel="noopener" ' +
            'title="Studio + Gateway in one exe — talks to your controller">' +
            '💻 Desktop app (.exe) — includes the Gateway</a>';
        wrap.appendChild(pop);
        pop.querySelector('#dl-html').addEventListener('click', () => { window.saveDefaults?.(); pop.remove(); });
        pop.querySelector('#dl-exe').addEventListener('click', () => pop.remove());
        setTimeout(() => document.addEventListener('click', function close(e) {
            const p = document.getElementById('dl-menu');
            if (!p) { document.removeEventListener('click', close); return; }
            if (!p.contains(e.target) && !btn.contains(e.target)) {
                p.remove();
                document.removeEventListener('click', close);
            }
        }), 0);
    });
}
