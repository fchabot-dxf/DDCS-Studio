import { chromium } from '@playwright/test';
import fs from 'node:fs';
const browser = await chromium.launch();

// --- A: gateway-served Studio — pull from controller, export profile ---
const a = await browser.newPage();
const dialogs = [];
a.on('dialog', (d) => { dialogs.push(d.message().slice(0, 60)); d.accept(); });
await a.goto('http://127.0.0.1:8799', { waitUntil: 'networkidle' });
await a.waitForTimeout(1200);
await a.evaluate(() => window.openSettings());
await a.waitForTimeout(600);
const opts = await a.locator('#set_profile_select option').allTextContents().catch(() => []);
console.log('controller profile offered: ' + opts.some((o) => o.includes('from controller')));
await a.locator('#set_profile_pull').click();
await a.waitForTimeout(1200);
console.log('pull dialogs: ' + JSON.stringify(dialogs));
const dl = a.waitForEvent('download');
await a.locator('#set_profile_export').click();
const file = await dl;
const path = 'verification/exported-profile.json';
await file.saveAs(path);
const prof = JSON.parse(fs.readFileSync(path, 'utf8'));
console.log('export has hardwareTabs: ' + JSON.stringify(prof.settings?.hardwareTabs));
console.log('export has no bridge token: ' + !(prof.settings?.bridge?.token));

// --- B: standalone Studio — import that file, check it applied ---
const b = await browser.newPage();
b.on('dialog', (d) => d.accept());
await b.goto('http://127.0.0.1:3017', { waitUntil: 'networkidle' });
await b.waitForTimeout(800);
// reset and confirm different state first
await b.evaluate(() => localStorage.removeItem('ddcs_studio_settings'));
const fc = b.waitForEvent('filechooser');
await b.evaluate(() => window.ddcsImportProfile());
await (await fc).setFiles(path);
await b.waitForTimeout(800);
const tabs = await b.evaluate(() => (window.ddcsGetSettings ? window.ddcsGetSettings().hardwareTabs : null));
console.log('imported hardwareTabs: ' + JSON.stringify(tabs));
console.log('round-trip matches: ' + (JSON.stringify(tabs) === JSON.stringify(prof.settings?.hardwareTabs)));
await browser.close();
