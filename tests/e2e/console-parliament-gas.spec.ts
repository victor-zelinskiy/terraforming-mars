import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, closeZoomViewer, fetchPlayerModel, openMandatoryAnnounce, openZoomViewer, pressUntil, settle} from './consoleStart';
import {answerGateAs, armLeakWitness, mandatoryPlate, parliament, parliamentWire, sittingStage, strandedReports, waitSittingAtRest} from './parliamentDrive';

/**
 * GAS EXPORT (Turmoil Redux, RX12) — the ONE e2e of the new mechanic: an
 * enactment that MOVES THE WORLD, and therefore plays where the world is.
 *
 * The journey, on one profile (the owner's budget — one e2e per new mechanic):
 *   ① the sitting pays the seat first: «+4 M€» for influence 2 lands on the rail;
 *   ② then the SITTING STEPS ASIDE — the frame leaves for the board with no press
 *      (nobody chose this: the law did), and while it is away
 *   ③ the OXYGEN marker travels 5 % → 4 % and the VENUS marker 10 % → 14 %, both
 *      READABLE on screen (the board-beat park held them until exactly this);
 *   ④ NOT ONE TR CHIP flies for the whole tact and the terraforming readout never
 *      celebrates — «no one gets the TR for this» is a thing the player must SEE;
 *   ⑤ the frame COMES BACK at the same depth, and the results carry the PLANET
 *      line: «кислород 5 → 4 %, Венера 10 → 14 %, РТ никому».
 *
 * Fixture: `parliament-gas-assembly` (a Venus table; the card alone in the first
 * voting slot with blue's delegate on it, blue at Agenda step 2 → influence 2,
 * oxygen 5 %, Venus 10 %). Screens under screenshots/parliament-gas/.
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-gas');
const PRESET = {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'} as const;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_ROOT, {recursive: true});
  await page.screenshot({path: path.join(OUT_ROOT, `${name}.png`)});
}

type Outcome = {player?: string, step: string, part?: string, kind: string, amount?: number, unrewarded?: boolean,
  parameter?: {id: string, before: number, after: number}};
type Wire = {
  thisPlayer: {color: string, megacredits: number, terraformRating: number},
  game: {oxygenLevel: number, venusScaleLevel: number,
    parliament?: {phase?: {outcomes?: Array<Outcome>}, lastPhase?: {outcomes?: Array<Outcome>}}},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

/**
 * THE PROBE. A `setInterval` sampler (never rAF — a quiet screen stops the
 * compositor exactly when this beat plays) that reads, every tick: whether the
 * sitting's frame is on screen, what the two scale readouts SAY, whether the
 * terraforming readout is celebrating, and whether any TR delta chip exists.
 */
type Sample = {t: number, parl: boolean, oxygen: string, venus: string, celebrating: boolean, trChips: number};
type Probe = {samples: Array<Sample>};

async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__gasProbe?: Probe};
    const probe: Probe = {samples: []};
    w.__gasProbe = probe;
    const text = (icon: string): string => {
      const host = Array.from(document.querySelectorAll('.con-status__param'))
        .find((el) => el.querySelector(`.wgt-icon--${icon}`) !== null);
      return (host?.querySelector('.con-status__value')?.textContent ?? '').trim();
    };
    const take = (): void => {
      probe.samples.push({
        t: Math.round(performance.now()),
        parl: document.querySelector('.con-parl') !== null,
        oxygen: text('oxygen'),
        venus: text('venus'),
        celebrating: document.querySelector('.con-status__terra--celebrating') !== null,
        trChips: document.querySelectorAll('[data-metric-key="score.tr"] .delta-chip').length,
      });
      if (probe.samples.length > 4000) {
        probe.samples.splice(0, 2000);
      }
    };
    take();
    setInterval(take, 40);
  });
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__gasProbe: Probe}).__gasProbe);

