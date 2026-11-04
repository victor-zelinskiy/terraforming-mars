import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  answerVenusSpread, bootFixture, bootFixtureSeats, fetchPlayerModel, openActionFocus, openCardActions, playQueueCard, press, pressUntil, reloadConsole,
  settle, venusOwed, waitQueueIdle, walkFocusUntil,
} from './consoleStart';
import {closeSitting, closeSittingAs, enterSittingByPass} from './parliamentDrive';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness, TransferWitness} from './transferWitness';
import {readTransient, recordTransient} from './transientRecorder';

/**
 * P65 VENUS CONTRACT — the forty-seventh Prelude 2 card (ledger GG · GH): «Draw 1 Venus card and raise your TR 1 step» +
 * «Effect: each step YOU raise Venus, gain 3 M€». The series' first prelude-reactor on a SCALE. The stand proves the
 * card on every road its Venus step comes through, and the polish area (GH — K40: «Сработает» BY THE BRANCH in the
 * «ВАРИАНТ» step):
 *   (A) the start (fixture `venus-contract-start`): A on P65 → its search for a Venus card + 1 TR; Atmospheric Enhancers
 *       focused in the queue states NO branch's answer as the play's (the rail reads the play whole until a row is
 *       chosen); A → the «ВАРИАНТ» step: the Venus row carries «⚡ +6 M€», the temperature / oxygen rows carry nothing;
 *       A on Venus → the scale +2, P65 answers ONCE off its printed «3 M€», the +6 lands on the M€ row;
 *   (G) a reload after A: the rail equals the server, the reaction is not told again;
 *   (B) Venus Shuttles' action under the ruling Greens (fixture `venus-contract-table`): «Сработает» states the card and
 *       the party (+5 on the M€ row) → the price leaves first (12 − 3 Venus tags: P65 · Dirigibles · the Shuttles = −9), then the answers, each off its own face;
 *   (C) the Air Scrapping standard project from the same table: −15, then +2 · +3;
 *   (D) the alternative board 16 → 18 % (`venus-contract-alt16`): the track's bonus (laid out before the press) and the
 *       card's +3 — both paid, the card's token off its own face;
 *   (E) Venus at 28 % (`venus-contract-max`): ONE step is made — «Сработает» promises +3, never +6, the server pays +3;
 *   (F) the sitting (`venus-contract-sitting` — blue wins the dev law that raises Venus 2 steps): the winner's REWARDED
 *       steps pay the card +6, and the sitting TELLS it — the gate's presses answer the sitting, never cut the card's chain (PL-1799 / PL-1803): the tokens born on the card's printed «3 M€» land on the M€ row.
 * The rules are pinned by `tests/cards/prelude2/VenusContract.spec.ts`; the variant row's reading by
 * `tests/client/components/console/preludeVariantModel.spec.ts`. TIMING class (`timingSpecs.ts`). Storyboard:
 * `TM_E2E_STORYBOARD=1` → screenshots/p65/tv4k/story-*.
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'p65', PRESET.id);
const CARD = 'Venus Contract';
const ENHANCERS = 'Atmospheric Enhancers';
const SHUTTLES = 'Venus Shuttles';
const MC = '.con-res__row--megacredits .con-res__digits';
const MC_CHIP = '[data-forecast-rail="stock:megacredits"]';
const ACTION_COMPOSER = '.con-cardactions__stagewrap .con-composer--stage';

type Wire = {
  game: {venusScaleLevel: number},
  thisPlayer: {megacredits: number, steel: number, terraformRating: number, tableau: Array<{name: string}>},
  cardsInHand?: Array<{name: string}>,
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

function writeText(name: string, text: string): void {
  fs.mkdirSync(OUT, {recursive: true});
  fs.writeFileSync(path.join(OUT, name), `${text}\n`);
}

async function storyboard(page: Page, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, `story-${name}`);
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

/** What a player sees of the reaction, recorded off the product's own writes from the press on. */
type ReactionPose = {mc: string, lifted: number, emerged: number, atStage: number, faces: number};
async function recordReaction(page: Page, key: string): Promise<void> {
  await recordTransient(page, key, ({card, mc}: {card: string, mc: string}): ReactionPose => ({
    mc: (document.querySelector(mc)?.textContent ?? '').replace(/\s+/g, ''),
    lifted: document.querySelectorAll(`[data-played-key="${card}"][data-reaction-lifted], [data-played-key="${card}"] [data-reaction-lifted], ` +
      `[data-start-seat-card="${card}"][data-reaction-lifted], [data-reaction-home="${card}"][data-reaction-lifted]`).length,
    emerged: document.querySelectorAll(`.con-recv__emerge[data-played-key="${card}"]`).length,
    atStage: document.querySelectorAll(`.con-reaction__face[data-reaction-card="${card}"]`).length,
    faces: document.querySelectorAll('.con-reaction__face[data-reaction-card]').length,
  }), {args: {card: CARD, mc: MC}});
}

