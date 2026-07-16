import {expect} from 'chai';
import {
  buildInitialCardsResponse, consoleStartState, ensureStartWizard,
  initialCardsSignature, picksForStep, startLaunchState, stepComplete, wizardSteps,
} from '@/client/console/consoleStartState';
import {SelectInitialCardsModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {Phase} from '@/common/Phase';
import * as titles from '@/common/inputs/SelectInitialCards';

/**
 * CTS T5: the start-scene wizard logic. The step identification and the
 * aggregated `{type:'initialCards', responses}` submit must stay
 * BYTE-IDENTICAL to the desktop InitialDraftFlowOverlay (which itself
 * replicates the legacy SelectInitialCards.vue shape) — one response per
 * PRESENT option, in the SERVER's option order.
 */

function cardOption(title: string, names: ReadonlyArray<CardName>, min: number, max: number) {
  return {
    type: 'card' as const,
    title,
    min,
    max,
    cards: names.map((name) => ({name})),
  };
}

function input(withPrelude: boolean, withCeo = false): SelectInitialCardsModel {
  const options: Array<unknown> = [
    cardOption(titles.SELECT_CORPORATION_TITLE, [CardName.THARSIS_REPUBLIC, CardName.CREDICOR], 1, 1),
  ];
  if (withPrelude) {
    options.push(cardOption(titles.SELECT_PRELUDE_TITLE,
      [CardName.BUSINESS_EMPIRE, CardName.DONATION, CardName.GALILEAN_MINING, CardName.LOAN], 2, 2));
  }
  if (withCeo) {
    options.push(cardOption(titles.SELECT_CEO_TITLE, [CardName.ENDER], 1, 1));
  }
  options.push(cardOption(titles.SELECT_PROJECTS_TITLE,
    [CardName.BIRDS, CardName.ANTS, CardName.FISH], 0, 10));
  return {type: 'initialCards', title: 'Select initial cards', options} as unknown as SelectInitialCardsModel;
}

describe('consoleStartState (T5 wizard logic)', () => {
  it('wizardSteps: identified by the STABLE server title constants, in order', () => {
    const steps = wizardSteps(input(true, true));
    expect(steps.map((s) => s.id)).to.deep.eq(['corp', 'prelude', 'ceo', 'projects']);
    const noPrelude = wizardSteps(input(false));
    expect(noPrelude.map((s) => s.id)).to.deep.eq(['corp', 'projects']);
  });

  it('stepComplete honors the SERVER min/max per step', () => {
    const steps = wizardSteps(input(true));
    const picks = {corp: CardName.CREDICOR, preludes: [CardName.LOAN], ceo: undefined, projects: []};
    expect(stepComplete(steps[0], picks)).to.eq(true); // corp: exactly 1
    expect(stepComplete(steps[1], picks)).to.eq(false); // preludes: 1 of 2
    expect(stepComplete(steps[2], picks)).to.eq(true); // projects: 0 is legal (min 0)
    expect(picksForStep(picks, 'prelude')).to.deep.eq([CardName.LOAN]);
  });

  it('response: one {type:card} per PRESENT option, server order (byte parity)', () => {
    const picks = {
      corp: CardName.CREDICOR,
      preludes: [CardName.LOAN, CardName.DONATION],
      ceo: undefined,
      projects: [CardName.BIRDS],
    };
    expect(buildInitialCardsResponse(input(true), picks)).to.deep.eq({
      type: 'initialCards',
      responses: [
        {type: 'card', cards: [CardName.CREDICOR]},
        {type: 'card', cards: [CardName.LOAN, CardName.DONATION]},
        {type: 'card', cards: [CardName.BIRDS]},
      ],
    });
    // No prelude expansion → 2 responses; buying nothing is an EMPTY cards
    // array (never an omitted response) — the desktop overlay contract.
    expect(buildInitialCardsResponse(input(false), {...picks, preludes: [], projects: []})).to.deep.eq({
      type: 'initialCards',
      responses: [
        {type: 'card', cards: [CardName.CREDICOR]},
        {type: 'card', cards: []},
      ],
    });
  });

  it('module state resets ONLY when the deal identity changes', () => {
    const sig = initialCardsSignature(input(true));
    ensureStartWizard('p1', sig);
    consoleStartState.corp = CardName.CREDICOR;
    consoleStartState.stepIdx = 2;
    // Same owner + same deal → picks survive (defer / re-render safety).
    ensureStartWizard('p1', sig);
    expect(consoleStartState.corp).to.eq(CardName.CREDICOR);
    expect(consoleStartState.stepIdx).to.eq(2);
    // A different player (hot-seat) or a new deal → clean slate.
    ensureStartWizard('p2', sig);
    expect(consoleStartState.corp).to.eq(undefined);
    expect(consoleStartState.stepIdx).to.eq(0);
  });

  it('signature covers every dealt set (a re-deal is a new wizard)', () => {
    const a = initialCardsSignature(input(true));
    const b = initialCardsSignature(input(false));
    expect(a).to.not.eq(b);
    expect(a).to.contain(titles.SELECT_PRELUDE_TITLE);
  });
});

/**
 * The SUMMARY's launch readout: the screen doubles as the setup's waiting
 * room, so it must say honestly whether the game is still waiting on somebody
 * — and whether the viewer's confirm is the LAST input it needs.
 */
function seat(color: Color, waiting: boolean, isMarsBot = false) {
  return {color, name: color, isWaitingForInput: waiting, isActive: false, isMarsBot: isMarsBot ? true : undefined};
}

/** Gen-1 RESEARCH = the initial-cards setup (see playerLabels). */
function view(seats: ReadonlyArray<ReturnType<typeof seat>>): PlayerViewModel {
  return {
    thisPlayer: seats[0],
    players: seats,
    game: {phase: Phase.RESEARCH, generation: 1, passedPlayers: []},
  } as unknown as PlayerViewModel;
}

describe('consoleStartState (T5 summary launch readout)', () => {
  it('a bot never owes a pick → the confirm LAUNCHES from the first frame', () => {
    // The fork's console target (1 human + 1 bot): MarsBot is never given a
    // waitingFor, so the summary opens straight on the «Begin the game» CTA.
    const state = startLaunchState(view([seat('blue', true), seat('red', false, true)]), ['blue']);
    expect(state.launches).to.eq(true);
    expect(state.pending).to.be.empty;
    expect(state.others.map((m) => m.status.category)).to.deep.eq(['ready']);
    expect(state.others[0].isMarsBot).to.eq(true);
  });

  it('solo: nobody else at the table → launches', () => {
    expect(startLaunchState(view([seat('blue', true)]), ['blue']).launches).to.eq(true);
  });

  it('another player still picking → waiting; the viewer never counts', () => {
    const state = startLaunchState(view([seat('blue', true), seat('red', true)]), ['blue', 'red']);
    expect(state.launches).to.eq(false);
    expect(state.pending.map((m) => m.color)).to.deep.eq(['red']);
    // The viewer IS in waitingFor (they hold the prompt) but is not somebody
    // to wait FOR — gating on them would block the summary against itself.
    expect(state.others.map((m) => m.color)).to.deep.eq(['red']);
    expect(state.others[0].picking).to.eq(true);
  });

  it('an un-landed poll falls back to the model — never a premature CTA', () => {
    // `waitingOnPlayers` sits at its [] default until the first (timer-armed)
    // poll returns. A bare [] reads to actionLabelForPlayer as "the server is
    // waiting on nobody", which would flash the launch CTA while red is still
    // choosing. The viewer is provably owed (they hold the summary), so a list
    // without them cannot be current — fall back to the model snapshot.
    const stillPicking = view([seat('blue', true), seat('red', true)]);
    expect(startLaunchState(stillPicking, []).launches).to.eq(false);
    expect(startLaunchState(stillPicking, undefined).launches).to.eq(false);
    // …and the same guard must not invent a wait against a ready bot.
    const botGame = view([seat('blue', true), seat('red', false, true)]);
    expect(startLaunchState(botGame, []).launches).to.eq(true);
  });

  it('the LIVE poll wins over the stale view: their pick landed → launches', () => {
    // While the viewer holds the initialCards prompt the playerView is NOT
    // refreshed (it would drop their partial picks), so red's model snapshot
    // still says "waiting". Only the poll knows red has since submitted — this
    // is exactly why waitingOnPlayers is threaded down to the scene.
    const stale = view([seat('blue', true), seat('red', true)]);
    expect(startLaunchState(stale, ['blue', 'red']).launches).to.eq(false);
    expect(startLaunchState(stale, ['blue']).launches).to.eq(true);
  });

  it('two humans on their summaries are BOTH pending (why the confirm is never gated)', () => {
    // Each sees the other as pending. If `launches === false` hard-blocked the
    // submit, neither could ever send — the wait would never end. The verb
    // changes, the press does not: this is the invariant that keeps it honest.
    const live: ReadonlyArray<Color> = ['blue', 'red'];
    const blue = startLaunchState(view([seat('blue', true), seat('red', true)]), live);
    const red = startLaunchState(view([seat('red', true), seat('blue', true)]), live);
    expect(blue.launches).to.eq(false);
    expect(red.launches).to.eq(false);
  });
});
