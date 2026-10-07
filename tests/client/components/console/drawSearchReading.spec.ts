import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {CardType} from '@/common/cards/CardType';
import {CardResource} from '@/common/CardResource';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {CardDrawRevealStep, DrawSearchModel} from '@/common/models/CardDrawRevealModel';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {
  discardedSteps, drawDiscardVerdict, drawSearchTally, drawSearchTermLabel, drawSearchTerms,
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
});
