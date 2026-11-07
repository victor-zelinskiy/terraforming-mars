import {test, expect, Page} from './consoleTest';
import {bootSeededGame, cinematicBeat, createGameWithCards, press, settle} from './consoleStart';

/**
 * A NO-OP PRESS IS NOT A WEDGE — the liveness arbiter from the PLAYER'S side (2026-10-31, the false «presses-no-effect»
 * on the pass-confirm panel: `console-workspace-band`'s three X presses on a panel whose verbs are A / B woke the
 * arbiter, ran its ladder and told the player «Экран завис» over a screen that was perfectly alive).
 *
 * The stand: a LIVE decision panel (the pass confirmation — «A ПАС · B ОТМЕНА» on the bar) under a hesitating player:
 * three presses of a button the panel does not bind (X), three flicks against a wall (←), then nothing for longer
 * than the arbiter's pressed grace. The product must do NOTHING: no `[liveness] stall` line (the harness's
 * `livenessGuard` turns one red), no «Экран завис» notice, the panel still standing — and the panel's own verb (B)
 * must still answer. A healthy screen a watchdog folds under the player is a freeze the watchdog made.
 *
 * Two profiles: the couch and the Deck (the pass confirm reads differently on each; the arbiter must not).
 */

const PROFILES = [
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
  {tag: 'deck', width: 1280, height: 800, query: '&consoleProfile=handheld'},
] as const;

function cfg() {
  return {
    players: [{name: 'NoopTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis', seed: 0.42, randomFirstPlayer: false,
    clonedGamedId: undefined, undoOption: false, showTimers: false, fastModeOption: false,
    showOtherPlayersVP: false, testMode: true, aresExtremeVariant: false,
    politicalAgendasExtension: 'Standard', solarPhaseOption: false,
    removeNegativeGlobalEventsOption: false, modularMA: false, draftVariant: false,
    initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization',
    includeFanMA: false, soloTR: false, customCorporationsList: [], bannedCards: [],
    includedCards: [], customColoniesList: [], customPreludes: [],
    requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    altVenusBoard: false, escapeVelocity: undefined, twoCorpsVariant: false,
    customCeos: [], startingCeos: 3, startingPreludes: 4,
  };
}

/** Back to the board home from whatever the walk left open (the start scene is minimised, never walked back from). */
async function toBoard(page: Page): Promise<void> {
  for (let i = 0; i < 6; i++) {
    if (await page.locator('.con-start__frame').count() > 0) {
      return;
    }
    if (await page.locator('.con-quick, .con-stdp, .con-ma, .con-cardactions, .con-composer, .con-sheet, .con-hand, .con-played, .con-journal, .con-confirm').count() === 0) {
      return;
    }
    await press(page, 'Escape', 400);
  }
}

/** The pass confirmation: LT wheel → down. A busy frame may drop a press; never press LT while the wheel is open. */
async function openPassConfirm(page: Page): Promise<boolean> {
  for (let tries = 0; tries < 4 && await page.locator('.con-confirm').count() === 0; tries++) {
    if (await page.locator('.con-quick').count() > 0) {
      await press(page, 'ArrowDown', 1200);
    } else {
      await press(page, 'Comma', 1100);
    }
  }
  return page.locator('.con-confirm').first().waitFor({state: 'visible', timeout: 4000}).then(() => true).catch(() => false);
}

/**
 * Every recovery the page logged — the arbiter's stall and the watchdog's expiry. Since 2026-11-07 a heal shows the
 * player NOTHING (the owner: «чтобы для пользователя выглядело как будто зависания нет»), so the console's own markers
 * are the only witness of a press read as a wedge.
 */
function watchRecoveries(page: Page): Array<string> {
  const seen: Array<string> = [];
  page.on('console', (m) => {
    const text = m.text();
    if (text.includes('[liveness] stall') || text.includes('[console-foreground-watchdog]')) {
      seen.push(text.slice(0, 300));
    }
  });
  return seen;
}

for (const profile of PROFILES) {
  test.describe(`liveness · a no-op press is not a wedge · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('three unbound X and three ← on the live pass-confirm panel wake nothing; B still answers', async ({page, request}) => {
      test.setTimeout(240_000);
      const recoveries = watchRecoveries(page);
      const playerId = await createGameWithCards(request, [], {config: cfg()});
      await bootSeededGame(page, request, playerId, {buy: 2, query: profile.query});
      await toBoard(page);
      expect(await page.locator('.con-board').count(), 'never reached the board home').toBeGreaterThan(0);
      expect(await openPassConfirm(page), 'the pass confirmation stands').toBe(true);
      // The panel's entry (its unfold, the bar relabelling) is progress to the arbiter: let it finish before the presses,
      // or the first X lands inside it and the count restarts (the TV reached the panel later than the Deck).
      await settle(page);
      expect(recoveries, 'a clean start — no recovery before the presses').toEqual([]);

      // THE HESITATING PLAYER, in two separate phases — each a different no-op, each followed by nothing: a button
      // the panel does not bind (X — exactly `console-workspace-band`'s three presses), then a flick against a wall
      // (←). Separate on purpose: a press that MOVES the focus is progress to the arbiter and would mask the other.
      for (const [code, what] of [['KeyX', 'an unbound button'], ['ArrowLeft', 'a flick against the wall']] as const) {
        for (let i = 0; i < 3; i++) {
          await press(page, code, 350);
        }
        await expect(page.locator('.con-confirm'), `the panel stands through ${what} ×3`).toBeVisible();
        // Longer than the arbiter's pressed grace (5 s) and its rung gap: if the presses were read as a wedge, the
        // ladder has run and logged its rung by now. A healthy screen logs NOTHING — which is why this is a beat,
        // not a wait on state: the state that must not appear has no witness but time.
        await cinematicBeat(page, 9_000, `the arbiter's pressed grace must pass with ${what} ×3 on record and nothing else moving`);
        expect(recoveries, `no recovery over a live panel after ${what} ×3`).toEqual([]);
        await expect(page.locator('.con-confirm'), `the panel still stands after ${what} ×3 — nothing folded it`).toBeVisible();
      }

      // THE PANEL'S OWN VERB still answers: B cancels the pass, the board home comes back.
      await press(page, 'Escape', 900);
      await expect(page.locator('.con-confirm'), 'B closed the confirmation').toHaveCount(0, {timeout: 8_000});
      expect(recoveries, 'still no recovery').toEqual([]);
    });
  });
}
