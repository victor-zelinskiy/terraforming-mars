import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, bootFixtureSeats, fetchPlayerModel, playCardFromHand, playQueueCard, press, reloadConsole, settle, walkFocusUntil,
} from './consoleStart';
import {closeSitting, closeSittingAs, enterSittingByPass} from './parliamentDrive';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';
import {readTransient, recordTransient} from './transientRecorder';

/**
 * P63 SUITABLE INFRASTRUCTURE — the forty-fifth Prelude 2 card (ledger GC · GD): «Gain 5 steel. Effect: once per action
 * you take, gain 2 M€ if you increase any production(s).» The series' first PRELUDE-REACTOR on PRODUCTION with a
 * ONCE-PER-ACTION limit, answering into the M€ rail. The server pays synchronously with the card as its source; the
 * forecast twin is honest about «once» (GD — the engine's exit pass states a `once` reactor ONCE per operation). The
 * client is nothing new by construction — this stand PROVES it:
 *   (A) the start (fixture `suitable-infrastructure-start`, 30 M€): A on P63 → +5 steel; Business Empire (+6 M€
 *       production, pay 6) carries «Сработает» +2 M€ on the status rail BEFORE the press; A → the price leaves, the start
 *       ends (Business Empire is the last prelude — a game keeps two) and P63 rises ONCE at the reaction stage over the
 *       board, its +2 born on its printed «2 M€» lands on the M€ row — 30 → 24, then up to 26: two touchdowns, never one
 *       jump «−4», never a second instance;
 *   (E) a reload after A: the rail equals the server, the reaction is not told again;
 *   (B) the hand (fixture `suitable-infrastructure-table`, 40 M€): Power Plant → «Сработает» +2 → the reactor out of its
 *       place, +2 on the M€ row; Industrial Microbes (TWO productions) → ONE «+2» (never «+4» — GD), the server +2;
 *       Release of Inert Gases → no row, no rise;
 *   (C) the Power Plant STANDARD project from the same table: the screen states the table's answer (+2) before the
 *       press; the commit — 40 → 29 (the price leaves) → 31 (the answer lands): two touchdowns, never «−9»;
 *   (D) the sitting (fixture `suitable-infrastructure-sitting` — Jovian Tax Rights pays blue +4 M€ production in the
 *       PARLIAMENT phase): P63 neither rises nor pays — no journal line names it.
 * The rules are pinned by `tests/cards/prelude2/SuitableInfrastructure.spec.ts` and `tests/models/effectForecast.spec.ts`
 * § one answer per operation. TIMING class (`timingSpecs.ts`): the births and the ticks are sampled motion. Storyboard:
 * `TM_E2E_STORYBOARD=1` → screenshots/p63/tv4k/story-*.
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'p63', PRESET.id);
const CARD = 'Suitable Infrastructure';
const MC = '.con-res__row--megacredits .con-res__digits';
const MC_CHIP = '[data-forecast-rail="stock:megacredits"]';

type Wire = {
  cardsInHand?: Array<{name: string}>,
  thisPlayer: {megacredits: number, steel: number, megacreditProduction?: number, energyProduction?: number, tableau: Array<{name: string}>},
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
    // the card lifted IN ITS PLACE — the start's shelf / seat, the table's own place, the composer's row
    lifted: document.querySelectorAll(`[data-played-key="${card}"][data-reaction-lifted], [data-played-key="${card}"] [data-reaction-lifted], ` +
      `[data-start-seat-card="${card}"][data-reaction-lifted], [data-reaction-home="${card}"][data-reaction-lifted]`).length,
    // the play scene's receiving stage: the reactor EMERGES out of its place (the ATTACHED host — TR81)
    emerged: document.querySelectorAll(`.con-recv__emerge[data-played-key="${card}"]`).length,
    // a SECOND instance at the reaction layer's stage (PL-1117 — the defect when a place holds the reactor)
    atStage: document.querySelectorAll(`.con-reaction__face[data-reaction-card="${card}"]`).length,
    faces: document.querySelectorAll('.con-reaction__face[data-reaction-card]').length,
  }), {args: {card: CARD, mc: MC}});
}

/** The distinct values the M€ row PAINTED, in order (a «24 → 26» is two ticks; «30 → 26» one jump). */
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

