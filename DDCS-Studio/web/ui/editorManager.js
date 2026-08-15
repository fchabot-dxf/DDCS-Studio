/**
 * DDCS Studio Editor Manager
 * Handles the main G-code text editor functionality
 */

import { el, UIUtils } from './uiUtils.js';
import { SNIPPETS } from '../data/snippets.js';
import { opLabelOf } from '../blocks/opBuilders.js';   // t975 — derive a clean export title from the op model (fixes g90_absolute.nc)
import { confirmDestructiveLoad } from '../blocks/saveStates.js';   // t1938 — the ONE destructive-load seam Clear routes through

export class EditorManager {
    constructor() {
        this.editor = el('editor');
        this.highlight = el('editor-highlight');
        this.activeLineIndex = null;
        this._execTrail = [];          // ring of recent line indices, newest-first, max EXEC_TRAIL_CAP entries
        this._activeLineSubs = new Set();   // t865 — the follow-exec toggle subscribes here so its auto-scroll reads the SAME activeLineIndex the in-text highlight consumes (one source; outlived the minimap)
        this.backTimer = null;
        this.backInterval = null;

        this.setupSync();
        this.setupBackspaceButton();
        this.setupSpacebarButton();
    }

    setupSync() {
        if (!this.editor || !this.highlight) return;

        // Line-number gutter (dark grey, left), scroll-synced with the editor.
        this.gutter = el('editor-gutter');
        if (!this.gutter && this.editor.parentElement) {
            this.gutter = document.createElement('div');
            this.gutter.id = 'editor-gutter';
            this.gutter.setAttribute('aria-hidden', 'true');
            this.editor.parentElement.insertBefore(this.gutter, this.editor);
        }

        const syncText = () => {
            let code = this.editor.value;
            // Critical: Add space if ends in newline to prevent cursor disappearance
            if (code.endsWith('\n')) code += ' ';
            // .g-line is display:block, so drop formatGCode's inter-line "\n" — otherwise each
            // line breaks twice (block + newline) and the highlight no longer aligns with the
            // single-spaced textarea (the click→cursor mapping drifts).
            this.highlight.innerHTML = UIUtils.formatGCode(code).replace(/\n/g, '');
            this._updateGutter();
            this._restoreActiveLine();
        };

        const syncScroll = () => {
            this.highlight.scrollTop = this.editor.scrollTop;
            this.highlight.scrollLeft = this.editor.scrollLeft;
            if (this.gutter) this.gutter.scrollTop = this.editor.scrollTop;
        };

        this.editor.addEventListener('input', syncText);
        this.editor.addEventListener('scroll', syncScroll);

        // Initial sync
        syncText();
    }

