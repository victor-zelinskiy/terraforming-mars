import {expect} from 'chai';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {VenusContract} from '../../../src/server/cards/prelude2/VenusContract';
import {IGame} from '../../../src/server/IGame';
import {Tag} from '../../../src/common/cards/Tag';
import {GlobalParameter} from '../../../src/common/GlobalParameter';
import {Phase} from '../../../src/common/Phase';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Resource} from '../../../src/common/Resource';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {ReduxParty, resolutionInstanceId} from '../../../src/common/parliament/ParliamentTypes';
import {EffectForecastFact} from '../../../src/common/models/EffectForecastModel';
import {Payment} from '../../../src/common/inputs/Payment';
import {cast} from '../../../src/common/utils/utils';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {AtmosphericEnhancers} from '../../../src/server/cards/prelude2/AtmosphericEnhancers';
import {VenusShuttles} from '../../../src/server/cards/prelude2/VenusShuttles';
import {SpinInducingAsteroid} from '../../../src/server/cards/venusNext/SpinInducingAsteroid';
import {ReleaseOfInertGases} from '../../../src/server/cards/base/ReleaseOfInertGases';
import {AirScrappingStandardProject} from '../../../src/server/cards/venusNext/AirScrappingStandardProject';
import {GrantVenusAltTrackBonusDeferred} from '../../../src/server/venusNext/GrantVenusAltTrackBonusDeferred';
import {UNMI_VETO_ID} from '../../../src/server/parliament/resolutions/reds/UnmiVeto';
import {DIVERTED_RESEARCH_ID} from '../../../src/server/parliament/resolutions/reds/DivertedResearch';
import {DEV_VENUS_STEP_RESOLUTION_ID} from '../../../src/server/parliament/resolutions/ResolutionCatalog';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {effectForecastForAction, effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {endGenerationThroughParliament, quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {runAllActions, setVenusScaleLevel} from '../../TestingUtils';

describe('VenusContract', () => {
  let card: VenusContract;
  let player: TestPlayer;
  let player2: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new VenusContract();
    [game, player, player2] = testGame(2, {venusNextExtension: true});
    player.playedCards.push(card);
  });

  it('play', () => {
    expect(player.terraformRating).eq(20);
    player.cardsInHand.length = 0;
    player.playedCards.set();

    card.play(player);

    expect(player.terraformRating).eq(21);
    expect(player.cardsInHand).length(1);
    expect(player.cardsInHand[0].tags).includes(Tag.VENUS);
  });

  it('raise 1 step', () => {
    game.increaseVenusScaleLevel(player, 1);
    expect(player.megaCredits).eq(3);
  });

  it('raise 2 steps', () => {
    game.increaseVenusScaleLevel(player, 2);
    expect(player.megaCredits).eq(6);
  });

  it('raise 3 steps', () => {
    game.increaseVenusScaleLevel(player, 3);
    expect(player.megaCredits).eq(9);
  });

  it('raise temperature', () => {
    game.increaseTemperature(player, 2);
    expect(player.megaCredits).eq(0);
  });

  it('other player increases venus', () => {
    game.increaseTemperature(player2, 2);
    expect(player.megaCredits).eq(0);
    expect(player2.megaCredits).eq(0);
  });

  it('negative venus', () => {
    game.increaseVenusScaleLevel(player, -1);
    expect(player.megaCredits).eq(0);
  });
});

/**
 * P65 — the fork's readings (the card file's header): «YOU raise» is the raiser's own rewarded raise, the steps MADE,
 * the Redux doors of a Venus step (the sitting's winner pays; the world move and the World Government do not; RX35
 * replaces no Venus step; RX42 refuses the rating, never the scale), and the forecast twin that promises exactly what
 * the hook pays — on the branch that raises Venus, and on no other.
 */
