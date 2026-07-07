import {expect} from 'chai';
import {nextTick} from 'vue';
import {Color} from '@/common/Color';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {MarsBotTurn} from '@/common/automa/MarsBotTurn';
import {
  BOT_TURN_PRIORITY,
  buildBotTurnNotification,
  botTurnNotificationId,
  marsBotPresentationMode,
  openMarsBotReplay,
  openMarsBotReplayByCorrelation,
  presentFreshBotTurns,
  setMarsBotPresentationMode,
} from '@/client/components/marsbot/marsBotPresentation';
import {
  archivedTurnByKey,
  botReplayAvailableFor,
  recordBotTurnsFromView,
  resetMarsBotArchive,
} from '@/client/components/marsbot/marsBotTurnArchive';
import {dismissMarsBotTheater, marsBotTheaterState, resetMarsBotTheater} from '@/client/components/marsbot/marsBotTheaterState';
import {notificationState, resetNotifications, acknowledgeFlowHoldingCards, notificationFlowHoldSupplier} from '@/client/components/notifications/notificationState';
import {isMandatoryPromptsHeld, registerFlowHoldSupplier, resetPresentationLeases} from '@/client/components/presentation/presentationFlow';
import {revealResultState, dismissReveal} from '@/client/components/actions/revealResultState';
import {drawnCardsState} from '@/client/components/drawnCards/drawnCardsState';

function turn(id: number, opts: {correlationId?: number, generation?: number} = {}): MarsBotTurn {
  return {
    id,
    generation: opts.generation ?? 1,
    ...(opts.correlationId !== undefined ? {correlationId: opts.correlationId} : {}),
    steps: [
      {kind: 'reveal', card: {kind: 'project', name: 'Birds' as never}, message: {message: '${0} revealed ${1}', data: []} as never},
      {kind: 'impact', impact: {target: 'blue' as Color, targetIsBot: false, changes: [
        {resource: 'plants' as never, scope: 'stock', before: 5, after: 3},
      ]}},
      {kind: 'impact', impact: {target: 'red' as Color, targetIsBot: true, changes: [
        {resource: 'megacredits' as never, scope: 'stock', before: 0, after: 5},
      ]}},
    ],
  };
}

function botView(opts: {lastTurn?: MarsBotTurn, turnHistory?: ReadonlyArray<MarsBotTurn>} = {}): PlayerViewModel {
  return {
    thisPlayer: {color: 'blue'},
    players: [
      {color: 'red', name: 'ИИ', isMarsBot: true},
      {color: 'blue', name: 'Вы'},
    ],
    game: {
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
    resetMarsBotTheater();
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
    dismissMarsBotTheater();
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
      expect(model.ttl).greaterThan(0);
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
      expect(openMarsBotReplay('red:1:1')).eq(true);
      expect(marsBotTheaterState.active).eq(true);
      expect(marsBotTheaterState.botName).eq('ИИ');
      expect(notificationState.transient).lengthOf(0);
      expect(archivedTurnByKey('red:1:1')?.viewed).eq(true);
      // Case B: while the theater is open, mandatory prompts stay held.
      expect(isMandatoryPromptsHeld()).eq(true);
    });

    it('journal path: opens the replay by the turn\'s correlationId (later, replay-only)', () => {
      recordBotTurnsFromView(undefined, botView({lastTurn: turn(3, {correlationId: 42})}));
      expect(openMarsBotReplayByCorrelation(42)).eq(true);
      expect(marsBotTheaterState.active).eq(true);
      expect(openMarsBotReplayByCorrelation(999)).eq(false);
    });

    it('a queued next card is NOT promoted under the opening theater', () => {
      presentFreshBotTurns(PREV, botView({lastTurn: turn(2), turnHistory: [turn(1), turn(2)]}));
      openMarsBotReplay('red:1:1');
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
        expect(marsBotTheaterState.active).eq(false);
        expect(notificationState.queue).lengthOf(1);

        dismissReveal();
        await nextTick(); // delivered…
        await nextTick(); // …and auto-expanded by the watcher
        expect(marsBotTheaterState.active).eq(true);
        expect(notificationState.transient).lengthOf(0);
      } finally {
        setMarsBotPresentationMode('notification');
      }
    });
  });
});
