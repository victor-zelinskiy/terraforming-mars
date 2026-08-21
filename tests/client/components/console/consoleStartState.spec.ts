import {expect} from 'chai';
import {
  buildInitialCardsResponse, clearDockDrift, committedStartJourneyItems, consoleStartState, deploymentCrumb, driftDockPile,
  ensureStartWizard, holdStartScene, initialCardsSignature, picksForStep, releaseStartScene,
  startFlowBusy, startLaunchState, startParticipants, startSceneHeld, stepComplete, wizardCrumb,
  wizardSteps, startJourneyItems, deploymentJourneyItems, startDockPiles,
  startAwaitingOthers, startCorporationPlayed, startDeferredSummary, startDeploymentBegun,
  markStartDeploymentBegun, startCardAvailability, stepShowsAvailability,
} from '@/client/console/consoleStartState';
import {SelectInitialCardsModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {Phase} from '@/common/Phase';
import * as titles from '@/common/inputs/SelectInitialCards';
import {CardModel} from '@/common/models/CardModel';
import {UnplayableReason} from '@/common/cards/UnplayableReason';

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

    it('EVERY middle deployment stage is conditional — absent when its work is absent', () => {
      // No bought projects → no payment stage; no first action → no stage.
      const bare = deploymentJourneyItems({
        corpPending: false, payPending: false, boughtCards: false, preludesLeft: 0, hasPreludes: false,
      });
      expect(bare.map((i) => i.id)).to.deep.eq(['corp', 'ready']);
      expect(bare[1].state, 'nothing pending → READY is current').to.eq('current');
    });

    it('the FIRST ACTION is a conditional stage between the preludes and READY', () => {
      // Owed + preludes still playing → the stage exists, locked behind them.
      const during = deploymentJourneyItems({
        corpPending: false, payPending: false, boughtCards: false, preludesLeft: 2, hasPreludes: true,
        hasFirstAction: true, firstActionPending: true,
      });
      expect(during.map((i) => i.id)).to.deep.eq(['corp', 'preludes', 'firstAction', 'ready']);
      expect(during[2].state).to.eq('locked');
      expect(during[3].state).to.eq('locked');

      // Preludes done → the stage is CURRENT (waiting or live), READY locked:
      // the flow cannot complete around a mandatory action.
      const standing = deploymentJourneyItems({
        corpPending: false, payPending: false, boughtCards: false, preludesLeft: 0, hasPreludes: true,
        hasFirstAction: true, firstActionPending: true,
      });
      expect(standing[2].state).to.eq('current');
      expect(standing[3].state).to.eq('locked');

      // Resolved → completed, READY current — and the chapter STAYS visible.
      const done = deploymentJourneyItems({
        corpPending: false, payPending: false, boughtCards: false, preludesLeft: 0, hasPreludes: true,
        hasFirstAction: true, firstActionPending: false,
      });
      expect(done.map((i) => i.id)).to.deep.eq(['corp', 'preludes', 'firstAction', 'ready']);
      expect(done[2].state).to.eq('completed');
      expect(done[3].state).to.eq('current');
    });

    /*
     * THE BONUS CHAPTER (Head Start's «immediately take 2 actions») cannot be
     * declared in advance the way a corporation's first action can — which
     * prelude the player draws is not known until it is played — so it JOINS
     * the rail when the grant happens and stays, completed, afterwards. It
     * also LOCKS the first action and READY behind it: the flow cannot report
     * itself finished while the player is out on the board spending bonuses.
     */
    it('BONUS ACTIONS are a conditional chapter that locks everything after it', () => {
      const during = deploymentJourneyItems({
        corpPending: false, payPending: false, boughtCards: false, preludesLeft: 1, hasPreludes: true,
        hasBonusActions: true, bonusActionsPending: true,
        hasFirstAction: true, firstActionPending: true,
      });
      expect(during.map((i) => i.id)).to.deep.eq(['corp', 'preludes', 'bonusActions', 'firstAction', 'ready']);
      expect(during[2].state, 'the bonuses are what the player is doing').to.eq('current');
      expect(during[3].state, 'the first action waits behind them').to.eq('locked');
      expect(during[4].state).to.eq('locked');

      const spent = deploymentJourneyItems({
        corpPending: false, payPending: false, boughtCards: false, preludesLeft: 0, hasPreludes: true,
        hasBonusActions: true, bonusActionsPending: false,
      });
      expect(spent.map((i) => i.id)).to.deep.eq(['corp', 'preludes', 'bonusActions', 'ready']);
      expect(spent[2].state, 'the chapter STAYS, completed').to.eq('completed');
      expect(spent[3].state, 'nothing else owed → READY').to.eq('current');
    });

    it('no bonus grant → no chapter at all (every middle stage is conditional)', () => {
      const items = deploymentJourneyItems({
        corpPending: false, payPending: false, boughtCards: false, preludesLeft: 0, hasPreludes: true,
      });
      expect(items.map((i) => i.id)).to.not.include('bonusActions');
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

    it('the FIRST-ACTION stage: the subject returns to the corporation, one-word tail', () => {
      const base = {embedActive: false, corpPending: false, payPending: false, corpPick: false};
      expect(deploymentCrumb({...base, firstAction: true}))
        .to.deep.eq({subject: 'Corporation', stage: 'First action'});
      // An embedded follow-up of the action still outranks it (deeper step).
      expect(deploymentCrumb({...base, firstAction: true, embedActive: true, embedSubject: 'Valley Trust'}))
        .to.deep.eq({subject: 'Valley Trust', stage: 'Card draw'});
    });

    it('the BONUS-ACTION stage: the subject is the card that granted them', () => {
      const base = {embedActive: false, corpPending: false, payPending: false, corpPick: false};
      expect(deploymentCrumb({...base, bonusAction: true, bonusSource: 'Head Start'}))
        .to.deep.eq({subject: 'Head Start', stage: 'Action'});
      // No source known yet → the honest generic group, never a blank subject.
      expect(deploymentCrumb({...base, bonusAction: true}))
        .to.deep.eq({subject: 'Preludes', stage: 'Action'});
      // The mandatory first action still outranks it: it is the deeper, live
      // prompt when both are somehow true.
      expect(deploymentCrumb({...base, bonusAction: true, firstAction: true}))
        .to.deep.eq({subject: 'Corporation', stage: 'First action'});
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
      const waiting = startDeferredSummary('awaiting-table');
      const live = startDeferredSummary('in-progress');
      const firstAction = startDeferredSummary('awaiting-first-action');
      expect(waiting.kickerKey).to.not.eq(live.kickerKey);
      expect(waiting.askKey).to.eq('Waiting for the rest of the table');
      expect(live.askKey).to.eq('Continue the start of the game');
      // The first-action wait names the ONE thing left honestly.
      expect(firstAction.kickerKey).to.eq('Start of the game · first action');
      expect(firstAction.askKey).to.eq('The first corporation action awaits your turn');
      // All offer the same way back — A returns to the start workspace.
      expect(waiting.returnKey).to.eq(live.returnKey);
      expect(firstAction.returnKey).to.eq(live.returnKey);
    });
  });

  /**
   * THE PERSONAL READING OF GEN-1 RESEARCH. The phase is a TABLE state: the
   * research barrier holds it until the LAST seat has played and paid, so a
   * multiplayer player who is done sits in gen-1 RESEARCH with no prompt —
   * owning a real hand whose paid cards are flying into the dock. The hand
   * dock's presence gate reads THIS, never the bare phase triple (which hid
   * the dock mid-delivery and left the flights with no landing rect; solo vs
   * MarsBot never showed it, the bot pre-seeds the barrier).
   */
  describe('startCorporationPlayed (the viewer\'s own setup is on the table)', () => {
    const view = (picked: ReadonlyArray<CardName>, tableau: ReadonlyArray<CardName>): PlayerViewModel => ({
      id: 'p1',
      pickedCorporationCard: picked.map((name) => ({name})),
      thisPlayer: {color: 'red' as Color, tableau: tableau.map((name) => ({name}))},
      players: [],
    } as unknown as PlayerViewModel);

    it('picked but NOT played (the deferred corporationPlay window) → false', () => {
      expect(startCorporationPlayed(view([CardName.THARSIS_REPUBLIC], []))).to.be.false;
    });

    it('played → true, and it stays true through the wait for the other seats', () => {
      expect(startCorporationPlayed(view([CardName.THARSIS_REPUBLIC], [CardName.THARSIS_REPUBLIC]))).to.be.true;
    });

    it('nothing picked yet (the wizard is still live) → false', () => {
      expect(startCorporationPlayed(view([], [])), 'no corporation chosen').to.be.false;
    });

    it('a tableau holding someone ELSE\'s cards but not the picked corp → false', () => {
      // The tableau is never matched loosely — only the corporation the
      // viewer actually chose counts as «my setup is played».
      expect(startCorporationPlayed(view([CardName.THARSIS_REPUBLIC], [CardName.ANTS]))).to.be.false;
    });
  });
});

