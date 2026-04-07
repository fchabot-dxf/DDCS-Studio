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
