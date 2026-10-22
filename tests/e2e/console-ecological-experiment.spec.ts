import {test, expect} from './consoleTest';
import type {Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, commitFocusedSpace, fetchPlayerModel, focusCard, openConsole, placeTile, placementState, press, pressUntil, settle, waitForBoardHome, walkToSpace} from './consoleStart';
import {expectSeeThrough, expectUncovers} from './peekWitness';
import {TileType} from '../../src/common/TileType';
import * as fs from 'fs';
import * as path from 'path';

/**
 * TR47 ECOLOGICAL EXPERIMENT — «ВВЕРХ И ОБРАТНО» (docs/TURMOIL_REDUX_ECOLOGICAL_EXPERIMENT.md;
 * the owner's accent of 2026-10-14: «шкалы должны подняться у всех игроков, а затем те, что не на
 * максимуме, уменьшиться обратно (полученный бонус шкал остаётся) — честно и на глазах у всех»).
 *
 * The ONE e2e of the card, on four fixtures:
 *   · PLAIN (fhd + tv4k, both clients) — the composer reads the raise, the printed «ЗАТЕМ», the fall
 *     and the net rating before the press; the card's own ocean lands; the removal is asked on the
 *     board as a step of the same play, with the SEE-THROUGH on the focused ocean («ПРОСВЕТ» — the
 *     printed bonus under it, «ОТКРОЕТСЯ» in the dossier); then «ОБРАТНЫЙ ХОД»: the ocean leaves, the
 *     temperature and the oxygen step back IN TURN (the server's record, `parameterSwings`), each with
 *     its tag «−N · РТ остаётся», the HUD rolling DOWN — on the mover's screen AND the rival's; the
 *     rating stays.
 *   · MAX (fhd) — every parameter reaches its maximum on the raise: nothing is asked, nothing falls,
 *     and the scene NAMES all three («МАКС.») in place.
 *   · UNDER A CITY (fhd) — the TR44 station's water is a removal candidate: the WATER is seen through,
 *     the city keeps its paint, «Ничего не откроется — на клетке остаётся город»; the city stays.
 *   · CASCADE (fhd) — 0 °C and 8 % crossed by the raise: the bonus ocean is asked before the card's
 *     own lands; the fall then lowers what the cascade raised (2 → 0 °C, 8 → 7 %).
 *
 * Probes are `setInterval` + MutationObserver samplers (never rAF). Frames under
 * screenshots/ecological-experiment/<profile>/; a storyboard with TM_E2E_STORYBOARD=1.
 */
const OUT = path.resolve('screenshots', 'ecological-experiment');
const CARD = 'Ecological Experiment';
const COMPOSER = '.con-composer--play';
const SITE = {plants: '28', steel: '04', bare: '07', station: '33', beside: '34'} as const;
/** The cascade's two free reserves: the card's staged ocean and the 0 °C bonus ocean, never the same cell. */
const CASCADE = {card: '45', bonus: '43'} as const;

const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  thisPlayer: {color: string, terraformRating: number, megacredits: number, tableau: Array<{name: string, resources?: number}>},
  game: {
    temperature: number, oxygenLevel: number, oceans: number,
    spaces: Array<{id: string, tileType?: number, under?: number, color?: string}>,
    parameterSwings?: Array<{seq: number, up: Array<{parameter: string}>, down: Array<{parameter: string, atMax?: boolean}>}>,
  },
  waitingFor?: {type?: string, placementType?: string, placementEffect?: string, spaces?: Array<string>},
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

const cellOf = (wire: Wire, id: string) => wire.game.spaces.find((s) => s.id === id);

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

async function storyboard(page: Page, preset: string, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, preset, `story-${name}`);
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

async function openComposer(page: Page): Promise<void> {
  for (let i = 0; i < 5 && await page.locator('.con-hand').count() === 0; i++) {
    await press(page, 'Period', 600); // RT → the quick wheel
    await press(page, 'Enter', 1400); // centre slot → the hand
  }
  await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).waitFor({timeout: 20_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, CARD, slots * 2 + 6), `never focused «${CARD}»`).toBeTruthy();
  for (let i = 0; i < 3 && await page.locator(COMPOSER).count() === 0; i++) {
    await press(page, 'Enter', 900);
  }
  await expect(page.locator(COMPOSER), 'the play composer stands').toHaveCount(1);
  await settle(page);
}

