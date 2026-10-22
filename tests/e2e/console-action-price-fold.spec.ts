import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {FixtureName, bootFixture, fetchPlayerModel, openActionFocus, openCardActions, playCardFromHand, press, settle, waitForBoardHome} from './consoleStart';
import {armTransferWitness, transferWitness, TransferWitness} from './transferWitness';

/**
 * «ПОВЕРХНОСТЬ НЕ СКЛАДЫВАЕТСЯ ПОД СВОИМ ЖЕТОНОМ» — the flights' second iteration (T09, 2026-10-22; ledger BY).
 *
 * The owner's report, on the Steam Machine / Electron, LAN, WebSocket on, SOLO AGAINST MARSBOT: an ACTION COMMIT
 * (Electro Catapult — «spend 1 plant → +7 M€») folds its workspace EARLY, the card vanishes, and the price token off
 * the rail's plants row flies «into nowhere» — its destination (the printed cost icon of the card standing in the
 * composer) is gone. T06 closed «an end is an object» (BW) and its own stand (`console-rail-landing`) is green — but on
 * the FAST SOLO table, with no bot and nothing else in the response. This is the bench on the owner's conditions,
 * and it stays as the guard of the law it measured: A SURFACE NEVER FOLDS UNDER ITS OWN TOKEN — it folds when it is
 * neither the SOURCE nor the DESTINATION of a token in the air (`surfaceClear`, `resource-transfer.md` §2).
 *
 * THE MATRIX (one test per cell, the TV layout — `tests.md` § «A CARD / FEATURE SPEC RUNS ITS TABLE ON THE TV PROFILE
 * ONLY»; the 3840×2160 raster is free on the box, so the storyboards are taken here too — `TM_E2E_STORYBOARD=1`, every
 * compositor frame from the press to the settle under `screenshots/price-fold/<tag>/<cell>/story/`):
 *   A1 · Electro Catapult, blue's FIRST action of the turn (`price-fold-bot`) — nothing else in the answer (control);
 *   A2 · the same as the turn's SECOND action (`price-fold-bot-second`) — the bot's turn is due: the server answers
 *        with the bot ACTIVE and its Meteor Shower (5 plants off the very row the price left) lands ≈ 2 s later, in
 *        the middle of the commit's flight (`BotTurnScheduler`);
 *   B  · A2 with `?realtime=0` — the poll alone;
 *   C  · A2 with the POST answer delayed 1.5 s (`page.route`);
 *   D  · A1 with B pressed during «Выполнение» (the beat must absorb it);
 *   E  · A1, then Space Mirrors right after the first fold (7 M€ off the rail — the second action ends the turn);
 *   F  · Caretaker Contract (8 heat → TR);
 *   G  · T09 PR Office played from the hand (the PLAY's rail half — +1 TR, +3 M€) with the answer delayed 1.5 s.
 *   (A cell «the last action of a generation — its income in the same answer» is not reachable: an ACTION never ends
 *   the generation, only a pass does.)
 *
 * WHAT EVERY CELL RECORDS, armed before the press (`MutationObserver` + a 50 ms `setInterval`, never rAF): every chip
 * in the air and under which anchor it is born / rests (`transferWitness`), the workspace's presence and effective
 * opacity, the commit's rail state and the seed's verdict (`__conReady()` — `actionCommitRail`, `railReward.degraded`,
 * and since BY the transfer trail with `rail:seed` / `rail:end`), the console's `[transfer]` warnings. The table of the
 * cell is written to `screenshots/price-fold/<tag>/<cell>.json` BEFORE any assertion (the bench's data survives a red),
 * and the assertions are the law:
 *   ① a price token that was born LANDS on the composer's card (`hero` — the printed cost icon), never `board` /
 *     `glass:*` / `other:*`, and the workspace stands (≥ .5 opacity) at that landing;
 *   ② the workspace folds no earlier than the RESULT token's birth (the last token that leaves the card);
 *   ③ no `[transfer] surface folded under its token` and no `[transfer] end not painted`;
 *   ④ the server's numbers (M€ / plants / heat / TR) are what the rules say.
 * `TM_E2E_SHOTS_TAG=before` writes the same tables under `before/` for the A/B against the HEAD client.
 */

const TAG = process.env.TM_E2E_SHOTS_TAG ?? 'after';
const OUT = path.resolve('screenshots', 'price-fold', TAG);
type Wire = Record<string, any>;

const PROFILE = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;

