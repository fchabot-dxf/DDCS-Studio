import { VarListPanel } from './varListPanel.js';
import { CommandDeck } from './commandDeck.js';
import { el } from './uiUtils.js';

export class DockManager {
    constructor(variableDB, editorManager) {
        if (!window.__dockManagerCount) window.__dockManagerCount = 0;
        // singleton guard: return existing instance if already created
        if (window.__dockManagerInstance) {
            window.__dockManagerCount += 1;
            console.debug('DockManager.constructor - returning existing instance, count=', window.__dockManagerCount);
            return window.__dockManagerInstance;
        }
        window.__dockManagerCount += 1;
        console.debug('DockManager.constructor - creating instance, count=', window.__dockManagerCount);
        // register this instance
        window.__dockManagerInstance = this;
        this.controllerDock = document.getElementById('controller-dock');
        this.varListPanel = new VarListPanel(variableDB, editorManager);
        this.commandDeck = new CommandDeck(editorManager, variableDB);

        this.varListPanel.onSearchChange = (hasText) => {
            if (hasText) {
                this.controllerDock?.classList.add('search-mode');
            } else {
                this.controllerDock?.classList.remove('search-mode');
            }
        };

        // Dock expand/collapse behavior: use header-handle row
        const handle = document.querySelector('#controller-dock .header-handle');
        // debounce guard to avoid double toggles from rapid events
        this._lastToggle = this._lastToggle || 0;
        const toggleExpand = () => {
            const now = Date.now();
            if (now - this._lastToggle < 200) {
                console.debug('DockManager.toggleExpand - ignored (debounce)');
                return;
            }
            this._lastToggle = now;

            const willExpand = !this.controllerDock?.classList.contains('is-expanded');
            console.debug('DockManager.toggleExpand - willExpand=', willExpand);
            if (this.controllerDock) {
                if (willExpand) this.controllerDock.classList.add('is-expanded');
                else this.controllerDock.classList.remove('is-expanded');
            }
            if (handle) {
                const isExp = this.controllerDock?.classList.contains('is-expanded') ? 'true' : 'false';
                console.debug('DockManager.toggleExpand - set aria-expanded=', isExp);
                handle.setAttribute('aria-expanded', isExp);
            }
        };
        if (handle) {
            // initialize aria-expanded state
            handle.setAttribute('aria-expanded', this.controllerDock?.classList.contains('is-expanded') ? 'true' : 'false');
            // Prevent pointer interactions from shifting focus or triggering keyboard
            handle.addEventListener('pointerdown', (e) => { e.preventDefault(); }, { passive: false });
            // primary listener
            handle.addEventListener('click', (e) => { e.stopPropagation(); console.debug('header-handle clicked'); toggleExpand(); });
            handle.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); console.debug('header-handle key activated', e.key); toggleExpand(); } });

            // Drag the handle up/down to RESIZE the keyboard height. A >4px move counts as a resize
            // (not a toggle); the height is stored on #controller-dock as --dock-h, persisted, and the
            // keys flex to fill it. Restore any saved height on load.
            // --dock-h lives on <html> (not the dock) so the editor can read it too — it pads its scroll
            // by the keyboard height when the keyboard floats over it (see the glass-keyboard CSS).
            try { const sh = parseInt(localStorage.getItem('ddcs_dock_h') || '', 10); if (sh) document.documentElement.style.setProperty('--dock-h', sh + 'px'); } catch (_) { /* ignore */ }
            let dz = false, dzMoved = false, dzY = 0, dzH = 0;
            const dockBody = () => this.controllerDock.querySelector('.dock-body');
            handle.style.touchAction = 'none';
            handle.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;
                dz = true; dzMoved = false; dzY = e.clientY;
                dzH = dockBody() ? dockBody().getBoundingClientRect().height : 300;
                try { handle.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
            });
            handle.addEventListener('pointermove', (e) => {
                if (!dz) return;
                const dy = dzY - e.clientY;                 // drag UP → taller
                if (Math.abs(dy) > 4) dzMoved = true;
                if (!dzMoved) return;
                if (!this.controllerDock.classList.contains('is-expanded')) this.controllerDock.classList.add('is-expanded');
                const h = Math.max(160, Math.min(Math.round(window.innerHeight * 0.85), Math.round(dzH + dy)));
                document.documentElement.style.setProperty('--dock-h', h + 'px');
            });
            const dzEnd = (e) => {
                if (!dz) return; dz = false;
                try { handle.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
                if (dzMoved) { const h = document.documentElement.style.getPropertyValue('--dock-h'); if (h) { try { localStorage.setItem('ddcs_dock_h', h.replace('px', '')); } catch (_) { /* ignore */ } } }
            };
            handle.addEventListener('pointerup', dzEnd);
            handle.addEventListener('pointercancel', dzEnd);
            // Swallow the click that follows a resize-drag so it doesn't also toggle collapse.
            handle.addEventListener('click', (e) => { if (dzMoved) { e.stopImmediatePropagation(); e.preventDefault(); dzMoved = false; } }, true);
        }
        // fallback: event delegation in case direct listen fails (covers edge cases)
        const dock = document.getElementById('controller-dock');
        if (dock) {
            dock.addEventListener('click', (e) => {
                const target = e.target;
                if (target && (target.classList && target.classList.contains('header-handle') || target.closest && target.closest('.header-handle'))) {
                    console.debug('controller-dock delegation caught header-handle click');
                    e.stopPropagation();
                    toggleExpand();
                }
            });
        }

        // Sanity guard: ensure 'search-mode' isn't left enabled at startup (hides deck-panel)
        // and re-render header/deck if DOM was partially initialized.
        try {
            const searchEl = document.getElementById('search');
            const hasSearchText = searchEl && searchEl.value && searchEl.value.trim().length > 0;
            if (!hasSearchText) {
                this.controllerDock?.classList.remove('search-mode');
            } else {
                this.controllerDock?.classList.add('search-mode');
            }

            // Defensive re-render of header/deck if they are empty/missing buttons
            if (this.commandDeck && typeof this.commandDeck.renderHeader === 'function') {
                const centerTarget = document.querySelector('.dock-header .header-center');
                const deckPanel = document.getElementById('deck-panel');
                const centerEmpty = !centerTarget || centerTarget.children.length === 0;
                const deckEmpty = !deckPanel || deckPanel.children.length === 0;
                if (centerEmpty || deckEmpty) {
                    console.debug('DockManagerSanity: re-rendering deck/header (centerEmpty=', centerEmpty, 'deckEmpty=', deckEmpty, ')');
                    this.commandDeck.renderHeader();
                    // rebuild macro groups into existing deck-panel if present
                    if (deckPanel && typeof this.commandDeck.buildMacroGroups === 'function') {
                        this.commandDeck.buildMacroGroups(deckPanel);
                    }
                }
            }
        } catch (err) {
            console.warn('DockManager sanity guard failed', err);
        }

        // Corsair-style key lighting (reactive press flash + ambient matrix rain) — futuristic only.
        import('./keyFx.js').then((m) => m.initKeyFx()).catch(() => {});
    }

    clear() {
        this.varListPanel.clear();
    }
}
