import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

/**
 * t1267 — THE LATHE MODEL. Declarations only; the wizards arrive in turn 2 as READERS of this.
 *
 * The user's pinned scope: a DDCS has no lathe mode — one controller, one G-code set. So "lathe" is a fact about the
 * machine the user BUILT, declared on the workspace record, and nothing may infer it. Z0 is the finished face, the UI
 * speaks DIAMETER and the emit writes RADIUS, and the view is a 2D half-profile.
 *
 * These tests assert the VALUES of each declaration rather than that a module exists, because the failure mode this
 * model is guarding against is silent: a second diameter-halving, or a bar mapped onto the wrong axis, produces
 * plausible-looking numbers and a wrong part.
 */
test.use({ viewport: { width: 1280, height: 900 } });
const web = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'web');

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    // t1279 — wait for the DECLARED settled signal, not for a global that appears mid-boot. `window.ddcsStudio` is up
    // long before the header quick-menu is wired (it comes from a deferred dynamic import), so under parallel load a
    // click on #hdrPostBtn was landing on a button with no handler and being swallowed — the menu never opened and the
    // assertion timed out waiting for a menu nothing had asked to open. This is the boot-quiescence rule: assert on
    // the signal that says the app is READY, never on a proxy that happens to appear early.
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1'
        && window.ddcsStudio && window.ddcsSetMachine, null, { timeout: 20000 });
};

test('(1) THE KIND is on the machine record, defaults to mill, and ROUND-TRIPS the .ddcs', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const M = await import('/data/workspaceMachine.js');
        const B = await import('/data/backup.js');
        localStorage.removeItem(M.MACHINE_KEY);
        const fresh = M.getMachine();                       // never set → the default
        M.setMachine({ kind: 'lathe' }, false);
        const set = M.getMachine();
        const isLathe = M.isLathe();
        // …and it travels in the FILE: build a backup, wipe the record, restore it
        const file = await B.buildBackup();
        localStorage.removeItem(M.MACHINE_KEY);
        const wiped = M.getMachine();
        await B.restoreBackup(file);
        const restored = M.getMachine();
        // a nonsense kind is not honoured — the record only ever holds a declared one
        M.setMachine({ kind: 'toaster' }, false);
        return { fresh, set, isLathe, wiped, restored, afterNonsense: M.getMachine(), kinds: M.MACHINE_KINDS };
    });
    expect(r.kinds, 'exactly two declared kinds').toEqual(['mill', 'lathe']);
    expect(r.fresh.kind, 'a workspace that never said is a mill').toBe('mill');
    expect(r.set.kind).toBe('lathe');
    expect(r.isLathe, 'and one question answers it everywhere').toBe(true);
    expect(r.wiped.kind, 'wiped back to the default before the restore, so the round trip proves something').toBe('mill');
    expect(r.restored.kind, 'THE KIND RODE THE .ddcs — the file IS the machine, including which kind it is').toBe('lathe');
    expect(r.afterNonsense.kind, 'an undeclared kind falls back to mill rather than being stored').toBe('mill');
});

test('(1b) THE IDENTITY SURFACES say Lathe — and say nothing extra for a mill', async ({ page }) => {
    await boot(page);
    // the quick-menu identity line
    await page.evaluate(() => { window.ddcsSetMachine({ kind: 'lathe' }, false); window.dispatchEvent(new CustomEvent('ddcs:settings-changed')); });
    await page.click('#hdrPostBtn');
    await page.waitForSelector('#hdrPostMenu:not([hidden])');
    await expect(page.locator('.hq-identity-line'), 'the line names the kind').toContainText(/Lathe/);
    await page.keyboard.press('Escape');
    // the Settings identity band
    await page.evaluate(() => window.openSettings());
    await expect(page.locator('#set_identity_band')).toContainText(/Kind\s*Lathe/);

    // …and a MILL workspace is not labelled: the default needs no badge, or every line grows noise
    await page.evaluate(() => { window.ddcsSetMachine({ kind: 'mill' }, false); window.dispatchEvent(new CustomEvent('ddcs:settings-changed')); });
    await expect(page.locator('#set_identity_band'), 'no Kind row for a mill').not.toContainText(/Kind/);
    await page.evaluate(() => window.closeSettings());
    await page.click('#hdrPostBtn');
    await page.waitForSelector('#hdrPostMenu:not([hidden])');
    await expect(page.locator('.hq-identity-line')).not.toContainText(/Lathe|Mill/);
});

