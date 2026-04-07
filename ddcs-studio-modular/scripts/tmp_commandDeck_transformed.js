
class CommandDeck {
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

            // ROW 1: Editor Keys Container
            const editorRow = document.createElement('div');
            editorRow.className = 'dock-row editor-keys-row';
            editorRow.innerHTML = `
                <button class="toolbar-btn" onclick="window.backspace && window.backspace()">⌫ BACK</button>
                <button class="toolbar-btn" onclick="window.insert && window.insert(' ')">␣ SPACE</button>
                <button class="toolbar-btn" onclick="window.insert && window.insert('\\n')">↵ ENTER</button>
            `;

            // If #deck-panel exists, clear and use it as macro container; otherwise create a fallback
            if (deckPanel) {
                // ensure deckPanel is emptied then inserted at the top so editorRow appears above it
                deckPanel.innerHTML = '';
                body.insertBefore(editorRow, deckPanel);
                this.buildMacroGroups(deckPanel);
            } else {
                // fallback: create a macroGrid and append
                body.innerHTML = '';
                body.appendChild(editorRow);
                const macroGrid = document.createElement('div');
                macroGrid.className = 'dock-row macro-grid-area';
                this.buildMacroGroups(macroGrid);
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
    }

    // Helper: build macro groups into provided container
    buildMacroGroups(container) {
        if (!container) return;
        container.innerHTML = `
            <div class="deck-group numpad">
                <div class="group-header">NUMPAD</div>
                <div class="grid-3">
                    <button class="toolbar-btn" onclick="window.insert && window.insert('7')">7</button>
                    <button class="toolbar-btn" onclick="window.insert && window.insert('8')">8</button>
                    <button class="toolbar-btn" onclick="window.insert && window.insert('9')">9</button>
                    <button class="toolbar-btn" onclick="window.insert && window.insert('4')">4</button>
                    <button class="toolbar-btn" onclick="window.insert && window.insert('5')">5</button>
                    <button class="toolbar-btn" onclick="window.insert && window.insert('6')">6</button>
                    <button class="toolbar-btn" onclick="window.insert && window.insert('1')">1</button>
                    <button class="toolbar-btn" onclick="window.insert && window.insert('2')">2</button>
                    <button class="toolbar-btn" onclick="window.insert && window.insert('3')">3</button>
                    <button class="toolbar-btn" onclick="window.insert && window.insert('.')">.</button>
                    <button class="toolbar-btn" onclick="window.insert && window.insert('0')">0</button>
                    <button class="toolbar-btn" onclick="window.insert && window.insert('-')">-</button>
                </div>
            </div>

            <div class="deck-group axes">
                <div class="group-header">AXES & ADDRESSES</div>
                <div class="grid-3">
                    <button class="toolbar-btn" onclick="window.insert && window.insert('X')">X</button>
                    <button class="toolbar-btn" onclick="window.insert && window.insert('Y')">Y</button>
                    <button class="toolbar-btn" onclick="window.insert && window.insert('Z')">Z</button>
                    <button class="toolbar-btn" onclick="window.insert && window.insert('A')">A</button>
                    <button class="toolbar-btn" onclick="window.insert && window.insert('B')">B</button>
                    <button class="toolbar-btn" onclick="window.insert && window.insert('#')">#</button>
                </div>
            </div>

            <div class="deck-group g-codes">
                <div class="group-header">G-CODES</div>
                <div class="grid-4">
                    <button class="toolbar-btn" onclick="window.insert && window.insert('G0 ')">G0</button>
                    <button class="toolbar-btn" onclick="window.insert && window.insert('G1 ')">G1</button>
                    <button class="toolbar-btn" onclick="window.insert && window.insert('G53 ')">G53</button>
                    <button class="toolbar-btn" onclick="window.insert && window.insert('G31 ')">G31</button>
                    <button class="toolbar-btn" onclick="window.insert && window.insert('G90 ')">G90</button>
                    <button class="toolbar-btn" onclick="window.insert && window.insert('G91 ')">G91</button>
                    <button class="toolbar-btn" onclick="window.insert && window.insert('G4 P')">G4</button>
                    <button class="toolbar-btn" onclick="window.insert && window.insert('F')">F</button>
                </div>
            </div>

            <div class="deck-group m-codes">
                <div class="group-header">M-CODES & HARDWARE</div>
                <div class="grid-4">
                    <button class="toolbar-btn m-red" onclick="window.insert && window.insert('M3 ')">M3</button>
                    <button class="toolbar-btn m-red" onclick="window.insert && window.insert('M5 ')">M5</button>
                    <button class="toolbar-btn m-green" onclick="window.insert && window.insert('M8 ')">M8</button>
                    <button class="toolbar-btn m-green" onclick="window.insert && window.insert('M9 ')">M9</button>
                </div>
            </div>

            <div class="deck-group snippets">
                <div class="group-header">SNIPPETS</div>
                <div class="grid-3">
                    <button class="toolbar-btn" onclick="window.insert && window.insert('M30')">M30</button>
                    <button class="toolbar-btn" onclick="window.insert && window.insert('safe_z')">SafeZ</button>
                    <button class="toolbar-btn" onclick="window.insert && window.insert('=1')">WASH</button>
                </div>
            </div>
        `;
    }
}
