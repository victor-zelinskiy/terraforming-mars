import {test, expect, Page} from '@playwright/test';

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
 */

// A pad whose A (button 0) is HELD from creation → faithfully models a physical
// button still down when the page mounts (the exit-confirm A across the reload).
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
      navigator.getGamepads = function () { return [pad, null, null, null]; };
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
    create: document.querySelectorAll('[class*="con-create"], [class*="create-game"]').length,
  }));
}

test('held button across reload does NOT auto-activate the menu; a fresh press does', async ({page}) => {
  test.setTimeout(60_000);

  // 1. Load main menu with an IDLE pad.
  await page.addInitScript(padInit(false));
  await page.goto('/?console=1');
  await page.waitForTimeout(2000);
  console.log('main menu (idle pad):', JSON.stringify(await state(page)));

  // 2. Reload with A HELD from the first frame (the carried-over exit-confirm).
  await page.addInitScript(padInit(true));
  await page.reload();
  await page.waitForTimeout(2500);
  const afterHeld = await state(page);
  console.log('after reload with A held:', JSON.stringify(afterHeld));
  expect(afterHeld.path, 'held A across reload must NOT navigate away from main menu').toBe('/');
  expect(afterHeld.create, 'held A must NOT open the create screen').toBe(0);

  // 3. Release A, then a FRESH press must still act (activate cursor 0 → create).
  await page.evaluate(() => (window as any).__set(0, false));
  await page.waitForTimeout(200);
  await page.evaluate(() => (window as any).__set(0, true));
  await page.waitForTimeout(120);
  await page.evaluate(() => (window as any).__set(0, false));
  await page.waitForTimeout(2000);
  const afterFresh = await state(page);
  console.log('after fresh A press:', JSON.stringify(afterFresh));
  expect(afterFresh.path, 'a genuine fresh press must still act').not.toBe('/');
});
