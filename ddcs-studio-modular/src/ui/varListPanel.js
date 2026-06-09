import { el, UIUtils } from './uiUtils.js';

export class VarListPanel {
    constructor(variableDB, editorManager, onSearchChange = null) {
        this.variableDB = variableDB;
        this.editorManager = editorManager;
        this.onSearchChange = onSearchChange;

        this.sidebar = el('sidebar');
        this.searchInput = el('search');
        this.clearBtn = el('clearBtn');
        this.csvInput = el('csvInput');
        this.csvExportBtn = el('csvExportBtn');
        this.varList = el('varList');
        this.dbStatus = el('dbStatus');

        this.setupEventListeners();
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

        // horizontal wheel scrolling: convert vertical wheel into scrollLeft
        if (this.varList) {
            this.varList.addEventListener('wheel', (e) => {
                // only act on vertical movement; let native horizontal delta pass through
                if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                    this.varList.scrollLeft += e.deltaY;
                    // mark handled so parent containers don't also scroll
                    e.preventDefault();
                }
            }, { passive: false });
        }

        if (this.csvExportBtn) {
            this.csvExportBtn.addEventListener('click', () => {
                const csv = this.variableDB.exportCSV();
                UIUtils.downloadFile('ddcs_variables.csv', csv);
            });
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
        this.renderResults(all);
        if (this.dbStatus) {
            this.dbStatus.innerText = all.length > 0 ? `SAVED: ${all.length} VARS` : 'NO DB LOADED';
        }
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

            div.innerHTML = `<div class="var-id">${v.i}</div><div class="var-desc">${v.d || 'User Variable'}</div>`;
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
