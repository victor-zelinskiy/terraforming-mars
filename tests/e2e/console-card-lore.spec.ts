import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Console fullscreen card inspect · the ARCHIVE ENTRY (the card's lore).
 *
 * Drives a real solo game into the start wizard's project-buy step, opens the
 * shared fullscreen viewer with X, and asserts the three-zone composition:
 *
 *   [ ЗАПИСЬ ИЗ АРХИВА ]   [ CARD — dead centre ]   [ ПРАВИЛА ]
 *
 *  1. the entry renders on the LEFT with its localized heading and a real
 *     (non-fallback) text;
 *  2. the CARD stays on the viewport centre line — the entry on one side and
 *     the rules panel on the other must NOT shift it (the regression the
 *     `--flank` grid exists to prevent);
 *  3. the entry is inert — no focusable node, `pointer-events: none`;
 *  4. LB / RB browsing swaps the entry in lockstep with the card.
 */

const OUT_DIR = path.resolve('screenshots', 'console-card-lore');

function newGameConfig() {
  return {
    players: [{name: 'LoreTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis',
    seed: 0.42,
    randomFirstPlayer: false,
    clonedGamedId: undefined,
    undoOption: false,
    showTimers: false,
    fastModeOption: false,
    showOtherPlayersVP: false,
    testMode: true,
    aresExtremeVariant: false,
    politicalAgendasExtension: 'Standard',
    solarPhaseOption: false,
    removeNegativeGlobalEventsOption: false,
    modularMA: false,
    draftVariant: false,
    initialDraft: false,
    preludeDraftVariant: false,
    ceosDraftVariant: false,
    startingCorporations: 2,
    shuffleMapOption: false,
    randomMA: 'No randomization',
    includeFanMA: false,
    soloTR: false,
    customCorporationsList: [],
    bannedCards: [],
    includedCards: [],
    customColoniesList: [],
    customPreludes: [],
    requiresMoonTrackCompletion: false,
    requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false,
    moonStandardProjectVariant1: false,
    altVenusBoard: false,
    escapeVelocity: undefined,
    twoCorpsVariant: false,
    customCeos: [],
    startingCeos: 3,
    startingPreludes: 4,
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 500): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

type Box = {left: number, right: number, top: number, bottom: number, width: number};

async function boxOf(page: Page, selector: string): Promise<Box | undefined> {
  const el = page.locator(selector).first();
  if (await el.count() === 0) {
    return undefined;
  }
  return el.evaluate((node) => {
    const r = (node as HTMLElement).getBoundingClientRect();
    return {left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width};
  });
}

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080},
  {tag: 'tv4k', width: 3840, height: 2160},
] as const;

for (const profile of PROFILES) {
  test.describe(`console archive entry · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('the fullscreen viewer shows the archive entry left of a centred card', async ({page, request}) => {
      test.setTimeout(300_000);

      const created = await request.post('/api/creategame', {data: newGameConfig()});
      expect(created.ok()).toBeTruthy();
      const {players} = await created.json();
      await page.goto(`/player?id=${players[0].id}&console=1`);
      await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
      await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
      await page.waitForTimeout(3800);

      // ── Reach the project-buy step (many card slots — a project card has
      //    structured rules, so all three zones are on screen at once). ─────
      await page.waitForSelector('.con-start__frame .con-cards__slot', {timeout: 25_000});
      await key(page, 'Enter', 1400); // pick the focused corporation
      const slots = page.locator('.con-start__frame .con-cards__slot');
      for (let hop = 0; hop < 6 && await slots.count() < 4; hop++) {
        await key(page, 'Period', 1400);
      }
      expect(await slots.count(), 'the project-buy step is on screen').toBeGreaterThanOrEqual(4);

      // ── X → the shared fullscreen viewer. ──────────────────────────────
      await key(page, 'KeyX', 1800);
      await expect(page.locator('.con-zoom .card-zoom-lore')).toHaveCount(1, {timeout: 10_000});
      await page.waitForTimeout(900); // the staged reveal settles

      // 1. Heading + a REAL entry (never the fallback notice).
      await expect(page.locator('.card-zoom-lore__label-text')).toHaveText('ЗАПИСЬ ИЗ АРХИВА');
      const firstText = (await page.locator('.card-zoom-lore__text').innerText()).trim();
      expect(firstText.length, 'the archive entry has text').toBeGreaterThan(0);
      expect(firstText).not.toContain('Архивная запись отсутствует');
      expect(await page.locator('.card-zoom-lore--fallback').count(), 'no fallback for an in-scope card').toBe(0);
      // Both decorative marks, and they contribute no text of their own.
      expect(await page.locator('.card-zoom-lore__mark').count()).toBe(2);
      await shoot(page, `${profile.tag}-01-archive-entry`);

      // 2. STRICT CENTRING: the card sits on the viewport centre line, with the
      //    entry entirely to its left and the rules panel entirely to its right.
      const card = await boxOf(page, '.con-zoom .card-zoom-stage .pcard, .con-zoom .card-zoom-stage .card-container');
      const lore = await boxOf(page, '.con-zoom .card-zoom-lore');
      const side = await boxOf(page, '.con-zoom .card-zoom-side');
      expect(card, 'the fullscreen card').toBeTruthy();
      expect(lore, 'the archive entry').toBeTruthy();
      const cardCentre = (card!.left + card!.right) / 2;
      const viewportCentre = profile.width / 2;
      expect(Math.abs(cardCentre - viewportCentre),
        `card centre ${cardCentre} vs viewport centre ${viewportCentre}`).toBeLessThanOrEqual(2);
      expect(lore!.right, 'the entry stays clear of the card').toBeLessThanOrEqual(card!.left);
      if (side !== undefined) {
        expect(side.left, 'the rules panel stays clear of the card').toBeGreaterThanOrEqual(card!.right);
      }

      // 3. Inert: nothing focusable, no pointer target.
      const inert = await page.locator('.card-zoom-lore').evaluate((el) => ({
        focusable: el.querySelectorAll('button, a, input, select, textarea, [tabindex]').length,
        pointerEvents: getComputedStyle(el).pointerEvents,
        fontFamily: getComputedStyle(el.querySelector('.card-zoom-lore__quote')!).fontFamily,
        fontStyle: getComputedStyle(el.querySelector('.card-zoom-lore__quote')!).fontStyle,
      }));
      expect(inert.focusable, 'the entry holds nothing focusable').toBe(0);
      expect(inert.pointerEvents).toBe('none');
      expect(inert.fontFamily, 'the Cyrillic literary face').toContain('Literata');
      expect(inert.fontStyle).toBe('italic');

      // 4. LB / RB browsing swaps the entry with the card.
      await key(page, 'KeyE', 1500); // RB → next card
      await page.waitForTimeout(700);
      const secondText = (await page.locator('.card-zoom-lore__text').innerText()).trim();
      expect(secondText.length).toBeGreaterThan(0);
      expect(secondText, 'the entry follows the browsed card').not.toBe(firstText);
      const cardAfter = await boxOf(page, '.con-zoom .card-zoom-stage .pcard, .con-zoom .card-zoom-stage .card-container');
      expect(Math.abs((cardAfter!.left + cardAfter!.right) / 2 - viewportCentre),
        'the card stays centred while browsing').toBeLessThanOrEqual(2);
      await shoot(page, `${profile.tag}-02-browsed`);

      await key(page, 'KeyQ', 1500); // LB → back
      await page.waitForTimeout(700);
      expect((await page.locator('.card-zoom-lore__text').innerText()).trim()).toBe(firstText);
    });
  });
}
