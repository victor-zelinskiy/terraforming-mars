import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {CardType} from '@/common/cards/CardType';
import {CardResource} from '@/common/CardResource';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {CardDrawRevealModel, CardDrawRevealStep, DrawSearchModel} from '@/common/models/CardDrawRevealModel';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {
  discardedSteps, discardVerdictsOf, drawDiscardVerdict, drawSearchClauses, drawSearchRules, drawSearchTally, drawSearchTermLabel,
  drawSearchTerms, searchOwningStep,
} from '@/client/console/deckDraw/drawSearchReading';
import {deckDrawTimings, planDeckDraw} from '@/client/console/deckDraw/deckDrawModel';
import {SEARCH_NEXT_STEP_KEY, searchRows} from '@/client/console/consolePlacementNextStep';

/**
 * TR32 — THE SEARCH'S RULE, READ. One formatter of the server's descriptor for
 * every surface (chip · «Далее» · the reveal's summary · the discard viewer),
 * deriving nothing: a clause is a field, a count a length, a verdict the
 * step's own `failedTags`.
 */
const BIO: DrawSearchModel = {count: 3, withoutTags: [Tag.PLANT, Tag.MICROBE, Tag.ANIMAL]};

function card(name: string): CardModel {
  return {name: name as CardName} as CardModel;
}

function step(name: string, matched: boolean, failedTags?: Array<Tag>): CardDrawRevealStep {
  return failedTags === undefined ? {card: card(name), matched} : {card: card(name), matched, failedTags};
}

/** The prompt's journey: Algae ✗ → Research ✓ → Ants ✗ → Fish ✗ → Mining Area ✓ → Comet ✓. */
const JOURNEY: Array<CardDrawRevealStep> = [
  step('Algae', false, [Tag.PLANT]),
  step('Research', true),
  step('Ants', false, [Tag.MICROBE]),
  step('Fish', false, [Tag.ANIMAL]),
  step('Mining Area', true),
  step('Comet', true),
];

