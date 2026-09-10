import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, closeZoomViewer, openZoomViewer, playCardFromHand, press, settle, soloGameConfig, waitForTurn} from './consoleStart';

/**
 * THE EXTRAS EXPLORER — the «Доп. ресурсы» rework probe.
 *
 * The contract under test (the extras rework):
 *  1. THE PIXEL CONTRACT — the rail satellite (`.con-res-aux`) is the ONE
 *     physical body of the extras zone: through the whole flow «board →
 *     Y summary → extras screen → B → Y close» every cell's icon and value
 *     keep their exact coordinates and their exact text — sampled EVERY
 *     ~40 ms, intermediate transition frames included. A one-frame jump,
 *     blink or intermediate zero is a failure, not a tolerance.
 *  2. THE SCREEN — the satellite is the type navigation (cursor / selected
 *     are distinct states painted on the cells), the gallery shows EVERY
 *     holder (zeros included), the fact strip speaks the server's own VP
 *     rows (per-card flooring: Pets at 1 animal under «2 → 1 VP» reads 0),
 *     a no-VP holder is named honestly, X inspects through the one zoom
 *     viewer and B lands back on the same card.
 *  3. THE RING — blocks open through focus + A only (no per-block button
 *     badges anywhere), B returns to the summary with the ring on the
 *     extras group.
 *
 * Cards: Pets (1 animal on play, 1 VP per 2), Tardigrades (0 microbes — the
 * mandatory zero holder), Nitrite Reducing Bacteria (3 microbes, NO VP) and
 * Search For Life (0 science, a special clause). All base/corpEra, no
 * requirements a fresh board fails.
 */

const OUT_ROOT = path.resolve('screenshots', 'extras-explorer');

type Preset = {
  id: string;
  viewport: {width: number, height: number};
  profileQuery: string;
};

const PRESETS: ReadonlyArray<Preset> = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, profileQuery: '&consoleProfile=auto'},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, profileQuery: '&consoleProfile=tv'},
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, profileQuery: '&consoleProfile=handheld'},
];

const HOLDERS = ['Pets', 'Tardigrades', 'Nitrite Reducing Bacteria', 'Search For Life'] as const;

const GAME_CONFIG = soloGameConfig({
  players: [{name: 'ExtrasTester', color: 'red', beginner: false, handicap: 0, first: true}],
  automa: {difficulty: 'normal'},
  // The dev seam: the four holders ride the TOP of the deck, so the first
  // deal offers them (four specific cards never meet in a random deal).
  customProjectCards: [...HOLDERS],
});

/** Every press is echoed + paced through the shared driver primitive —
 *  never a bare keyboard.press + a duration guess. */
async function key(page: Page, code: string, settleMs = 420): Promise<void> {
  await press(page, code, settleMs);
}

async function shoot(page: Page, preset: Preset, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

/** Open the Information workspace through whatever cinematic still stands
 *  (the bot's own beats can own the pad — acknowledge and retry). */
async function openInfo(page: Page): Promise<void> {
  const workspace = page.locator('.con-info');
  for (let i = 0; i < 10 && await workspace.count() === 0; i++) {
    if (i > 0) {
      await key(page, 'Enter', 600);
      await key(page, 'Escape', 450);
    }
    await key(page, 'KeyY', 1000);
  }
  await expect(workspace).toHaveCount(1);
}

type AuxSample = {
  t: number;
  cells: Array<{key: string, x: number, y: number, w: number, h: number, text: string, opacity: string, visibility: string}>;
};

/** Arm the in-page anchor sampler — setInterval, never rAF (headless
 *  Chromium starves rAF exactly when the screen goes quiet). */
async function armAuxSampler(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__auxSamples?: Array<AuxSample>, __auxTimer?: number};
    w.__auxSamples = [];
    w.__auxTimer = window.setInterval(() => {
      const cells = Array.from(document.querySelectorAll<HTMLElement>('.con-res-aux__cell'));
      const sample = {
        t: Date.now(),
        cells: cells.map((cell) => {
          const r = cell.getBoundingClientRect();
          const value = cell.querySelector<HTMLElement>('.con-res-aux__value');
          const cs = value !== null ? getComputedStyle(value) : undefined;
          return {
            key: cell.getAttribute('data-exr-type') ?? '',
            x: r.left, y: r.top, w: r.width, h: r.height,
            text: (value?.textContent ?? '').trim(),
            opacity: cs?.opacity ?? '',
            visibility: cs?.visibility ?? '',
          };
        }),
      };
      w.__auxSamples!.push(sample);
    }, 40);
  });
}

async function takeAuxSamples(page: Page): Promise<Array<AuxSample>> {
  return await page.evaluate(() => {
    const w = window as unknown as {__auxSamples?: Array<AuxSample>, __auxTimer?: number};
    if (w.__auxTimer !== undefined) {
      window.clearInterval(w.__auxTimer);
      w.__auxTimer = undefined;
    }
    return w.__auxSamples ?? [];
  });
}

