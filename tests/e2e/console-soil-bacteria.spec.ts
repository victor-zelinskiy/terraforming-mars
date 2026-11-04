import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, fetchPlayerModel, playCardFromHand, playQueueCard, press, reloadConsole, settle, walkFocusUntil,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';
import {readTransient, recordTransient} from './transientRecorder';

/**
 * P61 SOIL BACTERIA — the forty-third Prelude 2 card (ledger FY): «Draw 2 microbe cards and gain 3 plants. Effect: when
 * playing a plant tag or a microbe tag, including this, gain 1 plant.» The series' first PRELUDE-REACTOR on a TAG that
 * answers INTO THE RAIL. The server pays the plant synchronously with the card as its source (the reaction record, cause
 * = the played card); the client is nothing new by construction (TRP9 Medical Institute §3) — this stand PROVES it:
 *   (A) the start (fixture `soil-bacteria-start`, the deck seeded Power Plant · Ants · Asteroid · Tardigrades): the status
 *       rail names the table's answer ONCE before the press (+1 plant — the card's own Microbe tag); A → +3 off the
 *       printed «3 [plant]» into the plants row, P61 RISES ON ITS SHELF «РАЗЫГРАНО» (never a second instance at the
 *       reaction stage), its +1 born on its effect row lands in the plants row — the row ticks 0 → 3 → 4, two touchdowns,
 *       never one jump; the search «ВСКРЫТО 4 · ПОЛУЧЕНО 2 · СБРОШЕНО 2 — с меткой микроба», Ants + Tardigrades taken;
 *   (D) a reload after A: the rail and the hand equal the server, the reaction is not told again;
 *   (B) the hand (fixture `soil-bacteria-table`): Ants → «Сработает» +1 plant → A → the reactor out of its place on the
 *       table, the token in the plants row (10 → 11); Advanced Ecosystems → «+2» (11 → 13); Power Plant → no row, no rise;
 *   (C) mid-game: WG Project deals P61 — +3, the own +1 and the search inside the hand's outcome zone.
 * The rules are pinned by `tests/cards/prelude2/SoilBacteria.spec.ts`. TIMING class (`timingSpecs.ts`): the births and the
 * ticks are sampled motion. Storyboard: `TM_E2E_STORYBOARD=1` → screenshots/p61/tv4k/story-*.
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'p61', PRESET.id);
const CARD = 'Soil Bacteria';
const RULE = 'with:microbe';
const BADGE = '[data-reveal-search]';
const PLANTS = '.con-res__row--plants .con-res__digits';

type Wire = {
  cardsInHand?: Array<{name: string}>,
  thisPlayer: {plants: number, tableau: Array<{name: string}>},
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const handOf = (w: Wire) => (w.cardsInHand ?? []).map((c) => c.name);

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
type ReactionPose = {plants: string, lifted: number, emerged: number, atStage: number, faces: number};
async function recordReaction(page: Page, key: string): Promise<void> {
  await recordTransient(page, key, ({card, plants}: {card: string, plants: string}): ReactionPose => ({
    plants: (document.querySelector(plants)?.textContent ?? '').replace(/\s+/g, ''),
    // the card lifted IN ITS PLACE — the start's shelf / seat, the table's own place, the composer's row
    lifted: document.querySelectorAll(`[data-played-key="${card}"][data-reaction-lifted], [data-played-key="${card}"] [data-reaction-lifted], ` +
      `[data-start-seat-card="${card}"][data-reaction-lifted], [data-reaction-home="${card}"][data-reaction-lifted]`).length,
    // the play scene's receiving stage: the reactor EMERGES out of its place (the ATTACHED host — TR81)
    emerged: document.querySelectorAll(`.con-recv__emerge[data-played-key="${card}"]`).length,
    // a SECOND instance at the reaction layer's stage (PL-1117 — the defect when a place holds the reactor)
    atStage: document.querySelectorAll(`.con-reaction__face[data-reaction-card="${card}"]`).length,
    faces: document.querySelectorAll('.con-reaction__face[data-reaction-card]').length,
  }), {args: {card: CARD, plants: PLANTS}});
}

/** The distinct values the plants row PAINTED, in order (a «3 → 4» is two ticks; «0 → 4» one jump). */
function plantTicks(samples: ReadonlyArray<{v: ReactionPose}>): Array<number> {
  const out: Array<number> = [];
  for (const s of samples) {
    const n = Number(s.v.plants.match(/^-?\d+/)?.[0] ?? NaN);
    if (Number.isFinite(n) && out[out.length - 1] !== n) {
      out.push(n);
    }
  }
  return out;
}