type Chip = {v: string, x: number, y: number};
type Sample = {
  t: number,
  /** The cell's folding SURFACE (`.con-cardactions`; the play scene's `.con-recv` for a play) — its effective opacity, 0 when absent. */
  ws: number,
  chips: Array<Chip>,
  rail: {phase: string, link: number, lastEnd: string} | null,
  degraded: string,
  readouts: Record<string, string>,
};

const READOUTS: Record<string, string> = {
  mc: '.con-res__row--megacredits .con-res__digits',
  plants: '.con-res__row--plants .con-res__digits',
  heat: '.con-res__row--heat .con-res__digits',
  tr: '.con-score__value',
};

/** `surface` — the selector of the cell's folding surface: the action workspace, or the play scene's receiving stage. */
async function armBench(page: Page, surface = '.con-cardactions'): Promise<void> {
  await page.evaluate(([readouts, surfaceSel]) => {
    const t0 = performance.now();
    const samples: Array<unknown> = [];
    const warnings: Array<string> = [];
    const opacityOf = (el: Element | null): number => {
      if (el === null) {
        return 0;
      }
      let op = 1;
      for (let n: Element | null = el; n !== null; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden' || cs.display === 'none') {
          return 0;
        }
        op *= Number(cs.opacity);
      }
      return op;
    };
    type Ready = {actionCommitRail?: {phase: string, link: number, lastEnd: string}, railReward?: {degraded?: {key: string, why: string, detail?: string}}};
    let last = '';
    const sample = (tick: boolean) => {
      if (samples.length > 6000) {
        return;
      }
      const ready = (window as unknown as {__conReady?: () => Ready}).__conReady?.();
      const chips = Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__chip')).filter((el) => opacityOf(el) > 0.05).map((el) => {
        const r = el.getBoundingClientRect();
        return {v: (el.textContent ?? '').trim(), x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2)};
      });
      const values: Record<string, string> = {};
      for (const [key, sel] of Object.entries(readouts as unknown as Record<string, string>)) {
        values[key] = (document.querySelector(sel)?.textContent ?? '').trim().match(/^[-+]?\d+/)?.[0] ?? '';
      }
      const rail = ready?.actionCommitRail;
      const degraded = ready?.railReward?.degraded;
      const s = {
        t: +(performance.now() - t0).toFixed(1),
        ws: +opacityOf(document.querySelector(surfaceSel as string)).toFixed(2),
        chips,
        rail: rail === undefined ? null : {phase: rail.phase, link: rail.link, lastEnd: rail.lastEnd},
        degraded: degraded === undefined ? '' : `${degraded.key}: ${degraded.why}${degraded.detail !== undefined ? ` (${degraded.detail})` : ''}`,
        readouts: values,
      };
      const key = JSON.stringify({...s, t: 0});
      if (tick || key !== last) {
        last = key;
        samples.push(s);
      }
    };
    const warn = console.warn.bind(console);
    console.warn = (...args: Array<unknown>) => {
      const text = args.map((a) => String(a)).join(' ');
      if (text.startsWith('[transfer]') || text.startsWith('[rail-reward]') || text.startsWith('[action-commit-rail]')) {
        warnings.push(`${Math.round(performance.now() - t0)} ${text.slice(0, 300)}`);
      }
      warn(...args);
    };
    sample(true);
    const timer = window.setInterval(() => sample(true), 50);
    const mo = new MutationObserver(() => sample(false));
    mo.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style']});
    (window as unknown as {__priceFold: unknown}).__priceFold = {samples, warnings, t0, stop: () => {
      window.clearInterval(timer);
      mo.disconnect();
      console.warn = warn;
    }};
  }, [READOUTS, surface] as const);
}

type Bench = {samples: Array<Sample>, warnings: Array<string>, trail: Array<unknown>, witness: TransferWitness};

async function readBench(page: Page): Promise<Bench> {
  const page0 = await page.evaluate(() => {
    const p = (window as unknown as {__priceFold: {samples: Array<unknown>, warnings: Array<string>, stop: () => void}}).__priceFold;
    p.stop();
    const ready = (window as unknown as {__conReady?: () => {transfer?: {trail?: Array<unknown>}}}).__conReady?.();
    return {samples: p.samples, warnings: p.warnings, trail: ready?.transfer?.trail ?? []};
  }) as {samples: Array<Sample>, warnings: Array<string>, trail: Array<unknown>};
  return {...page0, witness: await transferWitness(page)};
}

