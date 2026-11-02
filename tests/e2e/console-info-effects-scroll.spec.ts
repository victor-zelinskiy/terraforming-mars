import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, focusInfoZone, press, pressUntil, settle} from './consoleStart';

/**
 * «ИНФОРМАЦИЯ › ЭФФЕКТЫ» SCROLLS (the owner's 4K frame of 2026-11-02: «при просмотре эффектов не работает скролл — ни
 * правым стиком, ни при навигации на d-pad»). On a table whose effects do not fit the grid (`info-dossier-rich`, 40
 * played cards):
 *
 *   (A) THE D-PAD — every step down keeps the cursored tile INSIDE the grid's viewport, and the grid scrolls to follow
 *       it (the defect: every step pinned the list back to the top — a stale «first row» index);
 *   (B) THE RIGHT STICK — moves the grid (the defect: the shell never routed the stick to the Information route).
 *
 * The stick is a stubbed pad (`navigator.getGamepads`, the wheel spec's harness): the keyboard has no right stick.
 */
const FIXTURE = 'info-dossier-rich';
const TV = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;

const viewport = (page: Page) => page.locator('.con-efx__list .con-scroll-area__viewport');

/** The grid's scroll + the cursored tile's box against the viewport's. */
const gridState = (page: Page) => page.evaluate(() => {
  const vp = document.querySelector<HTMLElement>('.con-efx__list .con-scroll-area__viewport');
  const tile = document.querySelector<HTMLElement>('.con-efx__tile--focused');
  if (vp === null || tile === null) {
    return undefined;
  }
  const v = vp.getBoundingClientRect();
  const t = tile.getBoundingClientRect();
  return {
    scrollTop: Math.round(vp.scrollTop),
    maxScroll: vp.scrollHeight - vp.clientHeight,
    key: tile.getAttribute('data-effect-key') ?? '',
    inView: t.top >= v.top - 1 && t.bottom <= v.bottom + 1,
  };
});

/** A stubbed pad with a settable right stick (axes 2/3). */
async function installPad(page: Page): Promise<void> {
  await page.evaluate(() => {
    const pad = {
      id: 'e2e-pad (STANDARD GAMEPAD Vendor: 045e Product: 028e)',
      index: 0,
      connected: true,
      mapping: 'standard',
      timestamp: performance.now(),
      buttons: Array.from({length: 17}, () => ({pressed: false, touched: false, value: 0})),
      axes: [0, 0, 0, 0],
    };
    navigator.getGamepads = function() {
      return [pad, null, null, null] as unknown as ReturnType<typeof navigator.getGamepads>;
    };
    (window as unknown as {__rstick: (y: number) => void}).__rstick = (y: number) => {
      pad.axes = [0, 0, 0, y];
      pad.timestamp = performance.now();
    };
    try {
      window.dispatchEvent(new GamepadEvent('gamepadconnected', {gamepad: pad as unknown as Gamepad}));
    } catch (e) {
      const ev = new Event('gamepadconnected') as Event & {gamepad: typeof pad};
      ev.gamepad = pad;
      window.dispatchEvent(ev);
    }
  });
}

const rightStick = (page: Page, y: number) => page.evaluate((sy) => (window as unknown as {__rstick: (y: number) => void}).__rstick(sy), y);

test.describe(`Information › Effects scrolls · ${TV.id}`, () => {
  test.use({viewport: TV.viewport});

  test('(A) the d-pad keeps the cursor in view and scrolls the grid · (B) the right stick scrolls it', async ({page, request}) => {
    test.setTimeout(300_000);
    const pageErrors: Array<string> = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await bootFixtureSeats(page, request, FIXTURE, {query: TV.query});
    await settle(page);
    expect(await pressUntil(page, 'KeyY', async () => await page.locator('.con-info [data-dossier]').count() > 0, {tries: 4, settleMs: 1100}),
      'Y opens the Information dossier').toBe(true);
    await settle(page, {timeoutMs: 20_000});
    expect(await focusInfoZone(page, 'effects'), 'the ring reaches the effects zone').toBe(true);
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-efx').count() > 0, {tries: 3, settleMs: 1100}),
      'A on the effects zone opens the explorer').toBe(true);
    await settle(page, {timeoutMs: 20_000});
    await expect(viewport(page)).toHaveCount(1);

    const start = await gridState(page);
    expect(start, 'the grid and its cursor stand').toBeDefined();
    expect(start!.maxScroll, 'the fixture\'s effects overflow the grid — the subject of this spec').toBeGreaterThan(50);
    expect(start!.scrollTop, 'the grid opens at its top').toBe(0);

    // ── (A) THE D-PAD: walk down to the last row; the cursor never leaves the viewport, the grid follows it. ──
    const trail: Array<string> = [];
    let last = start!.key;
    for (let step = 0; step < 40; step++) {
      await press(page, 'ArrowDown', 350);
      await expect.poll(async () => (await gridState(page))?.inView,
        `step ${step}: the cursored tile stands inside the viewport (trail: ${trail.join(' → ')})`).toBe(true);
      const now = await gridState(page);
      trail.push(`${now!.key}@${now!.scrollTop}`);
      if (now!.key === last) {
        break; // the last row — a wall
      }
      last = now!.key;
    }
    await expect.poll(async () => (await gridState(page))?.scrollTop ?? 0,
      `the d-pad walk scrolled the grid (trail: ${trail.join(' → ')})`).toBeGreaterThan(0);

    // Back to the first row — the grid returns to its top.
    for (let step = 0; step < 40; step++) {
      const before = (await gridState(page))?.key;
      await press(page, 'ArrowUp', 300);
      if ((await gridState(page))?.key === before) {
        break;
      }
    }
    await expect.poll(async () => (await gridState(page))?.scrollTop ?? -1, 'the first row returns the grid to its top').toBe(0);

    // ── (B) THE RIGHT STICK: a held deflection pages the grid down, the opposite one back up. ──
    await installPad(page);
    await rightStick(page, 1);
    await expect.poll(async () => (await gridState(page))?.scrollTop ?? 0, 'the right stick (down) scrolls the grid')
      .toBeGreaterThan(40);
    await rightStick(page, 0);
    const paged = (await gridState(page))!.scrollTop;
    await rightStick(page, -1);
    await expect.poll(async () => (await gridState(page))?.scrollTop ?? paged, 'the right stick (up) scrolls it back')
      .toBeLessThan(paged);
    await rightStick(page, 0);

    expect(pageErrors, `no page errors; saw: ${pageErrors.join(' | ')}`).toEqual([]);
  });
});
