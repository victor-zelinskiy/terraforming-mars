import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixtureSeats, closeZoomViewer, fetchPlayerModel, openMandatoryAnnounce, openZoomViewer, placeTile, placementState, press, pressUntil, settle,
} from './consoleStart';
import {answerGateAs, armLeakWitness, mandatoryPlate, parliament, parliamentWire, sittingStage, strandedReports, turnTo, waitSittingAtRest} from './parliamentDrive';

/**
 * MOHOLE CONTEST (Turmoil Redux, RX23) — the ONE e2e of the new mechanic: a
 * winner part that is a DIRECT STEP of a global parameter, REWARDED (the
 * opposite of Gas Export's world move), with the engine's 0 °C ocean placed as
 * the winner's OWN step INSIDE the sitting's flow. One journey, one profile:
 *
 *   · the INSPECTION reads the winner's part honestly BEFORE the vote is
 *     decided: temperature −4 → 0 °C, TR +2, «an ocean follows at 0 °C»;
 *   · the seat is paid its HEAT (influence 2 → +6) — the wave to the rail;
 *   · the sitting STEPS ASIDE for the planet: the temperature readout travels
 *     −4 → 0 while the board has the screen, and — unlike Heat Capture — a TR
 *     chip flies for the winner (the step is theirs);
 *   · the ocean of 0 °C stands on the board WITHOUT the sitting coming back
 *     in between (one trip: the marker's glide and the placement share it),
 *     the placement is made through the standard two-press flow, and only
 *     then the sitting returns, at the same depth;
 *   · the RESULTS carry the winner's step on the WINNER's row — the
 *     parameter, −4 → 0, «РТ +2» — and no planet line (nobody's move).
 *
 * Fixture `parliament-mohole-assembly` (temperature −4 °C, no ocean placed,
 * blue's delegate on the card). Screens under screenshots/parliament-mohole/.
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-mohole');
const PRESET = {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'} as const;
const MOHOLE_ID = 'RDX_GREENS_MOHOLE_CONTEST';

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_ROOT, {recursive: true});
  await page.screenshot({path: path.join(OUT_ROOT, `${name}.png`)});
}

type Outcome = {player?: string, step: string, part?: string, kind: string, amount?: number, unrewarded?: boolean, tr?: number, influence?: number,
  parameter?: {id: string, before: number, after: number}};
type Wire = {
  thisPlayer: {color: string, heat: number, terraformRating: number, megacredits: number},
  game: {temperature: number, oceans: number, generation: number,
    parliament?: {enacted?: {resolution: string}, phase?: {step?: string, pending?: {player: string, key: string, input?: string}, outcomes?: Array<Outcome>}, lastPhase?: {outcomes?: Array<Outcome>}}},
  waitingFor?: {type?: string, placementContext?: {source?: {kind: string, name?: string}}},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

/**
 * THE PROBE. A `setInterval` sampler (never rAF — a quiet screen stops the compositor exactly when this
 * beat plays) reading, every tick: whether the sitting's frame is on screen, what the temperature readout
 * SAYS, whether a TR delta chip exists, whether a payout chip is in flight, and whether the board is in
 * placement mode.
 */
type Sample = {t: number, parl: boolean, temperature: string, trChips: number, transferChips: number, placing: boolean, sit: string, yielded: boolean, holds: string};
type Probe = {samples: Array<Sample>};
type Ready = {holds: Array<string>, wsYielded: boolean, parliamentReward: {owed: Array<string>, flying: Array<string>, landed: Array<string>, trail: Array<unknown>}};