/** The distinct values the M€ row PAINTED, in order. */
function mcTicks(samples: ReadonlyArray<{v: ReactionPose}>): Array<number> {
  const out: Array<number> = [];
  for (const s of samples) {
    const n = Number(s.v.mc.match(/^-?\d+/)?.[0] ?? NaN);
    if (Number.isFinite(n) && out[out.length - 1] !== n) {
      out.push(n);
    }
  }
  return out;
}

/** The M€ chips of the table's answer as `scope` paints them — '' when none. */
async function forecastMc(page: Page, scope: string): Promise<string> {
  return page.evaluate(({scope, chip}) => {
    return Array.from(document.querySelectorAll(`${scope} [data-forecast-row] ${chip}`))
      .map((el) => (el.textContent ?? '').replace(/\s+/g, '')).join('|');
  }, {scope, chip: MC_CHIP});
}

/** The «⚡ сработает» note of each row of the start's «ВАРИАНТ» step — index → its painted text ('' when the row has none). */
async function variantReactions(page: Page): Promise<Array<string>> {
  return page.evaluate(() => Array.from(document.querySelectorAll('[data-start-variant] [data-prelude-variant-row]')).map((row) =>
    (row.querySelector('[data-prelude-variant-reaction] [data-forecast-vchip]')?.closest('[data-prelude-variant-reaction]')?.textContent ?? '').replace(/\s+/g, '')));
}

function collectConsole(page: Page): Array<string> {
  const lines: Array<string> = [];
  page.on('console', (m) => {
    if (/reaction|rail|transfer|start-shadow|liveness|screen-shadow|hold|workspace-stall/i.test(m.text())) {
      lines.push(`${m.type()} ${m.text()}`);
    }
  });
  return lines;
}

/** The rail / reaction trail the product keeps (`__conReady().transfer.trail`), recorded off the product's writes. */
async function recordRailTrail(page: Page, key: string): Promise<void> {
  await recordTransient(page, key, () => {
    const ready = (window as unknown as {__conReady?: () => {transfer?: {trail?: ReadonlyArray<unknown>}}}).__conReady;
    return (ready?.().transfer?.trail ?? []).map((e) => JSON.stringify(e)).join(String.fromCharCode(10));
  });
}
async function readRailTrail(page: Page, key: string): Promise<string> {
  const seen = new Set<string>();
  const out: Array<string> = [];
  for (const sample of await readTransient<string>(page, key)) {
    for (const line of sample.v.split(String.fromCharCode(10))) {
      if (line !== '' && !seen.has(line)) {
        seen.add(line);
        out.push(line);
      }
    }
  }
  return out.join(String.fromCharCode(10));
}

/** The journal lines naming P65 (the server's log). */
async function contractLogLines(request: APIRequestContext, id: string): Promise<number> {
  const res = await request.get(`/api/game/logs?id=${id}`);
  const log = res.ok() ? await res.json() as Array<{data?: Array<{value?: string}>}> : [];
  return log.filter((l) => (l.data ?? []).some((d) => d.value === CARD)).length;
}

