/*
 * «СРАБОТАЕТ» IN THE HYDRONETWORK — iteration 6 of «СРАБАТЫВАНИЕ КАРТЫ» (the owner, 2026-10-27: «доработка интерфейса
 * "гидросети" чтобы показывать "сработает" (и возможность нажать R3 чтобы embedded войти и осмотреть какие эффекты
 * сработают) — пример на втором шаге: поднятие производства тепла при правлении зелёных»).
 *
 * The stand (the `hydro-greens` fixture: the ruling Greens, blue at the track's start with Solar Power and 3 energy):
 *   ① the plan at stage 2 («Pumping Stations», +1 energy OR +1 heat production): BEFORE the choice the plan body's
 *     answer line stands EMPTY — a choice stage answers nothing by itself (the owner's «на плитках выбора»);
 *   ② the choice step: the HEAT option tile carries its own «⚡ сработает» (the Greens' +1 M€ production), the energy
 *     tile none — read before the pick;
 *   ③ the heat option picked: the plan body's «⚡ сработает» door stands with its R3 key, R3 opens the «Эффекты» layer
 *     INSIDE the workspace (the three columns park under it, the crumb gains «ЭФФЕКТЫ», the Greens stand in
 *     «Вы получите»), B gives the plan back with the choice intact, nothing sent;
 *   ④ A commits: the server grants the heat production AND the Greens' M€ production, and the Greens' CHARTER rises on
 *     the reaction stage (the standalone chain — the motion itself is `console-card-reaction` § HYDRO's subject).
 * FUNCTIONAL class: every witness here is a presence / a server fact, never a sampled motion.
 */
import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, fetchPlayerModel, press, pressUntil, settle} from './consoleStart';

