import { el } from './uiUtils.js';

export class CommandDeck {
    constructor(editorManager) {
        this.editorManager = editorManager;
        this.panel = el('deck-panel');
        this.build(); 
    }

    build() {
        // 1. Populate Header Zones
        this.renderHeader();

        // 2. Populate Body
        const body = document.querySelector('.dock-body');
        if (body) {
            // prefer using existing #deck-panel if present to remain backwards compatible
            const deckPanel = document.getElementById('deck-panel');

            // ROW 1: Editor Keys Container (3 equal slots: BACK / SPACE / ENTER)
            const editorRow = document.createElement('div');
            editorRow.className = 'dock-row editor-keys-row grid-3';
            editorRow.innerHTML = `
                <button class="toolbar-btn" data-ddcs-role="back">⌫ BACK</button>
                <button class="toolbar-btn" data-ddcs-role="space">␣ SPACE</button>
                <button class="toolbar-btn" data-ddcs-role="enter">↵ ENTER</button>
            `;
            // Use pointerdown for editor-row actions (prevents system keyboard on mobile and avoids click races)
            const backBtn = editorRow.querySelector('[data-ddcs-role="back"]');
            const spaceBtn = editorRow.querySelector('[data-ddcs-role="space"]');
            const enterBtn = editorRow.querySelector('[data-ddcs-role="enter"]');

            if (backBtn) backBtn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                backBtn.dataset.__ddcs_handled = '1';
                // SILENT EDIT: modify the editor value directly and update caret without focusing
                const ed = document.getElementById('editor');
                if (ed) {
                    const start = ed.selectionStart;
                    const end = ed.selectionEnd;
                    if (start !== end) {
                        // delete selection
                        ed.value = ed.value.slice(0, start) + ed.value.slice(end);
                        // tiny visible selection at deletion point
                        ed.setSelectionRange(start, Math.min(ed.value.length, start + 1));
                    } else if (start > 0) {
                        // delete single char before caret
                        ed.value = ed.value.slice(0, start - 1) + ed.value.slice(start);
                        const newPos = start - 1;
                        ed.setSelectionRange(newPos, Math.min(ed.value.length, newPos + 1));
                    }
                    // update syntax highlight / listeners without focusing
                    ed.dispatchEvent(new Event('input'));
                    // keep keyboard suppressed
                    ed.setAttribute('inputmode','none');
                    ed.blur();
                }
            }, { passive: false });