test('(2) THE MECHANISM: one chuck, two declared rotations — and only one of them commands an angle', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const L = await import('/data/lathe.js');
        return { rot: L.LATHE_ROTATION, kin: L.LATHE_KINEMATICS };
    });
    expect(Object.keys(r.rot), 'axis (the rotary the app already models) and spindle (new: cutting rotation)').toEqual(['axis', 'spindle']);
    expect(r.rot.axis.commandsAngle, 'an indexed rotary is commanded to an angle').toBe(true);
    expect(r.rot.spindle.commandsAngle, 'a cutting spindle is not — RPM only, and no G96 exists on a DDCS').toBe(false);
    expect(r.kin.carriage.axis, 'the carriage is Z, along the bed').toBe('Z');
    expect(r.kin.crossSlide.axis, 'the cross-slide is X').toBe('X');
    expect(r.kin.toolApproach, 'the tool comes from outside the bar').toBe('+X');
    expect(r.kin.chuck.holds).toBe('bar');
});

test('(3) THE BAR maps onto the EXISTING cylinder stock, losslessly, re-axised along Z', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const L = await import('/data/lathe.js');
        const bar = { diameter: 25, stickOut: 60, allowance: 1.5, rotation: 'spindle' };
        const stock = L.barToStock(bar);
        return { stock, back: { diameter: stock.diameter, length: stock.z }, norm: L.normalizeBar({}), junk: L.normalizeBar({ diameter: -5, stickOut: 'x', rotation: 'sideways' }) };
    });
    expect(r.stock.shape, 'the SAME cylinder stock the rotary rig uses — a mapping, not a second stock type').toBe('cylinder');
    expect(r.stock.diameter).toBe(25);
    expect(r.stock.x, 'the round cross-section').toBe(25);
    expect(r.stock.y).toBe(25);
    expect(r.stock.z, 'LENGTH RUNS ALONG Z (the rotary cylinder lies along its rotary axis; a bar lies along the bed)').toBe(61.5);
    expect(r.stock.origin, 'measured from the finished face, which is Z0').toBe('finished-face');
    // lossless: diameter and total length come straight back out
    expect(r.back).toEqual({ diameter: 25, length: 61.5 });
    // a nonsense bar is normalised to something usable rather than throwing into a canvas
    expect(r.norm).toEqual({ diameter: 25, stickOut: 60, allowance: 1, rotation: 'spindle' });
    expect(r.junk.diameter, 'a negative diameter falls back').toBe(25);
    expect(r.junk.rotation, 'an undeclared rotation falls back to the declared default').toBe('spindle');
});

test('(4) THE FRAME + THE ONE CONVERSION: diameter in, radius out', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const L = await import('/data/lathe.js');
        return {
            frame: L.LATHE_FRAME,
            r25: L.radiusOf(25), r0: L.radiusOf(0), rBad: L.radiusOf('nope'),
            round: L.diameterOf(L.radiusOf(31.75)),
        };
    });
    expect(r.frame.x.means).toMatch(/radius/);
    expect(r.frame.z.zeroAt, 'Z0 is the FINISHED FACE (user ruling)').toMatch(/FINISHED FACE/i);
    expect(r.frame.cutDirection, 'cutting runs toward the chuck').toBe('-Z');
    expect(r.frame.uiSpeaks).toBe('diameter');
    expect(r.frame.emitWrites).toBe('radius');
    expect(r.r25, 'Ø25 is a 12.5 radius').toBe(12.5);
    expect(r.r0).toBe(0);
    expect(Number.isNaN(r.rBad), 'garbage in is NaN, not a silently wrong number').toBe(true);
    expect(r.round, 'the pair round-trips exactly — one home, so they cannot drift').toBe(31.75);
});