async function expectBadge(page: Page, scope: string): Promise<void> {
  const badge = page.locator(`${scope} ${BADGE}`.trim()).first();
  await badge.waitFor({timeout: 60_000});
  await expect(badge, 'revealed').toHaveAttribute('data-search-revealed', '4', {timeout: 20_000});
  await expect(badge, 'taken').toHaveAttribute('data-search-taken', '2');
  await expect(badge, 'discarded').toHaveAttribute('data-search-discarded', '2');
  await expect(badge.locator('[data-draw-search]'), 'the rule by its signature').toHaveAttribute('data-draw-search', RULE);
  // the tag is drawn as its glyph after «с меткой» — the signature above names it
  await expect(badge, 'the rule in words').toContainText(/с меткой/i);
}

/** Take the batch (A) until the server's hand holds `names` and no reveal stands. */
async function take(page: Page, request: APIRequestContext, id: string, names: ReadonlyArray<string>): Promise<Wire> {
  for (let i = 0; i < 10; i++) {
    const wire = await wireOf(request, id);
    if (names.every((n) => handOf(wire).includes(n)) && await page.locator('.con-reveal').count() === 0) {
      return wire;
    }
    if (await page.locator('.con-reveal').count() > 0) {
      await press(page, 'Enter', 900);
    } else {
      await settle(page, {timeoutMs: 20_000}).catch(() => undefined);
    }
  }
  return wireOf(request, id);
}

/** The table's answer as the rail / the composer chips it — the plants chip's printed amount, '' when none. */
async function forecastPlants(page: Page, scope: string): Promise<string> {
  return page.evaluate((scope) => {
    const row = document.querySelector(`${scope} [data-forecast-row]`);
    const chip = row?.querySelector('[data-forecast-rail="stock:plants"]');
    return chip === null || chip === undefined ? '' : (chip.textContent ?? '').replace(/\s+/g, '');
  }, scope);
}

