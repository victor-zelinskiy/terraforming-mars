import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {ActionPreviewBranch, StagedVoteModel} from '@/common/models/ActionPreviewModel';
import {DelegatePromptMeta, DelegateTargetProjection, SelectPartyModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentDelegateRemovalModel} from '@/common/models/ParliamentModel';
import {delegatePickResponse, emptyParliamentView, parliamentPromptBridge} from '@/client/console/parliament/consoleParliamentModel';
import {parliamentCommandsOf} from '@/client/console/parliament/parliamentCommands';
import {
  armDelegatePickFlow, parliamentCrumbCommitted, parliamentCrumbSubject, parliamentDelegateUp, parliamentFlow, resetParliamentFlow,
} from '@/client/console/parliament/consoleParliamentFlow';
import {
  delegateCursorStep, delegateFactsOf, delegateOutgoingArea, delegateOutgoingSeq, delegateReadingOf, delegateRing, delegateStartIndex,
  delegateStepStageOf, DelegateTableVm,
} from '@/client/console/parliament/delegatePickModel';
import {
  delegateRemovalFlow, delegateRemovalGhostVote, delegateRemovalPoolHeld, delegateRemovalReserveHeld, delegateRemovalSupportStanding,
  landRemovedDelegate, liftRemovedDelegate, registerDelegateRemovalHost, seedDelegateRemovalHolds, settleDelegateRemoval,
} from '@/client/console/parliament/delegateRemoval';
import {removalDestinationSelector, removalSourceSelector, ribbonFigureSelector} from '@/client/console/parliament/delegateRemovalScene';
import {playCommitVerb, playDoorNextStepKey, playDoorOf} from '@/client/console/consolePlayCardComposer';
import {partyStepStageOf} from '@/client/console/consoleTaskRouter';
import {parliamentBandLine} from '@/client/console/parliament/parliamentBand';

/**
 * THE DELEGATE MODE — the Parliament picks ONE FIGURE off the table (Turmoil Redux TR72 Banned Delegate:redux,
 * docs/TURMOIL_REDUX_BANNED_DELEGATE.md). The door is the staged party pick TR03 built and TR12 widened — ONE store,
 * ONE bridge, ONE addressed tail — and the MODE is the prompt's marker (`delegatePrompt`). Pinned here: the ring the
 * cursor walks (spatial — the bills' figures a row, the areas a column left of it), the server's readings as fact
 * rows, the bridge and the answer's address, the flight's holds seeded from the server's RECORD, the bar, the crumb,
 * the band, the composer's door.
 */
const G = PartyName.GREENS;
const M = PartyName.MARS;
const I = PartyName.INDUSTRIALISTS;
const CARD = CardName.BANNED_DELEGATE_REDUX;
const RED = 'red' as Color;
const BLUE = 'blue' as Color;

function target(party: PartyName, place: 'resolution' | 'support', owner: Color | 'neutral', extra: Partial<DelegateTargetProjection> = {}): DelegateTargetProjection {
  return {party, place, owner, count: 1, returnsTo: owner === 'neutral' ? 'supply' : 'reserve', total: {current: 2, resulting: 1}, ...extra};
}

/** The server's rows as `RemoveDelegate.targetsOf` words them. */
const META: DelegatePromptMeta = {
  source: 'remove',
  targets: [
    target(G, 'resolution', RED, {count: 2, total: {current: 3, resulting: 2}, leader: {current: RED, resulting: BLUE}}),
    target(G, 'resolution', BLUE),
    target(M, 'resolution', 'neutral', {winner: {current: {party: G, owner: RED}, resulting: {party: M, owner: 'neutral'}}}),
    target(I, 'resolution', BLUE, {effectsLost: [I]}),
    target(M, 'support', 'neutral', {total: {current: 2, resulting: 1}}),
    target(G, 'support', 'neutral', {total: {current: 1, resulting: 0}}),
  ],
};

/** The table as shown: Greens blue(1) red(2) red(3) · Mars neutral(4) · Industrialists blue(5); the plaques' order. */
const TABLE: DelegateTableVm = {
  slots: [
    {party: G, votes: [{owner: BLUE, seq: 1}, {owner: RED, seq: 2}, {owner: RED, seq: 3}]},
    {party: M, votes: [{owner: 'neutral', seq: 4}]},
    {party: I, votes: [{owner: BLUE, seq: 5}]},
  ],
  areaOrder: [PartyName.UNITY, G, PartyName.SCIENTISTS, M, PartyName.REDS, I],
};

