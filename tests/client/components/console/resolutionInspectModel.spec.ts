import {expect} from 'chai';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {ParliamentModel, ParliamentSlotModel, PartyAccessModel} from '@/common/models/ParliamentModel';
import {resolutionPartyContextKey, resolutionStatusOf} from '@/client/console/parliament/resolutionInspectModel';

/**
 * THE RESOLUTION INSPECTOR'S FOOTER (Turmoil Redux): where the card stands
 * and the viewer's access to its party's effect — two facts, apart. The
 * access is the SERVER's verdict; the places count the VIEWER's own
 * delegates on the card and nobody else's; two delegates grant the party
 * effect and nothing about the resolution's own effect; an enacted card is
 * everyone's and asks nobody for delegates; no table → no status.
 */

/** Cards of the real deck — the footer reads the MODEL, so the ids are only names here. */
const GRID = 'RDX_INDUSTRIALISTS_CENTRAL_POWER_GRID';
const AQUIFER = 'RDX_GREENS_AQUIFER_CONTEST';

function slot(over: Partial<ParliamentSlotModel> = {}): ParliamentSlotModel {
  return {instance: `${GRID}#0`, resolution: GRID, party: PartyName.INDUSTRIALISTS, votes: [], totalVotes: 0, leader: undefined, isWinning: false, tiePriority: 1, viewerVotes: 0, ...over};
}

function access(over: Partial<PartyAccessModel> = {}): PartyAccessModel {
  return {party: PartyName.INDUSTRIALISTS, ruling: false, delegates: 0, byDelegates: false, granted: [], hasEffect: false, satisfiesRequirement: false, ...over};
}

function model(slots: ReadonlyArray<ParliamentSlotModel>, gridAccess: PartyAccessModel, over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {
    slots,
    rulingParty: PartyName.GREENS,
    popularSupport: {},
    players: [
      {
        color: 'blue', participates: true, lobby: true, reserve: 5, onResolutions: 0, chairman: false, agenda: 0, influence: 0,
        access: [
          {party: PartyName.GREENS, ruling: true, delegates: 0, byDelegates: false, granted: [], hasEffect: true, satisfiesRequirement: true},
          gridAccess,
        ],
        partyActionUses: {}, resolutionActionUses: 0,
      },
      {
        color: 'red', participates: true, lobby: false, reserve: 4, onResolutions: 2, chairman: false, agenda: 0, influence: 0,
        access: [], partyActionUses: {}, resolutionActionUses: 0,
      },
    ],
    deckSize: 5, discardSize: 0, neutralSupply: 10, botMode: 'none',
    ...over,
  } as ParliamentModel;
}

describe('resolutionInspectModel — the footer\'s standing and access', () => {
  it('no parliament, or a card that is neither in the vote nor enacted → no status (nothing invented)', () => {
    expect(resolutionStatusOf(GRID, undefined, 'blue')).to.eq(undefined);
    expect(resolutionStatusOf('RDX_MARS_ARCHITECTURE_AWARD', model([slot()], access()), 'blue')).to.eq(undefined);
    expect(resolutionPartyContextKey(undefined)).to.eq(undefined);
  });

  it('a proposal with 0 · 1 · 2 · 3 OWN delegates: not held below the threshold, held by delegates from two on (the pair stays a pair)', () => {
    const votesOf = (mine: number) => Array.from({length: mine}, (_, i) => ({owner: 'blue' as const, seq: i + 1}));
    const at = (mine: number, held: boolean) => resolutionStatusOf(GRID,
      model([slot({votes: votesOf(mine), totalVotes: mine, viewerVotes: mine})], access({delegates: mine, byDelegates: held, hasEffect: held})), 'blue');
    const zero = at(0, false);
    expect(zero?.lifecycle).to.eq('vote');
    expect(zero?.access).to.deep.include({kind: 'progress', mine: 0, threshold: 2, places: true});
    expect(at(1, false)?.access).to.deep.include({kind: 'progress', mine: 1, threshold: 2, places: true});
    const two = at(2, true);
    expect(two?.access).to.deep.include({kind: 'held', basis: 'delegates', mine: 2, threshold: 2, places: true});
    const three = at(3, true);
    expect(three?.access).to.deep.include({kind: 'held', basis: 'delegates', mine: 3, threshold: 2, places: true});
    expect(resolutionPartyContextKey(zero)).to.eq('If enacted — every player gets its effect');
  });

  it('neutral and other players\' delegates never fill the viewer\'s places', () => {
    const votes = [{owner: 'neutral' as const, seq: 1}, {owner: 'red' as const, seq: 2}, {owner: 'red' as const, seq: 3}, {owner: 'blue' as const, seq: 4}];
    const status = resolutionStatusOf(GRID, model([slot({votes, totalVotes: 4, leader: 'red', isWinning: true, viewerVotes: 1})], access({delegates: 1})), 'blue');
    expect(status?.access).to.deep.include({kind: 'progress', mine: 1});
    expect(status?.winning, 'the card\'s standing is read off the slot').to.eq(true);
  });

  it('the effect held on ANOTHER basis (the party rules · a card grant) reads as held, names the basis, and shows no places', () => {
    const ruling = resolutionStatusOf(AQUIFER,
      model([slot({instance: `${AQUIFER}#0`, resolution: AQUIFER, party: PartyName.GREENS})], access()), 'blue');
    expect(ruling?.access).to.deep.include({kind: 'held', basis: 'ruling', mine: 0, places: false});
    const granted = resolutionStatusOf(GRID, model([slot()], access({granted: ['Council Seat'], hasEffect: true})), 'blue');
    expect(granted?.access).to.deep.include({kind: 'held', basis: 'granted', mine: 0, places: false});
  });

  it('an ENACTED resolution: everyone\'s — no delegates asked of anybody, and the party line states the fact', () => {
    const status = resolutionStatusOf(GRID,
      model([], access({ruling: true, hasEffect: true}), {enacted: {instance: `${GRID}#0`, resolution: GRID, party: PartyName.INDUSTRIALISTS}, rulingParty: PartyName.INDUSTRIALISTS}), 'blue');
    expect(status?.lifecycle).to.eq('enacted');
    expect(status?.winning).to.eq(false);
    expect(status?.access).to.deep.include({kind: 'everyone', places: false});
    expect(resolutionPartyContextKey(status)).to.eq('Ruling party');
  });

  it('the viewer is the player the inspector is opened AS — a seat with no parliament role (a spectator) gets the standing and no access', () => {
    const status = resolutionStatusOf(GRID, model([slot({isWinning: true})], access()), 'yellow');
    expect(status?.lifecycle).to.eq('vote');
    expect(status?.winning).to.eq(true);
    expect(status?.access).to.eq(undefined);
  });
});

