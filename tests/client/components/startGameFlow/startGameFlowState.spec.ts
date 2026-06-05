import {expect} from 'chai';
import {Phase} from '@/common/Phase';
import {CardName} from '@/common/cards/CardName';
import {fakePlayerViewModel} from '../testHelpers';
import {
  resetStartGameFlow,
  markStartFlowActivated,
  markStartFlowCompleted,
  startFlowPreludePrompt,
  startFlowPreludeDrawPrompt,
  startFlowPreludeCopyPrompt,
  startFlowAnyPreludePrompt,
  startFlowCorpPrompt,
  startFlowCorpSelectPrompt,
  corporationCardNames,
  corpStatusFor,
  corpActionOptionIndex,
  corpActionOptionIndexFor,
  startGameFlowEligible,
  startGameFlowActive,
  startGameFlowAllDone,
  startFlowHasFocusedSubAction,
  preludeEntries,
  recordDrawChoice,
  drawChoicesFor,
} from '@/client/components/startGameFlow/startGameFlowState';

const PRELUDE_A = CardName.ECOLOGY_EXPERTS;
const PRELUDE_B = CardName.SUPPLIER;
const PRELUDE_C = CardName.UNMI_CONTRACTOR;

// Detection is via the explicit server marker (startGamePrompt), never the
// title — so the helpers set that marker and can use any (even garbage) title.
function preludePrompt(cards: ReadonlyArray<CardName>, mode: 'hand' | 'draw' | 'copy' = 'hand'): any {
  return {
    type: 'card',
    title: 'Select prelude card to play',
    buttonLabel: 'Play',
    startGamePrompt: {kind: 'preludeSelection', preludeMode: mode},
    cards: cards.map((name) => ({name})),
    min: 1,
    max: 1,
  };
}

function corpPrompt(): any {
  return {
    type: 'or',
    title: '',
    buttonLabel: '',
    startGamePrompt: {kind: 'corporationInitialAction'},
    options: [
      {type: 'option', title: 'Take first action of Tharsis Republic corporation', buttonLabel: ''},
      {type: 'option', title: 'Pass for this generation', buttonLabel: 'Pass', warnings: ['pass']},
    ],
  };
}