    _updateGutter() {
        if (!this.gutter) return;
        const n = Math.max(1, this.editor.value.split('\n').length);
        this.gutter.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n');
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
            const newPos = this.editor.selectionStart;
            this.editor.setSelectionRange(newPos, Math.min(this.editor.value.length, newPos + 1));
        } else if (pos > 0) {
            this.editor.setRangeText('', pos - 1, pos, 'end');
            const newPos = pos - 1;
            this.editor.setSelectionRange(newPos, Math.min(this.editor.value.length, newPos + 1));
        } else {
            // keep a tiny visible selection at the document start
            this.editor.setSelectionRange(0, Math.min(this.editor.value.length, 1));
        }
        this.editor.dispatchEvent(new Event('input'));
        // IMPORTANT: do NOT call focus() here — keep virtual keyboard suppressed
    }

    setupSpacebarButton() {
        const btnSpace = el('btn-spacebar');
        if (!btnSpace) return;

        const insertSpace = () => {
            UIUtils.insertAtCursor(this.editor, ' ');
            this.editor.dispatchEvent(new Event('input'));
            // Do NOT focus the editor after inserting — keep keyboard hidden
        };

        btnSpace.addEventListener('click', insertSpace);
    }

    insert(key, text = null) {
        const val = text || SNIPPETS[key] || key;
        UIUtils.insertAtCursor(this.editor, val);
        // Keep highlight & scroll state updated
        this.editor.dispatchEvent(new Event('input'));

        // If virtual keyboard is active on mobile, center the insertion line
        if (document.body.classList.contains('keyboard-active')) {
            try {
                const pos = this.editor.selectionStart;
                const before = this.editor.value.slice(0, pos);
                const lineIndex = Math.max(0, before.split('\n').length - 1);
                const cs = getComputedStyle(this.editor);
                // Compute pixel line-height (fallback to fontSize*1.6 when needed)
                let lineHeight = parseFloat(cs.lineHeight);
                if (isNaN(lineHeight)) {
                    const fs = parseFloat(cs.fontSize) || 14;
                    lineHeight = fs * 1.6;
                }
                const paddingTop = parseFloat(cs.paddingTop) || 0;
                // Target scroll so the line is vertically centered inside the 60px strip
                const target = Math.max(0, Math.round(lineIndex * lineHeight + paddingTop - (60 - lineHeight) / 2));
                this.editor.scrollTop = target;
            } catch (err) { /* noop */ }
        }
    }

    copyCode() {
        this.editor.select();
        document.execCommand('copy');
    }

    // t1938 — routes through the ONE destructive-load seam (saveStates.js) before wiping: Cancel leaves the
    // editor and the program model both untouched. The editor is just a VIEW of the block-program model
    // (blocks/programModel.js) — blanking the text alone leaves the model behind it holding the old program,
    // which then re-projects on blur, so the model is wiped too (not just the text) once the user confirms.
    async clearCode() {
        const proceed = await confirmDestructiveLoad([], {
            what: 'a blank canvas', label: 'before clear',
            message: `Clearing replaces your current program with a blank canvas — it's saved to Undo, or Cancel to keep it.`,
            title: 'Clear the canvas?', okLabel: 'Clear',
        });
        if (!proceed) return;
        this.editor.value = '';
        if (window.ddcsLoadBlockStack) window.ddcsLoadBlockStack([]);
        this.editor.dispatchEvent(new Event('input'));
    }

    // Shared by EXPORT (downloadFile) and TRANSFER (bridgeTransfer.js) so the file on the controller
    // is byte-identical to the download — same (Title) line, same sanitized <name>.nc.
    // t975 — a clean export title from the program MODEL: the first op's friendly label (+ its W×H area when it has
    // one). Gated on the model MATCHING the editor text (proj.text === code) so a hand-edited program never gets a
    // stale name. Returns '' when there's no matching model / no op → the caller falls back to the raw first line.
    _firstOpTitle(code) {
        try {
            const proj = window.ddcsGetProjection && window.ddcsGetProjection();
            if (!proj || proj.text !== code) return '';
            const prog = (window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || [];
            const op = prog.find((b) => b && b.type === 'op' && b.opType);
            if (!op) return '';
            let name = String(opLabelOf(op.opType) || '').replace(/\s*\([^)]*\)/g, '').trim();   // "Surfacing (data)" → "Surfacing"
            if (!name) return '';
            const p = op.params || {};
            const w = Number(p.w), h = Number(p.h);
            if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) name += ` ${Math.round(w)}x${Math.round(h)}`;
            return name;
        } catch (_) { return ''; }
    }

    buildProgram() {
        let code = this.editor.value || '';

        // Use the first non-empty line (normally the descriptive header) for both title and filename
        const firstNonEmpty = code.split(/\r?\n/).find(line => line.trim().length > 0) || '';
        const m = firstNonEmpty.match(/^\s*\(([^)]+)\)\s*$/);
        let title = '';
        if (m) {
            // The user's OWN header comment wins (an explicit ( My Program ) line).
            title = m[1].trim();
        } else {
            // t975 — no explicit ( title ) header. Derive a clean name from the program MODEL (the first op's
            // friendly label + its area, e.g. "Surfacing 367x45") so a generated program exports as
            // "surfacing_367x45.nc" instead of the junk "g90_absolute.nc" — mill ops lead with `G90 ( absolute )`,
            // which the old raw-line fallback used verbatim. Falls back to the raw first line when there's no
            // matching model (hand-edited / raw paste).
            const modelTitle = this._firstOpTitle(code);
            if (modelTitle) title = modelTitle;
            else if (firstNonEmpty.trim().length > 0) title = firstNonEmpty.trim();
            else title = 'Program';
        }

        // A G-code comment cannot contain parentheses — DDCS flags a nested ( … ( … ) ) as
        // "Unrecognized characters:L1[]" and refuses the line. The title is wrapped in (…) below and
        // may have been taken from a raw code line like `G90 ( absolute )`, so strip any parens first.
        title = title.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim() || 'Program';

        // Body: emit self-describing op markers ( @DDCS:1 {…} ) when the editor matches the model (a clean,
        // model-tracked program). If it's been hand-edited beyond the model, export the raw text as-is.
        const _proj = window.ddcsGetProjection && window.ddcsGetProjection();
        if (window.ddcsSerializeWithMarkers && _proj && code === _proj.text) code = window.ddcsSerializeWithMarkers();

        // Ensure first line of the exported code contains the title as a comment
        const titleLine = `(${title})`;
        const lines = code.split(/\r?\n/);
        if (lines.length === 0 || lines[0].trim() !== titleLine) {
            // Prepend title line and ensure a blank line after for readability
            code = titleLine + '\n' + code + '\n';
        }

        // Derive filename from title; fall back to O1000 if empty after sanitization
        let sanitized = title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        sanitized = sanitized.replace(/^_+|_+$/g, '').slice(0, 60);
        const outName = sanitized.length > 0 ? sanitized : 'program';

        return { name: `${outName}.nc`, code };
    }

    /**
     * EXPORT THE PROGRAM — a DEPLOY, not a save (t1249). The .nc is baked output that a controller eats, so it goes to
     * the granted deploy target (typically the USB stick itself) rather than into Downloads, where the user would then
     * have to find it and copy it by hand. The download survives only where File System Access does not exist.
     */
    async downloadFile() {
        const { name, code } = this.buildProgram();
        const D = await import('../data/deployFolder.js');
        const r = await D.deployFiles([{ name, data: code }], {
            fallbackDownload: (files) => files.forEach((f) => UIUtils.downloadFile(f.name, f.data)),
        });
        const { dlgNotice } = await import('./dialog.js');
        if (r.aborted) return r;   // declined the picker → nothing written, nothing downloaded, nothing to announce
        dlgNotice(D.deployedMessage(r));
        return r;
    }

    getValue() {
        return this.editor.value;
    }

    setValue(value) {
        this.editor.value = value;
        this.editor.dispatchEvent(new Event('input'));
    }

    // EXEC-LINE-VISIBILITY: max trail depth (age-1 is freshest, age-EXEC_TRAIL_CAP is oldest/dimmest)
    static get EXEC_TRAIL_CAP() { return 5; }

    setActiveLine(lineIndex) {
        if (!this.highlight) return;

        // --- clear previous active class ---
        const previous = this.highlight.querySelector('.g-line.active-line');
        if (previous) previous.classList.remove('active-line');

        if (lineIndex == null || lineIndex < 0) {
            this.activeLineIndex = null;
            this._execTrail = [];
            this._applyTrail();
            this._notifyActiveLine();
            return;
        }

        // --- push outgoing active into the trail ring ---
        if (this.activeLineIndex != null && this.activeLineIndex !== lineIndex) {
            this._execTrail.unshift(this.activeLineIndex);
            if (this._execTrail.length > EditorManager.EXEC_TRAIL_CAP) {
                this._execTrail.length = EditorManager.EXEC_TRAIL_CAP;
            }
        }

        // --- apply trail depth tags ---
        this._applyTrail();

        // --- mark new active line ---
        const next = this.highlight.querySelector(`.g-line[data-line-index="${lineIndex}"]`);
        if (next) next.classList.add('active-line');
        this.activeLineIndex = lineIndex;
        // No _scrollToLine: the editor must not jump while playing (unified with the wizard CODE PREVIEW —
        // the pulsing highlight tracks the line in place instead of scrolling the text).
        this._notifyActiveLine();
    }

    // t865 — subscribe to executing-line changes (the follow-exec auto-scroll + the preview progress bar consume this).
    // Fires with the CURRENT activeLineIndex (null when idle) in the SAME call that (un)marks the in-text highlight, so a
    // subscriber's view + the text highlight are one source. The seam outlived the minimap that first defined it.
    onActiveLine(cb) { if (typeof cb === 'function') this._activeLineSubs.add(cb); return () => this._activeLineSubs.delete(cb); }
    _notifyActiveLine() { for (const cb of this._activeLineSubs) { try { cb(this.activeLineIndex); } catch (_) { /* a bad subscriber never breaks playback */ } } }

    // Tag trail lines with data-exec-age="1..CAP" (1 = most-recently-left, CAP = oldest/dimmest).
    // Strips stale exec-age from any lines that have aged out of the ring.
    _applyTrail() {
        if (!this.highlight) return;
        // clear all existing trail tags first
        this.highlight.querySelectorAll('.g-line[data-exec-age]').forEach(el => el.removeAttribute('data-exec-age'));
        this._execTrail.forEach((idx, i) => {
            const el = this.highlight.querySelector(`.g-line[data-line-index="${idx}"]`);
            if (el) el.setAttribute('data-exec-age', i + 1);
        });
    }

    clearActiveLine() {
        this.setActiveLine(null);
    }

    // SLICE 2 (WCS VISIBLE): a momentary glow on a code line when its WCS/start call fires in the sim timeline. `kind`
    // ('wcs' / 'start') tints it; the CSS keyframe fades it out; the class is stripped after so the SAME line can
    // re-fire on a later pass. Reuses the #editor-highlight .g-line[data-line-index] overlay (same as setActiveLine).
    flashLine(lineIndex, kind) {
        if (!this.highlight || lineIndex == null) return;
        const el = this.highlight.querySelector(`.g-line[data-line-index="${lineIndex}"]`);
        if (!el) return;
        const tint = kind === 'start' ? 'flash-start' : 'flash-wcs';
        el.classList.remove('flash-event', 'flash-wcs', 'flash-start');
        void el.offsetWidth;                          // restart the CSS animation if the same line re-fires
        el.classList.add('flash-event', tint);
        clearTimeout(el._flashT);
        el._flashT = setTimeout(() => el.classList.remove('flash-event', 'flash-wcs', 'flash-start'), 750);
    }

    _restoreActiveLine() {
        if (this.activeLineIndex == null) return;
        const next = this.highlight.querySelector(`.g-line[data-line-index="${this.activeLineIndex}"]`);
        if (next) next.classList.add('active-line');
        this._applyTrail();
    }

    // PUBLIC jump-to-line (t838 pre-flight): scroll a 1-BASED source line into view + flash it (a violation row-click).
    // Reuses the existing _scrollToLine (0-based) + flashLine glow — the "editor scroll exists" the feature relies on.
    revealLine(line1Based) {
        const idx = Math.max(0, (line1Based | 0) - 1);
        this._scrollToLine(idx);
        this.flashLine(idx, 'event');
    }

    _scrollToLine(index) {
        if (!this.editor) return;
        const cs = getComputedStyle(this.editor);
        let lineHeight = parseFloat(cs.lineHeight);
        if (Number.isNaN(lineHeight) || lineHeight <= 0) {
            lineHeight = parseFloat(cs.fontSize) * 1.6 || 22;
        }
        const target = Math.max(0, Math.round(index * lineHeight - (this.editor.clientHeight / 2)));
        this.editor.scrollTop = target;
    }
}

