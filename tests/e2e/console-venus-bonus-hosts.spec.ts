import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, bootFixtureSeats, crumbText, fetchPlayerModel, openActionFocus, openCardActions, playCardFromHand, press, pressUntil,
  reloadConsole, settle, walkFocusUntil,
} from './consoleStart';

/**
 * THE VENUS BONUS IS A STEP OF ITS HOST (P89 · ledger EE — the owner's law of 2026-11-01: «бонус шкалы Венеры ВСЕГДА
 * встраивается embedded в ту поверхность, где сработал»), the TV profile. Every door a Venus step can come through, on
 * the ALTERNATIVE board (the creator's default): the question stands INSIDE the workspace the press was made in — the
 * same `ConsoleVenusBonus` teleported into the host's zone, its stage named by the host's crumb («… › БОНУС ВЕНЕРЫ»),
 * never a band of its own (`.con-lanes.con-ws`) — is answered there, and the workspace then leaves. With no host (a
 * reload mid-bonus) the band stands on its own, after the board told the step.
 *
 * Screens under screenshots/venus-bonus-hosts/.
 */
const OUT = path.resolve('screenshots', 'venus-bonus-hosts');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const ACTION_COMPOSER = '.con-cardactions__stagewrap .con-composer--stage';
const SHUTTLES = 'Venus Shuttles';
const LAW = 'RDX_SCIENTISTS_RD_FUNDING';

