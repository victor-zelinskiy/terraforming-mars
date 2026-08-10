import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * START-SCENE polish verification — REALISTIC card counts (NOT testMode: the
 * memory rule is "never calibrate console fit on testMode", so this deals a
 * full 2-corp / 4-prelude / 10-project setup) across the 4 target display
 * profiles. Produces screenshots/start-scene/<preset>/ for the Preludes /
 * Projects / Summary review; a Playwright render is a SANITY check (no
 * overflow / scroll / broken layout, root-pinned rail, cards larger) — the couch
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

/** The live wizard step — the workspace breadcrumb's SUBJECT (lower-cased;
 *  '' while the deal cinematic still owns the frame). */
async function activeSubject(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.querySelector('.con-wshead__layer--deep .con-wshead__subject');
    return (el?.textContent ?? '').trim().toLowerCase();
  });
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

/** The flow is one header child on the fixed second tier. Its LEFT edge is the
 *  connector hand-off under the root marker on every profile; the active
 *  chapter remains expanded even when secondary chrome tightens. */
async function assertFlowGeometry(page: Page, preset: Preset): Promise<void> {
  const flow = await page.evaluate(() => {
    const head = document.querySelector('.con-start__wshead')?.getBoundingClientRect();
    const flowTierEl = document.querySelector<HTMLElement>('.con-start__wshead .con-wshead__flow');
    const flowTier = flowTierEl?.getBoundingClientRect();
    const rail = document.querySelector('.con-start__wshead .con-jrail')?.getBoundingClientRect();
    const mark = document.querySelector('.con-start__wshead .con-wshead__mark')?.getBoundingClientRect();
    const stem = document.querySelector('.con-start__wshead .con-wshead__flow-stem')?.getBoundingClientRect();
    const opacity = (selector: string) =>
      Number(getComputedStyle(document.querySelector(selector) as Element).opacity);
    const breadcrumbFits = Array.from(document.querySelectorAll<HTMLElement>(
      '.con-start__wshead .con-wshead__subject, .con-start__wshead .con-wshead__step',
    )).every((el) => el.scrollWidth <= el.clientWidth + 1);
    const flowLabelsFit = Array.from(document.querySelectorAll<HTMLElement>(
      '.con-jrail__phase--open .con-jrail__label',
    )).every((el) => el.scrollWidth <= el.clientWidth + 1);
    return {
      count: document.querySelectorAll('.con-start__wshead .con-jrail').length,
      connectorCount: document.querySelectorAll('.con-start__wshead .con-wshead__flow-connector').length,
      leftHandoffGap: flowTier === undefined || flowTierEl === null || rail === undefined ? -999 :
        Math.round(rail.left - flowTier.left - parseFloat(getComputedStyle(flowTierEl).paddingLeft)),
      rootAxisGap: mark === undefined || stem === undefined ? -999 :
        Math.round((mark.left + mark.width / 2) - (stem.left + stem.width / 2)),
      inside: head !== undefined && rail !== undefined &&
        rail.top >= head.top - 1 && rail.bottom <= head.bottom + 1,
      secondTier: flowTier !== undefined && rail !== undefined && mark !== undefined &&
        rail.top > mark.top + mark.height / 2 && flowTier.top >= mark.top,
      breadcrumbFits,
      flowLabelsFit,
      expandedOpacity: opacity('.con-jrail__view--expanded'),
      compactOpacity: opacity('.con-jrail__view--compact'),
    };
  });
  expect(flow.count, `${preset.id}: one flow instance`).toBe(1);
  expect(flow.connectorCount, `${preset.id}: one root-to-flow connector`).toBe(1);
  expect(Math.abs(flow.leftHandoffGap), `${preset.id}: stable left rail hand-off`).toBeLessThanOrEqual(2);
  expect(Math.abs(flow.rootAxisGap), `${preset.id}: connector follows the root diamond axis`).toBeLessThanOrEqual(2);
  expect(flow.inside, `${preset.id}: flow tier stays inside WorkspaceHeader`).toBeTruthy();
  expect(flow.secondTier, `${preset.id}: flow is below the breadcrumb row`).toBeTruthy();
  expect(flow.breadcrumbFits, `${preset.id}: flow never clips the local breadcrumb`).toBeTruthy();
  expect(flow.expandedOpacity, `${preset.id}: top-level active chapter stays expanded`).toBeGreaterThan(flow.compactOpacity);
  expect(flow.flowLabelsFit, `${preset.id}: expanded flow keeps every active stage named`).toBeTruthy();
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

      // Adaptive walk on the breadcrumb SUBJECT: A selects, RT (Period)
      // advances with the physical collect. Capture each screen.
      let shotPre = false;
      let shotProj = false;
      for (let round = 0; round < 26; round++) {
        if (await page.locator('.con-start__frame').count() === 0) {
          break;
        }
        const subject = await activeSubject(page);
        const onSummary = subject.includes('сводка') &&
          await page.locator('.con-start > .con-start__frame .con-start__summary').isVisible().catch(() => false);
        if (subject.includes('пролог') && !shotPre) {
          await page.waitForTimeout(1200);
          await assertFlowGeometry(page, preset);
          await shoot(page, preset, '01-preludes');
          await assertNoScroll(page, preset.id + ' preludes');
          shotPre = true;
          // pick two preludes then advance (RT — the collect flight)
          await key(page, 'Enter', 700);
          await key(page, 'ArrowRight', 400);
          await key(page, 'Enter', 700);
          await key(page, 'Period', 1600);
          continue;
        }
        if (subject.includes('проект') && !shotProj) {
          await page.waitForTimeout(1200);
          await assertFlowGeometry(page, preset);
          await shoot(page, preset, '02-projects');
          await assertNoScroll(page, preset.id + ' projects');
          shotProj = true;
          // buy a few projects then advance
          await key(page, 'Enter', 500);
          await key(page, 'ArrowRight', 300);
          await key(page, 'Enter', 500);
          await key(page, 'ArrowRight', 300);
          await key(page, 'Enter', 500);
          await key(page, 'Period', 1600);
          continue;
        }
        if (onSummary) {
          await page.waitForTimeout(1200);
          await assertFlowGeometry(page, preset);
          await shoot(page, preset, '03-summary');
          await assertNoScroll(page, preset.id + ' summary');
          break;
        }
        if (subject.includes('корпорац')) {
          // A = select the focused corporation, RT = advance with collect.
          await key(page, 'Enter', 700);
          await key(page, 'Period', 1600);
          continue;
        }
        // Mid-deal — a press skips the cinematic.
        await key(page, 'Enter', 900);
      }

      expect(shotPre, 'reached the preludes step').toBeTruthy();
      expect(shotProj, 'reached the projects step').toBeTruthy();
    });
  });
}
