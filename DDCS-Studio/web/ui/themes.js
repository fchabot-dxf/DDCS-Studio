/**
 * DDCS Studio Theme Engine
 * Contains all theme definitions and theme switching logic
 */

export const THEMES = ['studio', 'normal', 'steampunk', 'futuristic', 'organic'];

export class ThemeManager {
    constructor() {
        this.themes = THEMES;
        // Prefer the theme saved in localStorage; fall back to the page's data-theme, then default.
        let saved = null;
        try { saved = localStorage.getItem('ddcs_theme'); } catch (e) { /* private mode / file:// */ }
        const initial = (saved && this.themes.includes(saved))
            ? saved
            : (document.body ? document.body.getAttribute('data-theme') : null);
        const idx = initial && this.themes.includes(initial) ? this.themes.indexOf(initial) : 0;
        this.currentThemeIndex = idx;
        this.applyTheme(this.themes[this.currentThemeIndex]);
    }

    toggle() {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % this.themes.length;
        this.applyTheme(this.themes[this.currentThemeIndex]);
    }

    setCurrent(themeName) {
        const index = this.themes.indexOf(themeName);
        if (index !== -1) {
            this.currentThemeIndex = index;
            this.applyTheme(themeName);
        }
    }

    getCurrent() {
        return this.themes[this.currentThemeIndex];
    }

    applyTheme(themeName) {
        document.body.setAttribute('data-theme', themeName);
        try { localStorage.setItem('ddcs_theme', themeName); } catch (e) { /* private mode / file:// */ }
        const styleBtn = document.getElementById('styleBtn');
        if (styleBtn) {
            styleBtn.innerHTML = '<span class="op-icon">🎨</span><span class="op-label">' + themeName.toUpperCase() + '</span>';
        }
        // t2125 (SOUND-PLAN.md) — sound follows the visual theme: ui/sound.js reads the live theme fresh
        // at play time (window.ddcsStudio.themeManager.getCurrent()), so no push is needed here. The
        // gateway's own chime is unthemed (SOUND-PLAN.md section 5 — job sounds keep the learned WAVs),
        // so it has no theme to receive either.
    }
}
