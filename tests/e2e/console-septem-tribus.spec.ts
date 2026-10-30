import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, bootIntoGame, cinematicBeat, crumbText, fetchPlayerModel, settle, soloGameConfig} from './consoleStart';
import {closeSitting, enterSittingByPass, openParliament, waitSittingAtRest} from './parliamentDrive';

/**
 * TR77 SEPTEM TRIBUS:REDUX — the cubes on the parties' BANNERS (docs/TURMOIL_REDUX_SEPTEM_TRIBUS.md).
 *
 * A cube on a banner is a GRANT of that party's effect, drawn as the seat's cube in the seal's socket of the party's
 * plaque; it gives the EFFECT, never the requirement (FAQ p.19). Three scenes:
 *   A — THE FIRST ACTION: «ПЕРВОЕ ДЕЙСТВИЕ» → A → the Parliament takes the start's scene in its BANNER mode («ЗНАМЯ»),
 *       the plaque under the cursor wears the GHOST of the cube; A → ONE answer; the cube is CARRIED from the seat into
 *       the socket (a flight, never a pop: nothing stands in the socket before the flight); the server holds the grant.
 *   B — ON THE TABLE: the plaque of the party carries the cube, «ВАШИ ЭФФЕКТЫ» reads «куб на знамени».
 *   C — THE SITTING: the viewer wins a resolution of a party that does not rule — the enactment's «КУБ НА ЗНАМЯ» beat
 *       carries the cube onto the banner of the party that has just come to power (the hold
 *       `parliament-sitting:enact/banner`); the server holds the grant.
 * Order claims are sampled from BEFORE the press (MutationObserver + setInterval, never rAF).
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'septem', 'tv');
const SEPTEM = 'Septem Tribus:redux';

type CubeSample = {t: number, flight: boolean, seated: boolean, holds: string, stage: string, origin?: {x: number, y: number}, card?: {l: number, t: number, r: number, b: number}};

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** Samples, from now on: is a cube in the air, does `party`'s plaque already draw `color`'s cube, the hold names. */
async function armCubeProbe(page: Page, party: string, color: string): Promise<void> {
  await page.evaluate(([p, c]) => {
    const w = window as unknown as {__cubeProbe: {samples: Array<unknown>, t0: number}, __conReady?: () => {holds?: Array<string>}};
    w.__cubeProbe = {samples: [], t0: performance.now()};
    const sample = () => {
      w.__cubeProbe.samples.push({
        t: performance.now() - w.__cubeProbe.t0,
        flight: document.querySelector('[data-banner-cube-flight]') !== null,
        seated: document.querySelector(`.con-pseal[data-party="${p}"] [data-banner-cube="${c}"]`) !== null,
        holds: (w.__conReady?.().holds ?? []).join(' '),
        // THE CORPORATION'S STAGE: its phase, the face's box, and where a cube in the air stands at that instant.
        stage: document.querySelector('[data-banner-stage]')?.getAttribute('data-banner-stage-phase') ?? '',
        ...(() => {
          const face = document.querySelector('[data-banner-stage] .pcard')?.getBoundingClientRect();
          // A flight proxy is born INVISIBLE (law 14) and positioned a tick later: only a painted cube says where it is.
          const el = document.querySelector<HTMLElement>('[data-banner-cube-flight]');
          const painted = el !== null && getComputedStyle(el).visibility !== 'hidden' && Number(getComputedStyle(el).opacity) > 0.05;
          const cube = painted ? el.getBoundingClientRect() : undefined;
          return {
            ...(face === undefined ? {} : {card: {l: face.left, t: face.top, r: face.right, b: face.bottom}}),
            ...(cube === undefined ? {} : {origin: {x: cube.left + cube.width / 2, y: cube.top + cube.height / 2}}),
          };
        })(),
      });
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(sample, 40);
  }, [party, color]);
}

async function readCubeProbe(page: Page): Promise<Array<CubeSample>> {
  return page.evaluate(() => (window as unknown as {__cubeProbe: {samples: Array<CubeSample>}}).__cubeProbe.samples);
}

type WireAccess = {party: string, granted: Array<string>, hasEffect: boolean, satisfiesRequirement: boolean};
type WireView = {thisPlayer: {color: string}, game: {parliament: {players: Array<{color: string, access: Array<WireAccess>}>}}};

async function grantsOf(request: Parameters<typeof fetchPlayerModel>[0], playerId: string): Promise<{color: string, cubes: Array<string>}> {
  const view = await fetchPlayerModel(request, playerId) as unknown as WireView;
  const me = view.game.parliament.players.find((p) => p.color === view.thisPlayer.color);
  return {color: view.thisPlayer.color, cubes: (me?.access ?? []).filter((a) => a.granted.includes(SEPTEM)).map((a) => a.party)};
}

test.describe('Septem Tribus:redux · the cubes on the parties\' banners', () => {
  test.use({viewport: PRESET.viewport});

  test('A — the first action: the Parliament\'s banner mode inside the start, the ghost, ONE answer, the cube CARRIED into the socket', async ({page, request}) => {
    test.setTimeout(300_000);
    const playerId = await bootIntoGame(page, request, {
      config: soloGameConfig({
        expansions: {colonies: true, turmoilRedux: true},
        startingCorporations: 1,
        customCorporationsList: [SEPTEM],
        seed: 0.42,
      }),
      corporation: SEPTEM,
      buy: 0,
      until: 'startRelease',
      query: PRESET.query,
    });

    const stage = page.locator('.con-start__firstact');
    await stage.waitFor({state: 'visible', timeout: 60_000});
    await settle(page, {timeoutMs: 20_000});
    await shoot(page, '01-first-action');

    // A on «ПЕРВОЕ ДЕЙСТВИЕ» → the Parliament in its banner mode, a STEP of the start («… › ЗНАМЯ»).
    await page.keyboard.press('Enter');
    // FIRST the server: the confirm took the option and the banner prompt stands (a cause split from the client's).
    await expect.poll(async () => {
      const wf = (await fetchPlayerModel(request, playerId) as unknown as {waitingFor?: {type: string, bannerPrompt?: unknown}}).waitingFor;
      return wf?.bannerPrompt !== undefined ? 'banner' : (wf?.type ?? 'none');
    }, {timeout: 30_000, message: 'the server raises the banner prompt after the first action'}).toBe('banner');
    const mode = page.locator('[data-parl-banner-mode]');
    try {
      await expect(mode, 'the banner mode opens inside the start flow').toHaveCount(1, {timeout: 40_000});
    } catch (e) {
      const diag = await page.evaluate(() => JSON.stringify((window as unknown as {__conReady?: () => unknown}).__conReady?.() ?? {}));
      console.log('[septem-diag]', diag.slice(0, 3000), '| parl:', await page.locator('.con-parl').count(), '| crumb:', await crumbText(page));
      throw e;
    }
    await settle(page, {timeoutMs: 20_000});
    expect((await crumbText(page)).toUpperCase(), 'the crumb: the start\'s flow, one level deeper').toMatch(/СТАРТ ПАРТИИ.*ЗНАМЯ/);
    await expect(page.locator('[data-banner-cube-ghost]'), 'the plaque under the cursor wears the ghost of the cube').toHaveCount(1);
    await expect(page.locator('[data-parl-banner-faq]'), 'the FAQ line stands in the reading').toHaveCount(1);
    // THE READING DRAWS THE PARTY'S GRAPHIC beside its words (the owner, 2026-10-25): every clause has its formula.
    const clauses = page.locator('[data-parl-banner-reading]:not(.con-parl-xfade-leave-active) [data-banner-clause]');
    expect(await clauses.count(), 'the reading prints the clauses of the party').toBeGreaterThan(0);
    // THE BAR SAYS WHAT THE D-PAD IS FOR, and the band names the mode instead of «ГОЛОСОВАНИЕ».
    await expect(page.locator('.con-cmdbar'), 'the bar offers the party choice on the d-pad').toContainText(/Выбор партии/i);
    // THE D-PAD FOLLOWS THE HALL: ▼ walks the opposition column, ▶ crosses to the dais, ◀ returns to the bench left.
    // The reading CROSSFADES between plaques: the one ARRIVING (never the one leaving) is the plaque under the cursor.
    const readParty = async (): Promise<string | null> =>
      page.locator('[data-parl-banner-reading]:not(.con-parl-xfade-leave-active)').first().getAttribute('data-banner-party');
    const top = await readParty();
    await page.keyboard.press('ArrowDown');
    await expect.poll(readParty, {message: '▼ walks DOWN the opposition column'}).not.toBe(top);
    const second = await readParty();
    // …and a party WITH a printed graphic draws it in the reading (the second bench — the first may be Unity, whose
    // action prints words only).
    await shoot(page, '02b-banner-second');
    expect(await page.locator('[data-parl-banner-reading]:not(.con-parl-xfade-leave-active) [data-banner-clause-graphic] .pcard-mech-group').count(),
      'the reading draws the graphic of the party').toBeGreaterThan(0);
    const benchY = async (p: string | null) => (await page.locator(`.con-parl__opposition .con-pseal[data-party="${p}"]`).first().boundingBox())?.y ?? 0;
    expect(await benchY(second), 'the bench under the cursor stands BELOW the one it left').toBeGreaterThan(await benchY(top));
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => page.locator('.con-parl').getAttribute('data-zone'), {message: '▶ crosses to the ruler on the dais'}).toBe('ruler');
    await page.keyboard.press('ArrowLeft');
    await expect.poll(readParty, {message: '◀ comes back to the bench the cursor left'}).toBe(second);
    await page.keyboard.press('ArrowUp');
    await expect.poll(readParty, {message: '▲ walks back up'}).toBe(top);
    const party = await readParty();
    expect(party, 'the reading names the banner under the cursor').toBeTruthy();
    const before = await grantsOf(request, playerId);
    expect(before.cubes, 'nothing is placed before A').toEqual([]);
    await shoot(page, '02-banner-mode');

    await armCubeProbe(page, party!, before.color);
    await page.keyboard.press('Enter');
    // THE FRAME OF THE SCENE: the corporation stands in the table cell while its cube is in the air.
    // The carry is a TRANSIENT phase: a rAF-polled `waitFor` misses it whole on a starved renderer (CI), the probe's
    // MutationObserver records every attribute flip — ask the probe.
    await expect.poll(() => page.evaluate(() => (window as unknown as {__cubeProbe: {samples: Array<{stage: string}>}}).__cubeProbe.samples.some((s) => s.stage === 'carry')),
      {timeout: 20_000, message: 'the corporation\'s stage reached its carry'}).toBe(true);
    await shoot(page, '02c-corporation-rises');
    // The SEATED pose is transient too — the banner step closes and the board comes home, taking the plaque with it — so
    // a polling locator can miss its whole window on a loaded box (red 1 / 12 on both builds, 2026-10-30). The probe's
    // MutationObserver saw every frame: ask it, and print its trail when it never saw the cube seated.
    await expect.poll(async () => (await readCubeProbe(page)).some((s) => s.seated), {
      timeout: 20_000,
      message: 'the cube was seated in the plaque\'s socket',
    }).toBe(true);
    await shoot(page, '03-cube-seated');
    const samples = await readCubeProbe(page);
    const tFlight = samples.find((s) => s.flight)?.t;
    const tSeated = samples.find((s) => s.seated)?.t;
    test.info().annotations.push({type: 'banner cube', description: `flight ${tFlight?.toFixed(0)} · seated ${tSeated?.toFixed(0)} (ms after the press)`});
    expect(tFlight, 'the cube FLEW (a proxy in the air)').not.toBe(undefined);
    expect(tSeated, 'the cube was seated').not.toBe(undefined);
    expect(tFlight!, 'nothing stands in the socket before the flight').toBeLessThanOrEqual(tSeated!);
    // THE CORPORATION ROSE FIRST, and the cube was BORN ON IT (its printed glyph), never on the bench.
    const firstFlight = samples.find((s) => s.flight && s.origin !== undefined);
    const tStage = samples.find((s) => s.stage !== '')?.t;
    expect(tStage, 'the corporation stood up in the table cell').not.toBe(undefined);
    expect(tStage!, 'before the cube left it').toBeLessThanOrEqual(tFlight!);
    expect(firstFlight?.card, 'the card stands while the cube leaves').not.toBe(undefined);
    const o = firstFlight!.origin!;
    const c = firstFlight!.card!;
    expect(o.x >= c.l && o.x <= c.r && o.y >= c.t && o.y <= c.b, `the cube is born on the card (${o.x.toFixed(0)},${o.y.toFixed(0)} in ${JSON.stringify(c)})`).toBe(true);

    const after = await grantsOf(request, playerId);
    expect(after.cubes, 'the server holds the grant — one cube, on the chosen banner').toEqual([party]);
    // The flow leaves by itself — the step and its Parliament go, the start goes on.
    await expect(mode, 'the banner mode leaves by itself').toHaveCount(0, {timeout: 30_000});
  });

  test('B — on the table: the plaque carries the cube, «ВАШИ ЭФФЕКТЫ» reads «куб на знамени»', async ({page, request}) => {
    test.setTimeout(180_000);
    const {playerId} = await bootFixtureSeats(page, request, 'septem-tribus', {query: PRESET.query});
    const {color, cubes} = await grantsOf(request, playerId);
    expect(cubes, 'the fixture: the cube stands on the Scientists\' banner').toEqual(['Scientists']);
    await openParliament(page);
    await settle(page, {timeoutMs: 20_000});
    await expect(page.locator(`.con-pseal[data-party="Scientists"] [data-banner-cube="${color}"]`).first(), 'the Scientists\' plaque carries the cube').toHaveCount(1);
    // «ВАШИ ЭФФЕКТЫ» says WHY by a mark — the viewer's cube — and in words for the reader (its aria-label).
    const why = page.locator('.con-parl__effects-row[data-party="Scientists"] [data-parl-effects-why="banner"]').first();
    await expect(why.locator('[data-parl-effects-banner-cube]'), '«ВАШИ ЭФФЕКТЫ» marks the road by the cube').toHaveCount(1);
    expect(await why.getAttribute('aria-label'), 'and names it').toMatch(/куб на знамени/i);
    await shoot(page, '04-table');
  });

  test('C — the sitting: a resolution won → «КУБ НА ЗНАМЯ» carries the cube onto the new ruler\'s banner', async ({page, request}) => {
    test.setTimeout(300_000);
    const {playerId} = await bootFixtureSeats(page, request, 'septem-win', {query: PRESET.query});
    const before = await grantsOf(request, playerId);
    expect(before.cubes, 'the fixture: no cube on any banner yet').toEqual([]);
    await page.evaluate(() => {
      const w = window as unknown as {__bannerBeat: {flight: boolean, hold: boolean}, __conReady?: () => {holds?: Array<string>}};
      w.__bannerBeat = {flight: false, hold: false, stage: false, bornOnCard: false, phases: [] as Array<string>} as never;
      const sample = () => {
        const beat = w.__bannerBeat as unknown as {flight: boolean, stage: boolean, bornOnCard: boolean, phases: Array<string>};
        const phase = document.querySelector('[data-banner-stage]')?.getAttribute('data-banner-stage-phase');
        if (phase !== undefined && phase !== null && beat.phases[beat.phases.length - 1] !== phase) {
          beat.phases.push(phase);
          beat.stage = true;
        }
        // Born INVISIBLE and positioned a tick later (law 14): the birth is the first PAINTED sample.
        const el = document.querySelector<HTMLElement>('[data-banner-cube-flight]');
        const painted = el !== null && getComputedStyle(el).visibility !== 'hidden' && Number(getComputedStyle(el).opacity) > 0.05;
        const cube = painted ? el.getBoundingClientRect() : undefined;
        if (cube !== undefined) {
          if (!beat.flight) {
            const face = document.querySelector('[data-banner-stage] .pcard')?.getBoundingClientRect();
            const x = cube.left + cube.width / 2;
            const y = cube.top + cube.height / 2;
            beat.bornOnCard = face !== undefined && x >= face.left && x <= face.right && y >= face.top && y <= face.bottom;
          }
          beat.flight = true;
        }
        if ((w.__conReady?.().holds ?? []).some((h) => h.includes('parliament-sitting:enact/banner'))) {
          w.__bannerBeat.hold = true;
        }
      };
      new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true});
      window.setInterval(sample, 40);
    });
    await enterSittingByPass(page, request, playerId);
    // A transient phase is read off the probe's MutationObserver, never a rAF-polled `waitFor` (missed on a starved CI renderer).
    await expect.poll(() => page.evaluate(() => (window as unknown as {__bannerBeat: {phases: Array<string>}}).__bannerBeat.phases.includes('carry')),
      {timeout: 90_000, message: 'the sitting\'s banner stage reached its carry'}).toBe(true);
    await shoot(page, '05a-sitting-corporation-rises');
    await expect.poll(async () => (await grantsOf(request, playerId)).cubes.length, {timeout: 60_000, message: 'the server places the cube at the enactment'}).toBe(1);
    const won = (await grantsOf(request, playerId)).cubes[0];
    await expect(page.locator(`.con-pseal[data-party="${won}"] [data-banner-cube="${before.color}"]`).first(),
      'the new ruler\'s banner carries the cube once its beat has landed').toHaveCount(1, {timeout: 60_000});
    await waitSittingAtRest(page, 30_000);
    await shoot(page, '05-sitting-cube');
    const beat = await page.evaluate(() => (window as unknown as {__bannerBeat: {flight: boolean, hold: boolean, stage: boolean, bornOnCard: boolean, phases: Array<string>}}).__bannerBeat);
    test.info().annotations.push({type: 'banner stage', description: beat.phases.join(' → ')});
    expect(beat.stage, 'the corporation stood up in the table cell').toBe(true);
    expect(beat.phases, 'rise → stand → carry → read → sink').toEqual(['rise', 'stand', 'carry', 'read', 'sink']);
    expect(beat.flight, 'the cube FLEW in the sitting').toBe(true);
    expect(beat.bornOnCard, 'the cube was born on the corporation card').toBe(true);
    await expect(page.locator('[data-banner-stage]'), 'the card went back down — the table returns').toHaveCount(0);
    expect(beat.hold, 'under its own hold «parliament-sitting:enact/banner»').toBe(true);
    await closeSitting(page, request, playerId);
  });

  // THE FIELD REPORT OF 2026-10-26 (multiplayer): «карта корпорации появлялась и workspace так и зависал — помогало только
  // B». A pressed during the enactment («дожать») arms the hurry for the rest of the stage; the banner beat then ran its
  // waits under it — one threw, the phrase died with the card standing, and the sitting's run waited for it forever (its
  // ceiling never ran the recovery). Here the player hurries the whole walk: the card must still go, the cube stand on the
  // banner, and the sitting reach its results by itself.
  test('D — «дожать» through the enactment: the stage of the corporation never strands — the card goes, the walk reaches its results', async ({page, request}) => {
    test.setTimeout(300_000);
    const {playerId} = await bootFixtureSeats(page, request, 'septem-win', {query: PRESET.query});
    const before = await grantsOf(request, playerId);
    expect(before.cubes, 'the fixture: no cube on any banner yet').toEqual([]);
    await enterSittingByPass(page, request, playerId);
    await expect.poll(async () => (await grantsOf(request, playerId)).cubes.length, {timeout: 60_000, message: 'the server places the cube at the enactment'}).toBe(1);
    const won = (await grantsOf(request, playerId)).cubes[0];
    const seated = page.locator(`.con-pseal[data-party="${won}"] [data-banner-cube="${before.color}"]`).first();
    // A ONLY while a beat plays (a press at rest would answer the gate): every beat of the walk is hurried.
    let presses = 0;
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline && await seated.count() === 0) {
      const motion = await page.locator('.con-parl').first().getAttribute('data-sitting-motion');
      if (motion !== null && motion !== '') {
        await page.keyboard.press('Enter');
        presses++;
      }
      await cinematicBeat(page, 120, 'the hurry is pressed beat by beat while the walk plays — a press at rest would answer the gate');
    }
    test.info().annotations.push({type: 'hurry presses', description: String(presses)});
    expect(presses, 'the walk was hurried at least once before the cube stood').toBeGreaterThan(0);
    await expect(seated, 'the cube stands on the banner of the new ruler').toHaveCount(1, {timeout: 20_000});
    await expect(page.locator('[data-banner-stage]'), 'the corporation never strands on the table').toHaveCount(0, {timeout: 10_000});
    await waitSittingAtRest(page, 30_000);
    await shoot(page, '06-hurried-sitting');
    await closeSitting(page, request, playerId);
  });
});
