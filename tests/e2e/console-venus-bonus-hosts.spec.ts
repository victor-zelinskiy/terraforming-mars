import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  answerVenusSpread, bootFixture, bootFixtureSeats, crumbText, fetchPlayerModel, openActionFocus, openCardActions, playCardFromHand, press,
  pressUntil, reloadConsole, settle, walkFocusUntil,
} from './consoleStart';
import {enterSittingByPass, parliament, strandedReports, armLeakWitness, turnTo, waitSittingAtRest} from './parliamentDrive';

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
              hosted.closest('.con-colonies') !== null ? 'colonies' :
                hosted.closest('.con-parl') !== null ? 'parliament' : 'elsewhere';
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

/** LT → the standard projects, the snake to Air Scrapping, A runs it (the 16 → 18 % step and the live bonus). */
async function runAirScrapping(page: Page, request: APIRequestContext, id: string): Promise<void> {
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

  test('H1 «ДЕЙСТВИЯ КАРТ»: P89 at 16 % → the bonus is PRE-SELECTED in the setup (P89 · EL), the batch answers it, the steel comes off its cell', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'venus-shuttles-alt16', {query: PRESET.query});
    await armBonusWitness(page);
    await focusShuttles(page);
    const spread = page.locator(`${ACTION_COMPOSER} [data-venus-spread]`);
    await expect(spread, 'the bonus is a ROW of the setup — before the commit').toBeVisible({timeout: 15_000});
    await expect(spread).toHaveAttribute('data-venus-spread-left', '1');
    await expect(spread.locator('[data-venus-step]'), 'the row reads the raise that earns it').toContainText(/16\s*%\s*→\s*18\s*%/);
    expect(await answerVenusSpread(page, 'steel'), 'the steel lane takes the one unit').toBe(true);
    await expect(spread.locator('[data-lane-resource="steel"]')).toHaveAttribute('data-lane-amount', '1');
    await shoot(page, 'H1-preselect');
    const before = await wireOf(request, id);
    await armCellWitness(page, 'venus-18');
    await commitComposer(page);
    await expect.poll(async () => (await wireOf(request, id)).game.venusScaleLevel, {timeout: 30_000, message: 'the step is made'}).toBe(18);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.steel, {timeout: 30_000, message: 'the batch paid the pre-selected steel'})
      .toBe(before.thisPlayer.steel + 1);
    expect((await wireOf(request, id)).waitingFor?.venusBonusPrompt, 'no bonus is asked after the press').toBeUndefined();
    // PL-1437: the chosen resource comes OFF THE BONUS CELL — after the step's own story, on the board.
    await expectBornOnCell(page, 'venus-18');
    await expect(page.locator('.con-cardactions'), 'the workspace leaves').toHaveCount(0, {timeout: 30_000});
    await expect.poll(() => page.evaluate(() => document.querySelector<HTMLElement>('[data-scale-marker="venus"]')?.dataset.scaleMarkerAt ?? ''),
      {timeout: 30_000, message: 'the board tells the step AFTER — the marker rests on 18'}).toBe('18');
    const w = await witnessOf(page);
    expect(w.hosted, 'no hosted bonus step ever stood — it was answered before the press').toBe('');
    expect(w.band, 'no standalone bonus band ever stood').toBe(0);
  });

  test('H2 «КАРТЫ В РУКЕ»: a Venus card played at 16 % → the bonus is PRE-SELECTED on the play sheet, the batch answers it', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'venus-bonus-play', {query: PRESET.query});
    await armBonusWitness(page);
    const before = await wireOf(request, id);
    await armCellWitness(page, 'venus-18');
    // The sheet holds its commit until the spread is laid out — the driver lays it on steel (P89 · EL).
    expect(await playCardFromHand(page, 'Neutralizer Factory', 3, {venusLane: 'steel'}), 'the card is played').toBe(true);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.steel, {timeout: 30_000, message: 'the play\'s batch paid the pre-selected steel'})
      .toBe(before.thisPlayer.steel + 1);
    expect((await wireOf(request, id)).waitingFor?.venusBonusPrompt, 'no bonus is asked after the play').toBeUndefined();
    await expectBornOnCell(page, 'venus-18');
    const w = await witnessOf(page);
    expect(w.hosted, 'no hosted bonus step').toBe('');
    expect(w.band, 'no standalone bonus band').toBe(0);
  });

  test('H3 «СТАНДАРТНЫЕ ПРОЕКТЫ»: Air Scrapping at 16 % → the terminal commit hosts the bonus in its step', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'venus-bonus-stdp', {query: PRESET.query});
    await armBonusWitness(page);
    await runAirScrapping(page, request, id);
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

  test('H5 the 30 % finish (P89 at 28 %): the WILD is its own pre-select (a card, or a standard resource) beside the spread', async ({page, request}) => {
    test.setTimeout(300_000);
    const id = await bootFixture(page, request, 'venus-bonus-final', {query: PRESET.query});
    await armBonusWitness(page);
    await focusShuttles(page);
    const spread = page.locator(`${ACTION_COMPOSER} [data-venus-spread]`);
    await expect(spread, 'the spread row stands').toBeVisible({timeout: 15_000});
    await shoot(page, 'H5-rows');
    const before = await wireOf(request, id);
    const floaters = (w: Wire) => w.thisPlayer.tableau.find((c) => c.name === 'Dirigibles')?.resources ?? 0;
    // THE WILD — its own row: A opens the card pick, A takes the focused holder (Dirigibles, the one candidate — shown, T14).
    expect(await pressUntil(page, 'Enter', async () => await page.locator(`${ACTION_COMPOSER} .con-ptsel, .con-cardactions .con-ptsel`).count() > 0,
      {tries: 3, settleMs: 900}), 'A opens the wild\'s card pick').toBe(true);
    await shoot(page, 'H5-wild-pick');
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-cardactions .con-ptsel').count() === 0,
      {tries: 3, settleMs: 900}), 'A takes the holder').toBe(true);
    expect(await answerVenusSpread(page, 'steel'), 'the base unit on steel').toBe(true);
    await shoot(page, 'H5-ready');
    await commitComposer(page);
    await expect.poll(async () => (await wireOf(request, id)).game.venusScaleLevel, {timeout: 30_000}).toBe(30);
    await expect.poll(async () => floaters(await wireOf(request, id)), {timeout: 30_000, message: 'the wild landed on Dirigibles'})
      .toBe(floaters(before) + 1);
    const after = await wireOf(request, id);
    expect(after.thisPlayer.steel, 'the base unit on steel').toBe(before.thisPlayer.steel + 1);
    expect(after.waitingFor?.venusBonusPrompt, 'no bonus is asked after the press').toBeUndefined();
    expect((await witnessOf(page)).band, 'no standalone bonus band ever stood').toBe(0);
    await expect(page.locator('.con-cardactions'), 'the workspace leaves').toHaveCount(0, {timeout: 30_000});
  });

  test('H6 R&D Funding repeats P89 at 16 %: the copied action\'s bonus is pre-selected in its own composer, the law\'s commit answers it', async ({page, request}) => {
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
    // The copied action's own composer stands in the repeat bridge — its Venus bonus is pre-selected there (P89 · EL).
    for (let i = 0; i < 6 && !(await page.locator('.con-cardactions').count() === 1 && await page.locator('[data-composer-repeat-name]').count() === 1); i++) {
      if (await page.locator('[data-venus-spread]').count() > 0 && (await page.locator('[data-venus-spread]').first().getAttribute('data-venus-spread-left')) !== '0') {
        expect(await answerVenusSpread(page, 'steel'), 'the copied composer\'s bonus laid out').toBe(true);
        continue;
      }
      await press(page, 'Enter', 900);
    }
    expect(await page.locator('[data-composer-repeat-name]').count(), 'the pick resolves into the law\'s slot').toBe(1);
    await settle(page, {timeoutMs: 15_000});
    const before = await wireOf(request, id);
    expect(await pressUntil(page, 'Enter', async () => (await wireOf(request, id)).game.venusScaleLevel === 18, {tries: 4, settleMs: 900}),
      'the law\'s CTA commits the repeat').toBe(true);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.steel, {timeout: 30_000, message: 'the repeat\'s batch paid the bonus'})
      .toBe(before.thisPlayer.steel + 1);
    expect((await wireOf(request, id)).waitingFor?.venusBonusPrompt, 'no bonus is asked after the repeat').toBeUndefined();
    expect((await witnessOf(page)).band, 'no standalone bonus band').toBe(0);
  });

  test('H7 no host (a reload mid-bonus): the band stands on its own — after the board told the step', async ({page, request}) => {
    test.setTimeout(300_000);
    // The standard projects pre-select nothing: their terminal commit HOSTS the live bonus (H3) — the reload takes the host away.
    const id = await bootFixture(page, request, 'venus-bonus-stdp', {query: PRESET.query});
    await runAirScrapping(page, request, id);
    await expect(page.locator('.con-stdp .con-venus[data-venus-bonus-embedded]'), 'hosted first').toBeVisible({timeout: 45_000});
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

  test("H8 «ПАРЛАМЕНТ»: the winner's Venus step (14 → 18 %) → the bonus is a step of the sitting's reward page; the planet's story AFTER the answer, the resource off its cell", async ({page, request}) => {
    test.setTimeout(600_000);
    // The dev law «Venus Survey Charter» stands one pass before its sitting with blue's delegate on it (P89 · EJ).
    const {playerId: id} = await bootFixtureSeats(page, request, 'parliament-venus-step-assembly', {query: PRESET.query});
    await armLeakWitness(page);
    await armBonusWitness(page);
    await armCellWitness(page, 'venus-18');
    // THE SAMPLER: was the sitting ever off the screen while the bonus stood (the planet's trip must wait for the answer)?
    await page.evaluate(() => {
      const w = window as unknown as {__sitWitness?: {awayWhileAsked: number, awayAfter: number}};
      const state = {awayWhileAsked: 0, awayAfter: 0};
      w.__sitWitness = state;
      let asked = false;
      setInterval(() => {
        const bonus = document.querySelector('.con-venus') !== null;
        asked = asked || bonus;
        if (document.querySelector('.con-parl') === null) {
          if (bonus) {
            state.awayWhileAsked++;
          } else if (asked) {
            state.awayAfter++;
          }
        }
      }, 50);
    });
    await enterSittingByPass(page, request, id);
    await expect.poll(async () => (await wireOf(request, id)).waitingFor?.venusBonusPrompt?.kind, {timeout: 60_000,
      message: "the winner's rewarded step asks the 18 % bonus inside the political phase"}).toBe('standard');
    expect((await wireOf(request, id)).game.venusScaleLevel).toBe(18);
    // The QUESTION INSIDE: the bonus stands in the sitting's stage zone, the crumb's tail names it, the sitting is up.
    await expect(page.locator('.con-parl [data-embed-slot="parliament-stage"] .con-venus[data-venus-bonus-embedded]'),
      "the bonus stands in the sitting's reward zone").toBeVisible({timeout: 90_000});
    await expect(page.locator('[data-venus-step]'), 'the head reads the raise that earned it').toContainText(/14\s*%\s*→\s*18\s*%/);
    await answerHostedBonus(page, request, id, 'parliament', '.con-parl', 'H8');
    // THE STORY AFTER: the sitting steps aside for the planet only now — the marker's glide, the steel off the 18 % cell.
    await expectBornOnCell(page, 'venus-18');
    await expect(parliament(page), 'the sitting comes back from the board').toHaveCount(1, {timeout: 60_000});
    await waitSittingAtRest(page, 60_000);
    const sit = await page.evaluate(() => (window as unknown as {__sitWitness: {awayWhileAsked: number, awayAfter: number}}).__sitWitness);
    expect(sit.awayWhileAsked, 'the sitting never left the screen while its bonus stood').toBe(0);
    expect(sit.awayAfter, "the planet's trip to the board came AFTER the answer").toBeGreaterThan(0);
    expect(await turnTo(page, 'results'), 'the walk reaches the results').toBe(true);
    await shoot(page, 'H8-results');
    expect(await strandedReports(page), 'no stranded prompt on the way').toEqual([]);
  });
});
