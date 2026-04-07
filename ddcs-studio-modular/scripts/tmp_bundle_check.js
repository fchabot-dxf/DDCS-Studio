// --- themes.js ---
/**
 * DDCS Studio Theme Engine
 * Contains all theme definitions and theme switching logic
 */

const THEMES = ['ddcs', 'normal', 'steampunk', 'futuristic', 'organic'];

class ThemeManager {
    constructor() {
        this.currentThemeIndex = 0;
        this.themes = THEMES;
    }

    toggle() {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % this.themes.length;
        const newTheme = this.themes[this.currentThemeIndex];
        document.body.setAttribute('data-theme', newTheme);
        const styleBtn = document.getElementById('styleBtn');
        if (styleBtn) {
            styleBtn.innerText = '🎨 ' + newTheme.toUpperCase();
        }
    }

    setCurrent(themeName) {
        const index = this.themes.indexOf(themeName);
        if (index !== -1) {
            this.currentThemeIndex = index;
            document.body.setAttribute('data-theme', themeName);
        }
    }

    getCurrent() {
        return this.themes[this.currentThemeIndex];
    }
}


// --- snippets.js ---
/**
 * DDCS Studio Code Snippets
 * Pre-defined G-code templates for common operations
 */

const SNIPPETS = {
    safe_z: `( Safe Z Retract - DDCS Compliant )\n#99=0\nG53 Z#99`,
    
    probe: `( Smart Probe - DDCS Compliant )\nG91\nG31 Z-10 F100 P3 L0 Q1\nIF #1922!=2 GOTO1\n#1505=-5000(Contact!)\nGOTO2\nN1\n#1505=1(Miss!)\nN2\nG90\nM30`,
    
    wash: `+0`
};


// --- uiUtils.js ---
/**
 * DDCS Studio UI Utilities
 * DOM helpers and common UI functions
 */

const el = (id) => document.getElementById(id);

class UIUtils {
    static showTooltip(element, content, xOffset = 10) {
        const tooltip = el('global-tooltip');
        if (!tooltip) return;
        
        const rect = element.getBoundingClientRect();
        tooltip.style.display = 'block';
        tooltip.style.left = (rect.right + xOffset) + 'px';
        tooltip.style.top = rect.top + 'px';
        tooltip.textContent = content;
        
        // Check if tooltip goes off-screen
        if (rect.right + 310 > window.innerWidth) {
            tooltip.style.left = (rect.left - 310) + 'px';
        }
    }

    static hideTooltip() {
        const tooltip = el('global-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }

    static insertAtCursor(textArea, text) {
        const start = textArea.selectionStart;
        const end = textArea.selectionEnd;
        textArea.value = textArea.value.slice(0, start) + text + textArea.value.slice(end);
        textArea.selectionStart = textArea.selectionEnd = start + text.length;
        textArea.focus();
        textArea.dispatchEvent(new Event('input'));
    }

    static downloadFile(filename, content) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    static formatGCode(code) {
        if (!code) return '';

        const safeCode = code
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // REGEX STRATEGY:
        // 1. Comments (Green) - Matches (...) or ;...
        // 2. G31 SPECIFIC (Blue) - Only matches G31 (Probe).
        // 3. M-Codes (Red) - Matches M3, M5, etc.
        // 4. AXIS LETTERS (Yellow) - STRICTLY X, Y, Z, A, B.
        // 5. DEFAULT - G0, G1, Numbers, Keywords, Vars -> White.

        return safeCode.replace(
            /(\([^\)]*\)|;[^\n]*)|(\b[Gg]31\b)|([Mm]\d+)|([XYZABxyzab])/g,
            
            (match, comment, g31, mcode, axis) => {
                
                // 1. Comments -> Green
                if (comment) return `<span class="g-comment">${match}</span>`;
                
                // 2. G31 Only -> Blue
                if (g31)     return `<span style="color:#60a5fa; font-weight:bold;">${match}</span>`;

                // 3. M-Codes -> Red
                if (mcode)   return `<span style="color:#fca5a5">${match}</span>`; 
                
                // 4. Axis Letters -> Yellow
                if (axis)    return `<span style="color:#facc15">${match}</span>`; 

                // Default -> White
                return match; 
            }
        );
    }
}


// --- editorManager.js ---
/**
 * DDCS Studio Editor Manager
 * Handles the main G-code text editor functionality
 */


class EditorManager {
    constructor() {
        this.editor = el('editor');
        this.highlight = el('editor-highlight'); // NEW
        this.backTimer = null;
        this.backInterval = null;

        this.setupSync(); // NEW
        this.setupBackspaceButton();
        this.setupSpacebarButton();
    }

    setupSync() {
        if (!this.editor || !this.highlight) return;

        const syncText = () => {
            let code = this.editor.value;
            // Critical: Add space if ends in newline to prevent cursor disappearance
            if (code.endsWith('\n')) code += ' '; 
            this.highlight.innerHTML = UIUtils.formatGCode(code);
        };

        const syncScroll = () => {
            this.highlight.scrollTop = this.editor.scrollTop;
            this.highlight.scrollLeft = this.editor.scrollLeft;
        };

        this.editor.addEventListener('input', syncText);
        this.editor.addEventListener('scroll', syncScroll);

        // Initial sync
        syncText();
    }

    setupBackspaceButton() {
        const btnBack = el('btn-backspace');
        if (!btnBack) return;

        const startBack = () => {
            // call the shared method so both UI button and global API use identical behavior
            this.backspace();
            this.backTimer = setTimeout(() => {
                this.backInterval = setInterval(() => this.backspace(), 80);
            }, 500);
        };

        const stopBack = () => {
            clearTimeout(this.backTimer);
            clearInterval(this.backInterval);
        };

        btnBack.addEventListener('mousedown', startBack);
        btnBack.addEventListener('mouseup', stopBack);
        btnBack.addEventListener('mouseleave', stopBack);
        btnBack.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startBack();
        }, { passive: false });
        btnBack.addEventListener('touchend', stopBack);
    }

    // Public: perform a single backspace operation at the current selection/caret
    backspace() {
        if (!this.editor) return;
        const pos = this.editor.selectionStart;
        if (this.editor.selectionStart !== this.editor.selectionEnd) {
            this.editor.setRangeText('', this.editor.selectionStart, this.editor.selectionEnd, 'end');
        } else if (pos > 0) {
            this.editor.setRangeText('', pos - 1, pos, 'end');
        }
        this.editor.dispatchEvent(new Event('input'));
        this.editor.focus();
    }

    setupSpacebarButton() {
        const btnSpace = el('btn-spacebar');
        if (!btnSpace) return;

        const insertSpace = () => {
            UIUtils.insertAtCursor(this.editor, ' ');
            this.editor.dispatchEvent(new Event('input'));
            this.editor.focus();
        };

        btnSpace.addEventListener('click', insertSpace);
    }

    insert(key, text = null) {
        const val = text || SNIPPETS[key] || key;
        UIUtils.insertAtCursor(this.editor, val);
    }

    copyCode() {
        this.editor.select();
        document.execCommand('copy');
    }

    clearCode() {
        if (confirm('Clear Editor?')) {
            this.editor.value = '';
            this.editor.dispatchEvent(new Event('input'));
        }
    }

    downloadFile() {
        const fname = (el('fname').value || '1000').toString();
        let code = this.editor.value || '';

        // Extract a friendly title from the first parenthetical header if present
        // e.g. "( Corner Finder | FL | X+ Y+ )" -> "Corner Finder | FL | X+ Y+"
        const firstNonEmpty = code.split(/\r?\n/).find(line => line.trim().length > 0) || '';
        let title = '';
        let titleFromHeader = false;
        const m = firstNonEmpty.match(/^\s*\(([^)]+)\)\s*$/);
        if (m) {
            title = m[1].trim();
            titleFromHeader = true;
        } else if (fname && fname !== '1000') {
            // If no header, but filename is descriptive, use it (strip O prefix if present)
            title = fname.replace(/^O/i, '').trim();
        } else {
            title = `O${fname}`;
        }

        // Ensure first line of the exported code contains the title as a comment
        const titleLine = `(${title})`;
        const lines = code.split(/\r?\n/);
        if (lines.length === 0 || lines[0].trim() !== titleLine) {
            // Prepend title line and ensure a blank line after for readability
            code = titleLine + '\n' + code + '\n';
        }

        // Determine download filename: when title came from header, use a sanitized version of it
        let outName = `O${fname}`;
        if (titleFromHeader && title) {
            // sanitize: keep letters/numbers and replace other groups with underscore
            let sanitized = title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
            sanitized = sanitized.replace(/^_+|_+$/g, '').slice(0, 60); // trim underscores, limit length
            if (sanitized.length > 0) {
                outName = `O${sanitized}`;
            }
        }

        UIUtils.downloadFile(`${outName}.nc`, code);
    }

    getValue() {
        return this.editor.value;
    }

    setValue(value) {
        this.editor.value = value;
        this.editor.dispatchEvent(new Event('input'));
    }
}


// --- scaleManager.js ---
/**
 * DDCS Studio Scale Manager
 * Handles viewport scaling and zoom functionality
 */

const SCALE_SEQUENCE = [1.0, 'auto', 1.5, 2.0, 0.5, 0.75];

class ScaleManager {
    constructor() {
        this.scaleIndex = 0;
        this.scaleSequence = SCALE_SEQUENCE;
    }

    toggle() {
        this.scaleIndex = (this.scaleIndex + 1) % this.scaleSequence.length;
        this.apply();
    }

    apply() {
        const appShell = document.querySelector('.app-shell');
        const btn = document.getElementById('scaleBtn');
        const wiz = document.querySelector('.wiz-box');
        
        const current = this.scaleSequence[this.scaleIndex];
        let scale;
        
        if (current === 'auto') {
            scale = Math.min(
                window.innerWidth / 1280,
                (window.innerHeight - 54) / 800
            );
            if (btn) {
                btn.innerText = '🔍 AUTO (' + Math.round(scale * 100) + '%)';
                btn.style.color = 'var(--success)';
            }
        } else {
            scale = current;
            if (btn) {
                btn.innerText = '🔍 ' + Math.round(scale * 100) + '%';
                btn.style.color = (scale !== 1.0) ? 'var(--warn)' : '';
            }
        }
        
        scale = Math.max(scale, 0.25);
        
        // Apply scaling to the app shell (sidebar + main) so header remains unscaled
        if (appShell) {
            appShell.style.transformOrigin = 'top left';
            appShell.style.transform = 'scale(' + scale + ')';
            appShell.style.width = 'calc(100% / ' + scale + ')';
            appShell.style.height = 'calc((100vh - 54px) / ' + scale + ')';
        }

        // Keep wizard overlays independent of the global scale (stay full-screen)
        if (wiz) {
            wiz.style.transform = '';
        }
    }

    isAutoScale() {
        return this.scaleSequence[this.scaleIndex] === 'auto';
    }
}


// --- varListPanel.js ---

class VarListPanel {
    constructor(variableDB, editorManager, onSearchChange = null) {
        this.variableDB = variableDB;
        this.editorManager = editorManager;
        this.onSearchChange = onSearchChange;

        // container moved to secondary-toolbar
        this.container = document.querySelector('.secondary-toolbar');
        this.searchInput = el('search');
        this.clearBtn = el('clearBtn');
        this.csvInput = el('csvInput');
        this.varList = el('varList');
        this.dbStatus = el('dbStatus');

        this.setupEventListeners();
        this.activeFilters = {
            user: true,
            system: true,
            hasDesc: false,
            probeG31: false,
            wcs: false,
            axisRange: false
        };
        this.setupFilterUI();
        this.refresh();
    }

    setupEventListeners() {
        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => {
                const term = this.searchInput.value.toLowerCase().trim();
                if (term.length > 0) {
                    const results = this.variableDB.search(term);
                    this.renderResults(results);
                    if (this.onSearchChange) {
                        this.onSearchChange(term.length > 0);
                    }
                } else {
                    this.refresh();
                    if (this.onSearchChange) this.onSearchChange('');
                }
            });
        }

        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => this.clear());
        }

        if (this.csvInput) {
            this.csvInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    this.variableDB.loadFromCSV(ev.target.result);
                    this.refresh();
                    if (this.onSearchChange) this.onSearchChange('');
                };
                reader.readAsText(file);
            });
        }

        // Horizontal ticker support: convert vertical wheel to horizontal scroll
        if (this.varList) {
            this.varList.addEventListener('wheel', (e) => {
                if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                    e.preventDefault();
                    this.varList.scrollLeft += e.deltaY;
                    try { this.varList.dataset.wheelHandled = '1'; } catch (err) { /* noop */ }
                }
            }, { passive: false });
        }

        // Setup filter menu interactions
        const filterbarBtn = document.getElementById('filterbarBtn');
        const filterbarMenu = document.getElementById('filterbarMenu');
        if (filterbarBtn && filterbarMenu) {
            filterbarBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = filterbarMenu.classList.contains('hidden');
                if (isHidden) {
                    // Position menu fixed relative to viewport so it escapes stacking/overflow
                    const rect = filterbarBtn.getBoundingClientRect();
                    filterbarMenu.style.position = 'fixed';
                    filterbarMenu.style.left = rect.left + 'px';
                    filterbarMenu.style.top = (rect.bottom + 6) + 'px';
                    // ensure minimum width matching button
                    filterbarMenu.style.minWidth = Math.max(rect.width, 200) + 'px';
                    filterbarMenu.classList.remove('hidden');
                    filterbarBtn.setAttribute('aria-expanded', 'true');
                    filterbarMenu.setAttribute('aria-hidden', 'false');
                    // focus first checkbox for keyboard users
                    const first = filterbarMenu.querySelector('input[type="checkbox"]');
                    if (first) first.focus();
                } else {
                    filterbarMenu.classList.add('hidden');
                    filterbarBtn.setAttribute('aria-expanded', 'false');
                    filterbarMenu.setAttribute('aria-hidden', 'true');
                }
            });

            // Close the menu when clicking outside (but ignore clicks inside the menu or button)
            document.addEventListener('click', (ev) => {
                const target = ev.target;
                if (!filterbarMenu.classList.contains('hidden')) {
                    if (!filterbarMenu.contains(target) && !filterbarBtn.contains(target)) {
                        filterbarMenu.classList.add('hidden');
                        filterbarBtn.setAttribute('aria-expanded', 'false');
                        filterbarMenu.setAttribute('aria-hidden', 'true');
                    }
                }
            });

            // Close on Escape key
            document.addEventListener('keydown', (ev) => {
                if (ev.key === 'Escape' && !filterbarMenu.classList.contains('hidden')) {
                    filterbarMenu.classList.add('hidden');
                    filterbarBtn.setAttribute('aria-expanded', 'false');
                    filterbarMenu.setAttribute('aria-hidden', 'true');
                    filterbarBtn.focus();
                }
            });

            // Checkbox handlers
            const inputs = filterbarMenu.querySelectorAll('input[type="checkbox"]');
            inputs.forEach(inp => {
                inp.addEventListener('change', () => {
                    const key = inp.dataset.filter;
                    this.activeFilters[key] = inp.checked;
                    this.refresh();
                });
            });

            const clearBtn = document.getElementById('filterbarClear');
            if (clearBtn) {
                clearBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    // reset to defaults
                    this.activeFilters = { user: true, system: true, hasDesc: false, probeG31: false, wcs: false, axisRange: false };
                    inputs.forEach(i => {
                        const k = i.dataset.filter;
                        i.checked = !!this.activeFilters[k];
                    });
                    this.refresh();
                });
            }
        }
    }

    clear() {
        if (this.searchInput) {
            this.searchInput.value = '';
            this.searchInput.focus();
        }
        if (this.clearBtn) this.clearBtn.style.display = 'none';
        this.refresh();
        if (this.onSearchChange) this.onSearchChange('');
    }

    refresh() {
        const all = this.variableDB.getAll();
        // Apply current filters
        const filtered = this.applyFilters(all);
        this.renderResults(filtered);

        // Filter button label is static: 'Filters' — no dynamic count needed.

        if (this.dbStatus) {
            // keep backwards compat for any code that still expects dbStatus text
            this.dbStatus.innerText = all.length > 0 ? `SAVED: ${all.length} VARS` : 'NO DB LOADED';
        }
    }

    applyFilters(all) {
        if (!all || all.length === 0) return all || [];
        const f = this.activeFilters || {};
        let res = all.slice();

        // Filter by type: user/system
        if (!f.user && f.system) {
            res = res.filter(v => v.isSys);
        } else if (f.user && !f.system) {
            res = res.filter(v => !v.isSys);
        } else if (!f.user && !f.system) {
            // nothing selected
            return [];
        }

        if (f.hasDesc) {
            res = res.filter(v => v.d && v.d.trim().length > 0);
        }

        if (f.probeG31) {
            res = res.filter(v => {
                const d = (v.d || '').toLowerCase();
                return d.includes('probe') || d.includes('g31');
            });
        }

        if (f.wcs) {
            res = res.filter(v => {
                const d = (v.d || '').toLowerCase();
                return d.includes('g54') || d.includes('g55') || d.includes('g56') || d.includes('g57') || d.includes('g58') || d.includes('g59') || d.includes('wcs');
            });
        }

        if (f.axisRange) {
            res = res.filter(v => {
                const m = (v.i || '').toString().match(/(\d+)$/);
                if (!m) return false;
                const num = parseInt(m[1], 10);
                return num >= 790 && num <= 844;
            });
        }

        return res;
    }

    // Sync filter UI inputs with current activeFilters state
    setupFilterUI() {
        const filterbarMenu = document.getElementById('filterbarMenu');
        if (!filterbarMenu) return;
        const inputs = filterbarMenu.querySelectorAll('input[type="checkbox"]');
        inputs.forEach(i => {
            const k = i.dataset.filter;
            if (k && this.activeFilters.hasOwnProperty(k)) {
                i.checked = !!this.activeFilters[k];
            }
        });
    }

    renderResults(results) {
        const list = this.varList;
        if (!list) return;
        list.innerHTML = '';

        if (!results || results.length === 0) {
            list.innerHTML = '<div style="padding:20px; text-align:center; opacity:0.5; font-size:12px;">No variables</div>';
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'category-content';

        results.forEach(v => {
            const div = document.createElement('div');
            const isSystem = v.isSys;
            div.className = `var-item ${isSystem ? 'sys-var' : 'usr-var'}`;

            div.addEventListener('mouseenter', () => {
                const tooltipContent = `${v.d || 'User Variable'}\n\nID: ${v.i}\nType: ${v.t}`;
                UIUtils.showTooltip(div, tooltipContent);
            });

            div.addEventListener('mouseleave', () => {
                UIUtils.hideTooltip();
            });

            // Compact display for secondary toolbar: show only numeric id prefixed with '#'
            let displayId = v.i;
            try {
                const m = v.i.match(/(\d+)$/);
                displayId = m ? `#${m[1]}` : v.i;
            } catch (err) { /* noop */ }

            // Short description preview (beginning of the description)
            const fullDesc = v.d || 'User Variable';
            let shortDesc = fullDesc.replace(/\s+/g, ' ').trim();
            if (shortDesc.length > 36) shortDesc = shortDesc.slice(0, 36).trim() + '…';

            // Escape quotes for attribute usage
            const safeFullDesc = fullDesc.replace(/"/g, '&quot;').replace(/`/g, '\\`');

            div.innerHTML = `<div class="var-id">${displayId}</div><div class="var-desc" title="${safeFullDesc}">${shortDesc}</div>`;

            // Add title attribute for native tooltip/focus accessibility on the container too
            div.setAttribute('title', `${fullDesc}\nID: ${v.i}\nType: ${v.t}`);

            div.addEventListener('click', () => {
                if (this.editorManager) this.editorManager.insert(null, v.i.split('-')[0]);
            });

            grid.appendChild(div);
        });

        const wrapper = document.createElement('div');
        wrapper.innerHTML = `<div class="category-header"><span>VARIABLES (${results.length})</span></div>`;
        wrapper.appendChild(grid);
        list.appendChild(wrapper);
    }
}


// --- commandDeck.js ---

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


// --- dockManager.js ---



class DockManager {
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
    }

    clear() {
        this.varListPanel.clear();
    }
}


// --- variableDB.js ---
/**
 * DDCS Studio Variable Database Manager
 * Handles DDCS M350 system and user variable catalog
 */

const STORAGE_KEY = 'ddcs_vars_persistent';

class VariableDatabase {
    constructor() {
        this.activeDB = [];
        this.loadFromStorage();
    }

    loadFromStorage() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                this.activeDB = JSON.parse(saved);
                this.updateStatus();
            } catch (e) {
                console.error('Failed to load variable database:', e);
            }
        }

        // If no saved DB, try to load default variables generated at build time
        if (!this.activeDB || this.activeDB.length === 0) {
            // dynamic import so missing file won't throw at load time
            import('./default_vars.js').then(mod => {
                if (mod && mod.DEFAULT_VAR_CSV) {
                    try {
                        this.loadFromCSV(mod.DEFAULT_VAR_CSV);
                        console.debug('Loaded default variables from default_vars.js');
                    } catch (err) {
                        console.warn('Failed to load default vars from module:', err);
                    }
                }
            }).catch(() => {
                // No default_vars.js present (development or intentionally omitted) — ignore silently
            });
        }
    }

    saveToStorage() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.activeDB));
        this.updateStatus();
    }

    updateStatus() {
        // update legacy status if present
        const statusEl = document.getElementById('dbStatus');
        if (statusEl) {
            statusEl.innerText = this.activeDB.length > 0 
                ? `SAVED: ${this.activeDB.length} VARS`
                : 'NO DB LOADED';
        }
        // Filter button is static; no dynamic count required.
    }

    loadFromCSV(fileContent) {
        const lines = fileContent.split(/\r?\n/);
        const newDB = [];
        
        lines.forEach((line, index) => {
            if (!line.trim()) return;
            
            // Split by comma, respecting quoted fields
            let parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (parts.length < 2) return;
            
            let id = parts[0].replace(/^"|"$/g, '').trim();
            let type = parts[1]?.replace(/^"|"$/g, '').trim() || '';
            let desc = parts[2]?.replace(/^"|"$/g, '').trim() || '';
            let notes = parts[3]?.replace(/^"|"$/g, '').trim() || '';
            
            // Skip header row
            if (index === 0 && isNaN(id) && !id.startsWith('#')) return;
            
            // Ensure ID has # prefix
            if (/^\d+$/.test(id)) id = '#' + id;
            
            let isSystem = (desc.length > 0);
            
            if (id.startsWith('#')) {
                newDB.push({
                    i: id,
                    t: type,
                    d: desc,
                    n: notes,
                    isSys: isSystem
                });
            }
        });
        
        this.activeDB = newDB;
        this.saveToStorage();
    }

    search(searchTerm) {
        const terms = searchTerm.toLowerCase().split(/\s+/).filter(t => t);
        return this.activeDB.filter(v => {
            const str = (v.i + " " + v.d).toLowerCase();
            return terms.every(t => str.includes(t));
        });
    }

    getAll() {
        return this.activeDB;
    }
}


// --- middleWizard.js ---
/**
 * DDCS Studio - Middle Wizard
 * Generates G-code for finding center of pockets or bosses
 */

class MiddleWizard {
    constructor() {
        // No special initialization needed
    }

    generate(params) {
        const {
            featureType,    // 'pocket' or 'boss'
            axis,           // 'X' or 'Y'
            dir1,           // 'pos' or 'neg' (first probe direction)
            syncA,          // Sync A axis with Y
            slave,          // Slave select value (3=A,4=B)
            wcs,            // WCS target
            dist,           // Max probe distance
            retract,        // Retract distance
            safeZ,          // Safe Z height
            clearance,      // Clearance distance (used for findBoth auto-jog)
            f_fast,         // Fast feed rate
            f_slow,         // Slow feed rate
            port,           // Probe input port
            level,          // Probe level (0 or 1)
            qStop,          // Stop mode (0 or 1)
            findBoth        // If true, automatically perform both edge probes without user pauses
        } = params;

        // Axis-specific probe status and result variables
        const axisStatus = axis === 'X' ? '#1920' : '#1921';
        const axisResult = axis === 'X' ? '#1925' : '#1926';
        const axisOffset = axis === 'X' ? 0 : 1;

        // Direction signs
        const dir1Sign = dir1 === 'pos' ? '+' : '-';
        const dir2Sign = dir1 === 'pos' ? '-' : '+';

        // Generate WCS code
        const { wcsCode, wcsLabel } = this.generateWCSCode(wcs);

        // Feature type label
        const typeLabel = featureType === 'pocket' ? 'Pocket (Inside)' : 'Boss (Outside)';

        // Build G-code
        let gcode = this.generateHeader(axis, typeLabel, wcsLabel, dir1Sign, dir2Sign, dist, retract, f_fast, f_slow, findBoth);
        gcode += this.generateMotionVariables(dist, retract, f_fast, f_slow, port, clearance);
        gcode += this.generatePrecalcMotionVariables(dist, retract, '0', clearance, 0, 0);
        gcode += wcsCode;
        gcode += this.generateConfirmStart();
        gcode += `G91  ( Incremental mode )\n\n`;

        if (featureType === 'pocket') {
            gcode += this.generatePocketSequence(axis, dir1Sign, dir2Sign, axisStatus, axisResult, level, qStop, retract, findBoth);
        } else {
            gcode += this.generateBossSequence(axis, dir1Sign, dir2Sign, axisStatus, axisResult, level, qStop, retract, findBoth);
        }

        gcode += this.generateCenterCalculation();
        gcode += this.generateWCSWrite(wcsLabel, axis, axisOffset);

        // Dual gantry sync
        if (syncA && axis === 'Y') {
            const s = slave || '3';
            gcode += `( Dual Gantry Sync )\n`;
            gcode += `#808=#883  ( Sync A with Y machine pos )\n`;
            gcode += `#[#10+${s}]=#883  ( Write sync result to slave offset )\n\n`;
        }

        gcode += this.generateFooter();

        return gcode;
    }

