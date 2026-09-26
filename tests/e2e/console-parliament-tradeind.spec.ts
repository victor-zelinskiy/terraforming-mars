import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixtureSeats, crumbText, fetchPlayerModel, openCardActions, press, pressUntil, settle, waitForBoardHome, walkFocusUntil,
} from './consoleStart';
import {openColoniesSection} from './cardTradeDoor';

/**
 * TRADE INDUSTRIES (Turmoil Redux, RX28) — the ONE e2e of the new mechanic: the
 * first resolution action that COSTS something, as ONE FLOW through the action
 * workspace, its stages going IN TURN:
 *
 *   · the LAW stands in the action menu as a source beside the cards, and its
 *     tile prints the PRICE FOR THIS SEAT — the server's own chip, the discount
 *     taken (12 − 4 at influence 2 → 8), the influence and the discount as its
 *     basis, «можно титаном» as its note;
 *   · A opens the law's stage: the law's FACE is the hero, there is no pick
 *     and no hand — the stage states the price and its arithmetic
 *     («ДЕЙСТВИЯ КАРТ › ТОРГОВАЯ ИНДУСТРИЯ › НАСТРОЙКА»), A is «Купить флот»;
 *   · the answer raises the BILL, and the bill is the NEXT STAGE of the same
 *     flow («› ОПЛАТА»): the payment host stands INSIDE the stage, with a
 *     titanium lane the player can dial; nothing is granted yet;
 *   · one titanium in, A settles the bill: the fleet arrives (1 → 2), the
 *     stage reads it for a beat, and the flow LEAVES;
 *   · the server agrees: the fleet is 2, the use is spent, the titanium left
 *     the supply; the colonies screen shows the second ship; the menu lists
 *     the law's tile as ACTIVATED.
 *
 * Fixture `parliament-tradeind-enacted` (the law enacted, red opening
 * generation 2 at influence 2 with titanium in the supply). Screens under
 * screenshots/parliament-tradeind/.
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-tradeind');
const PRESET = {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'} as const;
const LAW = 'RDX_UNITY_TRADE_INDUSTRIES';

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_ROOT, {recursive: true});
  await page.screenshot({path: path.join(OUT_ROOT, `${name}.png`)});
}

type Wire = {
  thisPlayer: {color: string, megacredits: number, titanium: number, fleetSize: number},
  game: {parliament?: {
    enacted?: {resolution: string},
    viewer?: {resolutionAction?: {resolution: string, usesLeft: number, available: boolean, reason: string, preview: ReadonlyArray<{direction: string, icon: string, amount: number}>}},
  }},
  waitingFor?: {type?: string, resolutionActionPrompt?: {resolution: string, stage: string}},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

/** In «ДЕЙСТВИЯ КАРТ»: steer the cursor onto the LAW's tile (geometry-steered, the focused tile as the witness). */
async function focusLawTile(page: Page): Promise<void> {
  const focused = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-resolution') ?? '');
  await expect(page.locator(`.con-cardactions__tile[data-action-resolution="${LAW}"]`), 'the law\'s tile is in the menu').toHaveCount(1);
  for (let i = 0; i < 16 && await focused() !== LAW; i++) {
    const dir = await page.evaluate((target) => {
      const f = document.querySelector('.con-cardactions__tile--focused')?.getBoundingClientRect();
      const t = document.querySelector(`.con-cardactions__tile[data-action-resolution="${target}"]`)?.getBoundingClientRect();
      if (f === undefined || t === undefined) {
        return 'ArrowRight';
      }
      const dy = (t.top + t.height / 2) - (f.top + f.height / 2);
      const dx = (t.left + t.width / 2) - (f.left + f.width / 2);
      if (Math.abs(dy) > f.height / 2) {
        return dy > 0 ? 'ArrowDown' : 'ArrowUp';
      }
      return dx > 0 ? 'ArrowRight' : 'ArrowLeft';
    }, LAW);
    await press(page, dir, 260);
  }
  if (await focused() !== LAW) {
    await walkFocusUntil(page, async () => await focused() === LAW, focused, 30);
  }
  expect(await focused(), 'never focused the law\'s tile').toBe(LAW);
}

