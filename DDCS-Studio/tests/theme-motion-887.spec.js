import { test, expect } from '@playwright/test';

/**
 * t887 — THEME MOTION PERSONALITIES (backlog item 15). Every theme declares a COMPLETE, DISTINCT drawer-motion
 * personality from pure data (styles.css --drawer-* token block); the ONE accordion engine (paneAccordion.js) reads it.
 * Each token value has a real effect — NO silent no-ops: reveal (slide|fade|roll|wipe|unfold all implemented), dir (4-way,
 * drives the fold origin + slide/fade/wipe axis so every reveal consumes it), easing (keyword → curve via mapEase). The
 * engine caps duration ≤350ms + goes instant under prefers-reduced-motion. View-only; no emit path touched.
 */
test.use({ viewport: { width: 1300, height: 950 } });

const THEMES = ['studio', 'normal', 'steampunk', 'futuristic', 'organic'];
const TOKENS = ['--drawer-dur', '--drawer-ease', '--drawer-reveal', '--drawer-dir', '--drawer-corner-expanded', '--drawer-corner-collapsed'];

test('every theme declares a COMPLETE (6-token) and DISTINCT motion personality (no two identical)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
    const r = await page.evaluate(([THEMES, TOKENS]) => {
        const out = {};
        for (const th of THEMES) {
            document.body.setAttribute('data-theme', th);
            const cs = getComputedStyle(document.body);
            out[th] = TOKENS.map((t) => cs.getPropertyValue(t).trim());
        }
        return out;
    }, [THEMES, TOKENS]);
    for (const th of THEMES) {
        expect(r[th].every((v) => v !== ''), `${th}: all 6 tokens declared (complete)`).toBe(true);
    }
    const sigs = THEMES.map((th) => r[th].join('|'));
    expect(new Set(sigs).size, 'all 5 personalities are distinct (no two identical blocks)').toBe(5);
    // and each declares a DISTINCT reveal (the 5-reveal vocabulary, one per theme)
    const reveals = THEMES.map((th) => r[th][2]);
    expect(new Set(reveals).size, 'each theme uses a distinct reveal (slide/fade/roll/wipe/unfold)').toBe(5);
});

test('NO SILENT NO-OPS: every theme\'s declared reveal, dir, and easing produces a real effect', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
    const r = await page.evaluate(async ([THEMES]) => {
        const { mapEase } = await import('/ui/paneAccordion.js');
        const motionOf = (reveal, dir) => {
            const wrap = document.createElement('div');
            wrap.setAttribute('data-collapsed', '1'); wrap.setAttribute('data-reveal', reveal); wrap.setAttribute('data-dir', dir);
            const body = document.createElement('div'); body.className = 'wiz-pane-body'; body.style.height = '40px';
            wrap.appendChild(body); document.body.appendChild(wrap);
            const cs = getComputedStyle(body);
            const m = { transform: cs.transform, opacity: cs.opacity, clip: cs.clipPath || cs.webkitClipPath || 'none', origin: cs.transformOrigin };
            wrap.remove();
            return m;
        };
        const ALT = { up: 'right', down: 'left', left: 'up', right: 'down' };
        const res = {};
        for (const th of THEMES) {
            document.body.setAttribute('data-theme', th);
            const cs = getComputedStyle(document.body);
            const reveal = cs.getPropertyValue('--drawer-reveal').trim(), dir = cs.getPropertyValue('--drawer-dir').trim(), ease = cs.getPropertyValue('--drawer-ease').trim();
            const m = motionOf(reveal, dir);
            const mAlt = motionOf(reveal, ALT[dir] || 'up');
            const revealEffect = (m.transform && m.transform !== 'none') || (parseFloat(m.opacity) < 1) || (m.clip && m.clip !== 'none' && m.clip !== 'auto');
            const dirEffect = (m.transform !== mAlt.transform) || (m.clip !== mAlt.clip) || (m.origin !== mAlt.origin);   // changing dir changes the motion → dir is consumed
            const mapped = mapEase(ease);
            const easeEffect = mapped === 'linear' || /^cubic-bezier/.test(mapped);   // the keyword resolves to a valid curve (not an invalid timing-function that would no-op)
            res[th] = { reveal, dir, ease, revealEffect, dirEffect, easeEffect, mapped };
        }
        return res;
    }, [THEMES]);
    for (const th of THEMES) {
        expect(r[th].revealEffect, `${th}: reveal '${r[th].reveal}' produces a motion (transform/opacity/clip)`).toBe(true);
        expect(r[th].dirEffect, `${th}: dir '${r[th].dir}' changes the motion (consumed, not a no-op)`).toBe(true);
        expect(r[th].easeEffect, `${th}: easing '${r[th].ease}' maps to a real curve (${r[th].mapped})`).toBe(true);
    }
});

