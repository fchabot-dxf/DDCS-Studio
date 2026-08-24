#!/usr/bin/env node
/**
 * scripts/organic-border-audit.mjs — t2233 amendment 2: a MECHANICAL, RE-RUNNABLE sweep for organic's
 * "nothing is drawing this" defect (a border-only control losing its shape once --border goes
 * transparent — the settings-tab / macros-shelf / text-field / FAQ-accordion / dropdown shape, found
 * one sighting at a time so far, each by a human meeting it cold rather than by a check that can't miss).
 *
 * DECLARED PROPERTY (checkable without judgement, per the dispatch): among INTERACTIVE elements (native
 * button/input/select/textarea/summary/a[href], or anything carrying onclick/role=button|tab|menuitem/
 * a real tabindex — every named sighting so far is one of these, never a plain layout wrapper), one
 * whose border is GONE (every side either 0-width or a transparent colour) AND whose effective
 * background colour equals its nearest painted ancestor's — i.e. nothing distinguishes it from its
 * surroundings. Restricting to interactive elements is itself mechanical (DOM-queryable), not a
 * judgement call: a plain <span> inheriting its parent's colour is normal; a CLICKABLE thing that reads
 * as inert is the actual defect. An earlier version swept every element and returned ~2900 ordinary
 * wrappers as false positives — ordinary DOM structure, not signal.
 *
 * BLIND SPOTS, stated rather than pretended away (per the dispatch's own instruction to name them):
 *   - Catches ZERO-contrast only. A technically-nonzero-but-too-low fill (the 1.04:1 tab that started
 *     this whole thread) would PASS this check, since its two colours differ.
 *   - Cannot see a fill that is PRESENT but WRONG (e.g. the wrong theme token).
 *   - Cannot judge an active-vs-resting distinction collapsing (two states rendering identically).
 *   - Only sees elements that ARE interactive per the DOM (a div styled to look clickable but missing a
 *     role/tabindex/onclick would slip through) — a real, separate defect this script does not chase.
 * Run alongside human judgement, not instead of it — this finds the exhaustive "nothing at all" cases;
 * everything else still wants an eye on it.
 *
 * Run: node scripts/organic-border-audit.mjs
 * Spawns its own mem-server on a dedicated port (does not disturb one already running on 3211).
 * Screenshots land in scratchpad/organic-audit-<surface>.png; full JSON findings print to stdout.
 */
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3298;
const ROOT = path.resolve(__dirname, '..');
const SCRATCH = path.join(ROOT, 'scratchpad');
if (!fs.existsSync(SCRATCH)) fs.mkdirSync(SCRATCH, { recursive: true });

function auditInPage() {
    const effectiveBg = (el) => {
        let node = el;
        while (node) {
            const bg = getComputedStyle(node).backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
            node = node.parentElement;
        }
        return 'rgba(0, 0, 0, 0)';
    };
    const borderGone = (cs) => {
        const sides = [
            [cs.borderTopWidth, cs.borderTopColor], [cs.borderRightWidth, cs.borderRightColor],
            [cs.borderBottomWidth, cs.borderBottomColor], [cs.borderLeftWidth, cs.borderLeftColor],
        ];
        return sides.every(([w, c]) => w === '0px' || c === 'rgba(0, 0, 0, 0)');
    };
    // t2233 amendment 2 v2 — restricted to genuinely INTERACTIVE surfaces (native interactive tags, or an
    // explicit onclick/role=button/tabindex), not every layout wrapper. A plain <span> inheriting its
    // parent's background is completely normal; a CLICKABLE thing that reads as inert is the actual defect
    // every named sighting shares (settings-tab is a real <button>; the gear is a <span onclick>). The first
    // version of this script swept every element and returned ~2900 ordinary wrappers — noise, not signal.
    const isInteractive = (el) => {
        const tag = el.tagName.toLowerCase();
        if (['button', 'select', 'textarea', 'summary'].includes(tag)) return true;
        if (tag === 'input' && el.type !== 'hidden') return true;
        if (tag === 'a' && el.hasAttribute('href')) return true;
        if (el.hasAttribute('onclick')) return true;
        const role = el.getAttribute('role');
        if (role === 'button' || role === 'tab' || role === 'menuitem') return true;
        if (el.hasAttribute('tabindex') && el.getAttribute('tabindex') !== '-1') return true;
        return false;
    };
    const results = [];
    const all = document.querySelectorAll('body *');
    for (const el of all) {
        if (!isInteractive(el)) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 4) continue;
        if (rect.bottom < 0 || rect.right < 0 || rect.top > innerHeight || rect.left > innerWidth) continue;
        if (!borderGone(cs)) continue;
        if (!el.parentElement) continue;
        const own = effectiveBg(el);
        const ancestorBg = effectiveBg(el.parentElement);
        if (own === ancestorBg) {
            results.push({
                tag: el.tagName.toLowerCase(),
                id: el.id || null,
                cls: (el.className && typeof el.className === 'string') ? el.className : null,
                text: (el.textContent || '').trim().slice(0, 50),
                bg: own,
                rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
            });
        }
    }
    return results;
}

