import { test, expect } from '@playwright/test';

// Settings panel: a primary Done button in a footer.
//
// t1245 — the FAQ / Feedback / About part of this spec MOVED with its subject. Those three left Settings entirely
// (FAQ + About are now the quick menu's Help panel; Feedback merged into Rate / Feedback), so asking Settings about
// them would only prove they are absent. The questions themselves are worth keeping and are asked below of the
// surface that now answers them — plus a guard that Settings did not keep a copy.
test.use({ viewport: { width: 1280, height: 900 } });

test('settings has a Done button — and no longer carries FAQ / Feedback / About (t1245)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsGetSettings && window.openSettings);   // t1307 — the declared boot signal FIRST (t1279): the globals below exist before the deferred wiring reaches the controls this spec clicks
  await page.evaluate(() => window.openSettings());
  await page.waitForFunction(() => document.querySelector('#settings-app .settings-done'));

  const r = await page.evaluate(() => ({
    hasDone: !!document.querySelector('#settings-app .settings-done'),
    doneCloses: typeof window.closeSettings === 'function',
    profilePanel: !!document.getElementById('set_tab_profile'),   // sanity: panels still present
    // the three that LEFT — Settings must not keep a copy of any of them
    leftovers: ['set_tab_faq', 'set_tab_feedback', 'set_tab_about'].filter((id) => document.getElementById(id)),
  }));

  expect(r.hasDone, 'Done button present').toBeTruthy();
  expect(r.doneCloses, 'closeSettings exists for Done').toBeTruthy();
  expect(r.profilePanel, 'panels intact (markup not broken)').toBeTruthy();
  expect(r.leftovers, 'FAQ / Feedback / About left Settings — no duplicate stayed behind').toEqual([]);

  // Done closes the panel (closeSettings removes .active from #settings-overlay).
  await page.evaluate(() => document.querySelector('#settings-app .settings-done').click());
  await page.waitForTimeout(80);
  const closed = await page.evaluate(() => { const ov = document.getElementById('settings-overlay'); return !ov || !ov.classList.contains('active'); });
  expect(closed, 'Done closed the settings').toBeTruthy();
});

// t1245 — the questions that moved, asked of the surface that now answers them.
test('HELP holds the FAQ and About, opens from the quick menu, and the FAQ still has its entries', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsStudio && document.querySelector('#hdrPostMenu .hdr-quick-head'), null, { timeout: 15000 });
  await page.click('#hdrPostBtn');
  await page.waitForSelector('#hdrPostMenu:not([hidden])');
  await page.click('#hdrPostMenu [data-act="help"]');
  await expect(page.locator('#helpOverlay')).toBeVisible({ timeout: 6000 });

  const h = await page.evaluate(() => ({
    faqItems: document.querySelectorAll('#help_faq details').length,
    hasAbout: /DDCS STUDIO/i.test(document.getElementById('help_about').textContent),
    hasCredits: /CREDITS/i.test(document.getElementById('help_about').textContent),
    version: (document.getElementById('help_about_ver') || {}).textContent,
    // the FAQ answer that used to send people to the retired Settings > Feedback tab
    pointsAtRate: /Rate \/ Feedback/.test(document.getElementById('help_faq').textContent),
    stillPointsAtSettingsFeedback: /Settings → <b>Feedback/.test(document.getElementById('help_faq').innerHTML),
  }));
  expect(h.faqItems, 'the FAQ came over whole').toBeGreaterThanOrEqual(10);
  expect(h.hasAbout, 'About came with it').toBe(true);
  expect(h.hasCredits, 'credits and all').toBe(true);
  expect(h.version, 'and the version reads from the one .ver source, not a hard-coded string').toMatch(/\d/);
  expect(h.pointsAtRate, 'the bug-report answer names the ONE feedback door').toBe(true);
  expect(h.stillPointsAtSettingsFeedback, 'and no longer names the retired one').toBe(false);

  await page.keyboard.press('Escape');
  await expect(page.locator('#helpOverlay')).toHaveCount(0);
});

/**
 * t1251 — THE FAQ IS DOCUMENTATION OF A LIVE APP, so it is tested like code.
 *
 * The old FAQ predated the workspace era and still described a profile library, a USB-ready .zip, and cloud
 * profile-sync — three things that no longer exist. Prose rots silently: nothing fails when an answer names a button
 * that was renamed two turns ago, and the person reading it is the one who finds out. These tests pin the two things
 * that actually go wrong — an answer naming a DEAD path, and the workspace chapter quietly disappearing — so the
 * next IA change has to update the words in the same breath as the code.
 */
