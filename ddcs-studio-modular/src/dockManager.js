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
        this.toolbar = document.querySelector('.secondary-toolbar');
        this.controllerDock = document.getElementById('controller-dock');
        this.varListPanel = new VarListPanel(variableDB, editorManager);
        this.commandDeck = new CommandDeck(editorManager);

        this.varListPanel.onSearchChange = (hasText) => {
            if (hasText) {
                this.toolbar?.classList.add('search-mode');
                this.controllerDock?.classList.add('search-mode');
            } else {
                this.toolbar?.classList.remove('search-mode');
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
                this.toolbar?.classList.remove('search-mode');
                this.controllerDock?.classList.remove('search-mode');
            } else {
                this.toolbar?.classList.add('search-mode');
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
    }

    clear() {
        this.varListPanel.clear();
    }
}