test.describe(`Gas Export · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('the seat is paid, the sitting steps aside, both scales travel with no TR anywhere, and the results name the planet', async ({page, request}) => {
    test.setTimeout(600_000);
    const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-gas-assembly', {query: PRESET.query, landing: 'prompt'});
    const red = seats[1];
    await armLeakWitness(page);
    await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
    expect(await openMandatoryAnnounce(page)).toBe(true);
    await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
    await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
    await waitSittingAtRest(page, 30_000);

    const before = await wireOf(request, playerId);
    expect(before.game.oxygenLevel, 'the fixture stands at oxygen 5 %').toBe(5);
    expect(before.game.venusScaleLevel, '…and Venus 10 %').toBe(10);
    await shoot(page, '01-verdict');

    // ── ⓪ THE INSPECTION SAYS WHAT WILL HAPPEN TO THE WORLD, in the server's own numbers — the one
    // surface that can, before anything moves (the vote panel's own reading is «для вас», and the
    // planet is nobody's).
    await openZoomViewer(page);
    const rules = page.locator('dialog.con-zoom[open] .con-zoom-sidecol');
    await expect(rules).toContainText(/Что делает с планетой|What it does to the planet/);
    await expect(rules).toContainText(/Кислород: 5% → 4%|Oxygen: 5% → 4%/);
    await expect(rules).toContainText(/Венера: 10% → 14%|Venus: 10% → 14%/);
    // …and WHO is credited is said ONCE, by the law's own sentence above the rows — never three times over.
    await expect(rules).toContainText(/РТ за это не получает никто|No one gets the terraform rating for this/);
    await shoot(page, '01b-inspect-world');
    await closeZoomViewer(page);
    await settle(page, {timeoutMs: 15_000});

    await armProbe(page);

    // ── GATE 1: A on the verdict; red answers over the API. Everything after this turns by itself.
    expect(await pressUntil(page, 'Enter', async () => (await parliamentWire(request, playerId)).waitingFor?.parliamentPhasePrompt === undefined,
      {tries: 4, settleMs: 1500}), 'A answers the assembly gate').toBe(true);
    await answerGateAs(request, red, 'assembly');

    // ── ① THE SEAT IS PAID FIRST: 2 M€ per influence, influence 2 → +4, and the record says so.
    await expect.poll(async () => {
      const outcomes = (await wireOf(request, playerId)).game.parliament?.phase?.outcomes ?? [];
      return outcomes.find((o) => o.step === 'megacredits' && o.player === before.thisPlayer.color)?.amount;
    }, {timeout: 60_000, message: 'the seat\'s own 4 M€ is recorded'}).toBe(4);

    // ── ② THE SITTING STEPS ASIDE and ③ BOTH MARKERS TRAVEL while it is away.
    await expect.poll(async () => (await readProbe(page)).samples.some((s) => !s.parl), {timeout: 60_000,
      message: 'the sitting left the screen for the board — «К полю», with no press'}).toBe(true);
    await expect.poll(async () => (await wireOf(request, playerId)).game.venusScaleLevel, {timeout: 60_000,
      message: 'the law terraformed Venus two steps'}).toBe(14);
    await expect.poll(async () => (await readProbe(page)).samples.some((s) => !s.parl && s.oxygen.includes('4')), {timeout: 60_000,
      message: 'the oxygen readout shows 4 % while the board has the screen'}).toBe(true);
    await shoot(page, '02-board-world-beat');
    await expect.poll(async () => (await readProbe(page)).samples.some((s) => !s.parl && s.venus.includes('14')), {timeout: 60_000,
      message: 'the Venus readout shows 14 % while the board has the screen'}).toBe(true);

    // ── ④ NOT ONE TR CHIP, AND NO CELEBRATION, for the whole tact.
    const away = (await readProbe(page)).samples;
    expect(away.filter((s) => s.trChips > 0), 'no terraform-rating chip flies for a law that credits nobody').toEqual([]);
    expect(away.filter((s) => s.celebrating), 'a lowering is never celebrated').toEqual([]);
    // …and the server agrees: nobody's rating moved for the world's two steps.
    const mid = await wireOf(request, playerId);
    expect(mid.game.oxygenLevel, 'oxygen went DOWN one step').toBe(4);
    expect(mid.thisPlayer.terraformRating - before.thisPlayer.terraformRating,
      'the winner gains at most its Agenda step — never the law\'s terraforming').toBeLessThanOrEqual(1);

    // ── ⑤ THE FRAME COMES BACK at the same depth…
    await expect(parliament(page), 'the sitting is back').toHaveCount(1, {timeout: 60_000});
    await waitSittingAtRest(page, 60_000);
    await shoot(page, '03-back-from-the-board');

    // …and the RESULTS carry the planet line. Red answers its own gate so the sitting can reach them.
    await expect.poll(() => sittingStage(page), {timeout: 90_000, message: 'the walk reaches the results'}).toBe('results');
    const planet = page.locator('[data-sit-section="planet"] [data-sit-planet]');
    await expect(planet, 'one line member per world move').toHaveCount(2);
    await expect(planet.nth(0)).toHaveAttribute('data-sit-planet-param', 'oxygen');
    await expect(planet.nth(0)).toHaveAttribute('data-sit-planet-steps', '-1');
    await expect(planet.nth(0)).toContainText('5%');
    await expect(planet.nth(0)).toContainText('4%');
    await expect(planet.nth(1)).toHaveAttribute('data-sit-planet-param', 'venus');
    await expect(planet.nth(1)).toContainText('10%');
    await expect(planet.nth(1)).toContainText('14%');
    await expect(page.locator('[data-sit-planet-notr]'), 'the one fact the scales cannot state').toHaveCount(1);
    await shoot(page, '04-results-planet');

    await settle(page, {timeoutMs: 30_000});
    expect(await strandedReports(page), 'nothing stranded').toEqual([]);
  });
});
