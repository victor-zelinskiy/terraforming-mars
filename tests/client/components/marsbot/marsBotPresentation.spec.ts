import {expect} from 'chai';
import {nextTick} from 'vue';
import {Color} from '@/common/Color';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {MarsBotTurn} from '@/common/automa/MarsBotTurn';
import {
  BOT_TURN_PRIORITY,
  BOT_TURN_SUMMARY_CAP,
  BOT_TURN_TTL,
  buildBotTurnNotification,
  botTurnNotificationId,
  globalParamChips,
  marsBotPresentationMode,
  openBotTurnReviewByKey,
  openBotTurnReviewByCorrelation,
  presentFreshBotTurns,
  setMarsBotPresentationMode,
} from '@/client/components/marsbot/marsBotPresentation';
import {
  archivedTurnByKey,
  botReplayAvailableFor,
  recordBotTurnsFromView,
  resetMarsBotArchive,
} from '@/client/components/marsbot/marsBotTurnArchive';
import {botTurnReviewState, closeBotTurnReview, resetBotTurnReview} from '@/client/components/marsbot/botTurnReviewState';
import {notificationState, resetNotifications, acknowledgeFlowHoldingCards, notificationFlowHoldSupplier} from '@/client/components/notifications/notificationState';
import {isMandatoryPromptsHeld, registerFlowHoldSupplier, resetPresentationLeases} from '@/client/components/presentation/presentationFlow';
import {revealResultState, dismissReveal} from '@/client/components/actions/revealResultState';
import {drawnCardsState} from '@/client/components/drawnCards/drawnCardsState';

function logLine(message: string): never {
  return {message, data: []} as never;
}

function turn(id: number, opts: {correlationId?: number, generation?: number, extraSteps?: ReadonlyArray<MarsBotTurn['steps'][number]>} = {}): MarsBotTurn {
  return {
    id,
    generation: opts.generation ?? 1,
    ...(opts.correlationId !== undefined ? {correlationId: opts.correlationId} : {}),
    steps: [
      {kind: 'reveal', card: {kind: 'project', name: 'Birds' as never}, message: logLine('${0} revealed ${1}')},
      ...(opts.extraSteps ?? []),
      {kind: 'impact', impact: {target: 'blue' as Color, targetIsBot: false, changes: [
        {resource: 'plants' as never, scope: 'stock', before: 5, after: 3},
      ]}},
      {kind: 'impact', impact: {target: 'red' as Color, targetIsBot: true, changes: [
        {resource: 'megacredits' as never, scope: 'stock', before: 0, after: 5},
      ]}},
    ],
  };
}

type GameParams = {temperature?: number, oxygenLevel?: number, oceans?: number, venusScaleLevel?: number};

function botView(opts: {lastTurn?: MarsBotTurn, turnHistory?: ReadonlyArray<MarsBotTurn>, params?: GameParams} = {}): PlayerViewModel {
  return {
    thisPlayer: {color: 'blue'},
    players: [
      {color: 'red', name: 'ИИ', isMarsBot: true},
      {color: 'blue', name: 'Вы'},
    ],
    game: {
      temperature: -30,
      oxygenLevel: 1,
      oceans: 2,
      venusScaleLevel: 4,
      ...(opts.params ?? {}),
      automa: {
        tracks: [],
        ...(opts.lastTurn !== undefined ? {lastTurn: opts.lastTurn} : {}),
        ...(opts.turnHistory !== undefined ? {turnHistory: opts.turnHistory} : {}),
      },
      gameOptions: {expansions: {venus: false, colonies: false}},
    },
  } as unknown as PlayerViewModel;
}

const PREV = botView();

