import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, bootFixtureSeats, fetchPlayerModel, playCardFromHand, playQueueCard, pressUntil, reloadConsole, settle, waitForBoardHome, walkFocusUntil,
} from './consoleStart';
import {closeSitting, closeSittingAs, enterSittingByPass} from './parliamentDrive';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';
import {readTransient, recordTransient} from './transientRecorder';

/**
 * P64 TERRAFORMING DEAL — the forty-sixth Prelude 2 card (ledger GE · GF): «Effect: each step your TR is raised, you
 * gain 2 M€.» The series' first prelude whose play gives NOTHING now, and the first prelude-reactor on the RATING
 * answering into the M€ rail; a Redux table reads upstream's `inTurmoil` as the PARLIAMENT phase. The client is nothing
 * new by construction — this stand PROVES it:
 *   (A) the start (fixture `terraforming-deal-start`, 30 M€): A on P64 → nothing paid, nothing waited for — the queue
 *       serves the next prelude; UNMI Contractor (+3 TR AND a card) carries «Сработает» +6 M€ on the status rail BEFORE
 *       the press; A → the rating lands, P64 rises ONCE, its +6 born on its printed «2 M€» lands on the M€ row — the
 *       polish GF: the shelf is parked behind the same play's DRAW, so the start's place shows no face and the reactor
 *       rises at the stage (before: no rise, the row jumped 30 → 36 with no cause); (A2) the same road with no draw
 *       (Nitrogen Shipment, fixture `terraforming-deal-start-nodraw`) — P64 lifts on its shelf;
 *   (F) a reload after A: the rail equals the server, the reaction is not told again;
 *   (B) the hand under the ruling Greens (fixture `terraforming-deal-table`): Release of Inert Gases (+2 TR) — «Сработает»
 *       names the party AND the card; the commit pays −14, then the two answers in two touchdowns (+4 · +4), never one
 *       jump; the server −14 + 8;
 *   (C) the heat conversion from the same table: 8 heat → +1 TR → the Greens +2 and P64 +2;
 *   (D) the sitting (fixture `terraforming-deal-sitting` — blue wins Mohole Contest at −20 °C): the winner's +2 TR pays P64
 *       +4 in the PARLIAMENT phase; the rail agrees with the server, never two instances. The told answer is a NAMED GAP
 *       (PL-1799): the card's standalone chain waits for the sitting's beats and the presses answering the sitting's
 *       gates cut it before it rises;
 *   (E) WG Project → P64 mid-game (fixture `terraforming-deal-wg`): the pick plays a prelude with no immediate effect —
 *       the card lands on the table, nothing hangs.
 * The rules are pinned by `tests/cards/prelude2/TerraformingDeal.spec.ts`. TIMING class (`timingSpecs.ts`): the births
 * and the ticks are sampled motion. Storyboard: `TM_E2E_STORYBOARD=1` → screenshots/p64/tv4k/story-*.
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'p64', PRESET.id);
const CARD = 'Terraforming Deal';
const MC = '.con-res__row--megacredits .con-res__digits';
const MC_CHIP = '[data-forecast-rail="stock:megacredits"]';

type Wire = {
  cardsInHand?: Array<{name: string}>,
  thisPlayer: {megacredits: number, heat: number, terraformRating: number, tableau: Array<{name: string}>},
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
type ReactionPose = {mc: string, lifted: number, emerged: number, atStage: number, faces: number, shelf: number, queue: number};
async function recordReaction(page: Page, key: string): Promise<void> {
  await recordTransient(page, key, ({card, mc}: {card: string, mc: string}): ReactionPose => ({
    mc: (document.querySelector(mc)?.textContent ?? '').replace(/\s+/g, ''),
    // the card lifted IN ITS PLACE — the start's shelf / seat, the table's own place, the composer's row
    lifted: document.querySelectorAll(`[data-played-key="${card}"][data-reaction-lifted], [data-played-key="${card}"] [data-reaction-lifted], ` +
      `[data-start-seat-card="${card}"][data-reaction-lifted], [data-reaction-home="${card}"][data-reaction-lifted]`).length,
    emerged: document.querySelectorAll(`.con-recv__emerge[data-played-key="${card}"]`).length,
    atStage: document.querySelectorAll(`.con-reaction__face[data-reaction-card="${card}"]`).length,
    faces: document.querySelectorAll('.con-reaction__face[data-reaction-card]').length,
    // the start: the card seated on the «РАЗЫГРАНО» shelf / still in the queue
    shelf: document.querySelectorAll(`.con-start [data-start-seat-card="${card}"]`).length,
    queue: document.querySelectorAll(`.con-start [data-queue-slot="${card}"]`).length,
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

/** The product's own diagnostics of the reaction / rail / transfer families, kept for the trail files. */
function collectConsole(page: Page): Array<string> {
  const lines: Array<string> = [];
  page.on('console', (m) => {
    if (/reaction|rail|transfer|start-shadow|liveness|screen-shadow|hold/i.test(m.text())) {
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

/** The journal lines naming P64 (the server's log). */
async function dealLogLines(request: APIRequestContext, id: string): Promise<number> {
  const res = await request.get(`/api/game/logs?id=${id}`);
  const log = res.ok() ? await res.json() as Array<{data?: Array<{value?: string}>}> : [];
  return log.filter((l) => (l.data ?? []).some((d) => d.value === CARD)).length;
}

test.describe(`P64 Terraforming Deal · a prelude with no immediate effect, a reactor on the rating · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  const STARTS = [
    {tag: 'A', fixture: 'terraforming-deal-start', second: 'UNMI Contractor', steps: 3, ownMc: 0},
    // the same road with NO draw beside the rating — the answer rides the rating alone
    {tag: 'A2', fixture: 'terraforming-deal-start-nodraw', second: 'Nitrogen Shipment', steps: 1, ownMc: 5},
  ] as const;
  for (const {tag, fixture, second, steps, ownMc} of STARTS) {
    test(`(${tag} · F) the start: P64 plays with no reward and nothing waits; ${second} carries «Сработает» +${2 * steps}, the rating lands, P64 answers once off its card; a reload tells nothing twice`, async ({page, request}) => {
      test.setTimeout(420_000);
      const answer = 2 * steps;
      const end = 30 + ownMc + answer;
      const errors: Array<string> = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      const logs = collectConsole(page);
      const id = await bootFixture(page, request, fixture, {query: PRESET.query, landing: 'prompt'});
      await settle(page, {timeoutMs: 30_000});
      await expect(page.locator(`.con-start [data-queue-slot="${CARD}"]`), 'the prelude stands in the deployment queue').toHaveCount(1, {timeout: 60_000});
      await settle(page, {timeoutMs: 30_000});
      const before = await wireOf(request, id);
      expect(before.thisPlayer.megacredits, 'the fixture: 30 M€').toBe(30);
      const tr = before.thisPlayer.terraformRating;
      const reading = await page.locator(`.con-start [data-queue-slot="${CARD}"] [data-qcard-reading]`).getAttribute('data-qcard-verdict').catch(() => null);
      writeText(`${tag}-00-reading.txt`, `P64 queue reading: ${reading ?? '(none)'}`);
      expect(reading === null || reading === 'playable' || reading === 'none', `a prelude with no immediate effect is no loss and no wait (read «${reading}»)`).toBe(true);

      // P64 first — its play pays nothing: no wave, no wait. The next prelude must be served without a reward beat's delay.
      await recordReaction(page, 'p64-a0');
      await armTransferWitness(page);
      const stop0 = await storyboard(page, `${tag}-start-empty`);
      const t0 = Date.now();
      expect(await playQueueCard(page, CARD), 'P64 was played from the queue').toBe(true);
      await expect.poll(async () => (await wireOf(request, id)).thisPlayer.tableau.some((c) => c.name === CARD), {timeout: 40_000,
        message: 'the server: P64 on the table'}).toBe(true);
      await settle(page, {timeoutMs: 40_000});
      const servedMs = Date.now() - t0;
      await stop0();
      const empty = await transferWitness(page);
      writeText(`${tag}-01-empty-trail.txt`, `served after ${servedMs} ms\n${transferTrail(empty)}`);
      expect(empty.births.length, `the empty play flies nothing (trail:\n${transferTrail(empty)})`).toBe(0);
      const mid = await wireOf(request, id);
      expect([mid.thisPlayer.megacredits, mid.thisPlayer.terraformRating], 'P64 pays nothing for its own play').toEqual([30, tr]);
      const p0 = await readTransient<ReactionPose>(page, 'p64-a0');
      writeText(`${tag}-01-poses.txt`, p0.map((s) => `${Math.round(s.t)} ${JSON.stringify(s.v)}`).join('\n'));
      expect(p0.some((s) => s.v.faces > 0), 'nothing rises for an empty play').toBe(false);
      await shoot(page, `${tag}-01-after-p64`);

      // The table's answer BEFORE the press — once, on the status rail: the next prelude raises the rating.
      const unmi = second;
      const focused = () => page.evaluate(() => document.querySelector('.con-start__qcard--focused')?.getAttribute('data-queue-slot') ?? '');
      expect(await walkFocusUntil(page, async () => await focused() === unmi, focused, 8), `${second} focused in the queue`).toBe(true);
      await expect.poll(() => forecastMc(page, '[data-start-prelude-forecast]'), {timeout: 20_000,
        message: `«Сработает» on the rail names P64's +${answer}`}).toMatch(new RegExp(`\\+${answer}(?!\\d)`));
      expect(await page.locator('.con-start [data-forecast-row]').count(), 'the answer stands ONCE on the scene').toBe(1);
      await shoot(page, `${tag}-02-queue-forecast`);

      await armTransferWitness(page);
      await recordReaction(page, `p64-${tag}`);
      const stop = await storyboard(page, `${tag}-start`);
      await recordRailTrail(page, `rail-${tag}`);
      expect(await playQueueCard(page, unmi), `${second} was played from the queue`).toBe(true);
      await expect.poll(async () => (await wireOf(request, id)).thisPlayer.megacredits, {timeout: 40_000,
        message: `the server: 30 + ${ownMc} + ${answer}`}).toBe(end);
      await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
      await stop();
      await shoot(page, `${tag}-03-after`);
      const after = await wireOf(request, id);
      expect(after.thisPlayer.terraformRating, `the server: +${steps} TR`).toBe(tr + steps);
      expect(await dealLogLines(request, id), 'the journal: P64 played + ONE standard answer line').toBe(2);

      const poses = await readTransient<ReactionPose>(page, `p64-${tag}`);
      const ticks = mcTicks(poses);
      writeText(`${tag}-poses.txt`, poses.map((s) => `${Math.round(s.t)} ${JSON.stringify(s.v)}`).join('\n'));
      const witness = await transferWitness(page);
      const trail = transferTrail(witness);
      writeText(`${tag}-trail.txt`, trail);
      writeText(`${tag}-console.txt`, logs.join(String.fromCharCode(10)));
      writeText(`${tag}-rail-trail.txt`, await readRailTrail(page, `rail-${tag}`));
      expect(ticks[0], `the M€ row starts at 30 (${ticks.join(' → ')})`).toBe(30);
      expect(ticks[ticks.length - 1], `the M€ row ends on the server (${ticks.join(' → ')})`).toBe(end);
      expect(ticks.every((v, i) => i === 0 || v > ticks[i - 1]), `the M€ row only rises (${ticks.join(' → ')})`).toBe(true);
      expect(poses.some((s) => s.v.lifted > 0 || s.v.emerged > 0 || s.v.atStage > 0), 'P64 rose (its place, or the stage over the board)').toBe(true);
      expect(poses.some((s) => s.v.atStage > 1 || (s.v.atStage > 0 && (s.v.lifted > 0 || s.v.emerged > 0))), 'never two instances of P64').toBe(false);

      const reactorBirths = witness.births.filter((b) => b.under.startsWith(`reactor:${CARD}`));
      expect(reactorBirths.length, `the +${answer} was born on P64's printed effect (trail:\n${trail})`).toBeGreaterThan(0);
      expect(witness.landings.some((l) => l.under === 'rail:megacredits'), `the +${answer} landed on the M€ row (trail:\n${trail})`).toBe(true);
      const firstRating = witness.landings.find((l) => l.under === 'rail:tr' || l.under.startsWith('rail:tr'));
      const firstAnswer = witness.landings.find((l) => reactorBirths.some((b) => b.id === l.id));
      if (firstRating !== undefined && firstAnswer !== undefined) {
        expect(firstAnswer.t, `the answer lands after the rating it answers (trail:\n${trail})`).toBeGreaterThanOrEqual(firstRating.t);
      }
      expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);

      // (F) a reload after the play: the rail equals the server, the reaction is not told again.
      await recordReaction(page, `p64-${tag}-f`);
      await reloadConsole(page);
      await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
      await expect.poll(async () => (await page.locator(MC).first().textContent() ?? '').replace(/\s+/g, ''),
        {timeout: 20_000, message: 'the M€ row reads the server after the reload'}).toMatch(new RegExp(`^${end}`));
      const reloaded = await readTransient<ReactionPose>(page, `p64-${tag}-f`);
      expect(reloaded.every((s) => s.v.faces === 0 && s.v.lifted === 0 && s.v.emerged === 0), 'the reload tells no reaction again').toBe(true);
      expect((await wireOf(request, id)).thisPlayer.megacredits, 'the reload pays nothing').toBe(end);
      expect(errors, 'no page error').toEqual([]);
    });
  }

  test('(B) the hand under the Greens: «Сработает» names the party and the card; −14, then two answers in two touchdowns (+4 · +4)', async ({page, request}) => {
    test.setTimeout(420_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const logs = collectConsole(page);
    const id = await bootFixture(page, request, 'terraforming-deal-table', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, id);
    expect(before.thisPlayer.megacredits, 'the fixture: 30 M€').toBe(30);
    const card = 'Release of Inert Gases';
    await recordTransient(page, 'fc-b', ({sel}: {sel: string}) => {
      const chips = Array.from(document.querySelectorAll(`.con-composer--play [data-forecast-row] ${sel}`));
      return chips.map((c) => (c.textContent ?? '').replace(/\s+/g, '')).join('|');
    }, {args: {sel: MC_CHIP}});
    await recordReaction(page, 'p64-b');
    await armTransferWitness(page);
    const stop = await storyboard(page, 'hand-greens');
    expect(await playCardFromHand(page, card), `${card} was played from the hand`).toBeTruthy();
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.megacredits, {timeout: 40_000,
      message: 'the server: 30 − 14 + 4 (the Greens) + 4 (P64)'}).toBe(24);
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    await stop();
    await shoot(page, 'B-after');

    const forecast = [...new Set((await readTransient<string>(page, 'fc-b')).map((s) => s.v).filter((v) => v !== ''))];
    const poses = await readTransient<ReactionPose>(page, 'p64-b');
    const ticks = mcTicks(poses);
    const witness = await transferWitness(page);
    const trail = transferTrail(witness);
    writeText('B-poses.txt', [`forecast: ${forecast.join(' / ')}`, `ticks: ${ticks.join(' → ')}`,
      ...poses.map((s) => `${Math.round(s.t)} ${JSON.stringify(s.v)}`)].join('\n'));
    writeText('B-trail.txt', trail);
    writeText('B-console.txt', logs.join(String.fromCharCode(10)));
    // Two answers of ONE raise: the party's +4 and the card's +4 — two chips before the press.
    // «Сработает» states the M€ row once — the sum of both answers (the party's +4 and the card's +4).
    expect(forecast.some((v) => /\+8(?!\d)/.test(v)), `«Сработает» states both answers before the press (${forecast.join(' / ')})`).toBe(true);
    expect(ticks[0], `the M€ row starts at 30 (${ticks.join(' → ')})`).toBe(30);
    expect(ticks[ticks.length - 1], `the M€ row ends on the server (${ticks.join(' → ')})`).toBe(24);
    expect(ticks.includes(16), `the price lands alone first: 30 → 16 (${ticks.join(' → ')})`).toBe(true);
    expect(ticks.slice(ticks.indexOf(16)).every((v, i, all) => i === 0 || v > all[i - 1]), `then only rises (${ticks.join(' → ')})`).toBe(true);
    const dealBirths = witness.births.filter((b) => b.under.startsWith(`reactor:${CARD}`));
    const greensBirths = witness.births.filter((b) => b.under.startsWith('reactor:Greens'));
    expect(dealBirths.length, `P64's +4 born on its printed effect (trail:\n${trail})`).toBeGreaterThan(0);
    expect(greensBirths.length, `the Greens' +4 born on their charter (trail:\n${trail})`).toBeGreaterThan(0);
    const mcLandings = witness.landings.filter((l) => l.under === 'rail:megacredits' && [...dealBirths, ...greensBirths].some((b) => b.id === l.id));
    expect(mcLandings.length, `both answers land on the M€ row (trail:\n${trail})`).toBeGreaterThanOrEqual(2);
    expect(poses.some((s) => s.v.atStage > 1), 'never two instances of P64').toBe(false);
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);
    expect(errors, 'no page error').toEqual([]);
  });

  test('(C) the heat conversion: 8 heat → +1 TR → the Greens +2 and P64 +2, each off its own face', async ({page, request}) => {
    test.setTimeout(360_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const id = await bootFixture(page, request, 'terraforming-deal-table', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, id);
    expect(before.thisPlayer.heat, 'the fixture: 8 heat').toBe(8);
    expect(await pressUntil(page, 'Comma', async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 900}), 'the basic-actions wheel opens').toBe(true);
    const confirm = page.locator('.con-confirm[data-motion-surface="confirm"][data-confirm-kind="convertHeat"]');
    expect(await pressUntil(page, 'ArrowRight', async () => await confirm.count() > 0, {tries: 3, settleMs: 1200}), 'the heat conversion\'s confirm stands').toBe(true);
    await settle(page);
    await shoot(page, 'C-01-confirm');
    await armTransferWitness(page);
    await recordReaction(page, 'p64-c');
    const stop = await storyboard(page, 'heat');
    expect(await pressUntil(page, 'Enter', async () => (await wireOf(request, id)).thisPlayer.heat === 0, {tries: 3, settleMs: 1500}), 'A converts the heat').toBe(true);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.megacredits, {timeout: 40_000,
      message: 'the server: 30 + 2 (the Greens) + 2 (P64)'}).toBe(34);
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    await waitForBoardHome(page, 40);
    await stop();
    await shoot(page, 'C-02-after');
    const witness = await transferWitness(page);
    const trail = transferTrail(witness);
    const poses = await readTransient<ReactionPose>(page, 'p64-c');
    writeText('C-trail.txt', trail);
    writeText('C-poses.txt', `ticks: ${mcTicks(poses).join(' → ')}\n${poses.map((s) => `${Math.round(s.t)} ${JSON.stringify(s.v)}`).join('\n')}`);
    const dealBirths = witness.births.filter((b) => b.under.startsWith(`reactor:${CARD}`));
    expect(dealBirths.length, `P64's +2 born on its printed effect (trail:\n${trail})`).toBeGreaterThan(0);
    expect(witness.landings.filter((l) => dealBirths.some((b) => b.id === l.id)).every((l) => l.under.startsWith('rail:megacredits')),
      `…and landed on the M€ row (trail:\n${trail})`).toBe(true);
    expect((await wireOf(request, id)).thisPlayer.terraformRating, 'the server: +1 TR').toBe(before.thisPlayer.terraformRating + 1);
    expect(poses.some((s) => s.v.atStage > 1), 'never two instances of P64').toBe(false);
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);
    expect(errors, 'no page error').toEqual([]);
  });

  test('(D) the sitting: the winner\'s +2 TR pays P64 +4 in the PARLIAMENT phase — the rail agrees with the server, one instance at most (the told answer is a named gap — PL-1799)', async ({page, request}) => {
    test.setTimeout(480_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const logs = collectConsole(page);
    const {playerId, seats} = await bootFixtureSeats(page, request, 'terraforming-deal-sitting', {query: PRESET.query});
    const red = seats.find((s) => s !== playerId)!;
    const logBefore = await dealLogLines(request, playerId);
    await armTransferWitness(page);
    await recordReaction(page, 'p64-d');
    const stop = await storyboard(page, 'sitting');
    await recordRailTrail(page, 'rail-D');
    await enterSittingByPass(page, request, playerId);
    await shoot(page, 'D-01-sitting');
    await closeSitting(page, request, playerId).catch(() => undefined);
    await closeSittingAs(request, red).catch(() => undefined);
    await expect.poll(async () => await dealLogLines(request, playerId), {timeout: 90_000,
      message: 'the journal names P64\'s answer on the sitting'}).toBeGreaterThan(logBefore);
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    await stop();
    await shoot(page, 'D-02-after');
    const witness = await transferWitness(page);
    const trail = transferTrail(witness);
    const poses = await readTransient<ReactionPose>(page, 'p64-d');
    writeText('D-trail.txt', trail);
    writeText('D-console.txt', logs.join(String.fromCharCode(10)));
    writeText('D-rail-trail.txt', await readRailTrail(page, 'rail-D'));
    writeText('D-poses.txt', `ticks: ${mcTicks(poses).join(' → ')}\n${poses.map((s) => `${Math.round(s.t)} ${JSON.stringify(s.v)}`).join('\n')}`);
    // THE GAP (PL-1799): the card's record on the sitting is a STANDALONE chain that waits for the sitting's beats, and the
    // presses that answer the sitting's own gates hurry, then CUT it before it ever rose (`reaction:cut press:again` in
    // phase `waiting`) — the +4 ticks without its story. Pinned here: the server's payout, the rail agreeing with it, and
    // never a second instance; the told answer is the next polish's (the doc names it).
    const dealBirths = witness.births.filter((b) => b.under.startsWith(`reactor:${CARD}`));
    writeText('D-told.txt', `births on the reactor: ${dealBirths.length}`);
    const wire = await wireOf(request, playerId);
    await expect.poll(async () => Number(((await page.locator(MC).first().textContent()) ?? '').replace(/\s+/g, '').match(/^-?\d+/)?.[0] ?? NaN),
      {timeout: 20_000, message: 'the M€ row reads the server after the sitting'}).toBe(wire.thisPlayer.megacredits);
    expect(poses.some((s) => s.v.atStage > 1), 'never two instances of P64').toBe(false);
    // (The ruling Greens' +4 leaves the ruler's plaque, which the witness classifies as `glass:con-parl` — no anchor for
    // the plaque in the witness; the party's wave, not this card's — kept in D-trail.txt.)
    expect(errors, 'no page error').toEqual([]);
  });

  test('(E) WG Project → P64 mid-game: a prelude with no immediate effect lands on the table and nothing hangs', async ({page, request}) => {
    test.setTimeout(360_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const id = await bootFixture(page, request, 'terraforming-deal-wg', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const pick = '.con-hand__outcome .con-deckpick--play';
    expect(await playCardFromHand(page, 'WG Project'), 'WG Project was played').toBeTruthy();
    await expect(page.locator(`${pick}[data-flow="choosing"]`), 'the prelude pick stands in the hand').toHaveCount(1, {timeout: 40_000});
    await shoot(page, 'E-01-pick');
    const focusedPick = () => page.evaluate(() => document.querySelector('.con-deckpick .con-cards__slot--focused')?.getAttribute('data-deckpick-slot') ?? '');
    expect(await walkFocusUntil(page, async () => await focusedPick() === CARD, focusedPick, 12), 'P64 focused in the pick').toBe(true);
    expect(await page.locator(`${pick} [data-deckpick-slot="${CARD}"] [data-prelude-burns]`).count(), 'a prelude with no immediate effect does not burn').toBe(0);
    expect(await pressUntil(page, 'Enter', async () => await page.locator(`${pick} [data-deckpick-slot="${CARD}"].con-cards__slot--picked`).count() > 0,
      {tries: 3, settleMs: 600}), 'P64 is chosen').toBe(true);
    expect(await pressUntil(page, 'Period', async () => (await wireOf(request, id)).thisPlayer.tableau.some((c) => c.name === CARD),
      {tries: 3, settleMs: 2500}), 'RT plays P64 — on the table').toBe(true);
    await expect(page.locator(pick), 'the pick leaves once its story is told').toHaveCount(0, {timeout: 40_000});
    await settle(page, {timeoutMs: 40_000});
    await waitForBoardHome(page, 40);
    await shoot(page, 'E-02-after');
    expect(await page.locator('.con-ws').count(), 'no workspace left standing').toBe(0);
    expect(errors, 'no page error').toEqual([]);
  });
});