    generateWCSCode(wcs) {
        let wcsCode = '';
        let wcsLabel = '';

        if (wcs === 'active') {
            wcsCode = `( Read Active WCS )\n#11=1 ( Wash: prime )\n#11=#578 ( Read active WCS )\n`;
            wcsCode += `#10=805+[#11-1]*5  ( Calculate base address )\n\n`;
            wcsLabel = 'Active WCS';
        } else {
            const wcsMap = {
                'G54': 805, 'G55': 810, 'G56': 815,
                'G57': 820, 'G58': 825, 'G59': 830
            };
            const baseAddr = wcsMap[wcs];
            wcsCode = `( Target: ${wcs} )\n#10=${baseAddr}  ( Base address )\n\n`;
            wcsLabel = wcs;
        }

        return { wcsCode, wcsLabel };
    }

    generateHeader(axis, typeLabel, wcsLabel, dir1Sign, dir2Sign, dist, retract, f_fast, f_slow, findBoth) {
        let header = `( Middle Finder | ${axis} Axis | ${typeLabel} | ${wcsLabel} )\n`;
        header += `( DDCS M350 V10.0 Compliant )\n`;  
        header += `( First probe: ${dir1Sign}${axis}, then ${dir2Sign}${axis} )\n`;
        header += `( Distance: ${dist}mm | Retract: ${retract}mm | Fast: ${f_fast} | Slow: ${f_slow} )\n`;
        header += `( Probe both axes: ${findBoth ? 'Yes' : 'No'} )\n\n`;
        return header;
    }

    generateMotionVariables(dist, retract, f_fast, f_slow, port, clearance) {
        let vars = `( Motion Variables - #1-#10 for seamless movement )\n`;
        vars += `#1=${dist}      ( Max probe distance )\n`;
        vars += `#2=${retract}   ( Retract distance )\n`;
        vars += `#3=${f_fast}    ( Fast feed )\n`;
        vars += `#4=${f_slow}    ( Slow feed )\n`;
        vars += `#5=${port}      ( Probe port )\n`;
        vars += `#6=${clearance} ( Clearance/jog distance )\n`;
        vars += `( Result storage - #50+ for persistence )\n`;
        vars += `#51=0            ( First edge result )\n`;
        vars += `#52=0            ( Second edge result )\n`;
        vars += `#53=0            ( Center result )\n\n`;
        return vars;
    }

    generatePrecalcMotionVariables(dist, retract, safeZ, clearance, travelDist, scanDepth) {
        // dist -> #1, retract -> #2, clearance -> #6
        const td = parseInt(travelDist) || 0;
        let vars = `( Pre-calculated motion values - #7-#19 )\n`;
        vars += `#7=[0-#1] ( Negative max probe )\n`;
        vars += `#8=#1     ( Positive max probe )\n`;
        vars += `#9=[0-#2] ( Negative retract )\n`;
        vars += `#10=#2    ( Positive retract )\n`;
        vars += `#11=[0-#2*2] ( Negative double retract )\n`;
        vars += `#12=[#2*2]   ( Positive double retract )\n`;
        vars += `#13=#6      ( Positive clearance )\n`;
        vars += `#14=[0-#6]  ( Negative clearance )\n`;
        vars += `#15=${td} ( Positive travel )\n`;
        vars += `#16=[0-${td}] ( Negative travel )\n\n`;
        return vars;
    }

    generateConfirmStart() {
        return `( Confirm Start )\n#1505=1 (Press Enter to probe)\n\n`;
    }

    generatePocketSequence(axis, dir1Sign, dir2Sign, axisStatus, axisResult, level, qStop, retract, findBoth) {
        let code = `( === POCKET: Probe from inside toward walls === )\n\n`;

        // Prepare signed variable names
        const firstProbeVar = (dir1Sign === '+') ? '#8' : '#7';
        const firstRetractInv = (dir1Sign === '+') ? '#9' : '#10';
        const firstSlowVar = (dir1Sign === '+') ? '#12' : '#11';
        const oppProbeVar = (dir2Sign === '+') ? '#8' : '#7';
        const oppRetractInv = (dir2Sign === '+') ? '#9' : '#10';
        const oppSlowVar = (dir2Sign === '+') ? '#12' : '#11';
        const travelProbeVar = (dir2Sign === '+') ? '#8' : '#7';
        const travelClearVar = (dir2Sign === '+') ? '#13' : '#14';

        // First probe (dir1)
        code += `( Step 1: Probe ${dir1Sign}${axis} )\n`;
        code += `G31 ${axis}${firstProbeVar} F#3 P#5 L${level} Q${qStop}  ( Fast )\n`;
        code += `IF ${axisStatus}!=2 GOTO1\n`;
        code += `G0 ${axis}${firstRetractInv}  ( Retract )\n`;
        code += `G31 ${axis}${firstSlowVar} F#4 P#5 L${level} Q${qStop}  ( Slow )\n`;
        code += `IF ${axisStatus}!=2 GOTO1\n`;
        code += `#51=1 ( Wash: prime )\n`;
        code += `#51=${axisResult}  ( Save first edge )\n`;
        code += `G0 ${axis}${firstRetractInv}  ( Retract from wall )\n\n`;

        if (findBoth) {
            // Automatically move to the opposite side (without user pause)
            code += `( Auto-travel to opposite side )\n`;
            code += `G0 ${axis}${travelProbeVar}  ( Move across by max probe distance )\n`;
            code += `G0 ${axis}${travelClearVar}  ( Additional clearance )\n\n`;
        } else {
            // Pause to let user see first position and optionally reposition
            code += `( Pause - First edge found at #51 )\n`;
            // Confirm prompt is handled by the calling context to avoid duplicates


        }

        // Second probe (opposite direction)
        code += `( Step 2: Probe ${dir2Sign}${axis} )\n`;
        code += `G31 ${axis}${oppProbeVar} F#3 P#5 L${level} Q${qStop}  ( Fast )\n`;
        code += `IF ${axisStatus}!=2 GOTO1\n`;
        code += `G0 ${axis}${oppRetractInv}  ( Retract )\n`;
        code += `G31 ${axis}${oppSlowVar} F#4 P#5 L${level} Q${qStop}  ( Slow )\n`;
        code += `IF ${axisStatus}!=2 GOTO1\n`;
        code += `#52=1 ( Wash: prime )\n`;
        code += `#52=${axisResult}  ( Save second edge )\n`;
        code += `G0 ${axis}${oppRetractInv}  ( Retract from wall )\n\n`;

        return code;
    }

    generateBossSequence(axis, dir1Sign, dir2Sign, axisStatus, axisResult, level, qStop, retract, findBoth) {
        let code = `( === BOSS: Probe from outside toward feature === )\n\n`;

        const firstProbeVar = (dir1Sign === '+') ? '#8' : '#7';
        const firstRetractInv = (dir1Sign === '+') ? '#9' : '#10';
        const firstSlowVar = (dir1Sign === '+') ? '#10' : '#9';
        const travelProbeVar = (dir2Sign === '+') ? '#8' : '#7';
        const travelClearVar = (dir2Sign === '+') ? '#13' : '#14';
        const oppProbeVar = (dir2Sign === '+') ? '#8' : '#7';
        const oppRetractInv = (dir2Sign === '+') ? '#9' : '#10';
        const oppSlowVar = (dir2Sign === '+') ? '#10' : '#9';

        // First probe (dir1 - toward boss)
        code += `( Step 1: Probe ${dir1Sign}${axis} toward boss )\n`;
        code += `G31 ${axis}${firstProbeVar} F#3 P#5 L${level} Q${qStop}  ( Fast )\n`;
        code += `IF ${axisStatus}!=2 GOTO1\n`;
        code += `G0 ${axis}${firstRetractInv}  ( Retract )\n`;
        code += `G31 ${axis}${firstSlowVar} F#4 P#5 L${level} Q${qStop}  ( Slow )\n`;
        code += `IF ${axisStatus}!=2 GOTO1\n`;
        code += `#51=1 ( Wash: prime )\n`;
        code += `#51=${axisResult}  ( Save first edge )\n`;
        code += `G0 ${axis}${firstRetractInv}  ( Retract from edge )\n\n`;

        if (findBoth) {
            code += `( Auto-jog to opposite side )\n`;
            code += `G0 ${axis}${travelProbeVar}  ( Move across by max probe distance )\n`;
            code += `G0 ${axis}${travelClearVar}  ( Additional clearance )\n\n`;
        } else {
            // Pause and jog instruction
            code += `( Pause - Jog to opposite side of boss )\n`;
            // Confirm prompt is handled by the calling context to avoid duplicates


        }

        // Second probe (same direction - toward boss from other side)
        code += `( Step 2: Probe ${dir2Sign}${axis} toward boss )\n`;
        code += `G31 ${axis}${oppProbeVar} F#3 P#5 L${level} Q${qStop}  ( Fast )\n`;
        code += `IF ${axisStatus}!=2 GOTO1\n`;
        code += `G0 ${axis}${oppRetractInv}  ( Retract )\n`;
        code += `G31 ${axis}${oppSlowVar} F#4 P#5 L${level} Q${qStop}  ( Slow )\n`;
        code += `IF ${axisStatus}!=2 GOTO1\n`;
        code += `#52=1 ( Wash: prime )\n`;
        code += `#52=${axisResult}  ( Save second edge )\n`;
        code += `G0 ${axis}${oppRetractInv}  ( Retract from edge )\n\n`;

        return code;
    }

    generateCenterCalculation() {
        let code = `( Calculate Center )\n`;
        code += `#53=[#51+#52]/2  ( Average of two edges )\n\n`;
        return code;
    }

    generateWCSWrite(wcsLabel, axis, axisOffset) {
        let code = `( Write to WCS )\n`;
        code += `#[#10+${axisOffset}]=#53  ( Set ${wcsLabel} ${axis} to center )\n\n`;
        return code;
    }

    generateFooter() {
        let footer = `G90  ( Back to absolute )\n`;
        footer += `#1505=-5000(Center found at #53!)\n`;
        footer += `GOTO2\n\n`;
        footer += `N1\n`;
        footer += `#1505=1(Probe failed - no contact!)\n`;
        footer += `G90\n\n`;
        footer += `N2\nM30\n`;
        return footer;
    }
}


// --- communicationWizard.js ---
/**
 * DDCS Studio - Communication Wizard
 * Generates G-code for controller communication and UI interactions
 */

// CommunicationWizard: Generates UI G-code (popup/status/input/etc.)
// No runtime verifier is invoked here to keep generation deterministic.
class CommunicationWizard {
    constructor() {
        // No special initialization needed
    }

    generate(params) {
        const {
            type,       // popup, status, input, beep, alarm, dwell, keywait
            msg,        // Message text
            val,        // Value (for beep/dwell)
            popupMode,  // Popup mode (for popup type)
            id,         // Variable ID (for input type)
            dest,       // Destination variable (for input type)
            slot1,      // Data slot 1 (#1510)
            slot2,      // Data slot 2 (#1511)
            slot3,      // Data slot 3 (#1512)
            slot4       // Data slot 4 (#1513)
        } = params;

        let gcode = '';

        // Generate slots code if supported
        const supportsSlots = ['popup', 'status', 'alarm', 'input'].includes(type);
        const slotsCode = this.generateSlotsCode(supportsSlots, slot1, slot2, slot3, slot4);

        // Generate specific communication type
        switch (type) {
            case 'popup':
                gcode = this.generatePopup(slotsCode, popupMode, msg);
                break;
            case 'status':
                gcode = this.generateStatus(slotsCode, msg);
                break;
            case 'input':
                gcode = this.generateInput(slotsCode, id, dest, msg);
                break;
            case 'beep':
                gcode = this.generateBeep(val);
                break;
            case 'alarm':
                gcode = this.generateAlarm(slotsCode, msg);
                break;
            case 'dwell':
                gcode = this.generateDwell(val);
                break;
            case 'keywait':
                gcode = this.generateKeyWait();
                break;
            default:
                gcode = `( Unknown communication type: ${type} )`;
        }

        // Ensure #2070 usage is safe: restrict target id to #50-#499.
        // If caller supplied an unsafe id, use a safe temp (e.g. #100) and copy to destination.
        return gcode;
    }

    generateSlotsCode(supportsSlots, slot1, slot2, slot3, slot4) {
        if (!supportsSlots) return '';

        let slotsCode = '';
        // V9.20: Data Slots Integration (No spaces around =)
        if (slot1) slotsCode += `#1510=${slot1}\n`;
        if (slot2) slotsCode += `#1511=${slot2}\n`;
        if (slot3) slotsCode += `#1512=${slot3}\n`;
        if (slot4) slotsCode += `#1513=${slot4}\n`;

        return slotsCode;
    }

    generatePopup(slotsCode, mode, msg) {
        let gcode = `${slotsCode}( Popup Message )\n`;
        gcode += `#1505=${mode}\n`;
        gcode += `(MSG,${msg})`;
        return gcode;
    }

    generateStatus(slotsCode, msg) {
        let gcode = `${slotsCode}( Status Bar Update )\n`;
        gcode += `#1503=1\n`;
        gcode += `(MSG,${msg})`;
        return gcode;
    }

    generateInput(slotsCode, id, dest, msg) {
        // V9.20: DDCS Compliant - #2070 can only write to #50-#499
        // Normalize id (allow '#100' or 100 input) and enforce safe range.
        const idNum = Number(String(id).replace('#', ''));
        let gcode = `${slotsCode}( Numeric Input - DDCS Safe )\n`;
        if (Number.isFinite(idNum) && idNum >= 50 && idNum <= 499) {
            // Safe to use directly
            gcode += `#2070=${idNum}(${msg})\n`;
            gcode += `${dest}=#${idNum} (Copy to persistent)`;
        } else {
            // Use a safe temporary variable (#100) and copy result to destination
            const temp = 100;
            gcode += `#2070=${temp}(${msg})\n`;
            gcode += `${dest}=#${temp} (Copy to persistent)`;
        }
        return gcode;
    }

    generateBeep(val) {
        return `( System Beep )\n#2042=${val}`;
    }

    generateAlarm(slotsCode, msg) {
        let gcode = `${slotsCode}( Trigger Alarm )\n`;
        gcode += `#3000=1(MSG,${msg})`;
        return gcode;
    }

    generateDwell(val) {
        return `G4 P${val}`;
    }

    generateKeyWait() {
        let gcode = `( Key Wait )\n`;
        gcode += `#2038=0\n`;
        gcode += `M0`;
        return gcode;
    }

    /**
     * Get UI field visibility based on communication type
     * This helps the UI know which fields to show/hide
     */
    getFieldVisibility(type) {
        return {
            showMode: type === 'popup',
            showValue: type === 'beep' || type === 'dwell',
            showMessage: type !== 'dwell' && type !== 'keywait',
            showSlots: ['popup', 'status', 'alarm', 'input'].includes(type),
            showVar: type === 'input'
        };
    }
}


// --- wcsWizard.js ---
/**
 * DDCS Studio - WCS (Work Coordinate System) Wizard
 * Generates G-code for zeroing WCS offsets
 * V9.20 - DDCS Compliant (Direct #805+ writes, NO G10)
 */

// WCSWizard: Generates WCS zeroing G-code. No runtime verifier invoked here to keep generation deterministic.
class WCSWizard {
    constructor() {
        // WCS base addresses for G54-G59
        this.wcsBaseMap = {
            '54': 805,  // G54
            '55': 810,  // G55
            '56': 815,  // G56
            '57': 820,  // G57
            '58': 825,  // G58
            '59': 830   // G59
        };
    }

    generate(params) {
        const {
            sys,        // WCS system: "0" for auto-detect, or "54"-"59" for specific
            axisX,      // Zero X axis
            axisY,      // Zero Y axis
            axisZ,      // Zero Z axis
            axisA,      // Zero A axis
            sync,       // Enable dual gantry sync
            slave       // Slave axis: "3" for A, "4" for B
        } = params;

        const auto = (sys === "0");
        
        // Build axis list
        const axes = [];
        if (axisX) axes.push({ axis: "X", offset: 0, var: "#880" });
        if (axisY) axes.push({ axis: "Y", offset: 1, var: "#881" });
        if (axisZ) axes.push({ axis: "Z", offset: 2, var: "#882" });
        if (axisA) axes.push({ axis: "A", offset: 3, var: "#883" });

        let gcode = this.generateHeader();

        if (auto) {
            gcode += this.generateAutoWCS(axes);
        } else {
            gcode += this.generateFixedWCS(sys, axes);
        }

        if (sync) {
            gcode += this.generateDualGantrySync(auto, sys, slave);
        }

        // Generation complete - no verifier run here (verifier module is paused)

        return gcode;
    }

    generateHeader() {
        let header = `( WCS Zeroing - DDCS M350 Compliant )\n`;
        header += `( Direct #805+ writes - G10 not used )\n\n`;
        return header;
    }

    generateAutoWCS(axes) {
        let gcode = `( Auto-detect active WCS from #578 )\n`;
        gcode += `#150=#578\n`;
        gcode += `#151=805+[#150-1]*5\n\n`;
        gcode += `( Zero selected axes )\n`;
        
        axes.forEach(a => {
            gcode += `#[#151+${a.offset}]=${a.var}\n`;
        });

        return gcode;
    }

    generateFixedWCS(sys, axes) {
        const wcsIndex = parseInt(sys) - 53;
        const base = 805 + (wcsIndex - 1) * 5;
        
        let gcode = `( Fixed WCS: G${sys} - Base address #${base} )\n`;
        gcode += `( Zero selected axes )\n`;
        
        axes.forEach(a => {
            gcode += `#${base + a.offset}=${a.var}\n`;
        });

        return gcode;
    }

    generateDualGantrySync(auto, sys, slave) {
        const slaveOffset = (slave === "3") ? 3 : 4;
        const slaveChar = (slave === "3") ? "A" : "B";
        
        let gcode = `\n( Dual Gantry Sync - Slave ${slaveChar} )\n`;
        
        if (auto) {
            gcode += `#[#151+${slaveOffset}]=#88${slave}\n`;
        } else {
            const wcsIndex = parseInt(sys) - 53;
            const base = 805 + (wcsIndex - 1) * 5;
            gcode += `#${base + slaveOffset}=#88${slave}\n`;
        }

        return gcode;
    }

    /**
     * Get WCS system name for display
     */
    getWCSName(sys) {
        if (sys === "0") return "Active WCS";
        return `G${sys}`;
    }

    /**
     * Get WCS base address
     */
    getWCSBase(sys) {
        if (sys === "0") return "Auto-detected";
        return this.wcsBaseMap[sys] || "Unknown";
    }

    /**
     * Validate WCS system number
     */
    isValidWCS(sys) {
        return sys === "0" || (sys >= "54" && sys <= "59");
    }
}


// --- cornerWizard.js ---
/**
 * DDCS Studio - Corner Wizard
 * Generates G-code for corner probing operations
 */

class CornerWizard {
    constructor() {
        this.defaultScanDepth = 5;
    }

    // Helper: return signed expression string for a movement variable or number
    getSignedVar(sign, varName, invert=false) {
        const s = invert ? (sign === '+' ? '-' : '+') : sign;
        // for positive sign return varName (no leading +), for negative return -varName
        return (s === '+' ? '' : '-') + varName;
    }

    // Helper: parse numeric inputs safely
    toNum(v, def=0) {
        if (v === undefined || v === null) return def;
        const n = Number(v);
        return Number.isFinite(n) ? n : def;
    }

    generate(params) {
        const {
            corner,
            probeZ,
            syncA,
            slave,
            probeSeq,
            wcs,
            dist,
            retract,
            f_fast,
            f_slow,
            port,
            level,
            qStop,
            safeZ,
            clearance,
            travelDist
        } = params;

        // Normalize numeric params
        const _dist = this.toNum(dist, 0);
        const _retract = this.toNum(retract, 0);
        const _f_fast = this.toNum(f_fast, 0);
        const _f_slow = this.toNum(f_slow, 0);
        const _port = this.toNum(port, 0);
        const _level = this.toNum(level, 0);
        const _qStop = this.toNum(qStop, 0);
        const _safeZ = this.toNum(safeZ, 0);
        const _travelDist = this.toNum(travelDist, 0);
        const _clearance = this.toNum(clearance, 2);

        // Derive directions from corner location
        let xDir, yDir;
        if (corner === 'FL') {
            xDir = '+'; yDir = '+';
        } else if (corner === 'FR') {
            xDir = '-'; yDir = '+';
        } else if (corner === 'BL') {
            xDir = '+'; yDir = '-';
        } else if (corner === 'BR') {
            xDir = '-'; yDir = '-';
        }

        // WCS variable setup (strict variable mapping)
        let wcsCode = '';
        let wcsLabel = '';
        if (wcs === 'active') {
            wcsCode += `( Read Active WCS )\n#71=1 (Wash/Prime)\n#71=#578 (Read active WCS: 1=G54, 2=G55, etc)\n`;
            wcsCode += `#70=805+[#71-1]*5 (Base WCS address)\n\n`;
            wcsLabel = 'Active WCS';
        } else {
            const wcsMap = {
                'G54': 805, 'G55': 810, 'G56': 815,
                'G57': 820, 'G58': 825, 'G59': 830
            };
            wcsCode += `( Target: ${wcs} )\n#70=${wcsMap[wcs]} (Base WCS address)\n\n`;
            wcsLabel = wcs;
        }

        // Build G-code
        let gcode = this.generateHeader(corner, xDir, yDir, probeZ, wcsLabel, _dist, _retract, _travelDist, _f_fast, _f_slow, _safeZ);
        gcode += this.generateMotionVariables(_dist, _retract, _f_fast, _f_slow, _port, _clearance);
        gcode += this.generatePrecalcMotionVariables(_dist, _retract, _safeZ, _travelDist, this.defaultScanDepth);
        gcode += wcsCode;
        gcode += this.generateConfirmStart();
        gcode += `G91 ( INCREMENTAL MODE )\n\n`;

        let step = 1;

        // Optional Z surface probe
        if (probeZ) {
            gcode += this.generateZProbe(step, _level, _qStop, _retract, _safeZ, wcsLabel);
            step++;
        }

        // Probe sequence: YX or XY
        if (probeSeq === 'YX') {
            gcode += this.generateYXSequence(step, xDir, yDir, probeZ, _level, _qStop, _retract, _safeZ, _travelDist, wcsLabel);
        } else {
            gcode += this.generateXYSequence(step, xDir, yDir, probeZ, _level, _qStop, _retract, _safeZ, _travelDist, wcsLabel);
        }

        // Dual gantry sync (write to selected slave offset)
        if (syncA) {
            const s = slave || '3';
            gcode += `( Dual Gantry Sync )\n`;
            gcode += `G91 ( Incremental mode for sync )\n`;
            gcode += `G1 A0 F#3 ( Move A to 0 position )\n`;
            gcode += `G90 ( Back to absolute mode )\n`;
            // Write into dynamic WCS base + slave offset
            gcode += `#[#70+${s}]=#883 ( Sync A with Y )\n\n`;
        }

        gcode += this.generateFooter(corner);

        return gcode;
    }

    generateWCSCode(wcs) {
        let wcsCode = '';
        let wcsLabel = '';

        if (wcs === 'active') {
            wcsCode = `( Read Active WCS )\n#11=1 ( Wash: prime )\n#11=#578 ( Read active WCS: 1=G54, 2=G55, etc )\n`;
            wcsCode += `#10=805+[#11-1]*5  ( Calculate base address )\n\n`;
            wcsLabel = 'Active WCS';
        } else {
            const wcsMap = {
                'G54': 805, 'G55': 810, 'G56': 815,
                'G57': 820, 'G58': 825, 'G59': 830
            };
            const baseAddr = wcsMap[wcs];
            wcsCode = `( Target: ${wcs} )\n#10=${baseAddr}  ( Base address )\n\n`;
            wcsLabel = wcs;
        }

        return { wcsCode, wcsLabel };
    }

    generateHeader(corner, xDir, yDir, probeZ, wcsLabel, dist, retract, travelDist, f_fast, f_slow, safeZ) {
        let header = `( Corner Finder | ${corner} | X${xDir} Y${yDir}`;
        if (probeZ) header += ` + Z Surface`;
        header += ` | ${wcsLabel} )\n`;
        header += `( DDCS M350 V10.0 - Pure Incremental Pattern )\n`;  
        header += `( User positioned probe correctly before starting )\n`;
        header += `( Max probe: ${dist}mm | Retract: ${retract}mm | Travel: ${travelDist}mm )\n`;
        header += `( Fast: ${f_fast} | Slow: ${f_slow} | SafeZ: ${safeZ}mm | Scan depth: ${this.defaultScanDepth}mm )\n\n`;
        return header;
    }

    generateMotionVariables(dist, retract, f_fast, f_slow, port, clearance) {
        // Include clearance (#6) to ensure downstream pre-calculations have a source
        let vars = `( Motion Variables - #1-#10 for seamless movement )\n`;
        vars += `#1=${dist} ( Max probe distance )\n`;
        vars += `#2=${retract} ( Retract after probe )\n`;
        vars += `#3=${f_fast} ( Fast speed )\n`;
        vars += `#4=${f_slow} ( Slow speed )\n`;
        vars += `#5=${port} ( Probe port )\n`;
        vars += `#6=${clearance || 2} ( Clearance/jog distance )\n\n`;
        return vars;
    }