/** «Действия карт» → the tile → its composer (the action centre is a grid: a 2D walk). */
async function openAction(page: Page, card: string): Promise<void> {
  await openCardActions(page);
  const focusedAction = () => page.evaluate(() => {
    const tiles = Array.from(document.querySelectorAll('[data-action-card]'));
    const at = tiles.findIndex((e) => e.classList.contains('con-cardactions__tile--focused'));
    return at < 0 ? '' : `${tiles[at].getAttribute('data-action-card')}#${at}`;
  });
  const hit = async () => (await focusedAction()).startsWith(`${card}#`);
  const moves = ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowDown'];
  for (let i = 0; i < 18 && !(await hit()); i++) {
    await press(page, moves[i % moves.length], 260);
  }
  expect(await hit(), `never focused the «${card}» action (at «${await focusedAction()}»)`).toBe(true);
  await openActionFocus(page);
  await settle(page);
}

const COMPOSER = '.con-cardactions__stagewrap .con-composer--stage';

/** Select the variant whose printed cost is `icon` when a choice is open, then walk the cursor to the commit row. */
async function readyToCommit(page: Page): Promise<void> {
  for (let i = 0; i < 4 && await page.locator(`${COMPOSER} .con-composer__branches .con-vchoice__opt--selected[data-branch-pos], ${COMPOSER} .con-composer__cta--ready`).count() === 0; i++) {
    await press(page, 'Enter', 300);
  }
  for (let i = 0; i < 8 && await page.locator(`${COMPOSER} .con-composer__cta--focused`).count() === 0; i++) {
    await press(page, 'ArrowDown', 200);
  }
  await expect(page.locator(`${COMPOSER} .con-composer__cta--focused`), 'the cursor stands on the commit row').toHaveCount(1);
}

async function serverOf(request: APIRequestContext, playerId: string): Promise<{mc: number, plants: number, heat: number, tr: number}> {
  const me = ((await fetchPlayerModel(request, playerId)) as Wire).thisPlayer as Wire;
  return {mc: Number(me.megacredits), plants: Number(me.plants), heat: Number(me.heat), tr: Number(me.terraformRating)};
}

async function delayAnswers(page: Page, ms: number): Promise<void> {
  // The submit funnel posts to `player/input` / `player/input-batch` (no `/api` prefix — `paths.PLAYER_INPUT`).
  await page.route('**/player/input*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    await route.continue();
  });
}

function shot(page: Page, cell: string, name: string): Promise<Buffer> {
  fs.mkdirSync(path.join(OUT, cell), {recursive: true});
  return page.screenshot({path: path.join(OUT, cell, `${name}.png`)});
}

/**
 * The STORYBOARD of a cell (`TM_E2E_STORYBOARD=1` only — the suite's convention, `console-aerial-mappers`): every frame
 * the compositor produced from the press to the settle, named by its time (`<cell>/story/t<ms>.jpg`). A 4K PNG per
 * fixed interval took ~2 s a frame on the box and missed the whole phrase between two of them.
 */
async function storyboard(page: Page, cell: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, cell, 'story');
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  const client = await page.context().newCDPSession(page);
  const t0 = Date.now();
  client.on('Page.screencastFrame', (frame) => {
    fs.writeFileSync(path.join(dir, `t${String(Date.now() - t0).padStart(5, '0')}.jpg`), Buffer.from(frame.data, 'base64'));
    void client.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => undefined);
  });
  await client.send('Page.startScreencast', {format: 'jpeg', quality: 82, everyNthFrame: 1});
  return async () => {
    await client.send('Page.stopScreencast').catch(() => undefined);
  };
}

/** The cell's reading: what the bench measured, in the words of the hypotheses table. */
type CellReading = {
  cell: string,
  priceBorn: boolean,
  priceLanding: string,
  priceLandingT: number,
  wsAtPriceLanding: number,
  resultBornT: number,
  foldT: number,
  railEnds: Array<string>,
  degraded: Array<string>,
  warnings: Array<string>,
  seeds: Array<unknown>,
};