describe('marsBotPresentation (notification-first turns)', () => {
  beforeEach(() => {
    resetMarsBotArchive();
    resetBotTurnReview();
    resetNotifications();
    resetPresentationLeases();
    dismissReveal();
    drawnCardsState.events = [];
    setMarsBotPresentationMode('notification');
    notificationState.seeded = true;
    // Module state is bundle-shared — another spec may have overridden the
    // flow-hold supplier; this suite needs the REAL one.
    registerFlowHoldSupplier(notificationFlowHoldSupplier);
  });

  afterEach(() => {
    closeBotTurnReview();
  });

  describe('archive', () => {
    it('a fresh session (no prev view) archives SILENTLY — replayable, never announced', () => {
      const fresh = recordBotTurnsFromView(undefined, botView({lastTurn: turn(1, {correlationId: 77})}));
      expect(fresh).lengthOf(0);
      expect(archivedTurnByKey('red:1:1')).is.not.undefined;
      expect(botReplayAvailableFor(77)).eq(true);
    });

    it('merges lastTurn + turnHistory, dedupes, returns fresh turns in order', () => {
      const t1 = turn(1);
      const t2 = turn(2);
      const fresh = recordBotTurnsFromView(PREV, botView({lastTurn: t2, turnHistory: [t1, t2]}));
      expect(fresh.map((e) => e.turn.id)).deep.eq([1, 2]);
      // A re-poll of the same view yields nothing new.
      expect(recordBotTurnsFromView(PREV, botView({lastTurn: t2, turnHistory: [t1, t2]}))).lengthOf(0);
    });
  });

  describe('the compact turn-event notification', () => {
    it('builds the flow-holding card: headline, viewer pills, expand CTA, journal link', () => {
      const [entry] = recordBotTurnsFromView(PREV, botView({lastTurn: turn(1, {correlationId: 9})}));
      const model = buildBotTurnNotification(entry, {viewerColor: 'blue' as Color, createdAt: 5, autoExpand: false});
      expect(model.id).eq('bot:red:1:1');
      expect(model.kind).eq('important');
      expect(model.variant).eq('bot-turn');
      expect(model.priority).eq(BOT_TURN_PRIORITY);
      expect(model.holdsFlow).eq(true);
      expect(model.persistent).eq(false);
      // The compact card auto-closes in 5 seconds (B closes instantly, X
      // expands into the theater — which never auto-closes).
      expect(model.ttl).eq(BOT_TURN_TTL);
      expect(BOT_TURN_TTL).eq(5000);
      expect(model.header?.message).eq('${0} revealed ${1}');
      // The VIEWER's own loss leads the pills.
      expect(model.pills).deep.eq([{icon: 'plants', text: '−2'}]);
      expect(model.cta).deep.eq({labelKey: 'Watch turn', action: 'expand-theater'});
      expect(model.secondaryCta).deep.eq({labelKey: 'To journal', action: 'open-journal'});
      expect(model.correlationId).eq(9);
      expect(model.botTurnKey).eq('red:1:1');
    });

    it('falls back to the bot\'s own impact pills when the viewer was untouched', () => {
      const t: MarsBotTurn = {...turn(1), steps: turn(1).steps.filter((s) =>
        s.kind !== 'impact' || s.impact.targetIsBot)};
      const [entry] = recordBotTurnsFromView(PREV, botView({lastTurn: t}));
      const model = buildBotTurnNotification(entry, {viewerColor: 'blue' as Color, createdAt: 5, autoExpand: false});
      expect(model.pills).deep.eq([{icon: 'megacredits', text: '+5'}]);
    });

    it('carries the turn\'s key log lines as OUTCOME summary — header never duplicated, cap honest', () => {
      const t = turn(1, {extraSteps: [
        {kind: 'log', message: logLine('placed a city')},
        {kind: 'attack', attack: {target: 'blue' as never, resource: 'plants' as never, demanded: 5, removed: 2, before: 5, after: 3, outcome: 'hit'}, message: logLine('removed plants')},
        {kind: 'failed', reason: 'no-tags', mc: 5, message: logLine('failed action money')},
        {kind: 'log', message: logLine('raised the temperature')},
        {kind: 'tag', tag: 'science' as never, trackIndex: 0},
        {kind: 'advance', trackIndex: 0, from: 0, to: 1},
      ]});
      const [entry] = recordBotTurnsFromView(PREV, botView({lastTurn: t}));
      const model = buildBotTurnNotification(entry, {viewerColor: 'blue' as Color, createdAt: 5, autoExpand: false});
      // Header = the reveal line; the summary = the other key lines, in order.
      expect(model.header?.message).eq('${0} revealed ${1}');
      expect(model.summaryLines?.map((l) => l.message)).deep.eq([
        'placed a city', 'removed plants', 'failed action money',
      ]);
      expect(model.summaryLines).lengthOf(BOT_TURN_SUMMARY_CAP);
      // One line was cut by the cap — declared, never silent.
      expect(model.summaryOverflow).eq(1);
      // Internal automa bookkeeping (tags / track advances) is NOT in the
      // compact summary — it lives in the detailed inspect.
      expect(model.detailCount).eq(t.steps.length);
    });

    it('global-parameter before → after chips lead the pills (single fresh turn)', () => {
      const prev = botView({params: {temperature: -30, oceans: 2}});
      const next = botView({lastTurn: turn(1), params: {temperature: -28, oceans: 3}});
      expect(globalParamChips(prev, next)).deep.eq([
        {icon: 'temperature', text: '-30°→-28°', neutral: true},
        {icon: 'ocean', text: '2→3', neutral: true},
      ]);
      presentFreshBotTurns(prev, next);
      const card = notificationState.transient[0];
      expect(card.pills.slice(0, 2)).deep.eq([
        {icon: 'temperature', text: '-30°→-28°', neutral: true},
        {icon: 'ocean', text: '2→3', neutral: true},
      ]);
      // The viewer's own loss still follows.
      expect(card.pills.some((c) => c.icon === 'plants' && c.text === '−2')).eq(true);
    });
  });

  describe('presentation queue', () => {
    it('a fresh turn presents as ONE visible card; further turns wait FIFO (никогда не спам)', () => {
      presentFreshBotTurns(PREV, botView({lastTurn: turn(2), turnHistory: [turn(1), turn(2)]}));
      expect(notificationState.transient.map((n) => n.id)).deep.eq(['bot:red:1:1']);
      expect(notificationState.queue.map((n) => n.id)).deep.eq(['bot:red:1:2']);
      // While the card is visible, mandatory prompts (draft/modal) hold.
      expect(isMandatoryPromptsHeld()).eq(true);
    });

    it('Case A: a result modal is open → the turn card WAITS in the queue, presents on close', async () => {
      revealResultState.active = true;
      await nextTick(); // the blocked transition is observed
      presentFreshBotTurns(PREV, botView({lastTurn: turn(1)}));
      expect(notificationState.transient).lengthOf(0);
      expect(notificationState.queue.map((n) => n.id)).deep.eq(['bot:red:1:1']);
      expect(isMandatoryPromptsHeld()).eq(false); // queued ≠ holding

      dismissReveal();
      await nextTick(); // the freed transition drains the queue
      expect(notificationState.transient.map((n) => n.id)).deep.eq(['bot:red:1:1']);
      expect(isMandatoryPromptsHeld()).eq(true);
    });

    it('the player ACTING implicitly acknowledges the visible card (submit path)', () => {
      presentFreshBotTurns(PREV, botView({lastTurn: turn(1)}));
      expect(notificationState.transient).lengthOf(1);
      acknowledgeFlowHoldingCards();
      expect(notificationState.transient).lengthOf(0);
      expect(isMandatoryPromptsHeld()).eq(false);
    });
  });

  describe('theater replay', () => {
    it('expand: the theater opens on the archived script, the card is dismissed, the turn is marked viewed', () => {
      presentFreshBotTurns(PREV, botView({lastTurn: turn(1)}));
      expect(openBotTurnReviewByKey('red:1:1')).eq(true);
      expect(botTurnReviewState.open).eq(true);
      expect(botTurnReviewState.botName).eq('ИИ');
      expect(notificationState.transient).lengthOf(0);
      expect(archivedTurnByKey('red:1:1')?.viewed).eq(true);
      // Case B: while the theater is open, mandatory prompts stay held.
      expect(isMandatoryPromptsHeld()).eq(true);
    });

    it('journal path: opens the replay by the turn\'s correlationId (later, replay-only)', () => {
      recordBotTurnsFromView(undefined, botView({lastTurn: turn(3, {correlationId: 42})}));
      expect(openBotTurnReviewByCorrelation(42)).eq(true);
      expect(botTurnReviewState.open).eq(true);
      expect(openBotTurnReviewByCorrelation(999)).eq(false);
    });

    it('a queued next card is NOT promoted under the opening theater', () => {
      presentFreshBotTurns(PREV, botView({lastTurn: turn(2), turnHistory: [turn(1), turn(2)]}));
      openBotTurnReviewByKey('red:1:1');
      // The freed slot stays empty while the theater blocks delivery.
      expect(notificationState.transient).lengthOf(0);
      expect(notificationState.queue.map((n) => n.id)).deep.eq(['bot:red:1:2']);
    });
  });

  describe('presentation mode (the architecture knob)', () => {
    it('defaults to notification-first; the knob persists', () => {
      expect(marsBotPresentationMode()).eq('notification');
      setMarsBotPresentationMode('theater');
      expect(marsBotPresentationMode()).eq('theater');
      setMarsBotPresentationMode('notification');
    });

    it('theater mode: the card AUTO-EXPANDS the moment it is DELIVERED (gates still respected)', async () => {
      setMarsBotPresentationMode('theater');
      try {
        revealResultState.active = true; // result modal open — even auto-theater waits
        await nextTick(); // the blocked transition is observed
        presentFreshBotTurns(PREV, botView({lastTurn: turn(1)}));
        await nextTick();
        expect(botTurnReviewState.open).eq(false);
        expect(notificationState.queue).lengthOf(1);

        dismissReveal();
        await nextTick(); // delivered…
        await nextTick(); // …and auto-expanded by the watcher
        expect(botTurnReviewState.open).eq(true);
        expect(notificationState.transient).lengthOf(0);
      } finally {
        setMarsBotPresentationMode('notification');
      }
    });
  });
});
