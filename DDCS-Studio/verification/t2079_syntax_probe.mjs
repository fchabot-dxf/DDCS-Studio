import { chromium } from '@playwright/test';
const THEMES = ['normal', 'studio', 'steampunk', 'futuristic', 'organic'];
const GCODE = 'G0 X10 Y20 ( a real comment )\nG1 Z-5 F300\n';

const browser = await chromium.launch();
const out = {};
for (const theme of THEMES) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript((t) => { try { localStorage.setItem('ddcs_theme', t); } catch (_) {} }, theme);
  await page.goto('http://localhost:3211', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, undefined, { timeout: 20000 });
  await page.evaluate((g) => {
    const e = document.getElementById('editor');
    e.value = g;
    e.dispatchEvent(new Event('input', { bubbles: true }));
  }, GCODE);
  await page.waitForTimeout(400);
  out[theme] = await page.evaluate(() => {
    const s = (el) => el ? getComputedStyle(el).color : 'MISSING';
    const bg = (el) => el ? getComputedStyle(el).backgroundColor : 'MISSING';
    const editor = document.getElementById('editor');
    const highlight = document.getElementById('editor-highlight');
    const gutter = document.getElementById('editor-gutter');
    const container = document.querySelector('.editor-container');
    const comment = highlight.querySelector('.g-comment');
    const num = highlight.querySelector('.g-num');
    const word = highlight.querySelector('.g-word');
    const ln = highlight.querySelector('.g-ln');
    return {
      caret: getComputedStyle(editor).caretColor,
      screenBg: { container: bg(container), highlight: bg(highlight), gutter: bg(gutter) },
      syntax: { comment: s(comment), num: s(num), word: s(word), ln: s(ln) },
      commentFound: !!comment, numFound: !!num, wordFound: !!word, lnFound: !!ln,
    };
  });
  await page.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 2));