test('the FAQ leads with the workspace chapter, and every entry it promises is there', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsStudio && document.querySelector('#hdrPostMenu .hdr-quick-head'), null, { timeout: 15000 });
  await page.click('#hdrPostBtn');
  await page.waitForSelector('#hdrPostMenu:not([hidden])', { timeout: 6000 });
  await page.click('#hdrPostMenu [data-act="help"]');
  await expect(page.locator('#helpOverlay')).toBeVisible({ timeout: 6000 });

  const qs = await page.evaluate(() => [...document.querySelectorAll('#help_faq details summary')].map((s) => s.textContent.trim()));
  // IDENTITY FIRST applies to docs too: what is it, then where is my work
  expect(qs[0], 'the opener still says what this is').toMatch(/What is DDCS Studio/);
  expect(qs.slice(1, 7), 'then the workspace chapter, before anything else').toEqual([
    'Where is my work saved?',
    'What exactly is inside a .ddcs file?',
    '.ddcs, .wiz, .cam, .nc — which file is which?',
    'How do I work with two machines?',
    'How do I share a wizard or a CAM recipe?',
    'How do I get files onto the USB stick?',
  ]);
  // …and the troubleshooting tail stays at the end, where you reach for it
  expect(qs[qs.length - 1], 'the bug-report entry is last').toMatch(/Found a bug/);
  expect(qs[qs.length - 2]).toMatch(/jog the start position/);
});

test('NO DEAD PATHS: the FAQ never names a thing the app retired', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsStudio, null, { timeout: 15000 });
  await page.evaluate(async () => { (await import('/ui/helpPanel.js')).openHelp(); });
  // textContent, NOT innerText: a collapsed <details> renders none of its answer, so innerText here returns just the
  // list of questions — every assertion about what an ANSWER says would then be checking nothing.
  const faq = await page.evaluate(() => document.getElementById('help_faq').textContent);

  // each of these named a real feature once; each is gone, and an answer that still says it sends someone hunting
  expect(faq, 'the profile library retired with the one-workspace-one-machine pivot').not.toMatch(/profile librar/i);
  expect(faq, 'cloud does not sync profiles — Drive is another place workspaces live').not.toMatch(/sync(s|es)? your profiles|profiles and programs across devices/i);
  expect(faq, 'Settings has no Feedback tab — Rate / Feedback is the one door').not.toMatch(/Settings\s*→\s*<?b?>?Feedback/i);
  // the CAM entry specifically: the pack DEPLOYS a file tree now; a .zip is only the no-FSA fallback
  const cam = await page.evaluate(() => [...document.querySelectorAll('#help_faq details')]
    .find((d) => /What is a CAM pack/.test(d.querySelector('summary').textContent)).textContent);
  expect(cam, 'it describes the deploy, not a USB-ready zip').toMatch(/deploy folder|Deploy pack/i);
  expect(cam, 'and mentions the zip only as the fallback it now is').toMatch(/cannot write to a folder falls back/i);
  expect(cam, 'no USB-ready-zip framing').not.toMatch(/USB-ready/i);
});

test('every Settings path the FAQ names actually resolves — the claim cannot outrun the code', async ({ page }) => {
  // The rule this turn was given: a named UI path must be VERIFIED, not remembered. So the test walks the paths the
  // prose promises and asserts the panel really opens, which is what makes the sentence true rather than plausible.
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsStudio && window.openSettings, null, { timeout: 15000 });
  await page.evaluate(async () => { (await import('/ui/helpPanel.js')).openHelp(); });
  const faq = await page.evaluate(() => document.getElementById('help_faq').textContent);

  const CLAIMED = [
    { says: /Settings → Controller → Gateway/, panel: 'set_tab_gateway', group: 'controller' },
    { says: /Settings → Controller → Profile/, panel: 'set_tab_profile', group: 'controller' },
    { says: /Settings → Look and feel → Wizard bar/, panel: 'set_tab_wizards', group: 'lookfeel' },
    { says: /Settings → <?b?>?Hardware/, panel: 'set_tab_machine', group: 'hardware' },
  ];
  for (const c of CLAIMED) {
    expect(faq, `the FAQ names ${c.panel}'s path`).toMatch(c.says);
    const landed = await page.evaluate(async (p) => {
      const { openSettings } = await import('/ui/settingsPanel.js');
      openSettings({ panel: p });
      const el = document.getElementById(p);
      const main = document.querySelector('#settings-app .settings-tabs .settings-main-tab.active');
      return { shown: el && getComputedStyle(el).display !== 'none', group: main && main.dataset.group };
    }, c.panel);
    expect(landed.shown, `${c.panel} really opens`).toBe(true);
    expect(landed.group, `under the tab the FAQ names`).toBe(c.group);
  }
  await page.evaluate(() => window.closeSettings && window.closeSettings());
});