async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__moholeProbe?: Probe};
    const probe: Probe = {samples: []};
    w.__moholeProbe = probe;
    const text = (icon: string): string => {
      const host = Array.from(document.querySelectorAll('.con-status__param'))
        .find((el) => el.querySelector(`.wgt-icon--${icon}`) !== null);
      return (host?.querySelector('.con-status__value')?.textContent ?? '').trim();
    };
    const take = (): void => {
      const ready = (window as unknown as {__conReady?: () => Ready}).__conReady?.();
      const sit = document.querySelector('.con-sit');
      probe.samples.push({
        t: Math.round(performance.now()),
        parl: document.querySelector('.con-parl') !== null,
        temperature: text('temperature'),
        trChips: document.querySelectorAll('[data-metric-key="score.tr"] .delta-chip').length,
        transferChips: document.querySelectorAll('.con-transfer__chip').length,
        placing: document.querySelector('.con-board--placing, .con-board--locked') !== null,
        sit: sit === null ? '' : `${sit.getAttribute('data-sit-stage')}/${sit.getAttribute('data-sit-step')}`,
        yielded: ready?.wsYielded === true,
        holds: (ready?.holds ?? []).join(','),
      });
      if (probe.samples.length > 6000) {
        probe.samples.splice(0, 3000);
      }
    };
    take();
    setInterval(take, 40);
  });
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__moholeProbe: Probe}).__moholeProbe);

