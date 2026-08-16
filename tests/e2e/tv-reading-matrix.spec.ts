import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createGameWithCards, openConsole, seedGameOverApi, soloGameConfig,
  waitForBoardHome, closeZoomViewer, press,
} from './consoleStart';
import {openHand} from './cardTradeDoor';

/**
 * COUCH-READING MATRIX (the TV typography iteration) — the fullscreen card
 * viewer's two reading surfaces, driven over REAL Russian strings at the
 * real surface:
 *
 *   · rules panel (`.con-zoom-rules`) — the three LENGTH TIERS on live cards:
 *       brief   — «Комета» (87 chars total)
 *       regular — «Домашний скот» (178, 4 groups) / «Нептунианские
 *                  энергоконсультанты» (210 — the longest single RU rule)
 *       dense   — «Самовоспроизводящиеся роботы» (265 — the densest premium
 *                  hand card)
 *   · archive entry (`.card-zoom-lore`) — the corp EXTENDED tier over the
 *     longest RU lore (Saturn Systems, 303 chars) beside the rules panel —
 *     the «карта + правила + lore одновременно» acceptance frame.
 *
 * Assertions are STRUCTURAL (the screenshots are the human's evidence):
 *   1. the reading faces actually LOADED (document.fonts.check) — a silent
 *      fallback re-renders in Ubuntu and passes every geometry check;
 *   2. the reading tier class matches the card's localized text volume;
 *   3. the couch floor holds (computed font-size ≥ the reading floor);
 *   4. nothing clips: every paragraph wraps inside its box and the panel
 *      needs no scroll for any matrix card at 4K.
 *
 * Two presets — the geometry rule: a claim asserted at one resolution is a
 * claim about one resolution (tv4k = --con-ui-scale 2; fhd = the base
 * console profile, which must stay byte-identical to the shipped look).
 */

// Two 4K browser instances + the game server contend on one machine and the
// start-scene inspect then misses its press budget — one worker, presets in
// sequence (this is a screenshot matrix, wall-clock is not its currency).
test.describe.configure({mode: 'serial'});

const CARDS = ['Comet', 'Livestock', 'Neptunian Power Consultants', 'Self-replicating Robots'];
const CORP = 'Saturn Systems';

const PRESETS = [
  {tag: 'tv-4k', width: 3840, height: 2160, query: '&consoleProfile=tv', readFloorPx: 50},
  {tag: 'fhd', width: 1920, height: 1080, query: '', readFloorPx: 18},
] as const;

const OUT = path.join('screenshots', 'tv-reading');

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

/**
 * Open the fullscreen viewer with FORCED FRAMES. Headless Chromium drives
 * rAF off the compositor: a screen that settles into a static frame starves
 * the app's own rAF-driven settle chain, and the surface then absorbs X
 * forever (the e2e rAF trap, generalized — the probe rule's app-side twin).
 * A tiny screenshot forces a BeginFrame between presses.
 */
async function openZoomForced(page: Page): Promise<void> {
  const zoom = page.locator('dialog.con-zoom[open]');
  for (let i = 0; i < 14 && await zoom.count() === 0; i++) {
    await press(page, 'KeyX', 900);
    await forceFrame(page);
  }
  await expect(zoom, 'the fullscreen viewer opened').toHaveCount(1, {timeout: 8_000});
}

async function forceFrame(page: Page): Promise<void> {
  await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}}).catch(() => {});
}

/** The zoomed card's reading-tier modifier, off the live class list. */
async function rulesTier(page: Page): Promise<string> {
  const cls = await page.locator('.con-zoom-rules').first().getAttribute('class') ?? '';
  const m = /con-zoom-rules--(brief|regular|dense)/.exec(cls);
  return m?.[1] ?? '(none)';
}

/** No paragraph overflows its line box; the panel fits without scroll. */
async function assertNoClipping(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const bad: Array<string> = [];
    for (const p of document.querySelectorAll<HTMLElement>('.con-zoom-rules__text')) {
      if (p.scrollWidth > p.clientWidth + 1) {
        bad.push(`text overflows: «${(p.textContent ?? '').slice(0, 40)}»`);
      }
    }
    const scroll = document.querySelector<HTMLElement>('.con-zoom-rules__scroll .con-scroll__view') ??
      document.querySelector<HTMLElement>('.con-zoom-rules__scroll');
    if (scroll !== null && scroll.scrollHeight > scroll.clientHeight + 1) {
      bad.push(`panel needs scroll: ${scroll.scrollHeight} > ${scroll.clientHeight}`);
    }
    return bad;
  });
  expect(overflow, 'reading surface clipping').toEqual([]);
}

