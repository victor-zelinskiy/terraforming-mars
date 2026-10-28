import {expect} from 'chai';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {CardReactionRecord} from '@/common/models/CardReactionModel';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {
  TABLE_ANSWER_RESERVATION, detectTableAnswerPayout, detectTableAnswers, forgetTableAnswerTold, noteTableAnswerTold, resetTableAnswerBeat, seedTableAnswers,
  tableAnswerAskOf, tableAnswerHostFor, tableAnswerOf, tableAnswerOwedTo, tableAnswerState, takeTableAnswer,
} from '@/client/console/parliament/tableAnswerBeat';
import {cardReactionAnswerFlight, cardReactionPending, resetCardReactions, seedCardReactionHolds, snapshotRailHolds} from '@/client/console/cardReaction/cardReactionDirector';
import {heldCardResource, takeDeclaredAnswers} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {reduceMotionOverrideState} from '@/client/utils/reducedMotion';

/*
 * «ОТВЕТ СТОЛА» (TR78 Arwind Inc.) — the PURE half of the answer stage's beat: DETECT off the server's reaction record
 * (the walk as its cause), the HOST by the cause, the SEED (held + declared, or told by the player's own scene), the
 * QUESTION off the prompt's marker (the pick and the layout alike).
 */
const BLUE = 'blue';
const ARWIND = CardName.ARWIND_INC;
const SHIPS = CardName.MARS_ARMY_SHIPS;

function record(over: Partial<CardReactionRecord> = {}): CardReactionRecord {
  return {
    seq: 7,
    root: {actionId: 40, player: BLUE as never},
    owner: BLUE as never,
    kind: 'corporation',
    card: ARWIND,
    channel: 'agenda-step',
    cause: {walk: {reason: 'phase', from: 1, to: 2}},
    impacts: [{kind: 'card-resource', resource: CardResource.FIGHTER, amount: 1, target: ARWIND, to: BLUE as never}],
    ...over,
  };
}

function view(records: ReadonlyArray<CardReactionRecord>, counts: Partial<Record<string, number>> = {}, waitingFor?: PlayerInputModel): PlayerViewModel {
  return {
    thisPlayer: {color: BLUE, tableau: [{name: ARWIND, resources: counts[ARWIND] ?? 0}, {name: SHIPS, resources: counts[SHIPS] ?? 0}]},
    game: {generation: 3, cardReactions: records, parliament: {phase: {generation: 3, step: 'support'}}},
    players: [],
    waitingFor,
  } as unknown as PlayerViewModel;
}

const STANDS = {questLive: false, sittingAhead: true, walkHost: false};

