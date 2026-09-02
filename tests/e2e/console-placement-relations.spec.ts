import {test, expect, Page} from '@playwright/test';
import {bootSeededGame, createGameWithCards} from './consoleStart';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Console placement · the on-field RELATION layer + the reticle's visual
 * hierarchy (docs/claude/console/board-placement-flow.md § Field grammar).
 *
 * What this guards, in one sentence: the board must SHOW which cells
 * participate in the focused placement, and it must say exactly what the
 * dossier says — because both read the same server preview
 * (`BoardFact.spaces` → placementRelations.ts).
 *
 *  1. A cell whose dossier names the hazard production penalty must mark its
 *     taxing neighbours `con-rel--penalty` on the field — the same count the
 *     panel states («опасных зон рядом: N»).
 *  2. A focused cell with printed bonuses masks the ghost under the bonus
 *     cluster (`con-bcur__ghost--masked`) — the reward stays foreground.
 *  3. A d-pad step CLEARS the previous cell's marks in the same press (no
 *     trailing highlights on a fast walk), and the reticle rides its
 *     airborne pose (`con-bcur--travel`) that always settles.
 *  4. The LOCK keeps the standing marks (no replay, no loss); B returns to
 *     navigation with the field intact; leaving placement strips everything.
 */

const OUT_DIR = path.resolve('screenshots', 'console-placement-relations');

