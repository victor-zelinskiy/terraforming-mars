import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, playCardFromHand, soloGameConfig, visibleSurfaces} from './consoleStart';

/**
 * THE SCORE EXPLORER — the Information workspace's victory-points subtree:
 *
 *   summary tile → (shared-element entry) → scoring OVERVIEW (no scroll)
 *     → a CATEGORY's detail (TR provenance / the cards hub / fact rows)
 *       → a card FAMILY's table + the live PREVIEW column
 *         → X — the ONE console fullscreen inspector (physical origin,
 *           B lands the card back in the preview, no duplicates ever)
 *
 * This spec drives a real human+MarsBot game with three guaranteed no-req
 * VP starters played from the hand (Ganymede Colony · Vesta Shipyard ·
 * Asteroid Mining — a conditional jovian scorer + two fixed printers, so
 * the families, the formulas and the sorting are real), then walks the
 * whole vertical and asserts the load-bearing contracts:
 *
 *  1. NO SCROLL on the overview — the whole scoring picture in one viewport
 *     (asserted at 1080, 4K and the Deck profile).
 *  2. ONE BAR SEMANTIC — the share fill is value/positiveTotal (23 of 39
 *     may never read as a full bar again).
 *  3. TR PROVENANCE — Σ of the named rows ≡ the displayed rating.
 *  4. FORMULAS — a conditional row speaks its own arithmetic («3 × 1 ПО»),
 *     never one universal sentence; rows sort by current VP desc.
 *  5. FULLSCREEN PHYSICALITY — X lifts the PREVIEW card itself (the slot
 *     holds empty under the flight), B returns it, focus/scroll survive.
 *  6. PARITY — LB/RB keeps the semantic depth for the bot (same grid, same
 *     order, no «Подсчёт бота»), and switches back without a jump.
 *
 * Also the screenshot + video source (screenshots/score-explorer/<preset>/).
 */

const OUT_ROOT = path.resolve('screenshots', 'score-explorer');

type Preset = {
  id: string;
  viewport: {width: number, height: number};
  profileQuery: string;
  /** The full journey runs once (1080); the others sweep fit + parity. */
  journey: boolean;
};

const PRESETS: ReadonlyArray<Preset> = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, profileQuery: '&consoleProfile=auto', journey: true},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, profileQuery: '&consoleProfile=tv', journey: false},
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, profileQuery: '&consoleProfile=handheld', journey: false},
];

/** Conditional (1 VP / jovian) + two fixed printers — all requirement-free. */
const VP_CARDS = ['Ganymede Colony', 'Vesta Shipyard', 'Asteroid Mining'];

const GAME_CONFIG = soloGameConfig({
  players: [{name: 'ScoreTester', color: 'red', beginner: false, handicap: 0, first: true}],
  seed: 0.31,
  automa: {difficulty: 'normal'},
  // The dev guaranteed-cards mechanism: the named projects go ON TOP of the
  // deck (Deck.putOnTop, applied after the solo neutral player's draws), so
  // the FIRST deal offers all three — no random-deal retries.
  customProjectCards: VP_CARDS,
});

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

