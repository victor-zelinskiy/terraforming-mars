import {expect} from 'chai';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {Phase} from '../../../src/common/Phase';
import {Mine} from '../../../src/server/cards/base/Mine';
import {TerraformingDeal} from '../../../src/server/cards/prelude2/TerraformingDeal';
import {UNMIContractor} from '../../../src/server/cards/prelude/UNMIContractor';
import {IGame} from '../../../src/server/IGame';
import {Election} from '../../../src/server/turmoil/globalEvents/Election';
import {forceGenerationEnd, runAllActions, setTemperature} from '../../../tests/TestingUtils';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Resource} from '../../../src/common/Resource';
import {ReduxParty, resolutionInstanceId} from '../../../src/common/parliament/ParliamentTypes';
import {EffectForecastFact} from '../../../src/common/models/EffectForecastModel';
import {Payment} from '../../../src/common/inputs/Payment';
import {cast} from '../../../src/common/utils/utils';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {ReleaseOfInertGases} from '../../../src/server/cards/base/ReleaseOfInertGases';
import {NitrogenRichAsteroid} from '../../../src/server/cards/base/NitrogenRichAsteroid';
import {Research} from '../../../src/server/cards/base/Research';
import {ConvertHeat} from '../../../src/server/cards/base/standardActions/ConvertHeat';
import {AsteroidStandardProject} from '../../../src/server/cards/base/standardProjects/AsteroidStandardProject';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {ChairmanSeat} from '../../../src/server/parliament/quests/ChairmanSeat';
import {UNMI_VETO_ID} from '../../../src/server/parliament/resolutions/reds/UnmiVeto';
import {MOHOLE_CONTEST_ID} from '../../../src/server/parliament/resolutions/greens/MoholeContest';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {endGenerationThroughParliament, quietResolutionOf, seatEnacted, seatResolution, settleParliamentGates} from '../../parliament/parliamentArrange';
import {testAutomaGame} from '../../automa/AutomaTestGame';


describe('TerraformingDeal', () => {
  let card: TerraformingDeal;
  let player: TestPlayer;
  let player2: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new TerraformingDeal();
    [game, player, player2] = testGame(3, {turmoilExtension: true});
  });

  it('Gains 2 MC whenever player raises TR during action phase', () => {
    player.playedCards.push(card);
    game.phase = Phase.ACTION;

    player.increaseTerraformRating();
    expect(player.megaCredits).eq(2);

    player2.increaseTerraformRating();
    expect(player.megaCredits).eq(2);

    player.increaseTerraformRating(3);
    expect(player.megaCredits).eq(8);
  });

  it('Gives MC during initial preludes phase', () => {
    player.playedCards.push(card);
    game.phase = Phase.PRELUDES;

    const contractor = new UNMIContractor();
    contractor.play(player);
    expect(player.megaCredits).eq(6);
  });

  it('Gives MC during resolving global events', () => {
    player.playedCards.push(card);
    game.phase = Phase.SOLAR;
    game.inTurmoil = true;

    const turmoil = game.turmoil!;
    player2.playedCards.push(new Mine());
    turmoil.initGlobalEvent(game);

    const election = new Election();
    election.resolve(game, turmoil);
    expect(player2.terraformRating).eq(22);
    expect(player2.megaCredits).eq(0);
    expect(player.terraformRating).eq(21);
    expect(player.megaCredits).eq(2);
  });

  it('Gives resolving chairman', () => {
    player.playedCards.push(card);
    game.phase = Phase.SOLAR;
    game.inTurmoil = true;

    const turmoil = game.turmoil!;
    turmoil.setNewChairman(player, game);
    runAllActions(game);

    expect(player.terraformRating).eq(21);
    expect(player.megaCredits).eq(2);
  });

  it('Does not give MC outside the action phase after the player becomes chairman', () => {
    player.playedCards.push(card);
    game.phase = Phase.ACTION;

    const turmoil = game.turmoil!;
    turmoil.parties.forEach((p) => p.delegates.clear());
    turmoil.sendDelegateToParty(player, PartyName.REDS, game);
    turmoil.sendDelegateToParty(player, PartyName.REDS, game);
    turmoil.currentGlobalEvent = undefined;

    forceGenerationEnd(game);

    expect(turmoil.chairman).eq(player);
    expect(game.generation).eq(2);

    // e.g. final greenery placement, which happens during the production phase.
    game.phase = Phase.PRODUCTION;
    const megaCredits = player.megaCredits;
    player.increaseTerraformRating();
    expect(player.megaCredits).eq(megaCredits);
  });
});