    generatePrecalcMotionVariables(dist, retract, safeZ, travelDist, scanDepth) {
        const pd = parseInt(safeZ) + parseInt(scanDepth);
        const td = parseInt(travelDist) || 0;
        let vars = `( Pre-calculated motion values - #7-#19 )\n`;
        vars += `#7=[0-#1] ( Negative max probe )\n`;
        vars += `#8=#1     ( Positive max probe )\n`;
        vars += `#9=[0-#2] ( Negative retract )\n`;
        vars += `#10=#2    ( Positive retract )\n`;
        vars += `#11=[0-#2*2] ( Negative double retract )\n`;
        vars += `#12=[#2*2]   ( Positive double retract )\n`;
        vars += `#13=#6      ( Positive clearance )\n`;
        vars += `#14=[0-#6]  ( Negative clearance )\n`;
        vars += `#15=${td} ( Positive travel )\n`;
        vars += `#16=[0-${td}] ( Negative travel )\n`;
        vars += `#17=${pd} ( Plunge depth )\n`;
        vars += `#18=[0-#17] ( Negative plunge )\n`;
        vars += `#19=${safeZ} ( Safe Z )\n\n`;
        return vars;
    }

    generateConfirmStart() {
        return `( Confirm Start )\n#1505=1 (Press Enter to probe)\n\n`;
    }

    generateZProbe(step, level, qStop, retract, safeZ, wcsLabel) {
        // #1: Max probe dist, #2: Retract, #3: Fast, #4: Slow, #5: Port, #70: Base WCS, #60: temp, #62: temp
        let code = `( Step ${step}: Z Surface Probe )\n`;
        code += `G31 Z#7 F#3 P#5 L${level} Q${qStop} ( Fast probe down )\n`;
        code += `IF #1922!=2 GOTO1\n`;
        code += `G0 Z#10 ( Retract up )\n`;
        code += `G31 Z#11 F#4 P#5 L${level} Q${qStop} ( Slow probe )\n`;
        code += `IF #1922!=2 GOTO1\n`;
        code += `#[#70+2]=#1927 (Save ${wcsLabel} Z offset)\n`;
        code += `G0 Z#9 ( Retract away from wall )\n`;
        code += `G0 Z#19 ( Safe Z above surface )\n\n`;
        return code;
    }

    generateYXSequence(step, xDir, yDir, probeZ, level, qStop, retract, safeZ, travelDist, wcsLabel) {
        const scanDepth = this.defaultScanDepth;
        const plungeDepth = parseInt(safeZ) + parseInt(scanDepth);
        // Pre-calculated vars: #7/#8 probe, #9/#10 retract, #11/#12 double, #15/#16 travel, #17/#18 plunge, #19 safeZ
        const yProbeVar = (yDir === '+') ? '#8' : '#7';
        const yRetractVarInv = (yDir === '+') ? '#9' : '#10'; // invert retract (used right after fast probe)
        const ySlowVar = (yDir === '+') ? '#12' : '#11';
        const yRetractVar = yRetractVarInv; // same var name for readability
        const xProbeVar = (xDir === '+') ? '#8' : '#7';
        const xRetractVarInv = (xDir === '+') ? '#9' : '#10';
        const xSlowVar = (xDir === '+') ? '#12' : '#11';
        const travelPosVar = '#15';
        const travelNegVar = '#16';
        let code = '';
        // --- Y Probe ---
        code += `( Step ${step}: Y Probe )\n`;
        if (!probeZ) {
            code += `G0 Z#19 ( Safe Z )\n`;
        }
        code += `G0 Z#18 ( Down to scan depth )\n`;
        code += `G31 Y${yProbeVar} F#3 P#5 L${level} Q${qStop} ( Fast probe )\n`;
        code += `IF #1921!=2 GOTO1\n`;
        code += `G0 Y${yRetractVarInv} ( Retract )\n`;
        code += `G31 Y${ySlowVar} F#4 P#5 L${level} Q${qStop} ( Slow probe )\n`;
        code += `IF #1921!=2 GOTO1\n`;
        code += `#[#70+1]=#1926 (Save ${wcsLabel} Y offset)\n`;
        code += `G0 Y${yRetractVar} ( Retract from wall )\n`;
        code += `G0 Z#19 ( Safe Z above surface )\n\n`;
        step++;
        // --- Travel to X ---
        code += `( Step ${step}: Travel to X )\n`;
        // Clear Y edge by retract distance (signed)
        const clearYVar = (yDir === '+') ? '#10' : '#9';
        code += `G0 Y${clearYVar} ( Clear Y edge by ${retract}mm )\n`;
        // Move away in X by travelDist (opposite sign)
        const xTravelVar = (xDir === '+') ? travelNegVar : travelPosVar; // invert travel direction
        code += `G0 X${xTravelVar} ( Move away ${travelDist}mm in X )\n`;
        code += `G0 Z#18 ( Down to scan depth )\n\n`;
        step++;
        // --- X Probe ---
        code += `( Step ${step}: X Probe )\n`;
        code += `G31 X${xProbeVar} F#3 P#5 L${level} Q${qStop} ( Fast probe )\n`;
        code += `IF #1920!=2 GOTO1\n`;
        code += `G0 X${xRetractVarInv} ( Retract )\n`;
        code += `G31 X${xSlowVar} F#4 P#5 L${level} Q${qStop} ( Slow probe )\n`;
        code += `IF #1920!=2 GOTO1\n`;
        code += `#[#70+0]=#1925 (Save ${wcsLabel} X offset)\n`;
        code += `G0 X${xRetractVarInv} ( Retract from wall )\n`;
        code += `G0 Z#19 ( Safe Z above surface )\n\n`;
        return code;
    }

    generateXYSequence(step, xDir, yDir, probeZ, level, qStop, retract, safeZ, travelDist, wcsLabel) {
        const scanDepth = this.defaultScanDepth;
        const plungeDepth = parseInt(safeZ) + parseInt(scanDepth);
        // Pre-calculated vars: #7/#8 probe, #9/#10 retract, #11/#12 double, #15/#16 travel, #17/#18 plunge, #19 safeZ
        const xProbeVar = (xDir === '+') ? '#8' : '#7';
        const xRetractVarInv = (xDir === '+') ? '#9' : '#10';
        const xSlowVar = (xDir === '+') ? '#10' : '#9';
        const yProbeVar = (yDir === '+') ? '#8' : '#7';
        const yRetractVarInv = (yDir === '+') ? '#9' : '#10';
        const ySlowVar = (yDir === '+') ? '#10' : '#9';
        const travelPosVar = '#15';
        const travelNegVar = '#16';
        let code = '';
        // --- X Probe ---
        code += `( Step ${step}: X Probe )\n`;
        if (!probeZ) {
            code += `G0 Z#19 ( Safe Z )\n`;
        }
        code += `G0 Z#18 ( Down to scan depth )\n`;
        code += `G31 X${xProbeVar} F#3 P#5 L${level} Q${qStop} ( Fast probe )\n`;
        code += `IF #1920!=2 GOTO1\n`;
        code += `G0 X${xRetractVarInv} ( Retract )\n`;
        code += `G31 X${xSlowVar} F#4 P#5 L${level} Q${qStop} ( Slow probe )\n`;
        code += `IF #1920!=2 GOTO1\n`;
        code += `#[#70+0]=#1925 (Save ${wcsLabel} X offset)\n`;
        code += `G0 X${xRetractVarInv} ( Retract from wall )\n`;
        code += `G0 Z#19 ( Safe Z above surface )\n\n`;
        step++;
        // --- Travel to Y ---
        code += `( Step ${step}: Travel to Y )\n`;
        // Clear X edge by retract distance (signed)
        const clearXVar = (xDir === '+') ? '#10' : '#9';
        code += `G0 X${clearXVar} ( Clear X edge by ${retract}mm )\n`;
        // Move away in Y by travelDist (opposite sign)
        const yTravelVar = (yDir === '+') ? travelNegVar : travelPosVar;
        code += `G0 Y${yTravelVar} ( Move away ${travelDist}mm in Y )\n`;
        code += `G0 Z#18 ( Down to scan depth )\n\n`;
        step++;
        // --- Y Probe ---
        code += `( Step ${step}: Y Probe )\n`;
        code += `G31 Y${yProbeVar} F#3 P#5 L${level} Q${qStop} ( Fast probe )\n`;
        code += `IF #1921!=2 GOTO1\n`;
        code += `G0 Y${yRetractVarInv} ( Retract )\n`;
        code += `G31 Y${ySlowVar} F#4 P#5 L${level} Q${qStop} ( Slow probe )\n`;
        code += `IF #1921!=2 GOTO1\n`;
        code += `#[#70+1]=#1926 (Save ${wcsLabel} Y offset)\n`;
        code += `G0 Y${yRetractVarInv} ( Retract from wall )\n`;
        code += `G0 Z#19 ( Safe Z above surface )\n\n`;
        return code;
    }

    generateFooter(corner) {
        let footer = `G90 ( Back to absolute )\n`;
        footer += `#1505=-5000 (Corner ${corner} Found!)\nGOTO2\n\n`;
        footer += `N1\n#1505=1 (Probe Failed!)\n`;
        footer += `G91 G0 Z${parseInt(this.defaultScanDepth) + parseInt(5)} ( Safe Z )\n`;
        footer += `G90\n\nN2\nM30\n`;
        return footer;
    }
}


// --- edgeWizard.js ---
/**
 * DDCS Studio - Edge Wizard
 * Generates G-code for single edge probing operations
 */

class EdgeWizard {
    constructor() {
        // No special initialization needed
    }

    generate(params) {
        const {
            axis,       // 'X' or 'Y'
            dir,        // 'pos' or 'neg'
            wcs,        // WCS target
            dist,       // Max probe distance
            retract,    // Retract distance
            clearance,  // Clearance / additional jog distance when finding opposite
            findBoth,   // If true, auto-jog and probe opposite edge
            syncA,      // dual gantry sync
            slave,      // slave selection for dual gantry
            f_fast,     // Fast feed rate
            f_slow,     // Slow feed rate
            port,       // Probe input port
            level,      // Probe level (0 or 1)
            qStop       // Stop mode (0 or 1)
        } = params;

        // Axis-specific probe status and result variables
        const axisStatus = axis === 'X' ? '#1920' : '#1921';
        const axisResult = axis === 'X' ? '#1925' : '#1926';
        const axisOffset = axis === 'X' ? 0 : 1;

        // Direction signs
        const dirSign = dir === 'pos' ? '+' : '-';
        const retractSign = dir === 'pos' ? '-' : '+';

        // Generate WCS code
        const { wcsCode, wcsLabel } = this.generateWCSCode(wcs);

        // Build G-code
        let gcode = this.generateHeader(axis, dirSign, wcsLabel, dist, retract, f_fast, f_slow, findBoth);
        gcode += this.generateMotionVariables(dist, retract, f_fast, f_slow, port, clearance);        gcode += this.generatePrecalcMotionVariables(dist, retract, '0', clearance, 0, 0);        gcode += wcsCode;
        gcode += this.generateConfirmStart(axis, dirSign);
        gcode += `G91  ( Incremental mode )\n\n`;
        gcode += this.generateFastProbe(axis, dirSign, axisStatus, level, qStop);
        gcode += this.generateRetract(axis, retractSign);
        gcode += this.generateSlowProbe(axis, dirSign, axisStatus, axisResult, level, qStop);

        if (findBoth) {
            // save first edge in #50 already done in slow probe
            // auto-travel to opposite side and probe again into #51
            const dirOppSign = dir === 'pos' ? '-' : '+';
            gcode += `( Auto-travel to opposite edge )\n`;
            const travelProbeVar = (dirOppSign === '+') ? '#8' : '#7';
            const travelClearVar = (dirOppSign === '+') ? '#13' : '#14';
            gcode += `G0 ${axis}${travelProbeVar}  ( Move across by max probe distance )\n`;
            gcode += `G0 ${axis}${travelClearVar}  ( Additional clearance )\n\n`;
            gcode += `( Step: Probe opposite edge )\n`;
            gcode += this.generateFastProbe(axis, dirOppSign, axisStatus, level, qStop);
            gcode += this.generateRetract(axis, (dirOppSign === '+') ? '-' : '+');
            // Slow probe into second result
            gcode += `( Slow Probe - Opposite )\n`;
            const oppDoubleVar = (dirOppSign === '+') ? '#12' : '#11';
            gcode += `G31 ${axis}${oppDoubleVar} F#4 P#5 L${level} Q${qStop}\n`;
            gcode += `IF ${axisStatus}!=2 GOTO1\n`;
            gcode += `#51=1 ( Wash: prime )\n`;
            gcode += `#51=${axisResult}  ( Save opposite edge )\n`;
            const oppRetractVar = (dirOppSign === '+') ? '#9' : '#10';
            gcode += `G0 ${axis}${oppRetractVar}  ( Retract from opposite edge )\n\n`;

            // Compute width and center
            gcode += `( Compute width and center )\n`;
            gcode += `#54=[#51-#50]  ( OppositeEdge - Edge )\n`;
            gcode += `#53=[#50+#51]/2  ( Center between edges )\n\n`;
        }

        gcode += this.generateWCSWrite(wcsLabel, axis, axisOffset);

        // Dual gantry sync support for edge probes
        if (syncA) {
            const s = slave || '3';
            gcode += `( Dual Gantry Sync )\n`;
            gcode += `#[#10+${s}]=#883  ( Write sync result to slave offset )\n\n`;
        }

        gcode += this.generateFinalRetract(axis, retractSign);
        gcode += this.generateFooter();

        return gcode;
    }

    generateWCSCode(wcs) {
        let wcsCode = '';
        let wcsLabel = '';

        if (wcs === 'active') {
            wcsCode = `( Read Active WCS )\n#11=1 ( Wash: prime )\n#11=#578 ( Read active WCS )\n`;
            wcsCode += `#10=805+[#11-1]*5  ( Calculate base address )\n\n`;
            wcsLabel = 'Active WCS';
        } else {
            const wcsMap = {
                'G54': 805, 'G55': 810, 'G56': 815,
                'G57': 820, 'G58': 825, 'G59': 830
            };
            const baseAddr = wcsMap[wcs];
            wcsCode = `( Target: ${wcs} )\n#10=${baseAddr}  ( Base address )\n\n`;
            wcsLabel = wcs;
        }

        return { wcsCode, wcsLabel };
    }

    generateHeader(axis, dirSign, wcsLabel, dist, retract, f_fast, f_slow) {
        let header = `( Edge Finder | ${axis}${dirSign} | ${wcsLabel} )\n`;
        header += `( DDCS M350 V10.0 Compliant )\n`;  
        header += `( Distance: ${dist}mm | Retract: ${retract}mm | Fast: ${f_fast} | Slow: ${f_slow} )\n\n`;
        return header;
    }

    generateMotionVariables(dist, retract, f_fast, f_slow, port, clearance) {
        let vars = `( Motion Variables - #1-#10 for seamless movement )\n`;
        vars += `#1=${dist}      ( Max probe distance )\n`;
        vars += `#2=${retract}   ( Retract distance )\n`;
        vars += `#3=${f_fast}    ( Fast feed )\n`;
        vars += `#4=${f_slow}    ( Slow feed )\n`;
        vars += `#5=${port}      ( Probe port )\n`;
        vars += `#6=${clearance || 2} ( Clearance/jog distance )\n`;
        vars += `( Result storage )\n`;
        vars += `#50=0            ( Edge result )\n`;
        vars += `#51=0            ( Opposite edge result )\n`;
        vars += `#54=0            ( Width )\n\n`;
        return vars;
    }

    generatePrecalcMotionVariables(dist, retract, safeZ, clearance, travelDist, scanDepth) {
        // dist -> #1, retract -> #2, clearance -> #6
        const td = parseInt(travelDist) || 0;
        let vars = `( Pre-calculated motion values - #7-#19 )\n`;
        vars += `#7=[0-#1] ( Negative max probe )\n`;
        vars += `#8=#1     ( Positive max probe )\n`;
        vars += `#9=[0-#2] ( Negative retract )\n`;
        vars += `#10=#2    ( Positive retract )\n`;
        vars += `#11=[0-#2*2] ( Negative double retract )\n`;
        vars += `#12=[#2*2]   ( Positive double retract )\n`;
        vars += `#13=#6      ( Positive clearance )\n`;
        vars += `#14=[0-#6]  ( Negative clearance )\n`;
        vars += `#15=${td} ( Positive travel )\n`;
        vars += `#16=[0-${td}] ( Negative travel )\n\n`;
        return vars;
    }

    generateConfirmStart(axis, dirSign) {
        return `( Confirm Start )\n#1505=1 (Press Enter to probe ${axis}${dirSign})\n\n`;
    }

    generateFastProbe(axis, dirSign, axisStatus, level, qStop) {
        let code = `( Fast Probe )\n`;
        const probeVar = (dirSign === '+') ? '#8' : '#7';
        code += `G31 ${axis}${probeVar} F#3 P#5 L${level} Q${qStop}\n`;
        code += `IF ${axisStatus}!=2 GOTO1\n\n`;
        return code;
    }

    generateRetract(axis, retractSign) {
        let code = `( Retract )\n`;
        const retractVar = (retractSign === '+') ? '#10' : '#9';
        code += `G0 ${axis}${retractVar}\n\n`;
        return code;
    }

    generateSlowProbe(axis, dirSign, axisStatus, axisResult, level, qStop) {
        let code = `( Slow Probe )\n`;
        const doubleVar = (dirSign === '+') ? '#12' : '#11';
        code += `G31 ${axis}${doubleVar} F#4 P#5 L${level} Q${qStop}\n`;
        code += `IF ${axisStatus}!=2 GOTO1\n`;
        code += `#50=1 ( Wash: prime )\n`;
        code += `#50=${axisResult}  ( Save edge position )\n\n`;
        return code;
    }

    generateWCSWrite(wcsLabel, axis, axisOffset) {
        let code = `( Write to WCS )\n`;
        code += `#[#10+${axisOffset}]=#50  ( Set ${wcsLabel} ${axis} to edge )\n\n`;
        return code;
    }

    // Use precomputed retract variables (#10/#9) to avoid inline sign+variable
    // Avoid using a positive sign immediately before a variable (e.g., axis + #var). This form is disallowed by DDCS M350.
    // Negative signed variables (axis - #var) are permitted by community macros.
    generateFinalRetract(axis, retractSign) {
        let code = `( Retract from edge )\n`;
        const retractVar = (retractSign === '+') ? '#10' : '#9';
        code += `G0 ${axis}${retractVar}\n\n`;
        return code;
    }

    generateFooter() {
        let footer = `G90  ( Back to absolute )\n`;
        footer += `#1505=-5000(Edge found!)\n`;
        footer += `GOTO2\n\n`;
        footer += `N1\n`;
        footer += `#1505=1(Probe failed - no contact!)\n`;
        footer += `G90\n\n`;
        footer += `N2\nM30\n`;
        return footer;
    }
}


// --- wizardManager.js ---
/**
 * DDCS Studio Wizard Manager
 * Coordinates all wizard dialogs and code generation
 */






class WizardManager {
    constructor(editorManager) {
        this.editorManager = editorManager;
        this.cornerWizard = new CornerWizard();
        this.middleWizard = new MiddleWizard();
        this.edgeWizard = new EdgeWizard();
        this.communicationWizard = new CommunicationWizard();
        this.wcsWizard = new WCSWizard();
        this.wizardElement = el('wizard');
        // Defensive: only setup listeners if wizard container is present
        if (this.wizardElement) {
            this.setupEventListeners();
        } else {
            console.warn('WizardManager: wizard element (#wizard) not found');
        }
    }