async function main() {
    const server = spawn(process.execPath, ['tests/support/mem-server.cjs', String(PORT)], { cwd: ROOT, stdio: 'pipe' });
    await new Promise((resolve, reject) => {
        let done = false;
        server.stdout.on('data', (d) => { if (!done && String(d).includes('listening')) { done = true; resolve(); } });
        server.on('error', reject);
        setTimeout(() => { if (!done) reject(new Error('mem-server did not report listening within 5s')); }, 5000);
    });

    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const findings = {};

    const audit = async (label) => {
        await page.evaluate(() => document.body.setAttribute('data-theme', 'organic'));
        await page.waitForTimeout(250);
        const r = await page.evaluate(auditInPage);
        findings[label] = r;
        await page.screenshot({ path: path.join(SCRATCH, `organic-audit-${label.replace(/[^a-z0-9]+/gi, '_')}.png`) });
        console.log(`${label}: ${r.length} candidate(s)`);
    };

    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 30000 });
    await audit('studio-tab');

    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    await page.waitForTimeout(600);
    await audit('blocks-tab');

    await page.evaluate(() => window.showApp && window.showApp('macros'));
    await page.waitForTimeout(600);
    await audit('macros-tab');

    await page.evaluate(() => window.showApp && window.showApp('gateway'));
    await page.waitForTimeout(600);
    await audit('gateway-tab');

    await page.evaluate(() => window.showApp && window.showApp('studio'));
    await page.waitForTimeout(300);

    // wizard bar dropdown (dock) — open the first toolbar-dropdown trigger found
    const openedDropdown = await page.evaluate(() => {
        const btn = document.querySelector('.dock-header .toolbar-dropdown > button');
        if (btn) { btn.click(); return true; }
        return false;
    });
    if (openedDropdown) { await page.waitForTimeout(300); await audit('wizard-bar-dropdown'); }
    else console.log('wizard-bar-dropdown: no trigger found on this route (skipped)');

    // settings — default + every sub-tab via the declared deep-link seam
    await page.evaluate(() => window.openSettings && window.openSettings());
    await page.waitForTimeout(400);
    await audit('settings-default');

    const subtabs = ['set_tab_profile', 'set_tab_appearance', 'set_tab_preview', 'set_tab_compose', 'set_tab_sound',
        'set_tab_variables', 'set_tab_program', 'set_tab_gateway', 'set_tab_machine', 'set_tab_wcs', 'set_tab_spindle',
        'set_tab_input', 'set_tab_output', 'set_tab_atc', 'set_tab_workspace'];
    for (const t of subtabs) {
        const ok = await page.evaluate((panel) => {
            if (typeof window.openSettings !== 'function') return false;
            window.openSettings({ panel });
            return !!document.getElementById(panel);
        }, t);
        if (ok) { await page.waitForTimeout(250); await audit(`settings-${t}`); }
    }

    await browser.close();
    server.kill();

    const totalCandidates = Object.values(findings).reduce((n, arr) => n + arr.length, 0);
    console.log(`\n=== TOTAL CANDIDATES ACROSS ${Object.keys(findings).length} SURFACES: ${totalCandidates} ===`);
    fs.writeFileSync(path.join(SCRATCH, 'organic-audit-findings.json'), JSON.stringify(findings, null, 2));
    console.log('Full JSON written to scratchpad/organic-audit-findings.json');
}

main().catch((e) => { console.error(e); process.exit(1); });
