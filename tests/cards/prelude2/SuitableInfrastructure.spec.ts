import {expect} from 'chai';
import {SuitableInfrastructure} from '../../../src/server/cards/prelude2/SuitableInfrastructure';
import {testGame} from '../../TestGame';
import {Resource} from '../../../src/common/Resource';
import {PowerPlantStandardProject} from '../../../src/server/cards/base/standardProjects/PowerPlantStandardProject';
import {runAllActions, simulateFinishingAction} from '../../TestingUtils';
import {SaturnSystems} from '../../../src/server/cards/corporation/SaturnSystems';
import {Manutech} from '../../../src/server/cards/venusNext/Manutech';
import {JovianLanterns} from '../../../src/server/cards/colonies/JovianLanterns';
import {RefugeeCamps} from '../../../src/server/cards/colonies/RefugeeCamps';
import {SpaceLanes} from '../../../src/server/cards/prelude2/SpaceLanes';
import {Aridor} from '../../../src/server/cards/colonies/Aridor';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {Phase} from '../../../src/common/Phase';
import {PlayerInput} from '../../../src/server/PlayerInput';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {Payment} from '../../../src/common/inputs/Payment';
import {cast} from '../../../src/common/utils/utils';
import {PowerPlant} from '../../../src/server/cards/base/PowerPlant';
import {Ants} from '../../../src/server/cards/base/Ants';
import {IndustrialMicrobes} from '../../../src/server/cards/base/IndustrialMicrobes';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {CardName} from '../../../src/common/cards/CardName';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {buildStandardProjectPreview} from '../../../src/server/models/standardProjectPreview';
import {EffectForecastFact} from '../../../src/common/models/EffectForecastModel';
import {PRELUDE2_CARDS_TO_ADAPT_IN_PLACE} from '../../../src/common/cards/prelude2Adaptation';
import {TestPlayer} from '../../TestPlayer';

function assertIsTakeAction(input: PlayerInput | undefined) {
  const orOptions = cast(input, OrOptions);
  expect(orOptions.buttonLabel).eq('Take action');
}

