import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootWithCards, openActionFocus, openCardActions, playCardFromHand, soloGameConfig, waitForTurn} from './consoleStart';

/**
 * Console ACTION FLOW · the browse ⇄ ACTION FOCUS recompose.
 *
 * Drives a real solo game to the Action Browser and proves the new flow at
 * its real surface:
 *  1. BROWSE — the inspector anchors on the source-card THUMBNAIL (a physical
 *     zoom slot), the old right-panel schema duplicate is gone;
 *  2. A — the SAME frame recomposes into the ACTION FOCUS stage (no floating
 *     modal: the stage lives inside the frame's stage wrap, the browse layer
 *     parks in place, the header turns into the operation breadcrumb);
 *  3. B — the reverse movement restores the browse layer with its filters,
 *     selection and header intact;
 *  4. X in focus — the fullscreen dossier opens over the PRESERVED stage and
 *     closing it returns to the exact same focus state.
 *
 * The commit half (confirm → awaiting hold → reveal FLIP) is guarded by
 * console-surface-motion.spec.ts — this spec deliberately stops before the
 * commit and walks BACK instead (the reversible half of the flow).
 */

const OUT_DIR = path.resolve('screenshots', 'console-action-focus');

const GAME_CONFIG = soloGameConfig({
  players: [{name: 'FocusTester', color: 'red', beginner: false, handicap: 0, first: true}],
  seed: 0.11,
});

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: ''},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
  // The ACTION WORKSPACE must hold its vertical capacity on the Deck too —
  // the rail-adjacent geometry + the two-tier header are profile-sensitive.
  {tag: 'deck', width: 1280, height: 800, query: '&consoleProfile=handheld'},
] as const;

for (const profile of PROFILES) {
  test.describe(`console action focus · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('browse thumbnail → A focus recompose → B restore', async ({page, request}) => {
      test.setTimeout(480_000);

      // ── The pregame: the shared start driver puts Search For Life (a clean
      //    single-variant action) in hand. The walk is SETUP, never the
      //    subject — this spec's claim is the browse ⇄ focus recompose, so a
      //    start-flow change is adapted in `consoleStart`, never here.
      await bootWithCards(page, request, {
        cards: ['Search For Life'],
        config: GAME_CONFIG,
        query: profile.query,
        step: 0.013, // the deal-search stride this spec's seed line was tuned on
      });
      await waitForTurn(page);
      await page.waitForTimeout(4000);

      // ── Play Search For Life (RT wheel → center = КАРТЫ). ───────────────
      expect(await playCardFromHand(page, 'Search For Life'),
        'Search For Life must have been played').toBe(true);

      // ── 1. BROWSE: the inspector thumbnail is the physical anchor. ──────
      await openCardActions(page);
      const thumb = page.locator('.con-cardactions__detail-cardwrap[data-zoom-slot="Search For Life"]');
      await expect(thumb).toHaveCount(1);
      expect(await page.locator('.con-cardactions__detail-graphic').count(),
        'the right-panel schema duplicate must be gone').toBe(0);
      expect(await page.locator('.con-composer--stage').count(), 'no stage in browse').toBe(0);
      await shoot(page, `${profile.tag}-01-browse-thumbnail`);

      // ── 2. A: the SAME frame recomposes into ACTION FOCUS. ──────────────
      await openActionFocus(page);
      // No second frame chrome, no private backdrop — the browser's frame IS
      // the stage's chrome (never a web-modal feeling).
      expect(await page.locator('.con-composer__backdrop').count()).toBe(0);
      await expect(page.locator('.con-cardactions__browse--parked')).toHaveCount(1);
      // The header is the operation breadcrumb now.
      await expect(page.locator('.con-wshead__step')).toHaveCount(1);
      expect((await page.locator('.con-wshead__subject').innerText()).toUpperCase()).toContain('ПОИСКИ ЖИЗНИ');
      // The hero card slot carries the FLIP/zoom contracts.
      await expect(page.locator('.con-composer--stage [data-action-focus-card][data-zoom-slot="Search For Life"]')).toHaveCount(1);
      // The CTA dock is pinned outside the scroll.
      await expect(page.locator('.con-composer__ctadock .con-composer__cta')).toHaveCount(1);
      await page.waitForTimeout(500); // the FLIP settles
      // The couch chip weight must survive the runtime-injected scoped SFC
      // styles (the doubled-class chip-system rule): on the TV profile the
      // hero chips read at the accent size, never the 13px desktop fallback.
      const chipFs = await page.evaluate(() => {
        const chip = document.querySelector('.con-composer--stage .action-effect-chip');
        return chip !== null ? parseFloat(getComputedStyle(chip).fontSize) : 0;
      });
      expect(chipFs, 'the effect chips must ride the console chip tokens').toBeGreaterThan(15);
      await shoot(page, `${profile.tag}-02-action-focus`);

      // ── 3. B: the reverse movement restores browse exactly. ─────────────
      await key(page, 'Escape', 900);
      await expect(page.locator('.con-composer--stage')).toHaveCount(0);
      await expect(page.locator('.con-cardactions__browse--parked')).toHaveCount(0);
      await expect(page.locator('.con-wshead__step')).toHaveCount(0);
      await expect(thumb).toHaveCount(1);
      await shoot(page, `${profile.tag}-03-back-to-browse`);

      // ── 4. X in focus: the dossier opens over the PRESERVED stage. ──────
      await openActionFocus(page);
      await key(page, 'KeyX', 1600);
      await expect(page.locator('dialog.con-zoom[open]')).toHaveCount(1, {timeout: 8000});
      await shoot(page, `${profile.tag}-04-inspect-from-focus`);
      await key(page, 'Escape', 1200);
      await expect(page.locator('dialog.con-zoom[open]')).toHaveCount(0);
      // The focus state survived the inspect roundtrip.
      await expect(page.locator('.con-cardactions__stagewrap .con-composer--stage')).toHaveCount(1);
      await shoot(page, `${profile.tag}-05-focus-after-inspect`);
      // Leave cleanly (B → browse, B → board).
      await key(page, 'Escape', 700);
      await expect(page.locator('.con-composer--stage')).toHaveCount(0);
    });
  });
}
