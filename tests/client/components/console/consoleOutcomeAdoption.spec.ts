import {expect} from 'chai';
import {nextTick} from 'vue';
import {
  OutcomeAdoptionCtx,
  applyOutcomeAdoption,
  outcomeAdoptionHost,
  resolveOutcomeAdoption,
  sameAdoptionDecision,
} from '@/client/console/consoleOutcomeAdoption';
import {
  claimWorkspaceOutcome,
  resetWorkspaceOutcome,
  setWorkspaceOutcomeSlot,
  workspaceClaimsColonyReveal,
  workspaceClaimsDrawReveal,
  workspaceOutcomeState,
} from '@/client/console/consoleWorkspaceOutcome';
import {
  descendWorkspaceFrame,
  enterWorkspace,
  resetWorkspaceStack,
} from '@/client/console/consoleWorkspaceStack';
import {CardName} from '@/common/cards/CardName';
import type {CardDrawRevealSource} from '@/common/models/CardDrawRevealModel';

const PLUTO_SOURCE = {type: 'colony', colonyName: 'Pluto'} as CardDrawRevealSource;
const CARD_SOURCE: CardDrawRevealSource = {type: 'card', cardName: CardName.AI_CENTRAL};

function ctx(partial: Partial<OutcomeAdoptionCtx>): OutcomeAdoptionCtx {
  return {
    pending: true,
    source: CARD_SOURCE,
    claimLive: false,
    claimHost: undefined,
    claimHostKnown: false,
    claimMatchesBatch: false,
    boardSceneOwns: false,
    tradeSceneOwns: false,
    adoptionHost: undefined,
    claimServesLivePrompt: false,
    ...partial,
  };
}