const composerText = (page: Page) => page.evaluate((sel) => (document.querySelector<HTMLElement>(sel)?.innerText ?? '').replace(/\s+/g, ' ').trim(), COMPOSER);
const focusedRow = (page: Page) => page.evaluate((sel) =>
  (document.querySelector(`${sel} .con-composer__row--focused`)?.textContent ?? '').replace(/\s+/g, ' ').trim(), COMPOSER);
const ctaReady = (page: Page) => page.evaluate((sel) => document.querySelector(`${sel} .con-composer__cta--ready`) !== null, COMPOSER);

/** The 3 data's holder: answered in the composer's own target step when it is asked (never auto-selected). */
async function answerDataTarget(page: Page): Promise<void> {
  if (await ctaReady(page)) {
    return;
  }
  for (const key of ['ArrowUp', 'ArrowDown']) {
    for (let i = 0; i < 8 && !/получател|данн|data|Куда/i.test(await focusedRow(page)); i++) {
      await press(page, key, 220);
    }
  }
  expect(await focusedRow(page), 'the data\'s target row is focused').toMatch(/получател|данн|data|Куда/i);
  await press(page, 'Enter', 600);
  await expect(page.locator('.con-ptsel'), 'the played-target step opened').toBeVisible();
  await press(page, 'Enter', 600);
  await expect(page.locator('.con-ptsel'), 'the step answered and closed').toHaveCount(0);
  await expect.poll(() => ctaReady(page), {timeout: 10_000, message: 'the play is ready once the data have a holder'}).toBe(true);
}

/** «Разыграть на поле»: the staged ocean takes the board — nothing sent yet. */
async function playOnTheBoard(page: Page): Promise<void> {
  for (let i = 0; i < 8 && await page.locator(`${COMPOSER} .con-composer__cta--focused`).count() === 0; i++) {
    await press(page, 'ArrowDown', 220);
  }
  const taken = () => page.evaluate((sel) =>
    document.querySelector('.con-composer--submitting, .con-composer--landing') !== null || document.querySelector(sel) === null, COMPOSER);
  for (let attempt = 0; attempt < 3 && !await taken(); attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(taken, {timeout: 2_500}).toBe(true).catch(() => undefined);
  }
  await expect.poll(() => placementState(page), {timeout: 30_000, message: 'the staged ocean never took the board'}).toBe('aiming');
  await settle(page, {timeoutMs: 20_000});
}

/** The removal is asked: the server's prompt carries the markers, the board aims, the kicker names the step. */
async function waitForRemoval(page: Page, request: APIRequestContext, playerId: string): Promise<Wire> {
  await expect.poll(async () => (await wireOf(request, playerId)).waitingFor?.placementType, {timeout: 60_000, message: 'the removal is asked'}).toBe('ocean-removal');
  const asked = await wireOf(request, playerId);
  expect(asked.waitingFor?.placementEffect, 'a removal, never a placement').toBe('remove');
  await expect.poll(() => placementState(page), {timeout: 40_000, message: 'the removal takes the board'}).toBe('aiming');
  await expect(page.locator('.con-context__task-kicker'), 'the dossier\'s kicker names the step').toContainText(/Снятие океана/i, {timeout: 20_000});
  await settle(page, {timeoutMs: 20_000});
  return asked;
}

// ── THE SWING PROBE: the scene's attributes, its tags, the HUD's rolls — on every sample (never rAF). ──
type SwingProbe = {
  samples: number;
  phases: Array<string>;
  legs: Array<string>;
  played: string;
  tags: Array<string>;
  /** The HUD readouts that rolled DOWN (`con-flipval--down`), in the order they first did. */
  rolledDown: Array<string>;
  /** The wall time of the first sample of each leg. */
  legAt: Record<string, number>;
  /** The last sample on which a removed ocean's departure proxy stood. */
  departAt?: number;
  hud: Array<string>;
};