test.describe(`P61 Soil Bacteria · a prelude-reactor answering a tag into the rail · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('(A · D) the start: the answer named before the press, +3 then the own +1 in two touchdowns off the shelf, the microbe search; a reload tells nothing twice', async ({page, request}) => {
    test.setTimeout(420_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const id = await bootFixture(page, request, 'soil-bacteria-start', {query: PRESET.query, landing: 'prompt'});
    await settle(page, {timeoutMs: 30_000});
    await expect(page.locator(`.con-start [data-queue-slot="${CARD}"]`), 'the prelude stands in the deployment queue').toHaveCount(1, {timeout: 60_000});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, id);
    expect(before.thisPlayer.plants, 'the fixture: no plants').toBe(0);

    // The table's answer BEFORE the press — once, on the status rail (P79): +1 plant, the card's own Microbe tag.
    const focused = () => page.evaluate(() => document.querySelector('.con-start__qcard--focused')?.getAttribute('data-queue-slot') ?? '');
    expect(await walkFocusUntil(page, async () => await focused() === CARD, focused, 8), 'the prelude focused in the queue').toBe(true);
    await expect.poll(() => forecastPlants(page, '[data-start-prelude-forecast]'), {timeout: 20_000,
      message: '«Сработает» on the rail names the own plant'}).toMatch(/\+1/);
    expect(await page.locator('.con-start [data-forecast-row]').count(), 'the answer stands ONCE on the scene').toBe(1);
    await shoot(page, 'A-01-queue-forecast');

    await armTransferWitness(page);
    await recordReaction(page, 'p61-a');
    const stop = await storyboard(page, 'start');
    expect(await playQueueCard(page, CARD), 'the prelude was played from the queue').toBe(true);
    await expectBadge(page, '');
    await shoot(page, 'A-02-reveal');
    const after = await take(page, request, id, ['Ants', 'Tardigrades']);
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    await stop();
    await shoot(page, 'A-03-after');

    expect(after.thisPlayer.plants, 'the server: +3 and the own +1').toBe(4);
    expect(handOf(after), 'Ants + Tardigrades taken').toEqual(expect.arrayContaining(['Ants', 'Tardigrades']));
    expect(after.thisPlayer.tableau.map((c) => c.name), 'the prelude on the table').toContain(CARD);

    const poses = await readTransient<ReactionPose>(page, 'p61-a');
    const ticks = plantTicks(poses);
    writeText('A-poses.txt', poses.map((s) => `${Math.round(s.t)} ${JSON.stringify(s.v)}`).join('\n'));
    expect(ticks, `the plants row ticked 0 → 3 → 4 — two touchdowns, never one jump (${ticks.join(' → ')})`).toEqual([0, 3, 4]);
    expect(poses.some((s) => s.v.lifted > 0), 'the prelude rose IN ITS PLACE (the shelf «РАЗЫГРАНО» / the seat)').toBe(true);
    expect(poses.every((s) => s.v.atStage === 0), 'never a second instance at the reaction stage').toBe(true);

    const witness = await transferWitness(page);
    const trail = transferTrail(witness);
    writeText('A-trail.txt', trail);
    const intoPlants = witness.landings.filter((l) => l.under === 'rail:plants');
    expect(intoPlants.length, `the +3 and the +1 landed on the plants row (trail:\n${trail})`).toBeGreaterThanOrEqual(2);
    const reactorBirths = witness.births.filter((b) => b.under.startsWith(`reactor:${CARD}`));
    expect(reactorBirths.length, `the own plant was born on the reactor's printed effect (trail:\n${trail})`).toBeGreaterThan(0);
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);

    // (D) a reload after the play: the rail and the hand equal the server, the reaction is not told again.
    await recordReaction(page, 'p61-d');
    await reloadConsole(page);
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    await expect.poll(async () => (await page.locator(PLANTS).first().textContent() ?? '').replace(/\s+/g, ''),
      {timeout: 20_000, message: 'the plants row reads the server after the reload'}).toMatch(/^4/);
    const reloaded = await readTransient<ReactionPose>(page, 'p61-d');
    expect(reloaded.every((s) => s.v.faces === 0 && s.v.lifted === 0 && s.v.emerged === 0), 'the reload tells no reaction again').toBe(true);
    expect(handOf(await wireOf(request, id)), 'the hand unchanged by the reload').toEqual(handOf(after));
    expect(errors, 'no page error').toEqual([]);
  });

  test('(B) the hand: «Сработает» +1 / +2 / nothing, the reactor out of its place, the plants row on the token', async ({page, request}) => {
    test.setTimeout(480_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const logs: Array<string> = [];
    page.on('console', (m) => {
      if (/reaction|rail-reward|transfer/.test(m.text())) {
        logs.push(`[${m.type()}] ${m.text()}`);
      }
    });
    const id = await bootFixture(page, request, 'soil-bacteria-table', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    expect((await wireOf(request, id)).thisPlayer.plants, 'the fixture: 10 plants').toBe(10);

    const cases: ReadonlyArray<{card: string, gain: number}> = [
      {card: 'Ants', gain: 1},
      {card: 'Advanced Ecosystems', gain: 2},
      {card: 'Power Plant', gain: 0},
    ];
    for (const {card, gain} of cases) {
      const plantsBefore = (await wireOf(request, id)).thisPlayer.plants;
      // The composer's «Сработает» — sampled from before the press (the driver confirms the play).
      await recordTransient(page, `fc-${card}`, ({sel}: {sel: string}) => {
        const chip = document.querySelector(`.con-composer--play [data-forecast-row] ${sel}`);
        return chip === null ? '' : (chip.textContent ?? '').replace(/\s+/g, '');
      }, {args: {sel: '[data-forecast-rail="stock:plants"]'}});
      await recordReaction(page, `p61-b-${card}`);
      await armTransferWitness(page);
      const stop = await storyboard(page, `hand-${card.replace(/\s+/g, '-').toLowerCase()}`);
      expect(await playCardFromHand(page, card), `${card} was played from the hand`).toBeTruthy();
      await expect.poll(async () => (await wireOf(request, id)).thisPlayer.plants, {timeout: 40_000,
        message: `${card}: the server pays +${gain}`}).toBe(plantsBefore + gain);
      await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
      await stop();
      await shoot(page, `B-${card.replace(/\s+/g, '-')}`);

      const forecast = (await readTransient<string>(page, `fc-${card}`)).map((s) => s.v).filter((v) => v !== '');
      const poses = await readTransient<ReactionPose>(page, `p61-b-${card}`);
      writeText(`B-${card.replace(/\s+/g, '-')}-poses.txt`, poses.map((s) => `${Math.round(s.t)} ${JSON.stringify(s.v)}`).join('\n'));
      const witness = await transferWitness(page);
      const ready = await page.evaluate(() => JSON.stringify((window as unknown as {__conReady?: () => {transfer?: unknown, reaction?: unknown}}).__conReady?.(), null, 1));
      writeText(`B-${card.replace(/\s+/g, '-')}-trail.txt`, [transferTrail(witness), '--- product ---', ready, '--- logs ---', ...logs].join('\n'));
      if (gain === 0) {
        expect(forecast, `${card}: no «Сработает» for the plants`).toEqual([]);
        expect(poses.every((s) => s.v.lifted === 0 && s.v.emerged === 0 && s.v.atStage === 0), `${card}: no reaction`).toBe(true);
        continue;
      }
      expect(forecast.some((v) => v.includes(`+${gain}`)), `${card}: «Сработает» +${gain} before the press (${forecast.join(' | ')})`).toBe(true);
      expect(poses.some((s) => s.v.lifted > 0 || s.v.emerged > 0 || s.v.atStage > 0), `${card}: Soil Bacteria rose`).toBe(true);
      expect(poses.some((s) => s.v.atStage > 1), `${card}: never two instances at the stage`).toBe(false);
      const ticks = plantTicks(poses);
      expect(ticks[ticks.length - 1], `${card}: the plants row ends on the server (${ticks.join(' → ')})`).toBe(plantsBefore + gain);
      const trail = transferTrail(witness);
      expect(witness.births.some((b) => b.under.startsWith(`reactor:${CARD}`)), `${card}: the plant born on the reactor's effect (trail:\n${trail})`).toBe(true);
      expect(witness.landings.some((l) => l.under === 'rail:plants'), `${card}: landed on the plants row (trail:\n${trail})`).toBe(true);
      expect(endsOverGlass(witness), `${card}: no end over glass`).toEqual([]);
    }
    expect(errors, 'no page error').toEqual([]);
  });

  test('(C) mid-game: WG Project deals P61 — +3, the own +1 and the search inside the hand', async ({page, request}) => {
    test.setTimeout(360_000);
    const id = await bootFixture(page, request, 'soil-bacteria-wg', {query: PRESET.query});
    await settle(page);
    const before = await wireOf(request, id);
    const posts: Array<string> = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
        posts.push(r.postData() ?? '');
      }
    });
    const pick = '.con-hand__outcome .con-deckpick--play';
    expect(await playCardFromHand(page, 'WG Project'), 'WG Project was played').toBeTruthy();
    await expect(page.locator(`${pick}[data-flow="choosing"]`), 'the prelude pick stands in the hand').toHaveCount(1, {timeout: 40_000});
    const focused = () => page.evaluate(() => document.querySelector('.con-deckpick .con-cards__slot--focused')?.getAttribute('data-deckpick-slot') ?? '');
    expect(await walkFocusUntil(page, async () => await focused() === CARD, focused, 12), `focused ${CARD}`).toBeTruthy();
    await press(page, 'Enter', 400);
    await armTransferWitness(page);
    await recordReaction(page, 'p61-c');
    const stop = await storyboard(page, 'wg');
    const sent = posts.length;
    for (let attempt = 0; attempt < 3 && posts.length === sent; attempt++) {
      await press(page, 'Period', 300); // RT — the commit
      await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(sent).catch(() => undefined);
    }
    expect(posts.length, 'ONE POST').toBe(sent + 1);
    await expectBadge(page, '.con-hand__outcome');
    await shoot(page, 'C-01-reveal-in-hand');
    const after = await take(page, request, id, ['Ants', 'Tardigrades']);
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    await stop();
    expect(after.thisPlayer.plants - before.thisPlayer.plants, '+3 and the own +1').toBe(4);
    const poses = await readTransient<ReactionPose>(page, 'p61-c');
    writeText('C-poses.txt', poses.map((s) => `${Math.round(s.t)} ${JSON.stringify(s.v)}`).join('\n'));
    expect(poses.some((s) => s.v.atStage > 1), 'never two instances at the stage').toBe(false);
    const ticks = plantTicks(poses);
    expect(ticks[ticks.length - 1], `the plants row ends on the server (${ticks.join(' → ')})`).toBe(after.thisPlayer.plants);
    const witness = await transferWitness(page);
    writeText('C-trail.txt', transferTrail(witness));
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);
  });
});