            if (spaceBtn) spaceBtn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                spaceBtn.dataset.__ddcs_handled = '1';
                window.insert && window.insert(' ');
                const ed = document.getElementById('editor'); if (ed) { ed.setAttribute('inputmode','none'); ed.blur(); }
            }, { passive: false });

            if (enterBtn) enterBtn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                enterBtn.dataset.__ddcs_handled = '1';
                window.insert && window.insert('\n');
                const ed = document.getElementById('editor'); if (ed) { ed.setAttribute('inputmode','none'); ed.blur(); }
            }, { passive: false });


            // If #deck-panel exists, clear and use it as macro container; otherwise create a fallback
            if (deckPanel) {
                // ensure deckPanel is emptied then inserted at the top so editorRow appears above it
                deckPanel.innerHTML = '';
                body.insertBefore(editorRow, deckPanel);
                this.buildMacroGroups(deckPanel);

                // Prevent buttons inside the deck panel stealing focus and handle insertion via pointerdown
                deckPanel.querySelectorAll('button').forEach(btn => {
                    btn.addEventListener('pointerdown', (e) => {
                        e.preventDefault();
                        try {
                            // mark handled so the subsequent click is swallowed by the capture guard
                            btn.dataset.__ddcs_handled = '1';
                            // Execute the existing inline handler (if any) without triggering native focus behavior
                            if (typeof btn.onclick === 'function') { btn.onclick.call(btn, e); }
                        } catch (err) { /* noop */ }
                        // After any insertion, ensure editor stays in 'no-keyboard' mode
                        const ed = document.getElementById('editor');
                        if (ed) { ed.setAttribute('inputmode', 'none'); ed.blur(); }
                    }, { passive: false });
                });
            } else {
                // fallback: create a macroGrid and append
                body.innerHTML = '';
                body.appendChild(editorRow);
                const macroGrid = document.createElement('div');
                macroGrid.className = 'dock-row macro-grid-area';
                this.buildMacroGroups(macroGrid);

                // Prevent buttons inside fallback macroGrid from stealing focus and handle insertion via pointerdown
                macroGrid.querySelectorAll('button').forEach(btn => {
                    btn.addEventListener('pointerdown', (e) => {
                        e.preventDefault();
                        try {
                            btn.dataset.__ddcs_handled = '1';
                            if (typeof btn.onclick === 'function') btn.onclick.call(btn, e);
                        } catch (err) { /* noop */ }
                        const ed = document.getElementById('editor'); if (ed) { ed.setAttribute('inputmode', 'none'); ed.blur(); }
                    }, { passive: false });
                });

                body.appendChild(macroGrid);
            }
        }
    }

    // Helper: Render header left/center/right
    renderHeader() {
        const leftTarget = document.querySelector('.dock-header .header-left');
        if (leftTarget) {
            leftTarget.innerHTML = `
                <div style="display:flex; gap:6px; align-items:center;">
                    <button class="toolbar-btn" onclick="openWiz && openWiz('comm')">💬 Comm</button>
                    <button class="toolbar-btn" onclick="openWiz && openWiz('wcs')">🔧 WCS</button>
                </div>
            `;
        }

        const centerTarget = document.querySelector('.dock-header .header-center');
        if (centerTarget) {
            centerTarget.innerHTML = `
                <div style="display:flex; gap:6px; width:auto; align-items:center;">
                    <button class="toolbar-btn wizard-btn" onclick="openCornerWiz && openCornerWiz()">📐 Corner</button>
                    <button class="toolbar-btn wizard-btn" onclick="openMiddleWiz && openMiddleWiz()">🎯 Middle</button>
                    <button class="toolbar-btn wizard-btn" onclick="openEdgeWiz && openEdgeWiz()">📏 Edge</button>
                    <button class="toolbar-btn wizard-btn" onclick="openAlignmentWiz && openAlignmentWiz()">🧭 Align</button>
                </div>
            `;
        }

        const rightTarget = document.querySelector('.dock-header .header-right');
        if (rightTarget) {
            rightTarget.innerHTML = `
                <div style="display:flex; gap:6px; align-items:center;">
                    <button class="toolbar-btn" onclick="copyCode && copyCode()">COPY</button>
                    <button class="toolbar-btn" onclick="clearCode && clearCode()">CLEAR</button>
                    <button class="toolbar-btn" onclick="downloadFile && downloadFile()">EXPORT</button>
                </div>
            `;
        }

        // Prevent header buttons from stealing focus (keep editor caret/keyboard state)
        document.querySelectorAll('.dock-header .header-left button, .dock-header .header-center button, .dock-header .header-right button')
            .forEach(btn => btn.addEventListener('pointerdown', (e) => { e.preventDefault(); }, { passive: false }));
        // Also ensure the header 'peeker' handle never summons the system keyboard on pointerdown
        const headerHandle = document.querySelector('#controller-dock .header-handle');
        if (headerHandle) headerHandle.addEventListener('pointerdown', (e) => { e.preventDefault(); }, { passive: false });
        // Global click-capture guard: if a button was handled on pointerdown (dataset flag),
        // swallow the following click to avoid duplicate insertions on iOS/Android.
        document.addEventListener('click', (ev) => {
            const t = ev.target;
            if (t && t.dataset && t.dataset.__ddcs_handled) {
                try { ev.stopImmediatePropagation(); ev.preventDefault(); } catch (e) { /* noop */ }
                try { delete t.dataset.__ddcs_handled; } catch (e) { /* noop */ }
            }
        }, true);    }

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

            <div class="deck-group g-codes">
                <div class="group-header">G-CODES</div>
                <div class="grid-2">
                    <button class="toolbar-btn axis-blue" title="Rapid positioning" onclick="window.insert && window.insert('G0 ')">G0</button>
                    <button class="toolbar-btn axis-blue" title="Linear interpolation" onclick="window.insert && window.insert('G1 ')">G1</button>
                    <button class="toolbar-btn axis-blue" title="Machine coordinate move" onclick="window.insert && window.insert('G53 ')">G53</button>
                    <button class="toolbar-btn axis-blue" title="Absolute programming mode" onclick="window.insert && window.insert('G90 ')">G90</button>
                    <button class="toolbar-btn axis-blue" title="Incremental programming mode" onclick="window.insert && window.insert('G91 ')">G91</button>
                    <button class="toolbar-btn axis-blue" title="Probe move" onclick="window.insert && window.insert('G31 ')">G31</button>
                    <button class="toolbar-btn m-red" title="Program stop / pause" onclick="window.insert && window.insert('M0 ')">M0</button>
                    <button class="toolbar-btn m-red" title="Program end and rewind" onclick="window.insert && window.insert('M30')">M30</button>
                </div>
            </div>

            <div class="deck-group m-codes">
                <div class="group-header">PROGRAM & MACHINE WORDS</div>
                <div class="grid-3">
                    <button class="toolbar-btn axis-blue" title="G-code address" onclick="window.insert && window.insert('G')">G</button>
                    <button class="toolbar-btn axis-blue" title="M-code address" onclick="window.insert && window.insert('M')">M</button>
                    <button class="toolbar-btn axis-blue" title="Parameter word" onclick="window.insert && window.insert('P')">P</button>
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