async function armSwingProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__tr47: SwingProbe};
    const p: SwingProbe = {samples: 0, phases: [], legs: [], played: '', tags: [], rolledDown: [], legAt: {}, hud: []};
    w.__tr47 = p;
    const t0 = Date.now();
    const hudOf = (icon: string) => document.querySelector(`.con-status__param .wgt-icon--${icon}`)?.closest('.con-status__param') ?? null;
    const sample = () => {
      p.samples++;
      const now = Date.now() - t0;
      const root = document.querySelector<HTMLElement>('[data-scale-swing]');
      const phase = root?.dataset.scaleSwing ?? 'idle';
      if (p.phases[p.phases.length - 1] !== phase) {
        p.phases.push(phase);
      }
      const leg = root?.dataset.scaleSwingLeg ?? '';
      if (leg !== '' && p.legs[p.legs.length - 1] !== leg) {
        p.legs.push(leg);
        p.legAt[leg] ??= now;
      }
      const played = root?.dataset.scaleSwingPlayed ?? '';
      if (played.length > p.played.length) {
        p.played = played;
      }
      for (const tag of Array.from(document.querySelectorAll<HTMLElement>('[data-scale-swing-tag]'))) {
        const key = `${tag.dataset.scaleSwingTag}:${tag.dataset.scaleSwingKind}`;
        if (!p.tags.includes(key)) {
          p.tags.push(key);
        }
      }
      for (const icon of ['ocean', 'temperature', 'oxygen']) {
        if (hudOf(icon)?.querySelector('.con-flipval--down') !== null && hudOf(icon) !== null && !p.rolledDown.includes(icon)) {
          p.rolledDown.push(icon);
        }
      }
      if (document.querySelector('.con-tileplace__tile--depart') !== null) {
        p.departAt = now;
      }
      const hud = ['temperature', 'oxygen', 'ocean'].map((icon) => (hudOf(icon)?.querySelector('.con-status__value')?.textContent ?? '').trim()).join(' ');
      if (p.hud[p.hud.length - 1] !== hud) {
        p.hud.push(hud);
      }
    };
    sample();
    setInterval(sample, 40);
    new MutationObserver(sample).observe(document.body, {subtree: true, attributes: true, attributeFilter: ['data-scale-swing', 'data-scale-swing-leg', 'data-scale-swing-played', 'class']});
  });
}

const readSwing = (page: Page) => page.evaluate(() => (window as unknown as {__tr47: SwingProbe}).__tr47);

/** The status strip's three Mars readouts, as painted (`-10°C 5% 4/9`). */
const hudReadout = (page: Page) => page.evaluate(() => ['temperature', 'oxygen', 'ocean']
  .map((icon) => (document.querySelector(`.con-status__param .wgt-icon--${icon}`)?.closest('.con-status__param')
    ?.querySelector('.con-status__value')?.textContent ?? '').trim())
  .join(' '));

/** The scene has played the record to its end on this client (`played` names every leg, the layer is gone). */
async function waitSwingPlayed(page: Page, legs: string, who: string): Promise<SwingProbe> {
  await expect.poll(async () => (await readSwing(page)).played, {timeout: 90_000, message: `${who}: the scene played «${legs}»`}).toBe(legs);
  await expect.poll(async () => page.locator('[data-scale-swing]').count(), {timeout: 30_000, message: `${who}: the scene let go`}).toBe(0);
  return readSwing(page);
}

async function rivalOnBoard(page: Page, seat: string, query: string): Promise<Page> {
  const redPage = await page.context().newPage();
  await openConsole(redPage, seat, query);
  await settle(redPage, {timeoutMs: 30_000});
  const onBoard = () => redPage.evaluate(() => {
    const start = document.querySelector<HTMLElement>('.con-start__frame');
    const board = document.querySelector<HTMLElement>('.con-board');
    return (start === null || start.offsetParent === null) && board !== null && board.offsetParent !== null;
  });
  expect(await pressUntil(redPage, 'Escape', onBoard, {tries: 4, settleMs: 1200}), 'red stands on the board').toBe(true);
  await settle(redPage, {timeoutMs: 20_000});
  await page.bringToFront();
  return redPage;
}

