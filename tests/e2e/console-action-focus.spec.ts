import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

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

function newGameConfig() {
  return {
    players: [{name: 'FocusTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis',
    seed: 0.11,
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

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: ''},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
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

      // A deal containing Search For Life (a clean single-variant action).
      let playerId = '';
      for (let attempt = 0; attempt < 40 && playerId === ''; attempt++) {
        const config = {...newGameConfig(), seed: 0.11 + attempt * 0.013};
        const created = await request.post('/api/creategame', {data: config});
        expect(created.ok()).toBeTruthy();
        const {players} = await created.json();
        const pv = await (await request.get(`/api/player?id=${players[0].id}`)).json();
        const dealt = (pv.waitingFor?.options ?? [])
          .flatMap((o: {cards?: Array<{name: string}>}) => (o.cards ?? []).map((c) => c.name));
        if (dealt.includes('Search For Life')) {
          playerId = players[0].id;
        }
      }
      expect(playerId, 'a deal containing Search For Life').not.toBe('');
      await page.goto(`/player?id=${playerId}&console=1${profile.query}`);
      await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
      await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
      await page.waitForTimeout(3800);

      // ── The start wizard (console-surface-motion drive, verbatim). ──────
      const startScene = page.locator('.con-start__frame');
      await page.waitForSelector('.con-start__frame .con-cards__slot', {timeout: 25_000});
      const corpWithFirstAction = new Set(['Inventrix', 'Tharsis Republic', 'CrediCor', 'United Nations Mars Initiative', 'Helion']);
      for (let step = 0; step < 12; step++) {
        const focusedCorp = await page.locator('.con-start__frame .con-cards__slot[class*="--focused"]').first()
          .getAttribute('data-zoom-slot').catch(() => null);
        if (focusedCorp !== null && !corpWithFirstAction.has(focusedCorp)) {
          break;
        }
        await key(page, 'ArrowRight', 240);
      }
      const searchSlot = page.locator('.con-cards__slot[data-zoom-slot="Search For Life"]');
      for (let tries = 0; tries < 4; tries++) {
        await key(page, 'Enter', 1400);
        const picked = await page.locator('.con-start__frame', {hasText: 'Выбрано 1'}).count() > 0;
        if (picked || await searchSlot.count() > 0) {
          break;
        }
      }
      for (let hop = 0; hop < 5 && await searchSlot.count() === 0; hop++) {
        const onSummary = await page.locator('.con-start__frame', {hasText: 'Сводка'}).count() > 0;
        await key(page, onSummary ? 'Comma' : 'Period', 1400);
      }
      await searchSlot.waitFor({timeout: 8000});
      for (let step = 0; step < 40; step++) {
        const focused = await page.locator('.con-cards__slot[data-zoom-slot="Search For Life"][class*="--focused"]').count() > 0;
        if (focused) {
          break;
        }
        await key(page, 'ArrowRight', 230);
      }
      const pickedSearch = page.locator('.con-cards__slot[data-zoom-slot="Search For Life"][class*="--picked"]');
      for (let tries = 0; tries < 3 && await pickedSearch.count() === 0; tries++) {
        await key(page, 'Enter', 700);
      }
      expect(await pickedSearch.count(), 'Search For Life must be picked').toBeGreaterThan(0);
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
      await page.waitForTimeout(4000);

      // ── Play Search For Life (RT wheel → center = КАРТЫ). ───────────────
      await key(page, 'Period', 600);
      await key(page, 'Enter', 1600);
      await expect(page.locator('.con-hand [data-zoom-slot="Search For Life"]')).toBeVisible({timeout: 10_000});
      for (let step = 0; step < 12; step++) {
        const focusedName = await page.locator('.con-hand .con-hand__slot--selected[data-zoom-slot]').first()
          .getAttribute('data-zoom-slot').catch(() => null);
        if (focusedName === 'Search For Life') {
          break;
        }
        await key(page, 'ArrowRight', 260);
      }
      await key(page, 'Enter', 900);
      for (let i = 0; i < 5 && await page.locator('.con-composer--play, .con-play').count() > 0; i++) {
        await key(page, 'Enter', 900);
      }
      await page.waitForTimeout(4200);

      // ── 1. BROWSE: the inspector thumbnail is the physical anchor. ──────
      // Verified entry (a press on a busy 4K frame is silently dropped —
      // the same retry discipline as the wizard steps).
      for (let tries = 0; tries < 4 && await page.locator('.con-cardactions').count() === 0; tries++) {
        await key(page, 'Period', 700);
        await key(page, 'ArrowUp', 1200);
      }
      await expect(page.locator('.con-cardactions')).toHaveCount(1, {timeout: 10_000});
      const thumb = page.locator('.con-cardactions__detail-cardwrap[data-zoom-slot="Search For Life"]');
      await expect(thumb).toHaveCount(1);
      expect(await page.locator('.con-cardactions__detail-graphic').count(),
        'the right-panel schema duplicate must be gone').toBe(0);
      expect(await page.locator('.con-composer--stage').count(), 'no stage in browse').toBe(0);
      await shoot(page, `${profile.tag}-01-browse-thumbnail`);

      // ── 2. A: the SAME frame recomposes into ACTION FOCUS. ──────────────
      await key(page, 'Enter', 900);
      await expect(page.locator('.con-cardactions__stagewrap .con-composer--stage')).toHaveCount(1);
      // No second frame chrome, no private backdrop — the browser's frame IS
      // the stage's chrome (never a web-modal feeling).
      expect(await page.locator('.con-composer__backdrop').count()).toBe(0);
      await expect(page.locator('.con-cardactions__browse--parked')).toHaveCount(1);
      // The header is the operation breadcrumb now.
      await expect(page.locator('.con-cardactions__kicker-step')).toHaveCount(1);
      expect((await page.locator('.con-cardactions__title').innerText()).toUpperCase()).toContain('ПОИСКИ ЖИЗНИ');
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
      await expect(page.locator('.con-cardactions__kicker-step')).toHaveCount(0);
      await expect(thumb).toHaveCount(1);
      await shoot(page, `${profile.tag}-03-back-to-browse`);

      // ── 4. X in focus: the dossier opens over the PRESERVED stage. ──────
      await key(page, 'Enter', 900);
      await expect(page.locator('.con-composer--stage')).toHaveCount(1);
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
