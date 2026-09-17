import {expect} from 'chai';
import {PartyName} from '@/common/turmoil/PartyName';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {REDUX_PARTIES} from '@/common/parliament/ParliamentTypes';
import {partyAnnotations, resolutionAnnotations, resolutionPartyAnnotations} from '@/client/console/parliament/parliamentAnnotations';
import {CardName} from '@/common/cards/CardName';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {InfluenceYield} from '@/common/parliament/influenceScaling';

/**
 * THE INSPECTOR'S READING BLOCKS for a parliament subject (Turmoil Redux).
 * The project card's language: the GRAPHIC is on the card, the blocks beside
 * it explain it in words and never draw it again. A resolution reads as one
 * scene: its OWN rules on the right (its effect part by part, labelled by
 * when it applies, then the quest's condition), its PARTY's mechanics on the
 * left (the plaque draws the formula, these blocks say the sentences), and
 * the footer states the standing — so no block restates the table, the
 * general rules, a technical note or the viewer's state. A party opened on
 * its own keeps its fuller reading (the mechanics, «for you» with the live
 * state, one reference line).
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
        {party: PartyName.INDUSTRIALISTS, ruling: false, delegates: 2, byDelegates: true, granted: [], hasEffect: true, satisfiesRequirement: true},
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

const texts = (blocks: ReadonlyArray<{rows: ReadonlyArray<{text: string}>}>) => blocks.flatMap((b) => b.rows.map((r) => r.text));

/** Rules are not state, and an ordinary action carries no per-generation sentence. */
const STATE_OR_LIMIT = /once per generation|available|used this generation|cannot be undone|mandatory/i;