type Wire = {
  thisPlayer: {megacredits: number, steel: number, titanium: number, plants: number, energy: number, heat: number,
    tableau: Array<{name: string, resources?: number}>},
  game: {venusScaleLevel: number},
  waitingFor?: {venusBonusPrompt?: {kind: string}},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;
const stock = (w: Wire) => w.thisPlayer.megacredits + w.thisPlayer.steel + w.thisPlayer.titanium + w.thisPlayer.plants +
  w.thisPlayer.energy + w.thisPlayer.heat;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${PRESET.id}-${name}.png`)});
}

/**
 * The HOSTED witness: a sampler (MutationObserver + setInterval, never rAF) records whether a STANDALONE bonus band
 * (`.con-lanes.con-ws`) ever stood while the test ran, and where the hosted surface first appeared.
 */
async function armBonusWitness(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__bonusWitness?: {band: number, hosted: string}};
    const state = {band: 0, hosted: ''};
    w.__bonusWitness = state;
    const take = () => {
      if (document.querySelector('.con-lanes.con-ws') !== null) {
        state.band++;
      }
      const hosted = document.querySelector('.con-venus[data-venus-bonus-embedded]');
      if (hosted !== null && state.hosted === '') {
        state.hosted = hosted.closest('.con-cardactions') !== null ? 'card-actions' :
          hosted.closest('.con-hand') !== null ? 'hand' :
            hosted.closest('.con-stdp') !== null ? 'standard-projects' :
              hosted.closest('.con-colonies') !== null ? 'colonies' : 'elsewhere';
      }
    };
    new MutationObserver(take).observe(document.body, {subtree: true, childList: true});
    setInterval(take, 50);
  });
}
const witnessOf = (page: Page) => page.evaluate(() => (window as unknown as {__bonusWitness: {band: number, hosted: string}}).__bonusWitness);

/**
 * THE CELL WITNESS (PL-1436): every transfer chip at its FIRST sample — its icon and its centre — beside the centre of
 * the bonus cell `key` (`.bonus-zone[data-arc-marker]`). The chosen resource must be born ON the cell the step reached.
 */
async function armCellWitness(page: Page, key: string): Promise<void> {
  await page.evaluate((cellKey) => {
    const w = window as unknown as {__cellWitness?: {chips: Array<{icon: string, x: number, y: number}>, cell?: {x: number, y: number, w: number}}};
    const state: {chips: Array<{icon: string, x: number, y: number}>, cell?: {x: number, y: number, w: number}} = {chips: []};
    w.__cellWitness = state;
    const seen = new WeakSet<Element>();
    const take = () => {
      const cell = document.querySelector(`.bonus-zone[data-arc-marker="${cellKey}"]`)?.getBoundingClientRect();
      if (cell !== undefined && cell.width > 1) {
        state.cell = {x: cell.left + cell.width / 2, y: cell.top + cell.height / 2, w: cell.width};
      }
      document.querySelectorAll('.con-transfer__chip').forEach((chip) => {
        if (seen.has(chip)) {
          return;
        }
        const box = chip.getBoundingClientRect();
        // The director PLACES a chip (its transform written) before it shows it; the bare insertion sits at the layer's
        // origin and says nothing about where the token is born.
        if (box.width < 1 || getComputedStyle(chip).transform === 'none') {
          return;
        }
        seen.add(chip);
        const icon = chip.querySelector('.con-transfer__icon')?.className ?? (chip.querySelector('.con-transfer__amt--mc') !== null ? 'megacredits' : '');
        state.chips.push({icon: String(icon), x: box.left + box.width / 2, y: box.top + box.height / 2});
      });
    };
    new MutationObserver(take).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['style']});
    setInterval(take, 30);
  }, key);
}
/**
 * Every chip that is NOT the bonus's: the stands pick STEEL, a resource neither the press (its price is M€) nor the
 * step's rating (the TR sprite) ever moves — so the witness tells the bonus's own token apart by its icon alone.
 */
function isRatingIcon(icon: string): boolean {
  return !icon.includes('steel');
}
async function expectBornOnCell(page: Page, key: string): Promise<void> {
  await expect.poll(async () => (await page.evaluate(() =>
    (window as unknown as {__cellWitness: {chips: Array<{icon: string}>}}).__cellWitness.chips)).filter((c) => !isRatingIcon(c.icon)).length,
  {timeout: 45_000, message: `a resource token was born (cell ${key})`}).toBeGreaterThan(0);
  const w = await page.evaluate(() => (window as unknown as {__cellWitness: {chips: Array<{icon: string, x: number, y: number}>, cell?: {x: number, y: number, w: number}}}).__cellWitness);
  const chip = w.chips.find((c) => !isRatingIcon(c.icon))!;
  expect(w.cell, `the cell ${key} was on screen`).toBeDefined();
  const dist = Math.hypot(chip.x - w.cell!.x, chip.y - w.cell!.y);
  expect(dist, `the chosen resource is born ON the cell ${key} (chip ${JSON.stringify(chip)} · cell ${JSON.stringify(w.cell)})`)
    .toBeLessThanOrEqual(Math.max(48, w.cell!.w * 2));
}

/** The bonus stands hosted, named by the host's crumb; answer it (A on the focused lane, X collects); the host leaves. */
async function answerHostedBonus(page: Page, request: APIRequestContext, id: string, host: string, hostSel: string, shot: string): Promise<void> {
  await expect(page.locator(`${hostSel} .con-venus[data-venus-bonus-embedded]`), `the bonus stands INSIDE the ${host} workspace`)
    .toBeVisible({timeout: 45_000});
  await expect.poll(() => crumbText(page), {timeout: 10_000, message: 'the host\'s crumb names the stage'}).toMatch(/бонус венеры/i);
  await expect(page.locator('[data-venus-step]'), 'the step that earned it is read').toContainText(/→/);
  await shoot(page, `${shot}-hosted`);
  const before = await wireOf(request, id);
  expect(before.waitingFor?.venusBonusPrompt?.kind, 'the server asks the bonus').toBeDefined();
  await press(page, 'ArrowDown', 300); // STEEL — a resource the press itself never moves (the witness tells it apart)
  await press(page, 'Enter', 500);
  await expect.poll(async () => {
    await press(page, 'KeyX', 600);
    return (await wireOf(request, id)).waitingFor?.venusBonusPrompt;
  }, {timeout: 30_000, message: 'X collects the bonus'}).toBeUndefined();
  const after = await wireOf(request, id);
  expect(stock(after), 'one standard resource collected').toBeGreaterThanOrEqual(stock(before) + 1);
  await expect(page.locator(`${hostSel} .con-venus`), 'the host leaves with the answered step').toHaveCount(0, {timeout: 30_000});
  const w = await witnessOf(page);
  expect(w.hosted, 'the hosted surface stood in its own host').toBe(host);
  expect(w.band, 'no standalone bonus band ever stood').toBe(0);
  await shoot(page, `${shot}-done`);
}

async function focusShuttles(page: Page): Promise<void> {
  await openCardActions(page);
  const focused = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');
  const moves = ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowDown'];
  for (let i = 0; i < 18 && (await focused()) !== SHUTTLES; i++) {
    await press(page, moves[i % moves.length], 260);
  }
  expect(await focused(), 'the P89 tile is focused').toBe(SHUTTLES);
  await openActionFocus(page);
  await settle(page);
}

async function commitComposer(page: Page): Promise<void> {
  for (let i = 0; i < 8 && await page.locator(`${ACTION_COMPOSER} .con-composer__cta--focused`).count() === 0; i++) {
    await press(page, 'ArrowDown', 200);
  }
  await press(page, 'Enter', 400);
}

test.describe(`the Venus bonus is a step of its host · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('H1 «ДЕЙСТВИЯ КАРТ»: P89 at 16 % → the bonus stands in the action\'s stage, answered there, the workspace leaves', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'venus-shuttles-alt16', {query: PRESET.query});
    await armBonusWitness(page);
    await focusShuttles(page);
    await commitComposer(page);
    await armCellWitness(page, 'venus-18');
    await answerHostedBonus(page, request, id, 'card-actions', '.con-cardactions', 'H1');
    // PL-1436: the chosen resource comes OFF THE BONUS CELL — after the step's own story.
    await expectBornOnCell(page, 'venus-18');
    await expect(page.locator('.con-cardactions'), 'the workspace leaves').toHaveCount(0, {timeout: 30_000});
    await expect.poll(() => page.evaluate(() => document.querySelector<HTMLElement>('[data-scale-marker="venus"]')?.dataset.scaleMarkerAt ?? ''),
      {timeout: 30_000, message: 'the board tells the step AFTER — the marker rests on 18'}).toBe('18');
  });

  test('H2 «КАРТЫ В РУКЕ»: a Venus card played at 16 % → the bonus is the play\'s next stage', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'venus-bonus-play', {query: PRESET.query});
    await armBonusWitness(page);
    expect(await playCardFromHand(page, 'Neutralizer Factory'), 'the card is played').toBe(true);
    await answerHostedBonus(page, request, id, 'hand', '.con-hand', 'H2');
  });

  test('H3 «СТАНДАРТНЫЕ ПРОЕКТЫ»: Air Scrapping at 16 % → the terminal commit hosts the bonus in its step', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'venus-bonus-stdp', {query: PRESET.query});
    await armBonusWitness(page);
    await press(page, 'Comma', 1100);
    await press(page, 'Enter', 1400);
    await expect(page.locator('.con-stdp'), 'the standard projects open').toHaveCount(1, {timeout: 15_000});
    const focused = async () => (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
    // The project grid is 2-D: the snake of `console-stdp-workspace` (up to the top, then row by row both ways).
    const target = /очистк|scrapping/i;
    for (let i = 0; i < 6 && !target.test(await focused()); i++) {
      await press(page, 'ArrowUp', 200);
    }
    const snake = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown',
      'ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowRight'];
    for (let i = 0; i < snake.length && !target.test(await focused()); i++) {
      await press(page, snake[i], 240);
    }
    expect(await focused(), 'the Air Scrapping row is focused').toMatch(target);
    expect(await pressUntil(page, 'Enter', async () => (await wireOf(request, id)).game.venusScaleLevel === 18, {tries: 3, settleMs: 1500}),
      'A runs the project').toBe(true);
    await answerHostedBonus(page, request, id, 'standard-projects', '.con-stdp', 'H3');
  });

  test('H4 «КОЛОНИИ»: a trade on the Redux «Venus» at 16 % → the bonus stands in the trade\'s stage', async ({page, request}) => {
    test.setTimeout(420_000);
    const {playerId: id} = await bootFixtureSeats(page, request, 'venus-bonus-trade', {query: PRESET.query, keepColony: 'Venus Redux'});
    await armBonusWitness(page);
    const colonies = page.locator('.con-colonies');
    for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
      await press(page, 'Period', 1100);
      await press(page, 'ArrowRight', 1300);
    }
    await expect(colonies, 'the colonies open').toHaveCount(1, {timeout: 15_000});
    const tile = page.locator('.con-coltile--focused[data-test="con-colony-Venus Redux"]');
    for (let i = 0; i < 10 && await tile.count() === 0; i++) {
      await press(page, 'ArrowRight', 380);
    }
    await expect(tile, 'the Venus colony is focused').toHaveCount(1);
    await press(page, 'Enter', 2000);
    expect(await pressUntil(page, 'KeyX', async () => (await wireOf(request, id)).game.venusScaleLevel === 18, {tries: 3, settleMs: 2000}),
      'X confirms the trade').toBe(true);
    await answerHostedBonus(page, request, id, 'colonies', '.con-colonies', 'H4');
  });

  test('H5 the 30 % finish (P89 at 28 %): the wild\'s stages stay INSIDE the one hosted step', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'venus-bonus-final', {query: PRESET.query});
    await armBonusWitness(page);
    await focusShuttles(page);
    await commitComposer(page);
    await expect(page.locator('.con-cardactions .con-venus[data-venus-bonus-embedded] .con-venus__wild'), 'the wild question stands hosted')
      .toBeVisible({timeout: 45_000});
    await shoot(page, 'H5-wild');
    await press(page, 'Enter', 600); // «Положить на карту»
    await expect(page.locator('.con-cardactions .con-venus__pick'), 'the card pick stands in the same step').toBeVisible({timeout: 15_000});
    await press(page, 'Enter', 600); // the focused holder
    await press(page, 'Enter', 500); // the base resource on the focused lane
    await expect.poll(async () => {
      await press(page, 'KeyX', 600);
      return (await wireOf(request, id)).waitingFor?.venusBonusPrompt;
    }, {timeout: 30_000, message: 'X collects the final bonus'}).toBeUndefined();
    expect((await witnessOf(page)).band, 'no standalone bonus band ever stood').toBe(0);
    await expect(page.locator('.con-cardactions'), 'the workspace leaves').toHaveCount(0, {timeout: 30_000});
  });

  test('H6 R&D Funding repeats P89 at 16 %: the law\'s stage hosts the bonus — the claim and its stage decided together', async ({page, request}) => {
    test.setTimeout(420_000);
    const {playerId: id} = await bootFixtureSeats(page, request, 'venus-bonus-rdfunding', {query: PRESET.query});
    await armBonusWitness(page);
    await openCardActions(page);
    const lawFocused = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-resolution') ?? '');
    await walkFocusUntil(page, async () => await lawFocused() === LAW, lawFocused, 30);
    const STAGE = `.con-cardactions .con-composer[data-composer-source="law:${LAW}"]`;
    expect(await pressUntil(page, 'Enter', async () => await page.locator(STAGE).count() > 0, {tries: 3, settleMs: 1100}), 'A opens the law\'s stage').toBe(true);
    await settle(page, {timeoutMs: 15_000});
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-cardactions').count() === 2, {tries: 4, settleMs: 900}),
      'A opens the repeat pick').toBe(true);
    await settle(page, {timeoutMs: 15_000});
    expect(await pressUntil(page, 'Enter',
      async () => await page.locator('.con-cardactions').count() === 1 && await page.locator('[data-composer-repeat-name]').count() === 1,
      {tries: 6, settleMs: 900}), 'the pick resolves into the law\'s slot').toBe(true);
    await settle(page, {timeoutMs: 15_000});
    expect(await pressUntil(page, 'Enter', async () => (await wireOf(request, id)).game.venusScaleLevel === 18, {tries: 4, settleMs: 900}),
      'the law\'s CTA commits the repeat').toBe(true);
    await answerHostedBonus(page, request, id, 'card-actions', '.con-cardactions', 'H6');
  });

  test('H7 no host (a reload mid-bonus): the band stands on its own — after the board told the step', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'venus-shuttles-alt16', {query: PRESET.query});
    await focusShuttles(page);
    await commitComposer(page);
    await expect(page.locator('.con-cardactions .con-venus[data-venus-bonus-embedded]'), 'hosted first').toBeVisible({timeout: 45_000});
    await reloadConsole(page);
    await expect(page.locator('.con-lanes.con-ws'), 'the standalone band stands after the reload').toBeVisible({timeout: 45_000});
    await shoot(page, 'H7-standalone');
    await armCellWitness(page, 'venus-18');
    await press(page, 'ArrowDown', 300); // STEEL
    await press(page, 'Enter', 400);
    await expect.poll(async () => {
      await press(page, 'KeyX', 600);
      return (await wireOf(request, id)).waitingFor?.venusBonusPrompt;
    }, {timeout: 30_000, message: 'the standalone band collects too'}).toBeUndefined();
    // …and its resource comes off the cell too (the story was already told — the stage stands at once).
    await expectBornOnCell(page, 'venus-18');
  });
});
