import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {
  DeferralQuestion, chosenOrOption, drawnCardCount, optionDrawCount, optionDraws, reactionDeferral,
} from '../../src/common/models/tableQuestionDeferral';
import {
  cardsHeldByOtherDiscards, deferPlateOf, tableQuestionCanWait, tableQuestionNote, tableQuestionRowFocusable, tableQuestionRowMissing,
  tableQuestionRowOffered, tableQuestionRowState, tableQuestionValue,
} from '../../src/client/console/tableQuestionRow';
import {armDeferredDiscards, clearDeferredDiscards, deferredDiscardKey, freshCardsForDeferredDiscard} from '../../src/client/console/deferredDiscardFresh';
import {playPrimaryVerb} from '../../src/client/console/consolePlayCardComposer';

/**
 * A DISCARD FROM THE HAND BEHIND A DRAW — ANSWER NOW, OR AFTER THE DRAW (the owner's decision 2026-10-15, his photo of
 * «Конференция на Олимпе» × «Марсианский университет»). The rule (`common/models/tableQuestionDeferral.ts`), the ROW the
 * play composer draws from it (`client/console/tableQuestionRow.ts`) and the album's «НОВАЯ КАРТА» after the draw
 * (`client/console/deferredDiscardFresh.ts`) — pure, so every verdict is pinned here and the e2e asserts the journey.
 */

/** Olympus' question as the server builds it: «remove a science to draw» (a cards chip) · «add a science». */
const OLYMPUS_INPUT = {
  type: 'or',
  options: [
    {type: 'option', metadata: {effects: [{direction: 'gain', icon: 'cards', amount: 1}]}},
    {type: 'option', metadata: {effects: [{direction: 'gain', icon: 'science', amount: 1}]}},
  ],
};
/** Mars University's: a discard that buys a card · «do nothing». */
const UNIVERSITY_INPUT = {
  type: 'or',
  options: [
    {type: 'card', discardPrompt: {min: 1, max: 1, exchange: {icon: 'cards', amount: 1}}, cards: []},
    {type: 'option'},
  ],
};

const olympus: DeferralQuestion = {reaction: {card: CardName.OLYMPUS_CONFERENCE, fact: 'olympus-0'}, input: OLYMPUS_INPUT};
const university = (extra: Partial<NonNullable<DeferralQuestion['reaction']>> = {}): DeferralQuestion =>
  ({reaction: {card: CardName.MARS_UNIVERSITY, fact: 'mu-0', afterDraw: ['olympus-0'], ...extra}, input: UNIVERSITY_INPUT});