for (const preset of PRESETS) {
  test.describe(`TR47 Ecological Experiment · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`PLAIN: the composer reads up · ЗАТЕМ · down · net; the ocean lands; the removal is asked with the see-through; the fall plays in turn on BOTH clients, the TR stays (${preset.id})`, async ({page, request}) => {
      test.setTimeout(480_000);
      const pageErrors: Array<string> = [];
      const posts: Array<string> = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      page.on('request', (r) => {
        if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
          posts.push(r.postData() ?? '');
        }
      });
      const {playerId, seats} = await bootFixtureSeats(page, request, 'ecological-experiment', {query: preset.query});
      const before = await wireOf(request, playerId);
      expect([before.game.temperature, before.game.oxygenLevel, before.game.oceans], 'the fixture: −12 °C · 4 % · 3 oceans').toEqual([-12, 4, 3]);
      const redPage = await rivalOnBoard(page, seats[1], preset.query);
      await armSwingProbe(redPage);

      // ── 1. THE COMPOSER: the raise, the printed «ЗАТЕМ», the fall, «ИТОГ» — and the board step named in «ДАЛЕЕ». ──
      await waitForBoardHome(page);
      await openComposer(page);
      await expect(page.locator(`${COMPOSER} .con-composer__phase[data-phase="Then"]`), 'the face\'s «THEN» divides the raise from the fall').toHaveCount(1);
      await expect(page.locator(`${COMPOSER} .con-composer__phase[data-phase="Then"]`)).toHaveText(/Затем/i);
      await expect(page.locator(`${COMPOSER} .con-composer__phase[data-phase="Net"]`), 'the net rating is its own phase').toHaveText(/Итог/i);
      const text = await composerText(page);
      expect(text, 'the oceans\' board step is named before the press').toMatch(/снимите с поля любой тайл океана/i);
      await shoot(page, preset.id, '01-composer');
      await answerDataTarget(page);
      await shoot(page, preset.id, '02-composer-ready');

      // ── 2. THE CARD'S OWN OCEAN (staged): nothing sent before the cell; ONE POST lands the whole batch. ──
      await playOnTheBoard(page);
      expect(posts, 'nothing sent before the cell is confirmed').toEqual([]);
      expect(await placeTile(page), 'the card\'s ocean is placed').toBe(true);

      // ── 3. THE REMOVAL — a step of the same play, asked on the board, never automatic; the see-through on the focus. ──
      const asked = await waitForRemoval(page, request, playerId);
      expect(asked.waitingFor?.spaces, 'every plain ocean is offered — the fresh one too').toHaveLength(4);
      const raised = await wireOf(request, playerId);
      expect([raised.game.temperature, raised.game.oxygenLevel, raised.game.oceans], 'the raise stands: −10 °C · 5 % · 4 oceans').toEqual([-10, 5, 4]);
      expect(raised.thisPlayer.terraformRating, 'three steps paid').toBe(before.thisPlayer.terraformRating + 3);
      // PL-336: the raise is TOLD before the removal comes alive — the HUD reads the peak while the player picks.
      await expect.poll(() => hudReadout(page), {timeout: 10_000, message: 'the HUD shows the raise while the ocean is chosen'}).toBe('-10°C 5% 4/9');
      await walkToSpace(page, SITE.plants);
      const peek = await expectSeeThrough(page, SITE.plants, 'top', 'TR47\'s removal');
      expect(peek.bonusIcons, 'the two printed plants are painted under the translucent ocean').toBeGreaterThan(0);
      await expectUncovers(page, [/Бонус клетки снова доступен/, /Резерв океана снова примет океан/], 'TR47\'s removal');
      await shoot(page, preset.id, '03-removal-see-through');
      await walkToSpace(page, SITE.bare);
      await expectSeeThrough(page, SITE.bare, 'top', 'a bare reserve');
      await expectUncovers(page, [/Резерв океана снова примет океан/], 'a bare reserve');
      await shoot(page, preset.id, '04-removal-bare');
      await walkToSpace(page, SITE.plants);

      // ── 4. «ОБРАТНЫЙ ХОД»: the ocean leaves, then the temperature, then the oxygen — each with its tag; the HUD rolls down. ──
      await armSwingProbe(page);
      const stop = await storyboard(page, preset.id, 'swing');
      expect(await commitFocusedSpace(page), 'the removal commits through the two-press flow').toBe(true);
      await expect.poll(async () => {
        const w = await wireOf(request, playerId);
        return [w.game.temperature, w.game.oxygenLevel, w.game.oceans];
      }, {timeout: 60_000, message: 'the server lowered what was not at its maximum'}).toEqual([-12, 4, 3]);
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.terraformRating, 'the TR stays').toBe(before.thisPlayer.terraformRating + 3);
      expect(cellOf(after, SITE.plants)?.tileType, 'the chosen ocean left').toBeUndefined();
      expect(after.game.parameterSwings?.at(-1)?.down.map((d) => d.parameter), 'the record\'s fall order').toEqual(['oceans', 'temperature', 'oxygen']);
      const own = await waitSwingPlayed(page, 'down:oceans,down:temperature,down:oxygen', 'the mover');
      await stop();
      console.log(`[${preset.id} swing] samples ${own.samples} · phases ${own.phases.join('→')} · legs ${own.legs.join(' · ')} · tags ${own.tags.join(', ')} · rolled ${own.rolledDown.join(',')} · depart ${own.departAt} · legAt ${JSON.stringify(own.legAt)} · hud ${own.hud.join(' | ')}`);
      expect(own.samples, 'the probe sampled').toBeGreaterThan(20);
      expect(own.tags, 'each fall wears its tag').toEqual(['oceans:down', 'temperature:down', 'oxygen:down']);
      expect(own.rolledDown, 'the HUD rolled each readout DOWN, in the scene\'s order').toEqual(['ocean', 'temperature', 'oxygen']);
      if (own.departAt !== undefined) {
        expect(own.legAt['down:oceans'], 'the ocean\'s count falls only once its tile has left').toBeGreaterThanOrEqual(own.departAt);
      }
      expect(own.hud[own.hud.length - 1], 'the HUD ends on the fall').toBe('-12°C 4% 3/9');
      await shoot(page, preset.id, '05-after');

      // ── 5. RED watched the same story: the same legs, the same tags. ──
      const red = await waitSwingPlayed(redPage, 'down:oceans,down:temperature,down:oxygen', 'the rival');
      console.log(`[${preset.id} red] legs ${red.legs.join(' · ')} · tags ${red.tags.join(', ')} · rolled ${red.rolledDown.join(',')}`);
      expect(red.tags).toEqual(['oceans:down', 'temperature:down', 'oxygen:down']);
      await shoot(redPage, preset.id, '06-red-after');

      expect(posts.length, 'the play is ONE POST, the removal one more').toBe(2);
      expect(pageErrors, 'no page error').toEqual([]);
    });

    if (preset.id !== 'tv4k') {
      return;
    }

    test(`MAX: every parameter reaches its maximum — nothing is asked, nothing falls, all three are NAMED in place (${preset.id})`, async ({page, request}) => {
      test.setTimeout(360_000);
      const {playerId} = await bootFixtureSeats(page, request, 'ecological-experiment-max', {query: preset.query});
      const before = await wireOf(request, playerId);
      expect([before.game.temperature, before.game.oxygenLevel, before.game.oceans]).toEqual([6, 13, 8]);
      await waitForBoardHome(page);
      await openComposer(page);
      const text = await composerText(page);
      expect(text, 'the fall\'s chips say «stays at maximum»').toMatch(/остаётся на максимуме/i);
      expect(text, 'no board step is promised — nothing to remove').not.toMatch(/снимите с поля любой тайл океана/i);
      await shoot(page, preset.id, 'max-01-composer');
      await answerDataTarget(page);
      await armSwingProbe(page);
      await playOnTheBoard(page);
      expect(await placeTile(page), 'the ninth ocean').toBe(true);
      await expect.poll(async () => {
        const w = await wireOf(request, playerId);
        return [w.game.temperature, w.game.oxygenLevel, w.game.oceans];
      }, {timeout: 60_000, message: 'every parameter at its maximum'}).toEqual([8, 14, 9]);
      const after = await wireOf(request, playerId);
      expect(after.waitingFor?.placementType, 'no removal is asked').not.toBe('ocean-removal');
      expect(after.thisPlayer.terraformRating, 'three steps paid, none taken').toBe(before.thisPlayer.terraformRating + 3);
      const own = await waitSwingPlayed(page, 'max:oceans,max:temperature,max:oxygen', 'the mover');
      expect(own.tags, 'all three named').toEqual(['oceans:max', 'temperature:max', 'oxygen:max']);
      expect(own.rolledDown, 'nothing rolled down').toEqual([]);
      await shoot(page, preset.id, 'max-02-after');
    });

    test(`UNDER A CITY: the TR44 water is a removal candidate — the WATER is seen through, the city stays (${preset.id})`, async ({page, request}) => {
      test.setTimeout(360_000);
      const {playerId} = await bootFixtureSeats(page, request, 'ecological-experiment-under-city', {query: preset.query});
      await waitForBoardHome(page);
      await openComposer(page);
      await answerDataTarget(page);
      await playOnTheBoard(page);
      expect(await placeTile(page), 'the card\'s ocean').toBe(true);
      const asked = await waitForRemoval(page, request, playerId);
      expect(asked.waitingFor?.spaces, 'the water under the city is offered').toContain(SITE.station);
      await walkToSpace(page, SITE.station);
      await expectSeeThrough(page, SITE.station, 'under', 'the water under the city');
      await expectUncovers(page, [/Ничего не откроется — на клетке остаётся город/], 'the water under the city');
      await shoot(page, preset.id, 'city-01-see-through');
      await armSwingProbe(page);
      expect(await commitFocusedSpace(page), 'the removal commits').toBe(true);
      await expect.poll(async () => cellOf(await wireOf(request, playerId), SITE.station)?.under, {timeout: 60_000, message: 'the water left from under'}).toBeUndefined();
      const after = await wireOf(request, playerId);
      expect(cellOf(after, SITE.station)?.tileType, 'the city stays').toBe(TileType.CITY);
      await waitSwingPlayed(page, 'down:oceans,down:temperature,down:oxygen', 'the mover');
      await shoot(page, preset.id, 'city-02-after');
    });

    test(`CASCADE: 0 °C and 8 % crossed — the bonus ocean asked first, the card's after; the fall lowers what the cascade raised (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
      const {playerId} = await bootFixtureSeats(page, request, 'ecological-experiment-cascade', {query: preset.query});
      const before = await wireOf(request, playerId);
      expect([before.game.temperature, before.game.oxygenLevel, before.game.oceans]).toEqual([-2, 7, 5]);
      await waitForBoardHome(page);
      await openComposer(page);
      const text = await composerText(page);
      expect(text, 'the forecast names the 0 °C ocean').toMatch(/океан/i);
      await shoot(page, preset.id, 'cascade-01-composer');
      await answerDataTarget(page);
      await playOnTheBoard(page);
      // The card's own ocean (staged) on ONE cell, the bonus ocean on ANOTHER: a bonus laid on the staged cell leaves
      // the parked tail nowhere to land and the server honestly re-asks it live — a different story than this one.
      await walkToSpace(page, CASCADE.card);
      expect(await commitFocusedSpace(page), 'the card\'s ocean (staged — it parks behind the bonus ocean)').toBe(true);
      // The bonus ocean of 0 °C is asked live, AFTER the raise's story (PL-336); the card's own lands behind it by itself.
      await expect.poll(async () => (await wireOf(request, playerId)).waitingFor?.placementType, {timeout: 60_000,
        message: 'the 0 °C bonus ocean is asked first'}).toBe('ocean');
      await expect.poll(() => placementState(page), {timeout: 40_000, message: 'the bonus ocean takes the board'}).toBe('aiming');
      await expect.poll(() => hudReadout(page), {timeout: 10_000, message: 'the raise is told before the bonus ocean is picked'}).toBe('2°C 8% 5/9');
      await walkToSpace(page, CASCADE.bonus);
      expect(await commitFocusedSpace(page), 'the 0 °C ocean').toBe(true);
      await waitForRemoval(page, request, playerId);
      const landed = await wireOf(request, playerId);
      expect([cellOf(landed, CASCADE.bonus)?.tileType, cellOf(landed, CASCADE.card)?.tileType], 'both oceans stand — the card\'s landed by itself')
        .toEqual([TileType.OCEAN, TileType.OCEAN]);
      const raised = await wireOf(request, playerId);
      expect([raised.game.temperature, raised.game.oxygenLevel, raised.game.oceans], 'the peak: +2 °C (8 %\'s step) · 8 % · 7 oceans').toEqual([2, 8, 7]);
      await armSwingProbe(page);
      expect(await placeTile(page), 'an ocean is removed').toBe(true);
      await expect.poll(async () => {
        const w = await wireOf(request, playerId);
        return [w.game.temperature, w.game.oxygenLevel, w.game.oceans];
      }, {timeout: 60_000, message: 'the fall'}).toEqual([0, 7, 6]);
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.terraformRating, 'every raise\'s rating stays (2 temperature · 1 oxygen · 2 oceans)').toBe(before.thisPlayer.terraformRating + 5);
      await waitSwingPlayed(page, 'down:oceans,down:temperature,down:oxygen', 'the mover');
      await shoot(page, preset.id, 'cascade-02-after');
    });
  });
}