describe('parliamentAnnotations — the fullscreen inspector\'s reading blocks', () => {
  it('no block carries a graphic — the card and the plaque draw, the blocks explain', () => {
    const all = [
      ...resolutionAnnotations(DUMMY), ...resolutionAnnotations('RDX_DEV_COMPOUND'), ...resolutionAnnotations('RDX_DEV_ACTION'),
      ...REDUX_PARTIES.flatMap((party) => [...resolutionPartyAnnotations(party), ...partyAnnotations(party, model(), 'blue', true)]),
    ];
    for (const block of all) {
      expect(Object.keys(block), block.id).to.not.include('graphic');
    }
  });

  it('the party column beside a resolution, for ALL SIX parties: the mechanics in words — one block per mechanic, no state, no limit sentence, no note', () => {
    for (const party of REDUX_PARTIES) {
      const blocks = resolutionPartyAnnotations(party);
      expect(blocks.length, party).to.be.within(1, 2);
      for (const block of blocks) {
        expect(block.labelKey, party).to.be.oneOf(['Effect', 'Action']);
        expect(block.rows.length, `${party}: one printed text per mechanic`).to.eq(1);
      }
      for (const text of texts(blocks)) {
        expect(text, party).to.not.match(STATE_OR_LIMIT);
      }
    }
  });

  it('the edited party texts: what happens, how much, what the player chooses — the Reds and the Scientists in full', () => {
    expect(texts(resolutionPartyAnnotations(PartyName.REDS))).to.deep.eq([
      'Draw 2 cards, then discard any 2 cards from your hand. Gain 2 M€ for each plant, microbe or animal tag on the discarded cards.',
    ]);
    const scientists = resolutionPartyAnnotations(PartyName.SCIENTISTS);
    expect(scientists.map((b) => b.labelKey), 'the effect and the action told apart').to.deep.eq(['Effect', 'Action']);
    expect(texts(scientists)).to.deep.eq([
      '+1 wild tag. It counts as any tag, except for awards and victory points.',
      'Add 2 data or 2 microbes to one of your cards that can hold that resource.',
    ]);
    expect(texts(resolutionPartyAnnotations(PartyName.INDUSTRIALISTS))).to.deep.eq([
      'Decrease any of your productions 1 step and increase your M€ or energy production 2 steps. You may decrease the same production you increase.',
    ]);
  });

  it('a party opened on its own: the mechanics, «for you» with the action\'s live state, and ONE reference line — each once', () => {
    const blocks = partyAnnotations(PartyName.INDUSTRIALISTS, model(), 'blue', true);
    expect(blocks.map((b) => b.labelKey)).to.deep.eq(['Party action', 'For you', 'Access']);
    expect(blocks[0].rows.map((r) => r.text), 'the action block is the printed text alone').to.have.length(1);
    const you = blocks[1].rows.map((r) => r.text);
    expect(you[you.length - 1], 'the live state closes «for you»').to.eq('Action available this generation');
    expect(blocks[2].rows.length, 'the reference is one line').to.eq(1);
    const all = texts(blocks);
    expect(new Set(all).size).to.eq(all.length);
  });

  it('the action\'s state is told apart: used · available on your turn · a server reason — and nothing without access', () => {
    const used = model();
    (used.players[0].partyActionUses as Record<string, number>)[PartyName.INDUSTRIALISTS] = 1;
    const last = (m: ParliamentModel, canActNow: boolean) => {
      const you = partyAnnotations(PartyName.INDUSTRIALISTS, m, 'blue', canActNow).find((b) => b.labelKey === 'For you');
      return you?.rows[you.rows.length - 1];
    };
    expect(last(used, true)?.text).to.eq('Action used this generation');
    expect(last(model(), false)?.text, 'the turn is an execution gate, never a refusal').to.eq('Action available on your turn');
    const refused = model({viewer: {...model().viewer!, partyActions: [{...model().viewer!.partyActions[0], available: false, reason: 'You have no production to decrease'}]}});
    expect(last(refused, true)).to.deep.include({text: 'Action unavailable: ${0}'});
    const noAccess = model({viewer: {...model().viewer!, partyActions: [{...model().viewer!.partyActions[0], hasAccess: false}]}});
    for (const text of texts(partyAnnotations(PartyName.INDUSTRIALISTS, noAccess, 'blue', true))) {
      expect(text).to.not.match(/^Action (used|available|unavailable)/);
    }
  });

  it('a passive party (the Greens) prints its effect once and no action block', () => {
    const blocks = partyAnnotations(PartyName.GREENS, model(), 'blue');
    expect(blocks.map((b) => b.labelKey)).to.deep.eq(['Party effect', 'For you', 'Access']);
    expect(blocks[0].rows.length).to.eq(1);
  });

  it('a dummy resolution: «no effect of its own» stands where a real effect will, then the quest\'s CONDITION in words', () => {
    const blocks = resolutionAnnotations(DUMMY);
    expect(blocks.map((b) => b.labelKey)).to.deep.eq(['Resolution effect', 'Chairman quest']);
    expect(texts([blocks[0]])).to.deep.eq(['No effect of its own']);
    expect(texts([blocks[1]]), 'the condition alone — the reward is the same for every resolution').to.deep.eq(['Raise your steel production 1 step']);
    for (const text of texts(blocks)) {
      expect(text.toLowerCase(), text).to.not.match(/dummy|iteration|test|tied/);
    }
  });

  it('the Reds\' delegate quest names what the player does', () => {
    const quest = resolutionAnnotations('RDX_DUMMY_REDS_1').find((b) => b.labelKey === 'Chairman quest');
    expect(quest === undefined ? [] : texts([quest])).to.deep.eq(['Send 4 delegates to resolutions']);
  });

  it('a resolution with a REAL effect: each part under the label of WHEN it applies, the text never repeating the label', () => {
    const immediate = resolutionAnnotations('RDX_DEV_IMMEDIATE');
    expect(immediate.map((b) => b.labelKey)).to.deep.eq(['When enacted', 'Chairman quest']);
    expect(immediate[0].kind).to.eq('immediate');
    expect(texts([immediate[0]])).to.deep.eq(['Every player gains 3 M€ and 1 plant.']);
    const compound = resolutionAnnotations('RDX_DEV_COMPOUND');
    expect(compound.map((b) => b.labelKey), 'a multi-part effect keeps its parts apart').to.deep.eq(['When enacted', 'For the winner of the vote', 'Chairman quest']);
    expect(texts([compound[1]])).to.deep.eq(['Gain 1 TR.']);
    const passive = resolutionAnnotations('RDX_DEV_PASSIVE');
    expect(passive.map((b) => b.labelKey)).to.deep.eq(['Resolution effect', 'Chairman quest']);
    expect(passive[0].kind).to.eq('effect');
    const action = resolutionAnnotations('RDX_DEV_ACTION');
    expect(action.map((b) => b.labelKey)).to.deep.eq(['Resolution action', 'Chairman quest']);
    expect(action[0].kind).to.eq('action');
    for (const text of texts([...immediate, ...compound, ...passive, ...action])) {
      expect(text, 'no timing label and no per-generation sentence inside the text').to.not.match(/^When enacted|once per generation/i);
    }
  });

  it('a COUNTED effect (Architecture Award): the effect, one sentence on which cards count, then — for a viewer — WHICH cards were counted', () => {
    const id = 'RDX_MARS_ARCHITECTURE_AWARD';
    const effect = getResolution(id)?.scaled?.[0];
    if (effect === undefined) {
      throw new Error('Architecture Award declares no scaled effect');
    }
    const bare = resolutionAnnotations(id);
    expect(bare.map((b) => b.labelKey), 'no viewer → no «for you»').to.deep.eq(['When enacted', 'Chairman quest']);
    expect(texts([bare[0]])).to.deep.eq([
      'Every player raises their M€ production by the number of their cards in play with a building tag and a non-negative VP icon, plus their influence. At most +5.',
      'A variable VP icon counts even at 0 VP; a card without a VP icon does not count.',
    ]);
    expect(texts([bare[1]])).to.deep.eq(['Play 2 building tags']);
    const now: InfluenceYield = {effect, context: 'estimate', influence: 2, amount: 4, count: 2, counted: [CardName.ARTIFICIAL_LAKE, CardName.MINE]};
    const live = resolutionAnnotations(id, [now, {...now, context: 'forecast'}]);
    expect(live.map((b) => b.labelKey)).to.deep.eq(['When enacted', 'For you', 'Chairman quest']);
    expect(live[1].rows[0].text).to.eq('Counted right now: ${0}');
    expect(live[1].rows[0].params?.[0]).to.contain(' · ');
    const recorded = resolutionAnnotations(id, [{...now, context: 'applied', counted: []}]);
    expect(texts([recorded[1]])).to.deep.eq(['No card was counted at the enactment']);
  });

  it('an unknown resolution reads nothing (never a blank chip)', () => {
    expect(resolutionAnnotations('RDX_NOT_A_CARD')).to.deep.eq([]);
  });
});
