import {expect} from 'chai';
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

const REDS = 'RDX_DUMMY_REDS_1';
const GREENS = 'RDX_DUMMY_GREENS_1';

function slot(over: Partial<ParliamentSlotModel> = {}): ParliamentSlotModel {
  return {instance: `${REDS}#0`, resolution: REDS, party: PartyName.REDS, votes: [], totalVotes: 0, leader: undefined, isWinning: false, tiePriority: 1, viewerVotes: 0, ...over};
}

function access(over: Partial<PartyAccessModel> = {}): PartyAccessModel {
  return {party: PartyName.REDS, ruling: false, delegates: 0, byDelegates: false, granted: [], hasEffect: false, satisfiesRequirement: false, ...over};
}

function model(slots: ReadonlyArray<ParliamentSlotModel>, redsAccess: PartyAccessModel, over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {
    slots,
    rulingParty: PartyName.GREENS,
    popularSupport: {},
    players: [
      {
        color: 'blue', participates: true, lobby: true, reserve: 5, onResolutions: 0, chairman: false, agenda: 0, influence: 0,
        access: [
          {party: PartyName.GREENS, ruling: true, delegates: 0, byDelegates: false, granted: [], hasEffect: true, satisfiesRequirement: true},
          redsAccess,
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
    expect(resolutionStatusOf(REDS, undefined, 'blue')).to.eq(undefined);
    expect(resolutionStatusOf('RDX_DUMMY_UNITY_2', model([slot()], access()), 'blue')).to.eq(undefined);
    expect(resolutionPartyContextKey(undefined)).to.eq(undefined);
  });

  it('a proposal with 0 · 1 · 2 · 3 OWN delegates: not held below the threshold, held by delegates from two on (the pair stays a pair)', () => {
    const votesOf = (mine: number) => Array.from({length: mine}, (_, i) => ({owner: 'blue' as const, seq: i + 1}));
    const at = (mine: number, held: boolean) => resolutionStatusOf(REDS,
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
    const status = resolutionStatusOf(REDS, model([slot({votes, totalVotes: 4, leader: 'red', isWinning: true, viewerVotes: 1})], access({delegates: 1})), 'blue');
    expect(status?.access).to.deep.include({kind: 'progress', mine: 1});
    expect(status?.winning, 'the card\'s standing is read off the slot').to.eq(true);
  });

  it('the effect held on ANOTHER basis (the party rules · a card grant) reads as held, names the basis, and shows no places', () => {
    const ruling = resolutionStatusOf(GREENS,
      model([slot({instance: `${GREENS}#0`, resolution: GREENS, party: PartyName.GREENS})], access()), 'blue');
    expect(ruling?.access).to.deep.include({kind: 'held', basis: 'ruling', mine: 0, places: false});
    const granted = resolutionStatusOf(REDS, model([slot()], access({granted: ['Council Seat'], hasEffect: true})), 'blue');
    expect(granted?.access).to.deep.include({kind: 'held', basis: 'granted', mine: 0, places: false});
  });

  it('an ENACTED resolution: everyone\'s — no delegates asked of anybody, and the party line states the fact', () => {
    const status = resolutionStatusOf(REDS,
      model([], access({ruling: true, hasEffect: true}), {enacted: {instance: `${REDS}#0`, resolution: REDS, party: PartyName.REDS}, rulingParty: PartyName.REDS}), 'blue');
    expect(status?.lifecycle).to.eq('enacted');
    expect(status?.winning).to.eq(false);
    expect(status?.access).to.deep.include({kind: 'everyone', places: false});
    expect(resolutionPartyContextKey(status)).to.eq('Rules — every player has its effect');
  });

  it('the viewer is the player the inspector is opened AS — a seat with no parliament role (a spectator) gets the standing and no access', () => {
    const status = resolutionStatusOf(REDS, model([slot({isWinning: true})], access()), 'yellow');
    expect(status?.lifecycle).to.eq('vote');
    expect(status?.winning).to.eq(true);
    expect(status?.access).to.eq(undefined);
  });
});
