import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

/**
 * t1311 — THE VERSION STAMPS AGREE, OR THE GATE GOES RED.
 *
 * From a real mistake: a hand-edited version.json desynced from the `.ver` chip, so the in-app update banner decided
 * the running app was stale and covered the header — while the exe CI cut from the chip wore a different number
 * again. The rule since has been "bump-version.cjs only", and a rule in memory is weaker than a guard in the tree.
 *
 * IT RUNS ON EVERY GATE, not just the full suite, because the mistake happens at RELEASE time — which is exactly
 * when nobody is running the slow one. No browser: it reads files, so it costs milliseconds.
 *
 * The check itself lives in `scripts/check-version-sync.cjs` so the same one declaration serves a pre-push or CI step
 * (`node scripts/check-version-sync.cjs`) and this spec — rather than a copy in each that can drift apart, which is
 * the same failure mode one level up.
 */
const require_ = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { checkVersionSync, describe: describeSync } = require_(path.join(ROOT, 'scripts', 'check-version-sync.cjs'));

/** A throwaway copy of the four stamped files, so a perturbation never touches the real tree. */
const copyTree = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddcs-ver-'));
    fs.mkdirSync(path.join(dir, 'web'));
    fs.copyFileSync(path.join(ROOT, 'web', 'index.html'), path.join(dir, 'web', 'index.html'));
    fs.copyFileSync(path.join(ROOT, 'web', 'version.json'), path.join(dir, 'web', 'version.json'));
    fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(dir, 'package.json'));
    return dir;
};
const edit = (file, from, to) => fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(from, to));

test('THE TREE IS SYNCED — the chip, the title, version.json and package.json all say the same release', async () => {
    const res = checkVersionSync(ROOT);
    expect(res.ok, describeSync(res)).toBe(true);
    expect(res.v, 'and the chip is the one that says it').toMatch(/^\d{4}\.\d{2}\.\d{2}\.\d+$/);
});

test('A STALE version.json IS CAUGHT AND NAMED — the exact desync that produced the nag', async () => {
    const dir = copyTree();
    fs.writeFileSync(path.join(dir, 'web', 'version.json'), JSON.stringify({ v: '2026.01.01.1' }) + '\n');
    const res = checkVersionSync(dir);
    expect(res.ok, 'the guard goes red').toBe(false);
    const msg = describeSync(res);
    expect(msg, 'naming the stale surface').toContain('web/version.json');
    expect(msg, 'with what it says').toContain('2026.01.01.1');
    expect(msg, 'and what it should say').toContain(res.v);
    expect(msg, 'and who is allowed to write it').toContain('scripts/bump-version.cjs');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('A STALE TITLE IS CAUGHT — the surface a user reads, which no release script re-checks', async () => {
    const dir = copyTree();
    edit(path.join(dir, 'web', 'index.html'), /<title>DDCS Studio V[0-9][0-9.]*<\/title>/, '<title>DDCS Studio V2020.01.01.9</title>');
    const res = checkVersionSync(dir);
    expect(res.ok).toBe(false);
    expect(describeSync(res)).toContain('the window <title>');
    expect(describeSync(res)).toContain('2020.01.01.9');
    // …and ONLY the title is blamed: the chip and version.json still agree with each other
    expect(res.problems.length, 'one surface wrong, one problem').toBe(1);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('A HAND-BUMPED CHIP IS CAUGHT TOO — because everything else is then stale against it', async () => {
    const dir = copyTree();
    edit(path.join(dir, 'web', 'index.html'), /class="ver">V[0-9][0-9.]*</, 'class="ver">V2099.12.31.7<');
    const res = checkVersionSync(dir);
    expect(res.ok).toBe(false);
    // the chip is the declared source of truth, so the OTHERS are reported — which is the sentence that tells you
    // what to do (re-run the writer), rather than arguing about which of four numbers is right
    expect(res.v, 'the chip is what the check believes').toBe('2099.12.31.7');
    expect(res.problems.map((p) => p.surface).join(' ')).toContain('<title>');
    expect(res.problems.map((p) => p.surface).join(' ')).toContain('version.json');
    expect(res.problems.map((p) => p.surface).join(' ')).toContain('package.json');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('package.json IS CHECKED AS A RELATIONSHIP, not as equality — the counter lives in the chip', async () => {
    const dir = copyTree();
    const res0 = checkVersionSync(dir);
    // the real relationship: V2026.07.28.12 → 2026.7.28 (date only, integers, no daily counter)
    const p = res0.surfaces.pkg;
    expect(p, 'the tree already satisfies it').toBe(res0.v.split('.').slice(0, 3).map((x, i) => (i ? String(parseInt(x, 10)) : x)).join('.'));
    // …and demanding EQUALITY would be the wrong check: prove the guard rejects the chip's own string here
    edit(path.join(dir, 'package.json'), /"version": "[^"]*"/, `"version": "${res0.v}"`);
    const res = checkVersionSync(dir);
    expect(res.ok, 'the full four-part version in package.json is NOT what the writer stamps').toBe(false);
    expect(describeSync(res)).toContain('the DATE only');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('THE STANDALONE RUN EXITS NON-ZERO — the seam a pre-push or CI step uses', async () => {
    const dir = copyTree();
    fs.writeFileSync(path.join(dir, 'web', 'version.json'), JSON.stringify({ v: '1.0.0.1' }) + '\n');
    const { spawnSync } = require_('child_process');
    const bad = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'check-version-sync.cjs'), dir], { encoding: 'utf8' });
    const good = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'check-version-sync.cjs')], { encoding: 'utf8' });
    expect(bad.status, 'a desynced tree fails the command').toBe(1);
    expect(bad.stderr, 'loudly, and by name').toContain('web/version.json');
    expect(good.status, 'and the real tree passes it').toBe(0);
    expect(good.stdout).toContain('version stamps agree');
    fs.rmSync(dir, { recursive: true, force: true });
});
