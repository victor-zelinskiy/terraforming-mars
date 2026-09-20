import {expect} from 'chai';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentModel, ParliamentPhaseModel, ParliamentPhaseSummaryModel} from '@/common/models/ParliamentModel';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {
  detectSittingTransition, heldSittingKey, resetParliamentSittingSeed, seedParliamentSittingHolds,
} from '@/client/console/parliament/parliamentSittingSeed';
import {enactmentHeld, parliamentHolds, releaseEnactmentHolds, releaseRenewalHolds, renewalHeld} from '@/client/console/parliament/parliamentDisplayHolds';

/*
 * THE SITTING'S TRANSITION SEEDS (v2): one response → the display holds the
 * tiers keep until the director's beats have moved every object. Pure
 * against two views; the SAME function for an own submit and a poll frame.
 */
const BLUE = 'blue' as Color;
const RED = 'red' as Color;
const A = 'RDX_GREENS_AQUIFER_CONTEST#0';
const B = 'RDX_MARS_ARCHITECTURE_AWARD#0';
const C = 'RDX_INDUSTRIALISTS_CENTRAL_POWER_GRID#0';

function slot(instance: string, party: ReduxParty, votes: Array<{owner: Color | 'neutral', seq: number}> = []) {
  return {instance, resolution: instance.split('#')[0], party, votes, totalVotes: votes.length, isWinning: false, tiePriority: 1, viewerVotes: votes.filter((v) => v.owner === BLUE).length};
}

function summary(over: Partial<ParliamentPhaseSummaryModel> = {}): ParliamentPhaseSummaryModel {
  return {
    generation: 2, final: false, seq: 4,
    winner: {instance: A, resolution: 'RDX_GREENS_AQUIFER_CONTEST', party: PartyName.GREENS, votes: 1, player: BLUE, slot: 0},
    support: [], enacted: {instance: A, resolution: 'RDX_GREENS_AQUIFER_CONTEST', party: PartyName.GREENS}, refreshed: [], lobbyRefilled: [],
    ...over,
  };
}

function model(phase: Partial<ParliamentPhaseModel> | undefined, over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {
    slots: [slot(A, PartyName.GREENS, [{owner: BLUE, seq: 1}]), slot(B, PartyName.MARS), slot(C, PartyName.INDUSTRIALISTS)],
    rulingParty: PartyName.GREENS, popularSupport: {}, deckSize: 10, discardSize: 0, neutralSupply: 14, botMode: 'none',
    players: [BLUE, RED].map((color) => ({color, participates: true, lobby: false, reserve: 6, onResolutions: color === BLUE ? 1 : 0, chairman: false, agenda: 0, influence: 1, access: [], partyActionUses: {}, resolutionActionUses: 0})),
    phase: phase === undefined ? undefined : {generation: 2, final: false, step: 'assembly', summary: summary(), ...phase},
    ...over,
  } as unknown as ParliamentModel;
}

function view(parliament: ParliamentModel | undefined): PlayerViewModel {
  return {thisPlayer: {color: BLUE}, players: [{color: BLUE, name: 'Blue'}, {color: RED, name: 'Red'}], game: {parliament: parliament ?? {}}} as unknown as PlayerViewModel;
}

