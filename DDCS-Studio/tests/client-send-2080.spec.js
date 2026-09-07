import { test, expect } from '@playwright/test';

/**
 * client-send-2080 — A CLIENT WITH NO GATEWAY CAN STILL SEND (t2080b).
 *
 * Reported live from a phone: "I'm connected, and the send button doesn't do anything. Not even fail or
 * success. Just silence." TWO causes, both mine:
 *   1. the first cut referenced a `bridged` variable that does not exist in send.js -> ReferenceError per click;
 *   2. the real one — t1327 DISARMS Send whenever no gateway answers. That was right when the gateway was the
 *      only transport, and wrong once a signed-in client can put the job in Drive: the button was dead on the
 *      exact device the Drive path exists for.
 * ⭐ This is the strongest argument for the ROLES feature (ROLES-PLAN.md): "no gateway" is an ERROR for a
 * gateway machine and NORMAL for a client, and the code had no way to tell them apart.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const openSend = async (page, { signedIn }) => {
  await page.route('**/api/**', (r) => r.abort());          // no gateway answering — the phone/client case
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
  if (signedIn) await page.evaluate(() => localStorage.setItem('ddcs_cloud_token', 'fake-token'));
  else await page.evaluate(() => localStorage.removeItem('ddcs_cloud_token'));
  await page.evaluate(() => window.showApp && window.showApp('gateway'));
  // de-sleep (Phase 2 browser-tier wait audit) — the real precondition for the click below is the tab bar existing (initGatewayPanel()
  // builds it synchronously inside the showApp() promise this evaluate() already awaited); poll for it
  // directly instead of a blind guess.
  await page.waitForFunction(() => [...document.querySelectorAll('#gateway-app .settings-main-tab')].some((b) => b.textContent.trim() === 'Send'), null, { timeout: 5000 });
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('#gateway-app .settings-main-tab')].find((b) => b.textContent.trim() === 'Send');
    if (t) t.click();
  });
  // de-sleep (Phase 2 browser-tier wait audit) — the real precondition callers need is the Send view's own mount() having run (its
  // applyState() call sets the button's final text synchronously — traced through send.js, it does not
  // depend on the async heartbeat round-trip for text/title/disabled here); poll for the button existing
  // with its expected text instead of guessing how long the mount takes.
  await page.waitForFunction(() => [...document.querySelectorAll('#gateway-app button:not(.settings-main-tab)')].some((b) => /^Send( via Drive)?$/.test(b.textContent.trim())), null, { timeout: 5000 });
};

// the SEND CONTROL, not the tab of the same name
// t2649 (BACKLOG #78) — the label used to also be 'Send (tracked)'/'Send (deliver-only)' (the removed
// Beacons checkbox); every send is now just 'Send' or 'Send via Drive' — IDENTICAL, for the bare case, to
// the L1 GATEWAY nav tab's own "Send" text (`.settings-main-tab`). Excluding that class is now required,
// where the old parenthetical used to make the two texts naturally distinct.
const sendBtn = (page) => page.evaluate(() => {
  const b = [...document.querySelectorAll('#gateway-app button:not(.settings-main-tab)')]
    .find((x) => /^Send( via Drive)?$/.test(x.textContent.trim()));
  return b ? { text: b.textContent.trim(), disabled: b.disabled, title: b.title } : null;
});

test('signed-in client, no gateway: Send offers the DRIVE route instead of going dead', async ({ page }) => {
  await openSend(page, { signedIn: true });
  const b = await sendBtn(page);
  expect(b, 'the send control renders').not.toBeNull();
  expect(b.text, 'it names the transport a click will actually use').toBe('Send via Drive');
  expect(b.title.toLowerCase(), 'and says why there is no gateway involved').toContain('drive');
});

test('no gateway AND no account: the old contract stands — disarmed, with its reason', async ({ page }) => {
  await openSend(page, { signedIn: false });
  const b = await sendBtn(page);
  expect(b).not.toBeNull();
  expect(b.text, 'no Drive route is claimed without an account').not.toContain('Drive');
  expect(b.disabled, 'nothing can carry the job, so Send stays disarmed').toBe(true);
});

test('the label has ONE source — a re-sync cannot clobber the Drive label', async ({ page }) => {
  // t2080b — sync() (mount-time) and applyState() (every status tick) both used to set this label from
  // DIFFERENT branches; whichever ran last won, so the button could silently claim a transport it was not
  // going to use. t2649 (BACKLOG #78) removed the Beacons checkbox that used to be this test's own trigger
  // for a re-sync (`sync()` is now static — nothing left in the form to toggle); a poll tick is the one
  // remaining real trigger, so this waits one out instead.
  await openSend(page, { signedIn: true });
  await page.waitForTimeout(1500);   // let a real status-poll tick call applyState() again
  const b = await sendBtn(page);
  expect(b.text, 'still the Drive route after a re-sync').toBe('Send via Drive');
});