/**
 * P64 — the fork's readings (the card file's header): the phase gate with its Redux reading (the Parliament phase),
 * the owner's own rating step by step, what the rating funnel refuses (RX42, P57), the forecast twin on the engine's
 * ONE rating pass — silent wherever the hook is.
 */
describe('TerraformingDeal — Turmoil Redux', () => {
  type Table = {game: IGame, player: TestPlayer, rival: TestPlayer, card: TerraformingDeal};

  function table(): Table {
    const [game, player, rival] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true});
    game.phase = Phase.ACTION;
    // A ruling party that pays nothing for a rating (the empty slot means the Greens — rulebook p.8): the card's
    // own answer is the only M€ a raise brings, unless a case seats the Greens itself.
    seatEnacted(game.parliament!, quietResolutionOf(PartyName.UNITY));
    const card = new TerraformingDeal();
    player.playedCards.push(card);
    player.megaCredits = 0;
    rival.megaCredits = 0;
    return {game, player, rival, card};
  }

  function lastSeq(game: IGame): number {
    return game.cardReactions.reduce((max, r) => Math.max(max, r.seq), 0);
  }

  /** What the card paid since `from` — one entry per reaction record, each the M€ of its impacts. */
  function paid(game: IGame, from: number): Array<number> {
    return game.cardReactions.filter((r) => r.seq > from && r.card === CardName.TERRAFORMING_DEAL)
      .map((r) => r.impacts.reduce((sum, i) => sum + (i.amount ?? 0), 0));
  }

  function dealFacts(player: TestPlayer, trigger: IProjectCard): Array<EffectForecastFact> {
    player.cardsInHand.push(trigger);
    const forecast = effectForecastForPlay(player, trigger, cardPlayPreview(player, trigger));
    return forecast.facts.filter((f) => f.source.name === CardName.TERRAFORMING_DEAL);
  }

  describe('the card as printed', () => {
    it('a prelude with an Earth tag, P64 — and a play that gives NOTHING now (no behavior, no description)', () => {
      const card = new TerraformingDeal();
      expect(card.type).eq(CardType.PRELUDE);
      expect(card.tags).deep.eq([Tag.EARTH]);
      expect(card.metadata.cardNumber).eq('P64');
      expect(card.behavior).is.undefined;
      expect(card.metadata.description).is.undefined;
      const [game, player] = testGame(1, {turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.PRELUDES;
      const state = () => JSON.stringify({mc: player.megaCredits, tr: player.terraformRating, production: player.production.asUnits()});
      const before = state();
      player.playCard(card);
      runAllActions(game);
      expect(state()).eq(before);
      expect(player.playedCards.get(CardName.TERRAFORMING_DEAL)).is.not.undefined;
    });

    it('the phase gate: ACTION · PRELUDES · the classic Turmoil phase · its Redux reading PARLIAMENT — never PRODUCTION / SOLAR / RESEARCH', () => {
      const t = table();
      const at = (phase: Phase) => {
        t.game.phase = phase;
        return TerraformingDeal.paysNow(t.game);
      };
      expect([Phase.ACTION, Phase.PRELUDES, Phase.PARLIAMENT].map(at)).deep.eq([true, true, true]);
      expect([Phase.PRODUCTION, Phase.SOLAR, Phase.RESEARCH].map(at)).deep.eq([false, false, false]);
      t.game.inTurmoil = true;
      expect(at(Phase.SOLAR), 'classic Turmoil (the global event, the chairman)').is.true;
    });
  });

  describe('the hook — 2 M€ per step of the OWNER\'s rating, whatever raised it', () => {
    it('a card\'s printed TR (Release of Inert Gases, +2): +4 M€ in ONE record, named in the journal', () => {
      const t = table();
      const from = lastSeq(t.game);
      const log = t.game.gameLog.length;
      t.player.playCard(new ReleaseOfInertGases());
      runAllActions(t.game);
      expect(paid(t.game, from)).deep.eq([4]);
      expect(t.player.megaCredits).eq(4);
      const lines = t.game.gameLog.slice(log).filter((l) => l.data.some((d) => d.value === CardName.TERRAFORMING_DEAL));
      expect(lines, 'the standard «gained … because of» line names the card').to.have.lengthOf(1);
    });

    it('the heat conversion (temperature → +1 TR): +2 M€', () => {
      const t = table();
      t.player.heat = 8;
      new ConvertHeat().action(t.player);
      runAllActions(t.game);
      expect(t.player.heat).eq(0);
      expect(t.player.megaCredits).eq(2);
    });

    it('the Asteroid standard project: its temperature step is a rating step — +2 M€', () => {
      const t = table();
      t.player.megaCredits = 14;
      const project = new AsteroidStandardProject();
      project.payAndExecute(t.player, Payment.of({megacredits: project.cost}));
      runAllActions(t.game);
      expect(t.player.megaCredits).eq(14 - project.cost + 2);
    });

    it('the ruling Greens beside the card: ONE raise, TWO answers of two sources (+2 the party, +2 the card)', () => {
      const t = table();
      t.game.parliament!.grantPartyEffect(t.player, PartyName.GREENS as ReduxParty, 'test');
      const from = lastSeq(t.game);
      t.player.increaseTerraformRating(1);
      expect(t.player.megaCredits).eq(4);
      expect(paid(t.game, from), 'the card\'s own record').deep.eq([2]);
    });

    it('Preservation Program eats the first step of the generation: the card pays the rest only (+3 → +4 M€)', () => {
      const t = table();
      t.player.preservationProgram = true;
      t.player.increaseTerraformRating(3);
      expect(t.player.megaCredits).eq(4);
    });

    it('the UNMI veto (RX42): the rating refused, the hook never runs — 0 M€, no record', () => {
      const t = table();
      t.game.parliament!.enacted = resolutionInstanceId(UNMI_VETO_ID, 0);
      t.player.terraformRating = 30;
      t.rival.terraformRating = 20;
      const from = lastSeq(t.game);
      t.player.increaseTerraformRating(2);
      expect(t.player.terraformRating).eq(30);
      expect(t.player.megaCredits).eq(0);
      expect(paid(t.game, from)).deep.eq([]);
    });

    it('a RIVAL\'s rating pays nothing', () => {
      const t = table();
      const from = lastSeq(t.game);
      t.rival.increaseTerraformRating(3);
      expect(t.player.megaCredits).eq(0);
      expect(paid(t.game, from)).deep.eq([]);
    });

    it('MarsBot raising ITS rating pays the human\'s card nothing', () => {
      const [game, human, bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      human.playedCards.push(new TerraformingDeal());
      const mc = human.megaCredits;
      bot.increaseTerraformRating(2);
      expect(human.megaCredits).eq(mc);
    });

    it('a step of the Career on the SITTING (the Parliament phase — the Redux reading of upstream\'s inTurmoil): +2 M€', () => {
      const t = table();
      t.game.phase = Phase.PARLIAMENT;
      const parliament = t.game.parliament!;
      parliament.agenda.set(t.player.id, 1);
      const tr = t.player.terraformRating;
      ChairmanSeat.walkAgenda(t.player, parliament, 1, {reason: 'card', card: CardName.SUPERCOMPUTER});
      runAllActions(t.game);
      expect(t.player.terraformRating).eq(tr + 1);
      expect(t.player.megaCredits).eq(2);
    });

    it('a resolution\'s WINNER on the sitting (Mohole Contest — the temperature 2 steps, +2 TR): the card pays +4 beside the Greens\' +4', () => {
      const t = table();
      const parliament = t.game.parliament!;
      seatResolution(parliament, 0, resolutionInstanceId(MOHOLE_CONTEST_ID, 0));
      parliament.placeVote(t.player, parliament.slots[0], 'lobby');
      setTemperature(t.game, -20);
      const income = t.player.terraformRating + t.player.production.megacredits;
      const from = lastSeq(t.game);
      endGenerationThroughParliament(t.game);
      runAllActions(t.game);
      settleParliamentGates(t.game);
      expect(parliament.rulingParty()).eq(PartyName.GREENS);
      expect(paid(t.game, from), 'the card answered on the sitting').deep.eq([4]);
      expect(t.player.megaCredits, 'the income + the Greens 4 + the card 4').eq(income + 8);
    });

    it('the final greenery (the PRODUCTION phase): the tile\'s rating pays nothing — upstream\'s own rule', () => {
      const t = table();
      t.game.phase = Phase.PRODUCTION;
      t.player.plants = 8;
      const tr = t.player.terraformRating;
      t.player.takeActionForFinalGreenery();
      const ask = cast(t.player.getWaitingFor(), OrOptions);
      const place = cast(ask.options[0], SelectSpace);
      t.player.process({type: 'or', index: 0, response: {type: 'space', spaceId: place.spaces[0].id}});
      runAllActions(t.game);
      expect(t.player.terraformRating).to.be.greaterThan(tr);
      expect(t.player.megaCredits).eq(0);
    });

    it('the World Government\'s phase (SOLAR): a raise there pays nothing', () => {
      const t = table();
      t.game.phase = Phase.SOLAR;
      t.player.increaseTerraformRating(1);
      expect(t.player.megaCredits).eq(0);
    });
  });

  describe('the forecast twin — the engine\'s rating pass, silent where the hook is', () => {
    it('a card with a printed TR: ONE exact fact, block #0, «+4 M€» into the rail', () => {
      const t = table();
      const facts = dealFacts(t.player, new ReleaseOfInertGases());
      expect(facts).to.have.lengthOf(1);
      const fact = facts[0];
      expect(fact.certainty).eq('exact');
      expect(fact.source).deep.eq({kind: 'card', name: CardName.TERRAFORMING_DEAL, owner: t.player.color, channel: 'tr-increase', printedEffect: 0});
      expect(fact.recipient).deep.eq({kind: 'you'});
      expect(fact.reason).eq('You raise your terraform rating');
      expect(fact.effects.map((e) => [e.direction, e.icon, e.amount, e.current, e.resulting])).deep.eq([['gain', Resource.MEGACREDITS, 4, 0, 4]]);
    });

    it('a scale step is a rating step: Nitrogen-Rich Asteroid (a degree + 2 TR) → +6', () => {
      expect(dealFacts(table().player, new NitrogenRichAsteroid()).map((f) => f.effects[0].amount)).deep.eq([6]);
    });

    it('a card that raises no rating forecasts NOTHING', () => {
      expect(dealFacts(table().player, new Research())).deep.eq([]);
    });

    it('the PRODUCTION / SOLAR phases: nothing promised (the hook is silent there)', () => {
      for (const phase of [Phase.PRODUCTION, Phase.SOLAR]) {
        const t = table();
        t.game.phase = phase;
        expect(dealFacts(t.player, new ReleaseOfInertGases()), phase).deep.eq([]);
      }
    });

    it('the veto (RX42): nothing promised', () => {
      const t = table();
      t.game.parliament!.enacted = resolutionInstanceId(UNMI_VETO_ID, 0);
      t.player.terraformRating = 30;
      t.rival.terraformRating = 20;
      expect(dealFacts(t.player, new ReleaseOfInertGases())).deep.eq([]);
    });

    it('Preservation Program armed: the eaten step promises nothing — the promise equals the payout (+2 TR → +2 M€)', () => {
      const t = table();
      t.player.preservationProgram = true;
      const promised = dealFacts(t.player, new ReleaseOfInertGases()).map((f) => f.effects[0].amount);
      t.player.playCard(new ReleaseOfInertGases());
      runAllActions(t.game);
      expect(t.player.megaCredits).eq(2);
      expect(promised).deep.eq([2]);
    });

    it('a rival\'s Terraforming Deal does not answer the actor\'s rating', () => {
      const t = table();
      t.player.playedCards.remove(t.card);
      t.rival.playedCards.push(new TerraformingDeal());
      expect(dealFacts(t.player, new ReleaseOfInertGases())).deep.eq([]);
    });

    it('the Greens and the card on one raise: both facts, the same sum (2 M€ per step each)', () => {
      const t = table();
      t.game.parliament!.grantPartyEffect(t.player, PartyName.GREENS as ReduxParty, 'test');
      const trigger = new NitrogenRichAsteroid();
      t.player.cardsInHand.push(trigger);
      const forecast = effectForecastForPlay(t.player, trigger, cardPlayPreview(t.player, trigger));
      const greens = forecast.facts.find((f) => f.id.endsWith('greens-tr'));
      const deal = forecast.facts.find((f) => f.source.name === CardName.TERRAFORMING_DEAL);
      expect(deal?.effects[0].amount).eq(6);
      expect(greens?.effects[0].amount).eq(deal?.effects[0].amount);
    });
  });
});