describe('SuitableInfrastructure', () => {
  it('effect', () => {
    const card = new SuitableInfrastructure();
    const [game, player] = testGame(1);

    game.phase = Phase.ACTION;
    player.playedCards.push(card);

    expect(player.stock.megacredits).eq(0);
    player.production.add(Resource.ENERGY, 1);
    expect(player.stock.megacredits).eq(2);
    player.production.add(Resource.ENERGY, 1);
    expect(player.stock.megacredits).eq(2);

    simulateFinishingAction(player);

    player.production.add(Resource.ENERGY, 1);
    expect(player.stock.megacredits).eq(4);
    player.production.add(Resource.ENERGY, 1);
    expect(player.stock.megacredits).eq(4);

    simulateFinishingAction(player);
  });

  it('works with Power Plant standard project', () => {
    const card = new SuitableInfrastructure();
    const [game, player] = testGame(1);

    game.phase = Phase.ACTION;
    player.playedCards.push(card);
    player.megaCredits = 11;
    new PowerPlantStandardProject().payAndExecute(player, Payment.of({megacredits: 11}));
    runAllActions(game);

    expect(player.stock.megacredits).eq(2);

    simulateFinishingAction(player);

    expect(player.stock.megacredits).eq(2);
  });

  it('Does not reward when other player has an action that rewards you.', () => {
    const card = new SuitableInfrastructure();
    const [game, player, player2] = testGame(2);

    game.phase = Phase.ACTION;
    const saturnSystems = new SaturnSystems();
    player.playedCards.push(card);
    // Gain 1 MC prouduction when anybody plays a card with a jovian tag.
    player.playedCards.push(saturnSystems);
    const jovianLanterns = new JovianLanterns();

    game.activePlayer = player2;
    saturnSystems.onCardPlayedByAnyPlayer(player, jovianLanterns);

    expect(player.stock.megacredits).eq(0);

    game.activePlayer = player;
    saturnSystems.onCardPlayedByAnyPlayer(player, jovianLanterns);

    expect(player.stock.megacredits).eq(2);
  });

  it('Suitable Infrastructure does not work when production goes down', () => {
    const card = new SuitableInfrastructure();
    // Refugee camps: Decrease MC production 1 step to put a resource on self.
    const refugeeCamps = new RefugeeCamps();
    const [game, player] = testGame(1);

    game.phase = Phase.ACTION;
    const saturnSystems = new SaturnSystems();
    player.playedCards.push(card, refugeeCamps);
    player.playedCards.push(saturnSystems);

    refugeeCamps.action(player);
    runAllActions(game);
    expect(player.production.megacredits).eq(-1);
    expect(player.megaCredits).eq(0);
  });

  it('Works when player has other cards with onProductionGain #7140', () => {
    const card = new SuitableInfrastructure();
    const [game, player] = testGame(1);

    game.phase = Phase.ACTION;
    // Manutech: also has an onProductionGain() method
    const manutech = new Manutech();
    player.playedCards.push(manutech);
    player.playedCards.push(card);

    expect(player.stock.megacredits).eq(0);

    player.production.add(Resource.ENERGY, 1);

    expect(player.stock.megacredits).eq(2);
  });

  it('Works when playing initial preludes', () => {
    const [game, player] = testGame(1, {preludeExtension: true, coloniesExtension: true});

    game.phase = Phase.PRELUDES;
    const aridor = new Aridor();
    const suitableInfrastructure = new SuitableInfrastructure();
    const spaceLanes = new SpaceLanes();

    player.preludeCardsInHand.push(suitableInfrastructure, spaceLanes);
    player.playedCards.push(aridor);

    game.deferredActions.runAll(() => {});
    player.popWaitingFor();

    expect(player.production.megacredits).eq(-2);

    player.takeAction();
    runAllActions(game);
    const [action, cb] = player.popWaitingFor2();
    const selectCard = cast(action, SelectCard);
    selectCard.cb([suitableInfrastructure]);
    cb!();
    runAllActions(game);

    expect(player.production.megacredits).eq(-1);
    expect(player.megaCredits).eq(2);

    const [action2, cb2] = player.popWaitingFor2();
    const selectCard2 = cast(action2, SelectCard);
    selectCard2.cb([spaceLanes]);
    cb2!();
    runAllActions(game);

    expect(player.production.megacredits).eq(0);
    expect(player.megaCredits).eq(4);
  });

  it('triggers for both a deferred production increase and a direct production increase on consecutive actions', () => {
    const card = new SuitableInfrastructure();
    const [game, player] = testGame(1);

    game.phase = Phase.ACTION;
    player.playedCards.push(card);
    player.megaCredits = 0;

    // Start the player's turn via the real takeAction flow.
    player.takeAction();

    const [action1, cb1] = player.popWaitingFor2();
    assertIsTakeAction(action1);

    // Simulate action that would defer a steel production.
    player.defer(() => {
      player.production.add(Resource.STEEL, 1);
      return undefined;
    });

    expect(player.megaCredits).eq(0);

    cb1!();

    expect(player.megaCredits).eq(2);

    assertIsTakeAction(player.popWaitingFor());

    // Simulate action 2: a direct production increase (before any deferred actions).
    player.production.add(Resource.ENERGY, 1);

    // Suitable Infrastructure should trigger again
    expect(player.megaCredits).eq(4);
  });

  /** P63 — the fork's rule readings (the card file's header). Upstream's block above stays byte for byte. */
  describe('P63 · the reactor', () => {
    let card: SuitableInfrastructure;
    let player: TestPlayer;

    function factsOf(played: IProjectCard): ReadonlyArray<EffectForecastFact> {
      player.cardsInHand.push(played);
      return effectForecastForPlay(player, played, cardPlayPreview(player, played)).facts
        .filter((f) => f.source.name === CardName.SUITABLE_INFRASTRUCTURE);
    }

    beforeEach(() => {
      card = new SuitableInfrastructure();
      const [game, p] = testGame(1);
      player = p;
      game.phase = Phase.ACTION;
      player.playedCards.push(card);
    });

    it('leaves the hold-back list (the forty-fifth Prelude 2 card)', () => {
      expect(PRELUDE2_CARDS_TO_ADAPT_IN_PLACE).not.to.include(CardName.SUITABLE_INFRASTRUCTURE);
    });

    it('rule 3 — paid at once, the card as the source: one production-gain reaction record and the standard log line', () => {
      player.production.add(Resource.ENERGY, 1);
      expect(player.megaCredits).eq(2);
      const records = player.game.cardReactions.filter((r) => r.card === CardName.SUITABLE_INFRASTRUCTURE);
      expect(records.map((r) => r.channel)).deep.eq(['production-gain']);
      expect(records[0].impacts).deep.eq([{kind: 'stock', resource: Resource.MEGACREDITS, amount: 2, to: player.color}]);
      const named = player.game.gameLog.filter((l) => l.data.some((d) => d.value === CardName.SUITABLE_INFRASTRUCTURE));
      expect(named).has.lengthOf(1);
      // Upstream's hand-rolled line with the plain string «M€» is gone.
      expect(named[0].message).not.to.include('gained ${1} ${2} from');
    });

    it('rule 4 — the twin promises what the hook pays: Power Plant → one exact «+2 M€», once per action', () => {
      const facts = factsOf(new PowerPlant());
      expect(facts.map((f) => [f.certainty, f.effects.map((e) => [e.icon, e.amount])])).deep.eq([
        ['exact', [[Resource.MEGACREDITS, 2]]],
      ]);
      expect(facts[0].note).eq('Once per action');
      const before = player.megaCredits;
      player.playCard(new PowerPlant());
      runAllActions(player.game);
      expect(player.megaCredits - before).eq(2);
    });

    it('rule 4 · GD — a play raising TWO productions (Industrial Microbes): ONE fact, the promise equals the payout', () => {
      const facts = factsOf(new IndustrialMicrobes());
      expect(facts, 'one answer per operation — never «+2» per chip').has.lengthOf(1);
      const promised = facts.flatMap((f) => f.effects).reduce((sum, e) => sum + (e.amount ?? 0), 0);
      player.megaCredits = 20;
      const before = player.megaCredits;
      player.playCard(new IndustrialMicrobes());
      runAllActions(player.game);
      expect(player.megaCredits - before).eq(promised).eq(2);
    });

    it('rule 4 — a play that raises no production is promised nothing', () => {
      expect(factsOf(new Ants())).deep.eq([]);
    });

    it('rule 4 — an action that has already paid promises nothing more', () => {
      player.production.add(Resource.STEEL, 1);
      expect(card.paidThisAction(player.game)).is.true;
      expect(factsOf(new PowerPlant())).deep.eq([]);
      simulateFinishingAction(player);
      expect(card.paidThisAction(player.game)).is.false;
      expect(factsOf(new PowerPlant())).has.lengthOf(1);
    });

    it('rule 1 — silent where the hook is: the Parliament, the production phase, a rival as the actor', () => {
      const grant = {kind: 'production' as const, resource: Resource.ENERGY, amount: 1};
      for (const phase of [Phase.PARLIAMENT, Phase.PRODUCTION, Phase.SOLAR, Phase.RESEARCH]) {
        player.game.phase = phase;
        expect(card.grantForecast(player, player, grant), phase).deep.eq([]);
        player.production.add(Resource.ENERGY, 1);
        expect(player.megaCredits, phase).eq(0);
      }
      player.game.phase = Phase.PRELUDES;
      expect(card.grantForecast(player, player, grant)).has.lengthOf(1);
      const [, owner, rival] = testGame(2);
      owner.game.phase = Phase.ACTION;
      const own = new SuitableInfrastructure();
      owner.playedCards.push(own);
      expect(own.grantForecast(owner, rival, grant)).deep.eq([]);
      expect(own.grantForecast(owner, owner, {...grant, amount: 0})).deep.eq([]);
      expect(own.grantForecast(owner, owner, {kind: 'stock', resource: Resource.ENERGY, amount: 1})).deep.eq([]);
    });

    it('rule 4 — the Power Plant standard project: its screen states the answer of the table, the commit pays it', () => {
      player.megaCredits = 11;
      const project = new PowerPlantStandardProject();
      const facts = (buildStandardProjectPreview(player, project, 11).forecast?.facts ?? [])
        .filter((f) => f.source.name === CardName.SUITABLE_INFRASTRUCTURE);
      expect(facts.map((f) => f.effects.map((e) => [e.icon, e.amount]))).deep.eq([[[Resource.MEGACREDITS, 2]]]);
      project.payAndExecute(player, Payment.of({megacredits: 11}));
      runAllActions(player.game);
      expect(player.megaCredits).eq(2);
    });
  });
});