for (const preset of PRESETS) {
  test.describe(`reading matrix · ${preset.tag}`, () => {
    test.use({
      viewport: {width: preset.width, height: preset.height},
      deviceScaleFactor: 1,
      screen: {width: preset.width, height: preset.height},
    });

    test(`rules tiers + corp lore read from the couch`, async ({page, request}) => {
      test.setTimeout(420_000);

      const config = soloGameConfig({
        expansions: {promo: true},
        customProjectCards: CARDS,
        customCorporationsList: [CORP, 'Helion'],
      });
      const playerId = await createGameWithCards(request, [...CARDS, CORP], {config});

      // ── 1 · The PREGAME corp inspect: lore (extended) + rules together ──
      await openConsole(page, playerId, preset.query);
      await openZoomForced(page);
      // Browse to the corp whose archive entry runs EXTENDED (Saturn Systems'
      // 303-char paragraph) — the corp row is two cards, so one bumper step
      // reaches it whichever corp the cursor woke on.
      const extended = page.locator('.card-zoom-lore--extended');
      for (let i = 0; i < 4 && await extended.count() === 0; i++) {
        await press(page, 'KeyE', 1400);
        await forceFrame(page);
      }
      await expect(extended, 'a corp with extended lore is on screen').toHaveCount(1);
      await expect(page.locator('.con-zoom-rules')).toHaveCount(1);

      // The reading faces must be LOADED — a fallback silently re-renders the
      // matrix in Ubuntu and every geometry assertion still passes.
      const fonts = await page.evaluate(() => ({
        golos: document.fonts.check('16px "Golos Text"'),
        literataItalic: document.fonts.check('italic 16px Literata'),
        literataUpright: document.fonts.check('16px Literata'),
        lang: document.documentElement.lang,
      }));
      expect(fonts.golos, 'Golos Text loaded').toBe(true);
      expect(fonts.literataUpright, 'Literata upright loaded (extended lore tier)').toBe(true);
      expect(fonts.lang, 'html[lang] stamped (hyphenation dictionary)').not.toBe('');

      // The extended tier reads UPRIGHT (the editorial shift) in the serif.
      const loreStyle = await page.locator('.card-zoom-lore__quote').first().evaluate((el) => {
        const cs = getComputedStyle(el);
        return {family: cs.fontFamily, style: cs.fontStyle, sizePx: parseFloat(cs.fontSize)};
      });
      if (fonts.lang === 'ru') {
        expect(loreStyle.family, 'lore serif face').toContain('Literata');
      }
      expect(loreStyle.style, 'extended lore is upright').toBe('normal');

      // MOUNTED is not READABLE: the archive entry's reveal choreography
      // starts every element at opacity 0 and settles ~250ms after the open
      // flight lands — a screenshot taken off the mount assertion alone
      // catches an empty gutter. Gate the frame on the QUOTE's real paint.
      await expect.poll(
        () => page.locator('.card-zoom-lore__quote').first().evaluate((el) => getComputedStyle(el).opacity),
        {message: 'the lore quote finished its reveal', timeout: 10_000},
      ).toBe('1');

      await shoot(page, preset.tag, '01-corp-lore-extended-plus-rules');
      await closeZoomViewer(page);

      // ── 2 · Seed the game over the API and open the running board ──────
      await seedGameOverApi(request, playerId, {cards: CARDS, corporation: CORP});
      await openConsole(page, playerId, preset.query);
      await waitForBoardHome(page, 25);

      // ── 3 · The hand: zoom each matrix card, prove its tier + no clip ──
      // The shared RT-wheel door (bumpers are re-labelled inside sections,
      // so a bumper walk can never be the route).
      await openHand(page);
      await openZoomForced(page);

      const seen = new Map<string, string>();
      for (let i = 0; i < CARDS.length; i++) {
        await expect(page.locator('.con-zoom-rules')).toHaveCount(1);
        const tier = await rulesTier(page);
        const text = await page.locator('.con-zoom-rules__text').first().evaluate((el) => {
          const cs = getComputedStyle(el);
          return {family: cs.fontFamily, sizePx: parseFloat(cs.fontSize)};
        });
        expect(text.family, 'rules body reads in the reading face').toContain('Golos Text');
        expect(text.sizePx, `reading floor at ${preset.tag}`).toBeGreaterThanOrEqual(preset.readFloorPx);
        await assertNoClipping(page);
        seen.set(`${i}`, tier);
        await shoot(page, preset.tag, `0${2 + i}-hand-rules-${tier}`);
        if (i < CARDS.length - 1) {
          await press(page, 'KeyE', 1300); // RB → next card in the zoom
          await forceFrame(page);
        }
      }
      // The matrix covered every tier: the brief one-liner, the regular
      // middle, and the dense floor tier — on real localized cards.
      const tiers = new Set(seen.values());
      expect(tiers, 'all three reading tiers exercised').toEqual(new Set(['brief', 'regular', 'dense']));

      await closeZoomViewer(page);
    });
  });
}
