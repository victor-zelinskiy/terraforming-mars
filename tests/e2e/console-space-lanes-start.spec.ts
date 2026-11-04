import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, fetchPlayerModel, playQueueCard, press, pressUntil, reloadConsole, settle, waitForBoardHome, walkFocusUntil,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';
import {recordTransient, stopTransient} from './transientRecorder';

/**
 * P62 SPACE LANES — the start (ledger GA): «Gain 3 titanium. Effect: when you play a planet tag (Jovian · Earth · Venus ·
 * Mars — the fork counts Mars, the P85 precedent), you pay 2 M€ less.» The series' first STANDING DISCOUNT. The fixture
 * `space-lanes-start` stands the deployment queue (Mining Guild played, P62 + Donation kept) with a hand of Earth Office
 * (1 → 0) · Tharsis Alliance (Mars, 8 → 6) · Saturn Surfing (Jovian + Earth, 13 → 9) · Power Plant (4, no planet tag).
 *   (A) A on P62 → «+3» titanium born on the card's printed titanium (ONE token for the three printed stars — the k-th spec
 *       of one resource is born on the k-th icon, and there is one spec) landing in the titanium row, the row ticking on
 *       the touchdown (0 → 3, never before the token); no «Сработает» row in the queue for a discount; the server prices
 *       the hand with the discount in the very answer, and once the start is done the hand album's faces wear «−2» / «−4»
 *       (K29 — the dock paints BACKS, `handDockCards`; the prices live in `playerView.cardsInHand`, applied at once);
 *   (E) a reload after A: the titanium row and the hand's prices equal the server.
 * TIMING class (`timingSpecs.ts`): the births, the tick and the price's moment are sampled from before the press.
 * Storyboard: `TM_E2E_STORYBOARD=1` → screenshots/p62/tv4k/story-start/.
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'p62', PRESET.id);
const CARD = 'Space Lanes';
const TITANIUM = '.con-res__row--titanium .con-res__digits';
/** The hand's planet-tag cards and the discount the face must wear once P62 stands. */
const DELTAS: Readonly<Record<string, string>> = {'Tharsis Alliance': '−2', 'Saturn Surfing': '−4'};
const PRICES: Readonly<Record<string, number>> = {'Earth Office': 0, 'Tharsis Alliance': 6, 'Saturn Surfing': 9, 'Power Plant': 4};