describe('parliamentSittingSeed — the holds of one response, in the same block as the view apply', () => {
  beforeEach(() => resetParliamentSittingSeed());
  after(() => resetParliamentSittingSeed());

  it('DETECT: the barrier opened (verdict → past it) and the refresh arrived (effects → past it); nothing across a generation or from a first view', () => {
    const at = (step: ParliamentPhaseModel['step'], generation = 2) => view(model({step, generation}));
    expect(detectSittingTransition(at('assembly'), at('effects'))).deep.eq({barrier: true, refresh: false});
    expect(detectSittingTransition(at('assembly'), at('adjourn')), 'a quiet card: the barrier AND the refresh in one response').deep.eq({barrier: true, refresh: true});
    expect(detectSittingTransition(at('effects'), at('adjourn'))).deep.eq({barrier: false, refresh: true});
    expect(detectSittingTransition(at('effects'), at('effects')), 'a step that stayed').deep.eq({barrier: false, refresh: false});
    expect(detectSittingTransition(undefined, at('effects')), 'a first view (a reload)').deep.eq({barrier: false, refresh: false});
    expect(detectSittingTransition(at('assembly', 1), at('effects', 2)), 'another generation').deep.eq({barrier: false, refresh: false});
    expect(detectSittingTransition(at('assembly'), view(model({step: 'adjourn', final: true}))), 'the final phase refreshes nothing').deep.eq({barrier: true, refresh: false});
  });

  it('THE BARRIER OPENED — the same seeds for the OWN submit and the POLL: the table as voted is held (the winner in its slot), the Agenda move, the support, the returns, the OLD government', () => {
    const before = view(model({step: 'assembly'}, {rulingParty: PartyName.GREENS, chairman: RED}));
    const after = view(model({
      step: 'effects',
      summary: summary({
        agenda: {player: BLUE, from: 2, to: 3},
        support: [{party: PartyName.REDS, gained: 1, total: 1, reason: 'absent'}, {party: PartyName.MARS, gained: 2, total: 2, reason: 'lost-with-player-vote'}],
        returned: [{owner: BLUE, count: 1}],
        discardedEnacted: undefined,
      }),
    }, {
      slots: [slot(B, PartyName.MARS), slot(C, PartyName.INDUSTRIALISTS)],
      enacted: {instance: A, resolution: 'RDX_GREENS_AQUIFER_CONTEST', party: PartyName.GREENS},
      rulingParty: PartyName.GREENS,
      popularSupport: {[PartyName.REDS]: 1, [PartyName.MARS]: 2},
    }));
    for (const path of ['own submit', 'poll'] as const) {
      resetParliamentSittingSeed();
      seedParliamentSittingHolds(before, after);
      const h = parliamentHolds;
      expect(heldSittingKey(), path).eq('2:4');
      expect(enactmentHeld(), `${path}: the enactment is held`).is.true;
      expect(h.heldSlots?.map((s) => s.instance), `${path}: the table as voted`).deep.eq([A, B, C]);
      expect(h.winnerSlot, `${path}: the winner's slot`).eq(A);
      expect(h.agendaAwaits, `${path}: the marker still on its old step`).deep.eq({player: BLUE, from: 2, to: 3});
      expect(Array.from(h.supportIncoming.entries()), `${path}: the support not yet seated`).deep.eq([[PartyName.REDS, 1], [PartyName.MARS, 2]]);
      expect(Array.from(h.returns.entries()), `${path}: the delegate not yet home`).deep.eq([[BLUE, 1]]);
      expect(h.govBefore, `${path}: the old government — the empty seat`).deep.eq({enacted: undefined});
      expect(h.govAwaits, `${path}: the new card's face waits`).eq(A);
      expect(h.rulerBefore, `${path}: the old ruler`).eq(PartyName.GREENS);
      expect(h.questBefore?.chairman, `${path}: the old chairman`).eq(RED);
      expect(renewalHeld(), `${path}: nothing of the renewal yet`).is.false;
    }
  });

  it('a quiet card: the barrier and the refresh in ONE response — the renewal\'s holds ride on top (fresh faces, the neutral cubes, the deck, the lobby), the held table stays the voted one', () => {
    const before = view(model({step: 'assembly'}));
    const fresh = 'RDX_GREENS_CLIMATE_RESEARCH#0';
    const after = view(model({
      step: 'adjourn',
      summary: summary({
        support: [{party: PartyName.MARS, gained: 1, total: 1, reason: 'lost'}],
        refreshed: [{instance: fresh, resolution: 'RDX_GREENS_CLIMATE_RESEARCH', party: PartyName.GREENS, neutralVotes: 1}],
        discarded: [{instance: B, resolution: 'RDX_MARS_ARCHITECTURE_AWARD', party: PartyName.MARS}, {instance: C, resolution: 'RDX_INDUSTRIALISTS_CENTRAL_POWER_GRID', party: PartyName.INDUSTRIALISTS}],
        lobbyRefilled: [BLUE, RED],
      }),
    }, {
      slots: [slot(fresh, PartyName.GREENS, [{owner: 'neutral', seq: 7}])],
      enacted: {instance: A, resolution: 'RDX_GREENS_AQUIFER_CONTEST', party: PartyName.GREENS},
    }));
    seedParliamentSittingHolds(before, after);
    const h = parliamentHolds;
    expect(h.heldSlots?.map((s) => s.instance), 'the table as voted, through the whole walk').deep.eq([A, B, C]);
    expect(h.supportIncoming.get(PartyName.MARS), 'the enactment\'s support').eq(1);
    expect(renewalHeld()).is.true;
    expect(Array.from(h.freshFaces)).deep.eq([fresh]);
    expect(Array.from(h.hiddenCubes)).deep.eq([`${fresh}#7`]);
    expect(h.support.get(PartyName.GREENS), 'the plaque keeps the cube the refresh moved onto the fresh card').eq(1);
    expect(h.deckPending).eq(1);
    expect(Array.from(h.lobby)).deep.eq([BLUE, RED]);
    // IDEMPOTENT over a second frame of the same step (a poll echo): nothing doubles.
    seedParliamentSittingHolds(after, after);
    expect(h.supportIncoming.get(PartyName.MARS)).eq(1);
    expect(h.support.get(PartyName.GREENS)).eq(1);
    expect(Array.from(h.hiddenCubes)).deep.eq([`${fresh}#7`]);
    // The director releases each family on its own: the enactment's, then the renewal's.
    releaseEnactmentHolds();
    expect(enactmentHeld()).is.false;
    expect(Array.from(h.vacated), 'the winner\'s held slot stands vacated').deep.eq([A]);
    expect(h.heldSlots, 'the table is still held for the renewal').is.not.undefined;
    releaseRenewalHolds();
    expect(renewalHeld()).is.false;
    expect(h.heldSlots).is.undefined;
  });

  it('a first view seeds nothing (a reload lands in the final poses); a new sitting drops the old holds; the phase\'s end resets', () => {
    seedParliamentSittingHolds(undefined, view(model({step: 'effects'})));
    expect(enactmentHeld()).is.false;
    expect(heldSittingKey()).eq('2:4');
    seedParliamentSittingHolds(view(model({step: 'assembly'})), view(model({step: 'effects', summary: summary({returned: [{owner: BLUE, count: 1}]})})));
    expect(enactmentHeld()).is.true;
    seedParliamentSittingHolds(view(model({step: 'effects'})), view(model({step: 'assembly', generation: 3, summary: summary({generation: 3, seq: 5})})));
    expect(heldSittingKey(), 'a new sitting').eq('3:5');
    expect(enactmentHeld(), 'the old holds are gone').is.false;
    seedParliamentSittingHolds(view(model({step: 'adjourn', generation: 3, summary: summary({generation: 3, seq: 5})})), view(model(undefined)));
    expect(heldSittingKey(), 'the phase is over').eq('');
  });
});
