import { el, UIUtils } from './uiUtils.js';
import { initSuggestBar } from './suggestBar.js';

// Header toolbar icons — inline line-art SVG (not emoji) so they render identically on every OS,
// inherit the theme via currentColor, stay crisp at any size, and give each button an icon to
// collapse to on narrow screens. Drawn in the spirit of each tool: bubble, wrench, flame, target,
// recycle, folder, file+, copy, trash, download. 24×24 stroke grid, rendered at 16px.
// Each icon carries its own accent colour (the user wants colour per icon). Drawn at a 24×24 stroke
// grid, rendered at 16px. Filled accents (origin dot, ruby ball) override fill/stroke inline.
const _svg = (body, color = 'currentColor') => `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const HEADER_ICONS = {
    comm:   _svg('<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/>', '#3b82f6'),
    // WCS = work origin: Y-up / X-right axes meeting at a filled origin dot
    wcs:    _svg('<path d="M5 3V19H21"/><polyline points="2.5 6 5 3 7.5 6"/><polyline points="18 16.5 21 19 18 21.5"/><circle cx="5" cy="19" r="1.7" fill="#10b981" stroke="none"/>', '#10b981'),
    warmup: _svg('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>', '#f97316'),
    // Probe = ruby touch sensor: steel body + shaft, a solid ruby ball touching a surface line
    probe:  _svg('<path d="M9 3h6v3l-1.5 2h-3L9 6z"/><line x1="12" y1="10" x2="12" y2="14.8"/><line x1="5" y1="21" x2="19" y2="21"/><circle cx="12" cy="17.3" r="2.4" fill="#e11d48" stroke="#e11d48"/>', '#64748b'),
    atc:    _svg('<polyline points="22 5 22 10.5 16.5 10.5"/><polyline points="2 19 2 13.5 7.5 13.5"/><path d="M4.06 9.5A8 8 0 0 1 18 6.6l4 3.9M2 13.5l4 3.9A8 8 0 0 0 19.94 14.5"/>', '#8b5cf6'),
    load:   _svg('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>', '#f59e0b'),
    insert: _svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>', '#14b8a6'),
    copy:   _svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>', '#6366f1'),
    clear:  _svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>', '#ef4444'),
    // Export = share / upload: open-top box with an up arrow rising out (per the supplied glyph)
    export: _svg('<path d="M16 9h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2"/><line x1="12" y1="14" x2="12" y2="3"/><polyline points="8 7 12 3 16 7"/>', '#0ea5e9'),
};

// Load a G-code / .nc file from disk into the editor, then trigger a re-parse + preview — for
// simulating an existing program instead of pasting it. Wired to the 📂 Load header button;
// reuses one hidden <input> so re-loading the same file still fires a change.
window.loadGcodeFile = function loadGcodeFile() {
    let input = document.getElementById('gcode-file-input');
    if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.id = 'gcode-file-input';
        input.accept = '.nc,.gcode,.gco,.g,.ngc,.tap,.cnc,.txt';
        input.style.display = 'none';
        input.addEventListener('change', () => {
            const f = input.files && input.files[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = (e) => {
                const ed = document.getElementById('editor');
                if (ed) { ed.value = e.target.result || ''; ed.dispatchEvent(new Event('input', { bubbles: true })); }
            };
            r.readAsText(f);
            input.value = ''; // let the same file be picked again
        });
        document.body.appendChild(input);
    }
    input.click();
};

// Insert a G-code / .nc file AT THE CURSOR (keeps the current program — vs Load, which replaces it).
// For stitching in already-built code (a probe routine, a sub-macro) without copy-paste.
window.insertGcodeFile = function insertGcodeFile() {
    let input = document.getElementById('gcode-insert-input');
    if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.id = 'gcode-insert-input';
        input.accept = '.nc,.gcode,.gco,.g,.ngc,.tap,.cnc,.txt';
        input.style.display = 'none';
        input.addEventListener('change', () => {
            const f = input.files && input.files[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = (e) => {
                const ed = document.getElementById('editor');
                if (!ed) return;
                const text = e.target.result || '';
                const pos = Number.isInteger(ed.selectionStart) ? ed.selectionStart : ed.value.length;
                const before = ed.value.slice(0, pos), after = ed.value.slice(pos);
                const lead = before && !before.endsWith('\n') ? '\n' : '';
                const tail = text.endsWith('\n') ? '' : '\n';
                ed.value = before + lead + text + tail + after;
                const caret = (before + lead + text + tail).length;
                try { ed.setSelectionRange(caret, caret); } catch (_) { /* ignore */ }
                ed.dispatchEvent(new Event('input', { bubbles: true }));
            };
            r.readAsText(f);
            input.value = ''; // let the same file be inserted again
        });
        document.body.appendChild(input);
    }
    input.click();
};

// Variable filter categories — heuristic predicates over the DB (description keywords + flags).
const VAR_FILTERS = [
    { key: 'user', label: 'User', test: v => !v.isSys },
    { key: 'hasDesc', label: 'Has Desc', test: v => (v.d || '').trim().length > 0 },
    { key: 'probe', label: 'Probe', test: v => /probe|g31/i.test((v.d || '') + ' ' + v.i) },
    { key: 'wcs', label: 'WCS', test: v => /wcs|work offset|g5[4-9]/i.test(v.d || '') },
    { key: 'axis', label: 'Axis', test: v => /axis/i.test(v.d || '') },
    { key: 'signal', label: 'Signal', test: v => /signal/i.test(v.d || '') },
    { key: 'offset', label: 'Offset', test: v => /offset/i.test(v.d || '') },
    { key: 'tool', label: 'Tool', test: v => /tool/i.test(v.d || '') },
    { key: 'port', label: 'Port', test: v => /port/i.test(v.d || '') },
    { key: 'status', label: 'Status', test: v => /status/i.test(v.d || '') },
    { key: 'input', label: 'Input', test: v => /input/i.test(v.d || '') },
    { key: 'output', label: 'Output', test: v => /output/i.test(v.d || '') },
    { key: 'func', label: 'Func', test: v => /func/i.test(v.d || '') },
    { key: 'key', label: 'Key', test: v => /\bkey\b/i.test(v.d || '') },
];

export class CommandDeck {
    constructor(editorManager, variableDB = null) {
        this.editorManager = editorManager;
        this.variableDB = variableDB;
        this.panel = el('deck-panel');
        this._varGrid = null;
        this._varSearch = null;
        this._activeTab = 'basic';
        this._activeFilters = new Set();
        this.build();
        // Let other modules (e.g. a CSV import) refresh the keyboard's variable buttons
        window.refreshDeckVariables = () => this.renderVariables(this._varSearch ? this._varSearch.value.trim().toLowerCase() : '');
        // The variable DB loads asynchronously (default_vars.js + user_vars.csv); re-render when ready
        window.addEventListener('variableDB:ready', () => {
            this.renderVariables(this._varSearch ? this._varSearch.value.trim().toLowerCase() : '');
        });
    }

    build() {
        // 1. Header zones (wizards / comm / wcs / copy / clear / export)
        this.renderHeader();

        const body = document.querySelector('.dock-body');
        if (!body) return;
        const deckPanel = document.getElementById('deck-panel'); // existing macro-groups container

        // 2. BASIC tab — editor keys + the everyday G-code groups. buildMacroGroups builds ALL groups
        //    into #deck-panel; the macro-logic groups are moved to the MACRO tab below.
        const basicPanel = document.createElement('div');
        basicPanel.className = 'deck-tab-panel';
        basicPanel.id = 'deck-tab-basic';
        const basicGroups = deckPanel || document.createElement('div');
        basicGroups.id = 'deck-panel';
        if (!basicGroups.className) basicGroups.className = 'dock-row macro-grid-area';
        basicGroups.innerHTML = '';
        this.buildMacroGroups(basicGroups);
        this._wireDeckButtons(basicGroups);
        basicPanel.appendChild(basicGroups);

        // 3. MACRO tab — move the macro-logic groups (math / functions / control flow / WCS) out of
        //    BASIC into their own tab. Reparenting keeps the buttons' already-wired handlers.
        const macroPanel = document.createElement('div');
        macroPanel.className = 'deck-tab-panel';
        macroPanel.id = 'deck-tab-macro';
        macroPanel.style.display = 'none';
        const macroGroups = document.createElement('div');
        macroGroups.className = 'dock-row macro-grid-area';
        macroGroups.id = 'deck-panel-macro';
        ['math', 'functions', 'control-flow', 'wcs'].forEach((c) => {
            const g = basicGroups.querySelector('.deck-group.' + c);
            if (g) macroGroups.appendChild(g);
        });
        macroPanel.appendChild(macroGroups);

        // 4. VARIABLES tab — search + filters + scrollable chips
        const varPanel = document.createElement('div');
        varPanel.className = 'deck-tab-panel';
        varPanel.id = 'deck-tab-variables';
        varPanel.style.display = 'none';
        this.buildVariablesPanel(varPanel);

        // 5. Assemble the dock body: predictive suggestion row, then the BASIC/MACRO/VARIABLES tab
        //    strip, then the panels. The suggestion bar sits on top (phone-style), always visible.
        body.innerHTML = '';
        body.appendChild(initSuggestBar());
        body.appendChild(this._makeEditorRow());   // BACK/SPACE/ENTER — persistent, above the tabs
        body.appendChild(this._buildTabStrip());
        body.appendChild(basicPanel);
        body.appendChild(macroPanel);
        body.appendChild(varPanel);

        // 5. The handle is a plain chevron toggle (expand/collapse wired by DockManager).
        this.renderHandle();
    }

    // Restore the chevron handle (DockManager handles the expand/collapse click).
    renderHandle() {
        const handle = document.querySelector('#controller-dock .header-handle');
        if (!handle) return;
        handle.innerHTML = '<span class="chevron">▲</span>';
        handle.setAttribute('aria-label', 'Toggle keyboard dock');
    }

    // KEYBOARD / VARIABLES tab strip for the top of the dock body
    _buildTabStrip() {
        const strip = document.createElement('div');
        strip.className = 'deck-tabs';
        strip.innerHTML = `
            <button class="deck-tab ddcs-tab active" data-deck-tab="basic">⌨ BASIC</button>
            <button class="deck-tab ddcs-tab" data-deck-tab="macro">∑ MACRO</button>
            <button class="deck-tab ddcs-tab" data-deck-tab="variables"># VARIABLES</button>
        `;
        strip.querySelectorAll('.deck-tab').forEach(t => {
            t.addEventListener('pointerdown', (e) => { e.preventDefault(); }, { passive: false });
            t.addEventListener('click', (e) => { e.stopPropagation(); this.switchTab(t.dataset.deckTab); });
        });
        return strip;
    }

    switchTab(name) {
        this._activeTab = name;
        const panels = { basic: 'deck-tab-basic', macro: 'deck-tab-macro', variables: 'deck-tab-variables' };
        for (const [key, id] of Object.entries(panels)) {
            const p = document.getElementById(id);
            if (p) p.style.display = name === key ? '' : 'none';
        }
        document.querySelectorAll('#controller-dock .deck-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.deckTab === name);
        });
        if (name === 'variables') {
            this.renderVariables(this._varSearch ? this._varSearch.value.trim().toLowerCase() : '');
        }
    }

    // Build + wire a BACK/SPACE/ENTER editor-keys row (one per keyboard tab).
    _makeEditorRow() {
        const editorRow = document.createElement('div');
        editorRow.className = 'dock-row editor-keys-row grid-3';
        editorRow.innerHTML = `
            <button class="toolbar-btn" data-ddcs-role="back">⌫ BACK</button>
            <button class="toolbar-btn" data-ddcs-role="space">␣ SPACE</button>
            <button class="toolbar-btn" data-ddcs-role="enter">↵ ENTER</button>
        `;
        this._wireEditorRow(editorRow);
        return editorRow;
    }

    _wireEditorRow(editorRow) {
        const backBtn = editorRow.querySelector('[data-ddcs-role="back"]');
        const spaceBtn = editorRow.querySelector('[data-ddcs-role="space"]');
        const enterBtn = editorRow.querySelector('[data-ddcs-role="enter"]');

        if (backBtn) backBtn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            backBtn.dataset.__ddcs_handled = '1';
            const ed = document.getElementById('editor');
            if (ed) {
                const start = ed.selectionStart;
                const end = ed.selectionEnd;
                if (start !== end) {
                    ed.value = ed.value.slice(0, start) + ed.value.slice(end);
                    ed.setSelectionRange(start, Math.min(ed.value.length, start + 1));
                } else if (start > 0) {
                    ed.value = ed.value.slice(0, start - 1) + ed.value.slice(start);
                    const newPos = start - 1;
                    ed.setSelectionRange(newPos, Math.min(ed.value.length, newPos + 1));
                }
                ed.dispatchEvent(new Event('input'));
                ed.setAttribute('inputmode', 'none');
                ed.blur();
            }
        }, { passive: false });

        if (spaceBtn) spaceBtn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            spaceBtn.dataset.__ddcs_handled = '1';
            window.insert && window.insert(' ');
            const ed = document.getElementById('editor'); if (ed) { ed.setAttribute('inputmode', 'none'); ed.blur(); }
        }, { passive: false });

        if (enterBtn) enterBtn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            enterBtn.dataset.__ddcs_handled = '1';
            window.insert && window.insert('\n');
            const ed = document.getElementById('editor'); if (ed) { ed.setAttribute('inputmode', 'none'); ed.blur(); }
        }, { passive: false });
    }

    _wireDeckButtons(container) {
        container.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                try {
                    btn.dataset.__ddcs_handled = '1';
                    if (typeof btn.onclick === 'function') { btn.onclick.call(btn, e); }
                } catch (err) { /* noop */ }
                const ed = document.getElementById('editor');
                if (ed) { ed.setAttribute('inputmode', 'none'); ed.blur(); }
            }, { passive: false });
        });
    }

    // VARIABLES tab: search + filters + a scrollable box of key-styled chips
    buildVariablesPanel(panel) {
        panel.innerHTML = '';
        this._activeFilters = new Set();

        // Controller variable-set switch (offline) + pull-from-controller (uses the gateway fingerprint).
        // The V4.1 and Expert have completely different variable maps; this swaps the system vars.
        const ctrlRow = document.createElement('div');
        ctrlRow.className = 'deck-var-ctrlrow';
        ctrlRow.style.cssText = 'display:flex; gap:6px; align-items:center; margin-bottom:6px; flex-wrap:wrap;';
        const ctrlLbl = document.createElement('span');
        ctrlLbl.textContent = 'Variable set:'; ctrlLbl.style.cssText = 'font-size:11px; opacity:.7;';
        const ctrlSel = document.createElement('select');
        ctrlSel.className = 'deck-var-ctrlsel'; ctrlSel.style.cssText = 'font-size:11px;';
        ctrlSel.innerHTML = '<option value="expert">Expert M350</option><option value="v4.1">DDCS V4.1</option>';
        ctrlSel.value = this.variableDB ? this.variableDB.getControllerVars() : 'expert';
        ctrlSel.addEventListener('change', async () => {
            if (!this.variableDB) return;
            await this.variableDB.setControllerVars(ctrlSel.value);
            if (this._varStatus) this._varStatus.textContent = '';
            this.renderVariables(this._varSearch ? this._varSearch.value.trim().toLowerCase() : '');
        });
        const pullBtn = document.createElement('button');
        pullBtn.className = 'toolbar-btn'; pullBtn.style.cssText = 'padding:2px 8px; font-size:11px;';
        pullBtn.textContent = '↧ Pull from controller';
        pullBtn.title = 'Detect the connected controller via the gateway and load its variable set';
        pullBtn.addEventListener('pointerdown', (e) => e.preventDefault(), { passive: false });
        pullBtn.addEventListener('click', () => this._pullControllerVars(ctrlSel));
        const ctrlStatus = document.createElement('span');
        ctrlStatus.style.cssText = 'font-size:10px; opacity:.7;'; this._varStatus = ctrlStatus;
        ctrlRow.appendChild(ctrlLbl); ctrlRow.appendChild(ctrlSel); ctrlRow.appendChild(pullBtn); ctrlRow.appendChild(ctrlStatus);
        panel.appendChild(ctrlRow);

        const searchRow = document.createElement('div');
        searchRow.className = 'deck-var-searchrow';
        const search = document.createElement('input');
        search.type = 'text';
        search.className = 'deck-var-search';
        search.placeholder = 'Search variables…';
        search.setAttribute('autocomplete', 'off');
        const filterBtn = document.createElement('button');
        filterBtn.className = 'deck-var-filterbtn';
        filterBtn.textContent = 'Filters';
        searchRow.appendChild(search);
        searchRow.appendChild(filterBtn);
        panel.appendChild(searchRow);

        const filterRow = document.createElement('div');
        filterRow.className = 'deck-var-filters';
        filterRow.style.display = 'none';
        VAR_FILTERS.forEach(f => {
            const chip = document.createElement('button');
            chip.className = 'deck-var-filterchip';
            chip.textContent = f.label;
            chip.dataset.filterKey = f.key;
            chip.addEventListener('pointerdown', (e) => { e.preventDefault(); }, { passive: false });
            chip.addEventListener('click', () => {
                if (this._activeFilters.has(f.key)) { this._activeFilters.delete(f.key); chip.classList.remove('active'); }
                else { this._activeFilters.add(f.key); chip.classList.add('active'); }
                this.renderVariables(this._varSearch.value.trim().toLowerCase());
            });
            filterRow.appendChild(chip);
        });
        panel.appendChild(filterRow);

        filterBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); }, { passive: false });
        filterBtn.addEventListener('click', () => {
            const show = filterRow.style.display === 'none';
            filterRow.style.display = show ? 'flex' : 'none';
            filterBtn.classList.toggle('active', show);
        });

        const scroll = document.createElement('div');
        scroll.className = 'deck-var-scroll';
        const grid = document.createElement('div');
        grid.className = 'deck-var-grid';
        scroll.appendChild(grid);
        panel.appendChild(scroll);

        this._varGrid = grid;
        this._varSearch = search;
        search.addEventListener('input', () => this.renderVariables(search.value.trim().toLowerCase()));
        this.renderVariables();
    }

    // Pull-from-controller: ask the gateway which controller it's connected to (the read-only
    // fingerprint) and load that controller's variable set. Falls back to a manual pick if offline.
    async _pullControllerVars(sel) {
        if (this._varStatus) this._varStatus.textContent = 'detecting…';
        let fam = null;
        try {
            const { makeClient } = await import('../shared/js/client.js');
            const d = await makeClient().descriptor();
            fam = d && d.controller_family;
        } catch (e) { /* gateway unreachable / offline */ }
        const target = fam === 'v4.1' ? 'v4.1' : (fam === 'expert-m350' ? 'expert' : null);
        if (!target) {
            if (this._varStatus) this._varStatus.textContent = 'no controller detected — pick a set manually';
            return;
        }
        if (this.variableDB) await this.variableDB.setControllerVars(target);
        if (sel) sel.value = target;
        this.renderVariables(this._varSearch ? this._varSearch.value.trim().toLowerCase() : '');
        if (this._varStatus) this._varStatus.textContent = `loaded ${target === 'v4.1' ? 'DDCS V4.1' : 'Expert M350'} (via gateway)`;
    }

    renderVariables(filter = '') {
        const grid = this._varGrid;
        if (!grid || !this.variableDB) return;
        grid.innerHTML = '';

        // Mirror the top toolbar: full variable set (system + user)
        let vars = this.variableDB.getAll();
        if (filter) {
            vars = vars.filter(v => (String(v.i) + ' ' + (v.d || '')).toLowerCase().includes(filter));
        }
        const active = this._activeFilters;
        if (active && active.size) {
            // Exclusive (AND): a variable must match EVERY selected category
            const tests = VAR_FILTERS.filter(f => active.has(f.key));
            vars = vars.filter(v => tests.every(f => f.test(v)));
        }
        if (vars.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'deck-var-empty';
            empty.textContent = (filter || (active && active.size)) ? 'No matching variables' : 'No variables loaded';
            grid.appendChild(empty);
            return;
        }

        const frag = document.createDocumentFragment();
        vars.forEach(v => {
            const id = String(v.i).split('-')[0];
            const desc = v.d || 'User Variable';
            const btn = document.createElement('button');
            btn.className = 'toolbar-btn deck-var-chip';
            const idEl = document.createElement('span');
            idEl.className = 'var-id';
            idEl.textContent = id;
            const descEl = document.createElement('span');
            descEl.className = 'var-desc';
            descEl.textContent = desc;
            btn.appendChild(idEl);
            btn.appendChild(descEl);
            btn.addEventListener('mouseenter', () => UIUtils.showTooltip(btn, `${desc}\n\nID: ${v.i}\nType: ${v.t || ''}`));
            btn.addEventListener('mouseleave', () => UIUtils.hideTooltip());
            btn.onclick = () => { if (this.editorManager) this.editorManager.insert(null, id); };
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                btn.dataset.__ddcs_handled = '1';
                if (typeof btn.onclick === 'function') btn.onclick.call(btn, e);
                const ed = document.getElementById('editor');
                if (ed) { ed.setAttribute('inputmode', 'none'); ed.blur(); }
            }, { passive: false });
            frag.appendChild(btn);
        });
        grid.appendChild(frag);
    }

    // Helper: Render header left/center/right
    renderHeader() {
        const leftTarget = document.querySelector('.dock-header .header-left');
        if (leftTarget) {
            leftTarget.innerHTML = `
                <div style="display:flex; gap:6px; align-items:center;">
                    <button class="toolbar-btn" onclick="openWiz && openWiz('comm')" title="Comm / MDI console"><span class="btn-ico">${HEADER_ICONS.comm}</span><span class="btn-tx">Comm</span></button>
                    <button class="toolbar-btn" onclick="openWiz && openWiz('wcs')" title="Work coordinate systems"><span class="btn-ico">${HEADER_ICONS.wcs}</span><span class="btn-tx">WCS</span></button>
                    <button class="toolbar-btn" onclick="openWiz && openWiz('atc_warmup')" title="Spindle warm-up sequence"><span class="btn-ico">${HEADER_ICONS.warmup}</span><span class="btn-tx">Warm-up</span></button>
                </div>
            `;
        }

        const centerTarget = document.querySelector('.dock-header .header-center');
        if (centerTarget) {
            centerTarget.innerHTML = `
                <div style="display:flex; gap:6px; width:auto; align-items:center;">
                    <div class="toolbar-dropdown">
                        <button class="toolbar-btn wizard-btn" style="min-width: 100px;"><span class="btn-ico">${HEADER_ICONS.probe}</span><span class="btn-tx">Probe</span><span class="btn-caret">▼</span></button>
                        <div class="toolbar-dropdown-content">
                            <button onclick="openCornerWiz && openCornerWiz()">📐 Corner</button>
                            <button onclick="openMiddleWiz && openMiddleWiz()">🎯 Middle</button>
                            <button onclick="openWiz && openWiz('circular')">⭕ Bore/Boss</button>
                            <button onclick="openEdgeWiz && openEdgeWiz()">📏 Edge</button>
                            <button onclick="openAlignmentWiz && openAlignmentWiz()">🧭 Align</button>
                            <div style="padding:4px 12px; font-size:10px; opacity:.55; text-transform:uppercase; letter-spacing:1px;">Rotary</div>
                            <button onclick="openWiz && openWiz('rotary_center')">🔄 Centreline</button>
                            <button onclick="openWiz && openWiz('rotary_clock')">🕒 Clock A0</button>
                        </div>
                    </div>
                    
                    <div class="toolbar-dropdown">
                        <button class="toolbar-btn wizard-btn" style="min-width: 100px;"><span class="btn-ico">${HEADER_ICONS.atc}</span><span class="btn-tx">ATC</span><span class="btn-caret">▼</span></button>
                        <div class="toolbar-dropdown-content">
                            <button onclick="openWiz && openWiz('atc_length')">📏 Tool Length</button>
                            <button onclick="openWiz && openWiz('atc_check')">🛡 Tool Check</button>
                            <button onclick="openWiz && openWiz('atc_change')">🔧 Tool Change</button>
                            <button onclick="openWiz && openWiz('atc_test')">🧪 ATC Test</button>
                        </div>
                    </div>

                    <!-- Comm and WCS buttons are provided in the left header; avoid duplicates here -->
                </div>
            `;
            
            // Add click-to-toggle support for mobile/touch
            centerTarget.querySelectorAll('.toolbar-dropdown > button').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const parent = btn.parentElement;
                    // close all others
                    centerTarget.querySelectorAll('.toolbar-dropdown').forEach(d => {
                        if (d !== parent) {
                            d.classList.remove('active');
                            const cc = d.querySelector('.toolbar-dropdown-content');
                            if (cc) {
                                cc.style.position = '';
                                cc.style.left = '';
                                cc.style.top = '';
                                cc.style.minWidth = '';
                                cc.style.paddingTop = '';
                            }
                        }
                    });

                    const content = parent.querySelector('.toolbar-dropdown-content');
                    const willOpen = !parent.classList.contains('active');
                    parent.classList.toggle('active');

                    // Position dropdown using fixed positioning so it won't be clipped
                    if (content && willOpen) {
                        try {
                            const rect = btn.getBoundingClientRect();
                            const pad = 6; // tray border + padding ring around the trigger
                            content.style.position = 'fixed';
                            content.style.left = `${Math.max(6, Math.round(rect.left - pad))}px`;
                            content.style.top = `${Math.round(rect.top - pad)}px`;
                            content.style.minWidth = `${Math.max(btn.offsetWidth + pad * 2, 0)}px`;
                            // Tray wraps the trigger, but items start below it (trigger stays visible on top)
                            content.style.paddingTop = `${btn.offsetHeight + pad + 4}px`;
                        } catch (err) {
                            // fallback: leave it absolute
                            content.style.position = '';
                        }
                    } else if (content) {
                        content.style.position = '';
                        content.style.left = '';
                        content.style.top = '';
                        content.style.minWidth = '';
                        content.style.paddingTop = '';
                    }
                });
            });
            // close dropdowns on outside click and clear inline positioning
            document.addEventListener('click', () => {
                centerTarget.querySelectorAll('.toolbar-dropdown').forEach(d => {
                    d.classList.remove('active');
                    const cc = d.querySelector('.toolbar-dropdown-content');
                    if (cc) {
                        cc.style.position = '';
                        cc.style.left = '';
                        cc.style.top = '';
                        cc.style.minWidth = '';
                        cc.style.paddingTop = '';
                    }
                });
            });
        }

        const rightTarget = document.querySelector('.dock-header .header-right');
        if (rightTarget) {
            rightTarget.innerHTML = `
                <div style="display:flex; gap:6px; align-items:center;">
                    <button class="toolbar-btn" onclick="loadGcodeFile && loadGcodeFile()" title="Load a G-code / .nc file into the editor (replaces the current program)"><span class="btn-ico">${HEADER_ICONS.load}</span><span class="btn-tx">Load</span></button>
                    <button class="toolbar-btn" onclick="insertGcodeFile && insertGcodeFile()" title="Insert a G-code file at the cursor — keeps your current program"><span class="btn-ico">${HEADER_ICONS.insert}</span><span class="btn-tx">Insert</span></button>
                    <button class="toolbar-btn" onclick="copyCode && copyCode()" title="Copy editor to clipboard"><span class="btn-ico">${HEADER_ICONS.copy}</span><span class="btn-tx">COPY</span></button>
                    <button class="toolbar-btn" onclick="clearCode && clearCode()" title="Clear the editor"><span class="btn-ico">${HEADER_ICONS.clear}</span><span class="btn-tx">CLEAR</span></button>
                    <button class="toolbar-btn" onclick="downloadFile && downloadFile()" title="Export / download the program"><span class="btn-ico">${HEADER_ICONS.export}</span><span class="btn-tx">EXPORT</span></button>
                </div>
            `;
        }

        document.querySelectorAll('.dock-header .header-left button, .dock-header .header-center button, .dock-header .header-right button')
            .forEach(btn => btn.addEventListener('pointerdown', (e) => { e.preventDefault(); }, { passive: false }));
        document.addEventListener('click', (ev) => {
            const t = ev.target;
            if (t && t.dataset && t.dataset.__ddcs_handled) {
                try { ev.stopImmediatePropagation(); ev.preventDefault(); } catch (e) { /* noop */ }
                try { delete t.dataset.__ddcs_handled; } catch (e) { /* noop */ }
            }
        }, true);

        // One-line toolbar: collapse labels→icons the instant the labelled bar wouldn't fit, so it
        // never wraps (wrapping clipped the 2nd row) and the page never scrolls. Re-measure on
        // resize + theme change (studio buttons are larger than normal-theme ones).
        requestAnimationFrame(() => { this._fitHeader(); this._fitAppHeader(); });
        if (!this._headerFitInit) {
            this._headerFitInit = true;
            const fit = () => requestAnimationFrame(() => { this._fitHeader(); this._fitAppHeader(); });
            window.addEventListener('resize', fit);
            if (window.MutationObserver) {
                const mo = new MutationObserver(fit);
                mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
                if (document.body) mo.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
            }
        }
    }

    // Priority+ fit for the wizard toolbar: keep the most labels possible. Stage 1 (.is-compact)
    // drops only the editor-action labels (Load/Insert/Copy/Clear/Export); if it STILL overflows,
    // stage 2 (.is-mini) drops the wizard labels too. remove→measure→add is synchronous (no flicker).
    _fitHeader() {
        const hc = document.querySelector('.dock-header .header-controls');
        if (!hc) return;
        hc.classList.remove('is-compact', 'is-mini');
        if (hc.scrollWidth > hc.clientWidth + 2) {
            hc.classList.add('is-compact');
            if (hc.scrollWidth > hc.clientWidth + 2) hc.classList.add('is-mini');
        }
    }

    // Top app-header: staged so the right-edge icons never overflow the window. Stage 1 drops the
    // op-button labels (.is-compact); if it still overflows, stage 2 drops STUDIO/GATEWAY labels +
    // version (.is-mini). Measured each call (load + resize + theme change) — no fixed breakpoints.
    _fitAppHeader() {
        const h = document.querySelector('.app-header');
        if (!h) return;
        h.classList.remove('is-compact', 'is-mini');
        // Strict (no tolerance): the app-header has no internal scroll, so ANY overflow is page
        // overflow. Collapse on the first pixel over so the right-edge icons never leave the window.
        if (h.scrollWidth > h.clientWidth) {
            h.classList.add('is-compact');
            if (h.scrollWidth > h.clientWidth) h.classList.add('is-mini');
        }
    }

    // Helper: build macro groups into provided container
    buildMacroGroups(container) {
        if (!container) return;
        container.innerHTML = `
            <div class="deck-group numpad">
                <div class="group-header">NUMPAD</div>
                <div class="grid-3">
                    <button class="toolbar-btn" title="Insert 7" onclick="window.insert && window.insert('7')">7</button>
                    <button class="toolbar-btn" title="Insert 8" onclick="window.insert && window.insert('8')">8</button>
                    <button class="toolbar-btn" title="Insert 9" onclick="window.insert && window.insert('9')">9</button>
                    <button class="toolbar-btn" title="Insert 4" onclick="window.insert && window.insert('4')">4</button>
                    <button class="toolbar-btn" title="Insert 5" onclick="window.insert && window.insert('5')">5</button>
                    <button class="toolbar-btn" title="Insert 6" onclick="window.insert && window.insert('6')">6</button>
                    <button class="toolbar-btn" title="Insert 1" onclick="window.insert && window.insert('1')">1</button>
                    <button class="toolbar-btn" title="Insert 2" onclick="window.insert && window.insert('2')">2</button>
                    <button class="toolbar-btn" title="Insert 3" onclick="window.insert && window.insert('3')">3</button>
                    <button class="toolbar-btn" title="Decimal point" onclick="window.insert && window.insert('.')">.</button>
                    <button class="toolbar-btn" title="Insert 0" onclick="window.insert && window.insert('0')">0</button>
                    <button class="toolbar-btn" title="Minus sign" onclick="window.insert && window.insert('-')">-</button>
                </div>
            </div>

            <div class="deck-group axes">
                <div class="group-header">AXES & ADDRESSES</div>
                <div class="grid-2">
                    <button class="toolbar-btn axis-blue" title="X axis address" onclick="window.insert && window.insert('X')">X</button>
                    <button class="toolbar-btn axis-blue" title="Y axis address" onclick="window.insert && window.insert('Y')">Y</button>
                    <button class="toolbar-btn axis-blue" title="Z axis address" onclick="window.insert && window.insert('Z')">Z</button>
                    <button class="toolbar-btn axis-blue" title="A axis address" onclick="window.insert && window.insert('A')">A</button>
                    <button class="toolbar-btn axis-blue" title="B axis address" onclick="window.insert && window.insert('B')">B</button>
                    <button class="toolbar-btn axis-blue" title="Macro variable prefix" onclick="window.insert && window.insert('#')">#</button>
                    <button class="toolbar-btn axis-blue" title="C axis address" onclick="window.insert && window.insert('C')">C</button>
                    <button class="toolbar-btn axis-blue" title="Arc center offset I" onclick="window.insert && window.insert('I')">I</button>
                    <button class="toolbar-btn axis-blue" title="Arc center offset J" onclick="window.insert && window.insert('J')">J</button>
                    <button class="toolbar-btn axis-blue" title="Arc center offset K" onclick="window.insert && window.insert('K')">K</button>
                </div>
            </div>

            <div class="deck-group math">
                <div class="group-header">MATH & LOGIC</div>
                <div class="grid-3">
                    <button class="toolbar-btn" title="Open expression bracket" onclick="window.insert && window.insert('[')">[</button>
                    <button class="toolbar-btn" title="Close expression bracket" onclick="window.insert && window.insert(']')">]</button>
                    <button class="toolbar-btn" title="Assignment equals" onclick="window.insert && window.insert('=')">=</button>
                    <button class="toolbar-btn" title="Addition operator" onclick="window.insert && window.insert('+')">+</button>
                    <button class="toolbar-btn" title="Subtraction operator" onclick="window.insert && window.insert('-')">-</button>
                    <button class="toolbar-btn" title="Multiplication operator" onclick="window.insert && window.insert('*')">*</button>
                    <button class="toolbar-btn" title="Division operator" onclick="window.insert && window.insert('/')">/</button>
                    <button class="toolbar-btn" title="Equality comparison" onclick="window.insert && window.insert('==')">==</button>
                    <button class="toolbar-btn" title="Inequality comparison" onclick="window.insert && window.insert('!=')">!=</button>
                    <button class="toolbar-btn" title="Less-than comparison" onclick="window.insert && window.insert('<')">&lt;</button>
                    <button class="toolbar-btn" title="Greater-than comparison" onclick="window.insert && window.insert('>')">&gt;</button>
                    <button class="toolbar-btn" title="Modulo operator" onclick="window.insert && window.insert('%')">%</button>
                </div>
            </div>

            <div class="deck-group functions">
                <div class="group-header">FUNCTIONS</div>
                <div class="grid-3">
                    <button class="toolbar-btn" title="Square root — SQRT[expr]" onclick="window.insert && window.insert('SQRT[')">SQRT[</button>
                    <button class="toolbar-btn" title="Absolute value — ABS[expr]" onclick="window.insert && window.insert('ABS[')">ABS[</button>
                    <button class="toolbar-btn" title="Sine, degrees — SIN[expr]" onclick="window.insert && window.insert('SIN[')">SIN[</button>
                    <button class="toolbar-btn" title="Cosine, degrees — COS[expr]" onclick="window.insert && window.insert('COS[')">COS[</button>
                    <button class="toolbar-btn" title="Arctangent, degrees — ATAN[y]/[x]" onclick="window.insert && window.insert('ATAN[')">ATAN[</button>
                    <button class="toolbar-btn" title="Modulo — a MOD b" onclick="window.insert && window.insert(' MOD ')">MOD</button>
                </div>
            </div>

            <div class="deck-group control-flow">
                <div class="group-header">CONTROL FLOW</div>
                <div class="grid-3">
                    <button class="toolbar-btn axis-blue" title="Conditional — C-style, no brackets on a simple IF (e.g. IF #1920!=2 GOTO1)" onclick="window.insert && window.insert('IF ')">IF</button>
                    <button class="toolbar-btn axis-blue" title="Jump to an N-label — NO space before the number (GOTO1)" onclick="window.insert && window.insert('GOTO')">GOTO</button>
                    <button class="toolbar-btn axis-blue" title="Label target — N1, N2 ... (success path jumps past the error handlers)" onclick="window.insert && window.insert('N')">N</button>
                    <button class="toolbar-btn" title="Open comment / operator message — ( text )" onclick="window.insert && window.insert('(')">(</button>
                    <button class="toolbar-btn" title="Close comment / operator message" onclick="window.insert && window.insert(')')">)</button>
                    <button class="toolbar-btn axis-blue" title="Operator message / pass-fail popup — #1505=1(msg) error, #1505=-5000(msg) ok" onclick="window.insert && window.insert('#1505')">#1505</button>
                </div>
            </div>

            <div class="deck-group g-codes">
                <div class="group-header">G-CODES</div>
                <div class="grid-2">
                    <button class="toolbar-btn axis-blue" title="Rapid positioning" onclick="window.insert && window.insert('G0 ')">G0</button>
                    <button class="toolbar-btn axis-blue" title="Linear interpolation" onclick="window.insert && window.insert('G1 ')">G1</button>
                    <button class="toolbar-btn axis-blue" title="Clockwise arc (I/J/K or R)" onclick="window.insert && window.insert('G2 ')">G2</button>
                    <button class="toolbar-btn axis-blue" title="Counter-clockwise arc (I/J/K or R)" onclick="window.insert && window.insert('G3 ')">G3</button>
                    <button class="toolbar-btn axis-blue" title="Dwell — G4 P&lt;seconds&gt;" onclick="window.insert && window.insert('G4 ')">G4</button>
                    <button class="toolbar-btn axis-blue" title="Machine coordinate move" onclick="window.insert && window.insert('G53 ')">G53</button>
                    <button class="toolbar-btn axis-blue" title="Absolute programming mode" onclick="window.insert && window.insert('G90 ')">G90</button>
                    <button class="toolbar-btn axis-blue" title="Incremental programming mode" onclick="window.insert && window.insert('G91 ')">G91</button>
                    <button class="toolbar-btn axis-blue" title="Probe move" onclick="window.insert && window.insert('G31 ')">G31</button>
                    <button class="toolbar-btn m-red" title="Program stop / pause" onclick="window.insert && window.insert('M0 ')">M0</button>
                    <button class="toolbar-btn m-red" title="Program end and rewind" onclick="window.insert && window.insert('M30')">M30</button>
                </div>
            </div>

            <div class="deck-group wcs">
                <div class="group-header">WORK OFFSETS</div>
                <div class="grid-3">
                    <button class="toolbar-btn axis-blue" title="Select work coordinate system G54" onclick="window.insert && window.insert('G54 ')">G54</button>
                    <button class="toolbar-btn axis-blue" title="Select work coordinate system G55" onclick="window.insert && window.insert('G55 ')">G55</button>
                    <button class="toolbar-btn axis-blue" title="Select work coordinate system G56" onclick="window.insert && window.insert('G56 ')">G56</button>
                    <button class="toolbar-btn axis-blue" title="Select work coordinate system G57" onclick="window.insert && window.insert('G57 ')">G57</button>
                    <button class="toolbar-btn axis-blue" title="Select work coordinate system G58" onclick="window.insert && window.insert('G58 ')">G58</button>
                    <button class="toolbar-btn axis-blue" title="Select work coordinate system G59" onclick="window.insert && window.insert('G59 ')">G59</button>
                </div>
            </div>

            <div class="deck-group m-codes">
                <div class="group-header">PROGRAM & MACHINE WORDS</div>
                <div class="grid-3">
                    <button class="toolbar-btn axis-blue" title="G-code address" onclick="window.insert && window.insert('G')">G</button>
                    <button class="toolbar-btn axis-blue" title="M-code address" onclick="window.insert && window.insert('M')">M</button>
                    <button class="toolbar-btn axis-blue" title="Parameter word (G31 probe input port)" onclick="window.insert && window.insert('P')">P</button>
                    <button class="toolbar-btn axis-blue" title="Probe trigger level — G31 L0 (NPN) / L1 (PNP)" onclick="window.insert && window.insert('L')">L</button>
                    <button class="toolbar-btn axis-blue" title="Probe stop mode — G31 Q1 (immediate) / Q0 (decelerate)" onclick="window.insert && window.insert('Q')">Q</button>
                    <button class="toolbar-btn axis-blue" title="Arc radius or parameter" onclick="window.insert && window.insert('R')">R</button>
                    <button class="toolbar-btn m-green" title="Spindle ON clockwise" onclick="window.insert && window.insert('M3 ')">M3</button>
                    <button class="toolbar-btn m-red" title="Spindle OFF" onclick="window.insert && window.insert('M5 ')">M5</button>
                    <button class="toolbar-btn m-green" title="Coolant ON" onclick="window.insert && window.insert('M8 ')">M8</button>
                    <button class="toolbar-btn m-red" title="Coolant OFF" onclick="window.insert && window.insert('M9 ')">M9</button>
                    <button class="toolbar-btn axis-blue" title="Tool radius offset register" onclick="window.insert && window.insert('D')">D</button>
                    <button class="toolbar-btn axis-blue" title="Feed rate word" onclick="window.insert && window.insert('F')">F</button>
                    <button class="toolbar-btn axis-blue" title="Tool length offset register" onclick="window.insert && window.insert('H')">H</button>
                    <button class="toolbar-btn axis-blue" title="Spindle speed word" onclick="window.insert && window.insert('S')">S</button>
                    <button class="toolbar-btn axis-blue" title="Tool selection word" onclick="window.insert && window.insert('T')">T</button>
                    <button class="toolbar-btn m-green" title="Set flag to 1" onclick="window.insert && window.insert('=1')">=1</button>
                </div>
            </div>
        `;
    }
}
