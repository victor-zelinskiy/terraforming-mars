import {expect} from 'chai';
import {Pristar} from '../../../src/server/cards/turmoil/Pristar';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Player} from '../../../src/server/Player';
import {Phase} from '../../../src/common/Phase';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Units} from '../../../src/common/Units';
import {ratingVetoed} from '../../../src/server/parliament/ratingVetoGate';
import {UNMI_VETO_ID} from '../../../src/server/parliament/resolutions/reds/UnmiVeto';
import {isTurmoilCardHeldBackUnderRedux} from '../../../src/server/cards/turmoil/turmoilReduxAdaptation';
import {Server} from '../../../src/server/models/ServerModel';
import {seatEnacted} from '../../parliament/parliamentArrange';
import {finishGeneration, runAllActions} from '../../TestingUtils';

describe('Pristar', () => {
  it('Should play', () => {
    const card = new Pristar();
    const [game, player] = testGame(2);

    const play = card.play(player);
    player.playedCards.push(card);
    expect(play).is.undefined;
    player.megaCredits = 10;
    game.increaseTemperature(player, 1);
    card.onProductionPhase(player);
    expect(player.megaCredits).to.eq(10);
    expect(card.resourceCount).to.eq(0);
  });
});

/**
 * R07 — PRISTAR ON A TURMOIL REDUX TABLE: the fourth and last classic Turmoil corporation adapted in place
 * (`docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1) — after it the in-place list is empty. No rule changed: the
 * play is declarative (53 M€, −2 TR), the hook (`onProductionPhase`) is upstream byte for byte and reads the
 * server's one flag `hasIncreasedTerraformRatingThisGeneration`. The work is the proof — what sets the flag and
 * what does not, the payment inside the phase and its line in the record, the public model the rail's mark reads.
 */