/**
 * TWO TOUCHDOWNS, judged by STATE (tests.md — never by how many frames a roll painted): the row starts at `start`, reaches
 * the price alone (`price`) before anything rises, then only RISES to `end` — the counter may roll the answer unit by
 * unit («24 → 25 → 26»), but never a jump past the price («30 → 26») and never the answer before the price.
 */
function priceThenAnswer(ticks: ReadonlyArray<number>, start: number, price: number, end: number): boolean {
  const at = ticks.indexOf(price);
  if (ticks[0] !== start || at < 0 || ticks[ticks.length - 1] !== end) {
    return false;
  }
  const falling = ticks.slice(0, at + 1).every((v, i, all) => i === 0 || v < all[i - 1]);
  const rising = ticks.slice(at).every((v, i, all) => i === 0 || v > all[i - 1]);
  return falling && rising;
}

/** The M€ chip of the table's answer as `scope` paints it — '' when none. */
async function forecastMc(page: Page, scope: string): Promise<string> {
  return page.evaluate(({scope, chip}) => {
    const row = document.querySelector(`${scope} [data-forecast-row]`);
    const el = row?.querySelector(chip);
    return el === null || el === undefined ? '' : (el.textContent ?? '').replace(/\s+/g, '');
  }, {scope, chip: MC_CHIP});
}

/** The journal lines naming P63 (the server's log). */
async function p63LogLines(request: APIRequestContext, id: string): Promise<number> {
  const res = await request.get(`/api/game/logs?id=${id}`);
  const log = res.ok() ? await res.json() as Array<{data?: Array<{value?: string}>}> : [];
  return log.filter((l) => (l.data ?? []).some((d) => d.value === CARD)).length;
}

