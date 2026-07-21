import {expect} from 'chai';
import {nextTick} from 'vue';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyModel} from '@/common/models/ColonyModel';
import {Resource} from '@/common/Resource';
import {ColonyTradeManifestModel} from '@/common/models/ColonyTradeManifestModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {drawnCardsState} from '@/client/components/drawnCards/drawnCardsState';
import {heldStock, panelRewardHold} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {
  abortColonyTrade, armColonyTrade, colonyTradeClaimsReveal, colonyTradeHoldingSingleZoom,
  colonyTradeState, colonyTradeTileStatusText, detectColonyTrade, finishColonyTrackReset,
  isColonyTradeActive, isColonyTradeInputLocked, isColonyTradeRevealStaged, isPresentedTradeReveal,
  markColonyTradeZoomReady, noticeColonyTradeCommit, notifyColonyTradeTrackCommitted,
  presentedColonyModel, resetColonyTrade, runColonyTradeRewards, seedColonyTradeRewardHold,
  stageColonyTradeReveal,
} from '@/client/console/colonyTrade/consoleColonyTrade';

function manifest(over: Partial<ColonyTradeManifestModel> = {}): ColonyTradeManifestModel {
  return {
    tradeId: 'Triton:g3:a120',
    colonyName: ColonyName.TRITON,
    trader: 'red',
    generation: 3,
    preTradeTrackPosition: 4,
    postTradeTrackPosition: 1,
    tradeIncome: {benefit: ColonyBenefit.GAIN_RESOURCES, quantity: 3, resource: Resource.TITANIUM},
    colonyBonus: {benefit: ColonyBenefit.GAIN_RESOURCES, quantity: 1, resource: Resource.TITANIUM},
    bonusRecipients: [{color: 'red', cubes: 1}],
    ...over,
  };
}

function view(m?: ColonyTradeManifestModel): PlayerViewModel {
  return {colonyTradeManifest: m} as unknown as PlayerViewModel;
}

function colony(name: ColonyName, trackPosition: number): ColonyModel {
  return {colonies: [], isActive: true, name, trackPosition, visitor: undefined};
}

