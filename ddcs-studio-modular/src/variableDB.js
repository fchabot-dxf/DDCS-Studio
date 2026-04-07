/**
 * DDCS Studio Variable Database Manager
 * Handles DDCS M350 system and user variable catalog
 */

const STORAGE_KEY = 'ddcs_vars_persistent';

export class VariableDatabase {
    constructor() {
        this.activeDB = [];
        // promise that resolves when initial DB load completes; consumers can await this.ready
        this.ready = new Promise((res) => { this._resolveReady = res; });
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

        // If we already have a persisted DB, signal readiness immediately
        if (this.activeDB && this.activeDB.length > 0) {
            // dispatch event and resolve promise asynchronously to avoid reentrancy
            setTimeout(() => {
                try { window.dispatchEvent(new CustomEvent('variableDB:ready', { detail: { count: this.activeDB.length } })); } catch (err) {}
                if (this._resolveReady) { this._resolveReady(this.activeDB); this._resolveReady = null; }
            }, 0);
            return;
        }

        // If no saved DB, try to load default variables generated at build time
        if (!this.activeDB || this.activeDB.length === 0) {
            // dynamic import so missing file won't throw at load time
            import('./default_vars.js').then(async (mod) => {
                if (mod && mod.DEFAULT_VAR_CSV) {
                    try {
                        // Mark build-provided default vars explicitly as system variables
                        this.loadFromCSV(mod.DEFAULT_VAR_CSV, true);
                        console.debug('Loaded default variables from default_vars.js (marked system)');
                    } catch (err) {
                        console.warn('Failed to load default vars from module:', err);
                    }
                }

                // Merge user entries embedded at download time (window.__ddcs_user_vars)
                // This is set synchronously by the __saved_defaults script before modules load,
                // so it is always available here regardless of localStorage state.
                try {
                    const embedded = window.__ddcs_user_vars;
                    if (Array.isArray(embedded) && embedded.length > 0) {
                        const map = new Map(this.activeDB.map(e => [e.i, e]));
                        for (const e of embedded) map.set(e.i, e);
                        this.activeDB = Array.from(map.values());
                        this.saveToStorage();
                        console.debug(`Merged ${embedded.length} embedded user vars over defaults`);
                    }
                } catch (e) { /* ignore */ }

                // Try to load an optional user-provided CSV shipped with the site
                // (e.g. `src/user_vars.csv`). These entries will be merged as user vars.
                try {
                    const res = await fetch('./user_vars.csv');
                    if (res.ok) {
                        const txt = await res.text();
                        if (txt && txt.trim()) {
                            this.loadFromCSV(txt, false, true); // append as user vars
                            console.debug('Merged user_vars.csv into database (user entries)');
                        }
                    }
                } catch (e) {
                    // ignore missing/failed fetch silently
                }

            }).catch(async () => {
                // No default_vars.js present — still try to load user_vars.csv if available
                try {
                    const res = await fetch('./user_vars.csv');
                    if (res.ok) {
                        const txt = await res.text();
                        if (txt && txt.trim()) {
                            this.loadFromCSV(txt, false, false);
                            console.debug('Loaded user_vars.csv as initial DB');
                        }
                    }
                } catch (e) {
                    // ignore
                }
            }).finally(() => {
                // notify consumers that initial DB loading finished (whether it populated or not)
                try { window.dispatchEvent(new CustomEvent('variableDB:ready', { detail: { count: this.activeDB.length } })); } catch (err) {}
                if (this._resolveReady) { this._resolveReady(this.activeDB); this._resolveReady = null; }
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

    loadFromCSV(fileContent, forceSystem = null, append = false) {
        const lines = fileContent.split(/\r?\n/);
        const parsed = [];

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

            // If forceSystem is provided, honor it. Otherwise infer from description presence.
            let isSystem = (forceSystem === true) ? true
                         : (forceSystem === false) ? false
                         : (desc.length > 0);

            if (id.startsWith('#')) {
                parsed.push({
                    i: id,
                    t: type,
                    d: desc,
                    n: notes,
                    isSys: isSystem
                });
            }
        });

        // Merge or replace depending on `append`
        // Always merge — imported entries override existing entries with the same ID
        // but system variables not present in the imported file are preserved
        if (this.activeDB && this.activeDB.length > 0 && !append) {
            const map = new Map(this.activeDB.map(e => [e.i, e]));
            for (const e of parsed) map.set(e.i, e);
            this.activeDB = Array.from(map.values());
        } else if (append && this.activeDB && this.activeDB.length > 0) {
            const map = new Map(this.activeDB.map(e => [e.i, e]));
            for (const e of parsed) map.set(e.i, e);
            this.activeDB = Array.from(map.values());
        } else {
            this.activeDB = parsed;
        }

        this.saveToStorage();
        return parsed;
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

    exportCSV() {
        const lines = this.activeDB.map(e => {
            const id = e.i.replace(/^#/, '');
            const t = (e.t || '').replace(/"/g, '""');
            const d = (e.d || '').replace(/"/g, '""');
            const n = (e.n || '').replace(/"/g, '""');
            return `${id},"${t}","${d}","${n}"`;
        });
        return lines.join('\n');
    }
}