function prompt(): SelectPartyModel {
  return {
    type: 'party', title: 'Select a delegate to remove from a resolution or a Popular Support area', buttonLabel: 'Remove delegate', parties: [G, M, I],
    delegatePrompt: META,
    choiceContext: {source: {kind: 'card', card: CARD}, mode: 'attack'},
  } as unknown as SelectPartyModel;
}

const STAGED: StagedVoteModel = {prompt: prompt(), sourceCard: CARD};

function view(lastRemoval?: ParliamentDelegateRemovalModel): PlayerViewModel {
  return {game: {parliament: {lastRemoval}}} as unknown as PlayerViewModel;
}

function removal(seq: number, extra: Partial<ParliamentDelegateRemovalModel> = {}): ParliamentDelegateRemovalModel {
  return {seq, player: RED, card: CARD, place: 'resolution', party: G, instance: 'g-1', resolution: 'r', vote: 3, owner: RED, returnsTo: 'reserve', total: 2, generation: 1, ...extra} as ParliamentDelegateRemovalModel;
}

describe('the DELEGATE mode (TR72)', () => {
  afterEach(() => {
    resetParliamentFlow();
    settleDelegateRemoval();
    delegateRemovalFlow.seenSeq = 0;
    delegateRemovalFlow.degraded = '';
    registerDelegateRemovalHost(undefined);
  });

  describe('the ring', () => {
    it('the bills\' figures left to right (inside a bill by the figure that leaves — the owner\'s latest), then the areas as the plaques stand', () => {
      const ring = delegateRing(META, TABLE);
      expect(ring.map((s) => [s.zone, s.target.party, s.target.owner, s.seq])).deep.eq([
        ['table', G, BLUE, 1],
        ['table', G, RED, 3],
        ['table', M, 'neutral', 4],
        ['table', I, BLUE, 5],
        ['areas', G, 'neutral', undefined],
        ['areas', M, 'neutral', undefined],
      ]);
      expect(delegateStartIndex(ring)).eq(0);
      expect(delegateRing(undefined, TABLE)).deep.eq([]);
    });

    it('a row the table does not show is dropped, never invented', () => {
      const ring = delegateRing({source: 'remove', targets: [target(PartyName.REDS, 'resolution', RED)]}, TABLE);
      expect(ring).deep.eq([]);
    });

    it('SPATIAL: ◀ ▶ walk the figures (a wall at the right), ◀ past the first steps into the areas\' column, ▲ ▼ walk the column, ▶ back to the table', () => {
      const ring = delegateRing(META, TABLE);
      expect(delegateCursorStep(ring, 0, 'right')).eq(1);
      expect(delegateCursorStep(ring, 3, 'right'), 'the wall').eq(3);
      expect(delegateCursorStep(ring, 0, 'left'), 'into the column').eq(4);
      expect(delegateCursorStep(ring, 4, 'down')).eq(5);
      expect(delegateCursorStep(ring, 5, 'down'), 'the column\'s wall').eq(5);
      expect(delegateCursorStep(ring, 5, 'up')).eq(4);
      expect(delegateCursorStep(ring, 4, 'right'), 'back to the table\'s first figure').eq(0);
      expect(delegateCursorStep(ring, 4, 'left')).eq(4);
      expect(delegateCursorStep(ring, 2, 'up'), 'nothing above a bill').eq(2);
    });

    it('the figure under the cursor marks its ribbon vote, or one place of its plaque', () => {
      const ring = delegateRing(META, TABLE);
      expect(delegateOutgoingSeq(ring[1], G)).eq(3);
      expect(delegateOutgoingSeq(ring[1], M)).is.undefined;
      expect(delegateOutgoingArea(ring[5], M)).eq(1);
      expect(delegateOutgoingArea(ring[1], M)).eq(0);
    });
  });

  describe('the reading', () => {
    it('the server\'s row as fact rows — votes, the new leader, the new winner, the lost effect — present only when it changes', () => {
      const ring = delegateRing(META, TABLE);
      const names = {owner: (o: Color | 'neutral') => (o === 'neutral' ? 'Neutral' : o), resolution: (p: PartyName) => `${p} law`};
      const red = delegateReadingOf(ring[1], ring.length)!;
      expect(red.returnsTo).eq('reserve');
      expect(red.sole).is.false;
      expect(delegateFactsOf(red, names).map((f) => [f.id, f.before.key, f.after.key])).deep.eq([
        ['votes', '3', '2'], ['lead', RED, BLUE],
      ]);
      const neutral = delegateReadingOf(ring[2], ring.length)!;
      expect(delegateFactsOf(neutral, names).map((f) => [f.id, f.before.key, f.after.key])).deep.eq([
        ['votes', '2', '1'], ['win', `${G} law`, `${M} law`],
      ]);
      const blue = delegateReadingOf(ring[3], ring.length)!;
      expect(delegateFactsOf(blue, names).map((f) => f.id)).deep.eq(['votes', 'effect']);
      const area = delegateReadingOf(ring[5], ring.length)!;
      expect(area.returnsTo).eq('supply');
      expect(delegateFactsOf(area, names).map((f) => [f.id, f.label])).deep.eq([['votes', 'Popular support']]);
    });

    it('the ONLY figure on the table is marked — shown and marked, never taken without the press', () => {
      const one = delegateRing({source: 'remove', targets: [target(M, 'support', 'neutral')]}, TABLE);
      expect(delegateReadingOf(one[0], one.length)?.sole).is.true;
    });

    it('the stage word is the mode\'s, by what the pick does', () => {
      expect(delegateStepStageOf(META)).eq('Banishment');
      expect(partyStepStageOf(prompt())).eq('Banishment');
    });
  });

  describe('the bridge and the answer', () => {
    it('a STAGED door: the bridge carries the pick, the answer is ADDRESSED to the card', () => {
      const bridge = parliamentPromptBridge(undefined, STAGED);
      expect(bridge.delegatePick?.staged).is.true;
      expect(bridge.delegatePick?.card).eq(CARD);
      expect(bridge.grant).is.undefined;
      expect(bridge.supportPick).is.undefined;
      expect(delegatePickResponse(bridge, {party: G, place: 'resolution', owner: RED})).deep.eq(
        {type: 'party', partyName: G, delegate: {place: 'resolution', owner: RED}, stagedFor: CARD});
    });

    it('a LIVE door: the plain address; a figure not on offer has no answer', () => {
      const bridge = parliamentPromptBridge(prompt());
      expect(bridge.delegatePick?.staged).is.undefined;
      expect(delegatePickResponse(bridge, {party: M, place: 'support', owner: 'neutral'})).deep.eq(
        {type: 'party', partyName: M, delegate: {place: 'support', owner: 'neutral'}});
      expect(delegatePickResponse(bridge, {party: PartyName.REDS, place: 'support', owner: 'neutral'})).is.undefined;
    });
  });

  describe('the flow, the bar, the crumb, the band', () => {
    it('armed: the stage stands, the crumb names it, cyan until the press (amber on a live door)', () => {
      armDelegatePickFlow(0, 'Banishment', false, META);
      expect(parliamentDelegateUp()).is.true;
      expect(parliamentCrumbSubject()).eq('Banishment');
      expect(parliamentCrumbCommitted()).is.false;
      armDelegatePickFlow(0, 'Banishment', true, META);
      expect(parliamentCrumbCommitted()).is.true;
    });

    it('the bar: a staged door plays the card, a live door removes; past the press a status', () => {
      armDelegatePickFlow(0, 'Banishment', false, META);
      const base = {view: emptyParliamentView(), canVoteNow: false, partyActionStates: []};
      const staged = parliamentCommandsOf({...base, delegate: {staged: true, stagedFlow: 'play', source: true, available: true}});
      expect(staged.map((c) => [c.control, c.label])).deep.eq([['confirm', 'Play card'], ['secondary', 'Inspect'], ['stickL', 'Source'], ['back', 'Back']]);
      const live = parliamentCommandsOf({...base, delegate: {staged: false, source: true, available: true}});
      expect(live[0].label).eq('Remove delegate');
      expect(live[live.length - 1].label).eq('Minimize');
      parliamentFlow.delegateCommitted = true;
      expect(parliamentCommandsOf({...base, delegate: {staged: true, source: true, available: true}}).map((c) => c.label)).deep.eq(['Performing…']);
    });

    it('the band names whose figure and where it stands', () => {
      const line = parliamentBandLine({delegate: {stage: 'Banishment', owner: RED, place: 'resolution', party: G, resolution: 'r' as never, committed: false}, standing: {} as never});
      expect(line.kicker).eq('Banishment');
      expect(line.chips.map((c) => c.kind)).deep.eq(['player', 'resolution']);
      const area = parliamentBandLine({delegate: {stage: 'Banishment', owner: 'neutral', place: 'support', party: M, committed: true}, standing: {} as never});
      expect(area.chips.map((c) => c.kind)).deep.eq(['player', 'party', 'label']);
      expect(area.committed).is.true;
    });

    it('the composer\'s door: «Выбрать делегата», «Делегат — выбор в Парламенте»', () => {
      const branch = {steps: [{kind: 'delegateRemoval', staged: STAGED}]} as unknown as ActionPreviewBranch;
      const door = playDoorOf(branch);
      expect(door).deep.eq({kind: 'parliament', staged: STAGED, mode: 'delegate'});
      expect(playCommitVerb(door)).eq('Choose the delegate');
      expect(playDoorNextStepKey(door)).eq('Delegate — chosen in the Parliament');
    });
  });

  describe('the flight\'s holds — seeded from the server\'s RECORD', () => {
    it('a fresh record while the mode stands: the figure stands on its bill and the reserve does not count it yet', () => {
      registerDelegateRemovalHost(() => true);
      seedDelegateRemovalHolds(view(), view(removal(7)));
      expect(delegateRemovalFlow.owed?.seq).eq(7);
      expect(delegateRemovalGhostVote('g-1')).deep.eq({owner: RED, seq: 3});
      expect(delegateRemovalGhostVote('m-1')).is.undefined;
      expect(delegateRemovalReserveHeld(RED)).eq(1);
      expect(delegateRemovalReserveHeld(BLUE)).eq(0);
      liftRemovedDelegate();
      expect(delegateRemovalGhostVote('g-1'), 'the lift-off takes the figure off its place').is.undefined;
      expect(delegateRemovalReserveHeld(RED), 'the reserve still waits for the touchdown').eq(1);
      landRemovedDelegate();
      expect(delegateRemovalReserveHeld(RED)).eq(0);
    });

    it('a support figure: the plaque keeps it, the supply does not count it, until the flight', () => {
      registerDelegateRemovalHost(() => true);
      seedDelegateRemovalHolds(view(), view(removal(8, {place: 'support', party: M, owner: 'neutral', returnsTo: 'supply', vote: undefined, instance: undefined})));
      expect(delegateRemovalSupportStanding(M)).eq(1);
      expect(delegateRemovalPoolHeld()).eq(1);
      expect(removalSourceSelector(delegateRemovalFlow.owed!, 2)).eq('[data-parl-support="Mars First"] [data-support-place="2"]');
      expect(removalDestinationSelector(delegateRemovalFlow.owed!)).eq('[data-parl-neutral-cube]');
    });

    it('once only: an echo frame, a first view (a reload) and a record nobody stands to play seed nothing', () => {
      registerDelegateRemovalHost(() => true);
      seedDelegateRemovalHolds(undefined, view(removal(9)));
      expect(delegateRemovalFlow.owed, 'a first view only learns the seq').is.undefined;
      seedDelegateRemovalHolds(view(removal(9)), view(removal(9)));
      expect(delegateRemovalFlow.owed).is.undefined;
      registerDelegateRemovalHost(() => false);
      seedDelegateRemovalHolds(view(removal(9)), view(removal(10)));
      expect(delegateRemovalFlow.owed, 'no mode stands — the table reads the server at once').is.undefined;
    });

    it('the selectors of the two ends', () => {
      expect(ribbonFigureSelector('g-1', 3)).eq('[data-instance="g-1"] .con-parl__ribbon [data-seq="3"]');
      expect(removalDestinationSelector({owner: RED, returnsTo: 'reserve'})).eq('[data-parl-seat-reserve="red"]');
    });
  });
});
