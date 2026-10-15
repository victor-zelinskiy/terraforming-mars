import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardAdjacencyPayoutModel} from '@/common/models/CardAdjacencyPayoutModel';
import {
  armPromptReceive, detectPromptReceive, disarmPromptReceive, promptReceiveArmed, promptReceiveFamily, promptReceiveState,
} from '@/client/console/cardReceive/promptReceive';
import {resetCityPayoutClaims} from '@/client/console/tilePlacement/cityDataPayoutModel';
import {SpaceId} from '@/common/Types';

/**
 * THE LIVE «ON WHICH CARD» PICK — its answer is a scene (TR53 iteration, case 3). The family is read off the server's
 * markers only (the cell the units come from → field; a colony asks → colony; else the plate); the press is ARMED and
 * the answer DETECTED against the two views (the card took exactly the pick's amount) — the field family also needs
 * the server's `asked` record, never a diff; anything else disarms honestly (no pose left behind).
 */
const BLUE = 'blue' as Color;
const TARDI = CardName.TARDIGRADES;
const DECO = CardName.DECOMPOSERS;

function pick(over: Record<string, unknown> = {}, meta: Record<string, unknown> = {}) {
  return {
    type: 'card', title: 'Select a card', buttonLabel: 'Add resource', min: 1, max: 1,
    cards: [{name: TARDI, resources: 1}, {name: DECO, resources: 0}],
    resourceGainPrompt: {amount: 1, cardResource: 'microbe', ...meta},
    ...over,
  };
}

function view(waitingFor: unknown, counts: Record<string, number>, payouts: ReadonlyArray<CardAdjacencyPayoutModel> = []): PlayerViewModel {
  return {
    thisPlayer: {color: BLUE, tableau: Object.entries(counts).map(([name, resources]) => ({name, resources}))},
    game: {cardAdjacencyPayouts: payouts},
    waitingFor,
  } as unknown as PlayerViewModel;
}

const record = (over: Partial<CardAdjacencyPayoutModel> = {}): CardAdjacencyPayoutModel => ({
  seq: 501, cause: 'space-bonus', color: BLUE, spaceId: '08' as SpaceId, neighbours: [{spaceId: '08' as SpaceId, units: 1}],
  target: DECO, resource: 'Microbe' as CardAdjacencyPayoutModel['resource'], amount: 1, before: 0, asked: true, ...over,
});

describe('promptReceive — the live pick\'s answer is a scene', () => {
  beforeEach(() => {
    disarmPromptReceive();
    resetCityPayoutClaims();
  });

  it('the family is the server\'s markers: a cell → field, a colony → colony, a card → plate; a resolution keeps its own gate', () => {
    expect(promptReceiveFamily(pick({}, {fromSpace: '08'}) as never)).eq('field');
    expect(promptReceiveFamily(pick({choiceContext: {source: {kind: 'colony', name: 'Titan'}}}) as never)).eq('colony');
    expect(promptReceiveFamily(pick({choiceContext: {source: {kind: 'card', card: CardName.PETS}}}) as never)).eq('plate');
    expect(promptReceiveFamily(pick({choiceContext: {source: {kind: 'resolution', resolution: 'X'}}}) as never)).is.undefined;
    expect(promptReceiveFamily({type: 'card', cards: []} as never), 'no marker — no scene').is.undefined;
    expect(promptReceiveFamily({type: 'or'} as never)).is.undefined;
  });

  it('ARM seals the chosen candidate; a press on a non-receiving pick arms nothing', () => {
    expect(armPromptReceive({type: 'card', cards: [{name: TARDI}]} as never, TARDI)).is.false;
    expect(promptReceiveState.card).is.undefined;
    expect(armPromptReceive(pick() as never, DECO)).is.true;
    expect(promptReceiveState.card).eq(DECO);
    expect(promptReceiveState.family).eq('plate');
    expect(promptReceiveArmed()).is.true;
  });

  it('DETECT: the card took exactly the amount → the scene; otherwise disarmed (no pose survives)', () => {
    const wf = pick();
    armPromptReceive(wf as never, DECO);
    const ok = detectPromptReceive(view(wf, {[DECO]: 0}), view(undefined, {[DECO]: 1}));
    expect(ok?.armed.card).eq(DECO);
    expect(ok?.record).is.undefined;
    disarmPromptReceive();
    armPromptReceive(wf as never, DECO);
    const refused = detectPromptReceive(view(wf, {[DECO]: 0}), view(undefined, {[DECO]: 0}));
    expect(refused, 'a count that did not move plays nothing').is.undefined;
    expect(promptReceiveState.card, 'the seal let go').is.undefined;
    expect(promptReceiveState.outcome).eq('unverified');
  });

  it('DETECT: a standing view that is not that pick plays nothing', () => {
    const wf = pick();
    armPromptReceive(wf as never, DECO);
    expect(detectPromptReceive(view({type: 'or'}, {[DECO]: 0}), view(undefined, {[DECO]: 1}))).is.undefined;
    expect(promptReceiveArmed()).is.false;
  });

  it('the FIELD family plays the server\'s `asked` record — claimed once; without one it falls back to the plate scene', () => {
    const wf = pick({}, {fromSpace: '08'});
    armPromptReceive(wf as never, DECO);
    const event = detectPromptReceive(view(wf, {[DECO]: 0}), view(undefined, {[DECO]: 1}, [record()]));
    expect(event?.record?.seq).eq(501);
    expect(event?.armed.family).eq('field');
    // The same record never plays twice (the remote stage reads the claim set too).
    disarmPromptReceive();
    armPromptReceive(wf as never, DECO);
    const again = detectPromptReceive(view(wf, {[DECO]: 0}), view(undefined, {[DECO]: 1}, [record()]));
    expect(again?.record, 'claimed already').is.undefined;
    expect(again?.armed.family, 'the honest fallback').eq('plate');
  });

  it('a record seen BEFORE the answer, a record of another seat or another card is not this answer\'s', () => {
    const wf = pick({}, {fromSpace: '08'});
    armPromptReceive(wf as never, DECO);
    const old = record({seq: 400});
    const event = detectPromptReceive(view(wf, {[DECO]: 0}, [old]),
      view(undefined, {[DECO]: 1}, [old, record({seq: 502, color: 'red' as Color}), record({seq: 503, target: TARDI})]));
    expect(event?.record).is.undefined;
    expect(event?.armed.family).eq('plate');
  });
});
