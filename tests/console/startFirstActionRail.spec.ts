import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {PlayerViewModel} from '../../src/common/models/PlayerModel';
import {ActionPreviewBranch} from '../../src/common/models/ActionPreviewModel';
import {EffectForecast, EffectForecastFact, emptyEffectForecast} from '../../src/common/models/EffectForecastModel';
import {
  armFirstActionRail, cardAnswerSpecs, firstActionRailBusy, firstActionRailOf, firstActionRailState, releaseFirstActionRail, resetFirstActionRail,
  seedFirstActionRail,
} from '../../src/client/console/startFirstActionRail';
import {resetRailRewards, railRewardPending} from '../../src/client/console/resourceTransfer/railReward';
import {takeDeclaredAnswers} from '../../src/client/console/resourceTransfer/consoleResourceTransfer';

/**
 * THE FIRST ACTION'S RAIL HALF (TR81 Lotus Innovations — the start stage as the third ATTACHED host of the
 * card-reaction framework): the half is the action's own rail gains (a rating split into one token per printed plate)
 * and the table's answer (its rail rows and its capsule rows — Lotus' data on itself), armed at the press, held in the
 * apply block that pays it, DECLARED there so the reaction seeder attaches the reactor to the stage.
 */
const LOTUS = CardName.LOTUS_INNOVATIONS;

function branch(trAmount: number): ActionPreviewBranch {
  return {index: -1, title: '', available: true, renderKeys: [], steps: [],
    effects: [{direction: 'gain', icon: 'tr', amount: trAmount, current: 20, resulting: 20 + trAmount}]};
}

function lotusFact(amount: number, over: Partial<EffectForecastFact> = {}): EffectForecastFact {
  return {
    id: 'blue-lotus', source: {kind: 'corporation', name: LOTUS, owner: 'blue', channel: 'tr-increase', printedEffect: 0},
    certainty: 'exact', recipient: {kind: 'you'}, timing: 'immediate', reason: 'You raise your terraform rating',
    effects: [{direction: 'gain', icon: 'data', amount, current: 0, resulting: amount, note: 'on this card', host: LOTUS}],
    ...over,
  };
}

function forecastOf(...facts: Array<EffectForecastFact>): EffectForecast {
  return {...emptyEffectForecast(), facts};
}

function view(rating: number, data: number): PlayerViewModel {
  return {
    id: 'p-blue',
    thisPlayer: {color: 'blue', terraformRating: rating, megacredits: 46, tableau: [{name: LOTUS, resources: data}]},
  } as unknown as PlayerViewModel;
}

describe('startFirstActionRail — the first action\'s rail half', () => {
  afterEach(() => {
    resetFirstActionRail();
    resetRailRewards();
    takeDeclaredAnswers();
  });

  it('cardAnswerSpecs: an exact fact addressed to «you» that lays a card resource on a NAMED host is a capsule row', () => {
    expect(cardAnswerSpecs([lotusFact(2)])).deep.eq([{channel: 'card-resource', resource: 'data', amount: 2, targetCard: LOTUS}]);
    expect(cardAnswerSpecs([lotusFact(2, {certainty: 'deferred'})]), 'a promise that may not land holds nothing').deep.eq([]);
    expect(cardAnswerSpecs([lotusFact(2, {recipient: {kind: 'player', color: 'red'}})]), 'another seat\'s gain is theirs').deep.eq([]);
    const hostless = lotusFact(1);
    hostless.effects = [{...hostless.effects[0], host: undefined}];
    expect(cardAnswerSpecs([hostless]), 'a target still to be chosen is no row').deep.eq([]);
  });

  it('firstActionRailOf: the rating split into ONE TOKEN PER PLATE (two plates, two tokens) + the reactor\'s capsule row', () => {
    const rail = firstActionRailOf(LOTUS, branch(2), forecastOf(lotusFact(2)));
    expect(rail?.key).eq(`first-action:${LOTUS}`);
    expect(rail?.reward.cause).deep.eq([
      {channel: 'stock', resource: 'rating', amount: 1},
      {channel: 'stock', resource: 'rating', amount: 1},
    ]);
    expect(rail?.reward.reactions).deep.eq([{channel: 'card-resource', resource: 'data', amount: 2, targetCard: LOTUS}]);
  });

  it('firstActionRailOf: an action that pays the rail nothing has no half (a draw, a placement keep their own scenes)', () => {
    const draw: ActionPreviewBranch = {...branch(0), effects: [{direction: 'gain', icon: 'cards', amount: 3, note: 'draw'}]};
    expect(firstActionRailOf(CardName.INVENTRIX, draw, undefined)).is.undefined;
    expect(firstActionRailOf(LOTUS, undefined, forecastOf(lotusFact(2)))).is.undefined;
  });

  it('ARM → a view that paid nothing yet keeps it armed (owed) → the paying view SEEDS it and declares the answer', () => {
    armFirstActionRail(firstActionRailOf(LOTUS, branch(2), forecastOf(lotusFact(2))));
    expect(firstActionRailState.phase).eq('armed');
    seedFirstActionRail(view(20, 0), view(20, 0));
    expect(firstActionRailState.phase, 'an echo of the press\'s own state is not the answer').eq('armed');
    seedFirstActionRail(view(20, 0), view(22, 2));
    expect(firstActionRailState.phase).eq('seeded');
    expect(railRewardPending(`first-action:${LOTUS}`)).is.true;
    expect(firstActionRailBusy()).is.true;
    expect(takeDeclaredAnswers().map((s) => [s.channel, s.resource, s.amount])).deep.eq([['card-resource', 'data', 2]]);
  });

  it('a view that moved otherwise holds nothing and ends the half (named by the rail module); a release ticks what is held', () => {
    armFirstActionRail(firstActionRailOf(LOTUS, branch(2), forecastOf(lotusFact(2))));
    seedFirstActionRail(view(20, 0), view(21, 0));
    expect(firstActionRailState.phase).eq('idle');
    expect(firstActionRailBusy()).is.false;

    armFirstActionRail(firstActionRailOf(LOTUS, branch(2), forecastOf(lotusFact(2))));
    seedFirstActionRail(view(20, 0), view(22, 2));
    releaseFirstActionRail('stage left');
    expect(firstActionRailState.phase).eq('idle');
    expect(railRewardPending(`first-action:${LOTUS}`)).is.false;
  });
});
