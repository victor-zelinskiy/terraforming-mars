import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, fetchPlayerModel, press, settle} from './consoleStart';

/**
 * THE PROTECTED THIRD POOL OF THE HYDRONETWORK PRICE — Modular Floodgates
 * steel under Delta Works (the repeat audit, the owner's call of 2026-11-09:
 * «no rejected commit — everything is decided at the pre-select»).
 *
 * The server counted the steel stored on Modular Floodgates in the move's
 * budget, while the console could never send that share: the destination read
 * affordable, the commit went out short, the server refused it and the bare
 * amount prompt surfaced. The composition step now carries the Floodgates
 * lane — at 0 by default (a protected pool is never auto-taken), so the draft
 * honestly reads SHORT and the final confirm is refused BY THE CONSOLE until
 * the player raises it; then the ordinary pipeline commits, steel off the card.
 *
 * Fixture `hydro-floodgates-mix`: position 2, all row tags, 1 energy, no stock
 * steel, 3 steel on Modular Floodgates → «К дальнему» is stage 6 (4 steps).
 */

type Wire = Record<string, any>;

async function serverState(request: APIRequestContext, id: string): Promise<{position: number, energy: number, onCard: number}> {
  const model = await fetchPlayerModel(request, id) as Wire;
  const me = model.thisPlayer as Wire;
  const card = (me.tableau ?? []).find((c: Wire) => c.name === 'Modular Floodgates');
  return {position: me.deltaProject?.position ?? -1, energy: me.energy, onCard: card?.resources ?? -1};
}

async function readPanel(page: Page): Promise<{units: Array<string>, used: Record<string, string>, focused: string, status: string}> {
  return page.evaluate(() => {
    const root = document.querySelector('.con-hydro__layer--payment .con-pay');
    const used: Record<string, string> = {};
    const units: Array<string> = [];
    let focused = '';
    for (const row of Array.from(root?.querySelectorAll('.con-payrow') ?? [])) {
      const unit = row.getAttribute('data-pay-unit') ?? '';
      units.push(unit);
      used[unit] = (row.querySelector('.con-payrow__used') as HTMLElement | null)?.innerText.trim() ?? '';
      if (row.classList.contains('con-payrow--focused')) {
        focused = unit;
      }
    }
    const status = Array.from(root?.querySelector('.con-paystatus')?.classList ?? [])
      .find((c) => /^con-paystatus--(exact|short|free|overpay|impossible)$/.test(c))?.replace('con-paystatus--', '') ?? '';
    return {units, used, focused, status};
  });
}

test.describe('Hydronetwork · the Modular Floodgates lane · tv4k', () => {
  test.use({
    viewport: {width: 3840, height: 2160},
    deviceScaleFactor: 1,
    screen: {width: 3840, height: 2160},
  });

  test('short by default → the console refuses the confirm → the player raises the Floodgates lane → the move commits', async ({page, request}) => {
    test.setTimeout(240_000);
    const playerId = await bootFixture(page, request, 'hydro-floodgates-mix', {query: '&consoleProfile=tv'});
    await settle(page);
    const before = await serverState(request, playerId);
    expect(before, 'the fixture table').toEqual({position: 2, energy: 1, onCard: 3});

    // ── Open the Hydronetwork; RT «К дальнему» = stage 6 (4 steps). ──
    await press(page, 'Period', 1100);
    await press(page, 'ArrowLeft', 1600);
    await page.waitForSelector('.con-hydro', {timeout: 10_000});
    await press(page, 'Period', 900);
    await expect.poll(() => page.evaluate(() =>
      document.querySelector('.con-hydro__stop--focused')?.getAttribute('data-hydro-stop') ?? ''),
    {timeout: 10_000, message: 'the farthest stage the three pools reach is stage 6'}).toBe('6');

    // ── CONFIGURE → PAYMENT: a live Floodgates lane always opens the step. ──
    await press(page, 'Enter', 1200);
    await page.waitForSelector('.con-hydro__layer--payment .con-pay', {timeout: 10_000});
    const short = await readPanel(page);
    expect(short.units, 'the protected lane stands beside energy').toEqual(['floodgateSteel', 'energy']);
    expect(short.used.floodgateSteel, 'never auto-taken').toBe('0');
    expect(short.status, 'the draft reads short').toBe('short');

    // ── The console refuses the short confirm itself: nothing leaves. ──
    await press(page, 'Enter', 1500);
    await page.waitForSelector('.con-hydro__layer--payment .con-pay', {timeout: 5_000});
    expect(await serverState(request, playerId), 'a short draft is never submitted').toEqual(before);

    // ── The player raises the lane (RB × 3) → exact. ──
    for (let i = 0; i < 3; i++) {
      await press(page, 'KeyE', 600);
    }
    await expect.poll(async () => (await readPanel(page)).status, {timeout: 10_000, message: 'the raised lane pays the move'}).toBe('exact');
    const paid = await readPanel(page);
    expect(paid.used.floodgateSteel).toBe('3');
    expect(paid.used.energy).toBe('1');

    // ── RESOLVE: the ordinary pipeline, steel off the card. ──
    await press(page, 'Enter', 2000);
    await expect.poll(async () => (await serverState(request, playerId)).position,
      {timeout: 20_000, message: 'the marker advanced on the server'}).toBe(6);
    const after = await serverState(request, playerId);
    expect(after.onCard, 'the Floodgates steel left the card').toBe(0);
    expect(after.energy, 'the one energy paid the rest').toBe(0);
    await settle(page);
  });
});
