import {expect} from 'chai';
import {PartyName} from '@/common/turmoil/PartyName';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {REDUX_PARTIES} from '@/common/parliament/ParliamentTypes';
import {partyAnnotations, resolutionAnnotations, resolutionPartyAnnotations} from '@/client/console/parliament/parliamentAnnotations';
import {CardName} from '@/common/cards/CardName';
import {allResolutions, getResolution} from '@/client/parliament/ClientParliamentManifest';
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

const GRID = 'RDX_INDUSTRIALISTS_CENTRAL_POWER_GRID';

function model(over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {
    slots: [{instance: `${GRID}#0`, resolution: GRID, party: PartyName.INDUSTRIALISTS, votes: [{owner: 'red', seq: 1}, {owner: 'blue', seq: 2}], totalVotes: 2, leader: 'red', isWinning: true, tiePriority: 1, viewerVotes: 1}],
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
      ...resolutionAnnotations(GRID), ...resolutionAnnotations('RDX_DEV_COMPOUND'), ...resolutionAnnotations('RDX_DEV_ACTION'),
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
        expect(block.labelKey, party).to.be.oneOf(['Party effect', 'Party action']);
        expect(block.rows.length, `${party}: one printed text per mechanic`).to.eq(1);
      }
      for (const text of texts(blocks)) {
        expect(text, party).to.not.match(STATE_OR_LIMIT);
      }
    }
  });

  it('the edited party texts: what happens, how much, what the player chooses — the Reds and the Scientists in full', () => {
    expect(texts(resolutionPartyAnnotations(PartyName.REDS))).to.deep.eq([
      'Draw 2 cards, then discard any 2 cards from hand. Gain 2 M€ per plant, microbe and animal tag discarded.',
    ]);
    const scientists = resolutionPartyAnnotations(PartyName.SCIENTISTS);
    expect(scientists.map((b) => b.labelKey), 'the effect and the action told apart').to.deep.eq(['Party effect', 'Party action']);
    expect(texts(scientists)).to.deep.eq([
      '+1 wild tag. It does not count for awards and VP.',
      'Add 2 data or 2 microbes to one of your cards that can hold them.',
    ]);
    expect(texts(resolutionPartyAnnotations(PartyName.INDUSTRIALISTS))).to.deep.eq([
      'Lower one of your productions 1 step and raise your M€ or energy production 2 steps. It may be the same production.',
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

  it('every SHIPPED resolution reads its own effect first and the quest\'s CONDITION last — the deck holds no card without an effect', () => {
    const shipped = allResolutions().filter((resolution) => resolution.copies > 0);
    expect(shipped, 'the deck is not empty').to.not.be.empty;
    const effectLabels = ['When enacted', 'For the winner of the vote', 'Resolution effect', 'Resolution action'];
    for (const resolution of shipped) {
      const blocks = resolutionAnnotations(resolution.id);
      expect(blocks.length, resolution.id).to.be.greaterThan(1);
      expect(blocks[0].labelKey, `${resolution.id}: its effect first`).to.be.oneOf(effectLabels);
      const quest = blocks[blocks.length - 1];
      expect(quest.labelKey, resolution.id).to.eq('Chairman quest');
      expect(texts([quest]), `${resolution.id}: the condition alone — the reward is the same for every resolution`).to.deep.eq([resolution.text.quest]);
      for (const text of texts(blocks)) {
        expect(text.toLowerCase(), `${resolution.id}: ${text}`).to.not.match(/\b(dummy|iteration|test|tied)\b/);
      }
    }
  });

  it('a delegate quest names what the player does (the Reds\' dev example)', () => {
    const quest = resolutionAnnotations('RDX_DEV_COMPOUND').find((b) => b.labelKey === 'Chairman quest');
    expect(quest === undefined ? [] : texts([quest])).to.deep.eq(['Send 4 delegates to resolutions']);
  });

  it('a resolution with a REAL effect: each part under the label of WHEN it applies, the text never repeating the label', () => {
    const immediate = resolutionAnnotations('RDX_DEV_IMMEDIATE');
    expect(immediate.map((b) => b.labelKey)).to.deep.eq(['When enacted', 'Chairman quest']);
    expect(immediate[0].kind).to.eq('immediate');
    expect(texts([immediate[0]])).to.deep.eq(['Gain 3 M€ and 1 plant.']);
    const compound = resolutionAnnotations('RDX_DEV_COMPOUND');
    expect(compound.map((b) => b.labelKey), 'a multi-part effect keeps its parts apart').to.deep.eq(['When enacted', 'For the winner of the vote', 'Chairman quest']);
    expect(texts([compound[1]])).to.deep.eq(['Gain 2 M€.']);
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
      'Raise your M€ production 1 step per building card with a VP icon you have in play, plus 1 per influence. Max 5.',
      'A card with a variable VP icon counts even at 0 VP. A card with a negative VP icon or no VP icon does not.',
    ]);
    expect(texts([bare[1]])).to.deep.eq(['Play 2 building tags']);
    const now: InfluenceYield = {effect, context: 'estimate', influence: 2, amount: 4, count: 2, counted: [CardName.ARTIFICIAL_LAKE, CardName.MINE]};
    const live = resolutionAnnotations(id, [now, {...now, context: 'forecast'}]);
    expect(live.map((b) => b.labelKey)).to.deep.eq(['When enacted', 'For you', 'Chairman quest']);
    expect(live[1].rows[0].text).to.eq('Counted right now: ${0}');
    expect(live[1].rows[0].params?.[0]).to.contain(' · ');
    // Nothing counted AT the enactment — the record is B = 0 with an empty list.
    const recorded = resolutionAnnotations(id, [{...now, context: 'applied', count: 0, counted: []}]);
    expect(texts([recorded[1]])).to.deep.eq(['No card was counted at the enactment']);
  });

  it('a TAG-COUNTED effect (Central Power Grid): its own qualification sentence, and each card with what IT contributed', () => {
    const id = 'RDX_INDUSTRIALISTS_CENTRAL_POWER_GRID';
    const effect = getResolution(id)?.scaled?.[0];
    if (effect === undefined) {
      throw new Error('Central Power Grid declares no scaled effect');
    }
    const bare = resolutionAnnotations(id);
    expect(bare.map((b) => b.labelKey), 'no winner block — this card has no winner part').to.deep.eq(['When enacted', 'Chairman quest']);
    expect(texts([bare[0]])).to.deep.eq([
      'Raise your M€ production 1 step per power tag you have, plus 1 per influence. Max 5.',
      'Each power tag counts: a card with two power tags counts twice. Wild tags and energy production do not count.',
    ]);
    expect(texts([bare[1]])).to.deep.eq(['Play 2 power tags']);
    const now: InfluenceYield = {
      effect, context: 'estimate', influence: 2, amount: 5, count: 3,
      counted: [CardName.HE3_FUSION_PLANT, CardName.POWER_PLANT], countedUnits: [2, 1],
    };
    const live = resolutionAnnotations(id, [now]);
    expect(live.map((b) => b.labelKey)).to.deep.eq(['When enacted', 'For you', 'Chairman quest']);
    expect(live[1].rows[0].text).to.eq('Counted right now: ${0}');
    // The card worth two says so; the card worth one does not carry a ×1.
    expect(live[1].rows[0].params?.[0]).to.contain('×2');
    expect(live[1].rows[0].params?.[0]).to.not.contain('×1');
    const recorded = resolutionAnnotations(id, [{...now, context: 'applied', count: 0, counted: [], countedUnits: []}]);
    expect(texts([recorded[1]])).to.deep.eq(['No card was counted at the enactment']);
  });

  it('a BOARD-COUNTED effect (Colonization Funding): its own qualification sentence, and the CELLS behind the number — by the board layer\'s names, else the number', () => {
    const id = 'RDX_UNITY_COLONIZATION_FUNDING';
    const effect = getResolution(id)?.scaled?.[0];
    if (effect === undefined) {
      throw new Error('Colonization Funding declares no scaled effect');
    }
    const bare = resolutionAnnotations(id);
    expect(bare.map((b) => b.labelKey), 'no winner block — this card has no winner part').to.deep.eq(['When enacted', 'Chairman quest']);
    expect(texts([bare[0]])).to.deep.eq([
      'Raise your M€ production 2 steps per space city you have, plus 1 per influence. Max 6.',
      'A city on a reserved area off Mars counts: Ganymede Colony, Phobos Space Haven, Stanford Torus and the like. Cities on Mars and on the Moon do not.',
    ]);
    expect(texts([bare[1]])).to.deep.eq(['Place 1 space city']);
    // Two named reserved areas: the row lists them by the names the placement hints already print.
    const now: InfluenceYield = {effect, context: 'estimate', influence: 3, amount: 6, count: 2, counted: [], countedSpaces: ['01', '02'], uncapped: 7};
    const live = resolutionAnnotations(id, [now]);
    expect(live.map((b) => b.labelKey)).to.deep.eq(['When enacted', 'For you', 'Chairman quest']);
    expect(live[1].rows[0].text).to.eq('Counted right now: ${0}');
    expect(live[1].rows[0].params?.[0]).to.eq('Ganymede Colony · Phobos Space Haven');
    // A cell the board layer does not name: the row prints the NUMBER (the plural of the counted object), never an invented name.
    const unnamed = resolutionAnnotations(id, [{...now, count: 2, countedSpaces: ['01', '75']}]);
    expect(unnamed[1].rows[0].text).to.eq('Counted right now: ${0}');
    expect(unnamed[1].rows[0].params?.[0]).to.match(/^2 /);
    expect(unnamed[1].rows[0].params?.[0]).to.not.contain('75');
    // Nothing counted at the enactment — said in the object's own terms (a tile, never «no card»).
    const recorded = resolutionAnnotations(id, [{...now, context: 'applied', count: 0, countedSpaces: [], amount: 3, uncapped: 3}]);
    expect(texts([recorded[1]])).to.deep.eq(['No tile was counted at the enactment']);
    expect(texts([resolutionAnnotations(id, [{...now, count: 0, countedSpaces: [], amount: 3, uncapped: 3}])[1]])).to.deep.eq(['No tile counts right now']);
  });

  it('a THRESHOLD-COUNTED effect (Generous Funding): its own qualification sentence, and the BREAKDOWN of the rating behind the number — never a list, never «no card»', () => {
    const id = 'RDX_GREENS_GENEROUS_FUNDING';
    const effect = getResolution(id)?.scaled?.[0];
    if (effect === undefined) {
      throw new Error('Generous Funding declares no scaled effect');
    }
    const bare = resolutionAnnotations(id);
    expect(bare.map((b) => b.labelKey), 'no winner block — this card has no winner part').to.deep.eq(['When enacted', 'Chairman quest']);
    expect(texts([bare[0]])).to.deep.eq([
      'Gain 2 M€ per influence and 2 M€ per full 5 TR you have above 15.',
      'Each full 5 TR above 15 is one set: TR 20 is 1 set, TR 24 still 1, TR 25 is 2. The remainder pays nothing.',
    ]);
    expect(texts([bare[1]])).to.deep.eq(['Raise your TR 3 steps']);
    // The row is the breakdown of the VALUE: «TR 24 · threshold 15 · 1 complete set · 1 to the next set» — the server's numbers.
    const metric = {metric: 'terraformRating' as const, value: 24, over: 15, step: 5, sets: 1, toNext: 1};
    const now: InfluenceYield = {effect, context: 'estimate', influence: 3, amount: 8, count: 1, counted: [], countedMetric: metric};
    const live = resolutionAnnotations(id, [now]);
    expect(live.map((b) => b.labelKey)).to.deep.eq(['When enacted', 'For you', 'Chairman quest']);
    expect(live[1].rows[0].text).to.eq('Counted right now: ${0}');
    expect(live[1].rows[0].params?.[0]).to.eq('TR 24 · threshold 15 · 1 complete set(s) · 1 to the next set');
    // Zero sets is still a breakdown (TR 19: one point short) — never «no card counts right now».
    const short = resolutionAnnotations(id, [{...now, count: 0, amount: 6, countedMetric: {...metric, value: 19, sets: 0, toNext: 1}}]);
    expect(short[1].rows[0].params?.[0]).to.eq('TR 19 · threshold 15 · 0 complete set(s) · 1 to the next set');
    expect(texts(short)).to.not.include('No card counts right now');
    // Once recorded, the row says so and prints the RECORDED breakdown.
    const recorded = resolutionAnnotations(id, [{...now, context: 'applied'}]);
    expect(recorded[1].rows[0].text).to.eq('Counted at the enactment: ${0}');
    expect(recorded[1].rows[0].params?.[0]).to.eq('TR 24 · threshold 15 · 1 complete set(s) · 1 to the next set');
  });

  it('an unknown resolution reads nothing (never a blank chip)', () => {
    expect(resolutionAnnotations('RDX_NOT_A_CARD')).to.deep.eq([]);
  });

  it('the PARTY column is rules only — the viewer\'s vote is never a block in it (the footer\'s fact rows carry it; registry R-10)', () => {
    for (const party of [PartyName.GREENS, PartyName.REDS] as const) {
      const blocks = resolutionPartyAnnotations(party);
      expect(blocks.length, `${party}: the party's own mechanic blocks`).to.be.greaterThan(0);
      expect(blocks.map((b) => b.id), `${party}: no vote block, no «for you»`).to.not.include.members(['group:vote', 'group:you']);
      expect(blocks.map((b) => b.labelKey)).to.not.include('Your vote');
      const text = blocks.flatMap((b) => b.rows.map((r) => r.text)).join(' ');
      expect(text, 'no sentence about the leader or the winning state in the columns').to.not.match(/Delegates on the card|Leader|Winning/);
    }
    // The rules column is untouched either way.
    expect(resolutionAnnotations(GRID).map((b) => b.labelKey)).to.deep.eq(['When enacted', 'Chairman quest']);
  });
});