type Wire = {
  cardsInHand?: Array<{name: string, calculatedCost?: number}>,
  game?: {gameAge?: number},
  thisPlayer: {titanium: number, tableau: Array<{name: string}>},
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const pricesOf = (w: Wire) => Object.fromEntries((w.cardsInHand ?? []).map((c) => [c.name, c.calculatedCost]));

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

/** What the player sees of the answer, recorded off the product's own writes from the press on. */
type StartPose = {titanium: string, forecastRows: number};
async function recordStart(page: Page, key: string): Promise<void> {
  await recordTransient(page, key, ({titanium}: {titanium: string}): StartPose => ({
    titanium: (document.querySelector(titanium)?.textContent ?? '').replace(/\s+/g, ''),
    forecastRows: document.querySelectorAll('.con-start [data-forecast-row]').length,
  }), {args: {titanium: TITANIUM}});
}

/** The distinct values the titanium row PAINTED, in order. */
function ticks(samples: ReadonlyArray<{v: StartPose}>): Array<number> {
  const out: Array<number> = [];
  for (const s of samples) {
    const n = Number(s.v.titanium.match(/^-?\d+/)?.[0] ?? NaN);
    if (Number.isFinite(n) && out[out.length - 1] !== n) {
      out.push(n);
    }
  }
  return out;
}

test.describe(`P62 Space Lanes · the start: 3 titanium off the printed stars, the hand's prices with the answer · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('(A · E) the start: «+3» off the face into the titanium row on its touchdown; the hand\'s prices fall with the answer; a reload equals the server', async ({page, request}) => {
    test.setTimeout(420_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const id = await bootFixture(page, request, 'space-lanes-start', {query: PRESET.query, landing: 'prompt'});
    await settle(page, {timeoutMs: 30_000});
    await expect(page.locator(`.con-start [data-queue-slot="${CARD}"]`), 'the prelude stands in the deployment queue').toHaveCount(1, {timeout: 60_000});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, id);
    expect(before.thisPlayer.titanium, 'the fixture: no titanium').toBe(0);
    expect(pricesOf(before), 'the fixture: the printed prices before P62').toEqual({'Earth Office': 1, 'Tharsis Alliance': 8, 'Saturn Surfing': 13, 'Power Plant': 4});

    const focused = () => page.evaluate(() => document.querySelector('.con-start__qcard--focused')?.getAttribute('data-queue-slot') ?? '');
    expect(await walkFocusUntil(page, async () => await focused() === CARD, focused, 8), 'the prelude focused in the queue').toBe(true);
    await settle(page, {timeoutMs: 20_000});
    // A standing discount is no reaction: the queue draws no «Сработает» row for it (the face prints «ЭФФЕКТ» — P57).
    await expect(page.locator('.con-start [data-forecast-row]'), 'no «Сработает» row for a discount').toHaveCount(0);
    await shoot(page, 'A-01-queue');

    await armTransferWitness(page);
    await recordStart(page, 'p62-a');
    const stop = await storyboard(page, 'start');
    expect(await playQueueCard(page, CARD), 'the prelude was played from the queue').toBe(true);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.titanium, {timeout: 40_000, message: 'the server: +3 titanium'}).toBe(3);
    const answered = await wireOf(request, id);
    await expect.poll(async () => (await page.locator(TITANIUM).first().textContent() ?? '').replace(/\s+/g, ''),
      {timeout: 30_000, message: 'the titanium row reads the server'}).toMatch(/^3/);
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    await stop();
    await shoot(page, 'A-02-after');

    expect(answered.thisPlayer.tableau.map((c) => c.name), 'the prelude on the table').toContain(CARD);
    expect(pricesOf(answered), 'the server prices the hand with the discount').toEqual(PRICES);

    const poses = await stopTransient<StartPose>(page, 'p62-a');
    writeText('A-poses.txt', poses.map((s) => `${Math.round(s.t)} ${JSON.stringify(s.v)}`).join('\n'));
    const painted = ticks(poses);
    expect(painted, `the titanium row ticked 0 → 3 once (${painted.join(' → ')})`).toEqual([0, 3]);
    expect(poses.every((s) => s.v.forecastRows === 0), 'no «Сработает» row at any moment of the play').toBe(true);

    const tick = poses.find((s) => /^3/.test(s.v.titanium));

    const witness = await transferWitness(page);
    // The witness keeps its own clock (`performance.now() − t0`); the recorder samples `Date.now()` — one axis.
    const origin = await page.evaluate(() => performance.timeOrigin +
      ((window as unknown as {__transferWitness?: {t0: number}}).__transferWitness?.t0 ?? 0));
    const trail = transferTrail(witness);
    writeText('A-trail.txt', trail);
    const landed = witness.landings.filter((l) => l.under === 'rail:titanium');
    expect(landed.length, `the titanium landed on its row (trail:\n${trail})`).toBeGreaterThanOrEqual(1);
    const births = witness.births.filter((b) => landed.some((l) => l.id === b.id));
    expect(births.length, `the landed titanium was born (trail:\n${trail})`).toBeGreaterThanOrEqual(1);
    expect(births.every((b) => /^(printed:|queue:|start-seat:|played:|prelude-seat|hero)/.test(b.under)),
      `born on the card's own face, never out of glass (trail:\n${trail})`).toBe(true);
    expect(births.map((b) => b.value), 'ONE token «+3» for the three printed stars').toEqual(['+3']);
    const touchdowns = landed.map((l) => l.touched === undefined ? undefined : Math.round(origin + l.touched));
    expect(touchdowns.every((at) => at !== undefined && tick !== undefined && tick.t >= at - 120),
      `the row ticked on the touchdown, never before the token (tick ${tick?.t}, touchdowns ${touchdowns.join(', ')})`).toBe(true);
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);

    // The hand's faces wear the discount — the album after the start (the dock paints backs).
    expect(await playQueueCard(page, 'Donation'), 'Donation was played from the queue').toBe(true);
    await waitForBoardHome(page, 40);
    for (let i = 0; i < 5 && await page.locator('.con-hand').count() === 0; i++) {
      await press(page, 'Period', 600); // RT → the quick wheel
      await press(page, 'Enter', 1400); // centre slot → the hand screen
    }
    const delta = (card: string) => page.evaluate((card) =>
      (document.querySelector(`.con-hand [data-zoom-slot="${card}"] .pcard__cost-delta`)?.textContent ?? '').trim(), card);
    for (const [card, d] of Object.entries(DELTAS)) {
      await expect.poll(() => delta(card), {timeout: 20_000, message: `${card} wears «${d}» in the album`}).toBe(d);
    }
    await expect.poll(() => delta('Power Plant'), {timeout: 5_000, message: 'Power Plant wears no discount'}).toBe('');
    await shoot(page, 'A-03-album-prices');
    expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-hand').count() === 0, {tries: 4, settleMs: 900}),
      'B leaves the hand').toBeTruthy();

    // (E) a reload: the titanium row and the hand's prices equal the server.
    await reloadConsole(page);
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    await expect.poll(async () => (await page.locator(TITANIUM).first().textContent() ?? '').replace(/\s+/g, ''),
      {timeout: 20_000, message: 'the titanium row reads the server after the reload'}).toMatch(/^3/);
    expect(pricesOf(await wireOf(request, id)), 'the prices after the reload').toEqual(PRICES);
    await shoot(page, 'E-reloaded');
    expect(errors, 'no page error').toEqual([]);
  });
});
