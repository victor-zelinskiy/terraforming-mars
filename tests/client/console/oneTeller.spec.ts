import {expect} from 'chai';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {Resource} from '@/common/Resource';
import {CardReactionRecord} from '@/common/models/CardReactionModel';
import {RATING_RAIL_KEY, ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {clearPanelRewardHold, heldStock} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {resetRailRewards, seedRailReward} from '@/client/console/resourceTransfer/railReward';
import {SCALE_STEP_RATING_UNIT, TOLD_TWICE, claimTeller, tellerOf} from '@/client/console/resourceTransfer/oneTeller';
import {resetScaleStepRating, seedScaleStepRatingHold} from '@/client/console/scaleStepReward/scaleStepRatingBeat';
import {cardReactionPending, resetCardReactions, seedCardReactionHolds, snapshotRailHolds} from '@/client/console/cardReaction/cardReactionDirector';

/*
 * ONE UNIT, ONE TELLER (P66 · GJ — the owner, 2026-11-05: «двойной показ — критический баг, защита архитектурная»).
 * A scale step's rating has two possible tellers — the FIELD's scale-step beat (the action phase) and a HOST whose rail
 * reward is born on the printed scale icon (the start's hero). Whichever seeds first claims the unit for the response;
 * the other yields and the sentinel names it. The table's answer (the Greens' M€) is single by the ANSWER LEDGER: a host
 * that declares it gets the card-reaction group ATTACHED — no standalone chain tells it again.
 */
const BLUE = 'blue';

function views(over: {phase?: string, mcAfter?: number, reactions?: ReadonlyArray<CardReactionRecord>} = {}): [PlayerViewModel, PlayerViewModel] {
  const game = (venus: number, reactions: ReadonlyArray<CardReactionRecord>) => ({
    phase: over.phase ?? 'action', temperature: -30, oxygenLevel: 0, venusScaleLevel: venus, cardReactions: reactions,
  });
  const before = {id: 'p-viewer', thisPlayer: {color: BLUE, terraformRating: 20, megacredits: 60, tableau: []}, game: game(0, [])};
  const after = {id: 'p-viewer', thisPlayer: {color: BLUE, terraformRating: 23, megacredits: over.mcAfter ?? 66, tableau: []}, game: game(6, over.reactions ?? [])};
  return [before as unknown as PlayerViewModel, after as unknown as PlayerViewModel];
}

const venusBorn = (): Array<ResourceTransferSpec> => [0, 1, 2].map(() => ({channel: 'stock', resource: RATING_RAIL_KEY, amount: 1, bornOn: 'venus'}));
const greens: ResourceTransferSpec = {channel: 'stock', resource: 'megacredits', amount: 6};

function greensRecord(seq: number): CardReactionRecord {
  return {
    seq, root: {}, owner: BLUE, kind: 'corporation', card: CardName.HARTLAN_HEATING, channel: 'tr-increase',
    impacts: [{kind: 'stock', resource: Resource.MEGACREDITS, amount: 6, to: BLUE}],
  } as CardReactionRecord;
}

describe('oneTeller — one unit, one teller', () => {
  let warned: Array<string>;
  let warn: typeof console.warn;
  beforeEach(() => {
    warned = [];
    warn = console.warn;
    console.warn = (...args: Array<unknown>) => {
      warned.push(args.map(String).join(' '));
    };
  });
  afterEach(() => {
    console.warn = warn;
    resetScaleStepRating();
    resetRailRewards();
    resetCardReactions();
    clearPanelRewardHold();
  });

  it('the first claim tells; the same teller again still tells; a second teller YIELDS and the sentinel names both', () => {
    const view = {};
    expect(claimTeller(view, 'unit', 'a')).is.true;
    expect(claimTeller(view, 'unit', 'a'), 'the same teller again').is.true;
    expect(claimTeller(view, 'unit', 'b'), 'a second teller').is.false;
    expect(tellerOf(view, 'unit')).eq('a');
    expect(warned.some((w) => w.includes(TOLD_TWICE) && w.includes('a tells it') && w.includes('b reached'))).is.true;
    expect(claimTeller({}, 'unit', 'b'), 'another response is another claim').is.true;
    expect(claimTeller(undefined, 'unit', 'b'), 'no response, no collision').is.true;
  });

  it('the start host first (the hero, born on the printed Venus icons): the field yields — the rating is held ONCE', () => {
    const [before, after] = views();
    expect(seedRailReward('hero', {cause: venusBorn(), reactions: [greens]}, before, after), 'the hero holds its three tokens').is.true;
    expect(tellerOf(after, SCALE_STEP_RATING_UNIT)).eq('rail:hero');
    seedScaleStepRatingHold(before, after, 3);
    expect(heldStock(RATING_RAIL_KEY), 'three, never six').eq(3);
    expect(heldStock('megacredits'), 'the Greens\' six, never twelve').eq(6);
  });

  it('the field first (the action phase): a host reaching for the same steps is REFUSED by name — nothing held twice', () => {
    const [before, after] = views();
    seedScaleStepRatingHold(before, after, 0);
    expect(tellerOf(after, SCALE_STEP_RATING_UNIT)).eq('scale-step-rating');
    expect(heldStock(RATING_RAIL_KEY), 'the field holds the three steps').eq(3);
    expect(seedRailReward('hero', {cause: venusBorn(), reactions: []}, before, after), 'the host yields').is.false;
    expect(heldStock(RATING_RAIL_KEY), 'still three').eq(3);
    expect(warned.some((w) => w.includes(TOLD_TWICE) && w.includes('rail:hero'))).is.true;
  });

  it('RX35\'s data born on a struck scale icon is no rating: it claims nothing', () => {
    const [before, after] = views({mcAfter: 60});
    const data: Array<ResourceTransferSpec> = [{channel: 'card-resource', resource: 'data', amount: 1, targetCard: CardName.HARTLAN_HEATING, bornOn: 'temperature'}];
    seedRailReward('data', {cause: data, reactions: []}, before, after);
    expect(tellerOf(after, SCALE_STEP_RATING_UNIT)).is.undefined;
  });

  it('a rail reward that tells no scale step claims nothing (a direct TR is its own unit)', () => {
    const [before, after] = views({mcAfter: 60});
    const direct: Array<ResourceTransferSpec> = [{channel: 'stock', resource: RATING_RAIL_KEY, amount: 3}];
    expect(seedRailReward('direct', {cause: direct, reactions: []}, before, after)).is.true;
    expect(tellerOf(after, SCALE_STEP_RATING_UNIT)).is.undefined;
  });

  it('THE ANSWER LEDGER: the Greens\' answer a host declared is ATTACHED — the card-reaction chain tells it through the host, never a second standalone story', () => {
    const [before, after] = views({phase: 'preludes', reactions: [greensRecord(41)]});
    const heldBefore = snapshotRailHolds();
    expect(seedRailReward('hero', {cause: venusBorn(), reactions: [greens]}, before, after)).is.true;
    seedCardReactionHolds(before, after, heldBefore);
    expect(cardReactionPending(), 'no standalone chain for a declared answer').is.false;
    expect(heldStock('megacredits'), 'held once, by the host').eq(6);
    expect(warned.filter((w) => w.includes(TOLD_TWICE))).deep.eq([]);
  });
});
