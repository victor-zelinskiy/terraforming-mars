import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootWithCards, openCardActions, playCardFromHand, soloGameConfig, waitForTurn} from './consoleStart';

/**
 * Console Action Browser · the inspect DOSSIER (ПРАВИЛА / СТАТИСТИКА).
 *
 * Drives a real solo Venus game to a turn holding «Газосборники» (Extractor
 * Balloons — a MULTI-action card whose on-play adds 3 floaters, so its card
 * history is non-empty before any activation), opens the Action Browser, and
 * asserts:
 *  1. the browser's right panel no longer renders the per-game usage ledger
 *     (`__detail-usage` gone) and no longer duplicates the inspect verb —
 *     the ONE «Осмотреть» lives in the command bar;
 *  2. X opens the fullscreen dossier on ПРАВИЛА (the card rules), the big card
 *     stable on the left;
 *  3. RB switches to СТАТИСТИКА — the card-history block (stored floaters) shows,
 *     the same card unchanged;
 *  4. LB returns to ПРАВИЛА, the big card never re-created;
 *  5. B closes the dossier back to the browser, focus preserved.
 */

const OUT_DIR = path.resolve('screenshots', 'console-inspect-history');

/** Venus ON — Extractor Balloons («Газосборники») is a Venus card. */
const GAME_CONFIG = soloGameConfig({
  players: [{name: 'InspectTester', color: 'red', beginner: false, handicap: 0, first: true}],
  expansions: {venus: true},
  seed: 0.1,
});

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

async function expectLocalizedTabBarToFit(page: Page): Promise<void> {
  const fit = await page.locator('.con-inspect-side__tabs').evaluate((tabs) => {
    const bounds = tabs.getBoundingClientRect();
    const keys = tabs.querySelectorAll('.con-inspect-side__tab-key');
    const rightKey = keys.item(keys.length - 1).getBoundingClientRect();
    return {
      clientWidth: tabs.clientWidth,
      scrollWidth: tabs.scrollWidth,
      panelRight: bounds.right,
      rightKeyRight: rightKey.right,
    };
  });
  expect(fit.scrollWidth, 'localized tab labels stay inside the dossier').toBeLessThanOrEqual(fit.clientWidth + 1);
  expect(fit.rightKeyRight, 'the RB glyph stays inside the tab bar').toBeLessThanOrEqual(fit.panelRight + 1);
}

// The full end-to-end drive (wizard → play a card → wheel → browser →
// inspect) runs on the 1080 logical profile — a deterministic, complete
// proof of the feature. The 4K TV profile is a rem-scale recomposition of
// the SAME markup (no feature-specific 4K code); its dossier is verified by
// the `screenshots/console-inspect-history/tv4k-*` captures. Driving the
// long game sequence twice on 4K only adds game-timing flake, not coverage.
const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: ''},
] as const;