/** The card's tokens: born on its printed effect, every one landed on the M€ row. */
function expectCardAnswer(witness: TransferWitness, label: string): void {
  const trail = transferTrail(witness);
  const births = witness.births.filter((b) => b.under.startsWith(`reactor:${CARD}`));
  expect(births.length, `${label}: P65's answer born on its printed «3 M€» (trail:\n${trail})`).toBeGreaterThan(0);
  const landed = witness.landings.filter((l) => births.some((b) => b.id === l.id));
  expect(landed.length, `${label}: …and landed (trail:\n${trail})`).toBeGreaterThan(0);
  expect(landed.every((l) => l.under.startsWith('rail:megacredits')), `${label}: …on the M€ row (trail:\n${trail})`).toBe(true);
  expect(endsOverGlass(witness), `${label}: no end over glass or nothing`).toEqual([]);
}

/** «Действия карт» → the Venus Shuttles tile, its composer open. */
async function openShuttles(page: Page): Promise<void> {
  await openCardActions(page);
  const focused = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');
  const moves = ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowDown'];
  for (let i = 0; i < 18 && (await focused()) !== SHUTTLES; i++) {
    await press(page, moves[i % moves.length], 260);
  }
  expect(await focused(), 'the Venus Shuttles tile is focused').toBe(SHUTTLES);
  await openActionFocus(page);
  await settle(page);
}

/** The composer's CTA pressed until the server answers (`done`). */
async function commitComposer(page: Page, done: () => Promise<boolean>): Promise<void> {
  for (let i = 0; i < 8 && await page.locator(`${ACTION_COMPOSER} .con-composer__cta--focused`).count() === 0; i++) {
    await press(page, 'ArrowDown', 200);
  }
  expect(await pressUntil(page, 'Enter', done, {tries: 3, settleMs: 2500}), 'A commits the action').toBe(true);
}

/** Walk the step's column to `row` (0-based). */
async function toRow(page: Page, row: number): Promise<void> {
  for (let i = 0; i < 6; i++) {
    const at = await page.locator('[data-start-variant] .con-vchoice__opt--focused').getAttribute('data-prelude-variant-row');
    if (at === String(row)) {
      return;
    }
    await press(page, 'ArrowDown', 200);
  }
  await expect(page.locator('[data-start-variant] .con-vchoice__opt--focused')).toHaveAttribute('data-prelude-variant-row', String(row));
}

