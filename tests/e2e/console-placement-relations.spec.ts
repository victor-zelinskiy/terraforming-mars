import {test, expect, Page} from './consoleTest';
import {bootSeededGame, createGameWithCards, focusedSpaceId, press, settle} from './consoleStart';
import {readSettled} from './settledRead';
import {armWitness} from './witness';
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
  await press(page, code, settleMs);
}

/** Same adaptive walk as console-hazard-placement (never a blind sequence). */
async function focusStdProject(page: Page, title: RegExp): Promise<boolean> {
  const focusedName = () =>
    page.locator('.con-stdp__card--focused .con-stdp__name').innerText().catch(() => '');
  // The sheet is open and at rest — a focused card stands, its entrance is over — before the walk reads it.
  await expect(page.locator('.con-stdp__card--focused .con-stdp__name'), 'the standard projects sheet focused a card')
    .toBeVisible({timeout: 15_000});
  await settle(page);
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
    await expect.poll(async () => (await panel.innerText().catch(() => '')).includes('РАЗМЕЩЕНИЕ ТАЙЛА'),
      {message: 'never reached a board placement', timeout: 15_000}).toBe(true);
    await expect(page.locator('.con-bcur')).toHaveCount(1);

    // The ghost mask over the whole sweep, RECORDED (FLAKE ZERO — `armWitness`, armed before the first step): any
    // focused cell with a printed bonus must carry it, and claim 2 is «it ever did» — asked of the product's own
    // writes, never of a read that happened to land between two steps.
    const masked = await armWitness(page, 'rel-ghost-masked', () => document.querySelector('.con-bcur__ghost--masked') !== null);
    const sawMaskedGhost = () => masked.ever((on) => on);

    // ── 1. Walk until the dossier names the hazard penalty; the FIELD must
    //       name the same neighbours. (The seed still deals hazards at
    //       unpredictable cells — sweep, never remember one.)
    let penaltyText = '';
    const walk = ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown',
      'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowDown'];
    for (let i = 0; i < 48 && penaltyText === ''; i++) {
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
    for (let i = 0; i < 20 && !await sawMaskedGhost(); i++) {
      await key(page, walk[i % walk.length], 380);
    }
    expect(await sawMaskedGhost(), 'no focused cell ever masked the ghost under its bonuses').toBeTruthy();
    await masked.stop();
    await shoot(page, '01b-masked-ghost');

    // ── 3. A step clears the marks in the SAME press (no trailing
    //       highlights), and a fast run keeps the reticle airborne. The
    //       airborne pose is RECORDED from before the run (FLAKE ZERO —
    //       `armWitness`: the product's own writes, never a sampler that
    //       sleeps through a 120 ms travel on a starved renderer).
    const travel = await armWitness(page, 'rel-reticle-travel', () => document.querySelector('.con-bcur--travel') !== null);
    // Rapid presses (no settle) — the held-direction shape.
    //
    // ⚠️ THE DIRECTION HAS TO ACTUALLY MOVE THE CURSOR. The placement ring
    // CLAMPS, and the masked-ghost sweep above walks up to twenty steps, so it
    // routinely parks against an edge: four more ArrowLefts then moved nothing,
    // the reticle never travelled, and the spec reported «the reticle never
    // entered its airborne pose» about a reticle that had nowhere to go. Turn
    // around when a press does not move the cursor, and assert the run really
    // happened, so the claim can never pass vacuously either.
    //
    // Each raw press is judged by ITS effect — the cursor left the cell it stood on — given its whole window (a
    // bounded poll that returns the moment the cell changes, so the run keeps its held-direction pace); a press that
    // moved nothing within it is the wall, and the run turns around.
    let moves = 0;
    let dir: 'ArrowLeft' | 'ArrowRight' = 'ArrowLeft';
    for (let i = 0; i < 8 && moves < 4; i++) {
      const at = await focusedSpaceId(page);
      await page.keyboard.press(dir);
      const moved = await expect.poll(() => focusedSpaceId(page), {timeout: 1_500}).not.toBe(at).then(() => true, () => false);
      if (moved) {
        moves++;
      } else {
        dir = dir === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
      }
    }
    expect(moves, 'the fast run never moved the cursor at all').toBeGreaterThan(0);
    // The record's own liveness (it caught at least the state it was armed on), then the claim: the reticle rode its
    // airborne pose at some point of the run — waited for as a STATE (returns at once when it already happened).
    expect((await travel.samples()).length, 'the recorder never ran').toBeGreaterThan(0);
    await travel.waitFor((up) => up, {timeoutMs: 5_000, message: 'the reticle never entered its airborne pose during a fast run'});
    await travel.stop();
    // …and it always LANDS: no airborne residue once input stops.
    await expect.poll(() => page.locator('.con-bcur--travel').count(), {timeout: 3_000}).toBe(0);

    // After the run settles, any standing marks must agree with the CURRENT
    // panel: a panel without the penalty line may not keep penalty marks.
    // (The step's own synchronous clear: no penalty mark may survive the run
    // unless the NEW cell's preview re-applied it.) Read at REST — the panel
    // and the field the same twice, a frame apart, after the console settles.
    const atRest = await readSettled(page, async () => ({
      penaltyLine: (await panel.innerText().catch(() => '')).includes('Снизить производство'),
      penalties: await page.locator('.board-space.con-rel--penalty').count(),
    }), {message: 'the panel and the field after the fast run'});
    if (!atRest.penaltyLine) {
      expect(atRest.penalties, 'stale penalty marks survived a cursor move').toBe(0);
    }
    await shoot(page, '02-after-fast-run');

    // ── 4. LOCK keeps the field steady; B returns; leaving strips all.
    const relCountBeforeLock = await readSettled(page, () => page.locator('.board-space.con-rel').count(),
      {message: 'the relation marks before the lock'});
    await key(page, 'Enter', 700);
    await expect(page.locator('.con-bcur--locked')).toHaveCount(1);
    await expect.poll(() => page.locator('.board-space.con-rel').count(), {message: 'the lock replayed/lost the relation marks'}).toBe(relCountBeforeLock);
    await shoot(page, '03-locked');
    await key(page, 'Escape', 700);
    await expect(page.locator('.con-bcur--locked')).toHaveCount(0);
    await expect.poll(() => page.locator('.board-space.con-rel').count(), {message: 'unlock disturbed the relation marks'}).toBe(relCountBeforeLock);
    // Cancel the whole placement — nothing may linger.
    await key(page, 'Escape', 1200);
    await expect.poll(() => page.locator('.board-space.con-rel').count(), {timeout: 5_000}).toBe(0);
    await expect(page.locator('.con-bcur')).toHaveCount(0);
    await shoot(page, '04-after-cancel');
  });
});