test('the engine caps duration ≤350ms and goes INSTANT (0ms) under prefers-reduced-motion', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
    // duration cap: a theme declaring an over-cap duration is clamped to 350
    const capped = await page.evaluate(async () => {
        const { motionTokens } = await import('/ui/paneAccordion.js');
        document.body.style.setProperty('--drawer-dur', '9999ms');
        const d = motionTokens().dur;
        document.body.style.removeProperty('--drawer-dur');
        return d;
    });
    expect(capped, 'a 9999ms declaration is capped to 350ms').toBe(350);
    // reduced-motion: applyState writes 0ms for the effective duration (instant)
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const durEff = await page.evaluate(async () => {
        const { applyState } = await import('/ui/paneAccordion.js');
        const pane = document.createElement('div'); const body = document.createElement('div'); body.className = 'wiz-pane-body';
        pane.appendChild(body); document.body.appendChild(pane);
        applyState(pane, true, true);   // collapse, animate=true — but reduced-motion forces instant
        const v = pane.style.getPropertyValue('--drawer-dur-eff');
        pane.remove();
        return v;
    });
    expect(durEff, 'under reduced-motion the effective duration is 0ms (instant)').toBe('0ms');
    await page.emulateMedia({ reducedMotion: null });
});

test('screenshots per theme: the collapsed reveal shows each theme\'s distinct personality', async ({ page }, testInfo) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
    for (const th of THEMES) {
        await page.evaluate((th) => {
            document.body.setAttribute('data-theme', th);
            document.querySelectorAll('.__mdemo').forEach((n) => n.remove());
            const cs = getComputedStyle(document.body);
            const reveal = cs.getPropertyValue('--drawer-reveal').trim(), dir = cs.getPropertyValue('--drawer-dir').trim();
            const host = document.createElement('div'); host.className = '__memo __mdemo'; host.style.cssText = 'position:fixed;left:20px;top:20px;width:360px;z-index:99999;padding:20px;background:var(--bg,#0d1117)';
            // an expanded pane + a mid-collapse pane (the reveal transform frozen at ~half) side by side
            const mk = (collapsed) => `<div data-collapsed="${collapsed}" data-reveal="${reveal}" data-dir="${dir}" style="margin:8px 0;border-radius:var(--drawer-corner-${collapsed ? 'collapsed' : 'expanded'},6px);overflow:hidden;background:var(--panel,#1a2230)"><div class="wiz-pane-body" style="height:${collapsed ? 40 : 60}px;padding:10px;color:var(--text-main,#cdd)">${reveal} · ${dir}</div></div>`;
            host.innerHTML = `<div style="color:var(--text-main,#cdd);font:600 13px system-ui;margin-bottom:6px">${th}</div>` + mk('0') + mk('1');
            document.body.appendChild(host);
        }, th);
        await page.locator('.__mdemo').screenshot({ path: testInfo.outputPath(`t887-motion-${th}.png`) });
    }
    await page.evaluate(() => document.querySelectorAll('.__mdemo').forEach((n) => n.remove()));
});
