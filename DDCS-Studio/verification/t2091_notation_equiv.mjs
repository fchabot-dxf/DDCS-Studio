import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<div id="a" style="color:#fff"></div><div id="b" style="color:#ffffff"></div><div id="c" style="color:white"></div><div id="d" style="color:rgba(0,0,0,.5)"></div><div id="e" style="color:rgba(0,0,0,0.5)"></div><div id="f" style="color:#000"></div><div id="g" style="color:#000000"></div>');
const info = await page.evaluate(() => {
    const cs = (id) => getComputedStyle(document.getElementById(id)).color;
    return { a: cs('a'), b: cs('b'), c: cs('c'), d: cs('d'), e: cs('e'), f: cs('f'), g: cs('g') };
});
console.log(JSON.stringify(info, null, 2));
console.log('fff==ffffff==white:', info.a === info.b && info.b === info.c);
console.log('.5==0.5:', info.d === info.e);
console.log('000==000000:', info.f === info.g);
await browser.close();
