import {expect} from 'chai';
import {
  buildInitialCardsResponse, clearDockDrift, committedStartJourneyItems, consoleStartState, deploymentCrumb, driftDockPile,
  ensureStartWizard, holdStartScene, initialCardsSignature, picksForStep, releaseStartScene,
  startFlowBusy, startLaunchState, startParticipants, startSceneHeld, stepComplete, wizardCrumb,
  wizardSteps, startJourneyItems, deploymentJourneyItems, startDockPiles,
  startAwaitingOthers, startDeferredSummary, startDeploymentBegun, markStartDeploymentBegun,
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


  // ── the GAME START WORKSPACE view models ────────────────────────────────
  describe('the journey rail + selection dock models', () => {
    const steps = [
      {id: 'corp', input: {type: 'card', min: 1, max: 1, cards: []}},
      {id: 'prelude', input: {type: 'card', min: 2, max: 2, cards: []}},
      {id: 'projects', input: {type: 'card', min: 0, max: 10, cards: []}},
    ] as unknown as Parameters<typeof startJourneyItems>[0];

    it('preparation TABS: prerequisites gate the future, the summary unlocks last', () => {
      const none = {corp: undefined, preludes: [], ceo: undefined, projects: []};
      let items = startJourneyItems(steps, none, 0, new Set());
      expect(items.map((i) => i.state)).to.deep.eq(['current', 'locked', 'locked', 'locked']);
      const done = {corp: 'X' as never, preludes: ['A', 'B'] as never, ceo: undefined, projects: []};
      items = startJourneyItems(steps, done, 1, new Set([0, 1]));
      expect(items[0].state).to.eq('completed');
      expect(items[1].state).to.eq('current');
      expect(items[2].state).to.eq('available');
      expect(items[3].id).to.eq('summary');
      expect(items[3].state).to.eq('locked'); // zero projects is valid, but its screen is unseen

      items = startJourneyItems(steps, done, 2, new Set([0, 1, 2]));
      expect(items[2].state).to.eq('current');
      expect(items[3].state).to.eq('available');
    });

    it('deployment PROGRESS: a linear readout, never tabs', () => {
      const items = deploymentJourneyItems({
        corpPending: false, payPending: true, boughtCards: true, preludesLeft: 2, hasPreludes: true,
      });
      expect(items.map((i) => i.id)).to.deep.eq(['corp', 'pay', 'preludes', 'ready']);
      expect(items[0].state).to.eq('completed');
      expect(items[1].state).to.eq('current');
      expect(items[2].state).to.eq('locked');
      expect(items[3].state).to.eq('locked');
    });

    it('committed selection preserves the exact dealt category map', () => {
      const items = committedStartJourneyItems(['corp', 'prelude', 'ceo', 'projects']);
      expect(items.map((item) => item.id)).to.deep.eq(['corp', 'prelude', 'ceo', 'projects', 'summary']);
      expect(items.every((item) => item.state === 'completed')).to.eq(true);
    });

    it('the SELECTION DOCK pre-mounts EVERY pile; cards lie only in the collected ones', () => {
      const picks = {corp: 'X' as never, preludes: ['A', 'B'] as never, ceo: undefined, projects: ['P'] as never};
      // A pile is a physical flight destination — it must exist from the
      // very first frame (an element that mounts after the flight is the
      // teleport bug this model change removed).
      const atStart = startDockPiles(steps, picks, 0);
      expect(atStart.map((pl) => pl.id)).to.deep.eq(['corp', 'prelude', 'projects']);
      expect(atStart.map((pl) => pl.count)).to.deep.eq([0, 0, 0]);
      expect(atStart.map((pl) => pl.collected)).to.deep.eq([false, false, false]);
      const atProjects = startDockPiles(steps, picks, 2);
      expect(atProjects.map((pl) => pl.count)).to.deep.eq([1, 2, 0]);
      expect(atProjects.map((pl) => pl.collected)).to.deep.eq([true, true, false]);
      const atSummary = startDockPiles(steps, picks, 3);
      expect(atSummary.map((pl) => pl.count)).to.deep.eq([1, 2, 1]);
    });

    it('the SUMMARY keeps only the informational trace — the backs physically left', () => {
      const picks = {corp: 'X' as never, preludes: ['A', 'B'] as never, ceo: undefined, projects: ['P'] as never};
      const atSummary = startDockPiles(steps, picks, 3);
      // Counts stay (the «КОРПОРАЦИЯ · 1» trace) — but NO physical backs may
      // duplicate the cards lying open in the summary tiles.
      expect(atSummary.map((pl) => pl.count)).to.deep.eq([1, 2, 1]);
      expect(atSummary.map((pl) => pl.backs)).to.deep.eq([0, 0, 0]);
    });

    it('dockDrift: the backs follow the FLYING cards, never the state flip', () => {
      const picks = {corp: 'X' as never, preludes: [], ceo: undefined, projects: []};
      // The collect pre-drifts −1: the flip to collected shows an EMPTY pile…
      const mid = startDockPiles(steps, picks, 1, {corp: -1});
      expect(mid[0].backs).to.eq(0);
      // …and the touchdown raises the drift — the back lands WITH the card.
      const landed = startDockPiles(steps, picks, 1, {corp: 0});
      expect(landed[0].backs).to.eq(1);
      driftDockPile('corp', 2);
      expect(consoleStartState.dockDrift['corp']).to.eq(2);
      clearDockDrift('corp');
      expect(consoleStartState.dockDrift['corp']).to.eq(undefined);
    });

    it('a fresh deal resets the VISITED set (first-visit stagger plays once per session)', () => {
      consoleStartState.visited.add(1);
      ensureStartWizard('p-other', 'sig-other');
      expect(consoleStartState.visited.size).to.eq(0);
    });

    it('a fresh deal resets the flow AND the lifetime hold (a rematch never inherits a stale claim)', () => {
      holdStartScene();
      consoleStartState.flow = 'deploying';
      ensureStartWizard('p-rematch', 'sig-rematch');
      expect(startSceneHeld()).to.eq(false);
      expect(consoleStartState.flow).to.eq('idle');
    });

    it('startFlowBusy: transitions lock input; idle and the live deployment do not', () => {
      consoleStartState.flow = 'idle';
      expect(startFlowBusy()).to.eq(false);
      consoleStartState.flow = 'deploying';
      expect(startFlowBusy()).to.eq(false);
      for (const flow of ['docking', 'returning', 'revealing-summary', 'stowing-summary', 'committing', 'materializing', 'completing', 'releasing'] as const) {
        consoleStartState.flow = flow;
        expect(startFlowBusy(), flow).to.eq(true);
      }
      consoleStartState.flow = 'idle';
    });

    it('the lifetime hold arms and releases explicitly', () => {
      releaseStartScene();
      expect(startSceneHeld()).to.eq(false);
      holdStartScene();
      expect(startSceneHeld()).to.eq(true);
      releaseStartScene();
      expect(startSceneHeld()).to.eq(false);
    });
  });

  describe('startParticipants (the preparation crew strip)', () => {
    it('every seat through the shared status brain, the viewer first', () => {
      const blue = 'blue' as Color;
      const red = 'red' as Color;
      const view = {
        thisPlayer: {color: blue},
        id: 'p1',
        game: {phase: Phase.RESEARCH, generation: 1, passedPlayers: []},
        players: [
          {color: red, name: 'Rival', isActive: false, isWaitingForInput: false},
          {color: blue, name: 'Me', isActive: false, isWaitingForInput: true},
        ],
      } as unknown as PlayerViewModel;
      const crew = startParticipants(view, [blue]);
      expect(crew.length).to.eq(2);
      expect(crew[0].self).to.eq(true);
      expect(crew[0].color).to.eq(blue);
      expect(crew[1].self).to.eq(false);
      // The live poll says only BLUE is still owed — RED reads ready.
      expect(crew[0].status.category).to.eq('active');
      expect(crew[1].status.category).to.not.eq('active');
    });
  });

  describe('the workspace breadcrumb (СТАРТ ПАРТИИ › <ГРУППА> › <ЭТАП>)', () => {
    it('wizard: subject = the step GROUP, stage = Selection / Purchase', () => {
      expect(wizardCrumb('corp')).to.deep.eq({subject: 'Corporation', stage: 'Selection'});
      expect(wizardCrumb('prelude')).to.deep.eq({subject: 'Preludes', stage: 'Selection'});
      expect(wizardCrumb('ceo')).to.deep.eq({subject: 'CEO', stage: 'Selection'});
      // The projects step IS a purchase — its stage says so.
      expect(wizardCrumb('projects')).to.deep.eq({subject: 'Projects', stage: 'Purchase'});
      // The summary is a subject of its own, no mutable stage.
      expect(wizardCrumb(undefined)).to.deep.eq({subject: 'Summary', stage: ''});
    });

    it('deployment: the beat drives the tail — corp play / payment / preludes', () => {
      const base = {embedActive: false, corpPending: false, payPending: false, corpPick: false};
      expect(deploymentCrumb({...base, corpPending: true}))
        .to.deep.eq({subject: 'Corporation', stage: 'Playing'});
      // Merger's corporation pick is still the CORPORATION group.
      expect(deploymentCrumb({...base, corpPick: true}))
        .to.deep.eq({subject: 'Corporation', stage: 'Playing'});
      expect(deploymentCrumb({...base, payPending: true}))
        .to.deep.eq({subject: 'Projects', stage: 'Purchase'});
      expect(deploymentCrumb(base)).to.deep.eq({subject: 'Preludes', stage: 'Playing'});
    });

    it('an embedded reveal advances ONLY the tail: the source group keeps the subject', () => {
      const base = {embedActive: true, corpPending: false, payPending: false, corpPick: false};
      // No published phase → the honest generic «ДОБОР КАРТ».
      expect(deploymentCrumb({...base, embedSubject: 'Preludes'}))
        .to.deep.eq({subject: 'Preludes', stage: 'Card draw'});
      // The embedded surface hands its stage name UP — the crumb says it.
      expect(deploymentCrumb({...base, embedSubject: 'Corporation', embedPhase: 'Card draw'}))
        .to.deep.eq({subject: 'Corporation', stage: 'Card draw'});
      // The embed outranks a simultaneously-live pay beat (it is the deeper step).
      expect(deploymentCrumb({...base, payPending: true, embedSubject: 'Preludes'}).stage)
        .to.eq('Card draw');
    });
  });
  /**
   * THE MULTIPLAYER HAND-OVER. A submitted setup is NOT a started game: the
   * server holds the table until the last player confirms, so between the
   * commit and the real start sequence the viewer has NO prompt. Deriving
   * «the deployment began» from the missing wizard input turned that gap
   * into an EMPTY deployment (no queue, no hand dock, no way back once
   * minimized) — the latch below is the honest signal.
   */
  describe('the deployment LATCH + the waiting state', () => {
    const view = (waitingFor: unknown): PlayerViewModel => ({
      id: 'p1', thisPlayer: {color: 'red' as Color}, players: [], waitingFor,
    } as unknown as PlayerViewModel);

    beforeEach(() => {
      ensureStartWizard('owner', 'sig-await'); // a fresh deal clears the latch
      releaseStartScene();
    });
    afterEach(() => {
      ensureStartWizard('owner', 'sig-reset');
      releaseStartScene();
    });

    it('a fresh deal starts un-latched, and the latch survives the deployment prompt gaps', () => {
      expect(startDeploymentBegun()).to.be.false;
      markStartDeploymentBegun();
      expect(startDeploymentBegun()).to.be.true;
      // A prompt gap (no waitingFor at all) must NOT undo it.
      expect(startAwaitingOthers(view(undefined)), 'a latched deployment is never «awaiting»').to.be.false;
    });

    it('AWAITING = committed (the hold is armed), no wizard input, and the deployment has not begun', () => {
      // Before the commit there is no hold — the player is still picking.
      expect(startAwaitingOthers(view(undefined))).to.be.false;
      holdStartScene();
      expect(startAwaitingOthers(view(undefined)), 'sent, and the table is still confirming').to.be.true;
      // …and never while the viewer still holds their own wizard input.
      const wizard = {type: 'initialCards', options: []};
      expect(startAwaitingOthers(view(wizard)), 'the viewer still owes their own picks').to.be.false;
    });

    it('the minimized start names ITSELF (the shared task summary has no task to describe)', () => {
      const waiting = startDeferredSummary(true);
      const live = startDeferredSummary(false);
      expect(waiting.kickerKey).to.not.eq(live.kickerKey);
      expect(waiting.askKey).to.eq('Waiting for the rest of the table');
      expect(live.askKey).to.eq('Continue the start of the game');
      // Both offer the same way back — A returns to the start workspace.
      expect(waiting.returnKey).to.eq(live.returnKey);
    });
  });
});