test.describe(`Mohole Contest · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('the winner raises the temperature to 0 °C and is REWARDED: the heat lands, the marker glides with the TR chip, the ocean is placed inside the sitting, the results name the step', async ({page, request}) => {
    test.setTimeout(900_000);

    const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-mohole-assembly', {query: PRESET.query, landing: 'prompt'});
    const red = seats[1];
    await armLeakWitness(page);
    await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
    expect(await openMandatoryAnnounce(page)).toBe(true);
    await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
    await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
    await waitSittingAtRest(page, 30_000);

    const before = await wireOf(request, playerId);
    expect(before.game.temperature, 'the fixture stands at −4 °C').toBe(-4);
    expect(before.game.oceans, 'no ocean yet').toBe(0);
    await shoot(page, '01-verdict');

    // ── ⓪ THE INSPECTION reads the winner's part HONESTLY, before anything has changed: at the verdict the
    //      winner of record is FIXED (the recipient — «you raise it»), the step, its TR and what the track pays
    //      on the way are read over the table AS IT STANDS — from the same room the server will pay by.
    await openZoomViewer(page);
    const zoom = page.locator('dialog.con-zoom[open]');
    const rules = zoom.locator('.con-zoom-sidecol');
    await expect(rules).toContainText(/Победителю голосования|For the winner of the vote/);
    await expect(rules).toContainText(/Повысьте температуру на 2|Raise the temperature 2 steps/);
    await expect(rules).toContainText(/Повышаете вы: температура -4 → 0 °C; РТ \+2; на 0 °C следует океан|You raise it: temperature -4 → 0 °C; TR \+2; an ocean follows at 0 °C/);
    const winner = zoom.locator('[data-zoom-winner]');
    await expect(winner, 'the winner block stands in the footer').toHaveCount(1);
    await expect(winner).toHaveAttribute('data-winner-context', 'pending');
    await expect(winner).toHaveAttribute('data-winner-recipient', before.thisPlayer.color);
    await expect(winner).toHaveAttribute('data-winner-tile', 'temperature');
    await expect(winner).toHaveAttribute('data-winner-before', '-4');
    await expect(winner).toHaveAttribute('data-winner-after', '0');
    await expect(winner).toHaveAttribute('data-winner-tr', '2');
    await shoot(page, '01b-inspect-winner');
    await closeZoomViewer(page);
    await settle(page, {timeoutMs: 15_000});

    await armProbe(page);

    // ── GATE 1: A on the verdict; red answers over the API. Everything after this turns by itself.
    expect(await pressUntil(page, 'Enter', async () => (await parliamentWire(request, playerId)).waitingFor?.parliamentPhasePrompt === undefined,
      {tries: 4, settleMs: 1500}), 'A answers the assembly gate').toBe(true);
    await answerGateAs(request, red, 'assembly');

    // ── ① THE SEAT IS PAID ITS HEAT FIRST: 3 per influence, influence 2 → +6 — recorded, and the wave to the rail.
    await expect.poll(async () => {
      const outcomes = (await wireOf(request, playerId)).game.parliament?.phase?.outcomes ?? [];
      return outcomes.find((o) => o.step === 'heat' && o.player === before.thisPlayer.color)?.amount;
    }, {timeout: 60_000, message: 'the seat\'s own 6 heat is recorded'}).toBe(6);
    // The wave is a witness in its own right; on a miss the TIMELINE and the ledger's own trail are the evidence.
    try {
      await expect.poll(async () => (await readProbe(page)).samples.some((s) => s.transferChips > 0), {timeout: 60_000,
        message: 'the heat chip flies to the rail'}).toBe(true);
    } catch (e) {
      const samples = (await readProbe(page)).samples;
      const changes = samples.filter((s, i) => i === 0 || ['parl', 'temperature', 'trChips', 'transferChips', 'placing', 'sit', 'yielded', 'holds']
        .some((k) => (s as unknown as Record<string, unknown>)[k] !== (samples[i - 1] as unknown as Record<string, unknown>)[k]));
      const ready = await page.evaluate(() => (window as unknown as {__conReady?: () => Ready}).__conReady?.());
      const timeline = changes.map((s) => JSON.stringify(s)).join(' | ');
      throw new Error(`${(e as Error).message} TIMELINE: ${timeline} LEDGER: ${JSON.stringify(ready?.parliamentReward)}`);
    }

    // ── ② THE WINNER'S STEP is recorded as the WINNER's, rewarded: 2 steps, −4 → 0, TR 2 — never `unrewarded`.
    await expect.poll(async () => {
      const outcomes = (await wireOf(request, playerId)).game.parliament?.phase?.outcomes ?? [];
      return outcomes.find((o) => o.step === 'temperature' && o.player === before.thisPlayer.color)?.tr;
    }, {timeout: 60_000, message: 'the winner\'s step is recorded with its TR'}).toBe(2);
    const stepped = await wireOf(request, playerId);
    const step = stepped.game.parliament?.phase?.outcomes?.find((o) => o.step === 'temperature');
    expect(step).toMatchObject({part: 'winner', kind: 'globalParameter', amount: 2, parameter: {id: 'temperature', before: -4, after: 0}, tr: 2});
    expect(step?.unrewarded, 'the winner is credited — this is not a world move').toBeUndefined();
    expect(stepped.game.temperature).toBe(0);
    // …and the engine's own ocean is asked of the winner: the server names it as the step's own tail.
    expect(stepped.waitingFor?.type, 'the 0 °C ocean is asked').toBe('space');
    expect(stepped.waitingFor?.placementContext?.source).toMatchObject({kind: 'system', name: 'Temperature bonus step'});
    expect(stepped.game.parliament?.phase?.pending).toEqual({player: before.thisPlayer.color, key: 'temperature', input: 'space'});

    // ── ③ THE SITTING STEPS ASIDE and the TEMPERATURE MARKER TRAVELS while it is away — with a TR CHIP this time.
    await expect.poll(async () => (await readProbe(page)).samples.some((s) => !s.parl), {timeout: 60_000,
      message: 'the sitting left the screen for the board — the planet\'s own beat, no press'}).toBe(true);
    await expect.poll(async () => (await readProbe(page)).samples.some((s) => !s.parl && /(^|[^\d-])0\s*°?/.test(s.temperature) && !s.temperature.includes('-4')), {timeout: 60_000,
      message: 'the temperature readout shows 0 °C while the board has the screen'}).toBe(true);
    await expect.poll(async () => (await readProbe(page)).samples.some((s) => s.trChips > 0), {timeout: 60_000,
      message: 'a terraform-rating chip flies for the WINNER (the step is theirs — unlike a world move)'}).toBe(true);
    await shoot(page, '02-board-world-beat');

    // ── ④ THE OCEAN OF 0 °C stands on the board on the SAME trip: the sitting does not come back in between.
    await expect.poll(async () => await placementState(page), {timeout: 60_000, message: 'the winner\'s ocean placement stands'}).not.toBe('none');
    await expect(parliament(page), 'the sitting is still aside while the ocean is placed').toHaveCount(0);
    await expect(mandatoryPlate(page), 'no plate of its own for a step inside the sitting').toHaveCount(0);
    const walk = (await readProbe(page)).samples;
    const left = walk.findIndex((s) => !s.parl);
    const placing = walk.findIndex((s) => s.placing);
    expect(left, 'the sitting left').toBeGreaterThanOrEqual(0);
    expect(placing, 'the placement began').toBeGreaterThanOrEqual(0);
    expect(walk.slice(left, placing + 1).some((s) => s.parl), 'ONE trip to the board: the frame never came back between the glide and the ocean').toBe(false);
    await settle(page, {timeoutMs: 20_000});
    await shoot(page, '03-ocean-on-board');
    expect(await placeTile(page), 'the ocean is placed through the standard two-press flow').toBe(true);
    await settle(page, {timeoutMs: 30_000});

    // ── ⑤ THE FRAME COMES BACK at the same depth and reads the receipt; red's heat lands; the walk reaches the results.
    await expect(parliament(page), 'the sitting is back after the ocean').toHaveCount(1, {timeout: 60_000});
    await waitSittingAtRest(page, 60_000);
    await shoot(page, '04-back-from-the-board');
    await expect.poll(async () => (await wireOf(request, red)).thisPlayer.heat, {timeout: 60_000, message: 'red is paid by ITS influence'}).toBeGreaterThanOrEqual(3);
    expect(await turnTo(page, 'results'), 'the results page').toBe(true);
    // The winner's STEP is a part of the WINNER's row — the parameter, the range, the TR — and there is NO planet line.
    const mine = page.locator(`[data-sit-payout][data-sit-payout-seat="${before.thisPlayer.color}"]`);
    const part = mine.locator('[data-sit-part="globalParameter"]');
    await expect(part, 'the winner\'s row carries the step').toHaveCount(1);
    await expect(part.locator('[data-sit-part-parameter]')).toHaveAttribute('data-sit-part-param', 'temperature');
    await expect(part.locator('[data-sit-part-parameter]')).toHaveAttribute('data-sit-part-steps', '2');
    await expect(part.locator('[data-sit-part-parameter]')).toContainText('-4');
    await expect(part.locator('[data-sit-part-parameter]')).toContainText('0');
    await expect(part.locator('[data-sit-part-tr]')).toHaveText(/РТ \+2|TR \+2/);
    await expect(page.locator('[data-sit-section="planet"]'), 'a rewarded step of the winner is never the planet line').toHaveCount(0);
    await shoot(page, '05-results');
    await press(page, 'Enter', 1200);
    await answerGateAs(request, red, 'adjourn');
    await expect.poll(async () => (await wireOf(request, playerId)).game.generation, {timeout: 60_000}).toBe(2);

    const after = await wireOf(request, playerId);
    expect(after.game.temperature).toBe(0);
    expect(after.game.oceans, 'the ocean of 0 °C is on Mars').toBe(1);
    expect(after.thisPlayer.heat - before.thisPlayer.heat, '3 × influence 2').toBe(6);
    // +2 for the steps, +1 for the ocean, and at most the Agenda step's own bonus on top.
    expect(after.thisPlayer.terraformRating - before.thisPlayer.terraformRating).toBeGreaterThanOrEqual(3);
    expect(after.thisPlayer.terraformRating - before.thisPlayer.terraformRating).toBeLessThanOrEqual(4);
    expect(after.game.parliament?.enacted?.resolution).toBe(MOHOLE_ID);
    const outcomes = after.game.parliament?.lastPhase?.outcomes ?? [];
    expect(outcomes.find((o) => o.step === 'temperature' && o.kind === 'globalParameter')).toMatchObject({player: before.thisPlayer.color, part: 'winner', amount: 2, tr: 2});
    expect(outcomes.find((o) => o.step === 'heat' && o.player !== before.thisPlayer.color)).toMatchObject({kind: 'stock', amount: 3, influence: 1});
    await settle(page, {timeoutMs: 30_000});
    expect(await strandedReports(page), 'nothing stranded').toEqual([]);
  });
});
