import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:3211');
await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
const info = await page.evaluate(async () => {
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { surfacingStack } = await import('/wizards/surfacingWizard.js');
    const { INDENT_WIDTH } = await import('/data/indentStyle.js');
    const stack = surfacingStack({ w: 120, h: 90, toolDia: 12, depth: 1, stepdown: 0.5, stepoverPct: 60, feed: 2000, plunge: 200, clearance: 5 });
    const widths = (text) => text.split('\n').map((l) => (l.match(/^ +/) || [''])[0].length).filter((n) => n > 0);

    const noOpts = emitMapped(stack).text;
    const explicitIndentedDefaultDialect = emitMapped(stack, { indentStyle: 'indented' }).text;
    const explicitFlushDefaultDialect = emitMapped(stack, { indentStyle: 'flush' }).text;
    const centroidDefault = emitMapped(stack, { profileId: 'centroid' }).text;
    const centroidIndented = emitMapped(stack, { profileId: 'centroid', indentStyle: 'indented' }).text;
    const centroidFlush = emitMapped(stack, { profileId: 'centroid', indentStyle: 'flush' }).text;
    const ci = widths(centroidIndented);

    return {
        INDENT_WIDTH,
        noOptsIndentedCount: widths(noOpts).length,
        explicitIndentedDefaultDialectCount: widths(explicitIndentedDefaultDialect).length,
        explicitFlushDefaultDialectCount: widths(explicitFlushDefaultDialect).length,
        centroidDefaultCount: widths(centroidDefault).length,
        centroidIndentedCount: ci.length,
        centroidIndentedMinWidth: ci.length ? Math.min(...ci) : null,
        centroidFlushCount: widths(centroidFlush).length,
        noOptsEqualsExplicitFlush: noOpts === explicitFlushDefaultDialect,
        noOptsEqualsExplicitIndented: noOpts === explicitIndentedDefaultDialect,
    };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