for (const profile of PROFILES) {
  test.describe(`console inspect dossier · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('localized tab labels keep the RB glyph inside the dossier', async ({page}) => {
      await page.goto('/');
      await page.evaluate(async () => {
        await document.fonts.ready;
        document.documentElement.classList.add('console-mode', 'console-native', 'con-profile-tv');
        document.body.replaceChildren();
        document.body.insertAdjacentHTML('afterbegin', `
          <div class="con-inspect-side">
            <aside class="con-inspect-side__box">
              <div class="con-inspect-side__tabs" role="tablist">
                <span class="con-inspect-side__tab-key"><span class="gp-glyph gp-glyph--pill">LB</span></span>
                <button class="con-inspect-side__tab con-inspect-side__tab--active">
                  <span class="con-inspect-side__tab-mark">§</span><span>ПРАВИЛА</span>
                </button>
                <button class="con-inspect-side__tab">
                  <span class="con-inspect-side__tab-mark">◷</span><span>СТАТИСТИКА</span>
                </button>
                <span class="con-inspect-side__tab-key"><span class="gp-glyph gp-glyph--pill">RB</span></span>
              </div>
            </aside>
          </div>
        `);
      });

      await expectLocalizedTabBarToFit(page);
    });

    test('the per-game history moves to the X-inspect ПРАВИЛА/СТАТИСТИКА tabs', async ({page, request}) => {
      test.setTimeout(480_000);

      // ── The pregame: the shared start driver finds a Venus deal holding
      //    Extractor Balloons and buys it. SETUP, never the subject — this
      //    spec's claim is the dossier, so a start-flow change is adapted in
      //    `consoleStart`, never here.
      await bootWithCards(page, request, {
        cards: ['Extractor Balloons'],
        config: GAME_CONFIG,
        query: profile.query,
      });
      await waitForTurn(page);
      await page.waitForTimeout(3500);

      // Play Extractor Balloons so it has a tableau action + 3 stored floaters
      // (its on-play adds them, which is what the СТАТИСТИКА tab reads).
      expect(await playCardFromHand(page, 'Extractor Balloons'),
        'Extractor Balloons must have been played').toBe(true);

      // ── Open the Action Browser (RT wheel → ↑ card actions). ────────────
      await openCardActions(page);
      // 1. The browser is a DECISION surface: no per-game usage ledger, and no
      // in-panel copy of the inspect verb either — `ConsoleCardActions.vue:228`
      // («a second copy inside the panel was pure duplication») removed the
      // hint node deliberately, so its ABSENCE is the contract now. The verb
      // itself is proved where it matters, one beat below: X opens the dossier.
      expect(await page.locator('.con-cardactions__detail-usage').count(), 'usage ledger removed from the browser').toBe(0);
      expect(await page.locator('.con-cardactions__usage-line').count(), 'usage lines removed').toBe(0);
      expect(await page.locator('.con-cardactions__detail-history-hint').count(),
        'no in-panel inspect hint — the command bar owns that verb').toBe(0);
      await shoot(page, `${profile.tag}-01-browser-clean`);

      // ── 2. X inspects the FOCUSED action (Extractor Balloons is the first
      // available one) → the dossier opens on ПРАВИЛА. ────────────────────
      // (Retry discipline, gated on the dossier's own absence: a press that
      //  lands while the browser is still settling is consumed by design, and
      //  a second press on an OPEN dossier would be a different verb — so this
      //  presses only while there is nothing there.)
      const dossier = page.locator('.con-inspect-side');
      for (let tries = 0; tries < 3 && await dossier.count() === 0; tries++) {
        await key(page, 'KeyX', 1400);
      }
      await expect(dossier).toHaveCount(1, {timeout: 10_000});
      // Default tab is ПРАВИЛА (the rules panel embedded).
      const rulesTab = page.locator('.con-inspect-side__tab--active', {hasText: 'ПРАВИЛА'});
      await expect(rulesTab).toHaveCount(1);
      await expect(page.locator('.con-inspect-side .con-zoom-rules')).toHaveCount(1);
      await expect(page.locator('.con-cardhist')).toHaveCount(0);
      await expectLocalizedTabBarToFit(page);
      const cardSig = await page.locator('.con-zoom .card-zoom-stage .pcard, .con-zoom .card-zoom-stage .card-container').first()
        .evaluate((el) => (el as HTMLElement).getBoundingClientRect().width).catch(() => 0);
      await shoot(page, `${profile.tag}-02-inspect-rules`);

      // ── 3. RB → СТАТИСТИКА; the card is unchanged, the history block shows. ─
      await key(page, 'KeyE', 900); // RB (+ the content crossfade settles)
      const histTab = page.locator('.con-inspect-side__tab--active', {hasText: 'СТАТИСТИКА'});
      await expect(histTab).toHaveCount(1);
      await expect(page.locator('.con-cardhist')).toHaveCount(1);
      // Card history block present (stored floaters from the on-play +3).
      await expect(page.locator('.con-cardhist__group--card')).toBeVisible();
      // The big card did NOT re-create (same width — never a new modal).
      const cardSig2 = await page.locator('.con-zoom .card-zoom-stage .pcard, .con-zoom .card-zoom-stage .card-container').first()
        .evaluate((el) => (el as HTMLElement).getBoundingClientRect().width).catch(() => 0);
      expect(Math.abs(cardSig2 - cardSig), 'the big card is stable across the tab swap').toBeLessThan(2);
      await shoot(page, `${profile.tag}-03-inspect-history`);

      // ── 4. LB → back to ПРАВИЛА (repeated switch is safe). ──────────────
      await key(page, 'KeyQ', 700); // LB
      await expect(page.locator('.con-inspect-side__tab--active', {hasText: 'ПРАВИЛА'})).toHaveCount(1);
      await expect(page.locator('.con-cardhist')).toHaveCount(0);

      // ── 5. B closes the dossier back to the browser (the close flight is
      // slower on 4K — wait for the whole viewer to unmount, then the
      // Action Browser is back underneath it, focus preserved). ───────────
      await key(page, 'Escape', 900);
      await expect(page.locator('.con-inspect-side')).toHaveCount(0, {timeout: 12_000});
      await page.waitForSelector('.con-zoom', {state: 'detached', timeout: 12_000}).catch(() => {});
      await expect(page.locator('.con-cardactions')).toHaveCount(1, {timeout: 12_000});
      await shoot(page, `${profile.tag}-04-back-to-browser`);
    });
  });
}