describe('tableQuestionDeferral — may a discard wait for the draw above it', () => {
  it('reads a draw off an option\'s own chips, or off a discard that buys cards — and its count', () => {
    expect(optionDraws(OLYMPUS_INPUT.options[0])).is.true;
    expect(optionDraws(OLYMPUS_INPUT.options[1])).is.false;
    expect(optionDraws(UNIVERSITY_INPUT.options[0]), 'the university\'s discard draws one back').is.true;
    expect(optionDraws(UNIVERSITY_INPUT.options[1])).is.false;
    expect(optionDrawCount(OLYMPUS_INPUT.options[0])).eq(1);
    expect(optionDrawCount(UNIVERSITY_INPUT.options[0])).eq(1);
    expect(chosenOrOption(OLYMPUS_INPUT, {type: 'or', index: 1})).eq(OLYMPUS_INPUT.options[1]);
    expect(chosenOrOption(OLYMPUS_INPUT, {type: 'card'})).is.undefined;
  });

  it('THE OWNER\'S CASE: the university WAITS for Olympus\' answer, then may wait for the draw — or is owed, when nothing draws', () => {
    const mu = university();
    const questions = [olympus, mu];
    expect(reactionDeferral(mu, questions, () => undefined)).deep.eq({state: 'locked', gates: [CardName.OLYMPUS_CONFERENCE]});
    const answers = new Map<DeferralQuestion, unknown>([[olympus, {type: 'or', index: 0}]]);
    expect(reactionDeferral(mu, questions, (q) => answers.get(q)), '«remove to draw» → may wait for that card')
      .deep.eq({state: 'deferrable', drawers: [{card: CardName.OLYMPUS_CONFERENCE, cards: 1}]});
    answers.set(olympus, {type: 'or', index: 1});
    expect(reactionDeferral(mu, questions, (q) => answers.get(q)), '«add a science» → nothing draws: an ordinary pre-select')
      .deep.eq({state: 'none'});
  });

  it('a draw nobody chooses (the play\'s own) makes it deferrable from the start — whatever the gate', () => {
    const mu = university({drawnBefore: [{card: CardName.RESEARCH, cards: 2}]});
    expect(reactionDeferral(mu, [olympus, mu], () => undefined)).deep.eq({state: 'deferrable', drawers: [{card: CardName.RESEARCH, cards: 2}]});
  });

  it('one entry per drawer; the count adds up while every one is stated, and is unknown otherwise', () => {
    const mu = university({drawnBefore: [{card: CardName.OLYMPUS_CONFERENCE}]});
    const answers = new Map<DeferralQuestion, unknown>([[olympus, {type: 'or', index: 0}]]);
    const verdict = reactionDeferral(mu, [olympus, mu], (q) => answers.get(q));
    expect(verdict).deep.eq({state: 'deferrable', drawers: [{card: CardName.OLYMPUS_CONFERENCE, cards: undefined}]});
    expect(drawnCardCount([{card: CardName.RESEARCH, cards: 2}, {card: CardName.OLYMPUS_CONFERENCE, cards: 1}])).eq(3);
    expect(drawnCardCount([{card: CardName.RESEARCH, cards: 2}, {card: CardName.OLYMPUS_CONFERENCE}])).is.undefined;
  });

  it('a question with no reaction, or no gate and no draw, is an ordinary pre-select', () => {
    expect(reactionDeferral({input: UNIVERSITY_INPUT}, [], () => undefined)).deep.eq({state: 'none'});
    const plain: DeferralQuestion = {reaction: {card: CardName.MARS_UNIVERSITY, fact: 'mu-0'}, input: UNIVERSITY_INPUT};
    expect(reactionDeferral(plain, [plain], () => undefined)).deep.eq({state: 'none'});
  });
});

