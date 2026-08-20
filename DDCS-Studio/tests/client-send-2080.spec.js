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
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('#gateway-app .settings-main-tab')].find((b) => b.textContent.trim() === 'Send');
    if (t) t.click();
  });
  await page.waitForTimeout(700);
};

// the SEND CONTROL, not the tab of the same name
const sendBtn = (page) => page.evaluate(() => {
  const b = [...document.querySelectorAll('#gateway-app button')]
    .find((x) => /^Send (via Drive|\(tracked\)|\(deliver-only\))/.test(x.textContent.trim()));
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

test('the label has ONE source — a beacons toggle cannot clobber the Drive label', async ({ page }) => {
  // sync() (beacons checkbox) and applyState() (every status tick) both set this label; whichever ran last
  // won, so the button could silently claim a transport it was not going to use.
  await openSend(page, { signedIn: true });
  await page.evaluate(() => {
    const cb = [...document.querySelectorAll('#gateway-app input[type=checkbox]')][0];
    if (cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await page.waitForTimeout(300);
  const b = await sendBtn(page);
  expect(b.text, 'still the Drive route after a re-sync').toBe('Send via Drive');
});
