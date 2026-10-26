/*
 * TR81 LOTUS INNOVATIONS — the fourth new corporation of Turmoil Redux (`docs/TURMOIL_REDUX_LOTUS_INNOVATIONS.md`):
 * «+2 TR as the first action; after each time you increase your TR by 1, including from this, add 1 data here; 1 VP per
 * 4 data». On the TV profile:
 *
 *  A · THE FIRST ACTION (a real start flow, Lotus forced): the stage «ПЕРВОЕ ДЕЙСТВИЕ» draws the result «+2 TR» and the
 *      table's answer — «Сработает» with the corporation's own data; R3 opens the «Эффекты» layer inside the stage
 *      («… › ПЕРВОЕ ДЕЙСТВИЕ · ЭФФЕКТЫ»), B folds it; A → ONE answer → the rating flies off the seated face's two printed
 *      TR plates into the score cell, the corporation RISES IN ITS SEAT, two data tokens are born on its printed effect
 *      row and land in its OWN capsule (0 → 1 → 2 on the touchdowns), it settles, the stage leaves; the server: +2 TR,
 *      2 data.
 *  B · A CARD WITH A PRINTED TR (the `lotus-innovations` fixture, blue on Lotus with 1 data): the composer's «Сработает»
 *      names the data, A → the landing → Lotus comes out of the receiving stage's corporation zone, its tokens born on
 *      its effect row land in its capsule; the server: +2 TR, +2 data.
 *  C · A STANDARD PROJECT (the asteroid): the board form — the corporation surfaces at a seat beside the rail, its token
 *      born on its effect row lands on the satellite; the rating cell and the capsule count; 4 data → «1 ПО» on the face.
 *
 * TIMING class (`timingSpecs.ts`): the births and the rise are sampled motion — `--exclusive --workers=1` on the box.
 * The rule (every road of the rating, the veto, the forecast's rating pass) is pinned server-side.
 */
import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, bootIntoGame, crumbText, fetchPlayerModel, focusCard, press, pressUntil, settle, soloGameConfig, waitForBoardHome,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

const OUT = path.resolve('screenshots', 'lotus');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const LOTUS = 'Lotus Innovations';
const TR_CARD = 'Release of Inert Gases';

type Wire = {
  thisPlayer: {color: string, terraformRating: number, megacredits: number, tableau: Array<{name: string, resources?: number}>},
  waitingFor?: {type: string},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;
const lotusData = (w: Wire): number => w.thisPlayer.tableau.find((c) => c.name === LOTUS)?.resources ?? 0;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, PRESET.id), {recursive: true});
  await page.screenshot({path: path.join(OUT, PRESET.id, `${name}.png`)});
}

function writeTrail(scene: string, trail: string): void {
  fs.mkdirSync('test-results', {recursive: true});
  fs.writeFileSync(`test-results/lotus-${scene}-${PRESET.id}.txt`, trail);
}

/** The seat's lift and its capsule's count, sampled on a task clock (never rAF) — the witness of «out of its place». */
async function armSeatProbe(page: Page): Promise<void> {
  await page.evaluate((card) => {
    const w = window as unknown as {__seat: Array<{t: number, lift: number, count: string}>};
    w.__seat = [];
    const t0 = performance.now();
    let last = '';
    const sample = () => {
      const seat = document.querySelector<HTMLElement>(`.con-start__embedsource [data-start-seat-card="${card}"]`);
      const m = seat === null ? null : /matrix\(([^)]+)\)/.exec(getComputedStyle(seat).transform);
      const lift = m === null ? 0 : Number(m[1].split(',')[5]);
      const count = seat?.querySelector('.pcard__res-count')?.textContent?.trim() ?? '';
      const now = `${lift.toFixed(1)}/${count}`;
      if (now !== last) {
        last = now;
        w.__seat.push({t: performance.now() - t0, lift, count});
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
    window.setInterval(sample, 16);
  }, LOTUS);
}

/** The reaction scene's faces, sampled on a task clock (never rAF): the corporation out of its place or at a seat. */
async function armReactionProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__reaction: Array<{t: number, emerged: string, seated: string}>};
    w.__reaction = [];
    let last = '';
    window.setInterval(() => {
      const emerged = Array.from(document.querySelectorAll('.con-recv__emerge[data-played-key]')).map((e) => e.getAttribute('data-played-key')).join('|');
      const seated = Array.from(document.querySelectorAll('.con-reaction__face[data-reaction-card]')).map((e) => e.getAttribute('data-reaction-card')).join('|');
      const now = `${emerged}/${seated}`;
      if (now !== last) {
        last = now;
        w.__reaction.push({t: performance.now(), emerged, seated});
      }
    }, 16);
  });
}

