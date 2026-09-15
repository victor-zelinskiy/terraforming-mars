import {expect} from 'chai';
import {PartyName} from '@/common/turmoil/PartyName';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {partyAnnotations, resolutionAnnotations} from '@/client/console/parliament/parliamentAnnotations';

/**
 * THE INSPECTOR'S RULES PANEL for a parliament subject (Turmoil Redux): the
 * subject's own rule, the live reading and ONE line of reference — each its
 * own block, none repeated, nothing about iterations or tests on a face the
 * player reads. Guarded so the panel stays short enough to fit the viewer
 * without a scroll for the six parties and the dummy resolutions.
 */

const DUMMY = 'RDX_DUMMY_INDUSTRIALISTS_1';

function model(over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {
    slots: [{instance: `${DUMMY}#0`, resolution: DUMMY, party: PartyName.INDUSTRIALISTS, votes: [{owner: 'red', seq: 1}, {owner: 'blue', seq: 2}], totalVotes: 2, leader: 'red', isWinning: true, tiePriority: 1, viewerVotes: 1}],
    rulingParty: PartyName.GREENS,
    popularSupport: {},
    players: [{
      color: 'blue', participates: true, lobby: true, reserve: 5, onResolutions: 1, chairman: false, agenda: 0, influence: 0,
      access: [
        {party: PartyName.GREENS, ruling: true, delegates: 0, byDelegates: false, granted: [], hasEffect: true, satisfiesRequirement: true},
        {party: PartyName.INDUSTRIALISTS, ruling: false, delegates: 1, byDelegates: false, granted: [], hasEffect: false, satisfiesRequirement: false},
      ],
      partyActionUses: {}, resolutionActionUses: 0,
    }],
    deckSize: 5, discardSize: 0, neutralSupply: 10, botMode: 'none',
    viewer: {
      vote: {available: true, reason: '', source: 'lobby', cost: 0, projections: []},
      partyActions: [{id: 'industrialists-shift', party: PartyName.INDUSTRIALISTS, hasAccess: true, usesLeft: 1, usesPerGeneration: 1, available: true, reason: '', preview: []}],
    },
    ...over,
  } as ParliamentModel;
}

const texts = (blocks: ReadonlyArray<{rows: ReadonlyArray<{text: string, params?: ReadonlyArray<string>}>}>) =>
  blocks.flatMap((b) => b.rows.map((r) => r.text));

describe('parliamentAnnotations — the fullscreen inspector\'s rules blocks', () => {
  it('a party: the effect, the action with its limit and LIVE state, «for you», and ONE reference line — each once', () => {
    const blocks = partyAnnotations(PartyName.INDUSTRIALISTS, model(), 'blue');
    expect(blocks.map((b) => b.labelKey)).to.deep.eq(['Party action', 'For you', 'Access']);
    const action = blocks[0];
    expect(action.rows.map((r) => r.text)).to.include('Decrease one production 1 step to increase your M€ or energy production 2 steps.');
    expect(action.rows.map((r) => r.text), 'the rulebook nuance rides the action block').to.include('You may decrease the very production you increase');
    expect(action.rows[action.rows.length - 1].text, 'the live state closes the block').to.eq('Once per generation · available');
    expect(blocks[1].rows.length, 'the live basis is short').to.be.within(1, 3);
    expect(blocks[2].rows.length, 'the reference is one line').to.eq(1);
    // No general paragraph is repeated across blocks.
    const all = texts(blocks);
    expect(new Set(all).size).to.eq(all.length);
  });

  it('a party whose action was USED says so in the action block, never in a paragraph of its own', () => {
    const m = model();
    (m.players[0].partyActionUses as Record<string, number>)[PartyName.INDUSTRIALISTS] = 1;
    const blocks = partyAnnotations(PartyName.INDUSTRIALISTS, m, 'blue');
    const action = blocks.find((b) => b.labelKey === 'Party action');
    expect(action?.rows[action.rows.length - 1].text).to.eq('Once per generation · used this generation');
  });

  it('a passive party (the Greens) prints its effect once and no action block', () => {
    const blocks = partyAnnotations(PartyName.GREENS, model(), 'blue');
    expect(blocks.map((b) => b.labelKey)).to.deep.eq(['Party effect', 'For you', 'Access']);
    expect(blocks[0].rows.length).to.eq(1);
  });

  it('a dummy resolution: «no effect of its own» — calm, and never a word about iterations or tests', () => {
    const blocks = resolutionAnnotations(DUMMY, model(), 'blue', [{color: 'red', name: 'Ann'}, {color: 'blue', name: 'Bob'}]);
    expect(blocks.map((b) => b.labelKey)).to.deep.eq(['Resolution effect', 'Party effect', 'Chairman quest', 'Status']);
    expect(blocks[0].rows.map((r) => r.text)).to.deep.eq(['No effect of its own']);
    for (const text of texts(blocks)) {
      expect(text.toLowerCase(), text).to.not.match(/dummy|iteration|test/);
    }
    // The party NAME reaches the row as a display string — translated, never a raw enum.
    const partyRow = blocks[1].rows[0];
    expect(partyRow.text).to.include('${0}');
    expect(partyRow.params?.[0]).to.be.a('string');
    // The quest is ONE row (condition · reward); the status is two: slot ·
    // delegates · leader · winning, and the viewer's line.
    expect(blocks[2].rows.length).to.eq(1);
    expect(blocks[3].rows.length).to.eq(2);
    expect(blocks[3].rows[0].params).to.deep.eq(['1', '2', 'Ann', 'winning now']);
    expect(blocks[3].rows[1].params).to.deep.eq(['1', '2']);
  });

  it('an ENACTED resolution reads its one status line', () => {
    const m = model({enacted: {instance: `${DUMMY}#0`, resolution: DUMMY, party: PartyName.INDUSTRIALISTS}, rulingParty: PartyName.INDUSTRIALISTS, slots: []});
    const blocks = resolutionAnnotations(DUMMY, m, 'blue');
    const status = blocks.find((b) => b.labelKey === 'Status');
    expect(status?.rows.length).to.eq(1);
    expect(status?.rows[0].text).to.eq('Enacted — ${0} rule');
  });
});