/**
 * THE STARTING HAND'S REQUIREMENT HEAD-UP. The initial buy is a pick FOR
 * LATER, so it speaks the very same DRAFT voice the between-generation draft
 * workspace does — through the SAME shared `cardAvailability` model, never a
 * second filter of its own. These two helpers are what the start scene's
 * status rail and its fullscreen viewer read.
 */
describe('consoleStartState (start-hand availability)', () => {
  function card(name: CardName, reasons?: ReadonlyArray<UnplayableReason>): CardModel {
    return (reasons === undefined ? {name} : {name, unplayableReasons: reasons}) as CardModel;
  }
  const oxygen: UnplayableReason = {
    type: 'globalParameter', globalParameter: 'oxygen',
    message: 'Requires ${0}% oxygen', params: ['4'], current: 0, requirement: true,
  };
  const lostOcean: UnplayableReason = {
    type: 'globalParameter', globalParameter: 'oceans',
    message: 'Requires ${0} ocean(s) or fewer', params: ['3'], current: 9,
    requirement: true, unattainable: true,
  };
  // The M€ line the engine also produces at the start (no corporation, no
  // money YET) — NOT a printed requirement, so the draft voice drops it.
  const money: UnplayableReason = {type: 'megacredits', message: 'Requires ${0} M€', params: ['9']};

  it('an unmet printed requirement is PENDING (amber) — the game can still get there', () => {
    const view = startCardAvailability(card(CardName.ANTS, [oxygen, money]));
    expect(view?.severity).eq('pending');
    expect(view?.tone).eq('warning');
    // Only the requirement speaks — the money line is this moment's problem.
    expect(view?.reasons.map((r) => r.type)).to.deep.eq(['globalParameter']);
  });

  it('a provably lost requirement is MISSED (red)', () => {
    const view = startCardAvailability(card(CardName.ANTS, [lostOcean]));
    expect(view?.severity).eq('missed');
    expect(view?.tone).eq('danger');
  });

  it('affordability ALONE says nothing — the player has no corporation yet', () => {
    expect(startCardAvailability(card(CardName.ANTS, [money]))).is.undefined;
  });

  it('a card with no reasons at all says nothing', () => {
    expect(startCardAvailability(card(CardName.ANTS))).is.undefined;
    expect(startCardAvailability(undefined)).is.undefined;
  });

  it('the two-row zone is reserved for the WHOLE step, so a focus move never resizes the grid', () => {
    const projects = [card(CardName.BIRDS), card(CardName.ANTS, [oxygen, money]), card(CardName.FISH)];
    expect(stepShowsAvailability(projects), 'one card with something to say reserves it').is.true;
    // …and a step nothing speaks for keeps the compact rail: the corporation
    // step (no project cards, no reasons) and a fully-reachable project set.
    expect(stepShowsAvailability([card(CardName.BIRDS), card(CardName.FISH)])).is.false;
    expect(stepShowsAvailability([card(CardName.ANTS, [money])]), 'money is not a requirement').is.false;
    expect(stepShowsAvailability([])).is.false;
  });
});