/**
 * t1251 (user amendment) — EVERY FAQ LINK LANDS.
 *
 * The paths an answer names are now clickable, and the pairing lives in ONE declared registry (FAQ_LINKS): id → the
 * call that opens the surface, plus the words the link reads as. This walks every entry in that registry and asserts
 * the opener actually arrives — the t1245 per-panel deep-link pattern extended to documentation. A surface renamed or
 * moved now breaks a test instead of stranding a reader on a dead sentence.
 */
test('every registered FAQ link opens its surface — and every registry entry is actually used', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsStudio && window.openSettings && window.openWorkspaceManager, null, { timeout: 15000 });
  await page.evaluate(async () => { (await import('/ui/helpPanel.js')).openHelp(); });

  const ids = await page.evaluate(async () => Object.keys((await import('/ui/helpPanel.js')).FAQ_LINKS));
  expect(ids.length, 'the registry is populated').toBeGreaterThan(6);

  // NO DEAD DECLARATIONS: a registry row nothing references is a promise no reader can reach
  const used = await page.evaluate(() => [...document.querySelectorAll('#help_faq [data-help-link]')].map((a) => a.dataset.helpLink));
  for (const id of ids) expect(used, `${id} is referenced by an answer`).toContain(id);

  // …and every link's WORDS come from the registry, so the text and the destination cannot drift
  const mismatched = await page.evaluate(async () => {
    const { FAQ_LINKS } = await import('/ui/helpPanel.js');
    return [...document.querySelectorAll('#help_faq [data-help-link]')]
      .filter((a) => { const e = FAQ_LINKS[a.dataset.helpLink]; return !e; })
      .map((a) => a.dataset.helpLink);
  });
  expect(mismatched, 'no link points at an id the registry does not declare').toEqual([]);

  // WHERE EACH ONE LANDS — asserted per id, by clicking the real link in the real panel
  const LANDS = {
    'settings-gateway':   async () => expect(page.locator('#set_tab_gateway')).toBeVisible(),
    'settings-profile':   async () => expect(page.locator('#set_tab_profile')).toBeVisible(),
    'settings-wizardbar': async () => expect(page.locator('#set_tab_wizards')).toBeVisible(),
    'settings-hardware':  async () => expect(page.locator('#set_tab_machine')).toBeVisible(),
    'workspace-manager':  async () => expect(page.locator('#wsmOverlay')).toBeVisible(),
    'workspace-cloud':    async () => expect(page.locator('.wsm-place[data-place="cloud"]')).toHaveClass(/is-active/),
    'gateway-tab':        async () => expect(page.locator('#gateway-app, .gateway-app').first()).toBeVisible(),
    'gateway-files':      async () => expect(page.locator('#gateway-app, .gateway-app').first()).toBeVisible(),
    'macros-cam':         async () => expect(page.locator('#cam_slots')).toBeVisible(),
    'blocks-tab':         async () => expect(page.locator('#blocks-app, .blocks-app').first()).toBeVisible(),
  };
  expect(Object.keys(LANDS).sort(), 'this test covers the WHOLE registry, not a sample').toEqual([...ids].sort());

  for (const id of ids) {
    await page.evaluate(async () => { (await import('/ui/helpPanel.js')).openHelp(); });
    await expect(page.locator('#helpOverlay')).toBeVisible();
    // a link lives inside its answer, and an answer is collapsed until you open it — same two steps a reader takes
    await page.evaluate((lid) => {
      const a = document.querySelector(`#help_faq [data-help-link="${lid}"]`);
      const d = a && a.closest('details');
      if (d) d.open = true;
    }, id);
    await page.click(`#help_faq [data-help-link="${id}"]`);
    // the Help overlay must get OUT OF THE WAY — the destination is often a modal, and Help on top of it would hide
    // the very thing the reader asked to see
    await expect(page.locator('#helpOverlay'), `${id} closed Help on the way out`).toHaveCount(0, { timeout: 6000 });
    await LANDS[id]();
    // t1251 AMEND-3 (user, retracting the return-chip idea): an FAQ link CLOSES Help and opens the target, full stop.
    // No return token, no Back chip — getting back to Help is the normal door (quick menu → Help), same as always.
    // The ABSENCE is the design, so it is asserted: a link that started leaving breadcrumbs would fail here.
    const back = await page.evaluate(() => ({
        activeReturn: !!(window.ddcsNavReturn && window.ddcsNavReturn.activeReturn && window.ddcsNavReturn.activeReturn()),
        glow: !!document.querySelector('.return-glow'),
        chip: document.querySelectorAll('.nav-return, .ret-chip, [data-navreturn]').length,
    }));
    expect(back.activeReturn, `${id} pushed no return token`).toBe(false);
    expect(back.glow, `${id} left no return-glow`).toBe(false);
    expect(back.chip, `${id} rendered no Back chip`).toBe(0);
    await page.evaluate(() => { window.closeSettings && window.closeSettings(); document.getElementById('wsmOverlay')?.remove(); });
  }
});