describe('drawSearchReading', () => {
  describe('the rule\'s clauses — read off the descriptor, in reading order', () => {
    it('a negative filter: ONE clause, the excluded tags in the rule\'s order', () => {
      expect(drawSearchTerms(BIO)).deep.eq([{kind: 'without', tags: [Tag.PLANT, Tag.MICROBE, Tag.ANIMAL]}]);
    });

    it('a positive filter (TR05 / Acquired Space Agency): «with the tag [space]»', () => {
      expect(drawSearchTerms({count: 1, tag: Tag.SPACE})).deep.eq([{kind: 'with', tag: Tag.SPACE}]);
    });

    it('a type and a tag (Deep Space Operations): the TYPE leads — «events with the tag [space]»', () => {
      expect(drawSearchTerms({count: 2, tag: Tag.SPACE, type: CardType.EVENT})).deep.eq([
        {kind: 'type', type: CardType.EVENT},
        {kind: 'with', tag: Tag.SPACE},
      ]);
    });

    it('a resource filter: «collecting [floater]»', () => {
      expect(drawSearchTerms({count: 1, resource: CardResource.FLOATER})).deep.eq([{kind: 'resource', resource: CardResource.FLOATER}]);
    });

    it('no descriptor, no clauses (a plain draw)', () => {
      expect(drawSearchTerms(undefined)).deep.eq([]);
    });

    it('each clause opens with ONE key', () => {
      expect(drawSearchTermLabel({kind: 'without', tags: [Tag.PLANT]})).eq('without the tags');
      expect(drawSearchTermLabel({kind: 'with', tag: Tag.SPACE})).eq('with the tag');
      expect(drawSearchTermLabel({kind: 'type', type: CardType.EVENT})).eq('event cards');
      expect(drawSearchTermLabel({kind: 'resource', resource: CardResource.FLOATER})).eq('collecting');
    });
  });

  describe('the outcome in numbers — lengths of the server\'s own lists', () => {
    it('the journey: turned over 6 · received 3 · thrown away 3', () => {
      const cards = [card('Research'), card('Mining Area'), card('Comet')];
      expect(drawSearchTally({cards, sequence: JOURNEY, search: BIO})).deep.eq({revealed: 6, taken: 3, discarded: 3, exhausted: false});
    });

    it('three clean cards on top: no sequence (no tray) — turned over = received', () => {
      const cards = [card('Research'), card('Mining Area'), card('Comet')];
      expect(drawSearchTally({cards, search: BIO})).deep.eq({revealed: 3, taken: 3, discarded: 0, exhausted: false});
    });

    it('the deck ran out: `exhausted` rides along', () => {
      const cards = [card('Research')];
      expect(drawSearchTally({cards, sequence: JOURNEY.slice(0, 4), search: BIO, exhausted: true}))
        .deep.eq({revealed: 4, taken: 1, discarded: 3, exhausted: true});
    });

    it('a plain draw has no tally', () => {
      expect(drawSearchTally({cards: [card('Research')]})).is.undefined;
    });
  });

  describe('the verdict of a thrown-away card', () => {
    it('a negative filter: the tag the card carries (the step\'s own `failedTags`)', () => {
      expect(drawDiscardVerdict(JOURNEY[0], BIO)).deep.eq({kind: 'tags', tags: [Tag.PLANT]});
      expect(drawDiscardVerdict(JOURNEY[3], BIO)).deep.eq({kind: 'tags', tags: [Tag.ANIMAL]});
    });

    it('a positive filter: the RULE it did not meet', () => {
      expect(drawDiscardVerdict(step('Ants', false), {count: 1, tag: Tag.SPACE})).deep.eq({kind: 'rule', terms: [{kind: 'with', tag: Tag.SPACE}]});
    });

    it('a kept card has no verdict; an opaque search explains nothing', () => {
      expect(drawDiscardVerdict(JOURNEY[1], BIO)).is.undefined;
      expect(drawDiscardVerdict(step('Ants', false), undefined)).is.undefined;
    });

    it('the pile is the discarded steps in the SERVER\'s order', () => {
      expect(discardedSteps({sequence: JOURNEY}).map((s) => s.card.name)).deep.eq(['Algae', 'Ants', 'Fish']);
      expect(discardedSteps({})).deep.eq([]);
    });
  });

  it('the scene\'s PLAN does not depend on the reason (the family\'s flow is unchanged — A/B on one sequence)', () => {
    const T = deckDrawTimings();
    const bare = JOURNEY.map((s) => ({matched: s.matched}));
    expect(planDeckDraw(JOURNEY, T, false)).deep.eq(planDeckDraw(bare, T, false));
    expect(planDeckDraw(JOURNEY, T, true)).deep.eq(planDeckDraw(bare, T, true));
  });

  describe('a floater-icon search names itself (Celestic, P44)', () => {
    const FLOATERS: DrawSearchModel = {count: 2, floaterIcon: true};
    it('one clause «with a floater icon»; a discard reads the rule it did not meet', () => {
      expect(drawSearchTerms(FLOATERS)).deep.eq([{kind: 'floaterIcon'}]);
      expect(drawSearchTermLabel({kind: 'floaterIcon'})).eq('with a floater icon');
      expect(drawDiscardVerdict(step(CardName.ANTS, false), FLOATERS)).deep.eq({kind: 'rule', terms: [{kind: 'floaterIcon'}]});
      expect(drawDiscardVerdict(step(CardName.DIRIGIBLES, true), FLOATERS)).is.undefined;
    });
  });

  describe('a party-requirement search names itself (P51 High Circles)', () => {
    const PARTY: DrawSearchModel = {count: 1, partyRequirement: true};
    it('one clause «with a party requirement»; a discard reads the rule it did not meet', () => {
      expect(drawSearchTerms(PARTY)).deep.eq([{kind: 'partyRequirement'}]);
      expect(drawSearchTermLabel({kind: 'partyRequirement'})).eq('with a party requirement');
      expect(drawDiscardVerdict(step(CardName.ANTS, false), PARTY)).deep.eq({kind: 'rule', terms: [{kind: 'partyRequirement'}]});
      expect(drawDiscardVerdict(step(CardName.CULTURAL_METROPOLIS, true), PARTY)).is.undefined;
    });
  });

  describe('a requirement search names itself (P54 Nobel Prize)', () => {
    const REQUIREMENT: DrawSearchModel = {count: 2, requirement: true};
    it('one clause «with a requirement»; a discard reads the rule it did not meet — positively, never «without»', () => {
      expect(drawSearchTerms(REQUIREMENT)).deep.eq([{kind: 'requirement'}]);
      expect(drawSearchTermLabel({kind: 'requirement'})).eq('with a requirement');
      expect(drawDiscardVerdict(step(CardName.POWER_PLANT, false), REQUIREMENT)).deep.eq({kind: 'rule', terms: [{kind: 'requirement'}]});
      expect(drawDiscardVerdict(step(CardName.BIRDS, true), REQUIREMENT)).is.undefined;
    });
  });

  describe('a «no tags» search names itself (PC03 Sagitta Frontier Services)', () => {
    const NO_TAGS: DrawSearchModel = {count: 1, noTags: true};
    it('one clause «with no tags»; a discard names the tags that barred it — the event\'s own, a lone wild one', () => {
      expect(drawSearchTerms(NO_TAGS)).deep.eq([{kind: 'noTags'}]);
      expect(drawSearchTermLabel({kind: 'noTags'})).eq('with no tags');
      expect(drawDiscardVerdict(step(CardName.MINE, false, [Tag.BUILDING]), NO_TAGS)).deep.eq({kind: 'tags', tags: [Tag.BUILDING]});
      expect(drawDiscardVerdict(step(CardName.INDENTURED_WORKERS, false, [Tag.EVENT]), NO_TAGS)).deep.eq({kind: 'tags', tags: [Tag.EVENT]});
      expect(drawDiscardVerdict(step(CardName.QUANTUM_RESEARCH, false, [Tag.WILD]), NO_TAGS)).deep.eq({kind: 'tags', tags: [Tag.WILD]});
      expect(drawDiscardVerdict(step(CardName.MICRO_MILLS, true), NO_TAGS)).is.undefined;
    });
  });

  describe('the «Далее» row of a filtered draw', () => {
    const translate = (key: string, params: ReadonlyArray<string>) => `${key}|${params.join(',')}`;

    it('one row per filtered draw chip, carrying the descriptor; none for a plain draw', () => {
      const chip: ActionEffect = {direction: 'gain', icon: 'cards', amount: 3, note: 'draw', search: BIO};
      const plain: ActionEffect = {direction: 'gain', icon: 'cards', amount: 1, note: 'draw'};
      const rows = searchRows([chip, plain, {direction: 'cost', icon: 'megacredits', amount: 5}], translate);
      expect(rows).deep.eq([{text: `${SEARCH_NEXT_STEP_KEY}|3`, constraint: '', full: `${SEARCH_NEXT_STEP_KEY}|3`, search: BIO}]);
      expect(searchRows([plain], translate)).deep.eq([]);
    });
  });

  /*
   * P56 Planetary Alliance — TWO named searches of one play: one batch, two segments, each with its rule. The batch's
   * own `search` is the FIRST one's; a reader that judges the whole batch by it reads «с меткой Юпитер» on a card the
   * Venus search threw away.
   */
  describe('two rules of one batch (P56)', () => {
    const JOVIAN: DrawSearchModel = {count: 1, tag: Tag.JOVIAN};
    const VENUS: DrawSearchModel = {count: 1, tag: Tag.VENUS};
    type Batch = Pick<CardDrawRevealModel, 'cards' | 'search' | 'segments' | 'sequence' | 'exhausted'>;
    const source = {type: 'card' as const, cardName: CardName.PLANETARY_ALLIANCE};
    // Power Plant ✗ · Io Mining ✓ | Ganymede Colony ✗ (a Jovian card, thrown away by the VENUS search) · Aerial Mappers ✓
    const jovianTape = [step(CardName.POWER_PLANT, false), step(CardName.IO_MINING_INDUSTRIES, true)];
    const venusTape = [step(CardName.GANYMEDE_COLONY, false), step(CardName.AERIAL_MAPPERS, true)];
    const batch: Batch = {
      cards: [card(CardName.IO_MINING_INDUSTRIES), card(CardName.AERIAL_MAPPERS)],
      search: JOVIAN,
      segments: [
        {source, count: 1, sequence: jovianTape, search: JOVIAN},
        {source, count: 1, sequence: venusTape, search: VENUS},
      ],
      sequence: [...jovianTape, ...venusTape],
    };

    it('two rules in order — every segment\'s, never the batch\'s first alone', () => {
      expect(drawSearchRules(batch)).deep.eq([JOVIAN, VENUS]);
      expect(drawSearchRules({search: JOVIAN, segments: [{source, count: 2, search: JOVIAN}]}), 'one rule reads once').deep.eq([JOVIAN]);
      expect(drawSearchRules({search: BIO, segments: undefined} as unknown as Batch), 'a one-search batch keeps its rule').deep.eq([BIO]);
      // «с меткой [J] · [V]» — the word once, the second medallion continues it.
      expect(drawSearchClauses([JOVIAN, VENUS])).deep.eq([
        {term: {kind: 'with', tag: Tag.JOVIAN}, labelled: true},
        {term: {kind: 'with', tag: Tag.VENUS}, labelled: false},
      ]);
      // A rule of another shape keeps its own word.
      expect(drawSearchClauses([JOVIAN, BIO]).map((c) => c.labelled)).deep.eq([true, true]);
    });

    it('the verdict names the OWNING search — the Jovian card the Venus search threw away reads the Venus rule', () => {
      expect(searchOwningStep(batch, 0)).deep.eq(JOVIAN);
      expect(searchOwningStep(batch, 1), 'the boundary — the last step of the first tape').deep.eq(JOVIAN);
      expect(searchOwningStep(batch, 2)).deep.eq(VENUS);
      expect(discardVerdictsOf(batch)).deep.eq([
        {kind: 'rule', terms: [{kind: 'with', tag: Tag.JOVIAN}]},
        {kind: 'rule', terms: [{kind: 'with', tag: Tag.VENUS}]},
      ]);
      // A search that threw nothing away carries no tape of its own: its `count` matched steps stand on the batch tape.
      const clean: Batch = {...batch, segments: [{source, count: 1, search: JOVIAN}, {source, count: 1, sequence: venusTape, search: VENUS}],
        sequence: [step(CardName.IO_MINING_INDUSTRIES, true), ...venusTape]};
      expect(discardVerdictsOf(clean)).deep.eq([{kind: 'rule', terms: [{kind: 'with', tag: Tag.VENUS}]}]);
      // Segments that do not account for the tape fall back to the batch's rule.
      expect(searchOwningStep({...batch, sequence: [...batch.sequence ?? [], step(CardName.ASTEROID, false)]}, 4)).deep.eq(JOVIAN);
    });

    it('an empty exhausted segment counts and names: its discards are tallied and judged by ITS rule', () => {
      const noJovian = [step(CardName.POWER_PLANT, false), step(CardName.AERIAL_MAPPERS, false)];
      const venus = [step(CardName.AERIAL_MAPPERS, true)];
      const empty: Batch = {
        cards: [card(CardName.AERIAL_MAPPERS)],
        search: JOVIAN,
        segments: [
          {source, count: 0, sequence: noJovian, search: JOVIAN, exhausted: true},
          {source, count: 1, search: VENUS},
        ],
        sequence: [...noJovian, ...venus],
        exhausted: true,
      };
      expect(drawSearchTally(empty)).deep.eq({revealed: 3, taken: 1, discarded: 2, exhausted: true});
      expect(drawSearchRules(empty)).deep.eq([JOVIAN, VENUS]);
      expect(discardVerdictsOf(empty).map((v) => v?.kind === 'rule' ? v.terms : undefined)).deep.eq([
        [{kind: 'with', tag: Tag.JOVIAN}], [{kind: 'with', tag: Tag.JOVIAN}],
      ]);
      expect(searchOwningStep(empty, 2)).deep.eq(VENUS);
    });
  });
});
