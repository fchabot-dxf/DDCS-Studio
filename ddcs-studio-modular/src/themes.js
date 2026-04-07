/**
 * DDCS Studio Theme Engine
 * Contains all theme definitions and theme switching logic
 */

export const THEMES = ['ddcs', 'normal', 'steampunk', 'futuristic', 'organic'];

export class ThemeManager {
    constructor() {
        this.themes = THEMES;
        const initial = document.body ? document.body.getAttribute('data-theme') : null;
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
        const styleBtn = document.getElementById('styleBtn');
        if (styleBtn) {
            styleBtn.innerText = '🎨 ' + themeName.toUpperCase();
        }
    }
}