test.describe(`P65 Venus Contract · a prelude-reactor on the Venus scale · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('(A · G) the start: the Venus search + 1 TR; the «ВАРИАНТ» step\'s Venus row alone carries «Сработает +6»; P65 answers once off its card; a reload tells nothing twice', async ({page, request}) => {
    test.setTimeout(480_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const logs = collectConsole(page);
    const id = await bootFixture(page, request, 'venus-contract-start', {query: PRESET.query, landing: 'prompt'});
    await settle(page, {timeoutMs: 30_000});
    await expect(page.locator(`.con-start [data-queue-slot="${CARD}"]`), 'the prelude stands in the deployment queue').toHaveCount(1, {timeout: 60_000});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, id);
    expect([before.thisPlayer.megacredits, before.game.venusScaleLevel], 'the fixture: 30 M€, Venus 0 %').toEqual([30, 0]);
    const tr = before.thisPlayer.terraformRating;

    // P65 — its search for a Venus card and its rating.
    await recordTransient(page, 'search-a', () => document.querySelectorAll('[data-draw-search]').length);
    const stop0 = await storyboard(page, 'A-search');
    expect(await playQueueCard(page, CARD), 'P65 was played from the queue').toBe(true);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.terraformRating, {timeout: 40_000, message: 'the server: +1 TR'}).toBe(tr + 1);
    await waitQueueIdle(page, 60_000);
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    await stop0();
    const mid = await wireOf(request, id);
    expect((mid.cardsInHand ?? []).map((c) => c.name), 'the search kept Aerial Mappers (the first Venus card of the tape)').toEqual(['Aerial Mappers']);
    expect((await readTransient<number>(page, 'search-a')).some((s) => s.v > 0), 'the search named its rule on screen').toBe(true);
    await shoot(page, 'A-01-after-search');

    // Atmospheric Enhancers focused in the queue: no branch's answer is stated as the play's (K40 — the play read whole).
    const focused = () => page.evaluate(() => document.querySelector('.con-start__qcard--focused')?.getAttribute('data-queue-slot') ?? '');
    expect(await walkFocusUntil(page, async () => await focused() === ENHANCERS, focused, 8), 'P44 focused in the queue').toBe(true);
    await settle(page);
    const railBefore = await forecastMc(page, '[data-start-prelude-forecast]');
    writeText('A-02-rail.txt', `the queue's «Сработает» on P44 before the choice: «${railBefore}»`);
    expect(railBefore, 'the rail promises no branch\'s +6 before the choice').not.toMatch(/\+6(?!\d)/);
    await shoot(page, 'A-02-queue');

    // A → the step: the Venus row (2) carries «⚡ +6», the temperature (0) and oxygen (1) rows nothing.
    await recordTransient(page, 'vrows-a', () => Array.from(document.querySelectorAll('[data-start-variant] [data-prelude-variant-row]'))
      .map((row) => (row.querySelector('[data-prelude-variant-reaction]')?.textContent ?? '').replace(/\s+/g, '')).join('|'));
    expect(await pressUntil(page, 'Enter', async () => await page.locator('[data-start-variant] [data-prelude-variant-row]').count() === 3,
      {tries: 3, settleMs: 900}), 'the «ВАРИАНТ» step stands').toBe(true);
    await settle(page);
    await expect.poll(() => variantReactions(page), {timeout: 15_000, message: 'the Venus row carries «+6 M€», the others nothing'})
      .toEqual(['', '', expect.stringMatching(/\+6(?!\d)/)]);
    await toRow(page, 2);
    // Every row of the step stands IN the frame — the Venus row (the cursor's, the one carrying «+6») included: a column
    // seam once grew as tall as the lane and pushed the third row below the 4K frame (GH).
    const rowsInFrame = await page.evaluate(() => Array.from(document.querySelectorAll('[data-start-variant] [data-prelude-variant-row]')).map((row) => {
      const r = row.getBoundingClientRect();
      const footer = document.querySelector('.con-start__statusrail')?.getBoundingClientRect().top ?? window.innerHeight;
      return r.height > 0 && r.top >= 0 && r.bottom <= Math.min(window.innerHeight, footer) + 1;
    }));
    expect(rowsInFrame, 'all three rows of the step stand inside the frame').toEqual([true, true, true]);
    await shoot(page, 'A-03-variant-venus');

    await armTransferWitness(page);
    await recordReaction(page, 'p65-a');
    const stop = await storyboard(page, 'A-variant-venus');
    await press(page, 'Enter', 400);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.megacredits, {timeout: 40_000, message: 'the server: 30 + 6'}).toBe(36);
    await waitQueueIdle(page, 60_000);
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    await stop();
    await shoot(page, 'A-04-after');
    const after = await wireOf(request, id);
    expect([after.game.venusScaleLevel, after.thisPlayer.terraformRating], 'the server: Venus 4 %, +2 TR more').toEqual([4, tr + 3]);
    const rows = [...new Set((await readTransient<string>(page, 'vrows-a')).map((s) => s.v).filter((v) => v !== ''))];
    writeText('A-variant-rows.txt', rows.join('\n'));
    expect(rows.every((v) => /^\|\|.*\+6/.test(v)), `every painted frame of the step: only the Venus row carries the answer (${rows.join(' / ')})`).toBe(true);

    const poses = await readTransient<ReactionPose>(page, 'p65-a');
    const ticks = mcTicks(poses);
    const witness = await transferWitness(page);
    writeText('A-poses.txt', [`ticks: ${ticks.join(' → ')}`, ...poses.map((s) => `${Math.round(s.t)} ${JSON.stringify(s.v)}`)].join('\n'));
    writeText('A-trail.txt', transferTrail(witness));
    writeText('A-console.txt', logs.join('\n'));
    expect(ticks[0], `the M€ row starts at 30 (${ticks.join(' → ')})`).toBe(30);
    expect(ticks[ticks.length - 1], `the M€ row ends on the server (${ticks.join(' → ')})`).toBe(36);
    expect(ticks.every((v, i) => i === 0 || v > ticks[i - 1]), `the M€ row only rises (${ticks.join(' → ')})`).toBe(true);
    expect(poses.some((s) => s.v.lifted > 0 || s.v.emerged > 0 || s.v.atStage > 0), 'P65 rose (its place, or the stage over the board)').toBe(true);
    expect(poses.some((s) => s.v.atStage > 1 || (s.v.atStage > 0 && (s.v.lifted > 0 || s.v.emerged > 0))), 'never two instances of P65').toBe(false);
    expectCardAnswer(witness, 'A');
    expect(logs.filter((l) => /start-shadow|\[liveness\]|workspace-stall/.test(l)), 'no shadow finding, no stall').toEqual([]);

    // (G) a reload after the play: the rail equals the server, the reaction is not told again.
    await recordReaction(page, 'p65-g');
    await reloadConsole(page);
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    await expect.poll(async () => (await page.locator(MC).first().textContent() ?? '').replace(/\s+/g, ''),
      {timeout: 20_000, message: 'the M€ row reads the server after the reload'}).toMatch(/^36/);
    const reloaded = await readTransient<ReactionPose>(page, 'p65-g');
    expect(reloaded.every((s) => s.v.faces === 0 && s.v.lifted === 0 && s.v.emerged === 0), 'the reload tells no reaction again').toBe(true);
    expect((await wireOf(request, id)).thisPlayer.megacredits, 'the reload pays nothing').toBe(36);
    expect(errors, 'no page error').toEqual([]);
  });

  test('(B) Venus Shuttles under the Greens: «Сработает» names the card and the party; −9, then +2 · +3 each off its own face', async ({page, request}) => {
    test.setTimeout(420_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const logs = collectConsole(page);
    const id = await bootFixture(page, request, 'venus-contract-table', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    expect((await wireOf(request, id)).thisPlayer.megacredits, 'the fixture: 30 M€').toBe(30);
    await openShuttles(page);
    await expect.poll(() => forecastMc(page, ACTION_COMPOSER), {timeout: 20_000, message: '«Сработает» states the card +3 and the Greens +2 on the M€ row'})
      .toMatch(/\+5(?!\d)/);
    await shoot(page, 'B-01-composer');
    await armTransferWitness(page);
    await recordReaction(page, 'p65-b');
    const stop = await storyboard(page, 'B-shuttles');
    await commitComposer(page, async () => (await wireOf(request, id)).game.venusScaleLevel === 12);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.megacredits, {timeout: 40_000, message: 'the server: 30 − 9 + 2 + 3'}).toBe(26);
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    await stop();
    await shoot(page, 'B-02-after');
    const poses = await readTransient<ReactionPose>(page, 'p65-b');
    const ticks = mcTicks(poses);
    const witness = await transferWitness(page);
    writeText('B-poses.txt', [`ticks: ${ticks.join(' → ')}`, ...poses.map((s) => `${Math.round(s.t)} ${JSON.stringify(s.v)}`)].join('\n'));
    writeText('B-trail.txt', transferTrail(witness));
    writeText('B-console.txt', logs.join('\n'));
    expect(ticks[ticks.length - 1], `the M€ row ends on the server (${ticks.join(' → ')})`).toBe(26);
    expect(ticks.includes(21), `the price lands alone first: 30 → 21 (${ticks.join(' → ')})`).toBe(true);
    expect(ticks.slice(ticks.indexOf(21)).every((v, i, all) => i === 0 || v > all[i - 1]), `then only rises (${ticks.join(' → ')})`).toBe(true);
    expectCardAnswer(witness, 'B');
    expect(witness.births.some((b) => b.under.startsWith('reactor:Greens')), `the Greens' +2 born on their charter (trail:\n${transferTrail(witness)})`).toBe(true);
    expect(poses.some((s) => s.v.atStage > 1), 'never two instances of P65').toBe(false);
    expect(errors, 'no page error').toEqual([]);
  });

  test('(C) the Air Scrapping standard project: −15, then the Greens +2 and the card +3', async ({page, request}) => {
    test.setTimeout(420_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const id = await bootFixture(page, request, 'venus-contract-table', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    await press(page, 'Comma', 1100);
    await press(page, 'Enter', 1400);
    await expect(page.locator('.con-stdp'), 'the standard projects open').toHaveCount(1, {timeout: 15_000});
    const focused = async () => (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
    const target = /очистк|scrapping/i;
    for (let i = 0; i < 6 && !target.test(await focused()); i++) {
      await press(page, 'ArrowUp', 200);
    }
    const snake = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown',
      'ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowRight'];
    for (let i = 0; i < snake.length && !target.test(await focused()); i++) {
      await press(page, snake[i], 240);
    }
    expect(await focused(), 'the Air Scrapping card is focused').toMatch(target);
    await settle(page);
    await shoot(page, 'C-01-stdp');
    await armTransferWitness(page);
    await recordReaction(page, 'p65-c');
    expect(await pressUntil(page, 'Enter', async () => (await wireOf(request, id)).game.venusScaleLevel === 12, {tries: 3, settleMs: 1500}),
      'A runs the project').toBe(true);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.megacredits, {timeout: 40_000, message: 'the server: 30 − 15 + 2 + 3'}).toBe(20);
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    await shoot(page, 'C-02-after');
    const poses = await readTransient<ReactionPose>(page, 'p65-c');
    const ticks = mcTicks(poses);
    const witness = await transferWitness(page);
    writeText('C-poses.txt', [`ticks: ${ticks.join(' → ')}`, ...poses.map((s) => `${Math.round(s.t)} ${JSON.stringify(s.v)}`)].join('\n'));
    writeText('C-trail.txt', transferTrail(witness));
    expect(ticks[ticks.length - 1], `the M€ row ends on the server (${ticks.join(' → ')})`).toBe(20);
    expect(ticks.includes(15), `the price lands alone first: 30 → 15 (${ticks.join(' → ')})`).toBe(true);
    expectCardAnswer(witness, 'C');
    expect(poses.some((s) => s.v.atStage > 1), 'never two instances of P65').toBe(false);
    expect(errors, 'no page error').toEqual([]);
  });

  test('(D) the alternative board 16 → 18 %: the track\'s bonus and the card\'s +3 — both paid, the card off its own face', async ({page, request}) => {
    test.setTimeout(420_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const id = await bootFixture(page, request, 'venus-contract-alt16', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, id);
    await openShuttles(page);
    if (await venusOwed(page)) {
      expect(await answerVenusSpread(page, 'steel'), 'the 18 % bonus laid out on steel before the press').toBe(true);
    }
    await shoot(page, 'D-01-composer');
    await armTransferWitness(page);
    await recordReaction(page, 'p65-d');
    await commitComposer(page, async () => (await wireOf(request, id)).game.venusScaleLevel === 18);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.megacredits, {timeout: 40_000, message: 'the server: 15 − 9 + 3'}).toBe(9);
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    await shoot(page, 'D-02-after');
    const after = await wireOf(request, id);
    expect(after.thisPlayer.steel, 'the bonus paid its steel').toBe(before.thisPlayer.steel + 1);
    const witness = await transferWitness(page);
    writeText('D-trail.txt', transferTrail(witness));
    expectCardAnswer(witness, 'D');
    expect(errors, 'no page error').toEqual([]);
  });

  test('(E) Venus at 28 %: «Сработает» promises ONE step (+3), the server pays +3', async ({page, request}) => {
    test.setTimeout(360_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const id = await bootFixture(page, request, 'venus-contract-max', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    await openShuttles(page);
    await expect.poll(() => forecastMc(page, ACTION_COMPOSER), {timeout: 20_000, message: '«Сработает» promises +3'}).toMatch(/\+3(?!\d)/);
    expect(await forecastMc(page, ACTION_COMPOSER), 'never +6 at the ceiling').not.toMatch(/\+6(?!\d)/);
    await shoot(page, 'E-01-composer');
    await armTransferWitness(page);
    await commitComposer(page, async () => (await wireOf(request, id)).game.venusScaleLevel === 30);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.megacredits, {timeout: 40_000, message: 'the server: 15 − 9 + 3'}).toBe(9);
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    const witness = await transferWitness(page);
    writeText('E-trail.txt', transferTrail(witness));
    expectCardAnswer(witness, 'E');
    expect(errors, 'no page error').toEqual([]);
  });

  test('(F) the sitting: the winner\'s two Venus steps pay the card +6 — and the sitting tells it off the card, no gate press cuts it', async ({page, request}) => {
    test.setTimeout(480_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const logs = collectConsole(page);
    const {playerId, seats} = await bootFixtureSeats(page, request, 'venus-contract-sitting', {query: PRESET.query});
    const red = seats.find((s) => s !== playerId)!;
    const logBefore = await contractLogLines(request, playerId);
    await armTransferWitness(page);
    await recordReaction(page, 'p65-f');
    const stop = await storyboard(page, 'F-sitting');
    await recordRailTrail(page, 'rail-F');
    await enterSittingByPass(page, request, playerId);
    await shoot(page, 'F-01-sitting');
    await closeSitting(page, request, playerId).catch(() => undefined);
    await closeSittingAs(request, red).catch(() => undefined);
    await expect.poll(async () => await contractLogLines(request, playerId), {timeout: 90_000,
      message: 'the journal names P65\'s answer on the sitting'}).toBeGreaterThan(logBefore);
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    await stop();
    await shoot(page, 'F-02-after');
    const witness = await transferWitness(page);
    const poses = await readTransient<ReactionPose>(page, 'p65-f');
    writeText('F-trail.txt', transferTrail(witness));
    writeText('F-console.txt', logs.join('\n'));
    writeText('F-poses.txt', `ticks: ${mcTicks(poses).join(' → ')}\n${poses.map((s) => `${Math.round(s.t)} ${JSON.stringify(s.v)}`).join('\n')}`);
    writeText('F-rail-trail.txt', await readRailTrail(page, 'rail-F'));
    const wire = await wireOf(request, playerId);
    expect(wire.game.venusScaleLevel, 'the server: the winner raised Venus 10 → 14 %').toBe(14);
    await expect.poll(async () => Number(((await page.locator(MC).first().textContent()) ?? '').replace(/\s+/g, '').match(/^-?\d+/)?.[0] ?? NaN),
      {timeout: 30_000, message: 'the M€ row converges on the server'}).toBe(wire.thisPlayer.megacredits);
    // PL-1799 / PL-1803 closed: the gate's presses answer the sitting, never the card's chain — its answer is TOLD.
    const births = witness.births.filter((b) => b.under.startsWith(`reactor:${CARD}`)).length;
    writeText('F-told.txt', `P65 births on the sitting: ${births}`);
    const cuts = (await readRailTrail(page, 'rail-F')).split('\n').filter((l) => l.includes('"reaction:cut"'));
    expect(cuts, 'no press of the sitting cuts the card\'s chain').toEqual([]);
    expectCardAnswer(witness, 'F');
    expect(poses.some((s) => s.v.atStage > 1), 'never two instances of P65').toBe(false);
    expect(errors, 'no page error').toEqual([]);
  });
});
