import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Phase} from '../../src/common/Phase';
import {IGame} from '../../src/server/IGame';
import {CardManifest} from '../../src/server/cards/ModuleManifest';
import {PRELUDE2_CARD_MANIFEST} from '../../src/server/cards/prelude2/Prelude2CardManifest';
import {automaConflicts} from '../../src/common/automa/automaCompatibility';
import {MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

/**
 * PRELUDE 2 WITH MARSBOT — the full inclusion (2026-11-05). The option was refused on a bot table
 * (`automaCompatibility` — «Prelude 2 (per the official rules, and out of POC scope)»); every one of its 54 cards
 * was adapted against the bot as one more seat («the bot is just another player»: each card's spec carries its
 * MarsBot block), and the official rules play the set with the Automa (only Recession leaves the deck — the fork
 * KEEPS it, a house rule: `docs/claude/marsbot-home-rules.md`). Pinned here: the table is created, the decks carry
 * the set, the bot plays its cards for several generations with no exception and no illegal state, and its
 * corporation is never the twin of a human's Prelude 2 corporation.
 */

const PROJECTS: ReadonlyArray<CardName> = CardManifest.keys(PRELUDE2_CARD_MANIFEST.projectCards);
const PRELUDES: ReadonlyArray<CardName> = CardManifest.keys(PRELUDE2_CARD_MANIFEST.preludeCards);
const OPTIONS = {prelude2Expansion: true, preludeExtension: true, venusNextExtension: true, coloniesExtension: true};

/** Hand the generation to the bot: the human passes, the bot plays its deck out, the production runs, research opens. */
function botGeneration(game: IGame, human: TestPlayer): void {
  human.popWaitingFor();
  game.playerHasPassed(human);
  game.playerIsFinishedTakingActions();
  runAllActions(game);
  human.popWaitingFor();
  game.playerIsFinishedWithResearchPhase(human);
  runAllActions(game);
}

describe('Prelude 2 with MarsBot (the full inclusion)', () => {
  it('is no conflict of the matrix', () => {
    expect(automaConflicts({
      boardName: 'tharsis', turmoil: false, turmoilRedux: false, prelude2: true, community: false, moon: false, pathfinders: false,
      ceo: false, starwars: false, underworld: false, randomMA: false, soloTR: false, twoCorpsVariant: false, escapeVelocity: false,
      solarPhaseOption: false, requiresVenusTrackCompletion: false, shuffleMapOption: false, customColonyList: false,
    } as Parameters<typeof automaConflicts>[0])).deep.eq([]);
  });

  it('a bot table is created with the option ON, and its decks carry the set — Recession included (the house rule)', () => {
    const [game] = testAutomaGame(OPTIONS, '-p2-deal');
    const projects = [...game.projectDeck.drawPile, ...game.projectDeck.discardPile].map((c) => c.name);
    const preludes = [...game.preludeDeck.drawPile, ...game.preludeDeck.discardPile, ...game.players.flatMap((p) => p.dealtPreludeCards)].map((c) => c.name);
    expect(projects.filter((name) => PROJECTS.includes(name)).length, 'Prelude 2 projects in the project deck').greaterThan(0);
    expect(preludes.filter((name) => PRELUDES.includes(name)).length, 'Prelude 2 preludes in the prelude deck').greaterThan(0);
    expect(preludes, 'Recession is NOT removed (the fork plays it against the bot)').to.include(CardName.RECESSION);
  });

  it('the bot plays Prelude 2 projects off its action deck for six generations — no exception, no illegal state', () => {
    const [game, human] = testAutomaGame(OPTIONS, '-p2-loop');
    const illegal: Array<string> = [];
    const warn = console.warn;
    console.warn = (...args: Array<unknown>) => {
      if (typeof args[0] === 'string' && args[0].startsWith('Illegal state')) {
        illegal.push(args[0]);
      }
    };
    try {
      game.playerIsFinishedWithResearchPhase(human);
      runAllActions(game);
      // The set's projects the bot can flip, in turn — each generation's deck takes four of them on top.
      const pool = PROJECTS.filter((name) => name !== CardName.WG_PROJECT);
      let next = 0;
      for (let generation = 1; generation <= 6 && game.phase !== Phase.END; generation++) {
        const automa = game.automa!;
        const stacked = pool.slice(next, next + 4).map((name) => ({kind: 'project' as const, name}));
        next = (next + 4) % pool.length;
        automa.actionDeck = [...stacked, ...automa.actionDeck];
        botGeneration(game, human);
      }
    } finally {
      console.warn = warn;
    }
    expect(illegal, 'no illegal state').deep.eq([]);
    expect(game.generation, 'six generations played').greaterThan(6);
    expect(game.automa!.playedPile.filter((name) => PROJECTS.includes(name as CardName)).length, 'the bot played Prelude 2 projects').greaterThan(0);
  });

  it('a human\'s Prelude 2 corporation keeps the bot off its twin — every one of the five', () => {
    const twins: Array<[CardName, MarsBotCorpId]> = [
      [CardName.ECOTEC, MarsBotCorpId.C40_ECOTEC],
      [CardName.NIRGAL_ENTERPRISES, MarsBotCorpId.C42_NIRGAL_ENTERPRISES],
      [CardName.PALLADIN_SHIPPING, MarsBotCorpId.C43_PALLADIN_SHIPPING],
      [CardName.SAGITTA_FRONTIER_SERVICES, MarsBotCorpId.C44_SAGITTA_FRONTIER_SERVICES],
      [CardName.SPIRE, MarsBotCorpId.C45_SPIRE],
    ];
    for (const [human, twin] of twins) {
      expect(marsBotCorpInfo(twin).original, twin).eq(human);
    }
  });
});
