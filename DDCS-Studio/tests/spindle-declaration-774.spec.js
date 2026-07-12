import { test, expect } from '@playwright/test';

/**
 * t774 Phase 1a — THE SPINDLE DECLARATION (the tapping prerequisite). Settings → Machine gains a declared SPINDLE block
 * extending settings.spindle with {interface, mappingAxis, reversible, tapCapable, minRpm}. Profile-carried (rides the
 * existing spindle sub-object through load/apply/export). tapCapable is a USER-owned checkbox (never auto-seeded — the
 * wiring is theirs to attest); the tapping wizard's rigid gate + the sim spindle visual read this declaration.
 */
test.use({ viewport: { width: 1100, height: 820 } });

test('the Machine-tab SPINDLE declaration writes settings.spindle', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openSettings);
  const r = await page.evaluate(() => {
    window.openSettings({ group: 'hardware', panel: 'set_tab_machine' });
    const q = (id) => document.getElementById(id);
    const ids = ['set_spin_interface', 'set_spin_mapaxis', 'set_spin_minrpm', 'set_spin_reversible', 'set_spin_tapcapable'];
    if (!ids.every((id) => !!q(id))) return { present: false };
    const set = (id, v, check) => { const el = q(id); if (check) el.checked = v; else el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    set('set_spin_interface', 'pul-dir-axis');
    set('set_spin_mapaxis', 'Z');
    set('set_spin_minrpm', '400');
    set('set_spin_reversible', false, true);
    set('set_spin_tapcapable', true, true);
    const sp = window.ddcsGetSettings().spindle;
    return { present: true, interface: sp.interface, mappingAxis: sp.mappingAxis, minRpm: sp.minRpm, reversible: sp.reversible, tapCapable: sp.tapCapable };
  });
  expect(r.present, 'the SPINDLE section renders on the Machine tab with all fields').toBe(true);
  expect(r.interface, 'interface writes').toBe('pul-dir-axis');
  expect(r.mappingAxis, 'mapping axis writes').toBe('Z');
  expect(r.minRpm, 'min RPM writes as a number').toBe(400);
  expect(r.reversible, 'reversible writes (unchecked → false)').toBe(false);
  expect(r.tapCapable, 'tapCapable writes (the user attests the wiring)').toBe(true);
});

test('the spindle declaration defaults backfill on a legacy profile; it is profile-carried', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings);
  const r = await page.evaluate(async () => {
    const { applySettings, getSettings } = await import('/ui/settingsPanel.js');
    applySettings({ spindle: { maxRpm: 12000 } });   // a legacy profile with only the old VFD field
    const sp = getSettings().spindle;
    return { interface: sp.interface, tapCapable: sp.tapCapable, reversible: sp.reversible, mappingAxis: sp.mappingAxis, minRpm: sp.minRpm, maxRpm: sp.maxRpm };
  });
  expect(r.interface, 'interface backfills to the analog default').toBe('analog');
  expect(r.tapCapable, 'tapCapable backfills false — the user must opt in (never auto)').toBe(false);
  expect(r.reversible, 'reversible backfills true').toBe(true);
  expect(r.mappingAxis, 'mappingAxis backfills empty').toBe('');
  expect(r.minRpm, 'minRpm backfills 0').toBe(0);
  expect(r.maxRpm, 'the incoming maxRpm is preserved').toBe(12000);
});