describe('consoleOutcomeAdoption — the net under the claim system', () => {
  // Module state is BUNDLE-SHARED under mochapack: a leaked claim/stack would
  // corrupt every later spec in the batch.
  afterEach(() => {
    resetWorkspaceOutcome();
    resetWorkspaceStack();
  });

  describe('resolveOutcomeAdoption (pure)', () => {
    it('nothing pending → hands off', () => {
      expect(resolveOutcomeAdoption(ctx({pending: false, adoptionHost: 'start'})).kind).to.eq('none');
    });

    it('a healthy claim (host frame standing or parked) → hands off', () => {
      expect(resolveOutcomeAdoption(ctx({
        claimLive: true, claimMatchesBatch: true, claimHost: 'colonies', claimHostKnown: true,
        adoptionHost: 'start',
      })).kind).to.eq('none');
    });

    it('a matching claim whose HOST FRAME IS GONE re-homes to the live workspace (the Pluto-in-start case)', () => {
      expect(resolveOutcomeAdoption(ctx({
        source: PLUTO_SOURCE,
        claimLive: true, claimMatchesBatch: true, claimHost: 'colonies', claimHostKnown: false,
        adoptionHost: 'start',
      }))).to.deep.eq({kind: 'rehome', host: 'start'});
    });

    it('a matching claim with NO live host anywhere is RELEASED at once — standalone now, never a 20 s freeze', () => {
      expect(resolveOutcomeAdoption(ctx({
        claimLive: true, claimMatchesBatch: true, claimHost: 'colonies', claimHostKnown: false,
      })).kind).to.eq('release');
    });

    it('…but a claim SERVING A LIVE PROMPT is never orphan-released — it waits (\'none\') for its host or its answer', () => {
      // The regression class of 2026-09-04: a one-flush `workspaceFrameKnown`
      // gap (or a flow that tore its own frame) resolved to 'release' while
      // the player was mid-pick — the claim fell, the embedded prompt lost its
      // suppression of the standalone presenters and re-opened as a full-bleed
      // modal, and the workspace concluded under the player. A prompt cannot
      // degrade to a standalone card band the way a batch can.
      expect(resolveOutcomeAdoption(ctx({
        claimLive: true, claimMatchesBatch: true, claimHost: 'hydro', claimHostKnown: false,
        claimServesLivePrompt: true,
      })).kind).to.eq('none');
    });

    it('a serving claim whose host frame is gone still RE-HOMES when a live workspace can take it', () => {
      expect(resolveOutcomeAdoption(ctx({
        source: PLUTO_SOURCE,
        claimLive: true, claimMatchesBatch: true, claimHost: 'colonies', claimHostKnown: false,
        claimServesLivePrompt: true, adoptionHost: 'start',
      }))).to.deep.eq({kind: 'rehome', host: 'start'});
    });

    it('an UNOWNED viewer batch over an open workspace gets the late claim, keyed on its own source name', () => {
      expect(resolveOutcomeAdoption(ctx({adoptionHost: 'hydro'})))
        .to.deep.eq({kind: 'claim', host: 'hydro', sourceCard: CardName.AI_CENTRAL});
      expect(resolveOutcomeAdoption(ctx({source: PLUTO_SOURCE, adoptionHost: 'start'})))
        .to.deep.eq({kind: 'claim', host: 'start', sourceCard: 'Pluto'});
    });

    it('a live claim that does NOT answer for the batch adopts nothing — one flow never signs another\'s artifact', () => {
      expect(resolveOutcomeAdoption(ctx({
        claimLive: true, claimMatchesBatch: false, claimHost: 'hand', claimHostKnown: true,
        adoptionHost: 'hand',
      })).kind).to.eq('none');
    });

    it('the board pickup keeps its modal: tile / global-parameter / unattributed sources are never adopted', () => {
      expect(resolveOutcomeAdoption(ctx({source: {type: 'tile'}, adoptionHost: 'start'})).kind).to.eq('none');
      expect(resolveOutcomeAdoption(ctx({
        source: {type: 'globalParameter', parameter: 'venus'} as CardDrawRevealSource, adoptionHost: 'start',
      })).kind).to.eq('none');
      expect(resolveOutcomeAdoption(ctx({source: undefined, adoptionHost: 'start'})).kind).to.eq('none');
    });

    it('a batch a SCENE owns (board card-bonus cover lift, a live trade) is never adopted', () => {
      expect(resolveOutcomeAdoption(ctx({boardSceneOwns: true, adoptionHost: 'start'})).kind).to.eq('none');
      expect(resolveOutcomeAdoption(ctx({tradeSceneOwns: true, adoptionHost: 'start'})).kind).to.eq('none');
    });

    it('no workspace open → none (the bare board home keeps the standalone band)', () => {
      expect(resolveOutcomeAdoption(ctx({})).kind).to.eq('none');
    });
  });

  describe('outcomeAdoptionHost — the TOP frame or nobody', () => {
    it('the start workspace adopts at any stage (a phase root — its queue IS the flow)', () => {
      enterWorkspace('start', {anchor: {type: 'phase', phase: 'start'}});
      expect(outcomeAdoptionHost()).to.eq('start');
    });

    it('a browse layer never swallows an artifact — colonies adopt only INSIDE a flow', () => {
      enterWorkspace('colonies');
      expect(outcomeAdoptionHost()).to.eq(undefined);
      descendWorkspaceFrame('colonies', 'Pluto', 'stage');
      expect(outcomeAdoptionHost()).to.eq('colonies');
    });

    it('a non-hostable top frame adopts nothing (its outcome zone never mounts for a foreign batch)', () => {
      enterWorkspace('card-actions');
      descendWorkspaceFrame('card-actions', CardName.AI_CENTRAL as string, 'configure');
      expect(outcomeAdoptionHost()).to.eq(undefined);
    });

    it('empty stack → nobody', () => {
      expect(outcomeAdoptionHost()).to.eq(undefined);
    });
  });

  describe('applyOutcomeAdoption', () => {
    it('the late CLAIM makes the batch embeddable and owes neither the flip gate nor the beat', async () => {
      enterWorkspace('start', {anchor: {type: 'phase', phase: 'start'}});
      applyOutcomeAdoption({kind: 'claim', host: 'start', sourceCard: 'Pluto'});
      expect(workspaceOutcomeState.host).to.eq('start');
      expect(workspaceClaimsColonyReveal(PLUTO_SOURCE)).to.eq(true);
      expect(workspaceOutcomeState.answerIn).to.eq(true);
      expect(workspaceOutcomeState.beatDone).to.eq(true);
      // The zone is published a tick late (the host renders it in this patch).
      expect(workspaceOutcomeState.embedSlot).to.eq('');
      await nextTick();
      expect(workspaceOutcomeState.embedSlot).to.eq('.con-start__embed');
    });

    it('REHOME keeps the claim\'s identity and defers to the host\'s own zone publication', async () => {
      claimWorkspaceOutcome('colonies', 'Pluto', ['draw']);
      applyOutcomeAdoption({kind: 'rehome', host: 'start'});
      expect(workspaceOutcomeState.host).to.eq('start');
      expect(workspaceOutcomeState.sourceCard).to.eq('Pluto');
      // …and the unpinned predicate still answers for the batch from its new
      // host — this is what the host pin used to break.
      expect(workspaceClaimsColonyReveal(PLUTO_SOURCE)).to.eq(true);
      // A publication that lands meanwhile (the host's own watcher) WINS:
      setWorkspaceOutcomeSlot('[data-embed-slot="hand-outcome"]');
      await nextTick();
      expect(workspaceOutcomeState.embedSlot).to.eq('[data-embed-slot="hand-outcome"]');
    });

    it('RELEASE frees the batch for the standalone band immediately', () => {
      claimWorkspaceOutcome('colonies', 'Pluto', ['draw']);
      applyOutcomeAdoption({kind: 'release'});
      expect(workspaceOutcomeState.sourceCard).to.eq('');
      expect(workspaceClaimsDrawReveal(CARD_SOURCE)).to.eq(false);
    });

    it('none is a no-op', () => {
      claimWorkspaceOutcome('hydro', CardName.AI_CENTRAL as string, ['draw', 'pick'], 0, 2, 'chain');
      const before = {...workspaceOutcomeState};
      applyOutcomeAdoption({kind: 'none'});
      expect(workspaceOutcomeState.host).to.eq(before.host);
      expect(workspaceOutcomeState.sourceCard).to.eq(before.sourceCard);
    });
  });

  describe('sameAdoptionDecision — the applier\'s stability check', () => {
    it('matches decisions by kind and identity, so a one-flush gap never applies a stale verdict', () => {
      expect(sameAdoptionDecision({kind: 'none'}, {kind: 'none'})).to.eq(true);
      expect(sameAdoptionDecision({kind: 'release'}, {kind: 'release'})).to.eq(true);
      expect(sameAdoptionDecision({kind: 'release'}, {kind: 'none'})).to.eq(false);
      expect(sameAdoptionDecision(
        {kind: 'rehome', host: 'start'}, {kind: 'rehome', host: 'start'})).to.eq(true);
      expect(sameAdoptionDecision(
        {kind: 'rehome', host: 'start'}, {kind: 'rehome', host: 'hand'})).to.eq(false);
      expect(sameAdoptionDecision(
        {kind: 'claim', host: 'start', sourceCard: 'Pluto'},
        {kind: 'claim', host: 'start', sourceCard: 'Pluto'})).to.eq(true);
      expect(sameAdoptionDecision(
        {kind: 'claim', host: 'start', sourceCard: 'Pluto'},
        {kind: 'claim', host: 'start', sourceCard: 'Io'})).to.eq(false);
    });
  });
});
