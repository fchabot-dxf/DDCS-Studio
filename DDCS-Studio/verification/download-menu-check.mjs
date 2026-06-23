import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const out = [];
const errors = [];

// bridged face (gateway on 8799)
const a = await browser.newPage();
a.on('pageerror', (e) => errors.push('bridged: ' + e.message));
await a.goto('http://127.0.0.1:8799', { waitUntil: 'networkidle' });
await a.waitForTimeout(1500);
out.push('[bridged]   TRANSFER visible: ' + (await a.locator('#transferBtn').isVisible()));
out.push('[bridged]   DOWNLOAD visible: ' + (await a.locator('#downloadBtn').isVisible()));
await a.locator('#downloadBtn').click();
await a.waitForTimeout(200);
out.push('[bridged]   menu items: ' + (await a.locator('#dl-menu .op-btn').count())
    + ' | exe href ok: ' + ((await a.locator('#dl-exe').getAttribute('href')).includes('github.com')));
await a.close();

// standalone face (no gateway)
const b = await browser.newPage();
b.on('pageerror', (e) => errors.push('standalone: ' + e.message));
await b.goto('http://127.0.0.1:3017', { waitUntil: 'networkidle' });
await b.waitForTimeout(1500);
out.push('[standalone] TRANSFER hidden: ' + !(await b.locator('#transferBtn').isVisible()));
out.push('[standalone] DOWNLOAD visible: ' + (await b.locator('#downloadBtn').isVisible()));
await b.locator('#downloadBtn').click();
await b.waitForTimeout(200);
out.push('[standalone] menu opens (2 items): ' + ((await b.locator('#dl-menu .op-btn').count()) === 2));
const dl = b.waitForEvent('download');
await b.locator('#dl-html').click();
const f = await dl;
out.push('[standalone] HTML download fires: ' + f.suggestedFilename());
await b.close();

console.log(out.join('\n'));
if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'));
await browser.close();