describe('Pristar — on a Turmoil Redux table', () => {
  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, card: Pristar};

  function table(): Table {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    const card = new Pristar();
    p1.playCorporationCard(card);
    runAllActions(game);
    return {game, p1, p2, card};
  }

  /** The seat's production phase alone, no production of its own: the M€ paid beyond the rating's own line is the hook's. */
  function produce(p: TestPlayer): number {
    p.production.override(Units.EMPTY);
    const before = p.megaCredits;
    p.runProductionPhase();
    runAllActions(p.game);
    return p.megaCredits - before - p.terraformRating;
  }

  it('rule 1 — the printed corporation: 53 M€, no tags, −2 TR, a preservation store, 1 VP per resource, no first action, R07', () => {
    const c = new Pristar();
    expect(c.name).eq(CardName.PRISTAR);
    expect(c.type).eq(CardType.CORPORATION);
    expect(c.startingMegaCredits).eq(53);
    expect(c.tags).deep.eq([]);
    expect(c.behavior?.tr).eq(-2);
    expect(c.resourceType).eq(CardResource.PRESERVATION);
    expect(c.victoryPoints).deep.eq({resourcesHere: {}});
    expect(c.firstAction).is.undefined;
    expect(c.metadata.cardNumber).eq('R07');
    expect(c.metadata.infoText?.map((line) => line.text)).deep.eq(['No TR gained this generation: +1 preservation, 6 M€']);
  });

  it('rule 1 — Turmoil Redux deals it: no longer held back; the play gives 53 M€ and lowers the TR to 18', () => {
    const {game, p1, p2, card} = table();
    expect(isTurmoilCardHeldBackUnderRedux(CardName.PRISTAR, game.gameOptions)).is.false;
    expect(p1.playedCards.corporations().map((c) => c.name)).deep.eq([CardName.PRISTAR]);
    expect(p1.megaCredits).eq(53);
    expect(p1.terraformRating).eq(p2.terraformRating - 2);
    expect(p1.terraformRating).eq(18);
    expect(card.resourceCount).eq(0);
    // The lowering is no rise: the flag stays down, so generation 1 pays.
    expect(p1.hasIncreasedTerraformRatingThisGeneration).is.false;
  });

  describe('rule 2 — the effect', () => {
    it('no rise this generation → +6 M€ and +1 preservation, INSIDE the phase, named in the record', () => {
      const {p1, card} = table();
      expect(produce(p1)).eq(6);
      expect(card.resourceCount).eq(1);
      expect(p1.productionIncome?.hooks).deep.eq([{
        card: CardName.PRISTAR, income: {...Units.EMPTY, megacredits: 6},
        cardResources: {resource: CardResource.PRESERVATION, amount: 1, vp: 1},
      }]);
    });

    it('a global parameter step raises the rating → nothing paid, no hook line, no «skip» in the log', () => {
      const {game, p1, card} = table();
      game.increaseTemperature(p1, 1);
      expect(p1.hasIncreasedTerraformRatingThisGeneration).is.true;
      const logBefore = game.gameLog.length;
      expect(produce(p1)).eq(0);
      expect(card.resourceCount).eq(0);
      expect(p1.productionIncome?.hooks).is.undefined;
      expect(game.gameLog.slice(logBefore).some((m) => JSON.stringify(m).includes(CardName.PRISTAR))).is.false;
    });

    it('a card\'s direct rating (the one funnel) raises it too', () => {
      const {p1, card} = table();
      p1.increaseTerraformRating(1);
      expect(p1.hasIncreasedTerraformRatingThisGeneration).is.true;
      produce(p1);
      expect(card.resourceCount).eq(0);
    });

    it('a LOWERING never raises it', () => {
      const {p1, card} = table();
      p1.decreaseTerraformRating(1);
      expect(p1.hasIncreasedTerraformRatingThisGeneration).is.false;
      produce(p1);
      expect(card.resourceCount).eq(1);
    });

    it('under RX42 UNMI Veto (p1 first by rating) a REFUSED rise is no rise — the effect still pays', () => {
      const {game, p1, p2, card} = table();
      seatEnacted(game.parliament!, UNMI_VETO_ID);
      p1.terraformRating = 30;
      p2.terraformRating = 20;
      expect(ratingVetoed(p1)).is.true;
      p1.increaseTerraformRating(1);
      expect(p1.terraformRating).eq(30);
      expect(p1.hasIncreasedTerraformRatingThisGeneration).is.false;
      produce(p1);
      expect(card.resourceCount).eq(1);
    });

    // The reset is the engine's generation boundary (`Game.startGeneration`) — driven on a table without a sitting,
    // which a Redux end of generation would stop at for the seats' answers.
    it('the flag resets with the generation — a raise in generation 1 does not cost generation 2', () => {
      const [game, p1] = testGame(2);
      const card = new Pristar();
      p1.playCorporationCard(card);
      runAllActions(game);
      game.increaseTemperature(p1, 1);
      expect(p1.hasIncreasedTerraformRatingThisGeneration).is.true;
      finishGeneration(game);
      expect(card.resourceCount).eq(0);
      expect(p1.hasIncreasedTerraformRatingThisGeneration).is.false;
      finishGeneration(game);
      expect(card.resourceCount).eq(1);
    });

    it('an opponent\'s rise does not touch the owner\'s flag', () => {
      const {game, p1, p2} = table();
      game.increaseTemperature(p2, 1);
      expect(p2.hasIncreasedTerraformRatingThisGeneration).is.true;
      expect(p1.hasIncreasedTerraformRatingThisGeneration).is.false;
    });
  });

  describe('rule 3 — the model: the rise is public', () => {
    it('every viewer reads `ratingRaisedThisGeneration` for every seat, off the server\'s flag', () => {
      const {game, p1, p2} = table();
      game.increaseTemperature(p2, 1);
      for (const viewer of [p1, p2]) {
        const model = Server.getPlayerModel(viewer);
        expect(model.players.find((p) => p.color === p1.color)!.ratingRaisedThisGeneration).is.false;
        expect(model.players.find((p) => p.color === p2.color)!.ratingRaisedThisGeneration).is.true;
      }
    });

    it('save / load keeps the flag', () => {
      const {game, p1} = table();
      p1.increaseTerraformRating(1);
      const restored = Player.deserialize(p1.serialize());
      restored.game = game;
      expect(restored.hasIncreasedTerraformRatingThisGeneration).is.true;
    });
  });

  describe('rule 4 — the points', () => {
    it('1 VP per preservation here; none at the play', () => {
      const {p1, card} = table();
      expect(card.getVictoryPoints(p1)).eq(0);
      card.resourceCount = 3;
      expect(card.getVictoryPoints(p1)).eq(3);
    });
  });
});