test('(4b) TRIPWIRE - every LATHE consumer converts through radiusOf, never its own halving', () => {
    // The passAnchorFor lesson (t1241 B) applied before the copies exist - but the hazard has to be named PRECISELY,
    // not proxied. A first draft of this test flagged eleven dia/2 sites across the MILL code: bore and circle radii,
    // which are correct and have nothing to do with turning. Halving a hole diameter is not the bug. A SECOND LATHE
    // diameter-to-radius conversion is, because a turner's diameter is the one number the controller cannot take.
    //
    // So the scan is scoped to files that actually work with the lathe model: lathe.js plus anything importing it.
    // Today that is only lathe.js - and the scan grows on its own as turn 2 adds wizard readers.
    const files = [];
    const skip = /node_modules|vendor|[.]min[.]js$/;
    const walk = (dir) => {
        for (const name of readdirSync(dir)) {
            const p = join(dir, name);
            if (skip.test(p)) continue;
            if (statSync(p).isDirectory()) { walk(p); continue; }
            if (p.endsWith('.js')) files.push(p);
        }
    };
    walk(web);
    const latheFiles = files.filter((p) => /lathe[.]js$/.test(p) || /data.lathe[.]js/.test(readFileSync(p, 'utf8')));
    expect(latheFiles.length, 'the lathe model exists and this scan found it').toBeGreaterThan(0);

    const HALVES = /(diameter|dia)\s*(\/\s*2|[*]\s*0?[.]5)/i;
    const NL = String.fromCharCode(10);
    const isComment = (l) => /^\s*([*]|\/\/)/.test(l);
    const offenders = [];
    for (const p of latheFiles) {
        readFileSync(p, 'utf8').split(NL).forEach((line, i) => {
            if (isComment(line)) return;                    // prose about the rule is not the rule
            if (/function radiusOf/.test(line)) return;     // the one home
            if (HALVES.test(line)) offenders.push(p.replace(web, 'web') + ':' + (i + 1) + ': ' + line.trim().slice(0, 80));
        });
    }
    expect(offenders, 'a lathe consumer halving a diameter itself is how a part comes out twice its size').toEqual([]);

    // ...and the ONE conversion really is one: a single halving inside the model, the one in radiusOf
    const code = readFileSync(join(web, 'data', 'lathe.js'), 'utf8').split(NL).filter((l) => !isComment(l)).join(NL);
    expect((code.match(/[/]\s*2/g) || []).length, 'exactly one halving in the model').toBe(1);
});
test('(5) THE VIEW CONTRACT: the half-profile is DATA, drawn from the declared bar', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const L = await import('/data/lathe.js');
        return L.halfProfile({ diameter: 20, stickOut: 50, allowance: 2, rotation: 'spindle' });
    });
    // Z0 at the finished face, the bar running back into the chuck (−Z), the raw allowance ahead of it (+Z)
    expect(r.datum.z, 'the datum IS Z0').toBe(0);
    expect(r.allowance, 'the material that gets faced off sits between the datum and the raw end').toEqual({ z1: 0, z2: 2 });
    expect(r.centreline, 'the centreline spans the whole bar').toEqual({ z1: -50, z2: 2 });
    expect(r.bounds).toEqual({ z1: -50, z2: 2, x1: 0, x2: 10 });
    // the outline is a HALF profile: X starts at the centre, rises to the RADIUS (not the diameter), and returns
    expect(r.outline.map((p) => p.x), 'radius up, never diameter — the whole point of the one conversion').toEqual([0, 10, 10, 0]);
    expect(r.outline.map((p) => p.z)).toEqual([-50, -50, 2, 2]);
});