const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const GREENS = 'Greens';
const OUT = path.resolve('screenshots', 'hydro-forecast');

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${PRESET.id}-${name}.png`)});
}

type Wire = {thisPlayer: {energy: number, heatProduction: number, energyProduction: number, megacreditProduction: number}};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

type Diag = {commit: {phase: string, toPosition: number, kind: string} | null} | null;
const hydroDiag = async (page: Page): Promise<Diag> =>
  await page.evaluate(() => (window as unknown as {__conHydroDiag?: () => unknown}).__conHydroDiag?.() ?? null) as Diag;

const focusedStop = async (page: Page): Promise<string> =>
  await page.evaluate(() => document.querySelector('.con-hydro__stop--focused')?.getAttribute('data-hydro-stop') ?? '');

/** RT — the hydro section (the board's right trigger), then the track; ◀ / ▶ walk the plan's cursor onto `stop`. */
async function openHydroAtStage(page: Page, stop: string): Promise<void> {
  await press(page, 'Period', 1100);
  await press(page, 'ArrowLeft', 1600);
  await page.waitForSelector('.con-hydro', {timeout: 10_000});
  await settle(page, {timeoutMs: 15_000});
  await walkToStop(page, stop);
}

/** The plan's track cursor: ◀ / ▶ move it one stop (the section's own grammar); bounded. */
async function walkToStop(page: Page, stop: string): Promise<void> {
  for (let i = 0; i < 12 && await focusedStop(page) !== stop; i++) {
    const at = Number(await focusedStop(page));
    await press(page, Number.isNaN(at) || at < Number(stop) ? 'ArrowRight' : 'ArrowLeft', 500);
  }
  expect(await focusedStop(page), `the cursor stands on stage ${stop}`).toBe(stop);
}

test.describe(`«Сработает» in the Hydronetwork · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('stage 2 under the ruling Greens: the heat tile\'s own note, the plan\'s door after the pick, R3 → the layer inside the workspace, B keeps the choice, A → the Greens\' charter rises', async ({page, request}) => {
    test.setTimeout(300_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const posts: Array<string> = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && /\/player\/input/.test(req.url())) {
        posts.push(req.url());
      }
    });
    const playerId = await bootFixture(page, request, 'hydro-greens', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, playerId);
    expect(before.thisPlayer.energy, 'the fixture: 3 energy').toBe(3);

    // ── ① the plan at stage 2: the answer line is RESERVED and EMPTY before the choice.
    await openHydroAtStage(page, '2');
    const fxline = page.locator('.con-hydro [data-hydro-fxline]');
    await expect(fxline, 'the plan body reserves its «⚡ сработает» line').toHaveCount(1);
    await expect(fxline.locator('[data-forecast-row]'), 'a choice stage answers nothing until the option is chosen').toHaveCount(0);
    await expect(page.locator('.con-hydro [data-forecast-layer]'), 'no layer stands').toHaveCount(0);

    // ── ② the choice step: the HEAT tile carries the Greens' note, the energy tile none.
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-hydro__layer--choice').count() > 0, {tries: 3, settleMs: 1100}),
      'A opens the stage reward choice').toBe(true);
    const tiles = page.locator('.con-hydro__choice-card');
    await expect(tiles, 'two option tiles').toHaveCount(2);
    await expect(tiles.nth(0).locator('[data-hydro-choice-fx]'), 'energy production wakes nobody').toHaveCount(0);
    await expect(tiles.nth(1).locator('[data-hydro-choice-fx]'), 'the heat option carries its own «⚡ сработает»').toHaveCount(1);
    await expect(tiles.nth(1).locator('[data-hydro-choice-fx]'), 'the note names the Greens\' M€ production').toContainText(/\+1/);
    await shoot(page, '01-choice-notes');
    expect(await pressUntil(page, 'ArrowRight', async () => ((await tiles.nth(1).getAttribute('class')) ?? '').includes('con-hydro__choice-card--focused'), {tries: 3, settleMs: 500}),
      'the cursor moves to the heat option').toBe(true);
    // ONE press — the step CONFIRMS ITSELF (A on an option seals it and arms the commit right under it; a second A would
    // be the commit): the heat tile wears the seal, the step stays, the door stands in it.
    await press(page, 'Enter', 900);
    await expect(tiles.nth(1), 'the heat option is sealed').toHaveClass(/con-hydro__choice-card--selected/, {timeout: 10_000});
    await expect(page.locator('.con-hydro__layer--choice'), 'the step stands at its confirm stage').toHaveCount(1);

    // ── ③ the step's door, R3 → the layer INSIDE the workspace, B → the step whole, nothing sent.
    const door = page.locator('.con-hydro__layer--choice [data-hydro-fxline] [data-forecast-row]');
    await expect(door, 'the «⚡ сработает» door stands for the chosen option at the confirm stage').toHaveCount(1, {timeout: 10_000});
    await expect(door.locator('.gp-glyph'), 'the door carries the R3 key').toHaveCount(1);
    await shoot(page, '02-door');
    expect(await pressUntil(page, 'KeyV', async () => await page.locator('.con-hydro [data-forecast-layer]').count() > 0, {tries: 3, settleMs: 1100}),
      'R3 opens the «Эффекты» layer inside the workspace').toBeTruthy();
    await expect(page.locator('.con-hydro [data-forecast-host] [data-forecast-layer] .con-efx--forecast'), 'the explorer stands in the host').toHaveCount(1);
    await expect(page.locator('.con-hydro .con-wshead'), 'the crumb gains «ЭФФЕКТЫ»').toContainText(/ЭФФЕКТЫ/i);
    await expect(page.locator('.con-hydro [data-forecast-layer] [data-forecast-group="receive"]'), 'the Greens stand in «Вы получите»').toHaveCount(1);
    await expect(page.locator('.con-hydro__panel--fxopen'), 'the plan\'s columns PARK under the layer').toHaveCount(1);
    expect(await page.locator('.con-hydro .con-hydro__flow').count(), 'the track column is parked, not gone').toBe(1);
    expect(await page.locator('.con-hydro__layer--choice').count(), 'the choice step is parked under the layer, not gone').toBe(1);
    await shoot(page, '03-layer');
    expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-hydro [data-forecast-layer]').count() === 0, {tries: 3, settleMs: 1100}),
      'B folds the layer').toBeTruthy();
    await expect(page.locator('.con-hydro'), 'the workspace is still up').toHaveCount(1);
    await expect(page.locator('.con-hydro .con-wshead')).not.toContainText(/ЭФФЕКТЫ/i);
    await expect(door, 'the choice survived the fold — the door still stands').toHaveCount(1);
    await expect(tiles.nth(1), 'the heat option is still sealed').toHaveClass(/con-hydro__choice-card--selected/);
    expect(posts, 'nothing was sent').toEqual([]);

    // ── ④ A commits: the heat production, the Greens' M€ production, the charter on the stage.
    await press(page, 'Enter', 900);
    await expect.poll(async () => (await hydroDiag(page))?.commit?.kind ?? 'none', {timeout: 15_000, message: 'the plain commit stands after A'}).toBe('plain');
    await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.heatProduction, {timeout: 30_000, message: 'the server: +1 heat production'})
      .toBe(before.thisPlayer.heatProduction + 1);
    const after = await wireOf(request, playerId);
    expect(after.thisPlayer.megacreditProduction, 'the Greens: +1 M€ production for the heat step').toBe(before.thisPlayer.megacreditProduction + 1);
    expect(after.thisPlayer.energyProduction, 'the energy option was not taken').toBe(before.thisPlayer.energyProduction);
    await page.locator(`.con-reaction__face[data-reaction-card="${GREENS}"]`).waitFor({state: 'visible', timeout: 60_000});
    await shoot(page, '04-greens-rise');
    await settle(page, {timeoutMs: 60_000});
    expect(posts.length, 'ONE post — the advance').toBe(1);
    expect(errors, 'no page errors').toEqual([]);
  });
});