async function shoot(page: Page, preset: Preset, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

const crumbStage = (page: Page) => page.locator('.con-info .con-wshead__step');
const botOnStage = (page: Page) => page.locator('.con-info .con-info__corp--bot');

async function cycleTo(page: Page, want: 'bot' | 'human'): Promise<void> {
  for (let i = 0; i < 4; i++) {
    if ((await botOnStage(page).count() > 0) === (want === 'bot')) {
      return;
    }
    await key(page, 'KeyE', 900);
  }
  expect((await botOnStage(page).count() > 0) === (want === 'bot'),
    `the seat ring must reach the ${want} participant`).toBeTruthy();
}

/** Open the Information workspace, acknowledging whatever cinematic stands. */
async function openInfo(page: Page): Promise<void> {
  const workspace = page.locator('.con-info');
  for (let i = 0; i < 10 && await workspace.count() === 0; i++) {
    if (i > 0) {
      await key(page, 'Enter', 700);
      await key(page, 'Escape', 500);
    }
    await key(page, 'KeyY', 1100);
  }
  await expect(workspace,
    `the info workspace must open; visible: ${(await visibleSurfaces(page)).join(', ')}`).toHaveCount(1);
}

/** A container proves «no scroll»: its content fits its own box. */
async function expectFits(page: Page, selector: string, label: string): Promise<void> {
  const verdict = await page.locator(selector).first().evaluate((el) => ({
    sh: el.scrollHeight, ch: el.clientHeight, sw: el.scrollWidth, cw: el.clientWidth,
  }));
  expect(verdict.sh, `${label}: content height ${verdict.sh} must fit ${verdict.ch}`)
    .toBeLessThanOrEqual(verdict.ch + 2);
  expect(verdict.sw, `${label}: content width ${verdict.sw} must fit ${verdict.cw}`)
    .toBeLessThanOrEqual(verdict.cw + 2);
}

/** Walk the overview grid cursor onto a category tile (row/col arithmetic —
 *  the grid is row-major with a profile-fixed column count). */
async function focusTile(page: Page, tileKey: string): Promise<void> {
  const keys = await page.locator('.con-vpx__tile').evaluateAll(
    (els) => els.map((el) => el.getAttribute('data-vpx-tile') ?? ''));
  const target = keys.indexOf(tileKey);
  expect(target, `the ${tileKey} tile must exist (have: ${keys.join(', ')})`).toBeGreaterThanOrEqual(0);
  const cols = await page.locator('.con-vpx__grid').evaluate(
    (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  for (let guard = 0; guard < 16; guard++) {
    const at = await page.locator('.con-vpx__tile').evaluateAll(
      (els) => els.findIndex((el) => el.classList.contains('con-vpx__tile--focused')));
    if (at === target) {
      return;
    }
    const [ar, ac] = [Math.floor(at / cols), at % cols];
    const [tr, tc] = [Math.floor(target / cols), target % cols];
    if (tr > ar) {
      await key(page, 'ArrowDown', 260);
    } else if (tr < ar) {
      await key(page, 'ArrowUp', 260);
    } else if (tc > ac) {
      await key(page, 'ArrowRight', 260);
    } else {
      await key(page, 'ArrowLeft', 260);
    }
  }
  expect.soft(false, `could not reach the ${tileKey} tile`).toBeTruthy();
}

const focusedRowName = (page: Page) =>
  page.locator('.con-vpx__row--focused .con-vpx__row-name').textContent();

// The flow video (the journey preset's run is the deliverable) — a per-
// describe `video` forces a new worker, so it rides the top-level use.
test.use({video: {mode: 'on', size: {width: 1920, height: 1080}}});

for (const preset of PRESETS) {
  test.describe(`score explorer · ${preset.id}`, () => {
    test.use({
      viewport: preset.viewport,
      deviceScaleFactor: 1,
      screen: preset.viewport,
    });

    test('the victory-points vertical: overview → category → table → fullscreen', async ({page, request}) => {
      test.setTimeout(560_000);

      // A page error anywhere in the vertical is a finding, not noise.
      const pageErrors: Array<string> = [];
      page.on('pageerror', (e) => pageErrors.push(String(e)));

      await bootIntoGame(page, request, {
        config: GAME_CONFIG,
        cards: VP_CARDS, // guaranteed in the deal AND bought by the seeder
        query: preset.profileQuery,
      });

      // ── MATERIAL: play the three starters through the real hand flow. ──
      for (const card of VP_CARDS) {
        expect(await playCardFromHand(page, card), `${card} must play`).toBeTruthy();
      }
      await page.waitForTimeout(1500);

      // ── LEVEL 0 → 1: the summary tile opens into the overview. ────────
      await openInfo(page);
      await shoot(page, preset, '01-summary');
      await expect(page.locator('.con-info__zone--vp.con-info__zone--focused')).toHaveCount(1);
      const summaryTotal = (await page.locator('.con-infovp__total').textContent() ?? '').trim();
      expect(Number(summaryTotal), 'the summary total is a real number').toBeGreaterThan(20);

      // THE SHARED-ELEMENT ENTRY, measured: a TOTAL-carrying node (the
      // tile's, the flight PROXY's — a clone carries the same anchor — or
      // the hero's) must be PAINTED on every sample of the transition.
      // setInterval, never rAF (headless starves the compositor clock).
      await page.evaluate(() => {
        const w = window as unknown as {__vpxGap?: {samples: number, gaps: number, timer: number}};
        const probe = {samples: 0, gaps: 0, timer: 0};
        probe.timer = window.setInterval(() => {
          probe.samples++;
          const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-vpx-total]'));
          const painted = nodes.some((el) => {
            const cs = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05 && r.width > 4 && r.height > 4;
          });
          if (!painted) {
            probe.gaps++;
          }
        }, 16);
        w.__vpxGap = probe;
      });
      await key(page, 'Enter', 1100); // A → the score explorer
      const gapVerdict = await page.evaluate(() => {
        const w = window as unknown as {__vpxGap?: {samples: number, gaps: number, timer: number}};
        const probe = w.__vpxGap;
        if (probe !== undefined) {
          window.clearInterval(probe.timer);
        }
        return probe ?? {samples: 0, gaps: 0};
      });
      expect(gapVerdict.samples, 'the frame probe must have sampled the entry').toBeGreaterThan(20);
      expect(gapVerdict.gaps, `the total never misses a frame (${gapVerdict.gaps}/${gapVerdict.samples} dark samples)`).toBe(0);
      const explorer = page.locator('.con-vpx');
      await expect(explorer).toHaveCount(1);
      await expect(crumbStage(page)).toHaveText(/Победные очки/i);
      // THE SAME TOTAL — the hero carries the number the tile showed.
      await expect(page.locator('.con-vpx__total')).toHaveText(summaryTotal);

      // NO SCROLL: the whole scoring picture fits one viewport.
      await expectFits(page, '.con-vpx__overview', 'the overview');
      await expectFits(page, '.con-vpx__grid', 'the category grid');
      const tileCount = await page.locator('.con-vpx__tile').count();
      expect(tileCount, 'every core category is a door').toBeGreaterThanOrEqual(6);
      // ONE BAR SEMANTIC: the TR tile's share is value/total — NEVER 100%.
      const trShare = await page.locator('[data-vpx-tile="tr"] .con-vpx__tile-fill')
        .evaluate((el, arg) => el.getBoundingClientRect().width / (el.parentElement!.getBoundingClientRect().width || 1) * 100, null);
      expect(trShare, 'TR is a share of the total, not a full bar').toBeLessThan(96);
      expect(trShare).toBeGreaterThan(20);
      // Zero categories stay IN the list, compact ink.
      await expect(page.locator('.con-vpx__tile--zero').first()).toBeVisible();
      await shoot(page, preset, '02-overview');

      if (!preset.journey) {
        // The sweep presets: parity + fit at depth, then home.
        await cycleTo(page, 'bot');
        await expect(page.locator('.con-vpx__grid')).toHaveCount(1);
        await expect(page.locator('.con-vpx__tile')).toHaveCount(tileCount);
        await expect(explorer).not.toContainText('Подсчёт бота');
        await expectFits(page, '.con-vpx__overview', 'the bot overview');
        await shoot(page, preset, '03-overview-bot');
        await cycleTo(page, 'human');
        await focusTile(page, 'cards');
        await key(page, 'Enter', 1000);
        await expect(page.locator('.con-vpx__groups')).toHaveCount(1);
        await shoot(page, preset, '04-cards-hub');
        await key(page, 'Enter', 1100); // the first (conditional-bearing) family door
        if (await page.locator('.con-vpx__table').count() > 0) {
          await expectFits(page, '.con-vpx__table', 'the family table');
          await shoot(page, preset, '05-table');
        }
        await key(page, 'KeyY', 900);
        await expect(page.locator('.con-info')).toHaveCount(0);
        return;
      }

      // ── LEVEL 2: TR provenance — Σ rows ≡ the displayed rating. ───────
      await focusTile(page, 'tr');
      const trTileValue = Number(await page.locator('[data-vpx-tile="tr"] .con-vpx__tile-value').textContent());
      await key(page, 'Enter', 1100);
      await expect(page.locator('.con-vpx__cat')).toHaveCount(1);
      await expect(crumbStage(page)).toHaveText(/Победные очки.*Рейтинг/i);
      const trRows = await page.locator('.con-vpx__trrow-value').allTextContents();
      const trSum = trRows.reduce((a, t) => a + Number(t), 0);
      expect(trSum, 'Σ of the named TR rows ≡ the rating').toBe(trTileValue);
      await expect(page.locator('.con-vpx__trsum b')).toHaveText(String(trTileValue));
      await expect(page.locator('.con-vpx__trrow--base')).toContainText(/Стартовый рейтинг/i);
      await shoot(page, preset, '03-tr-provenance');
      await key(page, 'Escape', 1000); // B → the overview, cursor back on TR
      await expect(page.locator('.con-vpx__cat')).toHaveCount(0);
      await expect(page.locator('[data-vpx-tile="tr"].con-vpx__tile--focused')).toHaveCount(1);

      // ── LEVEL 2: the cards hub — three family doors, honest counts. ───
      await focusTile(page, 'cards');
      await key(page, 'Enter', 1100);
      await expect(page.locator('.con-vpx__groups')).toHaveCount(1);
      await expect(crumbStage(page)).toHaveText(/Победные очки.*Карты/i);
      // The resource family holds nothing in this game — a DEAD door, told.
      await expect(page.locator('[data-vpx-group="cards-resource"]')).toHaveClass(/--dead/);
      await shoot(page, preset, '04-cards-hub');

      // ── LEVEL 3: the conditional family — formula + preview. ──────────
      await key(page, 'ArrowRight', 300); // → conditional (door 2)
      await key(page, 'Enter', 1200);
      await expect(page.locator('.con-vpx__table')).toHaveCount(1);
      await expect(crumbStage(page)).toHaveText(/Карты.*Условные/i);
      // Ganymede Colony: 3 jovian tags → «3 × 1 ПО = 3 ПО» — ITS formula.
      await expect(page.locator('.con-vpx__row').first()).toContainText('Колония на Ганимеде');
      await expect(page.locator('.con-vpx__row-formula').first()).toContainText(/3\s*×\s*1\s*ПО\s*=\s*3\s*ПО/);
      // The preview column shows the REAL premium card of the focused row.
      await expect(page.locator('.con-vpx__preview-card .pcard')).toHaveCount(1);
      await expect(page.locator('.con-vpx__preview-card')).toHaveAttribute('data-zoom-slot', 'Ganymede Colony');
      await expectFits(page, '.con-vpx__table', 'the conditional table');
      await shoot(page, preset, '05-conditional-table');

      // ── X: the fullscreen inspector — the PREVIEW CARD ITSELF flies. ──
      await key(page, 'KeyX', 1400);
      const zoom = page.locator('dialog.con-zoom[open]');
      await expect(zoom).toHaveCount(1);
      // NO DUPLICATE: the preview slot holds EMPTY under the lifted card
      // (the zoom-hold contract — the same physicality the hand ships).
      const slotOpacity = await page.locator('.con-vpx__preview-card')
        .evaluate((el) => getComputedStyle(el).opacity);
      expect(Number(slotOpacity), 'the origin slot yields its card to the viewer').toBeLessThanOrEqual(0.01);
      await shoot(page, preset, '06-fullscreen');
      await key(page, 'Escape', 1400); // B → the card lands back in the preview
      await expect(zoom).toHaveCount(0);
      await expect(page.locator('.con-vpx__preview-card .pcard')).toBeVisible();
      expect((await focusedRowName(page))?.trim(), 'row focus survives the round trip')
        .toContain('Колония на Ганимеде');
      await shoot(page, preset, '07-back-from-fullscreen');

      // ── B → the hub; the FIXED family: sorted by current VP desc. ─────
      await key(page, 'Escape', 1000);
      await expect(page.locator('.con-vpx__groups')).toHaveCount(1);
      await key(page, 'ArrowRight', 300); // → fixed (door 3)
      await key(page, 'Enter', 1200);
      await expect(crumbStage(page)).toHaveText(/Карты.*Фиксированные/i);
      const vps = (await page.locator('.con-vpx__row-vp').allTextContents()).map(Number);
      expect(vps.length).toBeGreaterThanOrEqual(2);
      for (let i = 1; i < vps.length; i++) {
        expect(vps[i], 'rows sort by current VP, descending').toBeLessThanOrEqual(vps[i - 1]);
      }
      await shoot(page, preset, '08-fixed-table');

      // ── PARITY AT DEPTH: LB/RB keeps the semantic place for the bot. ──
      await cycleTo(page, 'bot');
      await expect(page.locator('.con-vpx__table'), 'the family route survives the seat ring').toHaveCount(1);
      await expect(crumbStage(page)).toHaveText(/Карты.*Фиксированные/i);
      await expect(page.locator('.con-vpx')).not.toContainText('Подсчёт бота');
      await shoot(page, preset, '09-table-bot');
      await cycleTo(page, 'human');
      await expect(page.locator('.con-vpx__table')).toHaveCount(1);

      // ── THE B CHAIN home: table → hub → overview → summary. ───────────
      await key(page, 'Escape', 900);
      await expect(page.locator('.con-vpx__groups')).toHaveCount(1);
      await key(page, 'Escape', 900);
      await expect(page.locator('.con-vpx__grid')).toBeVisible();
      await key(page, 'Escape', 1100);
      await expect(page.locator('.con-info__layout')).toHaveCount(1);
      await expect(page.locator('.con-info__zone--vp.con-info__zone--focused'),
        'B lands the ring on the zone the player descended from').toHaveCount(1);
      await shoot(page, preset, '10-back-at-summary');

      // ── REDUCED MOTION: the whole vertical still walks cleanly. ───────
      await page.emulateMedia({reducedMotion: 'reduce'});
      await key(page, 'Enter', 500);
      await expect(page.locator('.con-vpx')).toHaveCount(1);
      await focusTile(page, 'cards');
      await key(page, 'Enter', 500);
      await expect(page.locator('.con-vpx__groups')).toHaveCount(1);
      await key(page, 'Escape', 400);
      await key(page, 'Escape', 400);
      await expect(page.locator('.con-info__layout'),
        `the reduced-motion B chain lands home (page errors: ${pageErrors.join(' | ') || 'none'})`).toHaveCount(1);
      await page.emulateMedia({reducedMotion: 'no-preference'});

      // ── Y closes from any depth; the board comes back. ────────────────
      await key(page, 'KeyY', 900);
      await expect(page.locator('.con-info')).toHaveCount(0);
      expect(pageErrors, 'the whole vertical runs without a page error').toEqual([]);
    });
  });
}
