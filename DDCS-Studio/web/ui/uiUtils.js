/**
 * DDCS Studio UI Utilities
 * DOM helpers and common UI functions
 */

export const el = (id) => document.getElementById(id);

export class UIUtils {
    static showTooltip(element, content, xOffset = 10) {
        const tooltip = el('global-tooltip');
        if (!tooltip) return;

        const rect = element.getBoundingClientRect();
        const margin = 8;

        // Set content + show first so we can measure the rendered size
        tooltip.textContent = content;
        tooltip.style.display = 'block';
        const tw = tooltip.offsetWidth || 300;
        const th = tooltip.offsetHeight || 60;

        // Horizontal: prefer to the right of the element, flip left if it won't fit
        let left = rect.right + xOffset;
        if (left + tw > window.innerWidth - margin) left = rect.left - tw - xOffset;
        if (left < margin) left = margin;

        // Vertical: align with the element top, but clamp into the viewport so it
        // never runs off the bottom (e.g. chips in the bottom keyboard dock)
        let top = rect.top;
        if (top + th > window.innerHeight - margin) top = window.innerHeight - th - margin;
        if (top < margin) top = margin;

        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
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
        const newPos = start + text.length;
        // Set a tiny visible selection (newPos, newPos + 1) so the caret appears as a block
        const selEnd = Math.min(textArea.value.length, newPos + 1);
        textArea.selectionStart = newPos;
        textArea.selectionEnd = selEnd;
        // NOTE: Do NOT call focus() here — caller decides whether to focus.
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

        // NOTE: code is already HTML-escaped above, so `<`/`>`/`&` are now `&lt;`/`&gt;`/`&amp;`.
        // The `;`-comment alternative must NOT match the `;` that terminates one of those
        // entities (a lookbehind guards it), otherwise `<=`/`>=` get split and read back as `<;=`.
        const formatLine = (line) => line.replace(
            /(\([^\)]*\)|(?<!&(?:lt|gt|amp));[^\n]*)|(\b[Gg]31\b)|([Mm]\d+)|([XYZABxyzab])/g,
            (match, comment, g31, mcode, axis) => {
                if (comment) return `<span class="g-comment">${match}</span>`;
                if (g31) return `<span style="color:#60a5fa; font-weight:bold;">${match}</span>`;
                if (mcode) return `<span style="color:#fca5a5">${match}</span>`;
                if (axis) return `<span style="color:#facc15">${match}</span>`;
                return match;
            }
        );

        return safeCode.split(/\r?\n/).map((line, index) =>
            `<span class="g-line" data-line-index="${index}">${formatLine(line)}</span>`
        ).join('\n');
    }
}
