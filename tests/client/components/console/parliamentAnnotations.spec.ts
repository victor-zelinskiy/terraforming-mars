import {expect} from 'chai';
import {PartyName} from '@/common/turmoil/PartyName';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {partyAnnotations, resolutionAnnotations, resolutionPartyAnnotations} from '@/client/console/parliament/parliamentAnnotations';

/**
 * THE INSPECTOR'S READING BLOCKS for a parliament subject (Turmoil Redux).
 * A resolution reads as one scene: its OWN rules on the right (the printed
 * effect with its graphic, the quest's condition), its PARTY's mechanics on
 * the left (the plaque draws the graphic, these blocks say the sentences),
 * and the footer states the standing — so no block here restates the
 * table, the general rules, or the viewer's access. A party opened on its
 * own keeps its fuller reading (the mechanics, «for you», one reference
 * line). Guarded so the columns stay short enough for the viewer's band.
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

describe('parliamentAnnotations — the fullscreen inspector\'s reading blocks', () => {
  it('a party: the effect, the action with its limit and LIVE state, «for you», and ONE reference line — each once', () => {
    const blocks = partyAnnotations(PartyName.INDUSTRIALISTS, model(), 'blue', true);
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
    const blocks = partyAnnotations(PartyName.INDUSTRIALISTS, m, 'blue', true);
    const action = blocks.find((b) => b.labelKey === 'Party action');
    expect(action?.rows[action.rows.length - 1].text).to.eq('Once per generation · used this generation');
  });

  it('an available action OFF the viewer\'s turn stays available — the turn is an execution gate, named as such', () => {
    const blocks = partyAnnotations(PartyName.INDUSTRIALISTS, model(), 'blue', false);
    const action = blocks.find((b) => b.labelKey === 'Party action');
    expect(action?.rows[action.rows.length - 1].text).to.eq('Once per generation · available on your turn');
  });

  it('a passive party (the Greens) prints its effect once and no action block', () => {
    const blocks = partyAnnotations(PartyName.GREENS, model(), 'blue');
    expect(blocks.map((b) => b.labelKey)).to.deep.eq(['Party effect', 'For you', 'Access']);
    expect(blocks[0].rows.length).to.eq(1);
  });

  it('a dummy resolution: «no effect of its own» stands where a real effect will, then the quest\'s CONDITION with its graphic — no party, no status, no rules of politics', () => {
    const blocks = resolutionAnnotations(DUMMY);
    expect(blocks.map((b) => b.labelKey)).to.deep.eq(['Resolution effect', 'Chairman quest']);
    expect(blocks[0].rows.map((r) => r.text)).to.deep.eq(['No effect of its own']);
    expect(blocks[0].graphic, 'a dummy prints no graphic').to.eq(undefined);
    expect(blocks[1].rows.map((r) => r.text), 'the condition alone — the reward is the same for every resolution and lives in the government block').to.deep.eq(['Raise your steel production 1 step']);
    expect(blocks[1].graphic, 'the quest goal as the face\'s own drawing').to.not.eq(undefined);
    for (const text of texts(blocks)) {
      expect(text.toLowerCase(), text).to.not.match(/dummy|iteration|test|delegates|tied/);
    }
  });

  it('a resolution with a REAL effect: the printed graphic rides the first block, the framework\'s own facts follow the sentence', () => {
    const immediate = resolutionAnnotations('RDX_DEV_IMMEDIATE');
    expect(immediate.map((b) => b.labelKey)).to.deep.eq(['Resolution effect', 'Chairman quest']);
    expect(immediate[0].kind).to.eq('immediate');
    expect(immediate[0].graphic, 'the own effect\'s graphic').to.not.eq(undefined);
    expect(immediate[0].rows.map((r) => r.text)).to.deep.eq(['When enacted: every player gains 3 M€ and 1 plant.']);
    const compound = resolutionAnnotations('RDX_DEV_COMPOUND');
    expect(compound[0].rows.map((r) => r.text)[1], 'a winner-only part is named as the framework knows it').to.match(/winner/);
    const passive = resolutionAnnotations('RDX_DEV_PASSIVE');
    expect(passive[0].kind).to.eq('effect');
    expect(passive[0].rows.map((r) => r.text)).to.include('While enacted, every player has this effect');
    const action = resolutionAnnotations('RDX_DEV_ACTION');
    expect(action[0].kind).to.eq('action');
    expect(action[0].labelKey).to.eq('Resolution action');
  });

  it('an unknown resolution reads nothing (never a blank chip)', () => {
    expect(resolutionAnnotations('RDX_NOT_A_CARD')).to.deep.eq([]);
  });

  it('the party column beside a resolution: the mechanics\' sentences only — no «for you», no reference (the footer and the party\'s own inspector carry those)', () => {
    const scientists = resolutionPartyAnnotations(PartyName.SCIENTISTS, model(), 'blue', true);
    expect(scientists.map((b) => b.labelKey), 'the effect and the action told apart').to.deep.eq(['Party effect', 'Party action']);
    expect(scientists[0].rows[0].text).to.eq('+1 wild tag when playing cards and actions.');
    expect(scientists[1].rows[0].text).to.eq('Add 2 data or 2 microbes to one of your cards that holds that resource.');
    expect(scientists[1].rows[scientists[1].rows.length - 1].text, 'no access to the action → the limit alone, no claim').to.eq('Once per generation');
    const reds = resolutionPartyAnnotations(PartyName.REDS, model(), 'blue', true);
    expect(reds.map((b) => b.labelKey)).to.deep.eq(['Party action']);
    expect(reds[0].rows.map((r) => r.text)).to.include('The draw cannot be undone; the discard that follows is mandatory');
    const greens = resolutionPartyAnnotations(PartyName.GREENS, undefined, undefined);
    expect(greens.map((b) => b.labelKey), 'outside a live table the mechanics still read').to.deep.eq(['Party effect']);
    for (const block of [...scientists, ...reds, ...greens]) {
      expect(block.labelKey).to.not.be.oneOf(['For you', 'Access', 'Status']);
    }
  });

  it('the party column\'s action state is the SAME derivation the party inspector uses (used · available · on your turn)', () => {
    const used = model();
    (used.players[0].partyActionUses as Record<string, number>)[PartyName.INDUSTRIALISTS] = 1;
    const column = resolutionPartyAnnotations(PartyName.INDUSTRIALISTS, used, 'blue', true);
    const own = partyAnnotations(PartyName.INDUSTRIALISTS, used, 'blue', true);
    expect(column[0].rows.map((r) => r.text)).to.deep.eq(own[0].rows.map((r) => r.text));
    expect(column[0].rows[column[0].rows.length - 1].text).to.eq('Once per generation · used this generation');
  });
});