describe('resolutionInspectModel — THIS vote\'s projection on the access line (registry R-10)', () => {
  const BLUE = 'blue' as Color;
  const RED = 'red' as Color;
  function modelWith(unlocksEffect: boolean | undefined, mine: number): ParliamentModel {
    const instance = 'RDX_GREENS_AQUIFER_CONTEST#0';
    const votes = [{owner: RED, seq: 1}, ...(mine > 0 ? [{owner: BLUE, seq: 2}] : [])];
    const access: PartyAccessModel = {party: PartyName.GREENS, ruling: false, delegates: mine, byDelegates: false, granted: [], hasEffect: false, satisfiesRequirement: false};
    const slot: ParliamentSlotModel = {instance, resolution: 'RDX_GREENS_AQUIFER_CONTEST', party: PartyName.GREENS, votes, totalVotes: votes.length, leader: RED, isWinning: false, tiePriority: 1, viewerVotes: mine};
    return {
      slots: [slot], rulingParty: PartyName.GREENS, popularSupport: {}, deckSize: 3, discardSize: 0, neutralSupply: 10, botMode: 'none',
      players: [{color: BLUE, participates: true, lobby: true, reserve: 5, onResolutions: mine, chairman: false, agenda: 0, influence: 0, access: [access], partyActionUses: {}, resolutionActionUses: 0, counts: [], production: {}}],
      viewer: {vote: {available: true, reason: '', source: 'lobby', cost: 0, projections: unlocksEffect === undefined ? [] : [{instance, votesAfter: votes.length + 1, leaderAfter: RED, viewerLeads: false, becomesWinning: false, unlocksEffect, unlocksRequirement: unlocksEffect}]}, partyActions: []},
    } as unknown as ParliamentModel;
  }
  it('on the edge (one own delegate, the server projects the unlock) the progress line says «→ effect is yours»', () => {
    const status = resolutionStatusOf('RDX_GREENS_AQUIFER_CONTEST', modelWith(true, 1), BLUE);
    expect(status?.access?.kind).eq('progress');
    expect(status?.access?.unlocksWithVote).eq(true);
  });
  it('off the edge (no own delegate yet) the line projects nothing', () => {
    expect(resolutionStatusOf('RDX_GREENS_AQUIFER_CONTEST', modelWith(false, 0), BLUE)?.access?.unlocksWithVote).eq(false);
  });
  it('without a projection (no vote option on the wire) the line projects nothing — never a client guess', () => {
    expect(resolutionStatusOf('RDX_GREENS_AQUIFER_CONTEST', modelWith(undefined, 1), BLUE)?.access?.unlocksWithVote).eq(false);
  });
});