test.describe(`P63 Suitable Infrastructure · a prelude-reactor on production, once per action · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('(A · E) the start: +5 steel; the next prelude carries «Сработает» +2, pays −6 then +2 in two touchdowns off the card; a reload tells nothing twice', async ({page, request}) => {
    test.setTimeout(420_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const id = await bootFixture(page, request, 'suitable-infrastructure-start', {query: PRESET.query, landing: 'prompt'});
    await settle(page, {timeoutMs: 30_000});
    await expect(page.locator(`.con-start [data-queue-slot="${CARD}"]`), 'the prelude stands in the deployment queue').toHaveCount(1, {timeout: 60_000});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, id);
    expect(before.thisPlayer.megacredits, 'the fixture: 30 M€').toBe(30);

    // P63 first — its own play raises no production: +5 steel, no answer of its own.
    await armTransferWitness(page);
    expect(await playQueueCard(page, CARD), 'P63 was played from the queue').toBe(true);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.steel, {timeout: 40_000, message: 'the server: +5 steel'}).toBe(5);
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    const steelWitness = await transferWitness(page);
    writeText('A-01-steel-trail.txt', transferTrail(steelWitness));
    expect(steelWitness.landings.some((l) => l.under === 'rail:steel'), `the +5 landed on the steel row (trail:\n${transferTrail(steelWitness)})`).toBe(true);
    expect((await wireOf(request, id)).thisPlayer.megacredits, 'P63 pays nothing for its own play').toBe(30);
    await shoot(page, 'A-01-after-p63');

    // The table's answer BEFORE the press — once, on the status rail: Business Empire raises the M€ production.
    const empire = 'Business Empire';
    const focused = () => page.evaluate(() => document.querySelector('.con-start__qcard--focused')?.getAttribute('data-queue-slot') ?? '');
    expect(await walkFocusUntil(page, async () => await focused() === empire, focused, 8), 'Business Empire focused in the queue').toBe(true);
    await expect.poll(() => forecastMc(page, '[data-start-prelude-forecast]'), {timeout: 20_000,
      message: '«Сработает» on the rail names P63\'s +2'}).toMatch(/\+2/);
    expect(await page.locator('.con-start [data-forecast-row]').count(), 'the answer stands ONCE on the scene').toBe(1);
    await shoot(page, 'A-02-queue-forecast');

    await armTransferWitness(page);
    await recordReaction(page, 'p63-a');
    const stop = await storyboard(page, 'start');
    expect(await playQueueCard(page, empire), 'Business Empire was played from the queue').toBe(true);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.megacredits, {timeout: 40_000,
      message: 'the server: 30 − 6 + 2'}).toBe(26);
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    await stop();
    await shoot(page, 'A-03-after');
    const after = await wireOf(request, id);
    expect(after.thisPlayer.megacreditProduction, 'the server: +6 M€ production').toBe(6);
    expect(after.thisPlayer.tableau.map((c) => c.name), 'P63 on the table').toContain(CARD);
    expect(await p63LogLines(request, id), 'the journal: P63 played + ONE standard answer line').toBe(2);

    const poses = await readTransient<ReactionPose>(page, 'p63-a');
    const ticks = mcTicks(poses);
    writeText('A-poses.txt', poses.map((s) => `${Math.round(s.t)} ${JSON.stringify(s.v)}`).join('\n'));
    expect(priceThenAnswer(ticks, 30, 24, 26), `the M€ row: 30 → 24 (the price), then up to 26 (the answer) — never one jump (${ticks.join(' → ')})`).toBe(true);
    // Business Empire is the LAST prelude (a game keeps two): its play ENDS the start, so no shelf «РАЗЫГРАНО» stands
    // when the answer comes — P63 rises as ONE face at the reaction stage over the board (no place holds it there).
    // Never two instances: never a lifted place AND a stage face at once, never two faces.
    expect(poses.some((s) => s.v.lifted > 0 || s.v.emerged > 0 || s.v.atStage > 0), 'P63 rose (its place, or the stage over the board)').toBe(true);
    expect(poses.some((s) => s.v.atStage > 1 || (s.v.atStage > 0 && (s.v.lifted > 0 || s.v.emerged > 0))), 'never two instances of P63').toBe(false);

    const witness = await transferWitness(page);
    const trail = transferTrail(witness);
    writeText('A-trail.txt', trail);
    const reactorBirths = witness.births.filter((b) => b.under.startsWith(`reactor:${CARD}`));
    expect(reactorBirths.length, `the +2 was born on P63's printed effect (trail:\n${trail})`).toBeGreaterThan(0);
    expect(witness.landings.some((l) => l.under === 'rail:megacredits'), `the +2 landed on the M€ row (trail:\n${trail})`).toBe(true);
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);

    // (E) a reload after the play: the rail equals the server, the reaction is not told again.
    await recordReaction(page, 'p63-e');
    await reloadConsole(page);
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    await expect.poll(async () => (await page.locator(MC).first().textContent() ?? '').replace(/\s+/g, ''),
      {timeout: 20_000, message: 'the M€ row reads the server after the reload'}).toMatch(/^26/);
    const reloaded = await readTransient<ReactionPose>(page, 'p63-e');
    expect(reloaded.every((s) => s.v.faces === 0 && s.v.lifted === 0 && s.v.emerged === 0), 'the reload tells no reaction again').toBe(true);
    expect((await wireOf(request, id)).thisPlayer.megacredits, 'the reload pays nothing').toBe(26);
    expect(errors, 'no page error').toEqual([]);
  });

  test('(B) the hand: «Сработает» +2 / ONE +2 for two productions / nothing, the reactor out of its place, the M€ row on the token', async ({page, request}) => {
    test.setTimeout(480_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const id = await bootFixture(page, request, 'suitable-infrastructure-table', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    expect((await wireOf(request, id)).thisPlayer.megacredits, 'the fixture: 40 M€').toBe(40);

    const cases: ReadonlyArray<{card: string, cost: number, gain: number}> = [
      {card: 'Power Plant', cost: 4, gain: 2},
      {card: 'Industrial Microbes', cost: 12, gain: 2},
      {card: 'Release of Inert Gases', cost: 14, gain: 0},
    ];
    for (const {card, cost, gain} of cases) {
      const slug = card.replace(/\s+/g, '-');
      const mcBefore = (await wireOf(request, id)).thisPlayer.megacredits;
      // The composer's «Сработает» — sampled from before the press (the driver confirms the play).
      await recordTransient(page, `fc-${slug}`, ({sel}: {sel: string}) => {
        const chips = Array.from(document.querySelectorAll(`.con-composer--play [data-forecast-row] ${sel}`));
        return chips.map((c) => (c.textContent ?? '').replace(/\s+/g, '')).join('|');
      }, {args: {sel: MC_CHIP}});
      await recordReaction(page, `p63-b-${slug}`);
      await armTransferWitness(page);
      const stop = await storyboard(page, `hand-${slug.toLowerCase()}`);
      expect(await playCardFromHand(page, card), `${card} was played from the hand`).toBeTruthy();
      await expect.poll(async () => (await wireOf(request, id)).thisPlayer.megacredits, {timeout: 40_000,
        message: `${card}: the server takes ${cost} and pays +${gain}`}).toBe(mcBefore - cost + gain);
      await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
      await stop();
      await shoot(page, `B-${slug}`);

      const forecast = (await readTransient<string>(page, `fc-${slug}`)).map((s) => s.v).filter((v) => v !== '');
      const poses = await readTransient<ReactionPose>(page, `p63-b-${slug}`);
      writeText(`B-${slug}-poses.txt`, [`forecast: ${[...new Set(forecast)].join(' / ')}`,
        ...poses.map((s) => `${Math.round(s.t)} ${JSON.stringify(s.v)}`)].join('\n'));
      const witness = await transferWitness(page);
      writeText(`B-${slug}-trail.txt`, transferTrail(witness));
      if (gain === 0) {
        expect(forecast, `${card}: no «Сработает» for the M€ row`).toEqual([]);
        expect(poses.every((s) => s.v.lifted === 0 && s.v.emerged === 0 && s.v.atStage === 0), `${card}: no reaction`).toBe(true);
        continue;
      }
      // ONE chip, «+2» — never «+4» (GD: one answer per operation, Industrial Microbes raises two productions).
      expect(forecast.length > 0 && forecast.every((v) => !v.includes('|') && /\+2(?!\d)/.test(v)),
        `${card}: «Сработает» ONE +2 before the press (${[...new Set(forecast)].join(' / ')})`).toBe(true);
      expect(poses.some((s) => s.v.lifted > 0 || s.v.emerged > 0 || s.v.atStage > 0), `${card}: Suitable Infrastructure rose`).toBe(true);
      expect(poses.some((s) => s.v.atStage > 1), `${card}: never two instances at the stage`).toBe(false);
      const ticks = mcTicks(poses);
      expect(ticks[ticks.length - 1], `${card}: the M€ row ends on the server (${ticks.join(' → ')})`).toBe(mcBefore - cost + gain);
      const trail = transferTrail(witness);
      expect(witness.births.some((b) => b.under.startsWith(`reactor:${CARD}`)), `${card}: the +2 born on the reactor's effect (trail:\n${trail})`).toBe(true);
      expect(witness.landings.some((l) => l.under === 'rail:megacredits'), `${card}: landed on the M€ row (trail:\n${trail})`).toBe(true);
      expect(endsOverGlass(witness), `${card}: no end over glass`).toEqual([]);
    }
    expect(errors, 'no page error').toEqual([]);
  });

  test('(C) the Power Plant standard project: the screen states the +2, the commit pays −11 then +2 in two touchdowns', async ({page, request}) => {
    test.setTimeout(360_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const id = await bootFixture(page, request, 'suitable-infrastructure-table', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, id);
    expect(before.thisPlayer.megacredits, 'the fixture: 40 M€').toBe(40);

    // The wheel → «Стандартные проекты» (LT, then A on the centre slot).
    await press(page, 'Comma');
    await press(page, 'Enter');
    await expect(page.locator('.con-stdp'), 'the standard projects workspace').toHaveCount(1, {timeout: 20_000});
    // The grid has two columns: home to the top, then snake through both (the stdp stand's walk).
    const focusedRow = () => page.evaluate(() => (document.querySelector('.con-stdp__card--focused .con-stdp__name')?.textContent ?? '').trim());
    const hit = async () => /электростанц/i.test(await focusedRow());
    for (let i = 0; i < 6 && !await hit(); i++) {
      await press(page, 'ArrowUp', 240);
    }
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft']) {
      if (await hit()) {
        break;
      }
      await press(page, key, 240);
    }
    expect(await hit(), `Power Plant focused (at «${await focusedRow()}»)`).toBe(true);
    await expect.poll(() => forecastMc(page, '.con-stdp'), {timeout: 20_000, message: 'the screen states the table\'s answer +2'}).toMatch(/\+2/);
    await shoot(page, 'C-01-forecast');

    await armTransferWitness(page);
    await recordReaction(page, 'p63-c');
    const stop = await storyboard(page, 'stdp');
    await press(page, 'Enter');
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.megacredits, {timeout: 40_000,
      message: 'the server: 40 − 11 + 2'}).toBe(31);
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    await stop();
    await shoot(page, 'C-02-after');
    expect((await wireOf(request, id)).thisPlayer.energyProduction, 'the server: +1 energy production').toBe(1);

    const poses = await readTransient<ReactionPose>(page, 'p63-c');
    const ticks = mcTicks(poses);
    writeText('C-poses.txt', poses.map((s) => `${Math.round(s.t)} ${JSON.stringify(s.v)}`).join('\n'));
    const witness = await transferWitness(page);
    writeText('C-trail.txt', transferTrail(witness));
    expect(priceThenAnswer(ticks, 40, 29, 31), `the M€ row: 40 → 29 (the price), then up to 31 (the answer) — never one jump «−9» (${ticks.join(' → ')})`).toBe(true);
    const trail = transferTrail(witness);
    expect(witness.births.some((b) => b.under.startsWith(`reactor:${CARD}`)), `the +2 born on the reactor's printed effect (trail:
${trail})`).toBe(true);
    expect(witness.landings.some((l) => l.under === 'rail:megacredits'), `the +2 landed on the M€ row (trail:
${trail})`).toBe(true);
    expect(poses.some((s) => s.v.atStage > 1), 'never two instances at the stage').toBe(false);
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);
    expect(errors, 'no page error').toEqual([]);
  });

  test('(D) the sitting: a law paying production in the PARLIAMENT phase — P63 neither rises nor pays', async ({page, request}) => {
    test.setTimeout(420_000);
    const {playerId, seats} = await bootFixtureSeats(page, request, 'suitable-infrastructure-sitting', {query: PRESET.query});
    const red = seats.find((s) => s !== playerId)!;
    const before = await wireOf(request, playerId);
    const logBefore = await p63LogLines(request, playerId);
    await recordReaction(page, 'p63-d');
    await enterSittingByPass(page, request, playerId);
    await shoot(page, 'D-01-sitting');
    await closeSitting(page, request, playerId).catch(() => undefined);
    await closeSittingAs(request, red).catch(() => undefined);
    await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.megacreditProduction ?? 0, {timeout: 60_000,
      message: 'the law paid blue its M€ production'}).toBeGreaterThan(before.thisPlayer.megacreditProduction ?? 0);
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    await shoot(page, 'D-02-after');
    expect(await p63LogLines(request, playerId), 'no journal line names P63 — the hook is silent in the PARLIAMENT phase').toBe(logBefore);
    const poses = await readTransient<ReactionPose>(page, 'p63-d');
    expect(poses.every((s) => s.v.lifted === 0 && s.v.emerged === 0 && s.v.atStage === 0), 'P63 never rose').toBe(true);
    expect(await page.locator(`[data-forecast-row] ${MC_CHIP}`).count(), 'nothing promises P63\'s M€ on the sitting').toBe(0);
  });
});