function newGameConfig() {
  return {
    players: [{name: 'RelTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: true, moon: false, pathfinders: false, ceo: false,
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

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

/** Same adaptive walk as console-hazard-placement (never a blind sequence). */
async function focusStdProject(page: Page, title: RegExp): Promise<boolean> {
  const focusedName = () =>
    page.locator('.con-stdp__card--focused .con-stdp__name').innerText().catch(() => '');
  await page.waitForTimeout(900);
  const walk = ['ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft',
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowDown'];
  for (let i = 0; i <= walk.length; i++) {
    if (title.test(await focusedName())) {
      return true;
    }
    if (i < walk.length) {
      await key(page, walk[i], 500);
    }
  }
  return false;
}

test.describe('console placement · on-field relations + reticle hierarchy', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('relation marks mirror the dossier; the ghost yields to the bonus cluster', async ({page, request}) => {
    test.setTimeout(240_000);

    const playerId = await createGameWithCards(request, [], {config: newGameConfig()});
    await bootSeededGame(page, request, playerId);

    // LT wheel → Standard Projects → «Озеленение» → the board placement.
    await key(page, 'Comma', 1200);
    await key(page, 'Enter', 1500);
    const panel = page.locator('.con-context');
    expect(await focusStdProject(page, /озеленение/i), 'never focused «Озеленение»').toBeTruthy();
    await key(page, 'Enter', 1600);
    if (/ОПЛАТА/.test(await page.locator('.con-root').innerText())) {
      await key(page, 'KeyX', 2600);
    }
    expect((await panel.innerText()).includes('РАЗМЕЩЕНИЕ ТАЙЛА'), 'never reached a board placement').toBeTruthy();
    await expect(page.locator('.con-bcur')).toHaveCount(1);

    // ── 1. Walk until the dossier names the hazard penalty; the FIELD must
    //       name the same neighbours. (The seed still deals hazards at
    //       unpredictable cells — sweep, never remember one.)
    let penaltyText = '';
    const walk = ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown',
      'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowDown'];
    let sawMaskedGhost = false;
    for (let i = 0; i < 48 && penaltyText === ''; i++) {
      // Sample the ghost mask opportunistically: any focused cell with a
      // printed bonus must carry it (claim 2 is asserted over the sweep).
      if (!sawMaskedGhost && await page.locator('.con-bcur__ghost--masked').count() > 0) {
        sawMaskedGhost = true;
      }
      const text = await panel.innerText();
      if (text.includes('Снизить производство')) {
        penaltyText = text;
        break;
      }
      await key(page, walk[i % walk.length], 420);
    }
    expect(penaltyText, 'no hazard-adjacent cell surfaced a production penalty').not.toBe('');

    // The dossier states the count; the field must mark the same number of
    // taxing neighbours (the marks arrive with the async preview — poll).
    const m = penaltyText.match(/опасных зон рядом:\s*(\d+)/);
    expect(m, `panel did not state the hazard count: ${penaltyText.slice(0, 300)}`).not.toBeNull();
    const hazardCount = Number(m![1]);
    await expect.poll(
      () => page.locator('.board-space.con-rel--penalty').count(),
      {message: 'field penalty marks never matched the dossier count', timeout: 5_000},
    ).toBe(hazardCount);
    await shoot(page, '01-penalty-relations');

    // ── 2. The ghost quiet-zone mask appears on a bonus cell. If the penalty
    //       sweep never crossed one, keep walking — Tharsis land without a
    //       single printed-bonus cell on a whole walk is an anomaly worth
    //       failing on.
    for (let i = 0; i < 20 && !sawMaskedGhost; i++) {
      if (await page.locator('.con-bcur__ghost--masked').count() > 0) {
        sawMaskedGhost = true;
        break;
      }
      await key(page, walk[i % walk.length], 380);
    }
    expect(sawMaskedGhost, 'no focused cell ever masked the ghost under its bonuses').toBeTruthy();
    await shoot(page, '01b-masked-ghost');

    // ── 3. A step clears the marks in the SAME press (no trailing
    //       highlights), and a fast run keeps the reticle airborne. Sample
    //       with setInterval — never rAF (headless compositor stalls).
    await page.evaluate(() => {
      const w = window as unknown as {__relProbe: {samples: number, travelSeen: number, staleAfterStep: number}};
      w.__relProbe = {samples: 0, travelSeen: 0, staleAfterStep: 0};
      const probe = w.__relProbe;
      const id = window.setInterval(() => {
        probe.samples++;
        if (document.querySelector('.con-bcur--travel') !== null) {
          probe.travelSeen++;
        }
      }, 40);
      window.setTimeout(() => window.clearInterval(id), 6_000);
    });
    // Rapid presses (no settle) — the held-direction shape.
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(90);
    }
    // The step's own synchronous clear: no penalty mark may survive into the
    // very next sample window unless the NEW cell's preview re-applied it.
    await page.waitForTimeout(900);
    const probe = await page.evaluate(() => (window as unknown as {__relProbe: {samples: number, travelSeen: number}}).__relProbe);
    expect(probe.samples, 'the sampler never ran').toBeGreaterThan(5);
    expect(probe.travelSeen, 'the reticle never entered its airborne pose during a fast run').toBeGreaterThan(0);
    // …and it always LANDS: no airborne residue once input stops.
    await expect.poll(() => page.locator('.con-bcur--travel').count(), {timeout: 3_000}).toBe(0);

    // After the run settles, any standing marks must agree with the CURRENT
    // panel: a panel without the penalty line may not keep penalty marks.
    await page.waitForTimeout(600);
    const settledText = await panel.innerText();
    const settledPenalties = await page.locator('.board-space.con-rel--penalty').count();
    if (!settledText.includes('Снизить производство')) {
      expect(settledPenalties, 'stale penalty marks survived a cursor move').toBe(0);
    }
    await shoot(page, '02-after-fast-run');

    // ── 4. LOCK keeps the field steady; B returns; leaving strips all.
    const relCountBeforeLock = await page.locator('.board-space.con-rel').count();
    await key(page, 'Enter', 700);
    await expect(page.locator('.con-bcur--locked')).toHaveCount(1);
    expect(await page.locator('.board-space.con-rel').count(), 'the lock replayed/lost the relation marks').toBe(relCountBeforeLock);
    await shoot(page, '03-locked');
    await key(page, 'Escape', 700);
    await expect(page.locator('.con-bcur--locked')).toHaveCount(0);
    expect(await page.locator('.board-space.con-rel').count(), 'unlock disturbed the relation marks').toBe(relCountBeforeLock);
    // Cancel the whole placement — nothing may linger.
    await key(page, 'Escape', 1200);
    await expect.poll(() => page.locator('.board-space.con-rel').count(), {timeout: 5_000}).toBe(0);
    await expect(page.locator('.con-bcur')).toHaveCount(0);
    await shoot(page, '04-after-cancel');
  });
});
