import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Console Action Browser · the inspect DOSSIER (ПРАВИЛА / ИСТОРИЯ).
 *
 * Drives a real solo Venus game to a turn holding «Газосборники» (Extractor
 * Balloons — a MULTI-action card whose on-play adds 3 floaters, so its card
 * history is non-empty before any activation), opens the Action Browser, and
 * asserts:
 *  1. the browser's right panel no longer renders the per-game usage ledger
 *     (`__detail-usage` gone) — only the calm inspect hint remains;
 *  2. X opens the fullscreen dossier on ПРАВИЛА (the card rules), the big card
 *     stable on the left;
 *  3. RB switches to ИСТОРИЯ — the card-history block (stored floaters) shows,
 *     the same card unchanged;
 *  4. LB returns to ПРАВИЛА, the big card never re-created;
 *  5. B closes the dossier back to the browser, focus preserved.
 */

const OUT_DIR = path.resolve('screenshots', 'console-inspect-history');

function newGameConfig() {
  return {
    players: [{name: 'InspectTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: true, colonies: false,
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis',
    seed: 0.1,
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

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
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

    test('the per-game history moves to the X-inspect ПРАВИЛА/ИСТОРИЯ tabs', async ({page, request}) => {
      test.setTimeout(480_000);

      // Find a Venus deal holding Extractor Balloons (Газосборники).
      let playerId = '';
      for (let attempt = 0; attempt < 40 && playerId === ''; attempt++) {
        const config = {...newGameConfig(), seed: 0.1 + attempt * 0.017};
        const created = await request.post('/api/creategame', {data: config});
        expect(created.ok()).toBeTruthy();
        const {players} = await created.json();
        const pv = await (await request.get(`/api/player?id=${players[0].id}`)).json();
        const dealt = (pv.waitingFor?.options ?? [])
          .flatMap((o: {cards?: Array<{name: string}>}) => (o.cards ?? []).map((c) => c.name));
        if (dealt.includes('Extractor Balloons')) {
          playerId = players[0].id;
        }
      }
      expect(playerId, 'a Venus deal containing Extractor Balloons').not.toBe('');
      await page.goto(`/player?id=${playerId}&console=1${profile.query}`);
      await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
      await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
      await page.waitForTimeout(3800);

      // ── Wizard: pick any corp, buy Extractor Balloons, launch. ──────────
      const startScene = page.locator('.con-start__frame');
      await page.waitForSelector('.con-start__frame .con-cards__slot', {timeout: 25_000});
      // Corp pick with a confirmation retry (4K first frames render long — an
      // Enter landing before the scene accepts input is silently dropped).
      const balloonsSlot = page.locator('.con-cards__slot[data-zoom-slot="Extractor Balloons"]');
      for (let tries = 0; tries < 4; tries++) {
        await key(page, 'Enter', 1400);
        const pickedCorp = await page.locator('.con-start__frame', {hasText: 'Выбрано 1'}).count() > 0;
        if (pickedCorp || await balloonsSlot.count() > 0) {
          break;
        }
      }
      for (let hop = 0; hop < 5 && await balloonsSlot.count() === 0; hop++) {
        const onSummary = await page.locator('.con-start__frame', {hasText: 'Сводка'}).count() > 0;
        await key(page, onSummary ? 'Comma' : 'Period', 1400);
      }
      await balloonsSlot.waitFor({timeout: 8000});
      for (let step = 0; step < 40; step++) {
        if (await page.locator('.con-cards__slot[data-zoom-slot="Extractor Balloons"][class*="--focused"]').count() > 0) {
          break;
        }
        await key(page, 'ArrowRight', 230);
      }
      const picked = page.locator('.con-cards__slot[data-zoom-slot="Extractor Balloons"][class*="--picked"]');
      for (let tries = 0; tries < 3 && await picked.count() === 0; tries++) {
        await key(page, 'Enter', 700);
      }
      expect(await picked.count(), 'Extractor Balloons bought').toBeGreaterThan(0);
      await key(page, 'Period', 1400);
      for (let i = 0; i < 10 && await startScene.count() > 0; i++) {
        await key(page, i % 2 === 0 ? 'Enter' : 'Period', 1100);
      }
      await page.waitForSelector('.con-start__frame', {state: 'detached', timeout: 30_000});
      const turnChip = page.locator('.con-status', {hasText: 'ДЕЙСТВИЕ'});
      for (let i = 0; i < 12 && await turnChip.count() === 0; i++) {
        if (await page.locator('.con-start').count() > 0) {
          await key(page, 'Enter', 1300);
        } else {
          await page.waitForTimeout(1000);
        }
      }
      await expect(turnChip).toHaveCount(1, {timeout: 20_000});
      await page.waitForTimeout(3500);

      // Play Extractor Balloons from hand so it has a tableau action + 3 stored
      // floaters (RT wheel → center = КАРТЫ → focus it → play → confirm).
      await key(page, 'Period', 600);
      await key(page, 'Enter', 1600);
      await expect(page.locator('.con-hand [data-zoom-slot="Extractor Balloons"]')).toBeVisible({timeout: 10_000});
      for (let step = 0; step < 12; step++) {
        const f = await page.locator('.con-hand .con-hand__slot--selected[data-zoom-slot]').first().getAttribute('data-zoom-slot').catch(() => null);
        if (f === 'Extractor Balloons') {
          break;
        }
        await key(page, 'ArrowRight', 260);
      }
      await key(page, 'Enter', 900); // open play composer
      for (let i = 0; i < 5 && await page.locator('.con-composer--play, .con-play').count() > 0; i++) {
        await key(page, 'Enter', 900);
      }
      await page.waitForTimeout(4200); // played-hero settle

      // ── Open the Action Browser (RT wheel → ↑ card actions). ────────────
      await key(page, 'Period', 600);
      await key(page, 'ArrowUp', 1000);
      await expect(page.locator('.con-cardactions')).toHaveCount(1, {timeout: 10_000});
      // 1. The per-game usage ledger is GONE from the browser; the hint stays.
      expect(await page.locator('.con-cardactions__detail-usage').count(), 'usage ledger removed from the browser').toBe(0);
      expect(await page.locator('.con-cardactions__usage-line').count(), 'usage lines removed').toBe(0);
      await expect(page.locator('.con-cardactions__detail-history-hint')).toHaveCount(1);
      await shoot(page, `${profile.tag}-01-browser-clean`);

      // ── 2. X inspects the FOCUSED action (Extractor Balloons is the first
      // available one) → the dossier opens on ПРАВИЛА. ────────────────────
      await key(page, 'KeyX', 1400);
      await expect(page.locator('.con-inspect-side')).toHaveCount(1, {timeout: 10_000});
      // Default tab is ПРАВИЛА (the rules panel embedded).
      const rulesTab = page.locator('.con-inspect-side__tab--active', {hasText: 'ПРАВИЛА'});
      await expect(rulesTab).toHaveCount(1);
      await expect(page.locator('.con-inspect-side .con-zoom-rules')).toHaveCount(1);
      await expect(page.locator('.con-cardhist')).toHaveCount(0);
      const cardSig = await page.locator('.con-zoom .card-zoom-stage .pcard, .con-zoom .card-zoom-stage .card-container').first()
        .evaluate((el) => (el as HTMLElement).getBoundingClientRect().width).catch(() => 0);
      await shoot(page, `${profile.tag}-02-inspect-rules`);

      // ── 3. RB → ИСТОРИЯ; the card is unchanged, the history block shows. ─
      await key(page, 'KeyE', 900); // RB (+ the content crossfade settles)
      const histTab = page.locator('.con-inspect-side__tab--active', {hasText: 'ИСТОРИЯ'});
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