/**
 * t1253 — WHAT IS IN THE FILE, and it cannot go stale.
 *
 * The answer listing a .ddcs's contents is RENDERED FROM BACKUP_STORES, the same declared registry the save walks —
 * not transcribed beside it. A second copy of that list is one somebody forgets, and the FAQ would then name nine
 * things while the file carried ten. This asserts the correspondence is 1:1 in BOTH directions, so a new store cannot
 * be added without the FAQ naming it, and the FAQ cannot name something the file does not carry.
 */
test('the .ddcs contents answer matches the BACKUP_STORES registry, 1:1 and in order', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsStudio, null, { timeout: 15000 });
  // t1327 — DECLARED STATE (t1303 hygiene). This passed inside the suite and failed alone, which means it was reading
  // state an earlier test had left behind rather than state it asked for. A test that only agrees with itself in one
  // running order is not asserting the thing it names. So: open the panel, then WAIT for the entry to actually exist
  // before reading it, instead of assuming a render that a previous test happened to have already done.
  await page.evaluate(async () => { (await import('/ui/helpPanel.js')).openHelp(); });
  await page.waitForFunction(() => {
    const d = [...document.querySelectorAll('#help_faq details')];
    return d.some((x) => /What exactly is inside a \.ddcs file/.test(x.querySelector('summary').textContent));
  }, null, { timeout: 10000 });

  const r = await page.evaluate(async () => {
    const { BACKUP_STORES } = await import('/data/backup.js');
    const { CONTENTS_SEP } = await import('/ui/helpPanel.js');
    const entry = [...document.querySelectorAll('#help_faq details')]
      .find((d) => /What exactly is inside a \.ddcs file/.test(d.querySelector('summary').textContent));
    return { labels: BACKUP_STORES.map((s) => s.label), text: entry ? entry.textContent : '', sep: CONTENTS_SEP };
  });

  expect(r.labels.length, 'the registry is populated').toBeGreaterThan(5);
  // EVERY store is named…
  for (const label of r.labels) expect(r.text, `the answer names the "${label}" store`).toContain(label);
  // …and the answer names NOTHING ELSE as a store: the rendered list is exactly the registry's, in its order
  const listed = (r.text.match(/Everything this workspace is, in one file: ([^.]+)\./) || [])[1];
  expect(listed, 'the sentence carries the derived list').toBeTruthy();
  // t1327 — SPLIT ON THE SEPARATOR THE SENTENCE DECLARES, imported rather than re-typed here. A comma could not do
  // this job: two labels contain one ("Window layout (which panes are open, their sizes)"), so a comma-split turned
  // that single row into two and the 1:1 check failed on a registry that was perfectly correct.
  expect(r.sep, 'the separator is declared by the module that writes the sentence').toBeTruthy();
  expect(r.labels.some((l) => l.includes(',')), 'and it has to be, because a label really does contain a comma').toBe(true);
  expect(r.labels.some((l) => l.includes(r.sep.trim())), 'while no label contains the separator').toBe(false);
  expect(listed.split(r.sep).map((x) => x.trim()), 'exactly the declared rows, in registry order').toEqual(r.labels);
  // t1327 — THE LATHE TOOLS RIDE A ROW, so the registry-derived sentence already names them: they entered the .ddcs
  // at t1325 on the settings row, which is exactly why that answer is derived rather than transcribed. What is worth
  // checking is that the row's LABEL still reads like something a person would recognise as their tools.
  const toolRow = r.labels.find((l) => /tool table/i.test(l));
  expect(toolRow, `a row names the tool table in human words: ${JSON.stringify(r.labels)}`).toBeTruthy();
  expect(r.text, 'and the answer carries it, with no edit needed when a new tool field appears').toContain(toolRow);
});

test('the file-kinds answer says which file is SOURCE and which is BAKED', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsStudio, null, { timeout: 15000 });
  await page.evaluate(async () => { (await import('/ui/helpPanel.js')).openHelp(); });
  const t = await page.evaluate(() => {
    const d = [...document.querySelectorAll('#help_faq details')].find((x) => /which file is which/.test(x.querySelector('summary').textContent));
    return d ? d.textContent : '';
  });
  expect(t, 'all four kinds').toMatch(/\.ddcs/);
  expect(t).toMatch(/\.wiz/);
  expect(t).toMatch(/\.cam/);
  expect(t).toMatch(/\.nc/);
  // the distinction that actually matters when someone hands you a file
  expect(t, 'the sources say they import live and editable').toMatch(/live and editable|rebuilds into a slot/);
  expect(t, 'and the bakes say they are the end of the line, with what to do instead').toMatch(/not re-importable[\s\S]*change its source and deploy again/);
});