// The flow video — continuity evidence for the transition review. Kept at
// retain-on-failure for the suite's ordinary life; a local evidence run can
// flip it to 'on' (top-level by Playwright's rule — a describe-level video
// forces a new worker and is refused outright).
test.use({video: {mode: 'on', size: {width: 1280, height: 720}}});

for (const preset of PRESETS) {
  test.describe(`extras explorer · ${preset.id}`, () => {
    test.use({
      viewport: preset.viewport,
      deviceScaleFactor: 1,
      screen: preset.viewport,
    });

    test('satellite pixel contract + the extras screen journey', async ({page, request}) => {
      test.setTimeout(480_000);

      await bootIntoGame(page, request, {
        config: GAME_CONFIG,
        query: preset.profileQuery,
        cards: [...HOLDERS],
        buy: 4,
      });

      // ── ARRANGE: put four holders on the table (testMode money). ──────
      for (const card of HOLDERS) {
        await waitForTurn(page);
        expect(await playCardFromHand(page, card), `${card} must reach the tableau`).toBeTruthy();
        await settle(page, {timeoutMs: 30_000});
      }

      // The board satellite: three types in PLAY order (animal → microbe →
      // science), totals live (Pets 1 · NRB 3 · SFL 0).
      const satellite = page.locator('.con-res-aux');
      await expect(satellite).toBeVisible();
      const cellKeys = () => page.$$eval('.con-res-aux__cell',
        (els) => els.map((e) => e.getAttribute('data-exr-type')));
      expect(await cellKeys()).toEqual(['animal', 'microbe', 'science']);
      await shoot(page, preset, '01-board-satellite');

      // ── THE PIXEL PROBE: sample the cells through the WHOLE flow. ─────
      await armAuxSampler(page);

      await openInfo(page);
      await settle(page, {timeoutMs: 20_000});
      // The ring starts on the score zone (the historical anchor) — the
      // satellite is one step LEFT; the group ring lights the column.
      await key(page, 'ArrowLeft', 450);
      await expect(satellite).toHaveClass(/con-res-aux--focused/);
      // The bottom bar's A hint names the focused group (contextual — the
      // per-block badges are gone).
      await expect(page.locator('.con-cmdbar')).toContainText(/Открыть: Доп\. ресурсы/i);
      await expect(page.locator('.con-info__hotkey')).toHaveCount(0);
      await shoot(page, preset, '02-summary-extras-focused');

      await key(page, 'Enter', 900); // A → the extras screen
      const explorer = page.locator('.con-exr');
      await expect(explorer).toHaveCount(1);
      await expect(page.locator('.con-info .con-wshead__step')).toHaveText(/Доп\. ресурсы/i);
      await settle(page, {timeoutMs: 20_000});
      await shoot(page, preset, '03-extras-animal');

      // ── The selected type (first = animal): hero + gallery + strip. ───
      await expect(explorer.locator('.con-exr__hero-total')).toHaveText('1');
      await expect(explorer.locator('.con-exr__slot')).toHaveCount(1);
      const petsSlot = explorer.locator('[data-exr-card="Pets"]');
      await expect(petsSlot.locator('.con-exr__slot-count')).toHaveText(/×1/);
      // Per-card flooring: 1 animal under «2 → 1 VP» is honestly 0.
      await expect(petsSlot.locator('.con-exr__slot-vp')).toHaveText(/0 ПО/);
      await expect(explorer.locator('.con-exr__detail-count')).toHaveText(/×1/);
      await expect(explorer.locator('.con-exr__detail-now')).toHaveText(/Сейчас: 0 ПО/);
      await expect(explorer.locator('.con-exr__detail-next')).toHaveText(/1 до следующего ПО/);
      // The satellite cell wears the SELECTION accent (cursor = selected here).
      await expect(page.locator('[data-exr-type="animal"]')).toHaveClass(/con-res-aux__cell--active/);

      // ── Category change: down the column + A (cursor ≠ selection). ────
      await key(page, 'ArrowDown', 450);
      await expect(page.locator('[data-exr-type="microbe"]')).toHaveClass(/con-res-aux__cell--cursor/);
      await expect(page.locator('[data-exr-type="animal"]'), 'the selection stands until A').toHaveClass(/con-res-aux__cell--active/);
      await key(page, 'Enter', 800);
      await expect(page.locator('[data-exr-type="microbe"]')).toHaveClass(/con-res-aux__cell--active/);
      await settle(page, {timeoutMs: 20_000});
      await shoot(page, preset, '04-extras-microbe');

      // TWO holders, the ZERO one a first-class citizen; the no-VP holder
      // is honest about its resources' role.
      await expect(explorer.locator('.con-exr__hero-total')).toHaveText('3');
      await expect(explorer.locator('.con-exr__slot')).toHaveCount(2);
      const tardigrades = explorer.locator('[data-exr-card="Tardigrades"]');
      await expect(tardigrades.locator('.con-exr__slot-count')).toHaveText(/×0/);
      await expect(tardigrades.locator('.con-exr__slot-vp')).toHaveText(/0 ПО/);
      const nrb = explorer.locator('[data-exr-card="Nitrite Reducing Bacteria"]');
      await expect(nrb.locator('.con-exr__slot-count')).toHaveText(/×3/);
      await expect(nrb.locator('.con-exr__slot-vp'), 'no VP clause — no VP chip').toHaveCount(0);

      // ── The gallery zone + the one zoom inspector round trip. ─────────
      await key(page, 'ArrowRight', 450); // cross into the gallery
      await expect(explorer.locator('.con-exr__slot--focused')).toHaveCount(1);
      // The focused (first) card is the ZERO holder — inspection is not
      // gated on the count.
      await expect(explorer.locator('.con-exr__slot--focused')).toHaveAttribute('data-exr-card', 'Tardigrades');
      // The no-VP holder's own strip line, one step right.
      await key(page, 'ArrowRight', 450);
      await expect(explorer.locator('.con-exr__detail-none')).toHaveText(/не дают ПО/i);
      await expect(explorer.locator('.con-exr__detail-chips')).toContainText(/Действие/);
      await key(page, 'ArrowLeft', 450);

      await openZoomViewer(page, 'KeyX'); // the one console zoom viewer
      await shoot(page, preset, '05-zoom-inspect');
      await closeZoomViewer(page); // B lands the card back in ITS slot
      await expect(explorer, 'the extras screen survived the inspection').toHaveCount(1);
      await expect(explorer.locator('.con-exr__slot--focused')).toHaveAttribute('data-exr-card', 'Tardigrades');
      await expect(page.locator('[data-exr-type="microbe"]'), 'category survived too').toHaveClass(/con-res-aux__cell--active/);

      // ── B: back to the summary with the ring ON the extras group. ─────
      await key(page, 'Escape', 900);
      await expect(page.locator('.con-info__layout')).toHaveCount(1);
      await expect(satellite).toHaveClass(/con-res-aux--focused/);
      await settle(page, {timeoutMs: 20_000});

      // ── Y: close — the board home, the satellite still standing. ──────
      await key(page, 'KeyY', 900);
      await expect(page.locator('.con-info')).toHaveCount(0);
      await expect(satellite).toBeVisible();
      await settle(page, {timeoutMs: 20_000});
      await shoot(page, preset, '06-board-restored');

      // ── THE PIXEL VERDICT over every sampled frame. ───────────────────
      const samples = await takeAuxSamples(page);
      expect(samples.length, 'the sampler must have lived through the flow').toBeGreaterThan(10);
      const byKey = new Map<string, Array<{x: number, y: number, w: number, h: number, text: string, opacity: string, visibility: string}>>();
      for (const s of samples) {
        for (const c of s.cells) {
          const list = byKey.get(c.key) ?? [];
          list.push(c);
          byKey.set(c.key, list);
        }
      }
      for (const type of ['animal', 'microbe', 'science']) {
        const list = byKey.get(type) ?? [];
        expect(list.length, `${type}: the cell may not vanish for a single frame ` +
          `(present in ${list.length}/${samples.length} samples)`).toBe(samples.length);
        const first = list[0];
        for (const c of list) {
          expect(Math.abs(c.x - first.x), `${type}: x must hold (Δ=${Math.abs(c.x - first.x)}px)`).toBeLessThanOrEqual(1);
          expect(Math.abs(c.y - first.y), `${type}: y must hold`).toBeLessThanOrEqual(1);
          expect(Math.abs(c.w - first.w), `${type}: width must hold`).toBeLessThanOrEqual(1);
          expect(Math.abs(c.h - first.h), `${type}: height must hold`).toBeLessThanOrEqual(1);
          expect(c.text, `${type}: the value may not blink to another number`).toBe(first.text);
          expect(Number(c.opacity), `${type}: no fade may touch the value`).toBeGreaterThan(0.99);
          expect(c.visibility, `${type}: never hidden`).toBe('visible');
        }
      }

      // ── The seat ring: the bot's honest EMPTY state at the same route. ─
      await openInfo(page);
      await key(page, 'ArrowLeft', 450);
      await key(page, 'Enter', 900);
      await expect(explorer).toHaveCount(1);
      await key(page, 'KeyE', 1000); // RB → the bot seat, route survives
      // A fresh bot has no pools yet — the full empty room, never a bare
      // frame; the satellite shows its honest plate.
      const emptyOrTypes = await Promise.race([
        explorer.locator('.con-exr__void-title').waitFor({state: 'visible', timeout: 8_000}).then(() => 'void' as const),
        explorer.locator('.con-exr__hero').waitFor({state: 'visible', timeout: 8_000}).then(() => 'types' as const),
      ]).catch(() => 'neither' as const);
      expect(emptyOrTypes, 'the bot seat presents SOMETHING honest at the same depth').not.toBe('neither');
      if (emptyOrTypes === 'void') {
        await expect(page.locator('.con-res-aux__none')).toBeVisible();
      }
      await shoot(page, preset, '07-bot-extras');
      await key(page, 'Escape', 800);
      await key(page, 'KeyY', 800);
      await expect(page.locator('.con-info')).toHaveCount(0);
    });
  });
}
