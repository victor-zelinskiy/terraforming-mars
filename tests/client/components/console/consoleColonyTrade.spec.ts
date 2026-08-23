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
  abortColonyTrade, armColonyTrade, colonyPayoutPending, colonyTrackAdvancing,
  colonyTradeClaimsReveal, colonyTradeHoldingSingleZoom, colonyTradeWillDressReveal,
  colonyTradeState, colonyTradeTileStatusText, detectColonyTrade, finishColonyTrackReset,
  isColonyTradeActive, isColonyTradeInputLocked, isColonyTradeRevealStaged, isPresentedTradeReveal,
  markColonyTradeZoomReady, noticeColonyTradeCommit, notifyColonyTradeTrackCommitted,
  presentedColonyModel, resetColonyTrade, runColonyTradeRewards, seedColonyTradeRewardHold,
  setColonyTradeCardScene, stageColonyTradeReveal,
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

  /*
   * ⚠️ THE REGRESSION THIS FENCES. A colony whose trade income IS the draw
   * (Pluto) has no resource chips, so the commit walks straight to `awaiting`
   * — and for a flush or two after it the reveal store has not been reconciled
   * yet. Asking the COVER SCENE's staging list there («nothing staged» → «every
   * reveal confirmed») ran the whole conclusion inside that gap: the marker
   * glided across the track while the first card was still flying to the table.
   * The gate reads the batches by TRADE ID, and waits for a promised card that
   * has not arrived yet.
   */
  it('a trade whose income is a DRAW never concludes before its cards exist', async () => {
    armColonyTrade(ColonyName.PLUTO, 'red');
    detectColonyTrade(view(manifest({
      colonyName: ColonyName.PLUTO,
      tradeIncome: {benefit: ColonyBenefit.DRAW_CARDS, quantity: 2},
      colonyBonus: undefined,
      bonusRecipients: [],
    })));
    await runColonyTradeRewards(); // no chips at all — straight to `awaiting`
    notifyColonyTradeTrackCommitted(ColonyName.PLUTO, 1);
    await nextTick();
    // The promised cards have not been reconciled into the store yet.
    expect(colonyTradeState.phase).eq('awaiting');
    expect(colonyTradeState.glideNonce).eq(0);

    // …they arrive; still nothing may move while they are on the table.
    drawnCardsState.events.push({
      id: 91, cards: [], takenIndices: new Set(), acking: false, dismissed: false,
      source: {type: 'colony', colonyName: ColonyName.PLUTO, trade: {tradeId: 'Triton:g3:a120', role: 'income'}},
    });
    await nextTick();
    expect(colonyTradeState.phase).eq('awaiting');
    expect(colonyTradeState.glideNonce).eq(0);

    // The player takes them → the reset is the last beat.
    drawnCardsState.events[0].dismissed = true;
    await nextTick();
    expect(colonyTradeState.phase).eq('glide');
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

  it('a view proving the queue is PARKED on another player concludes on the bounded net', async () => {
    armColonyTrade(ColonyName.TRITON, 'red');
    detectColonyTrade(view(manifest()));
    await runColonyTradeRewards();
    await nextTick();
    expect(colonyTradeState.phase).eq('awaiting');
    // The fetched view proves it: the viewer owes nothing, an opponent holds
    // the game's pending input, and the reset is still uncommitted.
    const parked = {
      colonyTradeManifest: manifest(),
      thisPlayer: {color: 'red'},
      waitingFor: undefined,
      players: [
        {color: 'red', isWaitingForInput: false},
        {color: 'blue', isWaitingForInput: true},
      ],
    } as unknown as PlayerViewModel;
    noticeColonyTradeCommit(parked);
    expect(isColonyTradeActive()).is.true; // bounded, never instant
    await new Promise((resolve) => setTimeout(resolve, 2_800));
    // Released to the board — the waiting player's chip tells the story.
    expect(isColonyTradeActive()).is.false;
  }).timeout(6_000);

  it('the parked net DISARMS when a later view stops proving it', async () => {
    armColonyTrade(ColonyName.TRITON, 'red');
    detectColonyTrade(view(manifest()));
    await runColonyTradeRewards();
    await nextTick();
    const parked = {
      colonyTradeManifest: manifest(),
      thisPlayer: {color: 'red'},
      waitingFor: undefined,
      players: [{color: 'blue', isWaitingForInput: true}],
    } as unknown as PlayerViewModel;
    noticeColonyTradeCommit(parked);
    // The next view no longer proves the park (nobody else is waited on) —
    // the transaction goes back to its ordinary reset wait.
    const idle = {
      colonyTradeManifest: manifest(),
      thisPlayer: {color: 'red'},
      waitingFor: undefined,
      players: [{color: 'blue', isWaitingForInput: false}],
    } as unknown as PlayerViewModel;
    noticeColonyTradeCommit(idle);
    await new Promise((resolve) => setTimeout(resolve, 2_800));
    expect(isColonyTradeActive()).is.true;
    // …and the reset commit still concludes it the honest way.
    notifyColonyTradeTrackCommitted(ColonyName.TRITON, 1);
    expect(colonyTradeState.phase).eq('glide');
  }).timeout(6_000);

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
  /*
   * STRICT SEQUENCE: the CAUSE finishes before its CONSEQUENCE starts. The
   * pre-trade advance moves the marker to the cell the reward is read at, and
   * nothing of the payout — covers, reveal, the stage's own dissolve — may
   * begin until it lands. The reported break was the reveal opening (and the
   * track's own interface evaporating) while the marker was still crossing it.
   */
  describe('colonyPayoutPending (nothing starts before the marker lands)', () => {
    it('holds through armed → advance → chips, and releases at awaiting', () => {
      armColonyTrade(ColonyName.TRITON, 'red', undefined, 1);
      // ARMED counts: the batch is claimed on a PRE-FLUSH watcher while the
      // reward run starts a tick later — a predicate that ignored this phase
      // sampled it too early and let the covers fly into the glide.
      expect(colonyPayoutPending()).to.eq(true);
      expect(colonyTrackAdvancing()).to.eq(false);

      // The claim owes an ADVANCE: the manifest reads the reward 3 cells on.
      detectColonyTrade(view(manifest({preTradeTrackPosition: 4, postTradeTrackPosition: 1})));
      colonyTradeState.phase = 'advance';
      expect(colonyTrackAdvancing()).to.eq(true);
      expect(colonyPayoutPending()).to.eq(true);
      expect(isColonyTradeInputLocked(), 'the pad is inert while the marker travels').to.eq(true);

      colonyTradeState.phase = 'chips';
      expect(colonyTrackAdvancing()).to.eq(false);
      expect(colonyPayoutPending()).to.eq(true);

      colonyTradeState.phase = 'awaiting';
      expect(colonyPayoutPending(), 'the payout may begin').to.eq(false);
    });

    it('answers false when no transaction is running (a foreign / bot trade)', () => {
      expect(colonyPayoutPending()).to.eq(false);
      expect(colonyTrackAdvancing()).to.eq(false);
    });
  });

  /*
   * THE MODAL MUST BE VEILED FROM ITS FIRST RENDER — and un-veiled for good
   * afterwards. The claim rides the layer's pre-flush watcher, which the
   * scheduler runs AFTER the shell's render (higher component uid), so a veil
   * gated on the claim leaves the modal painted for a frame: the reported flash.
   * The predicate below closes that gap, and the staged latch keeps it ONE-SHOT.
   */
  describe('colonyTradeWillDressReveal (the pre-claim veil)', () => {
    const tradeSource = {
      type: 'colony' as const,
      colonyName: ColonyName.TRITON,
      trade: {tradeId: 'Triton:g3:a120', role: 'income' as const},
    };

    it('is TRUE the instant the batch exists — before the layer has claimed it', () => {
      armColonyTrade(ColonyName.TRITON, 'red');
      detectColonyTrade(view(manifest()));
      expect(isColonyTradeRevealStaged(7)).to.eq(false);
      expect(colonyTradeWillDressReveal(7, tradeSource)).to.eq(true);
    });

    it('hands off to the staged veil the moment the scene takes the batch', () => {
      armColonyTrade(ColonyName.TRITON, 'red');
      detectColonyTrade(view(manifest()));
      stageColonyTradeReveal(7);
      // cardScene left 'idle' AND the batch is latched — both say "not mine".
      expect(colonyTradeWillDressReveal(7, tradeSource)).to.eq(false);
      expect(isColonyTradeRevealStaged(7)).to.eq(true);
    });

    it('NEVER fires again once the scene finished — the modal stays visible', () => {
      armColonyTrade(ColonyName.TRITON, 'red');
      detectColonyTrade(view(manifest()));
      stageColonyTradeReveal(7);
      setColonyTradeCardScene('frame');
      setColonyTradeCardScene('handoff');
      setColonyTradeCardScene('idle'); // the scene is done…
      expect(isColonyTradeActive()).to.eq(true); // …but the trade still waits for the takes
      // Without the staged latch this re-veiled the finished modal: cards gone,
      // input still live — "I press B and cards are taken, but I see nothing".
      expect(colonyTradeWillDressReveal(7, tradeSource)).to.eq(false);
    });

    it('never dresses a batch belonging to another transaction', () => {
      armColonyTrade(ColonyName.TRITON, 'red');
      detectColonyTrade(view(manifest()));
      const foreign = {type: 'colony' as const, colonyName: ColonyName.LUNA,
        trade: {tradeId: 'Luna:g3:a121', role: 'bonus' as const}};
      expect(colonyTradeWillDressReveal(9, foreign)).to.eq(false);
      expect(colonyTradeWillDressReveal(9, undefined)).to.eq(false);
    });

    it('stays out of the way with no live transaction / reduced motion', () => {
      expect(colonyTradeWillDressReveal(7, tradeSource)).to.eq(false); // nothing armed
      armColonyTrade(ColonyName.TRITON, 'red');
      detectColonyTrade(view(manifest()));
      colonyTradeState.reducedMotion = true;
      // Reduced motion runs no cover flight — the modal keeps its own entrance.
      expect(colonyTradeWillDressReveal(7, tradeSource)).to.eq(false);
    });
  });
});
