import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, bootIntoGame, crumbText, fetchPlayerModel, settle, soloGameConfig} from './consoleStart';
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

type CubeSample = {t: number, flight: boolean, seated: boolean, holds: string};

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
    const party = await page.locator('[data-parl-banner-reading]').getAttribute('data-banner-party');
    expect(party, 'the reading names the banner under the cursor').toBeTruthy();
    const before = await grantsOf(request, playerId);
    expect(before.cubes, 'nothing is placed before A').toEqual([]);
    await shoot(page, '02-banner-mode');

    await armCubeProbe(page, party!, before.color);
    await page.keyboard.press('Enter');
    await expect(page.locator(`.con-pseal[data-party="${party}"] [data-banner-cube="${before.color}"]`).first(),
      'the cube is seated in the plaque\'s socket').toHaveCount(1, {timeout: 20_000});
    await shoot(page, '03-cube-seated');
    const samples = await readCubeProbe(page);
    const tFlight = samples.find((s) => s.flight)?.t;
    const tSeated = samples.find((s) => s.seated)?.t;
    test.info().annotations.push({type: 'banner cube', description: `flight ${tFlight?.toFixed(0)} · seated ${tSeated?.toFixed(0)} (ms after the press)`});
    expect(tFlight, 'the cube FLEW (a proxy in the air)').not.toBe(undefined);
    expect(tSeated, 'the cube was seated').not.toBe(undefined);
    expect(tFlight!, 'nothing stands in the socket before the flight').toBeLessThanOrEqual(tSeated!);

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
      w.__bannerBeat = {flight: false, hold: false};
      const sample = () => {
        if (document.querySelector('[data-banner-cube-flight]') !== null) {
          w.__bannerBeat.flight = true;
        }
        if ((w.__conReady?.().holds ?? []).some((h) => h.includes('parliament-sitting:enact/banner'))) {
          w.__bannerBeat.hold = true;
        }
      };
      new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true});
      window.setInterval(sample, 40);
    });
    await enterSittingByPass(page, request, playerId);
    await expect.poll(async () => (await grantsOf(request, playerId)).cubes.length, {timeout: 60_000, message: 'the server places the cube at the enactment'}).toBe(1);
    const won = (await grantsOf(request, playerId)).cubes[0];
    await expect(page.locator(`.con-pseal[data-party="${won}"] [data-banner-cube="${before.color}"]`).first(),
      'the new ruler\'s banner carries the cube once its beat has landed').toHaveCount(1, {timeout: 60_000});
    await waitSittingAtRest(page, 30_000);
    await shoot(page, '05-sitting-cube');
    const beat = await page.evaluate(() => (window as unknown as {__bannerBeat: {flight: boolean, hold: boolean}}).__bannerBeat);
    expect(beat.flight, 'the cube FLEW in the sitting').toBe(true);
    expect(beat.hold, 'under its own hold «parliament-sitting:enact/banner»').toBe(true);
    await closeSitting(page, request, playerId);
  });
});