function readCell(cell: string, bench: Bench, price: string, result: string): CellReading {
  const {samples, witness} = bench;
  const born = price === '' ? undefined : witness.births.find((b) => b.value === price);
  const landed = price === '' ? undefined : witness.landings.find((l) => l.value === price);
  const resultBorn = witness.births.find((b) => b.value === result);
  const at = (t: number) => samples.reduce<Sample | undefined>((best, s) => (s.t <= t + 1 && (best === undefined || s.t > best.t) ? s : best), undefined);
  const firstOpen = samples.findIndex((s) => s.ws >= 0.5);
  const fold = samples.slice(Math.max(0, firstOpen)).find((s) => s.ws < 0.5);
  return {
    cell,
    priceBorn: born !== undefined,
    priceLanding: landed?.under ?? '',
    priceLandingT: landed?.t ?? -1,
    wsAtPriceLanding: landed === undefined ? -1 : at(landed.t)?.ws ?? -1,
    resultBornT: resultBorn?.t ?? -1,
    foldT: fold?.t ?? -1,
    railEnds: [...new Set(samples.map((s) => s.rail?.lastEnd ?? '').filter((e) => e !== ''))],
    degraded: [...new Set(samples.map((s) => s.degraded).filter((d) => d !== ''))],
    warnings: bench.warnings,
    seeds: bench.trail.filter((e) => /rail:(seed|end)/.test(JSON.stringify(e))),
  };
}

function writeCell(reading: CellReading, bench: Bench): void {
  fs.mkdirSync(path.join(OUT, reading.cell), {recursive: true});
  fs.writeFileSync(path.join(OUT, reading.cell, 'reading.json'), JSON.stringify({reading, witness: bench.witness, trail: bench.trail}, null, 1));
  fs.writeFileSync(path.join(OUT, reading.cell, 'samples.json'), JSON.stringify(bench.samples));
}

/** THE LAW of the cell (①–③); ④ is each test's own. */
function expectLaw(r: CellReading, needsPrice: boolean): void {
  const say = `${r.cell}: ${JSON.stringify(r)}`;
  if (needsPrice) {
    expect.soft(r.priceBorn, `${say}\n① the price token was born`).toBe(true);
  }
  if (r.priceBorn) {
    expect.soft(r.priceLanding, `${say}\n① the price lands on the composer's card (its printed cost icon)`).toBe('hero');
    expect.soft(r.wsAtPriceLanding, `${say}\n① the workspace stands at the price's landing`).toBeGreaterThanOrEqual(0.5);
  }
  if (r.resultBornT >= 0 && r.foldT >= 0) {
    expect.soft(r.foldT, `${say}\n② the workspace folds no earlier than the result's birth`).toBeGreaterThanOrEqual(r.resultBornT - 60);
  }
  expect.soft(r.warnings.filter((w) => /surface folded under its token|end not painted/.test(w)), `${say}\n③ no sentinel`).toEqual([]);
}

