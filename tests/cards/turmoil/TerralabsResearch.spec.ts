import {expect} from 'chai';
import {runAllActions} from '../../TestingUtils';
import {BusinessNetwork} from '../../../src/server/cards/base/BusinessNetwork';
import {PowerPlant} from '../../../src/server/cards/base/PowerPlant';
import {TerralabsResearch} from '../../../src/server/cards/turmoil/TerralabsResearch';
import {SelectInitialCards} from '../../../src/server/inputs/SelectInitialCards';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {SelectOption} from '../../../src/server/inputs/SelectOption';
import {testGame} from '../../TestGame';
import {cast} from '../../../src/common/utils/utils';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Player} from '../../../src/server/Player';
import {TestPlayer} from '../../TestPlayer';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {newProjectCard} from '../../../src/server/createCard';
import {ChooseCards} from '../../../src/server/deferredActions/ChooseCards';
import {QuantumResearch} from '../../../src/server/cards/delta/QuantumResearch';
import {Polyphemos} from '../../../src/server/cards/colonies/Polyphemos';
import {campaignStartingBudget} from '../../../src/server/campaign/CampaignMissionSetup';
import {Server} from '../../../src/server/models/ServerModel';
import {GameCards} from '../../../src/server/GameCards';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';

describe('TerralabsResearch', () => {
  it('Should play', () => {
    const card = new TerralabsResearch();
    const card2 = new PowerPlant();
    const card3 = new BusinessNetwork();
    const [game, player] = testGame(1, {skipInitialCardSelection: false});
    const pi = cast(player.getWaitingFor(), SelectInitialCards);
    pi.options[0].cb([card]);
    pi.options[1].cb([card2, card2]);
    pi.cb(undefined);
    // The explicit corporationPlay press + the card-payment press (the
    // deferred-play contract: the bought cards are paid by their own step).
    cast(player.popWaitingFor(), SelectCard).cb([card]);
    cast(player.popWaitingFor(), SelectOption).cb(undefined);

    // 14 starting MC - 1 for each card select at the start (total: 2)
    expect(player.megaCredits).to.eq(12);
    // 14 Solo TR - 1
    expect(player.terraformRating).to.eq(13);

    player.playedCards.push(card3);
    expect(card3.action(player)).is.undefined;
    runAllActions(game);
    const action = cast(player.popWaitingFor(), SelectCard);
    action.cb([action.cards[0]]);
    game.deferredActions.runNext();
    expect(player.megaCredits).to.eq(11);
    expect(player.cardsInHand).has.lengthOf(3);
  });
});

/**
 * R14 — TERRALABS RESEARCH ON A TURMOIL REDUX TABLE: the second classic Turmoil corporation adapted in place
 * (`docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1). No live hook and no politics — the printed price REPLACES the
 * 3 M€ base (`Player.baseCardCost`), and every buy-to-hand flow reads `player.cardCost`. The work is the proof:
 * each flow is pinned here against the server's own answer, never a constant.
 */
