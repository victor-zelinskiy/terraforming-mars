import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, press, pressUntil, settle} from './consoleStart';

/**
 * THE QUICK WHEEL'S CONFIRM — a plate of the prompt-modal family (PL-385) whose «Сработает» row is a DOOR (PL-394).
 *
 * The owner's report (2026-10-15): the notification before the heat conversion «shows which effects will fire, but it
 * is too small on 4K and not premium, and pressing the button to drill in and inspect the effects does nothing». The
 * confirm was the shell's inline card: its formula chips fell back to the 13 px desktop size (it was no chip-token
 * root), the row drew the R3 key and nothing answered it. Two journeys, two profiles, against a real server:
 *
 *   (A) THE HEAT CONVERSION UNDER THE RULING GREENS — LT → the right arm lands on the confirm (nothing sent): the
 *       family's head («БАЗОВЫЕ ДЕЙСТВИЯ», the ask in the reading face), the OPERATION as one object (the wheel's
 *       symbol on its medallion — the flight's anchor — beside the formula at the scene's scale, never the desktop's
 *       13 px), «Сработает» at the plate's chip scale with its R3 key, no verb drawn in the panel (the bar names A
 *       «Конвертировать», R3 «Эффекты», B). R3 opens the «Эффекты» layer INSIDE the confirm (the plate parks, the
 *       explorer lists the Greens in «Вы получите», the bar's context gains «ЭФФЕКТЫ»), B gives the plate back whole
 *       and nothing was sent; A then commits — ONE POST, the server took the 8 heat.
 *   (B) THE PASS — LT → the down arm: «Пас до следующего поколения», the consequence beside the wheel's symbol, the
 *       opportunities the pass leaves unused as rows under one heading, «Пас» on A, no R3; B cancels, nothing sent.
 *
 * Fixture `plasma-fans` (the Greens rule, 8 heat, the temperature off its maximum). Heavy 4K: `--workers=1`.
 */
const OUT = path.resolve('screenshots', 'action-confirm');
const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

const CONFIRM = '.con-confirm[data-motion-surface="confirm"]';
const PLATE = `${CONFIRM} .con-confirm__card`;