test.afterEach(async ({page}, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) {
    return;
  }
  const evidence = await page.evaluate(() => {
    const w = window as unknown as {__conReady?: () => unknown};
    return {ready: w.__conReady?.(), taskHosts: document.querySelectorAll('.con-task-host').length,
      bill: document.querySelector('[data-pact-bill]') !== null, phase: document.querySelector('.con-pact--resolution')?.getAttribute('data-pact-phase')};
  }).catch(() => undefined);
  if (evidence !== undefined) {
    const file = testInfo.outputPath('tradeind-evidence.json');
    fs.writeFileSync(file, JSON.stringify(evidence, undefined, 2));
    await testInfo.attach('tradeind-evidence', {path: file, contentType: 'application/json'});
  }
});

test.describe(`Trade Industries · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('the paid action is ONE flow: the price on the tile, the confirm, the bill INSIDE the stage (titanium dialed), the fleet gained, the tile spent', async ({page, request}) => {
    test.setTimeout(420_000);
    const pageLogs: Array<string> = [];
    page.on('console', (msg) => {
      if (msg.type() === 'warning' || msg.type() === 'error' || msg.text().includes('[console')) {
        pageLogs.push(`${msg.type()}: ${msg.text().slice(0, 300)}`);
      }
    });
    const {playerId} = await bootFixtureSeats(page, request, 'parliament-tradeind-enacted', {query: PRESET.query});
    const before = await wireOf(request, playerId);
    expect(before.game.parliament?.enacted?.resolution, 'the law stands enacted').toBe(LAW);
    const offered = before.game.parliament?.viewer?.resolutionAction;
    expect(offered, 'the server offers the action').toMatchObject({resolution: LAW, usesLeft: 1, available: true});
    const priced = offered!.preview.find((e) => e.direction === 'cost' && e.icon === 'megacredits');
    expect(priced?.amount, 'the server priced the fleet for this seat: 12 − 2 × influence 2').toBe(8);
    expect(before.thisPlayer.titanium, 'titanium to pay with').toBeGreaterThanOrEqual(1);
    expect(before.thisPlayer.fleetSize, 'one fleet to begin with').toBe(1);

    // ── ① THE SOURCE in the action menu: the law beside the cards, its tile priced for this seat.
    await waitForBoardHome(page, 40);
    await page.evaluate(() => {
      type Probe = {seenAt: number, to: string, wsUp: boolean, crumb: string, samples: number, timeline: Array<string>};
      const w = window as unknown as {__fleetProbe: Probe};
      w.__fleetProbe = {seenAt: 0, to: '', wsUp: false, crumb: '', samples: 0, timeline: []};
      let last = '';
      const sample = () => {
        w.__fleetProbe.samples++;
        const pact = document.querySelector('.con-pact--resolution');
        const state = [
          document.querySelector('.con-cardactions') !== null ? 'ws' : '-',
          pact === null ? 'nopact' : `pact:${pact.getAttribute('data-pact-phase')}`,
          document.querySelector('[data-pact-bill]') !== null ? 'bill' : '-',
          document.querySelector('[data-pact-result-fleet]') !== null ? 'RESULT' : '-',
          document.querySelectorAll('.con-task-host').length + 'host',
          JSON.stringify((window as unknown as {__conReady?: () => {partyFlow?: unknown}}).__conReady?.()?.partyFlow),
          Array.from(document.querySelectorAll('.con-wshead')).map((h) => (h.textContent ?? '').replace(/\s+/g, ' ').trim()).join('|'),
        ].join(' ');
        if (state !== last) {
          last = state;
          w.__fleetProbe.timeline.push(`${Math.round(performance.now())} ${state}`);
        }
        if (w.__fleetProbe.seenAt !== 0) {
          return;
        }
        const el = document.querySelector('[data-pact-result-fleet]');
        if (el === null) {
          return;
        }
        w.__fleetProbe.seenAt = Math.round(performance.now());
        w.__fleetProbe.to = document.querySelector('[data-pact-fleet-to]')?.textContent?.trim() ?? '';
        w.__fleetProbe.wsUp = document.querySelector('.con-cardactions') !== null;
        w.__fleetProbe.crumb = Array.from(document.querySelectorAll('.con-wshead')).map((h) => h.textContent ?? '').join(' | ');
      };
      new MutationObserver(sample).observe(document.body, {childList: true, subtree: true, characterData: true, attributes: true});
      setInterval(sample, 40);
    });
    await openCardActions(page);
    const tile = page.locator(`.con-cardactions__tile[data-action-resolution="${LAW}"]`);
    await expect(tile, 'the law is a source of «Действия карт»').toHaveCount(1);
    await expect(page.locator('.con-cardactions__plate', {hasText: /Торговая индустрия/i}), 'the plate names the law').toHaveCount(1);
    await focusLawTile(page);
    await settle(page, {timeoutMs: 10_000});
    const costBlock = page.locator('.con-cardactions__detail-block--cost');
    await expect(costBlock, 'the detail column states the cost').toHaveCount(1);
    const costText = (await costBlock.textContent() ?? '').replace(/\s+/g, ' ');
    expect(costText, `the chip reads the rail before → after the DISCOUNTED price (${costText})`).toMatch(new RegExp(`${before.thisPlayer.megacredits}\\s*→\\s*${before.thisPlayer.megacredits - 8}`));
    expect(costText, 'the discount is stated as the chip\'s own basis').toMatch(/Скидка[^0-9]*4/i);
    expect(costText, 'and titanium is named as a way to pay').toMatch(/титан/i);
    await shoot(page, '01-action-menu-price');

    // ── ② THE PRICE STAGE: the law's face is the hero, no pick, no hand — the price and its arithmetic, A is the verb.
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-pact--resolution').count() > 0, {tries: 3, settleMs: 1100}),
      'A opens the law\'s stage').toBeTruthy();
    await expect(page.locator('.con-pact--resolution [data-pact-price]'), 'the price row').toHaveCount(1, {timeout: 20_000});
    await expect(page.locator('.con-pact--resolution .con-pact__handzone'), 'no hand step — nothing is picked').toHaveCount(0);
    await expect(page.locator('.con-pact--resolution [data-pact-repeat-slot]'), 'no repeat slot either').toHaveCount(0);
    await expect(page.locator('.con-pact--resolution .con-pact__hero--bill .pcard'), 'the law\'s face is the hero').toBeVisible();
    await settle(page, {timeoutMs: 15_000});
    const line = (await page.locator('[data-pact-price-line]').textContent() ?? '').replace(/\s+/g, ' ');
    expect(line, `the arithmetic line names the price, the printed sum, the discount and the influence (${line})`).toMatch(/8/);
    expect(line).toMatch(/12/);
    expect(line).toMatch(/4/);
    let crumb = (await crumbText(page)).toUpperCase();
    expect(crumb, `one crumb: the menu, the law, the stage (${crumb})`).toContain('ДЕЙСТВИЯ КАРТ');
    expect(crumb).toContain('ТОРГОВАЯ ИНДУСТРИЯ');
    await expect(page.locator('[data-pact-cta][data-pact-ready]'), 'a confirm is ready by standing').toHaveCount(1);
    await expect(page.locator('[data-pact-cta] .con-pact__cta-label'), 'the server\'s own verb').toHaveText(/Купить флот/i);
    await shoot(page, '02-price-stage');

    // ── ③ A COMMITS — and the answer is the BILL, hosted INSIDE the stage as its next stage; nothing granted yet.
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-pact--resolution [data-pact-bill]').count() > 0, {tries: 3, settleMs: 1200}),
      'the confirm raises the bill in the stage').toBeTruthy();
    const host = page.locator('.con-pact--resolution [data-embed-slot="action-bill"] .con-task-host');
    await expect(host, 'the payment host stands INSIDE the stage').toHaveCount(1, {timeout: 20_000});
    await expect(page.locator('.con-task-host:not(.con-task-host--embedded)'), 'never a standalone payment band').toHaveCount(0);
    const titaniumLane = host.locator('.con-payrow[data-pay-unit="titanium"]');
    await expect(titaniumLane, 'the titanium lane is offered').toHaveCount(1);
    await settle(page, {timeoutMs: 15_000});
    crumb = (await crumbText(page)).toUpperCase();
    expect(crumb, `the crumb only gained a tail (${crumb})`).toContain('ТОРГОВАЯ ИНДУСТРИЯ');
    expect(crumb).toContain('ОПЛАТА');
    const mid = await wireOf(request, playerId);
    expect(mid.waitingFor?.type, 'the server waits on the bill').toBe('payment');
    expect(mid.waitingFor?.resolutionActionPrompt, 'stamped with the law\'s marker at stage pay').toMatchObject({resolution: LAW, stage: 'pay'});
    expect(mid.thisPlayer.fleetSize, 'NOTHING is granted before the bill is settled').toBe(1);
    expect(mid.game.parliament?.viewer?.resolutionAction?.usesLeft, 'and the use is not spent').toBe(1);
    // Dial ONE titanium into the bill (RB on the focused lane), then settle it with A.
    expect(await pressUntil(page, 'KeyE', async () => (await titaniumLane.getAttribute('class') ?? '').includes('con-payrow--live'), {tries: 3, settleMs: 500}),
      'RB puts one titanium into the bill').toBeTruthy();
    await shoot(page, '03-bill-with-titanium');

    // ── ④ THE CLOSING BEAT reads the fleet (1 → 2) INSIDE the stage, then the flow LEAVES on its own.
    //    The beat is short (one reading), and the fleet was the seat's LAST action — the turn passes with the
    //    answer — so the witness is armed BEFORE the press (MutationObserver + setInterval, never rAF) and
    //    read from its samples: the stage must be seen reading «1 → 2» while the workspace still stands.
    const readProbe = () => page.evaluate(() => (window as unknown as {__fleetProbe: {seenAt: number, to: string, wsUp: boolean, crumb: string, samples: number, timeline: Array<string>}}).__fleetProbe);
    await press(page, 'Enter', 250);
    // Best effort — the beat may still be on screen for the frame.
    if (await page.locator('[data-pact-result-fleet]').count() > 0) {
      await shoot(page, '04-fleet-result');
    }
    await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.fleetSize, {timeout: 30_000, message: 'A settles the bill and the fleet arrives'}).toBe(2);
    const seen = await expect.poll(async () => (await readProbe()).seenAt, {timeout: 15_000, message: 'the stage read the fleet that arrived'}).toBeGreaterThan(0)
      .then(() => true, () => false);
    if (!seen) {
      const failed = await readProbe();
      throw new Error(`the stage never read the fleet that arrived — timeline:\n${failed.timeline.join('\n')}\nconsole:\n${pageLogs.slice(-60).join('\n')}`);
    }
    const probe = await readProbe();
    expect(probe.to, 'the reading names the count after').toBe('2');
    expect(probe.wsUp, 'read INSIDE the workspace, before the flow left').toBe(true);
    expect(probe.crumb.toUpperCase(), `the crumb still named the law at the reading (${probe.crumb})`).toContain('ТОРГОВАЯ ИНДУСТРИЯ');
    expect(probe.samples, 'the probe was alive').toBeGreaterThan(5);
    await waitForBoardHome(page, 40);
    await expect(page.locator('.con-cardactions'), 'a finished flow leaves the workspace').toHaveCount(0);
    await settle(page, {timeoutMs: 20_000});
    const after = await wireOf(request, playerId);
    expect(after.thisPlayer.fleetSize, '+1 fleet').toBe(2);
    // The panel dials the alternative lane to what it can cover by default (two titanium = 6 M€) and RB is clamped there:
    // whatever mix the player settled, titanium LEFT the supply and the bill adds up to the discounted 8 at the engine's rate.
    const titaniumPaid = before.thisPlayer.titanium - after.thisPlayer.titanium;
    const megacreditsPaid = before.thisPlayer.megacredits - after.thisPlayer.megacredits;
    expect(titaniumPaid, 'titanium left the supply').toBeGreaterThanOrEqual(1);
    expect(megacreditsPaid + 3 * titaniumPaid, `the bill adds up to the discounted price (${megacreditsPaid} M€ + ${titaniumPaid} × 3)`).toBe(8);
    expect(after.game.parliament?.viewer?.resolutionAction).toMatchObject({usesLeft: 0, available: false});

    // ── ⑤ THE FLEET IS VISIBLE where fleets live: the colonies screen shows two ships for the viewer.
    await openColoniesSection(page);
    await settle(page, {timeoutMs: 15_000});
    const mine = page.locator('.con-colonies__fleetchip--me');
    await expect(mine, 'the viewer\'s fleet chip').toHaveCount(1);
    const chipLabel = await mine.locator('[aria-label]').first().getAttribute('aria-label');
    expect(chipLabel, 'two fleets, both free').toBe('2/2');
    await shoot(page, '05-fleet-counter');
    await press(page, 'Escape', 900);
    await waitForBoardHome(page, 40);

    // ── ⑥ THE USE IS SPENT: the tile leaves the default view and reads as activated.
    await openCardActions(page);
    await expect(tile, 'a spent action leaves the default view').toHaveCount(0);
    expect(await pressUntil(page, 'Period', async () => await page.locator(`.con-cardactions__tile--activated[data-action-resolution="${LAW}"]`).count() > 0, {tries: 3, settleMs: 700}),
      'RT shows the activated actions: the law\'s tile is there, spent').toBeTruthy();
    await settle(page, {timeoutMs: 10_000});
    await shoot(page, '06-tile-spent');
  });
});