describe('VenusContract — Turmoil Redux', () => {
  type Table = {game: IGame, player: TestPlayer, rival: TestPlayer, card: VenusContract};

  function table(options: {altVenusBoard?: boolean} = {}): Table {
    const [game, player, rival] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true, ...options});
    game.phase = Phase.ACTION;
    // A ruling party that pays nothing for a rating: the card's own answer is the only M€ a Venus step brings.
    seatEnacted(game.parliament!, quietResolutionOf(PartyName.UNITY));
    const card = new VenusContract();
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
    return game.cardReactions.filter((r) => r.seq > from && r.card === CardName.VENUS_CONTRACT)
      .map((r) => r.impacts.reduce((sum, i) => sum + (i.amount ?? 0), 0));
  }

  function contractFacts(facts: ReadonlyArray<EffectForecastFact>): Array<EffectForecastFact> {
    return facts.filter((f) => f.source.name === CardName.VENUS_CONTRACT);
  }

  function playFacts(player: TestPlayer, trigger: IProjectCard): Array<EffectForecastFact> {
    player.cardsInHand.push(trigger);
    return contractFacts(effectForecastForPlay(player, trigger, cardPlayPreview(player, trigger)).facts);
  }

  function amounts(facts: ReadonlyArray<EffectForecastFact>): Array<number> {
    return facts.map((f) => f.effects[0].amount);
  }

  /** Atmospheric Enhancers' preview and the position of its branch raising `icon`. */
  function enhancers(player: TestPlayer) {
    const ae = new AtmosphericEnhancers();
    const preview = cardPlayPreview(player, ae);
    const forecast = effectForecastForPlay(player, ae, preview);
    const positionOf = (icon: string) => preview.branches.findIndex((b) => b.effects.some((e) => e.icon === icon && e.direction === 'gain'));
    return {ae, preview, forecast, positionOf};
  }

  describe('the card as printed', () => {
    it('a Venus prelude, P65: a search for 1 Venus card + 1 TR; the description by the series\' bar', () => {
      const card = new VenusContract();
      expect(card.type).eq(CardType.PRELUDE);
      expect(card.tags).deep.eq([Tag.VENUS]);
      expect(card.metadata.cardNumber).eq('P65');
      expect(card.behavior).deep.eq({drawCard: {count: 1, tag: Tag.VENUS}, tr: 1});
      expect(card.metadata.description).eq('Draw 1 Venus card and raise your TR 1 step.');
    });
  });

  describe('the hook — 3 M€ per step YOU raise Venus', () => {
    it('one call of 2 steps: +6 M€ in ONE record, named in the journal', () => {
      const t = table();
      const from = lastSeq(t.game);
      const log = t.game.gameLog.length;
      t.game.increaseVenusScaleLevel(t.player, 2);
      expect(paid(t.game, from)).deep.eq([6]);
      expect(t.player.megaCredits).eq(6);
      const lines = t.game.gameLog.slice(log).filter((l) => l.data.some((d) => d.value === CardName.VENUS_CONTRACT));
      expect(lines, 'the standard «gained … because of» line names the card').to.have.lengthOf(1);
    });

    it('the Air Scrapping standard project (Venus +1): +3 M€ beside its price', () => {
      const t = table();
      t.player.megaCredits = 15;
      const project = new AirScrappingStandardProject();
      project.payAndExecute(t.player, Payment.of({megacredits: project.cost}));
      runAllActions(t.game);
      expect(t.game.getVenusScaleLevel()).eq(2);
      expect(t.player.megaCredits).eq(3);
    });

    it('the Venus Shuttles action (12 M€ − Venus tags → Venus +1): +3 M€', () => {
      const t = table();
      const shuttles = new VenusShuttles();
      t.player.playedCards.push(shuttles);
      t.player.megaCredits = 13;
      const price = 12 - t.player.tags.count(Tag.VENUS);
      cast(shuttles.action(t.player), undefined);
      runAllActions(t.game);
      expect(t.game.getVenusScaleLevel()).eq(2);
      expect(t.player.megaCredits, 'the price left, the card answered the step').eq(13 - price + 3);
    });

    it('Atmospheric Enhancers: the Venus branch (+2) → +6; the temperature and oxygen branches → 0', () => {
      for (const icon of ['venus', 'temperature', 'oxygen']) {
        const t = table();
        const {ae, preview, positionOf} = enhancers(t.player);
        const branch = preview.branches[positionOf(icon)];
        t.player.playCard(ae);
        runAllActions(t.game);
        cast(t.player.getWaitingFor(), OrOptions);
        t.player.process({type: 'or', index: branch.index, response: {type: 'option'}});
        runAllActions(t.game);
        expect(t.player.megaCredits, icon).eq(icon === 'venus' ? 6 : 0);
      }
    });

    it('at the ceiling: 28 % + 2 steps makes ONE step — +3, never +6', () => {
      const t = table();
      setVenusScaleLevel(t.game, 28);
      t.game.increaseVenusScaleLevel(t.player, 2);
      expect(t.game.getVenusScaleLevel()).eq(30);
      expect(t.player.megaCredits).eq(3);
    });

    it('the alternative board 16 → 18 %: the card pays its 3 AND the track\'s bonus is asked — two rewards, apart', () => {
      const t = table({altVenusBoard: true});
      setVenusScaleLevel(t.game, 16);
      t.game.increaseVenusScaleLevel(t.player, 1);
      expect(t.player.megaCredits, 'the card, before the bonus is answered').eq(3);
      expect(t.game.deferredActions.queuedFor(t.player).some((d) => d instanceof GrantVenusAltTrackBonusDeferred), 'the bonus is its own live step').is.true;
    });

    it('a resolution\'s WINNER raising Venus on the sitting (the rewarded step — WinnerParameterStep): +3 per step', () => {
      const t = table();
      const parliament = t.game.parliament!;
      seatResolution(parliament, 0, resolutionInstanceId(DEV_VENUS_STEP_RESOLUTION_ID, 0));
      parliament.placeVote(t.player, parliament.slots[0], 'lobby');
      setVenusScaleLevel(t.game, 10);
      const from = lastSeq(t.game);
      endGenerationThroughParliament(t.game);
      runAllActions(t.game);
      expect(t.game.getVenusScaleLevel()).eq(14);
      expect(paid(t.game, from), 'the card answered the winner\'s step').deep.eq([6]);
    });

    it('a WORLD move (`unrewarded` — a law\'s world step) and the World Government (SOLAR) pay nothing', () => {
      const t = table();
      t.game.increaseVenusScaleLevel(t.player, 1, {unrewarded: true});
      expect(t.player.megaCredits, 'world move').eq(0);
      t.game.phase = Phase.SOLAR;
      t.game.increaseVenusScaleLevel(t.player, 1);
      expect(t.player.megaCredits, 'World Government').eq(0);
      expect(t.game.getVenusScaleLevel()).eq(4);
    });

    it('Diverted Research (RX35) replaces no VENUS step (oxygen · temperature · greenery · ocean only): the scale moves, the card pays', () => {
      const t = table();
      seatEnacted(t.game.parliament!, resolutionInstanceId(DIVERTED_RESEARCH_ID, 0));
      t.game.increaseVenusScaleLevel(t.player, 1);
      expect(t.game.getVenusScaleLevel()).eq(2);
      expect(t.player.megaCredits).eq(3);
    });

    it('the UNMI veto (RX42) refuses the RATING, not the scale: the card pays +3, the TR stays', () => {
      const t = table();
      t.game.parliament!.enacted = resolutionInstanceId(UNMI_VETO_ID, 0);
      t.player.terraformRating = 30;
      t.rival.terraformRating = 20;
      t.game.increaseVenusScaleLevel(t.player, 1);
      expect(t.game.getVenusScaleLevel()).eq(2);
      expect(t.player.terraformRating).eq(30);
      expect(t.player.megaCredits).eq(3);
    });

    it('a RIVAL raising Venus pays the card nothing', () => {
      const t = table();
      const from = lastSeq(t.game);
      t.game.increaseVenusScaleLevel(t.rival, 2);
      expect(t.player.megaCredits).eq(0);
      expect(paid(t.game, from)).deep.eq([]);
    });

    it('MarsBot raising Venus pays the human\'s card nothing', () => {
      const [game, human, bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true});
      game.phase = Phase.ACTION;
      human.playedCards.push(new VenusContract());
      const mc = human.megaCredits;
      game.increaseVenusScaleLevel(bot, 1);
      expect(human.megaCredits).eq(mc);
    });

    it('the ruling Greens beside the card: one Venus step, two answers (+2 the party for the rating, +3 the card)', () => {
      const t = table();
      t.game.parliament!.grantPartyEffect(t.player, PartyName.GREENS as ReduxParty, 'test');
      const from = lastSeq(t.game);
      t.game.increaseVenusScaleLevel(t.player, 1);
      expect(paid(t.game, from)).deep.eq([3]);
      expect(t.player.megaCredits).eq(5);
    });
  });

  describe('the forecast twin — the scale pass, the raiser\'s own steps only', () => {
    it('Spin-Inducing Asteroid (Venus +2): ONE exact fact on the effect row, «+6 M€»', () => {
      const t = table();
      const facts = playFacts(t.player, new SpinInducingAsteroid());
      expect(facts).to.have.lengthOf(1);
      const fact = facts[0];
      expect(fact.certainty).eq('exact');
      expect(fact.source).deep.eq({kind: 'card', name: CardName.VENUS_CONTRACT, owner: t.player.color, channel: 'global-parameter', printedEffect: 0});
      expect(fact.recipient).deep.eq({kind: 'you'});
      expect(fact.reason).eq('You raise Venus a step');
      expect(fact.effects.map((e) => [e.direction, e.icon, e.amount])).deep.eq([['gain', Resource.MEGACREDITS, 6]]);
    });

    it('a card that raises no Venus forecasts NOTHING', () => {
      expect(playFacts(table().player, new ReleaseOfInertGases())).deep.eq([]);
    });

    it('Atmospheric Enhancers: the +6 lives in the VENUS branch alone — never in the play\'s facts, never on another branch', () => {
      const t = table();
      const {forecast, positionOf} = enhancers(t.player);
      const venus = positionOf('venus');
      expect(contractFacts(forecast.facts), 'not the play\'s — it depends on the branch').deep.eq([]);
      for (const [pos, list] of Object.entries(forecast.byBranch ?? {})) {
        expect(amounts(contractFacts(list)), `branch ${pos}`).deep.eq(Number(pos) === venus ? [6] : []);
      }
      expect(amounts(contractFacts(forecast.byBranch?.[venus] ?? []))).deep.eq([6]);
    });

    it('the ceiling: 28 % promises ONE step (+3) — the promise equals the payout', () => {
      const t = table();
      setVenusScaleLevel(t.game, 28);
      const promised = amounts(playFacts(t.player, new SpinInducingAsteroid()));
      t.player.playCard(new SpinInducingAsteroid());
      runAllActions(t.game);
      expect(promised).deep.eq([3]);
      expect(t.player.megaCredits).eq(3);
    });

    it('at 30 % nothing is promised (the chip moves nothing)', () => {
      const t = table();
      setVenusScaleLevel(t.game, 30);
      expect(playFacts(t.player, new SpinInducingAsteroid())).deep.eq([]);
    });

    it('the Venus Shuttles action: «+3 M€» promised', () => {
      const t = table();
      const shuttles = new VenusShuttles();
      t.player.playedCards.push(shuttles);
      t.player.megaCredits = 13;
      expect(amounts(contractFacts(effectForecastForAction(t.player, shuttles, actionPreview(t.player, shuttles)).facts))).deep.eq([3]);
    });

    it('RX42: the scale still moves — the card\'s +6 is still promised (only the rating is struck)', () => {
      const t = table();
      t.game.parliament!.enacted = resolutionInstanceId(UNMI_VETO_ID, 0);
      t.player.terraformRating = 30;
      t.rival.terraformRating = 20;
      expect(amounts(playFacts(t.player, new SpinInducingAsteroid()))).deep.eq([6]);
    });

    it('a rival\'s Venus Contract does not answer the actor\'s raise; the twin is silent for anyone but the raiser', () => {
      const t = table();
      t.player.playedCards.remove(t.card);
      t.rival.playedCards.push(new VenusContract());
      expect(playFacts(t.player, new SpinInducingAsteroid())).deep.eq([]);
      expect(new VenusContract().grantForecast(t.rival, t.player, {kind: 'global', parameter: GlobalParameter.VENUS, steps: 2})).deep.eq([]);
    });

    it('the Greens and the card on one Venus step: both stated', () => {
      const t = table();
      t.game.parliament!.grantPartyEffect(t.player, PartyName.GREENS as ReduxParty, 'test');
      const trigger = new SpinInducingAsteroid();
      t.player.cardsInHand.push(trigger);
      const forecast = effectForecastForPlay(t.player, trigger, cardPlayPreview(t.player, trigger));
      expect(forecast.facts.some((f) => f.id.endsWith('greens-tr'))).is.true;
      expect(amounts(contractFacts(forecast.facts))).deep.eq([6]);
    });
  });
});