    setupEventListeners() {
        // Click outside wizard to close
        this.wizardElement.addEventListener('click', (e) => {
            if (e.target.id === 'wizard') {
                this.close();
            }
        });

        // Escape key to close wizard
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.wizardElement && this.wizardElement.classList.contains('active')) {
                    this.close();
                    e.preventDefault();
                }
            }
        });

        // Setup input listeners for all wizard controls
        this.setupWizardInputListeners();
    }

    setupWizardInputListeners() {
        const wizInputs = [
            'c_type', 'c_msg', 'c_val', 'c_id', 'c_dest', 'c_popup_mode',
            'c_slot1', 'c_slot2', 'c_slot3', 'c_slot4',
            'w_sys', 'w_x', 'w_y', 'w_z', 'w_a', 'w_sync', 'w_slave',
            'p_mode', 'p_axis', 'p_dir', 'p_dist', 'p_feed_fast', 'p_feed_slow',
            'p_back', 'p_retract', 'p_type', 'p_hop', 'p_port', 'p_level', 'p_q',
            'p_corner', 'p_probe_z', 'p_sync_a', 'p_probe_seq', 'p_wcs',
            'p_approach', 'p_x_approach', 'p_y_approach', 'p_scan_depth',
            'p_travel_dist', 'p_edge_clear', 'p_both', 'p_safe_z',
            'p_slave',
            'c_corner', 'c_probe_seq', 'c_probe_z', 'c_sync_a', 'c_wcs',
            'c_travel_dist', 'c_safe_z', 'c_feed_fast', 'c_feed_slow',
            'c_dist', 'c_retract', 'c_port', 'c_level', 'c_q',
            'c_slave',
            'm_type', 'm_axis', 'm_dir', 'm_both', 'm_sync_a', 'm_wcs',
            'm_slave',
            'm_dist', 'm_retract', 'm_safe_z', 'm_clearance',
            'm_feed_fast', 'm_feed_slow', 'm_port', 'm_level', 'm_q',
            'e_axis', 'e_dir', 'e_wcs', 'e_dist', 'e_retract',
            'e_feed_fast', 'e_feed_slow', 'e_port', 'e_level', 'e_q'
        ];

        wizInputs.forEach(id => {
            const element = el(id);
            if (element) {
                element.addEventListener('input', () => this.update());
                // Some controls (like checkboxes) are more reliable with 'change' events in certain environments
                element.addEventListener('change', () => this.update());
            }
        });
    }

    open(type) {
        const box = document.querySelector('.wiz-box');
        console.debug('WizardManager.open()', type, 'wizardElement=', this.wizardElement);
        if (!this.wizardElement) {
            console.warn('WizardManager.open(): no wizard container available');
            return;
        }
        
        if (type === 'probe' || type === 'corner' || type === 'middle' || type === 'edge') {
            box.classList.add('large');
        } else {
            box.classList.remove('large');
        }

        // Ensure overlay is visible and mark active
        this.wizardElement.style.display = 'flex';
        this.wizardElement.classList.add('active');
        
        // Hide all wizard panels
        ['wiz_comm', 'wiz_wcs', 'wiz_corner', 'wiz_middle', 'wiz_edge'].forEach(id => {
            const elem = el(id);
            if (elem) elem.style.display = 'none';
        });

        // Show requested wizard
        const wizElem = el('wiz_' + type);
        if (wizElem) {
            wizElem.style.display = 'block';
            // Ensure fields & preview reflect current defaults immediately
            this.update();
        }

    }

    openCorner() {
        this.open('corner');
        setTimeout(() => {
            if (window.drawCornerViz) window.drawCornerViz();
            this.updateCornerWizard();
        }, 50);
    }

    openMiddle() {
        this.open('middle');
        setTimeout(() => {
            if (window.drawMiddleViz) window.drawMiddleViz();
            this.updateMiddleWizard();
        }, 50);
    }

    openEdge() {
        this.open('edge');
        setTimeout(() => {
            if (window.drawProbeViz) window.drawProbeViz();
            this.updateEdgeWizard();
        }, 50);
    }

    close() {
        // Hide overlay and clear active state
        this.wizardElement.classList.remove('active');
        this.wizardElement.style.display = 'none';
    }

    update() {
        // Defensive: some environments may call update() before all wizard panels exist in DOM
        const wizVisible = (id) => {
            const e = el(id);
            return e ? e.style.display !== 'none' : false;
        };

        const wizComm = wizVisible('wiz_comm');
        const wizWcs = wizVisible('wiz_wcs');
        const wizCorner = wizVisible('wiz_corner');
        const wizMiddle = wizVisible('wiz_middle');
        const wizEdge = wizVisible('wiz_edge');

        if (wizComm) {
            this.updateCommunicationWizard();
        } else if (wizWcs) {
            this.updateWCSWizard();
        } else if (wizCorner) {
            this.updateCornerWizard();
        } else if (wizMiddle) {
            this.updateMiddleWizard();
        } else if (wizEdge) {
            this.updateEdgeWizard();
        }
    }

    updateCommunicationWizard() {
        const type = el('c_type').value;
        const params = {
            type: type,
            msg: el('c_msg')?.value || '',
            val: el('c_val')?.value || '',
            popupMode: el('c_popup_mode')?.value || '',
            id: el('c_id')?.value || '',
            dest: el('c_dest')?.value || '',
            slot1: el('c_slot1')?.value || '',
            slot2: el('c_slot2')?.value || '',
            slot3: el('c_slot3')?.value || '',
            slot4: el('c_slot4')?.value || ''
        };

        // Update field visibility
        const visibility = this.communicationWizard.getFieldVisibility(type);
        const modeBlock = el('c_mode_block');
        const valBlock = el('c_val_block');
        const msgBlock = el('c_msg_block');
        const slotsBlock = el('c_slots_block');
        const varBlock = el('c_var_block');

        if (modeBlock) modeBlock.classList.toggle('hidden', !visibility.showMode);
        if (valBlock) valBlock.classList.toggle('hidden', !visibility.showValue);
        if (msgBlock) msgBlock.classList.toggle('hidden', !visibility.showMessage);
        if (slotsBlock) slotsBlock.classList.toggle('hidden', !visibility.showSlots);
        if (varBlock) varBlock.classList.toggle('hidden', !visibility.showVar);

        const gcode = this.communicationWizard.generate(params);
        el('wiz_comm_code').innerHTML = gcode;
    }

    updateWCSWizard() {
        const params = {
            sys: el('w_sys').value,
            axisX: el('w_x')?.checked || false,
            axisY: el('w_y')?.checked || false,
            axisZ: el('w_z')?.checked || false,
            axisA: el('w_a')?.checked || false,
            sync: el('w_sync')?.checked || false,
            slave: el('w_slave')?.value || '3'
        };

        const gcode = this.wcsWizard.generate(params);
        el('wiz_wcs_code').innerHTML = UIUtils.formatGCode(gcode);

        // Update status label with human-friendly WCS name and base address
        const wcsStatus = el('wcsStatus');
        if (wcsStatus) wcsStatus.textContent = `${this.wcsWizard.getWCSName(params.sys)} - Base: ${this.wcsWizard.getWCSBase(params.sys)}`;
    }

    updateCornerWizard() {
        // Debug: log entry and the main controls we care about
        console.debug('updateCornerWizard called', {
            corner: el('c_corner')?.value,
            probeZ: el('c_probe_z')?.checked,
            probeSeq: el('c_probe_seq')?.value
        });

        const params = {
            corner: el('c_corner').value,
            probeZ: el('c_probe_z').checked,
            syncA: el('c_sync_a').checked,
            slave: el('c_slave')?.value || '3',
            probeSeq: el('c_probe_seq').value,
            wcs: el('c_wcs').value,
            dist: el('c_dist').value,
            retract: el('c_retract').value,
            f_fast: el('c_feed_fast').value,
            f_slow: el('c_feed_slow').value,
            port: el('c_port').value,
            level: el('c_level').value,
            qStop: el('c_q').value,
            safeZ: el('c_safe_z').value,
            travelDist: el('c_travel_dist').value
        };

        const gcode = this.cornerWizard.generate(params);
        el('wiz_corner_code').innerHTML = UIUtils.formatGCode(gcode);

        // Debug: indicate whether generated gcode contains Z probe sequence
        const containsZ = /(Step \d+: Z Surface Probe|G31 Z)/.test(gcode);
        console.debug('cornerWizard.generate => containsZProbe=', containsZ);

        // Update corner status label 📌
        const dirMap = { FL: 'X+,Y+', FR: 'X-,Y+', BL: 'X+,Y-', BR: 'X-,Y-' };
        const cornerStatus = el('cornerVizStatus');
        if (cornerStatus) cornerStatus.textContent = `Corner: ${params.corner} (${dirMap[params.corner]}) - ${params.probeSeq}` + (params.probeZ ? ' + Z' : '');

        // Update visualization if function exists (pass probeZ so draw function can hide/show Z elements)
        if (window.drawCornerViz) {
            window.drawCornerViz(params.probeZ);
        }
    }

    updateMiddleWizard() {
        const params = {
            featureType: el('m_type')?.value || 'pocket',
            axis: el('m_axis')?.value || 'X',
            dir1: el('m_dir')?.value || 'pos',
            findBoth: el('m_both')?.checked || false,
            syncA: el('m_sync_a')?.checked || false,
            slave: el('m_slave')?.value || '3',
            wcs: el('m_wcs')?.value || 'G54',
            dist: el('m_dist')?.value || '20',
            retract: el('m_retract')?.value || '2',
            safeZ: el('m_safe_z')?.value || '10',
            clearance: el('m_clearance')?.value || '2',
            f_fast: el('m_feed_fast')?.value || '200',
            f_slow: el('m_feed_slow')?.value || '50',
            port: el('m_port')?.value || '3',
            level: el('m_level')?.value || '0',
            qStop: el('m_q')?.value || '1'
        };

        const gcode = this.middleWizard.generate(params);
        el('wiz_middle_code').innerHTML = UIUtils.formatGCode(gcode);

        // Update middle status label
        const middleStatus = el('middleVizStatus');
        const dirLabel = params.dir1 === 'pos' ? 'pos' : 'neg';
        const bothLabel = params.findBoth ? ' (both)' : '';
        if (middleStatus) middleStatus.textContent = `Middle: ${params.featureType} | ${params.axis} ${dirLabel}${bothLabel}`;

        // Update visualization if function exists
        if (window.drawMiddleViz) {
            window.drawMiddleViz();
        }
    }

    updateEdgeWizard() {
        const params = {
            axis: el('p_axis')?.value || 'X',
            dir: el('p_dir')?.value || 'pos',
            wcs: el('p_wcs')?.value || 'G54',
            dist: el('p_dist')?.value || '15',
            retract: el('p_retract')?.value || '2',
            clearance: el('p_edge_clear')?.value || '2',
            findBoth: el('p_both')?.checked || false,
            syncA: el('p_sync_a')?.checked || false,
            slave: el('p_slave')?.value || '3',
            f_fast: el('p_feed_fast')?.value || '200',
            f_slow: el('p_feed_slow')?.value || '50',
            port: el('p_port')?.value || '3',
            level: el('p_level')?.value || '0',
            qStop: el('p_q')?.value || '1'
        };

        console.debug('updateEdgeWizard', params);
        const gcode = this.edgeWizard.generate(params);
        console.debug('edge generate => containsG31=', /G31/.test(gcode));
        el('wiz_edge_code').innerHTML = UIUtils.formatGCode(gcode);

        // Update edge status label
        const edgeStatus = el('edgeVizStatus');
        if (edgeStatus) edgeStatus.textContent = `Edge: ${params.axis}${params.dir === 'pos' ? '+' : '-'}${params.findBoth ? ' | Find Opposite' : ''}`;

        // Update visualization if function exists
        if (window.drawProbeViz) {
            window.drawProbeViz();
        }
    }

    insert() {
        let code = '';

        // Helper to check if a specific wizard panel is currently visible
        const isVisible = (id) => {
            const element = el(id);
            return element && element.style.display !== 'none';
        };

        // Determine which wizard is active and get its code
        if (isVisible('wiz_comm')) {
            code = el('wiz_comm_code')?.textContent;
        } else if (isVisible('wiz_wcs')) {
            code = el('wiz_wcs_code')?.textContent;
        } else if (isVisible('wiz_corner')) {
            code = el('wiz_corner_code')?.textContent;
        } else if (isVisible('wiz_middle')) {
            code = el('wiz_middle_code')?.textContent;
        } else if (isVisible('wiz_edge')) {
            code = el('wiz_edge_code')?.textContent;
        }

        if (code) {
            this.editorManager.insert(code);
        } else {
            console.warn('WizardManager: No visible wizard or empty code.');
        }
        
        this.close();
    }

    togglePreview() {
        const commPreview = el('comm_preview_block');
        const wcsPreview = el('wcs_preview_block');
        const probePreview = el('probe_preview_block');

        if (commPreview) commPreview.classList.toggle('hidden');
        if (wcsPreview) wcsPreview.classList.toggle('hidden');
        if (probePreview) probePreview.classList.toggle('hidden');
    }
}


// --- app.js ---
/**
 * DDCS Studio - Main Application
 * Version 9.49 - Modular ES6 Edition
 * 
 * CNC G-code Generator for DDCS Expert M350 Controller
 */







class DDCSStudio {
    constructor() {
        this.themeManager = new ThemeManager();
        this.scaleManager = new ScaleManager();
        this.variableDB = new VariableDatabase();
        this.editorManager = new EditorManager();
        this.dockManager = new DockManager(this.variableDB, this.editorManager);
        this.wizardManager = new WizardManager(this.editorManager);

        this.init();
    }

    init() {
        // Setup global window functions for backwards compatibility
        this.setupGlobalFunctions();

        // Setup file upload handler
        this.setupFileUpload();

        // Setup window resize handler
        window.addEventListener('resize', () => {
            if (this.scaleManager.isAutoScale()) {
                this.scaleManager.apply();
            }
        });

        // Apply initial scale
        this.scaleManager.apply();

        // Initialize corner visualization
        this.initializeCornerVisualization();
        this.setupVisualizationListeners();
    }

    setupGlobalFunctions() {
        // Expose key functions to global scope for HTML onclick handlers
        window.toggleStyle = () => this.themeManager.toggle();
        window.toggleScale = () => this.scaleManager.toggle();
        window.copyCode = () => this.editorManager.copyCode();
        window.clearCode = () => this.editorManager.clearCode();
        window.downloadFile = () => this.editorManager.downloadFile();
        window.clearSearch = () => this.dockManager.clear();
        window.insert = (key, text) => this.editorManager.insert(key, text);
        window.backspace = () => this.editorManager.backspace();

        // Wizard functions
        window.openWiz = (type) => this.wizardManager.open(type);
        window.openCornerWiz = () => this.wizardManager.openCorner();
        window.openMiddleWiz = () => this.wizardManager.openMiddle();
        window.openEdgeWiz = () => this.wizardManager.openEdge();
        window.closeWiz = () => this.wizardManager.close();
        window.insertWiz = () => this.wizardManager.insert();
        window.togglePreview = () => this.wizardManager.togglePreview();
        window.updateWiz = () => this.wizardManager.update();

        // Insert in message function for wizards
        window.insertInMsg = (t) => {
            const i = el('c_msg');
            if (i) {
                i.value = i.value.slice(0, i.selectionStart) + t + i.value.slice(i.selectionEnd);
                this.wizardManager.update();
                i.focus();
            }
        };
    }

    setupFileUpload() {
        const csvInput = el('csvInput');
        if (!csvInput) return;

        csvInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                this.variableDB.loadFromCSV(e.target.result);
            };
            reader.readAsText(file);
        });
    }

    initializeCornerVisualization() {
        document.addEventListener('DOMContentLoaded', () => {
            const cornerVizCorner = document.getElementById('cornerVizCorner');
            if (cornerVizCorner) {
                ['cornerFL', 'cornerFR', 'cornerBL', 'cornerBR'].forEach(cornerId => {
                    const corner = cornerVizCorner.querySelector('#' + cornerId);
                    if (corner) {
                        const yxSeq = corner.querySelector('[id^="probeYX"]');
                        const xySeq = corner.querySelector('[id^="probeXY"]');
                        if (yxSeq) yxSeq.style.display = 'none';
                        if (xySeq) xySeq.style.display = 'none';
                    }
                });
            }
        });
    }

    setupVisualizationListeners() {
        // Corner wizard visualization listeners
        ['c_corner', 'c_probe_seq', 'c_probe_z'].forEach(id => {
            const elem = el(id);
            if (elem) {
                elem.addEventListener('change', () => {
                    if (el('wiz_corner').style.display !== 'none') {
                        if (window.drawCornerViz) {
                            window.drawCornerViz();
                        }
                    }
                });
            }
        });

        // Middle wizard visualization listeners
        ['m_type', 'm_axis', 'm_dir', 'm_both'].forEach(id => {
            const elem = el(id);
            if (elem) {
                elem.addEventListener('change', () => {
                    if (el('wiz_middle').style.display !== 'none') {
                        if (window.drawMiddleViz) {
                            window.drawMiddleViz();
                        }
                    }
                });
            }
        });

        // Edge/probe visualization listeners
        ['p_axis', 'p_dir', 'p_mode', 'p_type', 'p_probe_both', 'p_corner', 'p_probe_seq'].forEach(id => {
            const elem = el(id);
            if (elem) {
                elem.addEventListener('change', () => {
                    const mode = el('p_mode')?.value;
                    if (mode === 'edge' || mode === 'center' || mode === 'corner') {
                        if (window.drawProbeViz) {
                            window.drawProbeViz();
                        }
                    }
                });
            }
        });
    }

    openCorner() {
        this.open('corner');
        setTimeout(() => {
            if (window.drawCornerViz) window.drawCornerViz();
            this.updateCornerWizard();
        }, 10);
    }

    openMiddle() {
        this.open('middle');
        setTimeout(() => {
            if (window.drawMiddleViz) window.drawMiddleViz();
            this.updateMiddleWizard();
        }, 10);
    }

    openEdge() {
        this.open('edge');
        setTimeout(() => {
            if (window.drawProbeViz) window.drawProbeViz();
            this.updateEdgeWizard();
        }, 10);
    }
}

// Initialize application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.ddcsStudio = new DDCSStudio();
    });
} else {
    window.ddcsStudio = new DDCSStudio();
}

DDCSStudio;


// --- import_vars.js ---
// import_vars.js (ES module)
// Usage: node import_vars.js --input "Variables-ENG 01-04-2025.csv" --output default_vars.js




const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_INPUT = 'Variables-ENG 01-04-2025.csv';
const DEFAULT_OUTPUT = 'default_vars.js';

function parseCSV(text) {
    const rows = [];
    let field = '';
    let row = [];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];

        if (ch === '"') {
            // Escaped quote (double double-quote) -> append a quote
            if (inQuotes && text[i + 1] === '"') {
                field += '"';
                i++; // skip the escaped quote
            } else {
                inQuotes = !inQuotes; // toggle
            }
        } else if (ch === ',' && !inQuotes) {
            row.push(field);
            field = '';
        } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
            if (ch === '\n') {
                row.push(field);
                rows.push(row);
                field = '';
                row = [];
            }
        } else {
            field += ch;
        }
    }

    if (field !== '' || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    return rows.map(r => r.map(f => {
        if (typeof f !== 'string') return '';
        let s = f.replace(/\r/g, '').replace(/\n/g, ' ').trim();
        if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
        s = s.replace(/""/g, '"');
        return s;
    }));
}

function usage() {
    console.log('Usage: node import_vars.js [--input FILE] [--output FILE]');
}

