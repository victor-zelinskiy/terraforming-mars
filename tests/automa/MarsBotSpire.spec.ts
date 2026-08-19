import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {TileType} from '../../src/common/TileType';
import {MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaResearch} from '../../src/server/automa/AutomaResearch';
import {MarsBotDraftResolver} from '../../src/server/automa/corps/MarsBotDraftResolver';
import {MarsBotBoard} from '../../src/server/automa/MarsBotBoard';
import {THARSIS_MARSBOT_BOARD} from '../../src/server/automa/boards/TharsisMarsBot';
import {cardsFromJSON} from '../../src/server/createCard';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

const PRIORITY = {type: 'mostTags'} as const;

function resolver(shuffler: (items: Array<unknown>) => void = () => {}): MarsBotDraftResolver {
  return new MarsBotDraftResolver(new MarsBotBoard(THARSIS_MARSBOT_BOARD), shuffler as never);
}

function cards(...names: Array<CardName>) {
  return cardsFromJSON(names);
}

function botTakesOneTurn(game: IGame, human: TestPlayer) {
  human.popWaitingFor();
  game.playerIsFinishedTakingActions();
}

describe('MarsBot Spire (C45)', () => {
  describe('the printed tag count (the "number of tags" of RB-B\'s Spire special case)', () => {
    it('counts the printed top-right row: plain, multi, event and wild tags', () => {
      const count = (name: CardName) => MarsBotDraftResolver.printedTagCount(cards(name)[0]);
      expect(count(CardName.LAKE_MARINERIS)).eq(0); // No tags at all.
      expect(count(CardName.CARBONATE_PROCESSING)).eq(1); // Building.
      expect(count(CardName.RESEARCH)).eq(2); // Science ×2 (duplicates count).
      expect(count(CardName.OLYMPUS_CONFERENCE)).eq(3); // Science, Earth, Building.
      // The event tag is PRINTED on every event card (appended last by the
      // fork's canonical printed row) — Asteroid reads Space + Event = 2.
      expect(count(CardName.ASTEROID)).eq(2);
      // The wild tag is a printed icon the bot genuinely resolves (it advances
      // the least-advanced track) — it counts here. RB-B's wildcard exclusion
      // is scoped to matching TAG-chain priorities, not to Spire's count.
      expect(count(CardName.RESEARCH_COORDINATION)).eq(1);
    });
  });

  describe('draft pick — "Most tags" (RB-B p.2 Special Cases)', () => {
    it('picks the card with the highest printed tag count', () => {
      const hand = cards(CardName.CARBONATE_PROCESSING, CardName.OLYMPUS_CONFERENCE, CardName.RESEARCH);
      const {card, tiedCount} = resolver().pickCard(hand, PRIORITY);
      expect(card.name).eq(CardName.OLYMPUS_CONFERENCE);
      expect(tiedCount).eq(1);
    });

    it('a 0-tag hand is one big tie — the seeded shuffle picks', () => {
      const hand = cards(CardName.LAKE_MARINERIS, CardName.LAKE_MARINERIS);
      const {tiedCount} = resolver().pickCard(hand, PRIORITY);
      expect(tiedCount).eq(2);
    });

    it('equal counts tie and resolve via the injected (seeded) shuffle', () => {
      // Research (2) vs Space Elevator (2) vs Algae (1).
      const hand = cards(CardName.RESEARCH, CardName.SPACE_ELEVATOR, CardName.ALGAE);
      expect(resolver().pickCard(hand, PRIORITY).card.name).eq(CardName.RESEARCH);
      expect(resolver((items) => items.reverse()).pickCard(hand, PRIORITY).card.name).eq(CardName.SPACE_ELEVATOR);
    });
  });

  describe('draft discard — saves the card(s) with the most tags', () => {
    it('discards one of the lesser cards; every max-tag card is protected', () => {
      // Olympus (3) protected; one of Research(2)/Algae(1)/Lake Marineris(0) leaves.
      const drafted = cards(CardName.OLYMPUS_CONFERENCE, CardName.RESEARCH, CardName.ALGAE, CardName.LAKE_MARINERIS);
      const result = resolver().discardAfterDraft(drafted, PRIORITY);
      expect(result.discarded).has.length(1);
      expect(result.discarded[0].name).not.eq(CardName.OLYMPUS_CONFERENCE);
      expect(result.kept.map((c) => c.name)).contains(CardName.OLYMPUS_CONFERENCE);
    });

    it('several tied max-tag cards are ALL protected', () => {
      // Research (2) + Space Elevator (2) protected; Algae (1) or Bushes (1) leaves.
      const drafted = cards(CardName.RESEARCH, CardName.SPACE_ELEVATOR, CardName.ALGAE, CardName.BUSHES);
      const result = resolver().discardAfterDraft(drafted, PRIORITY);
      expect(result.discarded).has.length(1);
      expect([CardName.ALGAE, CardName.BUSHES]).contains(result.discarded[0].name);
    });

    it('all four with the same count → nothing is discarded; the deck may reach 5', () => {
      const [game, human] = testAutomaGame({corporation: MarsBotCorpId.C45_SPIRE}, '-sp5');
      game.playerIsFinishedWithResearchPhase(human);
      // Algae / Bushes / Carbonate Processing / Acquired Company — 1 tag each.
      const drafted = cards(CardName.ALGAE, CardName.BUSHES, CardName.CARBONATE_PROCESSING, CardName.ACQUIRED_COMPANY);
      AutomaResearch.finishDraftedActionDeck(game, drafted);
      const automa = game.automa!;
      expect(automa.actionDeck.filter((c) => c.kind === 'project')).has.length(4);
      expect(automa.actionDeck).has.length(5);
      expect(automa.corpStats['draftNoDiscardRounds']).eq(1);
      expect(automa.corpStats['fiveCardDecks']).eq(1);
    });
  });

  describe('effect — "When resolving a card with 2 or more tags, place a science resource on this card"', () => {
    let game: IGame;
    let human: TestPlayer;

    beforeEach(() => {
      [game, human] = testAutomaGame({corporation: MarsBotCorpId.C45_SPIRE}, '-speff');
      game.playerIsFinishedWithResearchPhase(human);
    });

    it('a 2-tag card adds a science resource (an event card counts its event tag)', () => {
      game.automa!.actionDeck = [{kind: 'project', name: CardName.ASTEROID}]; // Space + Event.
      botTakesOneTurn(game, human);
      expect(game.automa!.corpResources).eq(1);
      expect(game.automa!.corpStats['scienceAdded']).eq(1);
      expect(game.automa!.corpStats['multiTagCards']).eq(1);
    });

    it('a 1-tag card adds nothing', () => {
      game.automa!.actionDeck = [{kind: 'project', name: CardName.ALGAE}];
      botTakesOneTurn(game, human);
      expect(game.automa!.corpResources).eq(0);
    });

    it('the science survives a Failed Action (a tagless card never triggers, a maxed track still does)', () => {
      const automa = game.automa!;
      // Max every track: Olympus Conference (3 tags) fails each resolution,
      // the corp effect still fires — "when RESOLVING".
      for (const track of automa.board.tracks) {
        track.position = track.maxPosition;
      }
      automa.actionDeck = [{kind: 'project', name: CardName.OLYMPUS_CONFERENCE}];
      botTakesOneTurn(game, human);
      expect(automa.corpResources).eq(1);
    });
  });

  describe('before action phase — 10+ science → a city + 1 TR', () => {
    it('below 10: nothing happens', () => {
      const [game, human] = testAutomaGame({corporation: MarsBotCorpId.C45_SPIRE}, '-spbap1');
      game.playerIsFinishedWithResearchPhase(human);
      game.automa!.corpResources = 9;
      advanceToNextActionPhase(game, human);
      expect(game.automa!.corpResources).eq(9);
      expect(game.automa!.corpStats['citiesPlaced']).is.undefined;
    });

    it('at 10: removes exactly 10, places a city, gains 1 TR', () => {
      const [game, human, bot] = testAutomaGame({corporation: MarsBotCorpId.C45_SPIRE}, '-spbap2');
      game.playerIsFinishedWithResearchPhase(human);
      const automa = game.automa!;
      automa.corpResources = 11;
      const citiesBefore = botCities(game, bot);
      const trBefore = bot.terraformRating;
      advanceToNextActionPhase(game, human);
      expect(automa.corpResources).eq(1); // 11 − 10.
      expect(botCities(game, bot)).eq(citiesBefore + 1);
      expect(bot.terraformRating).eq(trBefore + 1);
      expect(automa.corpStats['scienceSpent']).eq(10);
      expect(automa.corpStats['citiesPlaced']).eq(1);
      expect(automa.corpStats['trGained']).eq(1);
    });

    it('save/load between generations keeps the science pile', () => {
      const [game, human] = testAutomaGame({corporation: MarsBotCorpId.C45_SPIRE}, '-spser');
      game.playerIsFinishedWithResearchPhase(human);
      game.automa!.corpResources = 6;
      const restored = Game.deserialize(structuredClone(game.serialize()));
      expect(restored.automa!.corpResources).eq(6);
      expect(restored.automa!.corporation).eq(MarsBotCorpId.C45_SPIRE);
    });
  });

  describe('no Prelude 2 leak', () => {
    it('the human corporation deck of a bot game never contains Spire', () => {
      const [game] = testAutomaGame({corporation: MarsBotCorpId.C45_SPIRE}, '-spleak');
      expect(game.corporationDeck.drawPile.map((c) => c.name)).not.contains(CardName.SPIRE);
      expect(game.gameOptions.prelude2Expansion).is.false;
    });
  });
});

function botCities(game: IGame, bot: IPlayer): number {
  return game.board.spaces.filter((s) => s.tile?.tileType === TileType.CITY && s.player?.id === bot.id).length;
}

/** Run the current generation out (empty bot deck, both pass) into the next action phase. */
function advanceToNextActionPhase(game: IGame, human: TestPlayer) {
  const automa = game.automa!;
  automa.actionDeck = [];
  human.popWaitingFor();
  game.playerHasPassed(human);
  game.playerIsFinishedTakingActions(); // Bot passes too → production → gen 2 research.
  expect(game.generation).eq(2);
  // Empty the REBUILT deck too: if the bot moves first in generation 2, its
  // flip would add science of its own and pollute the BAP assertions.
  automa.actionDeck = [];
  // The human finishes the research draw → the research → action gate runs the BAP.
  human.popWaitingFor();
  game.playerIsFinishedWithResearchPhase(human);
}