test('(5b) the contract RENDERS — a minimal draw proves the model reaches a canvas', async ({ page }) => {
    await boot(page);
    const drawn = await page.evaluate(async () => {
        const L = await import('/data/lathe.js');
        const prof = L.halfProfile({ diameter: 20, stickOut: 50, allowance: 2 });
        // the smallest honest renderer: map the declared geometry into a canvas and confirm ink lands where the model
        // said it would. The full canvas polish arrives with Facing in turn 2 — this proves the CONTRACT is drawable.
        const c = document.createElement('canvas'); c.width = 260; c.height = 120;
        const g = c.getContext('2d');
        const pad = 10, zSpan = prof.bounds.z2 - prof.bounds.z1, xSpan = Math.max(prof.bounds.x2, 1);
        const sx = (c.width - pad * 2) / zSpan, sy = (c.height - pad * 2) / xSpan;
        const X = (z) => pad + (z - prof.bounds.z1) * sx;
        const Y = (x) => c.height - pad - x * sy;
        g.strokeStyle = '#fff'; g.lineWidth = 2;
        g.beginPath(); prof.outline.forEach((p, i) => (i ? g.lineTo(X(p.z), Y(p.x)) : g.moveTo(X(p.z), Y(p.x)))); g.stroke();
        g.beginPath(); g.moveTo(X(prof.centreline.z1), Y(0)); g.lineTo(X(prof.centreline.z2), Y(0)); g.stroke();
        const px = g.getImageData(0, 0, c.width, c.height).data;
        let ink = 0;
        for (let i = 3; i < px.length; i += 4) if (px[i] > 0) ink++;
        return { ink, datumX: Math.round(X(prof.datum.z)), rightX: Math.round(X(prof.bounds.z2)) };
    });
    expect(drawn.ink, 'the declared profile actually draws').toBeGreaterThan(200);
    expect(drawn.datumX, 'and the datum lands inside the drawing, left of the raw end').toBeLessThan(drawn.rightX);
});

test('(6) ENVELOPE SEMANTICS adapt for a lathe — wording only, the signed travels untouched', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const L = await import('/data/lathe.js');
        const M = await import('/data/workspaceMachine.js');
        const mill = L.axisLabels('mill'), lathe = L.axisLabels('lathe');
        // the declared envelope formatter is UNCHANGED by the kind — same numbers, same signs, either way
        const env = M.envelopeSummary({ x: 120, y: 0, z: -300 });
        return { mill, lathe, env };
    });
    expect(r.mill, 'a mill says X/Y/Z and adds nothing').toEqual({ x: 'X', y: 'Y', z: 'Z', note: '' });
    expect(r.lathe.x, 'X is the cross-slide, in radius space').toMatch(/cross-slide.*radius/i);
    expect(r.lathe.z, 'Z is the carriage along the bed').toMatch(/carriage/i);
    expect(r.lathe.note, 'and it says the travels themselves are unchanged').toMatch(/signs are unchanged/i);
    expect(r.env, 'the envelope formatter is untouched by the kind').toBe('X 120 Y 0 Z -300');
});

test('THE MISMATCH GATE DOES NOT INVENT A KIND — it can only state the one we declared', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const C = await import('/data/controllerMatch.js');
        return {
            lathe: C.kindContext('lathe'), mill: C.kindContext('mill'),
            // the comparison itself still only compares CONTROLLERS — there is no kind field in it to compare
            cmpKeys: Object.keys(C.compareController('ddcs-expert-m350')).sort(),
        };
    });
    expect(r.lathe, 'it states the workspace’s own declaration, as context').toMatch(/lathe workspace/i);
    expect(r.lathe, 'and says plainly why there is nothing to compare against').toMatch(/cannot report which kind/i);
    expect(r.mill, 'a mill workspace adds no clause at all').toBe('');
    expect(r.cmpKeys, 'the comparison carries no kind — a DDCS cannot report one, so nothing may pretend to detect it')
        .toEqual(['detected', 'known', 'match', 'workspace']);
});
