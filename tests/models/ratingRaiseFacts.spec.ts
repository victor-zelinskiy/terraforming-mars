import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {ICard} from '../../src/server/cards/ICard';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {CardName} from '../../src/common/cards/CardName';
import {Phase} from '../../src/common/Phase';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {GlobalParameter} from '../../src/common/GlobalParameter';
import {TileType} from '../../src/common/TileType';
import {ReduxParty, resolutionInstanceId} from '../../src/common/parliament/ParliamentTypes';
import {UNMI_VETO_ID} from '../../src/server/parliament/resolutions/reds/UnmiVeto';
import {LotusInnovations} from '../../src/server/cards/turmoilRedux/LotusInnovations';
import {ReleaseOfInertGases} from '../../src/server/cards/base/ReleaseOfInertGases';
import {SpinInducingAsteroid} from '../../src/server/cards/venusNext/SpinInducingAsteroid';
import {IceAsteroid} from '../../src/server/cards/base/IceAsteroid';
import {Comet} from '../../src/server/cards/base/Comet';
import {Mangrove} from '../../src/server/cards/base/Mangrove';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {effectForecastForPlay, ratingStepsOf, rewardReactionFacts, worldMoveForecast} from '../../src/server/models/effectForecast';
import {EffectForecastFact} from '../../src/common/models/EffectForecastModel';
import {globalGain} from '../../src/server/cards/actionPreviews';
import * as forecast from '../../src/server/cards/effectForecastPreviews';
import {fakeCard, setVenusScaleLevel} from '../TestingUtils';

/**
 * THE RATING PASS (TR81 Lotus Innovations) — the operation's rating (`ratingStepsOf`, the ONE sum the ruling Greens
 * are paid on) offered as ONE `tr` grant to every seat's `onIncreaseTerraformRatingByAnyPlayer` reactors, in the live
 * funnel's walk (`Player.increaseTerraformRating`): the press's own steps `exact`, a placed tile's after the placement
 * (`deferred`), a world move nobody's, a reactor without its twin ONE honest `unknown`.
 */
type Table = {game: IGame, player: TestPlayer, rival: TestPlayer, lotus: LotusInnovations};

function table(): Table {
  const [game, player, rival] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true});
  game.phase = Phase.ACTION;
  const lotus = new LotusInnovations();
  player.playedCards.push(lotus);
  player.megaCredits = 100;
  return {game, player, rival, lotus};
}

function factsOf(player: TestPlayer, trigger: IProjectCard): ReadonlyArray<EffectForecastFact> {
  player.cardsInHand.push(trigger);
  return effectForecastForPlay(player, trigger, cardPlayPreview(player, trigger)).facts;
}

function lotusOf(facts: ReadonlyArray<EffectForecastFact>): Array<[string, string, number]> {
  return facts.filter((f) => f.source.name === CardName.LOTUS_INNOVATIONS).map((f) => [f.certainty, f.timing, f.effects[0]?.amount ?? 0]);
}

/** A reactor of «any player gains TR» on `owner`'s table — with or without its twin. */
function watcher(name: string, twin: boolean): ICard {
  const card = fakeCard({name: name as CardName});
  Object.assign(card, {onIncreaseTerraformRatingByAnyPlayer: () => {}});
  if (twin) {
    Object.assign(card, {
      grantForecast: (owner: TestPlayer, _active: TestPlayer, grant: {kind: string, amount?: number}) =>
        grant.kind === 'tr' ? [forecast.exact(forecast.sourceOf(card, owner, 'tr-increase'), [], 'watched')] : [],
    });
  }
  return card;
}