describe('tableQuestionRow — the composer\'s row of a question that may wait', () => {
  const name = (c: CardName) => String(c);

  it('locked: no cursor stop, never «missing», «Ждёт ответа: …» and why', () => {
    const state = tableQuestionRowState({state: 'locked', gates: [CardName.OLYMPUS_CONFERENCE]}, false);
    expect(state.kind).eq('locked');
    expect(tableQuestionRowFocusable(state)).is.false;
    expect(tableQuestionRowMissing(state, false), 'the question above holds the commit, not this one').is.false;
    expect(tableQuestionValue(state, name)).deep.eq({key: 'Waits for the answer: ${0}', params: ['«Olympus Conference»']});
    expect(tableQuestionNote(state, name)?.lead.key).eq('That answer decides whether a new card arrives before this question');
  });

  it('deferred: valid as it is, offered to the cursor ONCE, «Спросят после добора» + who draws first and how many', () => {
    const state = tableQuestionRowState({state: 'deferrable', drawers: [{card: CardName.OLYMPUS_CONFERENCE, cards: 1}]}, false);
    expect(state.kind).eq('deferred');
    expect(tableQuestionRowMissing(state, false), 'an unanswered deferred row holds nothing up').is.false;
    expect(tableQuestionRowFocusable(state)).is.true;
    expect(tableQuestionRowOffered(state, false), 'the next question — the cursor goes there').is.true;
    expect(tableQuestionRowOffered(state, true), 'once left, the walk goes on to the commit').is.false;
    expect(tableQuestionValue(state, name)).deep.eq({key: 'Asked after the draw', params: []});
    expect(tableQuestionNote(state, name)).deep.eq({
      lead: {key: 'First the draw: ${0}', params: ['«Olympus Conference»']},
      drawn: 1,
      tail: {key: 'the new card can be discarded too', params: []},
    });
    const two = tableQuestionRowState({state: 'deferrable', drawers: [{card: CardName.RESEARCH, cards: 2}]}, false);
    expect(tableQuestionNote(two, name)?.tail?.key, 'plural').eq('the new cards can be discarded too');
    const unknown = tableQuestionRowState({state: 'deferrable', drawers: [{card: CardName.OLYMPUS_CONFERENCE}]}, false);
    expect(tableQuestionNote(unknown, name)?.drawn, 'no invented number').is.undefined;
  });

  it('early: the answer stands, the note says it was chosen before the draw; the album keeps the way back (R3)', () => {
    const state = tableQuestionRowState({state: 'deferrable', drawers: [{card: CardName.OLYMPUS_CONFERENCE, cards: 1}]}, true);
    expect(state.kind).eq('early');
    expect(tableQuestionRowOffered(state, false)).is.false;
    expect(tableQuestionValue(state, name), 'the value is the answer itself').is.undefined;
    expect(tableQuestionNote(state, name)?.lead).deep.eq({key: 'Chosen now, before the draw: ${0}', params: ['«Olympus Conference»']});
    expect(deferPlateOf(state)).deep.eq({label: 'Decide after the draw', drawers: [{card: CardName.OLYMPUS_CONFERENCE, cards: 1}], drawn: 1});
  });

  it('plain: owed like any pre-select; a row that COULD have waited keeps its third line and says why it is owed now', () => {
    const state = tableQuestionRowState({state: 'none'}, false);
    expect(tableQuestionRowMissing(state, false)).is.true;
    expect(tableQuestionRowMissing(state, true)).is.false;
    expect(tableQuestionNote(state, name, true)?.lead.key).eq('No card arrives before it');
    expect(tableQuestionNote(state, name, false)).is.undefined;
    expect(deferPlateOf(state), 'nothing to wait for — no R3 plate').is.undefined;
    expect(tableQuestionCanWait({afterDraw: ['olympus-0']})).is.true;
    expect(tableQuestionCanWait({drawnBefore: [{card: CardName.RESEARCH}]})).is.true;
    expect(tableQuestionCanWait({})).is.false;
  });

  it('two discards before the press never name one card — the album of one refuses what the others hold', () => {
    const held = cardsHeldByOtherDiscards([{id: 'step#0', cards: ['Algae']}, {id: 'pre#1', cards: ['Lichen']}], 'pre#1');
    expect([...held]).deep.eq(['Algae']);
  });

  it('the bar verb on a deferred row is «Выбрать сейчас» — never a bare «Выбрать» that reads as owed', () => {
    const primary = {kind: 'ready'} as const;
    expect(playPrimaryVerb({focused: 'picker', pickAnswered: false, pickDeferred: true, primary}).label).eq('Choose now');
    expect(playPrimaryVerb({focused: 'picker', pickAnswered: true, pickDeferred: true, primary}).label).eq('Change');
    expect(playPrimaryVerb({focused: 'picker', pickAnswered: false, primary}).label).eq('Select');
  });
});

describe('deferredDiscardFresh — the card the draw brought, in the album of a question left for after it', () => {
  afterEach(() => clearDeferredDiscards());

  it('marks the cards that were not in the hand the composer left — for the asker it handed on, in the same action', () => {
    const key = deferredDiscardKey(5, 12);
    armDeferredDiscards([CardName.MARS_UNIVERSITY], ['Algae', 'Lichen'], key);
    expect(freshCardsForDeferredDiscard(CardName.MARS_UNIVERSITY, ['Algae', 'Lichen', 'Greenhouses'], key)).deep.eq(['Greenhouses']);
    expect(freshCardsForDeferredDiscard(CardName.OLYMPUS_CONFERENCE, ['Algae', 'Greenhouses'], key), 'another asker').deep.eq([]);
    expect(freshCardsForDeferredDiscard(CardName.MARS_UNIVERSITY, ['Algae', 'Greenhouses'], deferredDiscardKey(5, 13)), 'the next action').deep.eq([]);
    expect(freshCardsForDeferredDiscard(undefined, ['Greenhouses'], key)).deep.eq([]);
  });
});
