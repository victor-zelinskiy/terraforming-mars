import {expect} from 'chai';
import {Resource} from '@/common/Resource';
import {CardReactionRecord} from '@/common/models/CardReactionModel';
import {
  CARD_REACTION_SCOPE_CHOICES,
  CARD_REACTION_SCOPE_LABELS,
  cardReactionScopeState,
  reactionReachesViewer,
  rivalReactionShown,
  setCardReactionScope,
} from '@/client/console/cardReaction/cardReactionScope';
import {reactionTold, registerReactionScenePlays} from '@/client/console/cardReaction/reactionToldOnStage';
import {CardName} from '@/common/cards/CardName';

/*
 * WHOSE card reactions the board plays (the players' report of 2026-11-07): by default only the ones that reach the
 * viewer; a rival's reactor the scope skips is never «told by the scene» to the feed — its card stays (no silent loss).
 */
describe('cardReactionScope', () => {
  afterEach(() => {
    setCardReactionScope('mine');
    registerReactionScenePlays(() => false);
  });

  const BLUE = 'blue';
  const redOnly: Pick<CardReactionRecord, 'owner' | 'impacts'> = {owner: 'red', impacts: [{kind: 'stock', resource: Resource.MEGACREDITS, amount: 3, to: 'red'}]};

  it('defaults to the viewer\'s own reactions; the ring is mine → all with existing i18n keys', () => {
    expect(cardReactionScopeState.scope).eq('mine');
    expect(CARD_REACTION_SCOPE_CHOICES).deep.eq(['mine', 'all']);
    expect(CARD_REACTION_SCOPE_LABELS).deep.eq({mine: 'Only involving me', all: 'All players'});
  });

  it('a record REACHES the viewer when the viewer owns it or any impact is addressed to them — a loss or a refused unit included', () => {
    expect(reactionReachesViewer(redOnly, BLUE)).is.false;
    expect(reactionReachesViewer({owner: BLUE, impacts: []}, BLUE)).is.true;
    expect(reactionReachesViewer({owner: 'red', impacts: [...redOnly.impacts, {kind: 'stock', resource: Resource.PLANTS, amount: -1, to: BLUE}]}, BLUE)).is.true;
    expect(reactionReachesViewer({owner: 'red', impacts: [{kind: 'skip', icon: 'tr', amount: 1, to: BLUE}]}, BLUE)).is.true;
    expect(reactionReachesViewer(redOnly, undefined), 'no seat — nothing reaches').is.false;
  });

  it('a rival\'s reactor paying only its own seat rises only under «all»', () => {
    expect(rivalReactionShown(redOnly, BLUE)).is.false;
    setCardReactionScope('all');
    expect(rivalReactionShown(redOnly, BLUE)).is.true;
    expect(rivalReactionShown(redOnly, BLUE, 'mine'), 'an explicit scope wins').is.false;
  });

  it('the feed asks the scene ABOUT THE SEAT: a law paying a rival the scene skips keeps its card', () => {
    const ring: Array<CardReactionRecord> = [{
      seq: 1, root: {actionId: 7}, owner: 'red', kind: 'resolution', card: 'RX01' as CardName, channel: 'tile-placed',
      impacts: [{kind: 'stock', resource: Resource.MEGACREDITS, amount: 2, to: 'red'}],
    }];
    registerReactionScenePlays((owner) => owner === undefined || owner === BLUE);
    expect(reactionTold(ring, 7, 'red', 'RX01'), 'skipped → not told').is.false;
    registerReactionScenePlays(() => true);
    expect(reactionTold(ring, 7, 'red', 'RX01'), 'played → told').is.true;
  });
});