describe('the rating pass (ratingRaiseFacts)', () => {
  it('an explicit TR chip: one exact fact of the raiser\'s own reactor', () => {
    const t = table();
    expect(lotusOf(factsOf(t.player, new ReleaseOfInertGases()))).deep.eq([['exact', 'immediate', 2]]);
  });

  it('a scale step is a rating step — and the bonus step a raise crosses is one more (Venus 16 %)', () => {
    const t = table();
    expect(lotusOf(factsOf(t.player, new SpinInducingAsteroid())), 'two Venus steps').deep.eq([['exact', 'immediate', 2]]);
    const u = table();
    setVenusScaleLevel(u.game, 12);
    expect(lotusOf(factsOf(u.player, new SpinInducingAsteroid())), '12 → 16 %: two steps + the 16 % rating').deep.eq([['exact', 'immediate', 3]]);
  });

  it('a placed tile\'s step lands after the placement — deferred (two oceans → 2; a scale step + an ocean → 1 now, 1 after)', () => {
    const t = table();
    expect(lotusOf(factsOf(t.player, new IceAsteroid()))).deep.eq([['deferred', 'after-placement', 2]]);
    const u = table();
    expect(lotusOf(factsOf(u.player, new Comet()))).deep.eq([['exact', 'immediate', 1], ['deferred', 'after-placement', 1]]);
  });

  it('the veto: a seat first by rating gains nothing — no fact', () => {
    const t = table();
    t.game.parliament!.enacted = resolutionInstanceId(UNMI_VETO_ID, 0);
    t.player.terraformRating = 30;
    t.rival.terraformRating = 20;
    expect(lotusOf(factsOf(t.player, new ReleaseOfInertGases()))).deep.eq([]);
    expect(lotusOf(factsOf(t.player, new IceAsteroid()))).deep.eq([]);
  });

  it('a WORLD move raises nobody\'s rating — nothing', () => {
    const t = table();
    const world = worldMoveForecast(t.player, [{parameter: 'venus', steps: 2, terraformRating: false}]);
    expect((world?.facts ?? []).filter((f) => f.source.name === CardName.LOTUS_INNOVATIONS)).deep.eq([]);
  });

  it('a reward outside a composer (a standard asteroid\'s degree) is answered the same way', () => {
    const t = table();
    const facts = rewardReactionFacts(t.player, undefined, [globalGain(t.player, 'temperature', 1)]);
    expect(lotusOf(facts)).deep.eq([['exact', 'immediate', 1]]);
  });

  it('EVERY seat\'s reactors are asked: a rival\'s «any player gains TR» answers the raiser\'s gain, addressed to the rival; a rival\'s Lotus answers nothing', () => {
    const t = table();
    t.rival.playedCards.push(watcher('Rating Watcher', true));
    t.rival.playedCards.push(new LotusInnovations());
    const facts = factsOf(t.player, new ReleaseOfInertGases());
    const watched = facts.filter((f) => f.source.name === 'Rating Watcher');
    expect(watched.map((f) => [f.certainty, f.recipient])).deep.eq([['exact', {kind: 'player', color: t.rival.color}]]);
    expect(facts.filter((f) => f.source.name === CardName.LOTUS_INNOVATIONS && f.source.owner === t.rival.color)).deep.eq([]);
  });

  it('a reactor with the live hook and no twin is ONE honest unknown per card (never per grant)', () => {
    const t = table();
    t.player.playedCards.push(watcher('Silent Watcher', false));
    const facts = factsOf(t.player, new Comet()).filter((f) => f.source.name === 'Silent Watcher');
    expect(facts.map((f) => [f.certainty, f.source.channel])).deep.eq([['unknown', 'tr-increase']]);
  });

  it('the Greens and a reactor on one raise read ONE sum — now and after the placement', () => {
    const t = table();
    t.game.parliament!.grantPartyEffect(t.player, PartyName.GREENS as ReduxParty, 'test');
    const facts = factsOf(t.player, new Comet());
    const greensNow = facts.find((f) => f.id.endsWith('greens-tr'))?.effects[0].amount;
    const greensPlaced = facts.find((f) => f.id.endsWith('greens-tr-placed'))?.effects[0].amount;
    expect([greensNow, greensPlaced]).deep.eq([2, 2]);
    expect(lotusOf(facts).map(([, , n]) => n)).deep.eq([1, 1]);
    const u = table();
    u.game.parliament!.grantPartyEffect(u.player, PartyName.GREENS as ReduxParty, 'test');
    const greenery = factsOf(u.player, new Mangrove());
    expect(greenery.find((f) => f.id.endsWith('greens-tr-placed'))?.effects[0].amount, 'the oxygen step + the Redux tile').eq(4);
    expect(lotusOf(greenery)).deep.eq([['deferred', 'after-placement', 2]]);
  });

  it('ratingStepsOf — the explicit grants + the scale steps now, the tiles after; a partial veto strikes the tiles\' steps first', () => {
    const t = table();
    const grants = [{kind: 'tr' as const, amount: 1}, {kind: 'global' as const, parameter: GlobalParameter.TEMPERATURE, steps: 1}];
    const ocean = {tileType: TileType.OCEAN, count: 1, countsAsCity: false, countsAsOcean: true, countsAsGreenery: false, offMars: false};
    expect(ratingStepsOf(t.player, grants, [], [])).deep.eq({now: 2, placed: 0});
    expect(ratingStepsOf(t.player, grants, [], [ocean])).deep.eq({now: 2, placed: 1});
    // One implied rating struck by the veto pass: it falls on the placed tile's step (the funnel judges it last).
    const struck = [{direction: 'gain' as const, icon: 'tr', amount: 1, implied: true, vetoed: {resolution: UNMI_VETO_ID, steps: 1}}];
    expect(ratingStepsOf(t.player, grants, struck, [ocean])).deep.eq({now: 2, placed: 0});
    // …and two struck: the tile's, then one of the press's own.
    const twice = [{...struck[0], amount: 2, vetoed: {resolution: UNMI_VETO_ID, steps: 2}}];
    expect(ratingStepsOf(t.player, grants, twice, [ocean])).deep.eq({now: 1, placed: 0});
    // An EXPLICIT struck chip made no grant already — it is never subtracted twice.
    const explicit = [{direction: 'gain' as const, icon: 'tr', amount: 2, vetoed: {resolution: UNMI_VETO_ID, steps: 2}}];
    expect(ratingStepsOf(t.player, grants, explicit, [])).deep.eq({now: 2, placed: 0});
  });
});
