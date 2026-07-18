import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * START-SCENE polish verification — REALISTIC card counts (NOT testMode: the
 * memory rule is "never calibrate console fit on testMode", so this deals a
 * full 2-corp / 4-prelude / 10-project setup) across the 4 target display
 * profiles. Produces screenshots/start-scene/<preset>/ for the Preludes /
 * Projects / Summary review; a Playwright render is a SANITY check (no
 * overflow / scroll / broken layout, rail pinned, cards larger) — the couch
 * read is still the real TV.
 */

const OUT_ROOT = path.resolve('screenshots', 'start-scene');

type Preset = {id: string, viewport: {width: number, height: number}, dpr: number, q: string};

const PRESETS: ReadonlyArray<Preset> = [
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, dpr: 1, q: ''},
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, dpr: 1, q: '&consoleProfile=auto'},
  {id: 'small-720', viewport: {width: 1280, height: 720}, dpr: 1, q: ''},
  {id: 'deck-800', viewport: {width: 1280, height: 800}, dpr: 1, q: ''},
];

/** A realistic solo base+prelude game: 2 corps, 4 preludes, 10 project buy. */
function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: true, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'SetupTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions, board: 'tharsis', seed: 0.42, randomFirstPlayer: false, clonedGamedId: undefined,
    undoOption: false, showTimers: false, fastModeOption: false, showOtherPlayersVP: false,
    testMode: false, aresExtremeVariant: false, politicalAgendasExtension: 'Standard',
    solarPhaseOption: false, removeNegativeGlobalEventsOption: false, modularMA: false,
    draftVariant: false, initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization', includeFanMA: false,
    soloTR: false, customCorporationsList: [], bannedCards: [], includedCards: [], customColoniesList: [],
    customPreludes: [], requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false, altVenusBoard: false,
    escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [], startingCeos: 3, startingPreludes: 4,
  };
}

async function shoot(page: Page, preset: Preset, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 700): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

/** Which wizard step is live (by the active step chip's ordinal). */
async function activeStep(page: Page): Promise<number> {
  const chips = page.locator('.con-start__step');
  const n = await chips.count();
  for (let i = 0; i < n; i++) {
    const cls = await chips.nth(i).getAttribute('class') ?? '';
    if (cls.includes('con-start__step--active')) {
      return i;
    }
  }
  return -1;
}

/** No native scrollbar anywhere (console-native invariant). Non-fatal: logs
 *  so every screen is still captured for the visual review even on overflow. */
async function assertNoScroll(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const d = document.documentElement;
    // The wizard CARD body must NOT scroll internally (the cards fit); the
    // summary/ceremony body may (overflow-y:auto) — only check the card body.
    const cards = document.querySelector('.con-start__body--cards');
    const bodyScroll = cards !== null && cards.scrollHeight > cards.clientHeight + 1;
    return {
      x: d.scrollWidth > d.clientWidth + 1, y: d.scrollHeight > d.clientHeight + 1,
      bodyScroll, sw: d.scrollWidth, cw: d.clientWidth, sh: d.scrollHeight, ch: d.clientHeight,
    };
  });
  if (overflow.x || overflow.y || overflow.bodyScroll) {
    console.warn(`[overflow] ${label}: doc-x=${overflow.x} doc-y=${overflow.y} ` +
      `cardBody=${overflow.bodyScroll} (${overflow.sw}×${overflow.sh} vs ${overflow.cw}×${overflow.ch})`);
  } else {
    console.log(`[ok] ${label}: no document / card-body scroll`);
  }
}

for (const preset of PRESETS) {
  test.describe(`start-scene · ${preset.id}`, () => {
    test.use({viewport: preset.viewport, deviceScaleFactor: preset.dpr, screen: preset.viewport});

    test('preludes / projects / summary layout', async ({page, request}) => {
      test.setTimeout(preset.viewport.width >= 3840 ? 300_000 : 150_000);
      const created = await request.post('/api/creategame', {data: newGameConfig()});
      expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
      const model = await created.json() as {players: Array<{id: string}>};
      const id = model.players[0].id;

      await page.goto(`/player?id=${id}&console=1${preset.q}`);
      await page.waitForSelector('.con-start__frame', {timeout: 45_000});
      await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
      await page.waitForTimeout(4000); // deal cinematic + fit settle

      // Adaptive walk: A selects (single-pick corp advances), ArrowRight moves,
      // KeyE (RB) advances a completed multi-pick step. Capture each screen.
      let shotPre = false;
      let shotProj = false;
      for (let round = 0; round < 26; round++) {
        if (await page.locator('.con-start__frame').count() === 0) {
          break;
        }
        const step = await activeStep(page);
        const onSummary = await page.getByText('НАЧАТЬ ПАРТИЮ').count() > 0;
        // step chip labels: 0 corp, 1 preludes, 2 projects (base+prelude game).
        if (step === 1 && !shotPre) {
          await page.waitForTimeout(1200);
          await shoot(page, preset, '01-preludes');
          await assertNoScroll(page, preset.id + ' preludes');
          shotPre = true;
          // pick two preludes then advance
          await key(page, 'Enter', 700);
          await key(page, 'ArrowRight', 400);
          await key(page, 'Enter', 700);
          await key(page, 'KeyE', 1300);
          continue;
        }
        if (step === 2 && !shotProj) {
          await page.waitForTimeout(1200);
          await shoot(page, preset, '02-projects');
          await assertNoScroll(page, preset.id + ' projects');
          shotProj = true;
          // buy a few projects then advance
          await key(page, 'Enter', 500);
          await key(page, 'ArrowRight', 300);
          await key(page, 'Enter', 500);
          await key(page, 'ArrowRight', 300);
          await key(page, 'Enter', 500);
          await key(page, 'KeyE', 1300);
          continue;
        }
        if (onSummary) {
          await page.waitForTimeout(1200);
          await shoot(page, preset, '03-summary');
          await assertNoScroll(page, preset.id + ' summary');
          break;
        }
        // Otherwise (corp step / mid-deal) — a press advances / skips.
        await key(page, 'Enter', 900);
      }

      expect(shotPre, 'reached the preludes step').toBeTruthy();
      expect(shotProj, 'reached the projects step').toBeTruthy();
    });
  });
}