async function main(argv = process.argv.slice(2)) {
    try {
        let input = DEFAULT_INPUT;
        let output = DEFAULT_OUTPUT;

        for (let i = 0; i < argv.length; i++) {
            const a = argv[i];
            if (a === '-i' || a === '--input') input = argv[++i];
            else if (a === '-o' || a === '--output') output = argv[++i];
            else if (a === '-h' || a === '--help') { usage(); return 0; }
        }

        const absInput = path.resolve(process.cwd(), input);
        const absOutput = path.resolve(process.cwd(), output);

        if (!existsSync(absInput)) {
            console.error(`Input file not found: ${absInput}`);
            return 2;
        }

        const raw = await fs.readFile(absInput, { encoding: 'utf8' });
        const rows = parseCSV(raw);

        // Keep rows where first column starts with a digit
        const cleaned = [];
        for (const r of rows) {
            if (!r || r.length === 0) continue;
            const id = (r[0] || '').trim();
            if (!/^[0-9]/.test(id)) continue;

            const permission = (r[1] || '').trim();
            const description = (r[2] || '').trim();
            const notes = (r[3] || '').trim();

            const safeDescription = description.replace(/`/g, '\\`');
            const safeNotes = notes.replace(/`/g, '\\`');

            // Always output four columns (notes may be empty)
            cleaned.push(`${id},${permission},${safeDescription},${safeNotes}`);
        }

        const now = new Date().toISOString();
        const header = `// Generated by import_vars.js on ${now}\n// Source: ${path.basename(absInput)}\n`;

        const fileContent = `${header}const DEFAULT_VAR_CSV = ` + '`\n' + cleaned.join('\n') + '\n`;' + '\n';

        await fs.writeFile(absOutput, fileContent, { encoding: 'utf8' });

        console.log(`SUCCESS: written ${cleaned.length} entries to ${absOutput}`);
        return 0;
    } catch (err) {
        console.error('FAILED:', err && err.message ? err.message : err);
        return 1;
    }
}

// Run when executed directly
if (process.argv && process.argv.length > 1) {
    // If running as a script, execute main
    main().then(code => { if (code && code !== 0) process.exit(code); });
}


// --- default_vars.js ---
// Generated by import_vars.js on 2026-02-03T13:12:38.470Z
// Source: Variables-ENG 01-04-2025.csv
const DEFAULT_VAR_CSV = `
0,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
1,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
2,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
3,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
4,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
5,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
6,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
7,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
8,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
9,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
22,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
23,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
24,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
25,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
26,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
27,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
28,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
29,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
30,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
31,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
32,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
33,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
34,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
35,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
36,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
37,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
38,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
39,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
40,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
41,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
42,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
43,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
44,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
45,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
46,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
47,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
48,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
49,S,User variables independent for slib and user UE,This range is not suitable for storing axis coordinates, from variables #790-#844. If you store axis coordinates in this range of variable numbers, the values will be lost. Only this range is suitable for the seamless movement of the axes, with G0, G1, G2, G3 commands.
10,S,User variables independent for slib and user UE,
11,S,User variables independent for slib and user UE,
12,S,User variables independent for slib and user UE,
13,S,User variables independent for slib and user UE,
14,S,User variables independent for slib and user UE,
15,S,User variables independent for slib and user UE,
16,S,User variables independent for slib and user UE,
17,S,User variables independent for slib and user UE,
18,S,User variables independent for slib and user UE,
19,S,User variables independent for slib and user UE,
20,S,User variables independent for slib and user UE,
21,S,User variables independent for slib and user UE,
50,S,Used in G28 and G29 commands,
51,S,Used in G28 and G29 commands,
52,S,Used in G28 and G29 commands,
53,S,Used in G28 and G29 commands,
54,S,Used in G28 and G29 commands,
55,S,Used in G28 and G29 commands,
56,S,,
57,S,,
58,S,,
59,S,,
76,S,,
77,S,,
78,S,,
79,S,,
80,S,,
81,S,,
82,S,,
83,S,,
84,S,,
85,S,,
86,S,,
87,S,,
88,S,,
89,S,,
90,S,,
91,S,,
92,S,,
93,S,,
94,S,,
95,S,,
96,S,,
97,S,,
98,S,,
99,S,,
100,S,,
102,S,,
103,S,,
104,S,,
105,S,,
106,S,,
107,S,,
108,S,,
109,S,,
110,S,,
111,S,,
112,S,,
113,S,,
114,S,,
115,S,,
116,S,,
117,S,,
118,S,,
119,S,,
120,S,,
121,S,,
122,S,,
123,S,,
124,S,,
125,S,,
126,S,,
127,S,,
128,S,,
129,S,,
130,S,,
131,S,,
132,S,,
133,S,,
134,S,,
135,S,,
136,S,,
137,S,,
138,S,,
139,S,,
140,S,,
141,S,,
142,S,,
143,S,,
144,S,,
145,S,,
146,S,,
147,S,,
148,S,,
149,S,,
150,S,,
151,S,,
152,S,,
153,S,,
154,S,,
155,S,,
156,S,,
157,S,,
158,S,,
159,S,,
160,S,,
161,S,,
162,S,,
163,S,,
164,S,,
165,S,,
166,S,,
167,S,,
168,S,,
169,S,,
170,S,,
171,S,,
172,S,,
173,S,,
174,S,,
175,S,,
176,S,,
177,S,,
178,S,,
179,S,,
180,S,,
181,S,,
182,S,,
183,S,,
184,S,,
185,S,,
186,S,,
187,S,,
188,S,,
189,S,,
190,S,,
191,S,,
192,S,,
193,S,,
194,S,,
195,S,,
196,S,,
197,S,,
198,S,,
199,S,,
200,S,,
201,S,,
202,S,,
203,S,,
204,S,,
205,S,,
206,S,,
207,S,,
208,S,,
209,S,,
210,S,,
211,S,,
212,S,,
213,S,,
214,S,,
215,S,,
216,S,,
217,S,,
218,S,,
219,S,,
220,S,,
221,S,,
222,S,,
223,S,,
224,S,,
225,S,,
226,S,,
227,S,,
228,S,,
229,S,,
230,S,,
231,S,,
232,S,,
233,S,,
234,S,,
235,S,,
236,S,,
237,S,,
238,S,,
239,S,,
240,S,,
241,S,,
242,S,,
243,S,,
244,S,,
245,S,,
246,S,,
247,S,,
248,S,,
249,S,,
250,S,,
251,S,,
252,S,,
253,S,,
254,S,,
255,S,,
256,S,,
257,S,,
258,S,,
259,S,,
260,S,,
261,S,,
262,S,,
263,S,,
264,S,,
265,S,,
266,S,,
267,S,,
268,S,,
269,S,,
270,S,,
271,S,,
272,S,,
273,S,,
274,S,,
275,S,,
276,S,,
277,S,,
278,S,,
279,S,,
280,S,,
281,S,,
282,S,,
283,S,,
284,S,,
285,S,,
286,S,,
287,S,,
288,S,,
289,S,,
290,S,,
291,S,,
292,S,,
293,S,,
294,S,,
295,S,,
296,S,,
297,S,,
298,S,,
299,S,,
300,S,,
301,S,,
302,S,,
303,S,,
304,S,,
305,S,,
306,S,,
307,S,,
308,S,,
309,S,,
310,S,,
311,S,,
312,S,,
313,S,,
314,S,,
315,S,,
316,S,,
317,S,,
318,S,,
319,S,,
320,S,,
321,S,,
322,S,,
323,S,,
324,S,,
325,S,,
326,S,,
327,S,,
328,S,,
329,S,,
330,S,,
331,S,,
332,S,,
333,S,,
334,S,,
335,S,,
336,S,,
337,S,,
338,S,,
339,S,,
340,S,,
341,S,,
342,S,,
343,S,,
344,S,,
345,S,,
346,S,,
347,S,,
348,S,,
349,S,,
350,S,,
351,S,,
352,S,,
353,S,,
354,S,,
355,S,,
356,S,,
357,S,,
358,S,,
359,S,,
360,S,,
361,S,,
362,S,,
363,S,,
364,S,,
365,S,,
366,S,,
367,S,,
368,S,,
369,S,,
370,S,,
371,S,,
372,S,,
373,S,,
374,S,,
375,S,,
376,S,,
377,S,,
378,S,,
379,S,,
380,S,,
381,S,,
382,S,,
383,S,,
384,S,,
385,S,,
386,S,,
387,S,,
388,S,,
389,S,,
390,S,,
391,S,,
392,S,,
393,S,,
394,S,,
395,S,,
396,S,,
397,S,,
398,S,,
399,S,,
400,S,,
401,S,,
402,S,,
403,S,,
404,S,,
405,S,,
406,S,,
407,S,,
408,S,,
409,S,,
410,S,,
411,S,,
412,S,,
413,S,,
414,S,,
415,S,,
416,S,,
417,S,,
418,S,,
419,S,,
420,S,,
421,S,,
422,S,,
423,S,,
424,S,,
425,S,,
426,S,,
427,S,,
428,S,,
429,S,,
430,S,,
431,S,,
432,S,,
433,S,,
434,S,,
435,S,,
436,S,,
437,S,,
438,S,,
439,S,,
440,S,,
441,S,,
442,S,,
443,S,,
444,S,,
445,S,,
446,S,,
447,S,,
448,S,,
449,S,,
450,S,,
451,S,,
452,S,,
453,S,,
454,S,,
455,S,,
456,S,,
457,S,,
458,S,,
459,S,,
460,S,,
461,S,,
462,S,,
463,S,,
464,S,,
465,S,,
466,S,,
467,S,,
468,S,,
469,S,,
470,S,,
471,S,,
472,S,,
473,S,,
474,S,,
475,S,,
476,S,,
477,S,,
478,S,,
479,S,,
480,S,,
481,S,,
482,S,,
483,S,,
484,S,,
485,S,,
486,S,,
487,S,,
488,S,,
489,S,,
490,S,,
491,S,,
492,S,,
493,S,,
494,S,,
495,S,,
496,S,,
497,S,,
498,S,,
499,S,,
60,S,,
61,S,,
62,S,,
63,S,,
64,S,,
65,S,,
66,S,,
67,S,,
68,S,,
69,S,,
70,S,,
71,S,,
72,S,,
73,S,,
74,S,,
75,S,,
101,S,Used in subroutine O503 (dual y-axis) from slib-g as port number,Subroutine O503 is obsolete
500,B,Motor start speed mm/min,
501,B,X-axis pulses per mm p/mm,
502,B,Y-axis pulses per mm p/mm,
503,B,Z-axis pulses per mm p/mm,
504,S,??pulses per unit,
505,S,??pulses per unit,
506,B,4th axis pulses per mm,
507,B,4th-axis unit 0：pulse/degree , 1：pulse/revolution,If the axis is not used as a servo spindle, 507=1 cannot be set. Otherwise, the 4th axis will not work correctly during manual movements!
508,B,pulse equivalent of the 5th Axis,
509,B,5th-axis unit 0：pulse/degree , 1：pulse/revolution,If the axis is not used as a servo spindle, 509=1 cannot be set. Otherwise, the 5th axis will not work correctly during manual movements!
510,B,,
511,B,Time interval between DIR & PUL Unit: ns,
512,B,X-axis direction electric level 0: Low 1: High,
513,B,Y-axis direction electric level 0: Low 1: High,
514,B,Z-axis direction electric level 0: Low 1: High,
515,B,4th-axis direction electric level 0: Low 1: High,
516,B,5th-axis direction electric level 0: Low 1: High,
517,B,X-axis Pulse signal Electric Level 0: Low 1: High,
518,B,Y-axis Pulse signal Electric Level 0: Low 1: High,
519,B,Z-axis Pulse signal Electric Level 0: Low 1: High,
520,B,4th-axis Pulse signal Electric Level 0: Low 1: High,
521,B,5th-axis Pulse signal Electric Level 0: Low 1: High,
522,B,Enable axis mapping function,Note: When this function is enabled, the two axies are linked only/during machining.
523,B,Primary axis selection,
524,B,Mapping axis selection,
525,B,,
526,B,,
527,B,,
528,B,,
529,B,,
530,S,machine type,
531,S,RTCP Resolution,
532,B,,
533,B,,
534,B,,
535,B,X-axis max. speed in manual control,
536,B,Y axis max. speed in manual control,
537,B,Z axis max. speed in manual control,
538,B,4th axis max. speed in manual control,
539,B,5th axis max. speed in manual control,
540,B,HIGH speed of X-axis in manual control,
541,B,HIGH speed of Y-axis in manual control,
542,B,HIGH speed of Z-axis in manual control,
543,B,HIGH speed of 4th axis in manual control,
544,B,HIGH speed of 5th-axis in manual control,
545,B,LOW speed of X-axis in manual control,
546,B,LOW speed of Y-axis in manual control,
547,B,LOW speed of Z-axis in manual control,
548,B,LOW speed of 4th axis in manual control,
549,B,LOW speed of 5th axis in manual control,
550,B,X-axis start acceleration in manual control,
551,B,Y-axis start acceleration in manual control,
552,B,Z-axis start acceleration in manual control,
553,B,4th-axis start acceleration in manual control,
554,B,5th-axis start acceleration in manual control,
555,B,X-axis Stop acceleration in manual control,
556,B,Y-axis Stop acceleration in manual control,
557,B,Z-axis Stop acceleration in manual control,
558,B,4th axis Stop acceleration in manual control,
559,B,5th axis Stop acceleration in manual control,
560,B,Speed Selection: 0: G Code / 1: Default,
561,B,default operation speed, Unit: mm/min,
562,B,linear feed moves (G01) acceleration speed, Unit: mm/min,
563,B,Move as quickly as possible to a given point (G0) Speed, Unit: mm/min,
564,B,Maximum Machining speed, Unit: mm/min,
565,B,Z-axis lifting protection speed, Unit: mm/min,
566,B,Z-axis dropping protection speed, Unit: mm/min,
567,B,X-axis protection speed, Unit: mm/min,
568,B,Y-axis protection speed, Unit: mm/min,
569,B,Z axis safe height, Unit: mm,
570,B,Z-axis retraction distance when paused, Unit: mm,Z lift distance on pause
571,S,Enabling motion scheduling of the G0 segment,G0段运动规划使能
572,S,G0 command motion characteristics, 0: Interpolation; 1:Independent,Interpolation:synergistic movement of each axis./Independent:each axis independently moves at G0 speed.
573,B,Arc-interpolation algorithm 0: Hard algorithm 1: Soft algorithm,
574,B,Soft-arc algorithm linear precision Unit: mm,
575,B,Circular centrifugal acceleration,
576,B,Macro scan switch 0: Close 1: Open,Changing this setting should work without reboot
577,B,macro program file main program no.,
578,B,Displays the number of the current working SC. 1-G54; 6-G59; 0-G92. Toggles them if the controller is restarted after the change.,
579,B,Spindle interface type: 0: Analog 1: Plu&Dir 2: Multi-Speed,
580,B,Servo Spindle mapping axis: X / Y / Z / 4th / 5th Axis,
581,B,Spindle start delay Unit: S,
582,B,Maximum spindle speed,
583,B,Ignore the S command 0:No 1:Yes,
584,B,Stop spindle when program is paused 0:No 1:Yes,Whether to pause the spindle
585,B,Default spindle speed Unit: rpm,
586,S,Spindle PWM electric level,
587,S,PWM rising rate from 0V to 10V,
588,B,Multi-speed section counts 2-8,
589,B,Spindle stop delay,
590,B,Action selection before starting 0: No Action 1: To Safety Z,
591,B,Z-axis movement mode during pause 0: No action 1：ZZ lift distance (#70),Whether to raise Z on pause.
592,B,Delay of M8/M9 commands Unit: S,
593,B,,
594,B,Delay of M10/M11 commands Unit: S,
595,B,IO input filter time width Unit: ms,
596,B,Reset IO Configuration bit 01-16,Changes the state of the outputs after a reboot
597,B,Reset IO Configuration bit 17-21,Changes the state of the outputs after a reboot
598,B,Alarm output status configuration bit 01-16,
599,B,Alarm output status configuration bit 17-21,
600,B,Home mode 0: switch 1: Absolute,The function of determining the absolute position of the axes during loading (according to the encoder), instead of homing. If you set it to 1, it will try to determine the coordinates from the encoder after loading (of course, unsuccessfully).
601,B,Servo absolute laps at the X-axis Home,The absolute position of the encoder in the X-axis, at the home position of the X-axis. Used in the M110 command (subroutine O10110 in slib-m)
602,B,Servo absolute laps at the Y-axis Home,Absolute position of the encoder in the Y-axis, with the home position of the Y-axis. Used in the M111 command (subroutine O10111 in slib-m)
603,B,Servo absolute laps at the Z-axis Home,The absolute position of the encoder in the Z axis, with the home position of the Z axis. Used in the M112 command (subroutine O10112 in slib-m)
604,B,Servo absolute laps at the 4th-axis Home,Absolute position of the encoder in the A-axis, with the home position of the A-axis. Used in the M113 command (subroutine O10113 in slib-m)
605,B,Servo absolute laps at the 5th-axis Home,Absolute encoder position on the B-axis, when the B-axis is in the home position. Used in the M114 command (subroutine O10114 in slib-m)
606,B,Home detection times 1-5,Number of visits to the homing sensor. You can not put 6. A glitch is possible. There will be a variable conflict.
607,B,X-axis homing speed Unit: mm/min,
608,B,Y-axis homing speed Unit: mm/min,
609,B,Z-axis homing speed Unit: mm/min,
610,B,4th-axis homing speed Unit: mm/min,
611,B,5th-axis homing speed Unit: mm/min,
612,B,X-axis homing direction 0: Negative 1: Positive,
613,B,Y-axis homing direction 0: Negative 1: Positive,
614,B,Z-axis homing direction 0: Negative 1: Positive,
615,B,4th-axis homing direction 0: Negative 1: Positive,
616,B,5th-axis homing direction 0: Negative 1: Positive,
617,B,Maximum error of home switch,
618,B,Second precision positioning speed,
619,B,,
620,B,,
621,B,,
622,B,Mach position after X go home,
623,B,Mach position after Y go home,
624,B,Mach position after Z go home,
625,B,Mach position after 4th go home,
626,B,Mach position after 5th go home,
627,B,Home after booting 0：Yes 1: No,
628,B,Is the Floating tool set valid?,
629,B,Floating tool set thickness,
630,B,Is the fixed tool set valid?,
631,B,Probe detection times 1-5,Probing cycle count
632,B,Initial speed of Probing Unit: mm/min,
633,R/O,Probe Tool block thickness,Useful floating tool
634,B,Setting the tool to its original position,对刀初始位置
635,B,Fixed probe X mach pos Unit: mm,
636,B,Fixed probe Y mach pos Unit: mm,
637,B,Fixed probe Z mach pos Unit: mm,
638,B,Fixed probe 4th mach pos Unit: mm,
639,B,Fixed probe 5th mach pos Unit: mm,
640,B,Retraction distance after probe action is finished Unit: mm,Retraction distance after the end of probe
641,B,,
642,B,,
643,B,,
644,B,,
645,B,,
646,B,,
647,B,,
648,B,,
649,B,,
650,B,Stop mode when X-axis hard limit trigger 0：Deceleration 1：Emergency,
651,B,Stop mode when Y-axis hard limit trigger 0：Deceleration 1：Emergency,
652,B,Stop mode when Z-axis hard limit trigger 0：Deceleration 1：Emergency,
653,B,Stop mode when 4th-axis hard limit trigger 0：Deceleration 1：Emergency,
654,B,Stop mode when 5th-axis hard limit trigger 0：Deceleration 1：Emergency,
655,B,Enable software limits 0: No 1: Yes,
656,B,Stop mode when X-axis soft limit trigger 0：Deceleration 1：Emergency,
657,B,Stop mode when Y-axis soft limit trigger 0：Deceleration 1：Emergency,
658,B,Stop mode when Z-axis soft limit trigger 0：Deceleration 1：Emergency,
659,B,Stop mode when 4th-axis soft limit trigger 0：Deceleration 1：Emergency,
660,B,Stop mode when 5th-axis soft limit trigger 0：Deceleration 1：Emergency,
661,B,X Soft limit of Negative position,
662,B,Y Soft limit of negative position,
663,B,Z Soft limit of Negative position,
664,B,4th Soft limit of Negative position,
665,B,5th Soft limit of Negative position,
666,B,X Soft limit of positive position,
667,B,Y Soft limit of positive position,
668,B,Z Soft limit of positive position,
669,B,4th Soft limit of Positive position,
670,B,5th Soft limit of Positive position,
671,B,MPG precision Mode control mode: 0:Active 1:Disable,
672,B,MPG X1 distance 0.001-0.01,
673,B,MPG Estop signal enable 0：Disable 1：Enable,
674,B,MPG Estop signal Level define 0：Low 1：High,
675,B,MPG working direction 0:Positive 1：Negative,
676,B,MPG X1 Working speed,
677,B,MPG X10 Working speed,
678,B,MPG X100 Working speed,
679,B,Magnification adjustment increment value when Handwheel guide stopped,
680,B,MPG Acceleration/deceleration rate adjustment increment value,
681,B,MPG Movement acceleration of X axis,
682,B,MPG Movement acceleration of Y axis,
683,B,MPG Movement acceleration of Z axis,
684,B,MPG Movement acceleration of 4th axis,
685,B,MPG Movement acceleration of 5th axis,
686,B,,
687,B,,
688,B,,
689,B,,
690,B,X axis Backlash 0：Disable 1:Enable,
691,B,Y axis Backlash 0：Disable 1:Enable,
692,B,axis Backlash 0：Disable 1:Enable,
693,B,4th axis Backlash 0：Disable 1:Enable,
694,B,5th axis Backlash 0：Disable 1:Enable,
695,B,X axis ballscrew Backlash unit: mm,
696,B,Y axis ballscrew Backlash unit: mm,
697,B,Z axis ballscrew Backlash unit: mm,
698,B,4th axis ballscrew Backlash unit: mm,
699,B,5th axis ballscrew Backlash unit: mm,
700,B,Backlash compensation speed 单位:mm/min,
701,B,Total number of processed pieces,The total number of completed programs. Upgrades with the completion of M30. Doesn't reset on reboot.
702,S,The number of processed pieces (Current number of processed pieces),Number of completed programs in the current session. Upgrades with the completion of M30. Cleared on reboot.
703,B,Number of cyclic processing pieces (Planned number of processed pieces),Number of repetitions for command M47
704,B,,
705,B,,
706,B,,
707,B,,
708,B,,
709,B,,
710,B,K1 key function definition,If you set #710=2536, this will hang the controller when K1 is pressed. The button presses itself endlessly.
711,B,K2 key function definition,If you set #711=2537, this will hang the controller when K2 is pressed. The button presses itself endlessly.
712,B,K3 key function definition,If you set #712=2538, this will hang the controller when K3 is pressed. The button presses itself endlessly.
713,B,K4 key function definition,If you set #713=2539, this will hang the controller when K4 is pressed. The button presses itself endlessly.
714,B,K5 key function definition,If you set #714=2540, this will hang the controller when K5 is pressed. The button presses itself endlessly.
715,B,K6 key function definition,If you set #715=2541, this will hang the controller when K6 is pressed. The button presses itself endlessly.
716,B,K7 key function definition,If you set #716=2541, this will hang the controller when K7 is pressed. The button presses itself endlessly.
717,B,K8 key function definition,If you set #717=2542, this will hang the controller when K8 is pressed. The button presses itself endlessly.
718,B,K9 key function definition,If you set #718=2543, this will hang the controller when K9 is pressed. The button presses itself endlessly.
719,B,K10 key function definition,If you set #719=2544, this will hang the controller when K10 is pressed. The button presses itself endlessly.
720,B,Go Home Before Processing? 0：No 1：Yes,
721,B,References speed when working on radius 5mm Arc,
722,B,The 4th Axis processing protection speed,
723,B,The 5th Axis processing protection speed,
724,B,Set the Drilling cycle Retraction amount,
725,S,Feed rate change range,Magnification increment when handwheel exit and manual override adjustment.
726,S,Magnification decrease in pause,Suspension rate change when decelerating to stop.
727,S,Processing magnification change interval,Cooperate with parameter 225.
728,S,Magnification change when resetting alarm,
729,S,Reset alarm rate change interval,
730,B,After processing finished, the machine: 0：Don't move 1：Back to References Point 2：Back to Zero,
731,B,K11 key function definition,If #731=2545 is set, this will hang the controller when K11 is pressed. The button presses itself endlessly.
732,B,K12 key function definition,If you set #732=2546, this will hang the controller when K12 is pressed. The button presses itself endlessly.
733,B,K13 key function definition,If you set #733=2547, this will hang the controller when K13 is pressed. The button presses itself endlessly.
734,B,K14 key function definition,If you set #734=2548, this will hang the controller when K14 is pressed. The button presses itself endlessly.
735,B,Home offset of X axis,
736,B,Home offset of Y axis,
737,B,Home offset of Z axis,
738,B,Home offset of 4th axis,
739,B,Home offset of 5th axis,
740,B,Language Setting 0:English 1:Chinese 2:Russian,
741,B,Buzzer enable 0:Forbit 1:Enable,
742,S,Main interface display scheme,主界面显示方案
743,B,,
744,B,Toolpath Realtime Display 0 :Forbit 1:Enable,
745,B,Toolpath display mode 0:Status 1:Line 2: 3D,
746,S,Max. polyline segments,
747,B,Interpolation period Second 0.001-0.01,
748,B,User self-design LOGO Display time,
749,S,parameter gradient,J参数梯度
750,S,Maximum machining contour error,
751,B,K15 key function definition,If you set #751=2549, this will hang the controller when K15 is pressed. The button presses itself endlessly.
752,B,K16 key function definition,If you set #752=2550, this will hang the controller when K16 is pressed. The button presses itself endlessly.
753,B,,
754,S,Toolpath width (Area width (X)),Set individually, for each program file name (NC)
755,S,Toolpath Length (Height of area (Y)),Set individually, for each program file name (NC)
756,S,Toolpath thickness (Region depth (Z)),Set individually, for each program file name (NC)
757,S,The toolpath plane thickness in Statue mode,Set individually, for each program file name (NC)
758,S,The X Origin point on plane,Set individually, for each program file name (NC)
759,S,The Y Origin point on plane,Set individually, for each program file name (NC)
760,S,The Z Origin point on plane,Set individually, for each program file name (NC)
761,S,X-axis rotation angle in 3D toolpath mode,
762,S,Y-axis rotation angle in 3D toolpath mode,
763,S,Z-axis rotation angle in 3D toolpath mode,
764,B,Alarm Enable output configuration 01-16,
765,B,Alarm Enable output configuration 17-32,
766,B,Serial 1 baud rate,
767,B,Serial 2 baud rate,
768,B,External keyboard type,
769,B,Debug printing enable,Enables feature #1503 - Prompt information
770,S,user permission key,This number is just a reminder of the superuser password. Changing it does not change the password.
771,B,maximum contour,
772,B,extern key 1 Function,
773,B,extern key 2 Function,
774,B,external key 3 Function,
775,B,extern key 4 Function,
776,B,extern key 5 Function,
777,B,extern key 6 Function,
778,B,USB keyboard type 0：Close 1：Standard keyboard 2：USB Scanner,
779,B,Modbus RTU (The Barcode processing file storage),
780,B,Line corner acceleration,
781,B,J parameter of S-type acceleration curve,
782,B,G00 Acceleration,
783,B,Barcode scanning processing enable,
784,B,network boot mode,
785,B,X-axis max. Acceleration G00,
786,B,Y axis max. Acceleration G00,
787,B,Z axis max. Acceleration G00,
788,B,4th axis max. Acceleration G00,
789,B,5th axis max. Acceleration G00,
790,R/O,axis realtime workpiece coordinate position,The current position of the axis, in the current working coordinate system
791,R/O,Y axis realtime workpiece coordinate position,The current position of the axis, in the current working coordinate system
792,R/O,Z axis realtime workpiece coordinate position,The current position of the axis, in the current working coordinate system
793,R/O,4th axis realtime workpiece coordinate position,The current position of the axis, in the current working coordinate system
794,R/O,5th axis realtime workpiece coordinate position,The current position of the axis, in the current working coordinate system
795,B,,
796,B,,
797,B,,
798,B,,
799,B,,
800,B,G92 Coordinates Home Offset X,Offset, relative to machine coordinate, for G92
801,B,G92 Coordinates Home Offset Y,Offset, relative to machine coordinate, for G92
802,B,G92 Coordinates Home Offset Z,Offset, relative to machine coordinate, for G92
803,B,G92 Coordinates Home Offset A,Offset, relative to machine coordinate, for G92
804,B,G92 Coordinates Home Offset B,Offset, relative to machine coordinate, for G92
805,B,G54 Coordinates Home Offset X,Offset, relative to machine coordinate, for G54
806,B,G54 Coordinates Home Offset Y,Offset, relative to machine coordinate, for G54
807,B,G54 Coordinates Home Offset Z,Offset, relative to machine coordinate, for G54
808,B,G54 Coordinates Home Offset A,Offset, relative to machine coordinate, for G54
809,B,G54 Coordinates Home Offset B,Offset, relative to machine coordinate, for G54
810,B,G55 Coordinates Home Offset X,Offset, relative to machine coordinate, for G55
811,B,G55 Coordinates Home Offset Y,Offset, relative to machine coordinate, for G55
812,B,G55 Coordinates Home Offset Z,Offset, relative to machine coordinate, for G55
813,B,G55 Coordinates Home Offset A,Offset, relative to machine coordinate, for G55
814,B,G55 Coordinates Home Offset B,Offset, relative to machine coordinate, for G55
815,B,G56 Coordinates Home Offset X,Offset, relative to machine coordinate, for G56
816,B,G56 Coordinates Home Offset Y,Offset, relative to machine coordinate, for G56
817,B,G56 Coordinates Home Offset Z,Offset, relative to machine coordinate, for G56
818,B,G56 Coordinates Home Offset A,Offset, relative to machine coordinate, for G56
819,B,G56 Coordinates Home Offset B,Offset, relative to machine coordinate, for G56
820,B,G57 Coordinates Home Offset X,Offset, relative to machine coordinate, for G57
821,B,G57 Coordinates Home Offset Y,Offset, relative to machine coordinate, for G57
822,B,G57 Coordinates Home Offset Z,Offset, relative to machine coordinate, for G57
823,B,G57 Coordinates Home Offset A,Offset, relative to machine coordinate, for G57
824,B,G57 Coordinates Home Offset B,Offset, relative to machine coordinate, for G57
825,B,G58 Coordinates Home Offset X,Offset, relative to machine coordinate, for G58
826,B,G58 Coordinates Home Offset Y,Offset, relative to machine coordinate, for G58
827,B,G58 Coordinates Home Offset Z,Offset, relative to machine coordinate, for G58
828,B,G58 Coordinates Home Offset A,Offset, relative to machine coordinate, for G58
829,B,G58 Coordinates Home Offset B,Offset, relative to machine coordinate, for G58
830,B,G59 Coordinates Home Offset X,Offset, relative to machine coordinate, for G59
831,B,G59 Coordinates Home Offset Y,Offset, relative to machine coordinate, for G59
832,B,G59 Coordinates Home Offset Z,Offset, relative to machine coordinate, for G59
833,B,G59 Coordinates Home Offset A,Offset, relative to machine coordinate, for G59
834,B,G59 Coordinates Home Offset B,Offset, relative to machine coordinate, for G59
835,S,G52 Temporary Coordinates offset X,Sets the temporary displacement of the axes in all working CS. Added to the main offset of the SK. NOT displayed in the "Coord set" menu. NOT saved after reboot. It can only be changed if after #835=0 there is a command to move the axes. Or via MDI. Perhaps other commands will do.
836,S,G52 Temporary Coordinates offset Y,Sets the temporary displacement of the axes in all working CS. Added to the main offset of the SK. NOT displayed in the "Coord set" menu. NOT saved after reboot. It can only be changed if after #835=0 there is a command to move the axes. Or via MDI. Perhaps other commands will do.
837,S,G52 Temporary coordinates offset Z,Sets the temporary displacement of the axes in all working CS. Added to the main offset of the SK. NOT displayed in the "Coord set" menu. NOT saved after reboot. It can only be changed if after #835=0 there is a command to move the axes. Or via MDI. Perhaps other commands will do.
838,S,G52 Temporary Coordinates offset A,Sets the temporary displacement of the axes in all working CS. Added to the main offset of the SK. NOT displayed in the "Coord set" menu. NOT saved after reboot. It can only be changed if after #835=0 there is a command to move the axes. Or via MDI. Perhaps other commands will do.
839,S,G52 Temporary Coordinates offset B,Sets the temporary displacement of the axes in all working CS. Added to the main offset of the SK. NOT displayed in the "Coord set" menu. NOT saved after reboot. It can only be changed if after #835=0 there is a command to move the axes. Or via MDI. Perhaps other commands will do.
840,B,X-axis Coordinate offset,Sets a constant offset of the axes in all working CS. Added to the main offset of the SK. Displayed in the "Coord set" menu. Retained after reboot. Can only be changed if after #840=0 there is a command to move the axes. Or via MDI. Perhaps other commands will do.
841,B,Y-axis Coordinates offset,Sets a constant offset of the axes in all working CS. Added to the main offset of the SK. Displayed in the "Coord set" menu. Retained after reboot. Can only be changed if after #840=0 there is a command to move the axes. Or via MDI. Perhaps other commands will do.
842,B,Z axis coordinates offset,Sets a constant offset of the axes in all working CS. Added to the main offset of the SK. Displayed in the "Coord set" menu. Retained after reboot. Can only be changed if after #840=0 there is a command to move the axes. Or via MDI. Perhaps other commands will do.
843,B,4th axis coordinates offset,Sets a constant offset of the axes in all working CS. Added to the main offset of the SK. Displayed in the "Coord set" menu. Retained after reboot. Can only be changed if after #840=0 there is a command to move the axes. Or via MDI. Perhaps other commands will do.
844,B,5th axis Coordinates offset,Sets a constant offset of the axes in all working CS. Added to the main offset of the SK. Displayed in the "Coord set" menu. Retained after reboot. Can only be changed if after #840=0 there is a command to move the axes. Or via MDI. Perhaps other commands will do.
845,B,,
846,B,,
847,B,,
848,B,,
849,B,,
850,R/O,G54 Coordinates X Absolute position,Current axis position in G54
851,R/O,G54 Coordinates Y Absolute position,Current axis position in G54
852,R/O,G54 Coordinates Z Absolute position,Current axis position in G54
853,R/O,G54 Coordinates A Absolute position,Current axis position in G54
854,R/O,G54 Coordinates B Absolute position,Current axis position in G54
855,R/O,G55 Coordinates X Absolute position,Current axis position in G55
856,R/O,G55 Coordinates Y Absolute position,Current axis position in G55
857,R/O,G55 Coordinates Z Absolute position,Current axis position in G55
858,R/O,G55 Coordinates A Absolute position,Current axis position in G55
859,R/O,G55 Coordinates B Absolute position,Current axis position in G55
860,R/O,G56 Coordinates X Absolute position,Current axis position in G56
861,R/O,G56 Coordinates Y Absolute position,Current axis position in G56
862,R/O,G56 Coordinates Z Absolute position,Current axis position in G56
863,R/O,G56 Coordinates A Absolute position,Current axis position in G56
864,R/O,G56 Coordinates B Absolute position,Current axis position in G56
865,R/O,G57 Coordinates X Absolute position,Current axis position in G57
866,R/O,G57 Coordinates Y Absolute position,Current axis position in G57
867,R/O,G57 Coordinates Z Absolute position,Current axis position in G57
868,R/O,G57 Coordinates A Absolute position,Current axis position in G57
869,R/O,G57 Coordinates B Absolute position,Current axis position in G57
870,R/O,G58 Coordinates X Absolute position,Current axis position in G58
871,R/O,G58 Coordinates Y Absolute position,Current axis position in G58
872,R/O,G58 Coordinates Z Absolute position,Current axis position in G58
873,R/O,G58 Coordinates A Absolute position,Current axis position in G58
874,R/O,G58 Coordinates B Absolute position,Current axis position in G58
875,R/O,G59 Coordinates X Absolute position,Current axis position in G59
876,R/O,G59 Coordinates Y Absolute position,Current axis position in G59
877,R/O,G59 Coordinates Z Absolute position,Current axis position in G59
878,R/O,G59 Coordinates A Absolute position,Current axis position in G59
879,R/O,G59 Coordinates B Absolute position,Current axis position in G59
880,R/O,MACH Coordinates X Absolute position,The current position of the axis in the machine CS. It can be edited (then the axis is "hoarse").
881,R/O,MACH Coordinates Y Absolute position,The current position of the axis in the machine CS. It can be edited (then the axis is "hoarse").
882,R/O,MACH Coordinates Z Absolute position,The current position of the axis in the machine CS. It can be edited (then the axis is "hoarse").
883,R/O,MACH Coordinates A Absolute position,The current position of the axis in the machine CS. It can be edited (then the axis is "hoarse").
884,R/O,MACH Coordinates B Absolute position,The current position of the axis in the machine CS. It can be edited (then the axis is "hoarse").
885,R/O,G92 Coordinates X Absolute position,Current axis position in G92
886,R/O,G92 Coordinates Y Absolute position,Current axis position in G92
887,R/O,G92 Coordinates Z Absolute position,Current axis position in G92
888,R/O,G92 Coordinates A Absolute position,Current axis position in G92
889,R/O,G92 Coordinates B Absolute position,Current axis position in G92
890,B,,
891,B,,
892,B,,
893,B,,
894,B,,
895,B,,
896,B,,
897,B,,
898,B,,
899,B,,
900,B,H01 offset mm,
901,B,H02 offset mm,
902,B,H03 offset mm,
903,B,H04 offset mm,
904,B,H05 offset mm,
905,B,H06 offset mm,
906,B,H07 offset mm,
907,B,H08 offset mm,
908,B,H09 offset mm,
909,B,H10 offset mm,
910,B,H11 offset mm,
911,B,H12 offset mm,
912,B,H13 offset mm,
913,B,H14 offset mm,
914,B,H15 offset mm,
915,B,H16 offset mm,
916,B,Possibly H17 offset mm,
917,B,Possibly H18 offset mm,
918,B,Possibly H19 offset mm,
919,B,Possibly H20 offset mm,
920,B,D01 offset mm,
921,B,D02 offset mm,
922,B,D03 offset mm,
923,B,D04 offset mm,
924,B,D05 offset mm,
925,B,D06 offset mm,
926,B,D07 offset mm,
927,B,D08 offset mm,
928,B,D09 offset mm,
929,B,D10 offset mm,
930,B,D11 offset mm,
931,B,D12 offset mm,
932,B,D13 offset mm,
933,B,D14 offset mm,
934,B,D15 offset mm,
935,B,D16 offset mm,
936,B,Possibly D17 offset mm,
937,B,Possibly D18 offset mm,
938,B,Possibly D19 offset mm,
939,B,Possibly D20 offset mm,
940,S,1th Coordinate axis Name 0-5 : XYZAB,
941,S,2th Coordinate axis Name 0-5 : XYZAB,
942,S,3th Coordinate axis Name 0-5 : XYZAB,
943,B,4th Coordinate axis Name 0-5 : XYZAB,
944,B,5th Coordinate axis Name 0-5 : XYZAB,
945,B,,
946,S,,
947,S,,
948,S,,
949,B,4th axis type 0: Linear axis; 1: Rotation axis,
950,B,5th axis type 0: Linear axis; 1: Rotation axis,
951,B,,
952,B,,
953,B,,
954,B,,
955,B,4th axis Offset X,
956,B,5th-axis Offset X,
957,B,,
958,B,,
959,B,,
960,B,,
961,B,4th-axis Offset Y,
962,B,5th axis Offset Y,
963,B,,
964,B,,
965,B,,
966,B,,
967,B,4th axis Offset Z,
968,B,5th axis Offset Z,
969,B,,
970,B,,
971,B,,
972,B,,
973,B,4th-axis Vector U,
974,B,5th-axis Vector U,
975,B,,
976,B,,
977,B,,
978,B,,
979,B,4th axis Vector V,
980,B,5th axis Vector V,
981,B,,
982,B,,
983,B,,
984,B,,
985,B,4th-axis Vector W,
986,B,5th-axis Vector W,
987,B,,
988,B,Programming axis of physical axis 1 0:None 1:X 2:Y 3:Z 4:4th 5:5th,
989,B,Programming axis of physical axis 2 0:None 1:X 2:Y 3:Z 4:4th 5:5th,
990,B,Programming axis of physical axis 3 0:None 1:X 2:Y 3:Z 4:4th 5:5th,
991,B,Programming axis of physical axis 4 0:None 1:X 2:Y 3:Z 4:4th 5:5th,
992,B,Programming axis of physical axis 5 0:None 1:X 2:Y 3:Z 4:4th 5:5th,
993,B,,
994,B,,
995,B,,
996,B,,
997,B,,
998,B,,
999,B,,
1000,B,X-axis servo alarm signal,
1001,B,X axis servor Alarm signal Enable,
1002,B,axis servo Alarm signal electronic level,
1003,B,Y-axis servo alarm signal,
1004,B,Y axis servo Alarm signal Enable,
1005,B,Y axis servo Alarm signal electronic level,
1006,B,Z-axis servo alarm signal,
1007,B,Z axis servo Alarm signal enable,
1008,B,Z axis servo Alarm signal electronic level,
1009,B,4th axis servo Alarm signal Input Signal (Spindle alarm signal),
1010,B,4th axis servo Alarm signal Enable,
1011,B,4th axis servo Alarm signal electronic level,
1012,B,5th axis servo alarm signal,
1013,B,5th axis servo Alarm signal Enable,
1014,B,5th axis servo Alarm signal electronic level,
1015,B,Negative X-axis hard limit signal,
1016,B,Negative X-axis hard limit signal ENABLE,
1017,B,Negative X-axis hard limit signal Effective level,
1018,B,Negative Y-axis hard limit signal,
1019,B,Negative Y-axis hard limit signal ENABLE,
1020,B,Negative Y-axis hard limit signal Effective level,
1021,B,Negative Z-axis hard limit signal,
1022,B,Negative Z-axis hard limit signal ENABLE,
1023,B,Negative Z-axis hard limit signal Effective level,
1024,B,Negative 4th-axis hard limit signal,
1025,B,Negative 4th-axis hard limit signal ENABLE,
1026,B,Negative 4th-axis hard limit signal Effective level,
1027,B,Negative 5th axis hard limit signal,
1028,B,Negative 5th-axis hard limit signal ENABLE,
1029,B,Negative 5th-axis hard limit signal Effective level,
1030,B,Positive X-axis hard limit signal,
1031,B,Positive X-axis hard limit signal ENABLE,
1032,B,Positive X-axis hard limit signal Effective level,
1033,B,Positive Y-axis hard limit signal,
1034,B,Positive Y-axis hard limit signal ENABLE,
1035,B,Positive Y-axis hard limit signal Effective level,
1036,B,Positive Z-axis hard limit signal,
1037,B,Positive Z-axis hard limit signal ENABLE,
1038,B,Positive Z-axis hard limit signal Effective level,
1039,B,Positive 4th axis hard limit signal,
1040,B,Positive 4th-axis hard limit signal ENABLE,
1041,B,Positive 4th-axis hard limit signal Effective level,
1042,B,Positive 5th axis hard limit signal,
1043,B,Positive 5th-axis hard limit signal ENABLE,
1044,B,Positive 5th-axis hard limit signal Effective level,
1045,B,X-axis zero signal,
1046,B,X-axis zero signal ENABLE,
1047,B,X-axis zero signal effective level,
1048,B,Y-axis zero signal,
1049,B,Y-axis zero signal ENABLE,
1050,B,Y-axis zero signal effective level,
1051,B,Z-axis zero signal,
1052,B,Z-axis zero signal ENABLE,
1053,B,Z-axis zero signal effective level,
1054,B,4th axis zero signal,
1055,B,4th axis zero signal ENABLE,
1056,B,4th axis zero signal effective level,
1057,B,5th axis zero signal,
1058,B,5th axis zero signal ENABLE,
1059,B,5th axis zero signal effective level,
1060,B,,
1061,B,,
1062,B,,
1063,B,,
1064,B,,
1065,B,,
1066,B,,
1067,B,,
1068,B,,
1069,B,,
1070,B,,
1071,B,,
1072,B,,
1073,B,,
1074,B,,
1075,B,Fixed probe signal,
1076,B,Fixed probe signal ENABLE,
1077,B,Fixed probe signal effective level,
1078,B,Floating probe signal,
1079,B,Floating Probe signal ENABLE,
1080,B,Floating Probe signal effective level,
1081,B,External Key 1 Signal,
1082,B,External Key 1 Enable,
1083,B,External Key 1 effective level,
1084,B,External Key 2Signal,
1085,B,External Key 2 Enable,
1086,B,External Key 2 effective level,
1087,B,External Key 3 Signal,
1088,B,External Key 3 Enable,
1089,B,External Key 3 effective level,
1090,B,External Key 4Signal,
1091,B,External Key 4 Enable,
1092,B,External Key 4 effective level,
1093,B,External Key 5 Signal,
1094,B,External Key 5 Enable,
1095,B,External Key 5 effective level,
1096,B,External Key 6Signal,
1097,B,External Key 6 Enable,
1098,B,External Key 6 effective level,
1099,B,External start signal Signal,
1100,B,External start signal enable,
1101,B,External Start signal Effective level,
1102,B,External Pause Signal,
1103,B,External Pause Signal Enable,
1104,B,External Pause signal Effective level,
1105,B,External Estop signal Signal,
1106,B,External Estop Signal Enable,
1107,B,External Estop signal Effective level,
1108,B,,
1109,B,,
1110,B,,
1111,B,,
1112,B,,
1113,B,,
1114,B,,
1115,B,,
1116,B,,
1117,B,,
1118,B,,
1119,B,,
1120,B,Spindle stop signal(M300) Port Number,
1121,B,Spindle Stop detection Enable,
1122,B,Spindle Stop detection effective level,
1123,B,Tool release input signal port number,
1124,B,Tool Release Detection Enable,
1125,B,Tool release detection effective level,
1126,B,Tool lock input signal(M302) Port Number,
1127,B,Tool lock detection signal Enable,
1128,B,Tool lock detection signal effective level,
1129,B,Tool open input signal(M303) Port Number,
1130,B,Tool open detection signal Enable,
1131,B,Tool open detection effective level,
1132,B,Dust cover open/close input signal(M305/M306) Port Number,
1133,B,Dust cover open/close signal enable,
1134,B,Dust cover open/close signal effective level,
1135,B,Inverter alarm input signal port Number,
1136,B,Inverter alarm input signal enable,
1137,B,Inverter alarm input signal effective level,
1138,B,Self-define Alarm signal 1 detection input Port,
1139,B,Self-define Alarm signal 1 ENABLE,
1140,B,Self-define Alarm signal 1 Effective level,
1141,B,Self-define Alarm signal 2 detection input Port,
1142,B,Self-define Alarm signal 2 ENABLE,
1143,B,Self-define Alarm signal 2 Effective level,
1144,B,Self-define Alarm signal 3 detection input Port,
1145,B,Self-define Alarm signal 3 ENABLE,
1146,B,Self-define Alarm signal 3 Effective level,
1147,B,Self-define Alarm signal 4 detection input Port,
1148,B,Self-define Alarm signal 4 ENABLE,
1149,B,Self-define Alarm signal 4 Effective level,
1150,B,Self-define Alarm signal 5 detection input Port,
1151,B,Self-define Alarm signal 5 ENABLE,
1152,B,Self-define Alarm signal 5 Effective level,
1153,B,User storage,Safe park X position
1154,B,User storage,Safe park Y position
1155,B,User storage,Tool change park X position
1156,B,User storage,Tool change park Y position
1157,B,,
1158,B,,
1159,B,,
1160,B,,
1161,B,,
1162,B,,
1163,B,,
1164,B,,
1165,B,,
1166,B,,
1167,B,,
1168,B,,
1169,B,,
1170,B,User storage,Probe config
1171,B,User storage,Probe config
1172,B,User storage,Probe config
1173,B,User storage,Probe config
1174,B,User storage,Probe config
1175,B,User storage,Probe config
1176,B,,
1177,B,,
1178,B,,
1179,B,,
1180,B,,
1181,B,,
1182,B,,
1183,B,,
1184,B,,
1185,B,,
1186,B,,
1187,B,,
1188,B,,
1189,B,,
1190,B,,
1191,B,,
1192,B,,
1193,B,,
1194,B,Input port for M307 command,
1195,B,Enable input for command M307,
1196,B,Active level for command M307,
1197,B,Tool close input signal(M304) Port Number,
1198,B,Tool close input signal Enable,
1199,B,Tool close input signal Effective level,
1200,B,,
1201,B,,
1202,B,,
1203,B,,
1204,B,,
1205,B,,
1206,B,,
1207,B,,
1208,B,,
1209,B,,
1210,B,,
1211,B,,
1212,B,,
1213,B,,
1214,B,,
1215,B,Spindle Forward Rotation Signal Port Number,
1216,B,Spindle forward signal ENABLE,
1217,B,Spindle forward signal effective level,
1218,B,Spindle Reverse Rotation Signal Port Number,
1219,B,Spindle Reverse signal ENABLE,
1220,B,Spindle Reverse signal effective level,
1221,B,Spindle speed section 1 signal Port Number,
1222,B,Spindle speed section 1 signal enable,
1223,B,Spindle speed section 1 signal Effective level,
1224,B,Spindle speed section 2 signal Port Number,
1225,B,Spindle speed section 2 signal enable,
1226,B,Spindle speed section 2 signal Effective level,
1227,B,Spindle speed section 3 signal Port Number,
1228,B,Spindle speed section 3 signal enable,
1229,B,Spindle speed section 3 signal Effective level,
1230,B,Cooling M8/M9 control signal Port Number,
1231,B,Cooling M8/M9 control signal enable,
1232,B,Cooling M8/M9 control signal Effective level,
1233,B,Lubrication M10/M11 control signal Port Number,
1234,B,Lubrication M10/M11 control signal enable,
1235,B,Lubrication M10/M11 control signal Effective level,
1236,B,System alarm signal Output Port Number,
1237,B,System alarm signal Output Enable,
1238,B,System alarm signal Output Effective level,
1239,B,System working indicator signal output port number,
1240,B,System working indicator signal output Enable,
1241,B,System working indicator signal output effective level,
1242,B,System brake signal output port number,Electromagnetic axle brake (e.g. to prevent Z from dropping)
1243,B,System brake signal output Enable,Electromagnetic axle brake (e.g. to prevent Z from dropping)
1244,B,System brake signal output Effective level,Electromagnetic axle brake (e.g. to prevent Z from dropping)
1245,B,System ready indicator signal output port number,
1246,B,System ready indicator signal output Enable,
1247,B,System ready indicator signal output Effective level,
1248,B,,
1249,B,,
1250,B,"Tool release/lock signal (M154/M155) output port number,
1251,B,"Tool release/lock signal (M154/M155) output Enable,
1252,B,"Tool release/lock signal (M154/M155) output Effective Level,
1253,B,Tool launch/retract signal(M152/M153) output port number,
1254,B,Tool launch/retract signal(M152/M153) output Enable,
1255,B,Tool launch/retract signal(M152/M153) output Effective level,
1256,B,Front positioning on/off signal(M156/M157) output port number,
1257,B,Front positioning on/off signal(M156/M157) output Enable,
1258,B,Front positioning on/off signal(M156/M157) output Effective level,
1259,B,Vacuum pump on/off output signal(M158/M159) output port number,
1260,B,Vacuum pump on/off output signal(M158/M159) output enable,
1261,B,Vacuum pump on/off output signal(M158/M159) output Effective level,
1262,B,Dust cover open/close output signal (M150/M151) output port number,
1263,B,Dust cover open/close output signal (M150/M151) output Enable,
1264,B,Dust cover open/close output signal (M150/M151) output Effective level,
1265,B,Push cylinder open/close signal(M160/M161) output port number,
1266,B,Push cylinder open/close signal(M160/M161) output Enable,
1267,B,Push cylinder open/close signal(M160/M161) output Effective level,
1268,B,Vacuum cleaner on/off signal (M162/M163) output port number,
1269,B,Vacuum cleaner on/off signal (M162/M163) output Enable,
1270,B,Vacuum cleaner on/off signal (M162/M163) output Effective level,
1271,B,Left positioning on/off signal(M164/M165) output port number,
1272,B,Left positioning on/off signal(M164/M165) Enable,
1273,B,Left positioning on/off signal(M164/M165) Effective level,
1274,B,Vacuum valve open/close signal(M1166/M167) output port number,
1275,B,Vacuum valve open/close signal(M1166/M167) Enable,
1276,B,Vacuum valve open/close signal(M1166/M167) Effective level,
1277,B,Multi-process 1 open/close signal(M168/M169) output port number,
1278,B,Multi-process 1 open/close signal(M168/M169) Enable,
1279,B,Multi-process 1 open/close signal(M168/M169) Effective level,
1280,B,Multi-process 2 open/close signal(M170/M171) output port number,
1281,B,Multi-process 2 open/close signal(M170/M171) Enable,
1282,B,Multi-process 2 open/close signal(M170/M171) Effective level,
1283,B,Multi-process 3 open/close signal(M170/M171) output port number,
1284,B,Multi-process 3 open/close signal(M170/M171) Enable,
1285,B,Multi-process 3 open/close signal(M170/M171) Effective level,
1286,B,Multi-process 4 open/close signal(M170/M171) output port number,
1287,B,Multi-process 4 open/close signal(M170/M171) Enable,
1288,B,Multi-process 4 open/close signal(M170/M171) Effective level,
1289,B,Cooling 1 on/off signal(M176/M177) output port number,
1290,B,Cooling 1 on/off signal(M176/M177) Enable,
1291,B,Cooling 1 on/off signal(M176/M177) Effective level,
1292,B,Cooling 2 on/off signal(M176/M177) output port number,
1293,B,Cooling 2 on/off signal(M176/M177) Enable,
1294,B,Cooling 2 on/off signal(M176/M177) Effective level,
1295,B,Servo spindle enable output port,Switches analog/servo spindle (for machines with autochange)
1296,B,Enable servo spindle enable output port,Switches analog/servo spindle (for machines with autochange)
1297,B,Servo spindle enable port output level,Switches analog/servo spindle (for machines with autochange)
1298,B,,
1299,B,,
1300,B,current tool number,The current tool number. You can change. Then change the tool number on the main screen.
1301,B,Tool capacity,
1302,B,Tool magazine type 0:NULL 1：Multiple 2：Follow row 3：Fixed row 4：Disk,
1303,B,The virtual Tool function turned on,
1304,B,Is the tool change prompt valid?,Whether to pause and prompt to change the tool when the tool change.
1305,B,Automatic tool probe after tool change,
1306,B,The highest pos when chang Tool,
1307,B,The lowest pos when chang Tool,
1308,B,X-axis Front position for Tool change in Mach coordinate,
1309,B,Y-axis Front position for Tool change in Mach coordinate,
1310,B,Z-axis Front position for Tool change in Mach coordinate,
1311,B,Spindle move speed when changing the tool,
1312,B,Z-axis lifting speed when changing the tool,
1313,B,The magazine horizontally moving speed,
1314,B,Spindle lock output delay,
1315,B,After tool change, Back to the position before the tool change,
1316,B,X mach pos when manually changing the tool,
1317,B,Y mach pos when manually changing the tool,
1318,B,Z mach pos when manually changing the tool,
1319,B,Z axis downward movement speed,
1320,B,Pushing start X mach pos,
1321,B,Pushing start Y mach pos,
1322,B,push delay,
1323,B,Pushing end X mach pos,
1324,B,Pushing end Y mach pos,
1325,B,Pushing completed X mach pos,
1326,B,Pushing completed X mach pos,
1327,B,pushing speed,
1328,B,4th-Axis Mach position before tool change,
1329,B,5th-Axis Mach position before tool change,
1330,B,X coordinate of No.1 Tool,
1331,B,X coordinate of No.2 Tool,
1332,B,X coordinate of No.3 Tool,
1333,B,X coordinate of No.4 Tool,
1334,B,X coordinate of No.5 Tool,
1335,B,X coordinate of No.6 Tool,
1336,B,X coordinate of No.7 Tool,
1337,B,X coordinate of No.8 Tool,
1338,B,X coordinate of No.9 Tool,
1339,B,X coordinate of No.10 Tool,
1340,B,X coordinate of No.11 Tool,
1341,B,X coordinate of No.12 Tool,
1342,B,X coordinate of No.13 Tool,
1343,B,X coordinate of No.14 Tool,
1344,B,X coordinate of No.15 Tool,
1345,B,X coordinate of No.16 Tool,
1346,B,X coordinate of No.17 Tool,
1347,B,X coordinate of No.18 Tool,
1348,B,X coordinate of No.19 Tool,
1349,B,X coordinate of No.20 Tool,
1350,B,Y coordinate of No.1 Tool,
1351,B,Y coordinate of No.2 Tool,
1352,B,Y coordinate of No.3 Tool,
1353,B,Y coordinate of No.4 Tool,
1354,B,Y coordinate of No.5 Tool,
1355,B,Y coordinate of No.6 Tool,
1356,B,Y coordinate of No.7 Tool,
1357,B,Y coordinate of No.8 Tool,
1358,B,Y coordinate of No.9 Tool,
1359,B,Y coordinate of No.10 Tool,
1360,B,Y coordinate of No.11 Tool,
1361,B,Y coordinate of No.12 Tool,
1362,B,Y coordinate of No.13 Tool,
1363,B,Y coordinate of No.14 Tool,
1364,B,Y coordinate of No.15 Tool,
1365,B,Y coordinate of No.16 Tool,
1366,B,Y coordinate of No.17 Tool,
1367,B,Y coordinate of No.18 Tool,
1368,B,coordinate of No.19 Tool,
1369,B,Y coordinate of No.20 Tool,
1370,B,Z coordinate of No.1 Tool,
1371,B,Z coordinate of No.2 Tool,
1372,B,Z coordinate of No.3 Tool,
1373,B,Z coordinate of No.4 Tool,
1374,B,Z coordinate of No.5 Tool,
1375,B,Z coordinate of No.6 Tool,
1376,B,Z coordinate of No.7 Tool,
1377,B,Z coordinate of No.8 Tool,
1378,B,Z coordinate of No.9 Tool,
1379,B,Z coordinate of No.10 Tool,
1380,B,Z coordinate of No.11 Tool,
1381,B,Z coordinate of No.12 Tool,
1382,B,Z coordinate of No.13 Tool,
1383,B,Z coordinate of No.14 Tool,
1384,B,Z coordinate of No.15 Tool,
1385,B,coordinate of No.16 Tool,
1386,B,Z coordinate of No.17 Tool,
1387,B,Z coordinate of No.18 Tool,
1388,B,Z coordinate of No.19 Tool,
1389,B,Z coordinate of No.20 Tool,
1390,B,X offset of No.1 Tool,
1391,B,X offset of No.2 Tool,
1392,B,X offset of No.3 Tool,
1393,B,X offset of No.4 Tool,
1394,B,X offset of No.5 Tool,
1395,B,X offset of No.6 Tool,
1396,B,X offset of No.7 Tool,
1397,B,X offset of No.8 Tool,
1398,B,X offset of No.9 Tool,
1399,B,X offset of No.10 Tool,
1400,B,X offset of No.11 Tool,
1401,B,X offset of No.12 Tool,
1402,B,X offset of No.13 Tool,
1403,B,X offset of No.14 Tool,
1404,B,X offset of No.15 Tool,
1405,B,X offset of No.16 Tool,
1406,B,X offset of No.17 Tool,
1407,B,X offset of No.18 Tool,
1408,B,X offset of No.19 Tool,
1409,B,X offset of No.20 Tool,
1410,B,Y offset of No.1 Tool,
1411,B,Y offset of No.2 Tool,
1412,B,Y offset of No.3 Tool,
1413,B,Y offset of No.4 Tool,
1414,B,Y offset of No.5 Tool,
1415,B,Y offset of No.6 Tool,
1416,B,Y offset of No.7 Tool,
1417,B,Y offset of No.8 Tool,
1418,B,Y offset of No.9 Tool,
1419,B,Y offset of No.10 Tool,
1420,B,Y offset of No.11 Tool,
1421,B,Yoffset of No.12 Tool,
1422,B,Y offset of No.13 Tool,
1423,B,Y offset of No.14 Tool,
1424,B,Y offset of No.15 Tool,
1425,B,offset of No.16 Tool,
1426,B,Y offset of No.17 Tool,
1427,B,Y offset of No.18 Tool,
1428,B,Y offset of No.19 Tool,
1429,B,Y offset of No.20 Tool,
1430,B,offset of No.1 Tool,
1431,B,Z offset of No.2 Tool,
1432,B,Z offset of No.3 Tool,
1433,B,Z offset of No.4 Tool,
1434,B,Z offset of No.5 Tool,
1435,B,Z offset of No.6 Tool,
1436,B,Z offset of No.7 Tool,
1437,B,Z offset of No.8 Tool,
1438,B,Z offset of No.9 Tool,
1439,B,Z offset of No.10 Tool,
1440,B,Z offset of No.11 Tool,
1441,B,Z offset of No.12 Tool,
1442,B,Z offset of No.13 Tool,
1443,B,Z offset of No.14 Tool,
1444,B,Z offset of No.15 Tool,
1445,B,Z offset of No.16 Tool,
1446,B,Z offset of No.17 Tool,
1447,B,Z offset of No.18 Tool,
1448,B,Z offset of No.19 Tool,
1449,B,Z offset of No.20 Tool,
1450,B,T1 file no.,
1451,B,T2 file no.,
1452,B,Safety height Z,
1453,B,Starting point Y,
1454,B,Starting point Z,
1455,B,Xpos1,work coordinate value.
1456,B,Xpos2,work coordinate value.
1457,B,Xpos3,work coordinate value.
1458,B,Xpos4,work coordinate value.
1459,B,Xpos5,work coordinate value.
1460,B,Xpos6,work coordinate value.
1461,B,,
1462,B,,
1463,B,,
1464,B,,
1465,B,pause between T1 and T2,
1466,B,T1 spindle speed,
1467,B,T2 spindle speed,
1468,B,NC file index no.,
1469,B,Custom G-code number,自定义G代码号
1470,B,,
1471,B,,
1472,B,This feature was developed at the request of one of the clients. What it does is not clear.,May be -57.544. That is, it seems to work.
1473,B,Virtual tool Z offset 1,
1474,B,Virtual tool Z offset 2,
1475,B,Virtual tool Z offset 3,
1476,B,Virtual tool Z offset 4,
1477,B,Virtual tool Z offset 5,
1478,B,Virtual tool Z offset 6,
1479,B,Virtual tool Z offset 7,
1480,B,Virtual tool Z offset 8,
1481,B,Virtual tool Z offset 9,
1482,B,Virtual tool Z offset 10,
1483,B,Virtual tool Z offset 11,
1484,B,Virtual tool Z offset 12,
1485,B,Virtual tool Z offset 13,
1486,B,Virtual tool Z offset 14,
1487,B,Virtual tool Z offset 15,
1488,B,Virtual tool Z offset 16,
1489,B,Virtual tool Z offset 17,
1490,B,Virtual tool Z offset 18,
1491,B,Virtual tool Z offset 19,
1492,B,Virtual tool Z offset 20,
1493,B,,
1494,B,,
1495,B,,
1496,B,,
1497,B,,
1498,B,,
1499,B,coordinate offset method,
1500,S,M1 Unconditional stop Status,Enable/disable for M1
1501,S,Tapping mode: 0 Left-hand tapping thread(Counter-thread),1Right-hand tapping thread(Normal thread),Thread cutting mode. Right or left.
1502,S,Probe Mode,Sets the probing mode. 0-?; 1-movable sensor; 2-fixed sensor
1503,S,prompt information,Prints text to the status bar, only works if "#269 Debug printing enable" = 1
1504,S,Target Tool number Temporary variables,Stores the tool number from the M6Txx command
1505,S,Dialog prompt message,Displays a window with a message number.
1506,S,single piece processing finished mark,Saves how the last UE ended. M30 or M47
1507,S,Processing time record switch,Stops and starts the NC execution timer (Work Time)
1508,S,2nd probe operation switch,
1509,R/O,buzzer control,Beeps with a squeaker
1510,S,Print Value 1,Works in conjunction with #1503
1511,S,Print Value 2,Works in conjunction with #1503
1512,S,Print Value 3,Works in conjunction with #1503
1513,S,Print Value 4,Works in conjunction with #1503
1514,S,Lift up enable when pause,
1515,S,The Mark when X back to Home,Displays the status and toggles the "homeless" icon of the axis (when an axis is homemade, a dot appears next to its letter on the main screen)
1516,S,The Mark when Y back to Home,Displays the status and toggles the "homeless" icon of the axis (when an axis is homemade, a dot appears next to its letter on the main screen)
1517,S,The Mark when Z back to Home,Displays the status and toggles the "homeless" icon of the axis (when an axis is homemade, a dot appears next to its letter on the main screen)
1518,S,The Mark when 4th back to Home,Displays the status and toggles the "homeless" icon of the axis (when an axis is homemade, a dot appears next to its letter on the main screen)
1519,S,The Mark when 5th back to Home,Displays the status and toggles the "homeless" icon of the axis (when an axis is homemade, a dot appears next to its letter on the main screen)
1520,R/O,Common Input port 01 Status,Displays the status of the input port. Closed=0; open=1
1521,R/O,Common Input port 02 Status,Displays the status of the input port. Closed=0; open=1
1522,R/O,Common Input port 03 Status,Displays the status of the input port. Closed=0; open=1
1523,R/O,Common Input port 04 Status,Displays the status of the input port. Closed=0; open=1
1524,R/O,Common Input port 05 Status,Displays the status of the input port. Closed=0; open=1
1525,R/O,Common Input port 06 Status,Displays the status of the input port. Closed=0; open=1
1526,R/O,Common Input port 07 Status,Displays the status of the input port. Closed=0; open=1
1527,R/O,Common Input port 08 Status,Displays the status of the input port. Closed=0; open=1
1528,R/O,Common Input port 09 Status,Displays the status of the input port. Closed=0; open=1
1529,R/O,Common Input port 10 Status,Displays the status of the input port. Closed=0; open=1
1530,R/O,Common Input port 11 Status,Displays the status of the input port. Closed=0; open=1
1531,R/O,Common Input port 12 Status,Displays the status of the input port. Closed=0; open=1
1532,R/O,Common Input port 13 Status,Displays the status of the input port. Closed=0; open=1
1533,R/O,Common Input port 14 Status,Displays the status of the input port. Closed=0; open=1
1534,R/O,Common Input port 15 Status,Displays the status of the input port. Closed=0; open=1
1535,R/O,Common Input port 16 Status,Displays the status of the input port. Closed=0; open=1
1536,R/O,Common Input port 17 Status,Displays the status of the input port. Closed=0; open=1
1537,R/O,Common Input port 18 Status,Displays the status of the input port. Closed=0; open=1
1538,R/O,Common Input port 19 Status,Displays the status of the input port. Closed=0; open=1
1539,R/O,Common Input port 20 Status,Displays the status of the input port. Closed=0; open=1
1540,R/O,Common Input port 21 Status,Displays the status of the input port. Closed=0; open=1
1541,R/O,Common Input port 22 Status,Displays the status of the input port. Closed=0; open=1
1542,R/O,Common Input port 23 Status,Displays the status of the input port. Closed=0; open=1
1543,R/O,Common Input port 24 Status,Displays the status of the input port. Closed=0; open=1
1544,S,,
1545,S,Delay time (milliseconds),
1546,S,,
1547,S,,
1548,S,,
1549,S,,
1550,S,,
1551,S,,
1552,S,Common Output port 01 Status,Toggles the state of the output port. 1=closed; 0=open. Can only be 1 or 0. If any number > 1 is written, the value is converted to 1.
1553,S,Common Output port 02 Status,Toggles the state of the output port. 1=closed; 0=open. Can only be 1 or 0. If any number > 1 is written, the value is converted to 1.
1554,S,Common Output port 03 Status,Toggles the state of the output port. 1=closed; 0=open. Can only be 1 or 0. If any number > 1 is written, the value is converted to 1.
1555,S,Common Output port 04 Status,Toggles the state of the output port. 1=closed; 0=open. Can only be 1 or 0. If any number > 1 is written, the value is converted to 1.
1556,S,Common Output port 05 Status,Toggles the state of the output port. 1=closed; 0=open. Can only be 1 or 0. If any number > 1 is written, the value is converted to 1.
1557,S,Common Output port 06 Status,Toggles the state of the output port. 1=closed; 0=open. Can only be 1 or 0. If any number > 1 is written, the value is converted to 1.
1558,S,Common Output port 07 Status,Toggles the state of the output port. 1=closed; 0=open. Can only be 1 or 0. If any number > 1 is written, the value is converted to 1.
1559,S,Common Output port 08 Status,Toggles the state of the output port. 1=closed; 0=open. Can only be 1 or 0. If any number > 1 is written, the value is converted to 1.
1560,S,Common Output port 09 Status,Toggles the state of the output port. 1=closed; 0=open. Can only be 1 or 0. If any number > 1 is written, the value is converted to 1.
1561,S,Common Output Port 10 Status,Toggles the state of the output port. 1=closed; 0=open. Can only be 1 or 0. If any number > 1 is written, the value is converted to 1.
1562,S,Common Output port 11 Status,Toggles the state of the output port. 1=closed; 0=open. Can only be 1 or 0. If any number > 1 is written, the value is converted to 1.
1563,S,Common Output port 12 Status,Toggles the state of the output port. 1=closed; 0=open. Can only be 1 or 0. If any number > 1 is written, the value is converted to 1.
1564,S,Common Output port 13 Status,Toggles the state of the output port. 1=closed; 0=open. Can only be 1 or 0. If any number > 1 is written, the value is converted to 1.
1565,S,Common Output port 14 Status,Toggles the state of the output port. 1=closed; 0=open. Can only be 1 or 0. If any number > 1 is written, the value is converted to 1.
1566,S,Common Output Port 15 Status,Toggles the state of the output port. 1=closed; 0=open. Can only be 1 or 0. If any number > 1 is written, the value is converted to 1.
1567,S,Common Output port 16 Status,Toggles the state of the output port. 1=closed; 0=open. Can only be 1 or 0. If any number > 1 is written, the value is converted to 1.
1568,S,Common Output port 17 Status,Toggles the state of the output port. 1=closed; 0=open. Can only be 1 or 0. If any number > 1 is written, the value is converted to 1.
1569,S,Common Output port 18 Status,Toggles the state of the output port. 1=closed; 0=open. Can only be 1 or 0. If any number > 1 is written, the value is converted to 1.
1570,S,Common Output port 19 Status,Toggles the state of the output port. 1=closed; 0=open. Can only be 1 or 0. If any number > 1 is written, the value is converted to 1.
1571,S,Common Output Port 20 Status,Toggles the state of the output port. 1=closed; 0=open. Can only be 1 or 0. If any number > 1 is written, the value is converted to 1.
1572,S,Common Output port 21 Status,Toggles the state of the output port. 1=closed; 0=open. Can only be 1 or 0. If any number > 1 is written, the value is converted to 1.
1573,S,Common Output port 22 Status (unused),Toggles the state of the output port. 1=closed; 0=open. Can only be 1 or 0. If any number > 1 is written, the value is converted to 1.
1574,S,Common Output port 23 Status (unused),Toggles the state of the output port. 1=closed; 0=open. Can only be 1 or 0. If any number > 1 is written, the value is converted to 1.
1575,S,Common Output port 24 Status (unused),Toggles the state of the output port. 1=closed; 0=open. Can only be 1 or 0. If any number > 1 is written, the value is converted to 1.
1576,R/O,,
1577,S,,
1578,S,,
1579,S,,
1580,S,,
1581,S,,
1582,S,,
1583,S,,
1584,S,,
1585,S,,
1586,S,,
1587,S,,
1588,S,,
1589,S,,
1590,S,,
1591,S,,
1592,S,,
1593,S,,
1594,S,,
1595,S,,
1596,S,,
1597,S,,
1598,S,,
1599,S,,
1600,S,,
1601,S,,
1602,S,,
1603,S,,
1604,S,,
1605,S,,
1606,S,,
1607,S,,
1608,S,,
1609,S,,
1610,S,,
1611,S,,
1612,S,,
1613,S,,
1614,S,,
1615,S,,
1616,S,Current spindle speed,Displays how fast the spindle is currently turning. If the spindle is stopped (M5) then 0.
1617,S,,
1618,S,Home Start Sign 0:Start 1:End,When any axis is homed = 1. Otherwise 0. Homing progress indicator at start.
1619,S,label prompt information,Outputs text to a label printer (physical device)
1620,R/O,Analyze channel 1 Execution methods: 0：Request to Start or Restart 1:Request an Internal Pause 2:Request an external Pause,Utility function, manufacturer only.
1621,R/O,Analyze channel 2 Execution methods: 0：Request to Start or Restart 1:Request an Internal Pause 2:Request an external Pause,Utility function, manufacturer only.
1622,R/O,Analyze channel 3 Execution methods: 0：Request to Start or Restart 1:Request an Internal Pause 2:Request an external Pause,Utility function, manufacturer only.
1623,R/O,Analyze channel 4 Execution methods: 0：Request to Start or Restart 1:Request an Internal Pause 2:Request an external Pause,Utility function, manufacturer only.
1624,R/O,Analyze channel 5 Execution methods: 0：Request to Start or Restart 1:Request an Internal Pause 2:Request an external Pause,Utility function, manufacturer only.
1625,R/O,Analyze channel 6 Execution methods: 0：Request to Start or Restart 1:Request an Internal Pause 2:Request an external Pause,Utility function, manufacturer only.
1626,R/O,Analyze channel 7 Execution methods: 0：Request to Start or Restart 1:Request an Internal Pause 2:Request an external Pause,Utility function, manufacturer only.
1627,S,,
1628,S,,
1629,S,,
1630,R/O,Analyze channel 1 status: -1:Idle 0:Working 1: Pause,Utility function, manufacturer only.
1631,R/O,Analyze channel 1 status: -1:Idle 0:Working 1: Pause,Utility function, manufacturer only.
1632,R/O,Analyze channel 1 status: -1:Idle 0:Working 1: Pause,Utility function, manufacturer only.
1633,R/O,Analyze channel 1 status: -1:Idle 0:Working 1: Pause,Utility function, manufacturer only.
1634,R/O,Analyze channel 1 status: -1:Idle 0:Working 1: Pause,Utility function, manufacturer only.
1635,R/O,Analyze channel 1 status: -1:Idle 0:Working 1: Pause,Utility function, manufacturer only.
1636,R/O,Analyze channel 1 status: -1:Idle 0:Working 1: Pause,Utility function, manufacturer only.
1637,S,,
1638,S,,
1639,S,,
1640,S,,
1641,S,,
1642,S,,
1643,S,,
1644,S,,
1645,S,,
1646,S,,
1647,S,,
1648,S,,
1649,S,,
1650,S,,
1651,S,,
1652,S,,
1653,S,,
1654,S,,
1655,S,,
1656,S,,
1657,S,,
1658,S,,
1659,S,,
1660,S,,
1661,S,,
1662,S,,
1663,S,,
1664,S,,
1665,S,,
1666,S,,
1667,S,,
1668,S,,
1669,S,,
1670,S,,
1671,S,,
1672,S,,
1673,S,,
1674,S,,
1675,S,,
1676,S,,
1677,S,,
1678,S,,
1679,S,,
1680,S,,
1681,S,,
1682,S,,
1683,S,,
1684,S,,
1685,S,,
1686,S,,
1687,S,,
1688,S,,
1689,S,,
1690,S,,
1691,S,,
1692,S,,
1693,S,,
1694,S,,
1695,S,,
1696,S,,
1697,S,,
1698,S,,
1699,S,,
1700,R/O,Function Key 1 Status,
1701,R/O,Function Key 2 Status,
1702,R/O,Function Key 3 Status,
1703,R/O,Function Key 4 Status,
1704,R/O,Function Key 5 Status,
1705,R/O,Function Key 6 Status,
1706,R/O,Function Key 7 Status,
1707,R/O,Function Key 8 Status,
1708,R/O,Function Key 9 Status,
1709,R/O,Function Key 10 Status,
1710,R/O,Function Key 11 Status,
1711,R/O,Extended Key 1 Status,
1712,R/O,Extended Key 2 Status,
1713,R/O,Extended Key 3 Status,
1714,R/O,Extended Key 4 Status,
1715,R/O,Extended Key 5 Status,
1716,R/O,Extended Key 6 Status,
1717,R/O,Extended Key 7 Status,
1718,R/O,Extended Key 8 Status,
1719,S,,
1720,S,,
1721,S,,
1722,S,,
1723,S,,
1724,S,,
1725,S,,
1726,S,,
1727,S,,
1728,S,,
1729,S,,
1730,S,,
1731,S,,
1732,S,,
1733,S,,
1734,S,,
1735,S,,
1736,S,,
1737,S,,
1738,S,,
1739,S,,
1740,S,,
1741,S,,
1742,S,,
1743,S,,
1744,S,,
1745,S,,
1746,S,,
1747,S,,
1748,S,,
1749,S,,
1750,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1751,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1752,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1753,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1754,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1755,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1756,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1757,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1758,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1759,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1760,S,modbus function macro address,accept data buffer address (e.g. 1790)
1761,S,modbus function macro address,Serial port number for receiving data (there are 0 and 1)
1762,S,modbus function macro address,ID number of the slave device
1763,S,modbus function macro address,encoder circle address
1764,S,modbus function macro address,Number of bytes
1765,S,modbus function macro address,function code 03
1766,S,modbus function macro address,Receives some data
1767,S,modbus function macro address,laps return code (the value of this variable is displayed in a message in the status bar)
1768,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1769,S,modbus function macro address,Trigger for the end of data reception. It is set to 1, then WHILE [#1769 NE 0] DO1, a pause G04P10 is written in the loop body. When #1769=0, the data is accepted.
1770,S,modbus function macro address,This variable stores the result of data transformation
1771,S,modbus function macro address,row index (usually set to 1790 - data buffer address)
1772,S,modbus function macro address,Number of bytes
1773,S,modbus function macro address,Number type - 1 - 16-bit signed integer; 4 is a 32-bit unsigned integer. Accepts only 1, 2, 3, 4
1774,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1775,S,modbus function macro address,Data conversion (1 - convert data)
1776,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1777,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1778,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1779,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1780,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1781,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1782,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1783,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1784,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1785,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1786,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1787,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1788,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1789,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1790,S,modbus function macro address,Used as a buffer for receiving data. Any free modbus variable can serve as a data buffer.
1791,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1792,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1793,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1794,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1795,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1796,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1797,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1798,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1799,S,modbus function macro address,Variable for COM port (modbus function). This RS232 control method is obsolete. Another one has now been implemented.
1800,S,Analyze channel X axis control mark 0:X axis is in analyzing 1:X axis is in manual mode,Utility function, manufacturer only.
1801,S,Analyze channel Y axis control mark 0:Y axis is in analyzing 1:Y axis is in manual mode,Utility function, manufacturer only.
1802,S,Analyze channel Z axis control mark 0:Z axis is in analyzing 1:Z axis is in manual mode,Utility function, manufacturer only.
1803,S,Analyze channel 4th axis control mark 0:4th axis is in analyzing 1:4th axis is in manual mode,Utility function, manufacturer only.
1804,S,Analyze channel 5th axis control mark 0:5th axis is in analyzing 1:5th axis is in manual mode,Utility function, manufacturer only.
1805,S,,
1806,S,,
1807,S,,
1808,S,,
1809,S,,
1810,S,,
1811,S,,
1812,S,,
1813,S,,
1814,S,,
1815,S,,
1816,S,,
1817,S,,
1818,S,,
1819,S,,
1820,S,,
1821,S,,
1822,S,,
1823,S,,
1824,S,,
1825,S,,
1826,S,,
1827,S,,
1828,S,,
1829,S,,
1830,S,,
1831,S,,
1832,S,,
1833,S,,
1834,S,,
1835,S,,
1836,S,,
1837,S,,
1838,S,,
1839,S,,
1840,S,,
1841,S,,
1842,S,,
1843,S,,
1844,S,,
1845,S,,
1846,S,,
1847,S,,
1848,S,,
1849,S,,
1850,S,,
1851,S,,
1852,S,,
1853,S,,
1854,S,,
1855,S,,
1856,S,,
1857,S,,
1858,S,,
1859,S,,
1860,S,,
1861,S,,
1862,S,,
1863,S,,
1864,S,,
1865,S,,
1866,S,,
1867,S,,
1868,S,,
1869,S,,
1870,S,,
1871,S,,
1872,S,,
1873,S,,
1874,S,,
1875,S,,
1876,S,,
1877,S,,
1878,S,,
1879,S,,
1880,S,,
1881,S,,
1882,S,,
1883,S,,
1884,S,,
1885,S,,
1886,S,,
1887,S,,
1888,S,,
1889,S,,
1890,S,,
1891,S,,
1892,S,,
1893,S,,
1894,S,,
1895,S,G31 X axis detecting Speed,Remembers the speed of the axis (F), the last time G31 was executed
1896,S,G31 Y axis detecting Speed,Remembers the speed of the axis (F), the last time G31 was executed
1897,S,G31 Z axis detecting Speed,Remembers the speed of the axis (F), the last time G31 was executed
1898,S,G31 4th axis detecting Speed,Remembers the speed of the axis (F), the last time G31 was executed
1899,S,G31 5th axis detecting Speed,Remembers the speed of the axis (F), the last time G31 was executed
1900,S,G31 X axis Detecting signal number,Remembers the port number(P) when G31 was last executed
1901,S,G31 Y axis Detecting signal number,Remembers the port number(P) when G31 was last executed
1902,S,G31 Z axis Detecting signal number,Remembers the port number(P) when G31 was last executed
1903,S,G31 4th axis Detecting signal number,Remembers the port number(P) when G31 was last executed
1904,S,G31 5th axis Detecting signal number,Remembers the port number(P) when G31 was last executed
1905,S,G31 X detection signal stop mode 0: Decelerate to stop; 1: Emergency,Remembers the type of stop(Q) when last executed in G31
1906,S,G31 Y detection signal stop mode 0: Decelerate to stop; 1: Emergency,Remembers the type of stop(Q) when last executed in G31
1907,S,G31 Z detection signal stop mode 0: Decelerate to stop; 1: Emergency,Remembers the type of stop(Q) when last executed in G31
1908,S,G31 4th detection signal stop mode 0: Decelerate to stop; 1: Emergency,Remembers the type of stop(Q) when last executed in G31
1909,S,G31 5th detection signal stop mode 0: Decelerate to stop; 1: Emergency,Remembers the type of stop(Q) when last executed in G31
1910,S,G31 X detection signal Effective level 0/1,Remembers the trigger level (L) the last time a G31 was executed
1911,S,G31 Y detection signal Effective level 0/1,Remembers the trigger level (L) the last time a G31 was executed
1912,S,G31 Z detection signal Effective level 0/1,Remembers the trigger level (L) the last time a G31 was executed
1913,S,G31 4th detection signal Effective level 0/1,Remembers the trigger level (L) the last time a G31 was executed
1914,S,G31 5th detection signal Effective level 0/1,Remembers the trigger level (L) the last time a G31 was executed
1915,S,G31 X axis limit mode when probe 0:Ignore limit 1:Enable limit to Negative (-) direction 2：Enable limit to Positive direction (+),Remembers the response to Hard Limit(K) the last time G31 was executed
1916,S,G31 Y axis limit mode when probe 0:Ignore limit 1:Enable limit to Negative (-) direction 2：Enable limit to Positive direction (+),Remembers the response to Hard Limit(K) the last time G31 was executed
1917,S,G31 Z axis limit mode when probe 0:Ignore limit 1:Enable limit to Negative (-) direction 2：Enable limit to Positive direction (+),Remembers the response to Hard Limit(K) the last time G31 was executed
1918,S,G31 4th axis limit mode when probe 0:Ignore limit 1:Enable limit to Negative (-) direction 2：Enable limit to Positive direction (+),Remembers the response to Hard Limit(K) the last time G31 was executed
1919,S,G31 5th axis limit mode when probe 0:Ignore limit 1:Enable limit to Negative (-) direction 2：Enable limit to Positive direction (+),Remembers the response to Hard Limit(K) the last time G31 was executed
1920,S,G31 X axis Probe result 0:Did not Probe 1:Initialize 2:Detected the signal 3:Triggered Negative limit signal 4:Triggered Positive limit signal,The result of the last execution of the G31 command. (how did it end)
1921,S,G31 Y axis Probe result 0:Did not Probe 1:Initialize 2:Detected the signal 3:Triggered Negative limit signal 4:Triggered Positive limit signal,The result of the last execution of the G31 command. (how did it end)
1922,S,G31 Z axis Probe result 0:Did not Probe 1:Initialize 2:Detected the signal 3:Triggered Negative limit signal 4:Triggered Positive limit signal,The result of the last execution of the G31 command. (how did it end)
1923,S,G31 4th axis Probe result 0:Did not Probe 1:Initialize 2:Detected the signal 3:Triggered Negative limit signal 4:Triggered Positive limit signal,The result of the last execution of the G31 command. (how did it end)
1924,S,G31 5th axis Probe result 0:Did not Probe 1:Initialize 2:Detected the signal 3:Triggered Negative limit signal 4:Triggered Positive limit signal,The result of the last execution of the G31 command. (how did it end)
1925,S,G31 The X mach coordinates after probe signal triggered,Stores the machine coordinates of the axis, the last time the encoder was triggered, in G31. Used to determine the error value of the sensor operation.
1926,S,G31 The Y mach coordinates after probe signal triggered,Stores the machine coordinates of the axis, the last time the encoder was triggered, in G31. Used to determine the error value of the sensor operation.
1927,S,G31 The Z mach coordinates after probe signal triggered,Stores the machine coordinates of the axis, the last time the encoder was triggered, in G31. Used to determine the error value of the sensor operation.
1928,S,G31 The 4th mach coordinates after probe signal triggered,Stores the machine coordinates of the axis, the last time the encoder was triggered, in G31. Used to determine the error value of the sensor operation.
1929,S,G31 The 5th mach coordinates after probe signal triggered,Stores the machine coordinates of the axis, the last time the encoder was triggered, in G31. Used to determine the error value of the sensor operation.
1930,S,Key Indicator 1 Output Control (not working),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1931,S,Key Indicator 2 Output Control (Error),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1932,S,Key Indicator 3 Output Control (Run),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1933,S,Key Indicator 4 Output Control (USB),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1934,S,Key Indicator 5 Output Control (ESC),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1935,S,Key Indicator 6 Output Control (UP),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1936,S,Key Indicator 7 Output Control (Enter),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1937,S,Key Indicator 8 Output Control (LEFT),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1938,S,Key Indicator 9 Output Control (DOWN),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1939,S,Key Indicator 10 Output Control (RIGHT),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1940,S,Key Indicator 11 Output Control (Hight/Low Speed),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1941,S,Key Indicator 12 Output Control (Axis 5 -),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1942,S,Key Indicator 13 Output Control (Brake point Resume),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1943,S,Key Indicator 14 Output Control (Axis 5+),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1944,S,Key Indicator 15 Output Control (K1),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1945,S,Key Indicator 16 Output Control (K2),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1946,S,Key Indicator 17 Output Control (K3),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1947,S,Key Indicator 18 Output Control (K4),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1948,S,Key Indicator 19 Output Control (K5),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1949,S,Key Indicator 20 Output Control (K6),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1950,S,Key Indicator 21 Output Control (K7),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1951,S,Key Indicator 22 Output Control (SPINDLE),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1952,S,Key Indicator 23 Output Control (TruCut),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1953,S,Key Indicator 24 Output Control (CONT STEP MPG),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1954,S,Key Indicator 25 Output Control (START),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1955,S,Key Indicator 26 Output Control (PAUSE),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1956,S,Key Indicator 27 Output Control (RESET),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1957,S,Key Indicator 28 Output Control (not working),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1958,S,Key Indicator 29 Output Control (not working),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1959,S,Key Indicator 30 Output Control (not working),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1960,S,Key Indicator 31 Output Control (not working),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1961,S,Key Indicator 32 Output Control (not working),Controls the button's LED. 0-disabled. Any number > 0 - enabled.
1962,S,,
1963,S,,
1964,S,,
1965,S,,
1966,S,,
1967,S,,
1968,S,,
1969,S,,
1970,S,One Key Probe Tool No. 1,Used in mulprobe.nc file
1971,S,One Key Probe Tool No. 2,Used in mulprobe.nc file
1972,S,One Key Probe Tool No. 3,Used in mulprobe.nc file
1973,S,One Key Probe Tool No. 4,Used in mulprobe.nc file
1974,S,One Key Probe Tool No. 5,Used in mulprobe.nc file
1975,S,One Key Probe Tool No. 6,Used in mulprobe.nc file
1976,S,One Key Probe Tool No. 7,Used in mulprobe.nc file
1977,S,One Key Probe Tool No. 8,Used in mulprobe.nc file
1978,S,One Key Probe Tool No. 9,Used in mulprobe.nc file
1979,S,One Key Probe Tool No. 10,Used in mulprobe.nc file
1980,S,One Key Probe Tool No. eleven,Used in mulprobe.nc file
1981,S,One Key Probe Tool No. 12,Used in mulprobe.nc file
1982,S,One Key Probe Tool No. 13,Used in mulprobe.nc file
1983,S,One Key Probe Tool No. 14,Used in mulprobe.nc file
1984,S,One Key Probe Tool No. 15,Used in mulprobe.nc file
1985,S,One Key Probe Tool No. 16,Used in mulprobe.nc file
1986,S,One Key Probe Tool No. 17,Used in mulprobe.nc file
1987,S,One Key Probe Tool No. 18,Used in mulprobe.nc file
1988,S,One Key Probe Tool No. 19,Used in mulprobe.nc file
1989,S,One Key Probe Tool No. 20,Used in mulprobe.nc file
1990,S,,
1991,N,system mode,
1992,S,Home function enabled (does not work anymore),Used to enable homing after downloading. Now doesn't work.
1993,S,Probe enabled after tool change,
1994,S,RTCP Enable/Disable,Turning this setting on doesn't make sense. Because RTCP doesn't work. If enabled, the controller will fail.
1995,S,Current Max.AxisNumber,Number of controller axes
1996,S,Self-define M code Temporary variables (Custom M code number temporary variable),used in ext_button.nc (substituted as command number M - M#1996). May be equal to 250-263. Enables the EXT KEY FUNC K01-K14 commands of the Monitor - Manual page
1997,S,Manually operation self-define Key 1 status,Transfers the state of the virtual button FUNC K01, (pressed or released), to the M250 command
1998,S,Manually operation self-define Key 2 status,Transfers the state of the virtual button FUNC K02, (pressed or released), to the command M251
1999,S,Manually operation self-define Key 3 status,Transfers the state of the virtual button FUNC K03, (pressed or released), to the command M252
2000,S,Manually operation self-define Key 4 status,Transfers the state of the virtual button FUNC K04, (pressed or released), to the command M253
2001,S,Manually operation self-define Key 5 status,Transfers the state of the virtual button FUNC K05, (pressed or released), to the command M254
2002,S,Manually operation self-define Key 6 status,Transfers the state of the virtual button FUNC K06, (pressed or released), to the command M255
2003,S,Manually operation self-define Key 7 status,Transfers the state of the virtual button FUNC K07, (pressed or released), to the command M256
2004,S,Manually operation self-define Key 8 status,Transfers the state of the virtual button FUNC K08, (pressed or released), to the command M257
2005,S,Manually operation self-define Key 9 status,Transfers the state of the virtual button FUNC K09, (pressed or released), to the command M258
2006,S,Manually operation self-define Key 10 status,Transfers the state of the FUNC K10 virtual button, (pressed or released), to the M259 command
2007,S,Manually operation self-define Key 11 status,Transfers the state of the FUNC K11 virtual button, (pressed or released), to the M260 command
2008,S,Manually operation self-define Key 12 status,Transfers the status of the FUNC K12 virtual button, (pressed or released), to the M261 command
2009,S,Manually operation self-define Key 13 status,Sends the state of the FUNC K13 virtual button, (pressed or released), to the M262 command
2010,S,Manually operation self-define Key 14 status,Transfers the status of the FUNC K14 virtual button, (pressed or released), to the M263 command
2011,S,Manually operation self-define Key 15 status,Missing code in slib-m. The FUNC K15 button is missing from the Manual page.
2012,S,Manually operation self-define Key 16 status,Missing code in slib-m. The FUNC K16 button is missing from the Manual page.
2013,S,Manually operation self-define Key 17 status,Missing code in slib-m. The FUNC K17 button is missing from the Manual page.
2014,S,Manually operation self-define Key 18 status,Missing code in slib-m. The FUNC K18 button is missing from the Manual page.
2015,S,Manually operation self-define Key 19 status,Missing code in slib-m. The FUNC K19 button is missing from the Manual page.
2016,S,Manually operation self-define Key 20 status,Missing code in slib-m. The FUNC K20 button is missing from the Manual page.
2017,S,Automatically operation self-define Key 1 status,Status of virtual button 1, (pressed or released), from command M270
2018,S,Automatically operation self-define Key 2 status,Status of virtual button 2, (pressed or released), from command M271
2019,S,Automatically operation self-define Key 3 status,Status of virtual button 3, (pressed or released), from command M272
2020,S,Automatically operation self-define Key 4 status,Status of virtual button 4, (pressed or released), from command M273
2021,S,Automatically operation self-define Key 5 status,Status of virtual button 5, (pressed or released), from command M274
2022,S,Automatically operation self-define Key 6 status,Status of virtual button 6, (pressed or released), from command M275
2023,S,Automatically operation self-define Key 7 status,Status of virtual button 7, (pressed or released), from command M276
2024,S,Automatically operation self-define Key 8 status,Status of virtual button 8, (pressed or released), from command M277
2025,S,Automatically operation self-define Key 9 status,Status of virtual button 9, (pressed or released), from command M278
2026,S,Automatically operation self-define Key 10 status,Status of virtual button 10, (pressed or released), from command M279
2027,S,Automatically operation self-define Key 11 status,Status of virtual button 11, (pressed or released), from command M280
2028,S,Automatically operation self-define Key 12 status,Status of virtual button 12, (pressed or released), from command M280
2029,S,,
2030,S,,
2031,S,,
2032,S,,
2033,S,,
2034,S,,
2035,S,,
2036,S,,
2037,S,Virtual key trigger register 0x1017f 017f is the key number,1 is the status when pressed down,Presses a virtual button, saves the entered value until reboot #2037=64536+function code
2038,S,Possibly Self-define G code Temporary variables,Used in CAM.nc. Substituted as the G number of the team - G#2038
2039,,,
2040,,,
2041,,,
2042,S,Beep sound for macro program,in milliseconds
2043,,,
2044,,,
2045,,,
2046,,,
2047,,,
2048,,,
2049,,,
2050,,,
2051,,,
2052,,,
2053,,,
2054,,,
2055,,,
2056,,,
2057,,,
2058,,,
2059,,,
2060,,,
2061,,,
2062,,,
2063,,,
2064,,,
2065,,,
2066,,,
2067,,,
2068,,,
2069,,,
2070,,,
2071,,,
2072,S,K1 function Key indicator Address,Control variable number, button LED K1 (#[1930+#2072])
2073,S,K2 function Key indicator Address,Control variable number, button LED K2 (#[1930+#2073])
2074,S,K3 function Key indicator Address,Control variable number, button LED K3 (#[1930+#2074])
2075,S,K4 function Key indicator Address,Control variable number, button LED K4 (#[1930+#2075])
2076,S,K5 function Key indicator Address,Control variable number, button LED K5 (#[1930+#2076])
2077,S,K6 function Key indicator Address,Control variable number, button LED K6 (#[1930+#2077])
2078,S,K7 function Key indicator Address,Control variable number, button LED K7 (#[1930+#2078])
2079,S,K8 function Key indicator Address (not working),does not work
2080,S,,
2081,S,,
2082,S,,
2083,S,,
2084,S,,
2085,S,,
2086,S,,
2087,S,,
2088,S,,
2089,S,,
2090,S,,
2091,S,,
2092,S,Teach M118 input detection input port number,Used in M118 command. Subroutine O10118 in slib-m
2093,S,Teach M118 input port effective level,Used in M118 command. Subroutine O10118 in slib-m
2094,S,Used in the M129 command.,
2095,S,Used in the M129 command.,
2097,S,Stores the result of the M129 command, values 1 or 0,
2098,S,,
2099,S,,
2100,S,Used in slib-g, in O501 (homing) and O503, as an intermediate variable,With her participation, the function of calculating the accuracy of the operation of the homing sensor works
2101,S,Used in slib-g, in O501 (homing) and O503, as an intermediate variable,With her participation, the function of calculating the accuracy of the operation of the homing sensor works
2102,S,Used in slib-g, in O501 (homing) and O503, as an intermediate variable,With her participation, the function of calculating the accuracy of the operation of the homing sensor works
2103,S,Used in slib-g, in O501 (homing) and O503, as an intermediate variable,With her participation, the function of calculating the accuracy of the operation of the homing sensor works
2104,S,Used in slib-g, in O501 (homing) and O503, as an intermediate variable,With her participation, the function of calculating the accuracy of the operation of the homing sensor works
2105,S,Used in slib-g, in O501 (homing) and O503, as an intermediate variable,With her participation, the function of calculating the number of errors when entering the homing sensor works
2106,S,,
2107,S,,
2108,S,,
2109,S,,
2110,S,,
2111,S,,
2112,S,,
2113,S,,
2114,S,,
2115,S,,
2116,S,,
2117,S,,
2118,S,,
2119,S,,
2120,S,,
2121,S,,
2122,S,,
2123,S,,
2124,S,,
2125,S,,
2126,S,,
2127,S,,
2128,S,,
2129,S,,
2130,S,,
2131,S,,
2132,S,,
2133,S,,
2134,S,,
2135,S,,
2136,S,,
2137,S,,
2138,S,,
2139,S,,
2140,S,,
2141,S,,
2142,S,,
2143,S,,
2144,S,,
2145,S,,
2146,S,,
2147,S,,
2148,S,,
2149,S,,
2150,S,,
2151,S,,
2152,S,,
2153,S,,
2154,S,,
2155,S,,
2156,S,,
2157,S,,
2158,S,,
2159,S,,
2160,S,,
2161,S,,
2162,S,,
2163,S,,
2164,S,,
2165,S,,
2166,S,,
2167,S,,
2168,S,,
2169,S,,
2170,S,,
2171,S,,
2172,S,,
2173,S,,
2174,S,,
2175,S,,
2176,S,,
2177,S,,
2178,S,,
2179,S,,
2180,S,,
2181,S,,
2182,S,,
2183,S,,
2184,S,,
2185,S,,
2186,S,,
2187,S,,
2188,S,,
2189,S,,
2190,S,,
2191,S,,
2192,S,,
2193,S,,
2194,S,,
2195,S,,
2196,S,,
2197,S,,
2198,S,,
2199,S,,
2200,S,,
2201,S,,
2202,S,,
2203,S,,
2204,S,,
2205,S,,
2206,S,,
2207,S,,
2208,S,,
2209,S,,
2210,S,,
2211,S,,
2212,S,,
2213,S,,
2214,S,,
2215,S,,
2216,S,,
2217,S,,
2218,S,,
2219,S,,
2220,S,,
2221,S,,
2222,S,,
2223,S,,
2224,S,,
2225,S,,
2226,S,,
2227,S,,
2228,S,,
2229,S,,
2230,S,,
2231,S,,
2232,S,,
2233,S,,
2234,S,,
2235,S,,
2236,S,,
2237,S,,
2238,S,,
2239,S,,
2240,S,,
2241,S,,
2242,S,,
2243,S,,
2244,S,,
2245,S,,
2246,S,,
2247,S,,
2248,S,,
2249,S,,
2250,S,,
2251,S,,
2252,S,,
2253,S,,
2254,S,,
2255,S,,
2256,S,,
2257,S,,
2258,S,,
2259,S,,
2260,S,,
2261,S,,
2262,S,,
2263,S,,
2264,S,,
2265,S,,
2266,S,,
2267,S,,
2268,S,,
2269,S,,
2270,S,,
2271,S,,
2272,S,,
2273,S,,
2274,S,,
2275,S,,
2276,S,,
2277,S,,
2278,S,,
2279,S,,
2280,S,,
2281,S,,
2282,S,,
2283,S,,
2284,S,,
2285,S,,
2286,S,,
2287,S,,
2288,S,,
2289,S,,
2290,S,,
2291,S,,
2292,S,,
2293,S,,
2294,S,,
2295,S,,
2296,S,,
2297,S,,
2298,S,,
2299,S,,
2300,S,,
2301,S,,
2302,S,,
2303,S,,
2304,S,,
2305,S,,
2306,S,,
2307,S,,
2308,S,,
2309,S,,
2310,S,,
2311,S,,
2312,S,,
2313,S,,
2314,S,,
2315,S,,
2316,S,,
2317,S,,
2318,S,,
2319,S,,
2320,S,,
2321,S,,
2322,S,,
2323,S,,
2324,S,,
2325,S,,
2326,S,,
2327,S,,
2328,S,,
2329,S,,
2330,S,,
2331,S,,
2332,S,,
2333,S,,
2334,S,,
2335,S,,
2336,S,,
2337,S,,
2338,S,,
2339,S,,
2340,S,,
2341,S,,
2342,S,,
2343,S,,
2344,S,,
2345,S,,
2346,S,,
2347,S,,
2348,S,,
2349,S,,
2350,S,,
2351,S,,
2352,S,,
2353,S,,
2354,S,,
2355,S,,
2356,S,,
2357,S,,
2358,S,,
2359,S,,
2360,S,,
2361,S,,
2362,S,,
2363,S,,
2364,S,,
2365,S,,
2366,S,,
2367,S,,
2368,S,,
2369,S,,
2370,S,,
2371,S,,
2372,S,,
2373,S,,
2374,S,,
2375,S,,
2376,S,,
2377,S,,
2378,S,,
2379,S,,
2380,S,,
2381,S,,
2382,S,,
2383,S,,
2384,S,,
2385,S,,
2386,S,,
2387,S,,
2388,S,,
2389,S,,
2390,S,,
2391,S,,
2392,S,,
2393,S,,
2394,S,,
2395,S,,
2396,S,,
2397,S,,
2398,S,,
2399,S,,
2400,S,,
2401,S,,
2402,S,,
2403,S,,
2404,S,,
2405,S,,
2406,S,,
2407,S,,
2408,S,,
2409,S,,
2410,S,,
2411,S,,
2412,S,,
2413,S,,
2414,S,,
2415,S,,
2416,S,,
2417,S,,
2418,S,,
2419,S,,
2420,S,,
2421,S,,
2422,S,,
2423,S,,
2424,S,,
2425,S,,
2426,S,,
2427,S,,
2428,S,,
2429,S,,
2430,S,,
2431,S,,
2432,S,,
2433,S,,
2434,S,,
2435,S,,
2436,S,,
2437,S,,
2438,S,,
2439,S,,
2440,S,,
2441,S,,
2442,S,,
2443,S,,
2444,S,,
2445,S,,
2446,S,,
2447,S,,
2448,S,,
2449,S,,
2450,S,,
2451,S,,
2452,S,,
2453,S,,
2454,S,,
2455,S,,
2456,S,,
2457,S,,
2458,S,,
2459,S,,
2460,S,,
2461,S,,
2462,S,,
2463,S,,
2464,S,,
2465,S,,
2466,S,,
2467,S,,
2468,S,,
2469,S,,
2470,S,,
2471,S,,
2472,S,,
2473,S,,
2474,S,,
2475,S,,
2476,S,,
2477,S,,
2478,S,,
2479,S,,
2480,S,,
2481,S,,
2482,S,,
2483,S,,
2484,S,,
2485,S,,
2486,S,,
2487,S,,
2488,S,,
2489,S,,
2490,S,,
2491,S,,
2492,S,,
2493,S,,
2494,S,,
2495,S,,
2496,S,,
2497,S,,
2498,S,,
2499,S,,
2500,B,,
2501,B,,
2502,B,,
2503,B,,
2504,B,,
2505,B,,
2506,B,,
2507,B,,
2508,B,,
2509,B,,
2510,B,,
2511,B,,
2512,B,,
2513,B,,
2514,B,,
2515,B,,
2516,B,,
2517,B,,
2518,B,,
2519,B,,
2520,B,,
2521,B,,
2522,B,,
2523,B,,
2524,B,,
2525,B,,
2526,B,,
2527,B,,
2528,B,,
2529,B,,
2530,B,,
2531,B,,
2532,B,,
2533,B,,
2534,B,,
2535,B,,
2536,B,,
2537,B,,
2538,B,,
2539,B,,
2540,B,,
2541,B,,
2542,B,,
2543,B,,
2544,B,,
2545,B,,
2546,B,,
2547,B,,
2548,B,,
2549,B,,
2550,B,,
2551,B,,
2552,B,,
2553,B,,
2554,B,,
2555,B,,
2556,B,,
2557,B,,
2558,B,,
2559,B,,
2560,B,,
2561,B,,
2562,B,,
2563,B,,
2564,B,,
2565,B,,
2566,B,,
2567,B,,
2568,B,,
2569,B,,
2570,B,,
2571,B,,
2572,B,,
2573,B,,
2574,B,,
2575,B,,
2576,B,,
2577,B,,
2578,B,,
2579,B,,
2580,B,,
2581,B,,
2582,B,,
2583,B,,
2584,B,,
2585,B,,
2586,B,,
2587,B,,
2588,B,,
2589,B,,
2590,B,,
2591,B,,
2592,B,,
2593,B,,
2594,B,,
2595,B,,
2596,B,,
2597,B,,
2598,B,,
2599,B,,
2600,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2601,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2602,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2603,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2604,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2605,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2606,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2607,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2608,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2609,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2610,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2611,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2612,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2613,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2614,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2615,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2616,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2617,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2618,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2619,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2620,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2621,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2622,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2623,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2624,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2625,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2626,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2627,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2628,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2629,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2630,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2631,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2632,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2633,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2634,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2635,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2636,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2637,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2638,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2639,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2640,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2641,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2642,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2643,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2644,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2645,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2646,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2647,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2648,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2649,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2650,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2651,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2652,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2653,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2654,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2655,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2656,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2657,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2658,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2659,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2660,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2661,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2662,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2663,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2664,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2665,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2666,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2667,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2668,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2669,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2670,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2671,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2672,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2673,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2674,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2675,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2676,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2677,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2678,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2679,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2680,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2681,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2682,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2683,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2684,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2685,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2686,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2687,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2688,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2689,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2690,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2691,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2692,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2693,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2694,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2695,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2696,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2697,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2698,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2699,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2700,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2701,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2702,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2703,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2704,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2705,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2706,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2707,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2708,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2709,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2710,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2711,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2712,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2713,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2714,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2715,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2716,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2717,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2718,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2719,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2720,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2721,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2722,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2723,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2724,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2725,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2726,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2727,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2728,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2729,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2730,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2731,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2732,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2733,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2734,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2735,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2736,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2737,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2738,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2739,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2740,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2741,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2742,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2743,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2744,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2745,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2746,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2747,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2748,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2749,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2750,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2751,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2752,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2753,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2754,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2755,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2756,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2757,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2758,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2759,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2760,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2761,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2762,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2763,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2764,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2765,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2766,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2767,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2768,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2769,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2770,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2771,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2772,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2773,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2774,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2775,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2776,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2777,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2778,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2779,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2780,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2781,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2782,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2783,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2784,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2785,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2786,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2787,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2788,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2789,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2790,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2791,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2792,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2793,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2794,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2795,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2796,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2797,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2798,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2799,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2800,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2801,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2802,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2803,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2804,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2805,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2806,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2807,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2808,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2809,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2810,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2811,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2812,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2813,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2814,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2815,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2816,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2817,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2818,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2819,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2820,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2821,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2822,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2823,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2824,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2825,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2826,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2827,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2828,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2829,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2830,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2831,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2832,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2833,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2834,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2835,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2836,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2837,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2838,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2839,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2840,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2841,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2842,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2843,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2844,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2845,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2846,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2847,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2848,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2849,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2850,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2851,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2852,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2853,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2854,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2855,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2856,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2857,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2858,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2859,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2860,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2861,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2862,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2863,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2864,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2865,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2866,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2867,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2868,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2869,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2870,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2871,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2872,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2873,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2874,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2875,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2876,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2877,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2878,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2879,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2880,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2881,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2882,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2883,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2884,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2885,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2886,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2887,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2888,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2889,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2890,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2891,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2892,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2893,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2894,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2895,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2896,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2897,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2898,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2899,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2900,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2901,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2902,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2903,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2904,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2905,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2906,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2907,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2908,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2909,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2910,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2911,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2912,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2913,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2914,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2915,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2916,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2917,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2918,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2919,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2920,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2921,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2922,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2923,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2924,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2925,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2926,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2927,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2928,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2929,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2930,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2931,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2932,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2933,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2934,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2935,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2936,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2937,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2938,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2939,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2940,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2941,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2942,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2943,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2944,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2945,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2946,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2947,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2948,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2949,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2950,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2951,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2952,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2953,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2954,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2955,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2956,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2957,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2958,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2959,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2960,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2961,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2962,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2963,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2964,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2965,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2966,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2967,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2968,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2969,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2970,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2971,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2972,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2973,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2974,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2975,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2976,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2977,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2978,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2979,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2980,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2981,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2982,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2983,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2984,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2985,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2986,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2987,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2988,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2989,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2990,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2991,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2992,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2993,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2994,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2995,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2996,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2997,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2998,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
2999,B,These variables are passed the values of the parameters of the CAM function (1100-1499),Read more about this in the instructions for the CAM function. Also, the values of these variables cannot be changed "manually". Only through the parameters of the CAM function.
`;


// --- parser.js ---
// verification/src/parser.js
// Simple G-code helpers. Keep logic small so bundling remains tiny.
function splitLines(gcode) {
  const lines = String(gcode || '').split(/\r?\n/);
  return lines.map((text, idx) => ({ line: idx + 1, text }));
}

function stripComments(text) {
  // Remove parentheses comments: ( ... ) - used before regex checks
  return text.replace(/\([^)]*\)/g, '').trim();
}


// --- checks.js ---
// verification/src/checks.js
// Rule implementations for DDCS M350 checks. Keep each check pure and
// return an array of offense objects so the caller can aggregate results.
// Note: only POSITIVE sign before a variable is considered invalid (e.g., X+#1). Negative
// forms (X-#1) are common in community macros and are allowed.
const FORBIDDEN_INLINE_RE = /([XYZAB])\+#(\d+)/i;
const HEADER_VERSION_RE = /DDCS M350 V10\.0/;

function checkForbiddenInline(lines) {
  const offenses = [];
  lines.forEach(({ line, text }) => {
    const m = text.match(FORBIDDEN_INLINE_RE);
    if (m) {
      offenses.push({
        ruleId: 'FORBIDDEN_INLINE_POSITIVE_SIGN',
        severity: 'error',
        line,
        match: m[0],
        context: text.trim(),
        suggestion: 'Avoid a positive sign before a variable; use precomputed positive var (e.g., X#8) or negative var (e.g., X#7) as appropriate.'
      });
    }
  });
  return offenses;
}

function checkHeaderVersion(lines) {
  const offenses = [];
  const joined = lines.map(l => l.text).join('\n');
  if (!HEADER_VERSION_RE.test(joined)) {
    offenses.push({
      ruleId: 'HEADER_VERSION',
      severity: 'warning',
      line: 1,
      match: null,
      context: 'Missing `DDCS M350 V10.0` header',
      suggestion: 'Include `( DDCS M350 V10.0 Compliant )` in the header comments'
    });
  }
  return offenses;
}


// --- index.js ---
// verification/src/index.js
// Entry point for the M350 verifier. Exposes a small, synchronous API
// used by tests, CLI, and the bundled standalone verifier.
// Keep this module ESM so it can be imported by build tooling.


function validateGcode(gcode) {
  const rawLines = splitLines(gcode || '');
  // Preprocess: strip comments for syntax checks but keep original text for context
  const strippedLines = rawLines.map(({ line, text }) => ({ line, text: stripComments(text) }));

  const offenses = [];
  offenses.push(...checkForbiddenInline(strippedLines));
  offenses.push(...checkHeaderVersion(rawLines));

  return { passed: offenses.length === 0, offenses };
}

// Convenience: validate and return formatted text report
function formatReport(report) {
  if (report.passed) return 'PASS: No issues found.';
  let out = `FAIL: ${report.offenses.length} issue(s) found:\n`;
  report.offenses.forEach(o => {
    out += ` - [${o.severity}] ${o.ruleId} @ L${o.line}: ${o.context} (${o.suggestion})\n`;
  });
  return out;
}


window["THEMES"] = THEMES;
window["ThemeManager"] = ThemeManager;
window["SNIPPETS"] = SNIPPETS;
window["el"] = el;
window["UIUtils"] = UIUtils;
window["EditorManager"] = EditorManager;
window["SCALE_SEQUENCE"] = SCALE_SEQUENCE;
window["ScaleManager"] = ScaleManager;
window["VarListPanel"] = VarListPanel;
window["CommandDeck"] = CommandDeck;
window["DockManager"] = DockManager;
window["VariableDatabase"] = VariableDatabase;
window["MiddleWizard"] = MiddleWizard;
window["CommunicationWizard"] = CommunicationWizard;
window["WCSWizard"] = WCSWizard;
window["CornerWizard"] = CornerWizard;
window["EdgeWizard"] = EdgeWizard;
window["WizardManager"] = WizardManager;
window["DDCSStudio"] = DDCSStudio;
window["DEFAULT_VAR_CSV"] = DEFAULT_VAR_CSV;
window["DEFAULT_VAR_CSV"] = DEFAULT_VAR_CSV;
window["splitLines"] = splitLines;
window["stripComments"] = stripComments;
window["checkForbiddenInline"] = checkForbiddenInline;
window["checkHeaderVersion"] = checkHeaderVersion;
window["validateGcode"] = validateGcode;
window["formatReport"] = formatReport;
// initialize app (if it attaches to window)
if (typeof window.ddcsStudio === "undefined" && typeof DDCSStudio !== "undefined") { window.ddcsStudio = new DDCSStudio(); }