async function reactionProbe(page: Page): Promise<Array<{t: number, emerged: string, seated: string}>> {
  return page.evaluate(() => (window as unknown as {__reaction?: Array<{t: number, emerged: string, seated: string}>}).__reaction ?? []);
}

async function seatProbe(page: Page): Promise<Array<{t: number, lift: number, count: string}>> {
  return page.evaluate(() => (window as unknown as {__seat?: Array<{t: number, lift: number, count: string}>}).__seat ?? []);
}

test.describe(`console · TR81 Lotus Innovations · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('A — the first action: «Сработает» + R3 on the stage; the rating off the printed plates, the corporation answers OUT OF ITS SEAT into its own capsule', async ({page, request}) => {
    test.setTimeout(300_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const playerId = await bootIntoGame(page, request, {
      config: soloGameConfig({
        expansions: {colonies: true, turmoilRedux: true},
        startingCorporations: 1,
        customCorporationsList: [LOTUS],
        seed: 0.42,
      }),
      corporation: LOTUS,
      buy: 0,
      until: 'startRelease',
      query: PRESET.query,
    });
    const stage = page.locator('.con-start__firstact');
    await stage.waitFor({state: 'visible', timeout: 60_000});
    await settle(page, {timeoutMs: 20_000});
    const before = await wireOf(request, playerId);
    expect(lotusData(before), 'nothing on the corporation before its first action').toBe(0);

    // THE STAGE: the result «+2 TR» and the table's answer — the corporation's own data.
    await expect(stage.locator('.con-start__firstact-chips .action-effect-chip'), 'the result chip').not.toHaveCount(0);
    const answer = stage.locator('[data-start-firstact-forecast] [data-forecast-row]');
    await expect(answer, '«Сработает» stands under the result').toHaveCount(1);
    await expect(answer.locator('[data-forecast-chip="own"]'), 'its chip is the viewer\'s own gain').not.toHaveCount(0);
    await expect(page.locator('.con-cmdbar'), 'the bar offers R3 «Эффекты»').toContainText(/Эффекты/i);
    await shoot(page, 'A-01-stage');

    // R3 → the «Эффекты» layer, a level INSIDE the stage; B folds it back.
    expect(await pressUntil(page, 'KeyV', async () => await page.locator('.con-start [data-forecast-layer]').count() > 0, {tries: 3, settleMs: 1100}),
      'R3 opens the «Эффекты» layer').toBeTruthy();
    expect((await crumbText(page)).toUpperCase(), 'the crumb gains its tail').toMatch(/ПЕРВОЕ ДЕЙСТВИЕ.*ЭФФЕКТЫ/);
    // The layer lists the table's answer in the live funnel's order — the Greens first, then the corporation.
    await expect(page.locator('.con-start [data-forecast-layer]'), 'the layer names Lotus\' own answer').toContainText(LOTUS);
    await shoot(page, 'A-02-layer');
    expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-start [data-forecast-layer]').count() === 0, {tries: 3, settleMs: 900}),
      'B folds the layer').toBeTruthy();
    await expect(stage, 'the stage stands after the fold').toBeVisible();

    // A → ONE answer; the rail half flies, the corporation answers from its seat.
    await armTransferWitness(page);
    await armSeatProbe(page);
    await page.keyboard.press('Enter');
    await expect.poll(async () => lotusData(await wireOf(request, playerId)), {timeout: 30_000, message: 'the server: 2 data on Lotus'}).toBe(2);
    await expect.poll(() => seatProbe(page).then((s) => s.some((x) => x.lift < -2)), {timeout: 20_000, message: 'the corporation rose in its seat'}).toBe(true);
    await shoot(page, 'A-03-rises');
    // The briefing panel goes with the press; the CHAIN's end is the seat letting go — the corporation settles home into
    // «Разыграно» only once every token of the rail half and of its own answer has landed (`firstActionChainQuiet`).
    await expect(stage, 'the briefing leaves with the press').toHaveCount(0, {timeout: 40_000});
    await expect(page.locator('.con-start__embedsource'), 'the seat lets go once the chain is quiet').toHaveCount(0, {timeout: 40_000});
    const after = await wireOf(request, playerId);
    expect(after.thisPlayer.terraformRating, 'the server: +2 TR').toBe(before.thisPlayer.terraformRating + 2);

    const witness = await transferWitness(page);
    writeTrail('a', transferTrail(witness));
    expect(endsOverGlass(witness), `every end visible\n${transferTrail(witness)}`).toEqual([]);
    const rating = witness.landings.filter((l) => l.under === 'rail:tr');
    expect(rating.length, `two rating tokens landed on the score cell\n${transferTrail(witness)}`).toBe(2);
    const dataBirths = witness.births.filter((b) => b.under === `reactor:${LOTUS}:data`);
    expect(dataBirths.length, `two data tokens were born on Lotus' printed data\n${transferTrail(witness)}`).toBe(2);
    const dataLandings = witness.landings.filter((l) => dataBirths.some((b) => b.id === l.id));
    expect(dataLandings.length, `…both landed\n${transferTrail(witness)}`).toBe(2);
    expect(dataLandings.every((l) => l.under === `start-seat:${LOTUS}`), `…in its own capsule\n${transferTrail(witness)}`).toBe(true);
    const seat = await seatProbe(page);
    const counts = seat.map((s) => s.count).filter((c) => c !== '');
    expect(counts.indexOf('1'), `the capsule ticked 0 → 1 → 2 on the touchdowns (${counts.join(' ')})`).toBeGreaterThan(-1);
    expect(counts.indexOf('2'), `…in order (${counts.join(' ')})`).toBeGreaterThan(counts.indexOf('1'));
    const firstLift = seat.find((s) => s.lift < -2)?.t ?? Infinity;
    expect(firstLift, 'the corporation rose before its first data touched down').toBeLessThan(seat.find((s) => s.count === '1')?.t ?? -1);
    expect(errors, 'no page errors').toEqual([]);
  });

  test('B · C — a printed TR wakes Lotus out of the receiving stage; the asteroid project at a seat; 4 data → 1 VP', async ({page, request}) => {
    test.setTimeout(420_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const playerId = await bootFixture(page, request, 'lotus-innovations', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const start = await wireOf(request, playerId);
    expect(lotusData(start), 'the fixture: 1 data on Lotus').toBe(1);

    // ── B · the card with a printed TR.
    for (let i = 0; i < 5 && await page.locator('.con-hand').count() === 0; i++) {
      await press(page, 'Period', 600);
      await press(page, 'Enter', 1400);
    }
    await page.locator(`.con-hand [data-zoom-slot="${TR_CARD}"]`).waitFor({timeout: 20_000});
    expect(await focusCard(page, TR_CARD, 24), `never focused «${TR_CARD}»`).toBeTruthy();
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-composer--play').count() > 0, {tries: 3, settleMs: 1200}),
      'A opens the play composer').toBeTruthy();
    await settle(page);
    const row = page.locator('.con-composer--play [data-forecast-row]');
    await expect(row, '«Сработает» names the corporation\'s data').toHaveCount(1);
    await shoot(page, 'B-01-composer');
    await armTransferWitness(page);
    await armReactionProbe(page);
    // ONE press — a second A during the landing is the scene's own «hurry» and would skip the very answer under test.
    await page.keyboard.press('Enter');
    await expect.poll(async () => lotusData(await wireOf(request, playerId)), {timeout: 30_000, message: 'the server: +2 data'}).toBe(3);
    await expect.poll(() => reactionProbe(page).then((r) => r.some((x) => x.emerged.includes(LOTUS) || x.seated.includes(LOTUS))),
      {timeout: 30_000, message: 'the corporation rose (out of the receiving stage, or at a seat)'}).toBe(true);
    await shoot(page, 'B-02-rises');
    await settle(page, {timeoutMs: 60_000});
    await waitForBoardHome(page, 40);
    const witnessB = await transferWitness(page);
    writeTrail('b', transferTrail(witnessB));
    expect(endsOverGlass(witnessB), `every end visible\n${transferTrail(witnessB)}`).toEqual([]);
    expect(witnessB.births.filter((b) => b.under === `reactor:${LOTUS}:data`).length,
      `two data tokens born on Lotus' printed data\n${transferTrail(witnessB)}`).toBe(2);
    const afterB = await wireOf(request, playerId);
    expect(afterB.thisPlayer.terraformRating, 'the server: +2 TR').toBe(start.thisPlayer.terraformRating + 2);
    expect(lotusData(afterB), 'the server: +2 data').toBe(3);

    // ── C · the asteroid standard project: the board form, a seat beside the rail.
    // LT — the basic actions' wheel; A on its first slot opens «Стандартные проекты» (the futile-actions spec's road).
    expect(await pressUntil(page, 'Comma', async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 900}),
      'the wheel opens').toBe(true);
    await settle(page);
    await press(page, 'Enter', 1400);
    await page.locator('.con-stdp').waitFor({timeout: 20_000});
    await settle(page);
    const asteroid = page.locator('.con-stdp__card[data-stdp-card="Asteroid:SP"]');
    const moves = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowDown'];
    for (let i = 0; i < 16 && !((await asteroid.getAttribute('class')) ?? '').includes('con-stdp__card--focused'); i++) {
      await press(page, moves[i % moves.length], 300);
    }
    expect((await asteroid.getAttribute('class')) ?? '', 'the asteroid row is focused').toContain('con-stdp__card--focused');
    await armTransferWitness(page);
    await armReactionProbe(page);
    await page.keyboard.press('Enter');
    await expect.poll(() => reactionProbe(page).then((r) => r.some((x) => x.seated.includes(LOTUS))),
      {timeout: 40_000, message: 'the corporation surfaced at a seat beside the rail'}).toBe(true);
    await shoot(page, 'C-01-seat');
    await settle(page, {timeoutMs: 60_000});
    await waitForBoardHome(page, 40);
    const witnessC = await transferWitness(page);
    writeTrail('c', transferTrail(witnessC));
    expect(endsOverGlass(witnessC), `every end visible\n${transferTrail(witnessC)}`).toEqual([]);
    const dataC = witnessC.births.filter((b) => b.under === `reactor:${LOTUS}:data`);
    expect(dataC.length, `the data token was born on Lotus' printed data\n${transferTrail(witnessC)}`).toBe(1);
    // THE ANSWER AFTER ITS CAUSE: the step's own TR leaves the marker once it has arrived (the scale-step rating beat) —
    // the corporation answering that rating may not pay before it has touched down.
    const ratingC = witnessC.landings.find((l) => l.under === 'rail:tr');
    expect(ratingC, `the step's rating landed on the score cell\n${transferTrail(witnessC)}`).toBeDefined();
    expect(dataC[0].t, `Lotus answers after the rating's touchdown\n${transferTrail(witnessC)}`).toBeGreaterThan(ratingC?.touched ?? ratingC?.t ?? Infinity);
    const afterC = await wireOf(request, playerId);
    expect(lotusData(afterC), 'the server: 4 data').toBe(4);
    await shoot(page, 'C-02-four-data');
    expect(errors, 'no page errors').toEqual([]);
  });
});
