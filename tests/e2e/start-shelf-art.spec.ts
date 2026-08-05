import {test, expect} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  fillPicks, pickCards, playQueueCard, playQueueUntil, press, queueCards, submitSummary,
  waitQueueIdle, walkToSummary,
} from './consoleStart';

/**
 * THE START SHELF KEEPS THE ARTS.
 *
 * The full tableau crops a COVERED card to its title band (`peek`) — with a
 * pile dozens deep their arts would be pure cost. The Game Start deployment
 * shelf holds a handful of cards, so the crop buys nothing there and costs
 * the card's own picture: a covered card reads as a blank sliver. The opt-out
 * is a FLAG (`ConsolePlayedCardLite.keepArt`) and it is set ONLY on this
 * shelf — this pins that it is really in effect at the real surface.
 */

const OUT_DIR = path.resolve('screenshots', 'start-shelf');

function newGameConfig() {
  return {
    players: [{name: 'ShelfProbe', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
      prelude: true, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis', seed: 0.42, randomFirstPlayer: false, clonedGamedId: undefined,
    undoOption: false, showTimers: false, fastModeOption: false, showOtherPlayersVP: false,
    testMode: false, aresExtremeVariant: false, politicalAgendasExtension: 'Standard',
    solarPhaseOption: false, removeNegativeGlobalEventsOption: false, modularMA: false,
    draftVariant: false, initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization', includeFanMA: false,
    soloTR: false, customCorporationsList: [], bannedCards: [], includedCards: [], customColoniesList: [],
    // TWO cards of the SAME family — that is what produces a covered strip.
    customPreludes: ['Metals Company', 'Mining Operations', 'Donation', 'Loan'],
    requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false, altVenusBoard: false,
    escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [], startingCeos: 3, startingPreludes: 4,
    automa: {difficulty: 'normal'},
  };
}

test.describe('start shelf · covered cards keep their art', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('a card covered on the start shelf still shows its picture', async ({page, request}) => {
    test.setTimeout(300_000);
    fs.mkdirSync(OUT_DIR, {recursive: true});

    const created = await request.post('/api/creategame', {data: newGameConfig()});
    expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
    const model = await created.json() as {players: Array<{id: string}>};
    await page.goto(`/player?id=${model.players[0].id}&console=1`);
    await page.waitForSelector('.con-start__frame', {timeout: 45_000});
    await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});

    await walkToSummary(page, {
      onStep: async (p, kind) => {
        if (kind === 'corporation') {
          await press(p, 'Enter', 600);
        } else if (kind === 'prelude') {
          // Two PRELUDE-type cards → one family, so the older one ends up
          // covered under the newer: exactly the case under test.
          await pickCards(p, ['Metals Company', 'Mining Operations']);
          await fillPicks(p, 2);
        }
      },
    });
    await submitSummary(page);

    // A per-frame witness: the shelf only exists WHILE the deployment runs
    // (it releases the moment the start settles), so the covered card must
    // be caught live — a screenshot after the fact shows the board.
    await page.evaluate(() => {
      const w = window as unknown as {__shelf: {maxStrips: number, stripsSeen: number,
        stripsWithArt: number, tops: number, topsWithArt: number, frames: number}};
      const state = {maxStrips: 0, stripsSeen: 0, stripsWithArt: 0, tops: 0, topsWithArt: 0, frames: 0};
      w.__shelf = state;
      const tick = () => {
        state.frames++;
        const strips = Array.from(document.querySelectorAll('.con-splayed__strip'));
        if (strips.length > state.maxStrips) {
          state.maxStrips = strips.length;
        }
        state.stripsSeen += strips.length;
        state.stripsWithArt += strips.filter((s) => s.querySelector('.pcard__art') !== null).length;
        const tops = Array.from(document.querySelectorAll('.con-splayed__top .con-splayed__face'));
        state.tops += tops.length;
        state.topsWithArt += tops.filter((t) => t.querySelector('.pcard__art') !== null).length;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    // Play the whole start queue — the two preludes stack in one family.
    for (let i = 0; i < 6; i++) {
      await waitQueueIdle(page);
      const queue = await queueCards(page);
      if (queue.length === 0) {
        break;
      }
      await playQueueUntil(page, queue[0]);
      await playQueueCard(page, queue[0]);
    }
    await page.waitForTimeout(2500);
    await page.screenshot({path: path.join(OUT_DIR, 'shelf.png')});

    const shelf = await page.evaluate(() => (window as unknown as {
      __shelf: {maxStrips: number, stripsSeen: number, stripsWithArt: number,
        tops: number, topsWithArt: number, frames: number}}).__shelf);
    console.log('[shelf]', JSON.stringify(shelf));
    expect(shelf.frames, 'the witness ran').toBeGreaterThan(30);
    expect(shelf.maxStrips, 'the run produced a covered card (two cards in one family)').toBeGreaterThan(0);
    // EVERY frame a covered card was on screen, it carried its art viewport.
    expect(shelf.stripsWithArt, 'a COVERED card on the start shelf keeps its art')
      .toBe(shelf.stripsSeen);
    expect(shelf.topsWithArt, 'the open top cards keep their art too').toBe(shelf.tops);
  });
});