type Wire = {thisPlayer: {heat: number}};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${preset}-${name}.png`)});
}

function watchPosts(page: Page): Array<string> {
  const posts: Array<string> = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      posts.push(r.postData() ?? '');
    }
  });
  return posts;
}

const onBoard = (p: Page) => () => p.evaluate(() => {
  const board = document.querySelector<HTMLElement>('.con-board');
  return document.querySelector('.con-ws') === null && board !== null && board.offsetParent !== null;
});

/** LT → the basic-actions wheel → `arm` lands on the confirm of `kind` (nothing sent). */
async function openConfirm(page: Page, arm: string, kind: 'pass' | 'convertHeat'): Promise<void> {
  expect(await pressUntil(page, 'Escape', onBoard(page), {tries: 4, settleMs: 1200}), 'the viewer stands on the board').toBe(true);
  expect(await pressUntil(page, 'Comma', async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 900}), 'the basic-actions wheel opens').toBe(true);
  const confirm = page.locator(`${CONFIRM}[data-confirm-kind="${kind}"]`);
  expect(await pressUntil(page, arm, async () => await confirm.count() > 0, {tries: 3, settleMs: 1200}), `the ${kind} confirm stands`).toBe(true);
  await settle(page);
}

/** Every chip's painted font size against the live rem (the TV rem is the scaled one — `--con-ui-scale`). */
async function chipScale(page: Page, selector: string): Promise<Array<number>> {
  return page.evaluate((sel) => {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return Array.from(document.querySelectorAll<HTMLElement>(sel)).map((chip) => {
      let zoom = 1;
      for (let n: HTMLElement | null = chip; n !== null; n = n.parentElement) {
        const z = parseFloat(getComputedStyle(n).zoom || '1');
        zoom *= Number.isFinite(z) && z > 0 ? z : 1;
      }
      return Math.round(parseFloat(getComputedStyle(chip).fontSize) * zoom / rem * 100) / 100;
    });
  }, selector);
}

const opacityOf = (page: Page, selector: string) => page.evaluate((sel) => {
  const el = document.querySelector<HTMLElement>(sel);
  return el === null ? -1 : Number(getComputedStyle(el).opacity);
}, selector);

for (const preset of PRESETS) {
  test.describe(`the quick wheel's confirm · ${preset.id}`, () => {
    test.use({viewport: preset.viewport, deviceScaleFactor: 1, screen: preset.viewport});

    test('(A) the heat conversion under the Greens: the family plate, the scene-scale formula, R3 → the «Эффекты» layer, B → back, A → one POST', async ({page, request}) => {
      test.setTimeout(240_000);
      const errors: Array<string> = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const posts = watchPosts(page);
      const {playerId} = await bootFixtureSeats(page, request, 'plasma-fans', {query: preset.query});
      await settle(page);
      expect((await wireOf(request, playerId)).thisPlayer.heat, 'the fixture: 8 heat').toBe(8);
      await openConfirm(page, 'ArrowRight', 'convertHeat');

      // ── 1. The family's plate, the operation as ONE object, the table's answer as a door; no verb in the panel.
      await expect(page.locator(`${PLATE}.con-prompt`), 'a plate of the prompt-modal family').toHaveCount(1);
      await expect(page.locator(`${CONFIRM} .con-prompt-head__category`)).toHaveText(/Базовые действия/i);
      await expect(page.locator(`${CONFIRM} .con-prompt-head__title`)).toHaveText(/Повысить температуру за тепло/i);
      await expect(page.locator(`${CONFIRM} .con-confirm__hero [data-wheel-anchor="confirm"]`), 'the wheel flight\'s anchor is the medallion\'s symbol').toHaveCount(1);
      await expect(page.locator(`${CONFIRM} [data-confirm-formula] .action-effect-chip`), 'the price, the step, its implied rating').toHaveCount(3);
      const door = page.locator(`${CONFIRM} [data-forecast-row]`);
      await expect(door, 'the «Сработает» row stands').toHaveCount(1);
      await expect(door).toContainText('+2');
      await expect(page.locator(`${PLATE} .gp-glyph`), 'the ONE glyph in the panel is the door\'s R3 key — the bar owns the verbs').toHaveCount(1);
      await expect(door.locator('.gp-glyph')).toHaveCount(1);
      const bar = page.locator('.con-cmdbar');
      await expect(bar).toContainText(/Конвертировать/i);
      await expect(bar, 'the bar offers the layer').toContainText(/Эффекты/i);
      expect(posts, 'nothing sent before the confirm').toEqual([]);

      // THE SCENE'S SCALE (the owner: «слишком мелко на 4K»): the formula one step above the chip token, the answer at
      // the token — never the 13 px desktop chip (≈ 0.33 rem on the couch).
      const formula = await chipScale(page, `${CONFIRM} [data-confirm-formula] .action-effect-chip`);
      expect(Math.min(...formula), `the formula chips stand at the scene's scale (font/rem: ${formula.join(', ')})`).toBeGreaterThanOrEqual(0.9);
      const answer = await chipScale(page, `${CONFIRM} [data-forecast-row] .action-effect-chip`);
      expect(answer.length, 'the answer has its chips').toBeGreaterThan(0);
      expect(Math.min(...answer), `the answer's chips at the plate's chip scale (font/rem: ${answer.join(', ')})`).toBeGreaterThanOrEqual(0.8);
      await shoot(page, preset.id, 'a-01-heat-confirm');

      // ── 2. R3 → the layer INSIDE the confirm: the plate parks, the explorer lists the Greens, the context names it.
      expect(await pressUntil(page, 'KeyV', async () => await page.locator(`${CONFIRM} [data-forecast-layer]`).count() > 0, {tries: 3, settleMs: 1100}),
        'R3 opens the «Эффекты» layer — the key on the row answers now').toBeTruthy();
      await expect(page.locator(`${CONFIRM} [data-forecast-host] [data-forecast-layer] .con-efx--forecast`)).toHaveCount(1);
      await expect(page.locator(`${CONFIRM} [data-forecast-layer] [data-forecast-group="receive"]`), 'the Greens stand in «Вы получите»').toHaveCount(1);
      await expect.poll(() => opacityOf(page, PLATE), {timeout: 5000, message: 'the plate PARKS under the layer (never unmounted)'}).toBeLessThan(0.1);
      await expect(page.locator('.con-cmdbar__context'), 'the context gains «ЭФФЕКТЫ»').toContainText(/Эффекты/i);
      const fit = await page.evaluate((sel) => {
        const band = document.querySelector<HTMLElement>(sel)!.getBoundingClientRect();
        const layer = document.querySelector<HTMLElement>(`${sel} [data-forecast-surface]`)!.getBoundingClientRect();
        return {inside: layer.left >= band.left - 1 && layer.right <= band.right + 1 && layer.top >= band.top - 1 && layer.bottom <= band.bottom + 1,
          w: Math.round(layer.width), h: Math.round(layer.height), bw: Math.round(band.width)};
      }, CONFIRM);
      expect(fit.inside, `the layer stands inside the confirm's band (${fit.w}×${fit.h} of ${fit.bw})`).toBe(true);
      expect(fit.w, 'the layer is a room, not the plate\'s width').toBeGreaterThan(fit.bw * 0.45);
      await settle(page, {timeoutMs: 15_000});
      await shoot(page, preset.id, 'a-02-effects-layer');
      expect(posts, 'nothing sent inside the layer').toEqual([]);

      // ── 3. B → the layer folds, the plate comes back whole; the confirm still stands.
      expect(await pressUntil(page, 'Escape', async () => await page.locator(`${CONFIRM} [data-forecast-layer]`).count() === 0, {tries: 3, settleMs: 1100}),
        'B folds the layer, never the confirm').toBeTruthy();
      await expect(page.locator(CONFIRM), 'the confirm still stands').toHaveCount(1);
      await expect.poll(() => opacityOf(page, PLATE), {timeout: 5000, message: 'the plate is back'}).toBeGreaterThan(0.99);
      await expect(page.locator('.con-cmdbar__context')).not.toContainText(/Эффекты/i);
      expect(posts, 'nothing sent').toEqual([]);

      // ── 4. A → ONE POST; the server took the 8 heat.
      for (let i = 0; i < 3 && posts.length === 0; i++) {
        await press(page, 'Enter', 600);
      }
      expect(posts.length, 'A sent exactly one input').toBe(1);
      await expect(page.locator(CONFIRM)).toHaveCount(0, {timeout: 15_000});
      await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.heat, {timeout: 20_000, message: 'the server took the 8 heat'}).toBe(0);
      expect(errors, 'no page error').toEqual([]);
    });

    test('(B) the pass: the consequence beside the symbol, what it leaves unused, «Пас» on A, B cancels', async ({page, request}) => {
      test.setTimeout(180_000);
      const posts = watchPosts(page);
      await bootFixtureSeats(page, request, 'plasma-fans', {query: preset.query});
      await settle(page);
      await openConfirm(page, 'ArrowDown', 'pass');
      await expect(page.locator(`${CONFIRM} .con-prompt-head__title`)).toHaveText(/Пас до следующего поколения/i);
      await expect(page.locator(`${CONFIRM} .con-confirm__consequence`)).toContainText(/больше не будете совершать действий/i);
      await expect(page.locator(`${CONFIRM} .con-confirm__body`), 'the consequence is said ONCE — beside the symbol, never again as a warning').toHaveCount(0);
      await expect(page.locator(`${CONFIRM} .con-confirm__hero [data-wheel-anchor="confirm"]`)).toHaveCount(1);
      const unused = page.locator(`${CONFIRM} [data-confirm-warns] .con-confirm__warn`);
      expect(await unused.count(), 'the unused opportunities are named, one row each').toBeGreaterThan(0);
      await expect(page.locator(`${CONFIRM} .con-confirm__warns-title`)).toHaveText(/Ещё доступно/i);
      const bar = page.locator('.con-cmdbar');
      await expect(bar).toContainText(/Пас/i);
      await expect(bar, 'a pass has no table answer behind R3').not.toContainText(/Эффекты/i);
      await expect(page.locator(`${PLATE} .gp-glyph`), 'no verb drawn in the panel').toHaveCount(0);
      await shoot(page, preset.id, 'b-01-pass-confirm');
      expect(await pressUntil(page, 'Escape', async () => await page.locator(CONFIRM).count() === 0, {tries: 3, settleMs: 900}), 'B cancels').toBeTruthy();
      expect(posts, 'nothing sent').toEqual([]);
    });
  });
}
