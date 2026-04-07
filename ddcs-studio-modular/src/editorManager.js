/**
 * DDCS Studio Editor Manager
 * Handles the main G-code text editor functionality
 */

import { el, UIUtils } from './uiUtils.js';
import { SNIPPETS } from './snippets.js';

export class EditorManager {
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

    clearCode() {
        if (confirm('Clear Editor?')) {
            this.editor.value = '';
            this.editor.dispatchEvent(new Event('input'));
        }
    }

    downloadFile() {
        let code = this.editor.value || '';

        // Use the first non-empty line (normally the descriptive header) for both title and filename
        const firstNonEmpty = code.split(/\r?\n/).find(line => line.trim().length > 0) || '';
        const m = firstNonEmpty.match(/^\s*\(([^)]+)\)\s*$/);
        let title = '';
        if (m) {
            title = m[1].trim();
        } else if (firstNonEmpty.trim().length > 0) {
            // If there is a first line but not wrapped in parentheses, use it directly
            title = firstNonEmpty.trim();
        } else {
            title = 'Program';
        }

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
