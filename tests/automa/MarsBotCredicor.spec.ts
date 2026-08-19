import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {BonusCardId, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {MarsBotDraftResolver} from '../../src/server/automa/corps/MarsBotDraftResolver';
import {AutomaResearch} from '../../src/server/automa/AutomaResearch';
import {MarsBotBoard} from '../../src/server/automa/MarsBotBoard';
import {THARSIS_MARSBOT_BOARD, THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {cardsFromJSON} from '../../src/server/createCard';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

const PRIORITY = {type: 'mostExpensive'} as const;

function resolver(shuffler: (items: Array<unknown>) => void = () => {}): MarsBotDraftResolver {
  return new MarsBotDraftResolver(new MarsBotBoard(THARSIS_MARSBOT_BOARD), shuffler as never);
}

function cards(...names: Array<CardName>): Array<IProjectCard> {
  return cardsFromJSON(names);
}

function botTakesOneTurn(game: IGame, human: TestPlayer) {
  human.popWaitingFor();
  game.playerIsFinishedTakingActions();
}

describe('MarsBot Credicor (C01)', () => {
  describe('draft pick — "Most expensive" (RB-B p.2 Special Cases)', () => {
    it('picks the highest-cost card from a hand', () => {
      // Acquired Company 10 / Asteroid 14 / Big Asteroid 27.
      const hand = cards(CardName.ACQUIRED_COMPANY, CardName.BIG_ASTEROID, CardName.ASTEROID);
      const {card, tiedCount} = resolver().pickCard(hand, PRIORITY);
      expect(card.name).eq(CardName.BIG_ASTEROID);
      expect(tiedCount).eq(1);
    });

    it('equal max costs tie and resolve via the injected (seeded) shuffle', () => {
      // Acquired Company / Algae / Bushes all cost 10 — a full tie.
      const hand = cards(CardName.ACQUIRED_COMPANY, CardName.ALGAE, CardName.BUSHES);
      const keepOrder = resolver().pickCard(hand, PRIORITY);
      expect(keepOrder.tiedCount).eq(3);
      expect(keepOrder.card.name).eq(CardName.ACQUIRED_COMPANY); // Identity shuffle keeps order.
      const reversed = resolver((items) => items.reverse()).pickCard(hand, PRIORITY);
      expect(reversed.card.name).eq(CardName.BUSHES); // The shuffle genuinely decides.
    });
  });

  describe('draft discard — saves ALL of the most expensive drafted cards', () => {
    it('discards one of the non-max cards; every max-cost card is protected', () => {
      // 27 / 21 / 14 / 10 → Big Asteroid protected; one of the others leaves.
      const drafted = cards(CardName.BIG_ASTEROID, CardName.AI_CENTRAL, CardName.ASTEROID, CardName.ACQUIRED_COMPANY);
      const result = resolver().discardAfterDraft(drafted, PRIORITY);
      expect(result.discarded).has.length(1);
      expect(result.discarded[0].name).not.eq(CardName.BIG_ASTEROID);
      expect(result.kept).has.length(3);
      expect(result.kept.map((c) => c.name)).contains(CardName.BIG_ASTEROID);
    });

    it('several tied max-cost cards are ALL protected', () => {
      // Big Asteroid 27 + Space Elevator 27 protected; discard is 14 or 10.
      const drafted = cards(CardName.BIG_ASTEROID, CardName.SPACE_ELEVATOR, CardName.ASTEROID, CardName.ACQUIRED_COMPANY);
      const result = resolver().discardAfterDraft(drafted, PRIORITY);
      expect(result.discarded).has.length(1);
      expect([CardName.ASTEROID, CardName.ACQUIRED_COMPANY]).contains(result.discarded[0].name);
    });

    it('the protection CHANGES the outcome when the shuffled-first card is a max-cost one', () => {
      // Identity shuffle → first = Big Asteroid (protected) → the SECOND leaves.
      const drafted = cards(CardName.BIG_ASTEROID, CardName.ASTEROID, CardName.ACQUIRED_COMPANY, CardName.ALGAE);
      const result = resolver().discardAfterDraft(drafted, PRIORITY);
      expect(result.discarded[0].name).eq(CardName.ASTEROID);
      expect(result.protectionChangedOutcome).is.true;
    });

    it('all four drafted cards cost the same → nothing is discarded (the official rare case)', () => {
      const drafted = cards(CardName.ACQUIRED_COMPANY, CardName.ALGAE, CardName.BUSHES, CardName.OLYMPUS_CONFERENCE);
      const result = resolver().discardAfterDraft(drafted, PRIORITY);
      expect(result.discarded).is.empty;
      expect(result.kept).has.length(4);
    });
  });

  describe('the action deck may hold 5 cards (integration through the research build)', () => {
    it('all-equal drafted costs keep 4 projects + the bonus card', () => {
      const [game, human] = testAutomaGame({corporation: MarsBotCorpId.C01_CREDICOR}, '-cr5');
      game.playerIsFinishedWithResearchPhase(human);
      const drafted = cards(CardName.ACQUIRED_COMPANY, CardName.ALGAE, CardName.BUSHES, CardName.OLYMPUS_CONFERENCE);
      AutomaResearch.finishDraftedActionDeck(game, drafted);
      const automa = game.automa!;
      expect(automa.actionDeck).has.length(5);
      expect(automa.actionDeck.filter((c) => c.kind === 'project')).has.length(4);
      expect(automa.corpStats['draftNoDiscardRounds']).eq(1);
      expect(automa.corpStats['fiveCardDecks']).eq(1);
    });

    it('unequal costs discard exactly one unprotected card', () => {
      const [game, human] = testAutomaGame({corporation: MarsBotCorpId.C01_CREDICOR}, '-cr4');
      game.playerIsFinishedWithResearchPhase(human);
      const drafted = cards(CardName.BIG_ASTEROID, CardName.AI_CENTRAL, CardName.ASTEROID, CardName.ACQUIRED_COMPANY);
      AutomaResearch.finishDraftedActionDeck(game, drafted);
      const automa = game.automa!;
      expect(automa.actionDeck.filter((c) => c.kind === 'project')).has.length(3);
      expect(automa.actionDeck.filter((c) => c.kind === 'project').map((c) => c.kind === 'project' ? c.name : ''))
        .contains(CardName.BIG_ASTEROID);
      expect(game.projectDeck.discardPile.map((c) => c.name)).not.contains(CardName.BIG_ASTEROID);
    });

    it('the corp-priority pick runs through AutomaCorporations.draftPick', () => {
      const [game, human] = testAutomaGame({corporation: MarsBotCorpId.C01_CREDICOR}, '-crpick');
      game.playerIsFinishedWithResearchPhase(human);
      const hand = cards(CardName.ACQUIRED_COMPANY, CardName.BIG_ASTEROID, CardName.ASTEROID);
      const picked = AutomaCorporations.draftPick(game, hand);
      expect(picked.name).eq(CardName.BIG_ASTEROID);
      expect(game.automa!.corpStats['draftPriorityPicks']).eq(1);
    });
  });

  describe('effect — "When resolving a card with a cost of 20 MC or more, MarsBot gains 4 MC"', () => {
    let game: IGame;
    let human: TestPlayer;
    let bot: IPlayer;

    beforeEach(() => {
      [game, human, bot] = testAutomaGame({corporation: MarsBotCorpId.C01_CREDICOR}, '-creff');
      game.playerIsFinishedWithResearchPhase(human);
    });

    it('a 21 M€ card grants +4 M€ (and the stats count once)', () => {
      game.automa!.actionDeck = [{kind: 'project', name: CardName.AI_CENTRAL}];
      botTakesOneTurn(game, human);
      expect(bot.megaCredits).eq(4);
      expect(game.automa!.corpStats['credicorTriggers']).eq(1);
      expect(game.automa!.corpStats['credicorMc']).eq(4);
    });

    it('a 12 M€ card grants nothing', () => {
      game.automa!.actionDeck = [{kind: 'project', name: CardName.GENE_REPAIR}];
      botTakesOneTurn(game, human);
      expect(bot.megaCredits).eq(0);
      expect(game.automa!.corpStats['credicorTriggers']).is.undefined;
    });

    it('the bonus survives a Failed Action during the card\'s own resolution', () => {
      // Big Asteroid (27 M€) prints Space + the event tag; max BOTH tracks so
      // every tag resolution is a Failed Action — the corp effect still fires
      // ("when RESOLVING", not "when successfully resolving").
      const automa = game.automa!;
      automa.board.tracks[THARSIS_TRACK.SPACE].position = automa.board.tracks[THARSIS_TRACK.SPACE].maxPosition;
      automa.board.tracks[THARSIS_TRACK.EVENT].position = automa.board.tracks[THARSIS_TRACK.EVENT].maxPosition;
      automa.actionDeck = [{kind: 'project', name: CardName.BIG_ASTEROID}];
      botTakesOneTurn(game, human);
      // +4 (corp) + 5 + 5 (two failed-action compensations).
      expect(bot.megaCredits).eq(14);
      expect(automa.corpStats['credicorTriggers']).eq(1);
    });

    it('a card resolved through Research and Development (B03) triggers it too', () => {
      const automa = game.automa!;
      game.projectDeck.drawPile.push(cards(CardName.BIG_ASTEROID)[0]); // Top of the deck.
      automa.actionDeck = [{kind: 'bonus', id: BonusCardId.B03_RESEARCH_AND_DEVELOPMENT}];
      botTakesOneTurn(game, human);
      expect(bot.megaCredits).to.be.gte(4);
      expect(automa.corpStats['credicorTriggers']).eq(1);
    });

    it('the turn review sees the corporation as the cause', () => {
      game.automa!.actionDeck = [{kind: 'project', name: CardName.AI_CENTRAL}];
      botTakesOneTurn(game, human);
      const steps = game.automa!.lastTurn!.steps;
      expect(steps.some((s) => s.kind === 'log' && s.cause?.kind === 'corporation')).is.true;
    });
  });
});
