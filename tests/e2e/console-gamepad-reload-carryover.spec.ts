import {test, expect, Page} from './consoleTest';
import {reloadMenu} from './consoleStart';
import {armWitness} from './witness';

/**
 * Regression: a gamepad button STILL HELD across a game-boundary reload
 * (navigateWithCurtain does a full `window.location.assign`) must not read as a
 * fresh press on the freshly-loaded page.
 *
 * The bug it guards: System menu → "To main menu" is confirmed with A. That A is
 * typically still down when the new main-menu page mounts. Before the
 * gamepadCore first-poll seed, the empty baseline read the held A as a `confirm`
 * press-edge and auto-activated the focused menu item — with a warm joinable
 * cache that is "Continue", which navigated straight back into the game ("exit
 * to menu does nothing the 2nd time"). The pad is injected via a getGamepads
 * override (Playwright can't emit real Gamepad input).
 *
 * Every wait is for a STATE of the page: the gamepad core has POLLED the injected
 * pad (the pad counts its own reads — an edge is only born by diffing two reads,
 * so «the core has read the pad N times since the change» is exactly «the core
 * has seen the change»), never a guessed duration.
 */

// A pad whose A (button 0) is HELD from creation → faithfully models a physical
// button still down when the page mounts (the exit-confirm A across the reload).
// `__padReads` counts the page's reads of the pad — the poll's own pulse.
function padInit(aHeld: boolean) {
  return `
    (function () {
      var held = ${aHeld ? 'true' : 'false'};
      var pad = {
        index: 0, id: 'Xbox 360 Controller (STANDARD GAMEPAD)', connected: true,
        mapping: 'standard', timestamp: 1,
        buttons: Array.from({length: 17}, function (_, i) {
          var on = held && i === 0;
          return {pressed: on, touched: on, value: on ? 1 : 0};
        }),
        axes: [0, 0, 0, 0],
      };
      window.__padReads = 0;
      navigator.getGamepads = function () {
        window.__padReads = (window.__padReads || 0) + 1;
        return [pad, null, null, null];
      };
      window.__pad = pad;
      window.__set = function (i, on) {
        pad.buttons[i] = {pressed: !!on, touched: !!on, value: on ? 1 : 0};
        pad.timestamp = performance.now();
      };
      setTimeout(function () {
        try { window.dispatchEvent(new GamepadEvent('gamepadconnected', {gamepad: pad})); } catch (e) {}
      }, 150);
    })();
  `;
}

async function state(page: Page) {
  return page.evaluate(() => ({
    path: location.pathname,
    mainMenu: document.querySelectorAll('[class*="cm-"]').length,
    create: document.querySelectorAll('.cm-create').length,
  }));
}

/** How many times this document has read the injected pad. */
async function padReads(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as {__padReads?: number}).__padReads ?? 0);
}

/**
 * Wait until the page has read the pad `n` more times — the gamepad core's poll has SEEN what the pad holds now
 * (the poll runs on its own timer while a pad is connected, so this is its pulse, never a duration).
 */
async function padPolled(page: Page, n: number, what: string): Promise<void> {
  const from = await padReads(page);
  await expect.poll(() => padReads(page), {message: `the gamepad core never polled the pad (${what})`, timeout: 15_000})
    .toBeGreaterThanOrEqual(from + n);
}

test('held button across reload does NOT auto-activate the menu; a fresh press does', async ({page}) => {
  test.setTimeout(60_000);

  // 1. Load main menu with an IDLE pad — the menu standing, its veil gone, the core polling the pad.
  await page.addInitScript(padInit(false));
  await page.goto('/?console=1');
  await page.waitForSelector('.cm-menu', {timeout: 60_000});
  await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 60_000}).catch(() => {});
  await padPolled(page, 4, 'the idle pad on the first load');
  console.log('main menu (idle pad):', JSON.stringify(await state(page)));

  // 2. Reload with A HELD from the first frame (the carried-over exit-confirm). WHERE THE PAGE STANDS is RECORDED from
  //    before the reload, across it (the recorder lives in every new document): «the held A did not act» is a claim
  //    about the whole window, never one look at its end. A confirm on the menu's focused item acts in the very poll
  //    tick that reads its edge (the route changes in that task), so once the core has polled the HELD pad well past
  //    its first sighting, an edge it would have read is behind the record.
  const where = await armWitness(page, 'menu-where', () => ({
    path: location.pathname,
    create: document.querySelectorAll('.cm-create').length,
  }));
  await page.addInitScript(padInit(true));
  await reloadMenu(page);
  await padPolled(page, 12, 'the held pad after the reload');
  const afterHeld = await state(page);
  console.log('after reload with A held:', JSON.stringify(afterHeld), 'recorded:', JSON.stringify(await where.values()));
  expect(await where.ever((s) => s.path !== '/'), 'held A across reload must NOT navigate away from main menu').toBe(false);
  expect(await where.ever((s) => s.create > 0), 'held A must NOT open the create screen').toBe(false);
  await where.stop();

  // 3. Release A, then a FRESH press must still act (activate cursor 0 → create). Each edge is held until the core
  //    has polled it — a press+release that falls between two reads is invisible to the core by design.
  await page.evaluate(() => (window as any).__set(0, false));
  await padPolled(page, 4, 'A released');
  await page.evaluate(() => (window as any).__set(0, true));
  await padPolled(page, 4, 'A pressed');
  await page.evaluate(() => (window as any).__set(0, false));
  await expect.poll(() => state(page).then((s) => s.path, () => '(navigating)'),
    {message: 'a genuine fresh press must still act', timeout: 10_000}).not.toBe('/');
  const afterFresh = await state(page).catch(() => ({path: '(navigating)', mainMenu: -1, create: -1}));
  console.log('after fresh A press:', JSON.stringify(afterFresh));
});