describe('tableAnswerBeat — a card of the table answers a walk of the Career, on one stage', () => {
  beforeEach(() => {
    resetTableAnswerBeat();
    takeDeclaredAnswers();
  });
  afterEach(() => {
    resetTableAnswerBeat();
    resetCardReactions();
    takeDeclaredAnswers();
    reduceMotionOverrideState.enabled = false;
  });

  it('DETECT: the viewer\'s fresh reaction record of the agenda-step channel whose cause names a walk is an answer — every recipient with its before/after', () => {
    const before = view([], {[ARWIND]: 0, [SHIPS]: 1});
    const after = view([record({impacts: [
      {kind: 'card-resource', resource: CardResource.FIGHTER, amount: 1, target: ARWIND, to: BLUE as never},
      {kind: 'card-resource', resource: CardResource.FIGHTER, amount: 2, target: SHIPS, to: BLUE as never},
    ]})], {[ARWIND]: 1, [SHIPS]: 3});
    const [answer] = detectTableAnswers(before, after);
    expect(answer).is.not.undefined;
    expect(answer.asker).eq(ARWIND);
    expect(answer.cause).eq('phase');
    expect(answer.walk).deep.eq({from: 1, to: 2});
    expect(answer.amount).eq(3);
    expect(answer.resource).eq('fighter');
    expect(answer.cards.map((c) => [c.card, c.before, c.amount])).deep.eq([[ARWIND, 0, 1], [SHIPS, 1, 2]]);
    expect(answer.specs.map((s) => `${s.targetCard}:${s.resource}+${s.amount}`)).deep.eq([`${ARWIND}:fighter+1`, `${SHIPS}:fighter+2`]);
  });

  it('DETECT refuses: a first view (nothing to move from), a record already known, another channel, no walk cause, another seat', () => {
    const known = record({seq: 3});
    const fresh = record({seq: 7});
    expect(detectTableAnswers(undefined, view([fresh])), 'a reload').deep.eq([]);
    expect(detectTableAnswers(view([known]), view([known])), 'known').deep.eq([]);
    expect(detectTableAnswers(view([]), view([record({channel: 'card-played'})])), 'another channel').deep.eq([]);
    expect(detectTableAnswers(view([]), view([record({cause: {card: CardName.TREES}})])), 'no walk').deep.eq([]);
    expect(tableAnswerOf(record({owner: 'red' as never}), view([]), view([])), 'a rival\'s').is.undefined;
  });

  it('THE HOST follows the cause: the quest\'s flow, the sitting (standing or ahead), a card\'s walk with a host — else nobody', () => {
    const after = view([]);
    expect(tableAnswerHostFor('quest', after, {questLive: true, sittingAhead: false, walkHost: false})).eq('quest');
    expect(tableAnswerHostFor('quest', after, {questLive: false, sittingAhead: true, walkHost: true})).is.undefined;
    expect(tableAnswerHostFor('phase', after, {questLive: false, sittingAhead: true, walkHost: false})).eq('sitting');
    expect(tableAnswerHostFor('resolution', after, {questLive: false, sittingAhead: true, walkHost: false})).eq('sitting');
    expect(tableAnswerHostFor('phase', after, {questLive: true, sittingAhead: false, walkHost: true})).is.undefined;
    expect(tableAnswerHostFor('card', after, {questLive: false, sittingAhead: false, walkHost: true})).eq('walk');
    expect(tableAnswerHostFor('card', after, {questLive: true, sittingAhead: true, walkHost: false})).is.undefined;
  });

  it('SEED: an answer a host stands to play is HELD on its capsules and DECLARED to the reaction seeder, and owed to that host', () => {
    seedTableAnswers(view([], {[ARWIND]: 0}), view([record()], {[ARWIND]: 1}), STANDS);
    expect(tableAnswerOwedTo('sitting', 'phase')).eq(true);
    expect(tableAnswerOwedTo('quest')).eq(false);
    expect(heldCardResource('fighter'), 'the capsule row is held').eq(1);
    expect(takeDeclaredAnswers().map((s) => `${s.targetCard}+${s.amount}`), 'declared — the record attaches to this stage').deep.eq([`${ARWIND}+1`]);
    const taken = takeTableAnswer('sitting', 'phase');
    expect(taken?.asker).eq(ARWIND);
    expect(tableAnswerState.showing?.key).eq('answer:7');
    expect(tableAnswerOwedTo('sitting')).eq(false);
  });

  it('SEED → the reaction seeder: the record is ATTACHED to the stage and RESERVED for it — the play scene\'s claim of «every attached group» finds nothing, the stage\'s own flight takes it', () => {
    const heldBefore = snapshotRailHolds();
    const before = view([], {[ARWIND]: 0});
    const after = view([record()], {[ARWIND]: 1});
    seedTableAnswers(before, after, STANDS);
    seedCardReactionHolds(before, after, heldBefore);
    expect(cardReactionPending(), 'no standalone chain — the stage owns the record').is.false;
    expect(cardReactionAnswerFlight(), 'the unfiltered claim skips the stage\'s group').is.undefined;
    const flight = cardReactionAnswerFlight({rows: ['card-resource:fighter'], reserved: TABLE_ANSWER_RESERVATION});
    expect(flight, 'the stage\'s flight takes it').is.not.undefined;
    flight?.onDone?.();
  });

  it('TOLD → the reaction seeder: an answer the player gave on stage (the live pick\'s receive) is attributed by its declaration alone — nothing held, no second scene, no host\'s flight takes it', () => {
    noteTableAnswerTold(ARWIND, [{channel: 'card-resource', resource: 'fighter', amount: 1, targetCard: SHIPS}]);
    const toldBefore = view([], {[SHIPS]: 0});
    const toldAfter = view([record({seq: 8, impacts: [{kind: 'card-resource', resource: CardResource.FIGHTER, amount: 1, target: SHIPS, to: BLUE as never}]})], {[SHIPS]: 1});
    seedTableAnswers(toldBefore, toldAfter, STANDS);
    seedCardReactionHolds(toldBefore, toldAfter, snapshotRailHolds());
    expect(heldCardResource('fighter'), 'nothing held — the scene flew it').eq(0);
    expect(cardReactionPending(), 'no second scene for an answer the player gave').is.false;
    expect(cardReactionAnswerFlight(), 'no host\'s flight takes it').is.undefined;
    expect(cardReactionAnswerFlight({rows: ['card-resource:fighter'], reserved: TABLE_ANSWER_RESERVATION}), 'not the stage\'s either').is.undefined;
    forgetTableAnswerTold();
  });

  it('SEED: nobody standing → nothing held, nothing declared (the framework\'s own chain keeps the record)', () => {
    seedTableAnswers(view([]), view([record()]), {questLive: false, sittingAhead: false, walkHost: false});
    expect(tableAnswerOwedTo('sitting')).eq(false);
    expect(heldCardResource('fighter')).eq(0);
    expect(takeDeclaredAnswers()).deep.eq([]);
  });

  it('TOLD: an answer the player gave on stage (the receive scene) is declared only — never owed a second time', () => {
    noteTableAnswerTold(ARWIND, [{channel: 'card-resource', resource: 'fighter', amount: 1, targetCard: SHIPS}]);
    seedTableAnswers(view([]), view([record({impacts: [{kind: 'card-resource', resource: CardResource.FIGHTER, amount: 1, target: SHIPS, to: BLUE as never}]})]), STANDS);
    expect(tableAnswerOwedTo('sitting')).eq(false);
    expect(heldCardResource('fighter'), 'nothing held — the scene already flew it').eq(0);
    expect(takeDeclaredAnswers().map((s) => s.targetCard), 'declared, so the reaction seeder attributes the record').deep.eq([SHIPS]);
    // The note is consumed by the seed: the next walk's answer is owed as usual.
    seedTableAnswers(view([]), view([record({seq: 8})]), STANDS);
    expect(tableAnswerOwedTo('sitting')).eq(true);
    forgetTableAnswerTold();
  });

  it('SEED under reduced motion owes nothing (the counters tick with the commit)', () => {
    reduceMotionOverrideState.enabled = true;
    seedTableAnswers(view([]), view([record()]), STANDS);
    expect(tableAnswerOwedTo('sitting')).eq(false);
    expect(heldCardResource('fighter')).eq(0);
  });

  it('THE QUESTION off the marker: the family\'s pick and its LAYOUT alike, never a card\'s own walk (the composer\'s)', () => {
    const pick = {
      type: 'card', cards: [], resourceGainPrompt: {amount: 1, cardResource: 'fighter'},
      agendaWalkPrompt: {source: ARWIND, reason: 'quest', from: 1, to: 2},
    } as unknown as PlayerInputModel;
    expect(tableAnswerAskOf(pick)).deep.eq({asker: ARWIND, cause: 'quest', resource: 'fighter', amount: 1});
    const layout = {
      type: 'and', options: [], cardResourceDistributionPrompt: {amount: 3, cardResource: 'fighter', cards: []},
      agendaWalkPrompt: {source: ARWIND, reason: 'resolution', resolution: 'RDX_REDS_BUDGET', from: 0, to: 3},
    } as unknown as PlayerInputModel;
    expect(tableAnswerAskOf(layout)).deep.eq({asker: ARWIND, cause: 'resolution', resource: 'fighter', amount: 3});
    const own = {type: 'card', cards: [], resourceGainPrompt: {amount: 1, cardResource: 'fighter'}, agendaWalkPrompt: {source: ARWIND, reason: 'card', from: 0, to: 1}} as unknown as PlayerInputModel;
    expect(tableAnswerAskOf(own), 'a card\'s walk: the composer\'s question, served where any live pick is').is.undefined;
    expect(tableAnswerAskOf({type: 'card', cards: []} as unknown as PlayerInputModel)).is.undefined;
  });

  it('THE LAYOUT\'S ANSWER GIVEN ON STAGE: the standing layout + the asker\'s fresh record over its candidates is the payout event', () => {
    const layout = {
      type: 'and', options: [],
      cardResourceDistributionPrompt: {amount: 2, cardResource: 'fighter', cards: [{name: ARWIND}, {name: SHIPS}]},
      agendaWalkPrompt: {source: ARWIND, reason: 'phase', from: 1, to: 3},
    } as unknown as PlayerInputModel;
    const before = view([], {}, layout);
    const after = view([record({impacts: [
      {kind: 'card-resource', resource: CardResource.FIGHTER, amount: 1, target: ARWIND, to: BLUE as never},
      {kind: 'card-resource', resource: CardResource.FIGHTER, amount: 1, target: SHIPS, to: BLUE as never},
    ]})]);
    const event = detectTableAnswerPayout(before, after);
    expect(event?.asker).eq(ARWIND);
    expect(event?.targets.map((t) => `${t.card}:${t.resource}+${t.amount}`)).deep.eq([`${ARWIND}:fighter+1`, `${SHIPS}:fighter+1`]);
    // A recipient outside the layout's candidates is no event (the chips land on what the player saw).
    const stray = view([record({impacts: [{kind: 'card-resource', resource: CardResource.FIGHTER, amount: 2, target: CardName.PETS, to: BLUE as never}]})]);
    expect(detectTableAnswerPayout(before, stray)).is.undefined;
    // A pick (not a layout) is the receive scene's, never this gate's.
    const pick = {type: 'card', cards: [], agendaWalkPrompt: {source: ARWIND, reason: 'phase', from: 1, to: 2}} as unknown as PlayerInputModel;
    expect(detectTableAnswerPayout(view([], {}, pick), after)).is.undefined;
  });
});