test.describe(`console-action-price-fold · ${PROFILE.id}`, () => {
  test.use({viewport: PROFILE.viewport, deviceScaleFactor: 1, screen: PROFILE.viewport});

  async function catapult(page: Page, request: APIRequestContext, cell: string, fixture: FixtureName,
    opts: {query?: string, delayMs?: number, backDuringBeat?: boolean} = {}): Promise<{playerId: string, before: Awaited<ReturnType<typeof serverOf>>, reading: CellReading}> {
    const playerId = await bootFixture(page, request, fixture, {query: `${PROFILE.query}${opts.query ?? ''}`});
    const before = await serverOf(request, playerId);
    if (opts.delayMs !== undefined) {
      await delayAnswers(page, opts.delayMs);
    }
    await openAction(page, 'Electro Catapult');
    await readyToCommit(page);
    await shot(page, cell, 'setup');
    await armTransferWitness(page);
    await armBench(page);
    const stopStory = await storyboard(page, cell);
    await press(page, 'Enter', 0);
    if (opts.backDuringBeat === true) {
      await press(page, 'Escape', 0);
    }
    await expect(page.locator(READOUTS.mc)).toContainText(String(before.mc + 7), {timeout: 30_000});
    await settle(page, {timeoutMs: 45_000});
    await stopStory();
    await waitForBoardHome(page, 30);
    const bench = await readBench(page);
    const reading = readCell(cell, bench, '−1', '+7');
    writeCell(reading, bench);
    await shot(page, cell, 'board');
    return {playerId, before, reading};
  }

  test('A1 · Electro Catapult, the first action of the turn (control)', async ({page, request}) => {
    test.setTimeout(420_000);
    const {playerId, before, reading} = await catapult(page, request, 'A1', 'price-fold-bot');
    expectLaw(reading, true);
    const after = await serverOf(request, playerId);
    expect(after.mc - before.mc).toBe(7);
    expect(before.plants - after.plants).toBe(1);
  });

  test('A2 · Electro Catapult ENDS the turn — the bot\'s Meteor Shower lands inside the flight (the owner\'s table)', async ({page, request}) => {
    test.setTimeout(420_000);
    const {playerId, before, reading} = await catapult(page, request, 'A2', 'price-fold-bot-second');
    expectLaw(reading, true);
    // The bot's turn is paced by the server — wait for it before reading the server's numbers.
    await expect.poll(async () => (await serverOf(request, playerId)).plants, {timeout: 30_000}).toBe(before.plants - 1 - 5);
    expect((await serverOf(request, playerId)).mc - before.mc).toBe(7);
  });

  test('B · A2 with the poll alone (`?realtime=0`)', async ({page, request}) => {
    test.setTimeout(420_000);
    const {reading} = await catapult(page, request, 'B', 'price-fold-bot-second', {query: '&realtime=0'});
    expectLaw(reading, true);
  });

  test('C · A2 with the answer delayed 1.5 s', async ({page, request}) => {
    test.setTimeout(420_000);
    const {reading} = await catapult(page, request, 'C', 'price-fold-bot-second', {delayMs: 1500});
    expectLaw(reading, true);
  });

  test('D · B during «Выполнение» is absorbed — the phrase plays whole', async ({page, request}) => {
    test.setTimeout(420_000);
    const {reading} = await catapult(page, request, 'D', 'price-fold-bot', {backDuringBeat: true});
    expectLaw(reading, true);
  });

  test('E · Space Mirrors right after the catapult\'s fold — the second action ends the turn', async ({page, request}) => {
    test.setTimeout(420_000);
    const {playerId, before} = await catapult(page, request, 'E-1', 'price-fold-bot');
    await openAction(page, 'Space Mirrors');
    await readyToCommit(page);
    await armTransferWitness(page);
    await armBench(page);
    const stopStory = await storyboard(page, 'E-2');
    await press(page, 'Enter', 0);
    await settle(page, {timeoutMs: 45_000});
    await stopStory();
    await waitForBoardHome(page, 30);
    const bench = await readBench(page);
    const reading = readCell('E-2', bench, '−7', '+1');
    writeCell(reading, bench);
    expectLaw(reading, true);
    await expect.poll(async () => (await serverOf(request, playerId)).mc, {timeout: 30_000}).toBe(before.mc + 7 - 7);
  });

  test('F · Caretaker Contract: 8 heat leave the rail into the printed heat, then the TR', async ({page, request}) => {
    test.setTimeout(420_000);
    const playerId = await bootFixture(page, request, 'price-fold-bot', {query: PROFILE.query});
    const before = await serverOf(request, playerId);
    await openAction(page, 'Caretaker Contract');
    await readyToCommit(page);
    await armTransferWitness(page);
    await armBench(page);
    const stopStory = await storyboard(page, 'F');
    await press(page, 'Enter', 0);
    await settle(page, {timeoutMs: 45_000});
    await stopStory();
    await waitForBoardHome(page, 30);
    const bench = await readBench(page);
    const reading = readCell('F', bench, '−8', '+1');
    writeCell(reading, bench);
    expectLaw(reading, true);
    const after = await serverOf(request, playerId);
    expect(before.heat - after.heat).toBe(8);
    expect(after.tr - before.tr).toBe(1);
  });

  test('G · T09 PR Office from the hand, the answer delayed 1.5 s — the PLAY\'s rail half (+1 TR off the landed card, +3 M€)', async ({page, request}) => {
    test.setTimeout(420_000);
    const playerId = await bootFixture(page, request, 'pr-office', {query: PROFILE.query});
    const before = await serverOf(request, playerId);
    await delayAnswers(page, 1500);
    await armTransferWitness(page);
    await armBench(page, '.con-recv');
    const stopStory = await storyboard(page, 'G');
    expect(await playCardFromHand(page, 'PR Office'), 'the play went through').toBe(true);
    await settle(page, {timeoutMs: 45_000});
    await stopStory();
    await waitForBoardHome(page, 30);
    const bench = await readBench(page);
    const reading = readCell('G', bench, '', '+1');
    writeCell(reading, bench);
    expectLaw(reading, false);
    const after = await serverOf(request, playerId);
    expect(after.tr - before.tr, '+1 TR').toBe(1);
    expect(after.mc - before.mc, '−7 for the card less Teractor\'s 3 on an Earth card, +3 for three Earth tags').toBe(-(7 - 3) + 3);
  });
});
