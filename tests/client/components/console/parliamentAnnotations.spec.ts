import {expect} from 'chai';
import {ColonyName} from '@/common/colonies/ColonyName';
import {PartyName} from '@/common/turmoil/PartyName';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {REDUX_PARTIES} from '@/common/parliament/ParliamentTypes';
import {partyAnnotations, resolutionAnnotations, resolutionPartyAnnotations} from '@/client/console/parliament/parliamentAnnotations';
import {CardName} from '@/common/cards/CardName';
import {allResolutions, getResolution} from '@/client/parliament/ClientParliamentManifest';
import {EffectForecast} from '@/common/models/EffectForecastModel';

/**
 * THE INSPECTOR'S READING BLOCKS for a parliament subject (Turmoil Redux).
 * The project card's language: the GRAPHIC is on the card, the blocks beside
 * it explain it in words and never draw it again. A resolution reads as one
 * scene: its OWN rules on the right (its PRINTED texts part by part, labelled
 * by when they apply, then the quest's condition — the owner's direction
 * 2026-10-23: the project card's dose, no qualification sentence under an
 * effect, no «for you» block), its PARTY's mechanics on the left (the plaque
 * draws the formula, these blocks say the sentences), and the footer states
 * the standing — so no block restates the table, the general rules, a
 * technical note or the viewer's state. A party opened on its own keeps its
 * fuller reading (the mechanics, «for you» with the live state, one reference
 * line).
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

  it('a party opened on its own: the mechanics and «for you» with the action\'s live state — each once, and no reference beside «for you» (PL-042)', () => {
    const blocks = partyAnnotations(PartyName.INDUSTRIALISTS, model(), 'blue', true);
    expect(blocks.map((b) => b.labelKey)).to.deep.eq(['Party action', 'For you']);
    expect(blocks[0].rows.map((r) => r.text), 'the action block is the printed text alone').to.have.length(1);
    const you = blocks[1].rows.map((r) => r.text);
    expect(you[you.length - 1], 'the live state closes «for you»').to.eq('Action available this generation');
    const all = texts(blocks);
    expect(new Set(all).size).to.eq(all.length);
  });

  it('with the «ДОСТУП» object standing above the rules (v8 § 7) «for you» keeps ONLY the action\'s live state — the access rows are the object\'s', () => {
    const blocks = partyAnnotations(PartyName.INDUSTRIALISTS, model(), 'blue', true, true);
    expect(blocks.map((b) => b.labelKey)).to.deep.eq(['Party action', 'For you']);
    expect(blocks[1].rows.map((r) => r.text)).to.deep.eq(['Action available this generation']);
    const greens = partyAnnotations(PartyName.GREENS, model(), 'blue', undefined, true);
    expect(greens.map((b) => b.labelKey), 'nothing left to say: no empty «for you», and no reference beside the object').to.not.include('For you');
    expect(greens.map((b) => b.labelKey)).to.not.include('Access');
  });

  it('the ONE reference line stands only for a reader with no «for you» (a spectator, no model) — never beside the state rows', () => {
    const spectator = partyAnnotations(PartyName.INDUSTRIALISTS, model(), 'yellow' as never, true);
    expect(spectator.map((b) => b.labelKey)).to.deep.eq(['Party action', 'Access']);
    expect(spectator[1].rows.length, 'the reference is one line').to.eq(1);
    const outside = partyAnnotations(PartyName.INDUSTRIALISTS, undefined, undefined);
    expect(outside.map((b) => b.labelKey)).to.deep.eq(['Party action', 'Access']);
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
    expect(blocks.map((b) => b.labelKey)).to.deep.eq(['Party effect', 'For you']);
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

  /*
   * THE DOSE (the owner's direction 2026-10-23): a resolution's dossier is its PRINTED TEXTS and nothing else — the way
   * a project card's rules panel reads. No sentence on which cards count, what a stack scores or when the hand is read
   * (those once stood under the effect and read as a wall of text); no «for you» block (the viewer's number, the counted
   * cards, the winner's tile and the levy are the vote panel's). The one row that is not a printed text is the declared
   * count of a resolution ACTION (Manufacturing Run) — and only there.
   */
  it('every SHIPPED resolution reads its PRINTED texts alone — no qualification sentence, no «for you» block; the action\'s declared count is the one addition', () => {
    for (const resolution of allResolutions().filter((r) => r.copies > 0)) {
      const blocks = resolutionAnnotations(resolution.id);
      expect(blocks.map((b) => b.id), `${resolution.id}: no «for you»`).to.not.include('group:you');
      const printed = [resolution.text.effect, resolution.text.world, resolution.text.winner, resolution.text.passive, resolution.text.action, resolution.text.quest];
      for (const block of blocks) {
        for (const row of block.rows) {
          if (printed.includes(row.text)) {
            continue;
          }
          expect(block.id, `${resolution.id}: «${row.text}» is not a printed text of the card`).to.eq('group:action');
          expect(resolution.actionUses, `${resolution.id}: only a declared count may stand under the action`).to.not.be.undefined;
        }
        expect(block.rows.length, `${resolution.id}: ${block.id} is one printed text`).to.be.at.most(block.id === 'group:action' ? 2 : 1);
      }
    }
  });

  it('the counted and the levied laws read their printed sentence and nothing else', () => {
    const expected: Record<string, [string, string]> = {
      RDX_MARS_ARCHITECTURE_AWARD: ['Raise your M€ production 1 step per building card with a non-negative VP icon you have in play, plus 1 per influence. Max 5.', 'Play 2 building tags'],
      RDX_INDUSTRIALISTS_CENTRAL_POWER_GRID: ['Raise your M€ production 1 step per power tag you have, plus 1 per influence. Max 5.', 'Play 2 power tags'],
      RDX_UNITY_COLONIZATION_FUNDING: ['Raise your M€ production 2 steps per space city (a city off Mars) you have, plus 1 per influence. Max 6.', 'Place 1 space city'],
      RDX_MARSFIRST_MIGRATION_FUNDING: ['Gain 2 M€ per city you have on Mars, plus 2 per influence. Each city in a stack counts separately.', 'Place 2 city tiles on Mars'],
      RDX_GREENS_GENEROUS_FUNDING: ['Gain 2 M€ per influence and 2 M€ per full 5 TR you have above 15.', 'Raise your TR 3 steps'],
      RDX_INDUSTRIALISTS_INDUSTRIALIST_BUDGET: ['Lose 10 M€. Gain 1 M€ per step of steel, titanium and energy production you have and 1 per influence. Raise your M€ production 4 steps.', 'Raise your steel production 1 step'],
      RDX_UNITY_JOVIAN_TAX_RIGHTS: ['Gain 1 titanium for every point of your influence. Raise your M€ production 1 step per colony you have. Max 5.', 'Play 2 Jovian tags'],
    };
    for (const [id, [effect, quest]] of Object.entries(expected)) {
      const blocks = resolutionAnnotations(id);
      expect(blocks.map((b) => b.labelKey), id).to.deep.eq(['When enacted', 'Chairman quest']);
      expect(texts([blocks[0]]), id).to.deep.eq([effect]);
      expect(texts([blocks[1]]), id).to.deep.eq([quest]);
    }
  });

  it('where a nuance of THIS implementation matters it is INSIDE the printed text, one short sentence — never a block of its own', () => {
    const text = (id: string, field: 'effect' | 'passive' | 'world') => getResolution(id)?.text[field] ?? '';
    expect(text('RDX_MARS_SKYSCRAPERS', 'effect')).to.contain('Each city in the stack counts separately.');
    expect(text('RDX_REDS_PLANT_BAN', 'effect')).to.contain('No card protects against this.');
    expect(text('RDX_UNITY_CLOUD_DEVELOPMENT', 'effect')).to.contain('The floaters may go on different cards.');
    expect(text('RDX_SCIENTISTS_MEDICAL_DATABASE', 'effect')).to.contain('The resources may go on different cards.');
    expect(text('RDX_REDS_DIVERTED_RESEARCH', 'passive')).to.contain('Even if the parameter is at its maximum.');
    expect(text('RDX_REDS_GAS_EXPORT', 'world')).to.contain('Nobody gains TR for this.');
    // …and the edge cases that once filled the dossier are gone from the texts too.
    for (const resolution of allResolutions().filter((r) => r.copies > 0)) {
      for (const field of ['effect', 'winner', 'passive', 'action', 'world'] as const) {
        const value = resolution.text[field];
        if (value === undefined) {
          continue;
        }
        expect(value, `${resolution.id}.${field}`).to.not.match(/unless|If you already|clockwise|that can hold|for free\. Raise/);
        expect(value.length, `${resolution.id}.${field} reads in one breath`).to.be.at.most(200);
      }
    }
  });

  /*
   * THE COLONY TABLE'S BLOCK (Unity Budget, RX29): the world block, headed by what it moves, printing the
   * law's sentence and — against a live table — every tile's marker, a tile at the end of its track named.
   */
  it('a law that advances the colony tracks reads its own block: the declaration alone without a table, every tile against a live one', () => {
    const id = 'RDX_UNITY_UNITY_BUDGET';
    const reference = resolutionAnnotations(id, {table: undefined});
    const block = reference.find((b) => b.id === 'group:world');
    expect(block?.labelKey).eq('What it does to the colony table');
    expect(block?.rows.map((r) => r.text)).deep.eq(['Every colony track advances 2 steps.']);
    const colonies = [
      {name: ColonyName.LUNA, trackPosition: 3, isActive: true, colonies: [], visitor: undefined},
      {name: ColonyName.IO, trackPosition: 6, isActive: true, colonies: [], visitor: undefined},
      {name: ColonyName.MIRANDA, trackPosition: 1, isActive: false, colonies: [], visitor: undefined},
    ];
    const live = resolutionAnnotations(id, {table: undefined, colonies}).find((b) => b.id === 'group:world');
    expect(live?.rows.map((r) => r.text)).deep.eq(['Every colony track advances 2 steps.', '${0}: ${1}', '${0}: ${1}']);
    expect(live?.rows.slice(1).map((r) => r.params)).deep.eq([['Luna', '3 → 5'], ['Io', 'track at its maximum']]);
    // The record outranks the table: the server's own list.
    const applied = resolutionAnnotations(id, {table: undefined, colonies, enacted: true, outcomes: [
      {step: 'colonyTracks', part: 'world', kind: 'colonyTrack', amount: 2, tracks: [{colony: ColonyName.LUNA, before: 2, after: 4}]},
    ]}).find((b) => b.id === 'group:world');
    expect(applied?.rows.slice(1).map((r) => r.params)).deep.eq([['Luna', '2 → 4']]);
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

/** PL-052: the world block names what the TABLE answers to the move — the viewer's slot forecast, one row per fact. */
describe('resolutionAnnotations — the world move\'s answer (PL-052)', () => {
  const gasExport = allResolutions().find((r) => (r.worldMoves ?? []).some((m) => m.parameter === 'venus'));
  const table = {oxygenLevel: 5, temperature: -20, oceans: 2, venusScaleLevel: 6};
  const forecast: EffectForecast = {
    facts: [{
      id: 'red-Aphrodite-0',
      source: {kind: 'corporation', name: CardName.APHRODITE, owner: 'red', channel: 'global-parameter'},
      certainty: 'exact', recipient: {kind: 'player', color: 'red'}, timing: 'immediate',
      effects: [{direction: 'gain', icon: 'megacredits', amount: 4}],
      reason: 'Any player raises Venus',
    }],
    discounts: {base: 0, final: 0, items: [], other: 0},
    paymentValues: [],
    coverage: 'complete',
  };

  it('prints «Will trigger: Aphrodite (Rival) +4 M€» under the planet\'s rows, by name', () => {
    expect(gasExport, 'the catalog has a Venus-moving law').is.not.undefined;
    const block = resolutionAnnotations(gasExport!.id, {table, forecast, nameOf: () => 'Rival'}).find((b) => b.id === 'group:world');
    expect(block).is.not.undefined;
    const answer = block!.rows.find((row) => row.params?.[0] === 'Will trigger');
    expect(answer, JSON.stringify(block!.rows)).is.not.undefined;
    expect(answer!.params?.[1]).to.contain('Aphrodite');
    expect(answer!.params?.[1]).to.contain('(Rival)');
    expect(answer!.params?.[1]).to.contain('+4 M€');
    expect(block!.rows.indexOf(answer!), 'after the moves\' rows').to.be.greaterThan(0);
  });

  it('without a forecast the block is the planet\'s rows alone', () => {
    const block = resolutionAnnotations(gasExport!.id, {table}).find((b) => b.id === 'group:world');
    expect(block!.rows.some((row) => row.params?.[0] === 'Will trigger')).is.false;
  });
});