describe('TerralabsResearch — on a Turmoil Redux table', () => {
  function table(): {game: IGame, p1: TestPlayer, p2: TestPlayer} {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    p1.playCorporationCard(new TerralabsResearch());
    runAllActions(game);
    return {game, p1, p2};
  }

  function offered(count: number): Array<IProjectCard> {
    return [CardName.AQUIFER_PUMPING, CardName.IO_MINING_INDUSTRIES, CardName.BUSHES, CardName.ANTS, CardName.ALGAE]
      .slice(0, count).map((name) => newProjectCard(name)!);
  }

  /** A real `ChooseCards` buy (the research and the draft alike) of `count` cards; the M€ charged. */
  function buy(p: TestPlayer, count: number): number {
    const cards = offered(count);
    const before = p.megaCredits;
    const selectCard = cast(new ChooseCards(p, cards, {paying: true}).execute(), SelectCard<IProjectCard>);
    selectCard.cb(cards);
    runAllActions(p.game);
    return before - p.megaCredits;
  }

  it('rule 1 — the printed corporation: 14 M€, Science + Earth, a 1 M€ price, −1 TR, no first action, R14', () => {
    const c = new TerralabsResearch();
    expect(c.name).eq(CardName.TERRALABS_RESEARCH);
    expect(c.type).eq(CardType.CORPORATION);
    expect(c.startingMegaCredits).eq(14);
    expect(c.cardCost).eq(1);
    expect(c.behavior?.tr).eq(-1);
    expect(c.tags).deep.eq([Tag.SCIENCE, Tag.EARTH]);
    expect(c.firstAction).is.undefined;
    expect(c.metadata.cardNumber).eq('R14');
    expect(c.metadata.infoText?.map((line) => line.text)).deep.eq(['Cards to hand cost 1 M€, starting hand included']);
  });

  it('rule 1 — Turmoil Redux deals it; the play gives 14 M€ and lowers the TR to 19', () => {
    const {game, p1, p2} = table();
    expect(new GameCards(game.gameOptions).getCorporationCards().map((c) => c.name), 'a Redux table deals it').to.include(CardName.TERRALABS_RESEARCH);
    expect(p1.playedCards.corporations().map((c) => c.name)).deep.eq([CardName.TERRALABS_RESEARCH]);
    expect(p1.megaCredits).eq(14);
    expect(p1.terraformRating).eq(p2.terraformRating - 1);
    expect(p1.terraformRating).eq(19);
  });

  describe('rule 2 — the price is 1 M€ in every buy-to-hand flow', () => {
    it('the server\'s one answer: `cardCost` 1 for the owner, 3 for the opponent', () => {
      const {p1, p2} = table();
      expect(p1.baseCardCost).eq(1);
      expect(p1.cardCost).eq(1);
      expect(p2.cardCost).eq(3);
    });

    it('the research / draft buy (`ChooseCards`): 4 cards cost 4 M€', () => {
      const {p1} = table();
      p1.megaCredits = 20;
      expect(buy(p1, 4)).eq(4);
      expect(p1.megaCredits).eq(16);
    });

    it('affordability counts at 1 M€: 3 M€ on hand buys up to three cards', () => {
      const {p1} = table();
      p1.megaCredits = 3;
      const selectCard = cast(new ChooseCards(p1, offered(5), {paying: true}).execute(), SelectCard<IProjectCard>);
      expect(selectCard.config.max).eq(3);
    });

    it('the starting hand: 5 projects at 1 M€ each — 14 − 5 = 9 M€, the solo TR 14 − 1', () => {
      const [/* game */, player] = testGame(1, {skipInitialCardSelection: false});
      const corp = new TerralabsResearch();
      const pi = cast(player.getWaitingFor(), SelectInitialCards);
      pi.options[0].cb([corp]);
      pi.options[1].cb(offered(5));
      pi.cb(undefined);
      cast(player.popWaitingFor(), SelectCard).cb([corp]);
      cast(player.popWaitingFor(), SelectOption).cb(undefined);
      expect(player.cardsInHand).has.length(5);
      expect(player.megaCredits).eq(9);
      expect(player.terraformRating).eq(13);
    });

    it('the starting hand cannot buy past 14 M€: 15 cards are refused', () => {
      const [/* game */, player] = testGame(2, {skipInitialCardSelection: false});
      const pi = cast(player.getWaitingFor(), SelectInitialCards);
      pi.options[0].cb([new TerralabsResearch()]);
      pi.options[1].cb([...offered(5), ...offered(5), ...offered(5)]);
      expect(() => pi.cb(undefined)).to.throw(/Too many cards selected/);
    });

    it('Quantum Research\'s −1 floors the price at 0, and both are named as its sources', () => {
      const {p1} = table();
      p1.playedCards.push(new QuantumResearch());
      expect(p1.cardCost).eq(0);
      expect(p1.cardCostSources).deep.eq([CardName.TERRALABS_RESEARCH, CardName.QUANTUM_RESEARCH]);
      p1.megaCredits = 5;
      expect(buy(p1, 3)).eq(0);
    });

    it('a second corporation (Merger) stacks by its replacement: Terralabs + Polyphemos = 3 M€, both named', () => {
      const {p1} = table();
      p1.playCorporationCard(new Polyphemos());
      expect(p1.cardCost).eq(3);
      expect(p1.cardCostSources).deep.eq([CardName.TERRALABS_RESEARCH, CardName.POLYPHEMOS]);
    });

    it('a plain table names no source', () => {
      const {p2} = table();
      expect(p2.cardCostSources).deep.eq([]);
    });

    it('a campaign deployment prices the starting hand through `campaignStartingBudget`: 1 alone, 3 beside Polyphemos', () => {
      const deploy = (lineage: Array<CardName>) => {
        const p1 = new Player('Alice', 'blue', false, 0, 'p-tl-a');
        const p2 = new Player('Bruno', 'red', false, 0, 'p-tl-b');
        p1.campaignSeat = 0;
        p2.campaignSeat = 1;
        Game.newInstance('g-tl-camp', [p1, p2], p1, 's-tl', {
          corporateEra: true,
          bannedCards: [CardName.MERGER, ...lineage],
          campaign: {
            campaignId: 'ctest', campaignName: 'Test Campaign', missionSlot: 1, missionCount: 4, final: false,
            grants: [
              {seat: 0, color: 'blue', bonusMegaCredits: 0, corporations: lineage, titlePoints: []},
              {seat: 1, color: 'red', bonusMegaCredits: 0, corporations: [], titlePoints: []},
            ],
          },
        }, 0.42);
        return campaignStartingBudget(p1, new TerralabsResearch());
      };
      expect(deploy([CardName.CREDICOR]).cardCost).eq(1);
      expect(deploy([CardName.POLYPHEMOS]).cardCost).eq(3);
    });
  });

  describe('rule 3 — the model: the price is public', () => {
    it('every seat reads the owner\'s `cardCost` 1 and its source; the opponent\'s stays 3 with none', () => {
      const {p1, p2} = table();
      for (const viewer of [p1, p2]) {
        const model = Server.getPlayerModel(viewer);
        const owner = model.players.find((p) => p.color === p1.color)!;
        const rival = model.players.find((p) => p.color === p2.color)!;
        expect(owner.cardCost).eq(1);
        expect(owner.cardCostSources).deep.eq([CardName.TERRALABS_RESEARCH]);
        expect(rival.cardCost).eq(3);
        expect(rival.cardCostSources).deep.eq([]);
      }
    });
  });

  describe('rule 4 — persistence', () => {
    it('save / load keeps the base 1 and derives the price — a round trip cannot apply it twice', () => {
      const {game, p1} = table();
      const serialized = p1.serialize();
      expect(serialized.cardCost).eq(1);
      const restored = Player.deserialize(serialized);
      restored.game = game;
      expect(restored.cardCost).eq(1);
      const twice = Player.deserialize(restored.serialize());
      twice.game = game;
      expect(twice.cardCost).eq(1);
    });
  });
});