describe('consoleColonyTrade', () => {
  beforeEach(() => {
    resetColonyTrade();
    drawnCardsState.events = [];
  });
  afterEach(() => {
    resetColonyTrade();
    drawnCardsState.events = [];
  });

  it('arm goes live synchronously; detect claims the manifest ONCE and freezes the track', () => {
    armColonyTrade(ColonyName.TRITON, 'red');
    expect(isColonyTradeActive()).eq(true);
    expect(colonyTradeState.phase).eq('armed');

    const claim = detectColonyTrade(view(manifest()));
    expect(claim?.tradeId).eq('Triton:g3:a120');
    expect(colonyTradeState.trackHold).eq(true);
    expect(colonyTradeState.preTrackPosition).eq(4);
    expect(colonyTradeState.postTrackPosition).eq(1);
    // Claimed exactly once — a poll replaying the same manifest can't re-fire.
    expect(detectColonyTrade(view(manifest()))).eq(undefined);
  });

  it('detect is a no-op on desktop (never armed) and for a foreign colony', () => {
    expect(detectColonyTrade(view(manifest()))).eq(undefined);
    armColonyTrade(ColonyName.LUNA, 'red');
    expect(detectColonyTrade(view(manifest()))).eq(undefined); // Triton manifest ≠ armed Luna
    expect(colonyTradeState.trackHold).eq(false);
  });

  it('a non-moving reset never freezes the track (post == pre)', () => {
    armColonyTrade(ColonyName.TRITON, 'red');
    detectColonyTrade(view(manifest({preTradeTrackPosition: 1, postTradeTrackPosition: 1})));
    expect(colonyTradeState.trackHold).eq(false);
  });

  it('the presented model shows the PRE-trade position for the traded colony only', () => {
    armColonyTrade(ColonyName.TRITON, 'red');
    detectColonyTrade(view(manifest()));
    // The commit reset the real model to 1 — the presentation stays at 4.
    expect(presentedColonyModel(colony(ColonyName.TRITON, 1)).trackPosition).eq(4);
    expect(presentedColonyModel(colony(ColonyName.LUNA, 2)).trackPosition).eq(2);
    finishColonyTrackReset();
    expect(presentedColonyModel(colony(ColonyName.TRITON, 1)).trackPosition).eq(1);
  });

  it('seed hides the viewer’s whole reward behind the panel hold, once', () => {
    armColonyTrade(ColonyName.TRITON, 'red');
    detectColonyTrade(view(manifest()));
    seedColonyTradeRewardHold();
    seedColonyTradeRewardHold(); // idempotent
    expect(heldStock('titanium')).eq(4); // income 3 + 1 own cube
    abortColonyTrade();
    expect(heldStock('titanium')).eq(0); // an abort releases exactly what it held
    expect(panelRewardHold.active).eq(false);
  });

  it('the chip waves release the holds and hand over to awaiting', async () => {
    armColonyTrade(ColonyName.TRITON, 'red');
    detectColonyTrade(view(manifest()));
    seedColonyTradeRewardHold();
    await runColonyTradeRewards(); // JSDOM: no anchors → chips release instantly
    expect(heldStock('titanium')).eq(0);
    expect(colonyTradeState.phase).eq('awaiting');
    expect(isColonyTradeInputLocked()).eq(false); // a discard prompt may need the pad here
  });

  it('the reset glide starts only when BOTH the reveal is confirmed AND the server reset committed', async () => {
    armColonyTrade(ColonyName.TRITON, 'red');
    detectColonyTrade(view(manifest()));
    await runColonyTradeRewards();

    // A staged (still open) reveal batch of this trade blocks the conclusion.
    drawnCardsState.events.push({
      id: 71, cards: [], takenIndices: new Set(), acking: false, dismissed: false,
      source: {type: 'colony', colonyName: ColonyName.TRITON, trade: {tradeId: 'Triton:g3:a120', role: 'income'}},
    });
    stageColonyTradeReveal(71);
    colonyTradeState.cardScene = 'idle'; // the covers finished; the take is pending
    notifyColonyTradeTrackCommitted(ColonyName.TRITON, 1);
    await nextTick();
    expect(colonyTradeState.phase).eq('awaiting'); // cards not confirmed yet

    // The player takes the cards (the batch dismisses) → the glide may start.
    drawnCardsState.events[0].dismissed = true;
    await nextTick();
    expect(colonyTradeState.phase).eq('glide');
    expect(colonyTradeState.glideNonce).eq(1);
    expect(colonyTradeTileStatusText(ColonyName.TRITON)).to.be.a('string');

    // The layer lands the marker → the frozen readouts release + settle.
    finishColonyTrackReset();
    expect(colonyTradeState.trackHold).eq(false);
    expect(colonyTradeState.settledCell).eq(1);
    expect(colonyTradeState.phase).eq('settle');
  });

  it('without the committed reset the transaction WAITS (an opponent’s discard still owes it)', async () => {
    armColonyTrade(ColonyName.TRITON, 'red');
    detectColonyTrade(view(manifest()));
    await runColonyTradeRewards();
    await nextTick();
    expect(colonyTradeState.phase).eq('awaiting');
    expect(isColonyTradeInputLocked()).eq(false);
    // The reset lands via a later commit/poll → the glide starts.
    notifyColonyTradeTrackCommitted(ColonyName.TRITON, 1);
    expect(colonyTradeState.phase).eq('glide');
  });

  it('a non-moving reset concludes with the confirm pulse, never an invented glide', async () => {
    armColonyTrade(ColonyName.TRITON, 'red');
    detectColonyTrade(view(manifest({preTradeTrackPosition: 1, postTradeTrackPosition: 1})));
    await runColonyTradeRewards();
    await nextTick();
    expect(colonyTradeState.glideNonce).eq(0); // no false movement
    expect(colonyTradeState.phase).eq('settle');
    expect(colonyTradeState.settledCell).eq(1);
  });

  it('reveal claims: only this trade’s batches, staged ids + presented trades remembered', () => {
    armColonyTrade(ColonyName.TRITON, 'red');
    detectColonyTrade(view(manifest()));
    const mine = {type: 'colony', colonyName: ColonyName.TRITON, trade: {tradeId: 'Triton:g3:a120', role: 'income'}} as const;
    const foreign = {type: 'colony', colonyName: ColonyName.TRITON, trade: {tradeId: 'Triton:g9:a999', role: 'bonus'}} as const;
    expect(colonyTradeClaimsReveal(mine)).eq(true);
    expect(colonyTradeClaimsReveal(foreign)).eq(false);
    expect(colonyTradeClaimsReveal({type: 'colony', colonyName: ColonyName.TRITON})).eq(false);

    expect(stageColonyTradeReveal(5)).eq(true);
    expect(stageColonyTradeReveal(5)).eq(false); // one claim per batch
    expect(colonyTradeState.cardScene).eq('fly');
    expect(isColonyTradeInputLocked()).eq(true); // covers own the pad
    expect(isColonyTradeRevealStaged(5)).eq(true);

    // The single-card auto-open is held until the cover reaches its pose.
    expect(colonyTradeHoldingSingleZoom(5)).eq(true);
    markColonyTradeZoomReady();
    expect(colonyTradeHoldingSingleZoom(5)).eq(false);

    abortColonyTrade();
    // The memories survive the transaction: the deck-draw can never re-grab.
    expect(isColonyTradeRevealStaged(5)).eq(true);
    expect(isPresentedTradeReveal(mine)).eq(true);
    expect(isPresentedTradeReveal(foreign)).eq(false);
  });

  it('a replayed tradeId is never presented twice (reconnect / poll safety)', () => {
    armColonyTrade(ColonyName.TRITON, 'red');
    detectColonyTrade(view(manifest()));
    abortColonyTrade();
    armColonyTrade(ColonyName.TRITON, 'red');
    expect(detectColonyTrade(view(manifest()))).eq(undefined); // seen
    abortColonyTrade();
  });

  it('an ARMED (not yet claimed) transaction already owns its colony’s trade batches', () => {
    // The staged bot pipeline / a poll can land the reveal before the gated
    // detect ran — the deck-draw must still be excluded by the colony match.
    armColonyTrade(ColonyName.TRITON, 'red');
    expect(colonyTradeClaimsReveal(
      {type: 'colony', colonyName: ColonyName.TRITON, trade: {tradeId: 'Triton:g3:a120', role: 'income'}})).eq(true);
    expect(colonyTradeClaimsReveal(
      {type: 'colony', colonyName: ColonyName.LUNA, trade: {tradeId: 'Luna:g3:a121', role: 'income'}})).eq(false);
  });

  it('a commit that bypassed the gated detect (staged bot pipeline) still claims + kicks ONCE', async () => {
    armColonyTrade(ColonyName.TRITON, 'red');
    // The staged path: WaitingFor returned early; the buffered commit lands
    // via the shell's playerView watcher → noticeColonyTradeCommit.
    noticeColonyTradeCommit(view(manifest()));
    expect(colonyTradeState.tradeId).eq('Triton:g3:a120');
    expect(colonyTradeState.trackHold).eq(true);
    // The kick started the reward waves; a second commit observation is a no-op.
    noticeColonyTradeCommit(view(manifest()));
    await new Promise((resolve) => setTimeout(resolve, 350)); // waves settle (no anchors under JSDOM)
    expect(colonyTradeState.phase).eq('awaiting');
  });
});