describe('startGameFlowState predicates', () => {
  beforeEach(() => resetStartGameFlow());

  describe('prelude prompts (hand / draw) via the server marker', () => {
    it('matches the starting-prelude (hand) prompt', () => {
      const view = fakePlayerViewModel({
        preludeCardsInHand: [{name: PRELUDE_A}, {name: PRELUDE_B}] as any,
        waitingFor: preludePrompt([PRELUDE_A, PRELUDE_B], 'hand'),
      });
      expect(startFlowPreludePrompt(view)).to.not.eq(undefined);
      expect(startFlowPreludeDrawPrompt(view)).to.eq(undefined);
      expect(startFlowAnyPreludePrompt(view)).to.not.eq(undefined);
    });

    it('routes a drew-N-choose-ONE (draw) prompt to the DRAW predicate, not the hand one', () => {
      const view = fakePlayerViewModel({
        // Drawn preludes are NOT in hand (New Partner / Valley Trust).
        waitingFor: preludePrompt([PRELUDE_C, PRELUDE_A], 'draw'),
      });
      expect(startFlowPreludePrompt(view)).to.eq(undefined);
      expect(startFlowPreludeDrawPrompt(view)).to.not.eq(undefined);
      expect(startFlowAnyPreludePrompt(view)).to.not.eq(undefined);
    });

    it('does NOT match a card prompt without the start-flow marker', () => {
      const view = fakePlayerViewModel({
        preludeCardsInHand: [{name: PRELUDE_A}] as any,
        waitingFor: {type: 'card', title: 'Select a card to discard', buttonLabel: 'Discard', cards: [{name: PRELUDE_A}]} as any,
      });
      expect(startFlowAnyPreludePrompt(view)).to.eq(undefined);
    });

    it('routes a Double Down (copy) prompt to the COPY predicate, and keeps the source in the grid', () => {
      const view = fakePlayerViewModel({
        // The candidate is an ALREADY-PLAYED prelude (in the tableau).
        waitingFor: preludePrompt([PRELUDE_A], 'copy'),
        thisPlayer: {tableau: [{name: PRELUDE_A}]} as any,
      });
      expect(startFlowPreludeCopyPrompt(view)).to.not.eq(undefined);
      expect(startFlowPreludeDrawPrompt(view)).to.eq(undefined);
      expect(startFlowAnyPreludePrompt(view)).to.not.eq(undefined);
      // The played source must STAY in the grid (NOT excluded like a draw candidate).
      expect(preludeEntries(view).some((e) => e.name === PRELUDE_A && e.status === 'played')).to.eq(true);
    });
  });

  describe('startFlowCorpPrompt + corpActionOptionIndex', () => {
    it('matches the corp first-action OrOptions and finds the action option (never Pass)', () => {
      const view = fakePlayerViewModel({waitingFor: corpPrompt()});
      const prompt = startFlowCorpPrompt(view);
      expect(prompt).to.not.eq(undefined);
      const idx = corpActionOptionIndex(prompt);
      expect(idx).to.eq(0);
      // The Pass option (carries the 'pass' warning) at index 1 is never picked.
      expect(idx).to.not.eq(1);
    });

    // Detection is marker-based, so it works regardless of the title text — even
    // after i18n mutates the title in place (the original "old modal leaks" bug).
    it('matches by marker regardless of the (translated) title text', () => {
      const wf: any = corpPrompt();
      wf.title = 'Select one option';
      wf.options[0].title = {message: 'Выполнить начальное действие корпорации «${0}»', data: [{type: 3, value: 'Valley Trust'}]};
      const view = fakePlayerViewModel({waitingFor: wf, pendingInitialActions: [CardName.VALLEY_TRUST]});
      expect(startFlowCorpPrompt(view)).to.not.eq(undefined);
      expect(corpActionOptionIndex(startFlowCorpPrompt(view))).to.eq(0);
    });

    it('does NOT match the regular action menu (no marker)', () => {
      const view = fakePlayerViewModel({
        waitingFor: {type: 'or', title: 'Take your first action', buttonLabel: '', options: []} as any,
      });
      expect(startFlowCorpPrompt(view)).to.eq(undefined);
    });
  });

  describe('Merger — corp selection + multi-corp', () => {
    const A = CardName.THARSIS_REPUBLIC;
    const B = CardName.HELION;

    function corpSelectPrompt(cards: ReadonlyArray<any>): any {
      return {
        type: 'card', title: 'Choose corporation card to play', buttonLabel: 'Play',
        startGamePrompt: {kind: 'corporationSelection'}, cards,
      };
    }
    function multiCorpPrompt(corps: ReadonlyArray<CardName>): any {
      return {
        type: 'or', title: '', buttonLabel: '', startGamePrompt: {kind: 'corporationInitialAction'},
        options: [
          ...corps.map((name) => ({type: 'option', buttonLabel: '', title: {message: 'Take first action of ${0} corporation', data: [{type: 3, value: name}]}})),
          {type: 'option', title: 'Pass for this generation', buttonLabel: 'Pass', warnings: ['pass']},
        ],
      };
    }

    it('detects the corp-selection prompt (Merger) via the marker', () => {
      const view = fakePlayerViewModel({waitingFor: corpSelectPrompt([{name: A}, {name: B}])});
      expect(startFlowCorpSelectPrompt(view)).to.not.eq(undefined);
      // It's not a prelude prompt.
      expect(startFlowAnyPreludePrompt(view)).to.eq(undefined);
    });

    it('corporationCardNames returns base + merged in tableau order (preludes excluded)', () => {
      const view = fakePlayerViewModel({
        thisPlayer: {tableau: [{name: A}, {name: PRELUDE_A}, {name: B}]} as any,
      });
      expect([...corporationCardNames(view)]).to.deep.eq([A, B]);
    });

    it('corpStatusFor + corpActionOptionIndexFor handle TWO corps owing actions', () => {
      const view = fakePlayerViewModel({
        pendingInitialActions: [A, B],
        waitingFor: multiCorpPrompt([A, B]),
        thisPlayer: {tableau: [{name: A}, {name: B}]} as any,
      });
      expect(corpStatusFor(view, A)).to.eq('ready');
      expect(corpStatusFor(view, B)).to.eq('ready');
      const prompt = startFlowCorpPrompt(view);
      expect(corpActionOptionIndexFor(prompt, A)).to.eq(0);
      expect(corpActionOptionIndexFor(prompt, B)).to.eq(1);
      // Pass (last option) is never matched.
      expect(corpActionOptionIndexFor(prompt, A)).to.not.eq(2);
    });

    it('corpStatusFor reports pending when owed but no live prompt', () => {
      const view = fakePlayerViewModel({pendingInitialActions: [A], thisPlayer: {tableau: [{name: A}]} as any});
      expect(corpStatusFor(view, A)).to.eq('pending');
    });
  });

  describe('draw-choice recording', () => {
    it('records a resolved draw-choice and excludes others from the grid', () => {
      recordDrawChoice('p-blue-id', [PRELUDE_A, PRELUDE_B, PRELUDE_C], PRELUDE_A);
      const recs = drawChoicesFor('p-blue-id');
      expect(recs.length).to.eq(1);
      expect(recs[0].chosen).to.eq(PRELUDE_A);
      expect([...recs[0].candidates]).to.deep.eq([PRELUDE_A, PRELUDE_B, PRELUDE_C]);
      // The chosen drawn prelude (now in tableau) must NOT show in the starting grid.
      const view = fakePlayerViewModel({
        thisPlayer: {tableau: [{name: PRELUDE_A}]} as any,
      });
      expect(preludeEntries(view).some((e) => e.name === PRELUDE_A)).to.eq(false);
    });

    it('completing a player clears their draw-choices (no cross-game leak)', () => {
      recordDrawChoice('p-blue-id', [PRELUDE_A, PRELUDE_B], PRELUDE_A);
      markStartFlowCompleted('p-blue-id');
      expect(drawChoicesFor('p-blue-id').length).to.eq(0);
    });
  });

  describe('startGameFlowEligible / startGameFlowActive', () => {
    it('is eligible in gen 1 when a prelude is owed', () => {
      const view = fakePlayerViewModel({preludeCardsInHand: [{name: PRELUDE_A}] as any});
      expect(startGameFlowEligible(view)).to.eq(true);
    });

    it('is eligible in gen 1 when the corp owes an initial action', () => {
      const view = fakePlayerViewModel({pendingInitialActions: [CardName.THARSIS_REPUBLIC]});
      expect(startGameFlowEligible(view)).to.eq(true);
    });

    it('is NOT eligible with 0 preludes and no corp action', () => {
      const view = fakePlayerViewModel({});
      expect(startGameFlowEligible(view)).to.eq(false);
    });

    it('is NOT eligible in generation 2', () => {
      const view = fakePlayerViewModel({
        game: {generation: 2} as any,
        preludeCardsInHand: [{name: PRELUDE_A}] as any,
      });
      expect(startGameFlowEligible(view)).to.eq(false);
    });

    it('is NOT active during the initial-draft awaiting window', () => {
      const view = fakePlayerViewModel({
        game: {generation: 1, phase: Phase.RESEARCH} as any,
        preludeCardsInHand: [{name: PRELUDE_A}] as any,
        waitingFor: undefined,
      });
      // gen1 + RESEARCH + no waitingFor → isInitialDraftAwaiting → not active.
      expect(startGameFlowActive(view)).to.eq(false);
    });

    it('is NOT active once THIS player completed (but another player completing does not affect us)', () => {
      const view = fakePlayerViewModel({preludeCardsInHand: [{name: PRELUDE_A}] as any});
      // A DIFFERENT player completing must not disable our flow (hot-seat leak).
      markStartFlowCompleted('some-other-player');
      expect(startGameFlowActive(view)).to.eq(true);
      markStartFlowCompleted(view.id);
      expect(startGameFlowActive(view)).to.eq(false);
    });

    it('stays active via the sticky per-player activated latch even when work is momentarily empty', () => {
      const view = fakePlayerViewModel({game: {generation: 1, phase: Phase.ACTION} as any});
      // Another player's latch must NOT activate our (ineligible) flow.
      markStartFlowActivated('some-other-player');
      expect(startGameFlowActive(view)).to.eq(false);
      markStartFlowActivated(view.id);
      expect(startGameFlowActive(view)).to.eq(true);
    });
  });

  describe('startGameFlowAllDone', () => {
    it('is false while a prelude is still awaiting', () => {
      const view = fakePlayerViewModel({preludeCardsInHand: [{name: PRELUDE_A}] as any});
      expect(startGameFlowAllDone(view)).to.eq(false);
    });

    it('is false while the corp action is owed', () => {
      const view = fakePlayerViewModel({pendingInitialActions: [CardName.THARSIS_REPUBLIC]});
      expect(startGameFlowAllDone(view)).to.eq(false);
    });

    it('is true when no preludes and no corp action remain', () => {
      const view = fakePlayerViewModel({});
      expect(startGameFlowAllDone(view)).to.eq(true);
    });
  });

  describe('startFlowHasFocusedSubAction', () => {
    it('is true for a top-level SelectSpace sub-action', () => {
      const view = fakePlayerViewModel({
        waitingFor: {type: 'space', title: 'Select space for city', buttonLabel: ''} as any,
      });
      expect(startFlowHasFocusedSubAction(view)).to.eq(true);
    });

    it('is false for the prelude prompt, the corp prompt, the action menu, and no prompt', () => {
      const prelude = fakePlayerViewModel({
        preludeCardsInHand: [{name: PRELUDE_A}] as any,
        waitingFor: preludePrompt([PRELUDE_A]),
      });
      const corp = fakePlayerViewModel({waitingFor: corpPrompt()});
      const menu = fakePlayerViewModel({
        waitingFor: {type: 'or', title: 'Take your next action', buttonLabel: '', options: []} as any,
      });
      const none = fakePlayerViewModel({waitingFor: undefined});
      expect(startFlowHasFocusedSubAction(prelude)).to.eq(false);
      expect(startFlowHasFocusedSubAction(corp)).to.eq(false);
      expect(startFlowHasFocusedSubAction(menu)).to.eq(false);
      expect(startFlowHasFocusedSubAction(none)).to.eq(false);
    });
  });

  describe('preludeEntries', () => {
    it('derives played (tableau preludes) + awaiting (hand), and excludes the corporation', () => {
      const view = fakePlayerViewModel({
        preludeCardsInHand: [{name: PRELUDE_B}] as any,
        waitingFor: preludePrompt([PRELUDE_B]),
        thisPlayer: {
          tableau: [{name: CardName.THARSIS_REPUBLIC}, {name: PRELUDE_A}] as any,
        } as any,
      });
      const entries = preludeEntries(view);
      // One played prelude (PRELUDE_A from tableau; the corporation is excluded),
      // one playable awaiting prelude (PRELUDE_B, candidate of the live prompt).
      expect(entries.length).to.eq(2);
      const played = entries.find((e) => e.name === PRELUDE_A);
      const awaiting = entries.find((e) => e.name === PRELUDE_B);
      expect(played?.status).to.eq('played');
      expect(awaiting?.status).to.eq('playable');
      expect(entries.some((e) => e.name === CardName.THARSIS_REPUBLIC)).to.eq(false);
    });

    it('keeps a played prelude in its ORIGINAL slot (no jump to the front)', () => {
      // First sight: both preludes awaiting in hand → slots [A, B].
      const before = fakePlayerViewModel({
        preludeCardsInHand: [{name: PRELUDE_A}, {name: PRELUDE_B}] as any,
        waitingFor: preludePrompt([PRELUDE_A, PRELUDE_B]),
      });
      const e0 = preludeEntries(before);
      expect(e0.map((e) => e.name)).to.deep.eq([PRELUDE_A, PRELUDE_B]);

      // Now A is PLAYED (moved hand → tableau), B still in hand. The order MUST
      // stay [A, B] — A keeps slot 0, only its status flips to 'played'.
      const after = fakePlayerViewModel({
        preludeCardsInHand: [{name: PRELUDE_B}] as any,
        waitingFor: preludePrompt([PRELUDE_B]),
        thisPlayer: {tableau: [{name: PRELUDE_A}]} as any,
      });
      const e1 = preludeEntries(after);
      expect(e1.map((e) => e.name)).to.deep.eq([PRELUDE_A, PRELUDE_B]);
      expect(e1[0].status).to.eq('played');
      expect(e1[1].status).to.eq('playable');
    });

    it('BLOCKS a would-fizzle prelude (Double Down) while a non-fizzling one remains', () => {
      const DD = CardName.DOUBLE_DOWN;
      const view = fakePlayerViewModel({
        preludeCardsInHand: [{name: DD}, {name: PRELUDE_A}] as any,
        waitingFor: {
          type: 'card', title: 'Select prelude card to play', buttonLabel: 'Play',
          startGamePrompt: {kind: 'preludeSelection', preludeMode: 'hand'},
          cards: [{name: DD, warnings: ['preludeFizzle']}, {name: PRELUDE_A}],
        } as any,
      });
      const entries = preludeEntries(view);
      expect(entries.find((e) => e.name === DD)?.blocked).to.eq(true);
      expect(entries.find((e) => e.name === PRELUDE_A)?.blocked).to.eq(false);
    });

    it('does NOT block when EVERY remaining prelude would fizzle (no trap)', () => {
      const DD = CardName.DOUBLE_DOWN;
      const view = fakePlayerViewModel({
        preludeCardsInHand: [{name: DD}] as any,
        waitingFor: {
          type: 'card', title: 'Select prelude card to play', buttonLabel: 'Play',
          startGamePrompt: {kind: 'preludeSelection', preludeMode: 'hand'},
          cards: [{name: DD, warnings: ['preludeFizzle']}],
        } as any,
      });
      expect(preludeEntries(view).find((e) => e.name === DD)?.blocked).to.eq(false);
    });
  });
});
