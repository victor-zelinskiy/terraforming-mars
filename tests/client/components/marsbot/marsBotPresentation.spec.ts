import {expect} from 'chai';
import {nextTick} from 'vue';
import {Color} from '@/common/Color';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {MarsBotTurn} from '@/common/automa/MarsBotTurn';
import {
  BOT_TURN_PRIORITY,
  BOT_TURN_SUMMARY_CAP,
  BOT_TURN_TTL,
  botReviewHasAdjacentTurn,
  buildBotTurnNotification,
  botTurnNotificationId,
  globalParamChips,
  marsBotPresentationMode,
  openBotTurnReviewByKey,
  openBotTurnReviewByCorrelation,
  presentFreshBotTurns,
  setMarsBotPresentationMode,
  skipBotTurnPresentation,
  stepBotTurnReview,
} from '@/client/components/marsbot/marsBotPresentation';
import {
  SLOW_TURN_WARN_MS,
  botTurnCommitLag,
  resetBotTurnTiming,
} from '@/client/components/marsbot/marsBotTurnTiming';
import {beginAnimationHold} from '@/client/components/presentation/animationHold';
import {
  adjacentArchivedTurn,
  archivedTurnByKey,
  archivedTurnsInOrder,
  botReplayAvailableFor,
  recordBotTurnsFromView,
  resetMarsBotArchive,
} from '@/client/components/marsbot/marsBotTurnArchive';
import {isBotStagingActive, resetBotStaging} from '@/client/components/marsbot/marsBotStagedCommits';
import {botTurnReviewState, closeBotTurnReview, resetBotTurnReview} from '@/client/components/marsbot/botTurnReviewState';
import {dismiss, notificationState, resetNotifications, acknowledgeFlowHoldingCards, notificationFlowHoldSupplier} from '@/client/components/notifications/notificationState';
import {isMandatoryPromptsHeld, registerFlowHoldSupplier, resetPresentationLeases} from '@/client/components/presentation/presentationFlow';
import {closeRevealViewer, revealViewerState} from '@/client/components/notifications/revealViewerState';
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

/**
 * `waitingFor` is load-bearing, not decoration: it is how the presentation
 * tells «the bot handed control back» (commit now) from «the bot is still
 * playing» (sequence). The default is the ordinary case — the player's turn.
 */
function botView(opts: {lastTurn?: MarsBotTurn, turnHistory?: ReadonlyArray<MarsBotTurn>, params?: GameParams, waitingFor?: unknown} = {}): PlayerViewModel {
  return {
    thisPlayer: {color: 'blue'},
    waitingFor: 'waitingFor' in opts ? opts.waitingFor : {type: 'or'},
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
    resetBotStaging();
    resetBotTurnReview();
    resetNotifications();
    resetPresentationLeases();
    closeRevealViewer();
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
      // A turn that COST the viewer something lingers with the hostile TTL —
      // armed at BUILD (the old path re-armed it on the visible card, which
      // restarted the lifetime bar mid-read). A neutral turn keeps the short
      // 5 s compact lifetime (asserted in the neutral test below).
      expect(model.ttl).eq(13_000);
      expect(BOT_TURN_TTL).eq(5000);
      expect(model.header?.message).eq('${0} revealed ${1}');
      // The VIEWER's own loss LEADS the card as its viewer band (sign +
      // importance are the two independent axes); the pills keep the bot's
      // own context so the loss is never repeated as an anonymous chip.
      expect(model.sign).eq('negative');
      expect(model.importance).eq('critical');
      expect(model.viewerImpact?.losses).deep.eq([{icon: 'plants', text: '−2'}]);
      expect(model.viewerImpact?.attacker).eq('red');
      expect(model.viewerImpact?.scope).eq('stock');
      expect(model.pills).deep.eq([{icon: 'megacredits', text: '+5'}]);
      // …and the same context as an OWNERSHIP cluster: the bot's own gain is
      // labelled the ACTOR's, so it can never read as one more viewer reward.
      expect(model.pillGroups).deep.eq([{scope: 'actor', chips: [{icon: 'megacredits', text: '+5'}]}]);
      expect(model.cta).deep.eq({labelKey: 'Watch turn', action: 'expand-theater'});
      expect(model.secondaryCta).deep.eq({labelKey: 'To journal', action: 'open-journal'});
      expect(model.correlationId).eq(9);
      expect(model.botTurnKey).eq('red:1:1');
    });

    it('DELIVERS a cube the bot took outright — the card IS the presentation of that loss', () => {
      // B02 Invasive Species with a single candidate: no prompt is raised, so
      // this card is the whole moment. It must lead RED on its FIRST frame
      // (the atomic contract), name the cube that actually left rather than
      // the demand's animal+microbe pair, and — because a resource chip cannot
      // say WHICH card lost it — keep the removal's own log line, which the
      // structural viewer-drop would otherwise fold away.
      const removal = {
        message: '${0} removed ${1} resource(s) from ${2}\'s ${3}',
        data: [{type: 2 /* PLAYER */, value: 'red'}],
      } as never;
      const t: MarsBotTurn = {
        id: 1,
        generation: 1,
        steps: [
          {kind: 'reveal', card: {kind: 'bonus', id: 'B02' as never}, message: logLine('${0} revealed ${1}')},
          {kind: 'attack', attack: {
            target: 'blue' as Color, resource: 'cube', cardResource: 'Microbe' as never,
            demanded: 1, removed: 1, before: 2, after: 1, outcome: 'hit',
          }},
          {kind: 'log', message: removal},
          {kind: 'impact', impact: {target: 'red' as Color, targetIsBot: true, changes: [
            {resource: 'megacredits' as never, scope: 'stock', before: 0, after: 5},
          ]}},
        ],
      };
      const [entry] = recordBotTurnsFromView(PREV, botView({lastTurn: t}));
      const model = buildBotTurnNotification(entry, {viewerColor: 'blue' as Color, createdAt: 5, autoExpand: false});
      expect(model.sign).eq('negative');
      expect(model.importance, 'a viewer loss must not be missed').eq('critical');
      expect(model.ttl, '…and lingers with the hostile lifetime').eq(13_000);
      expect(model.viewerImpact?.losses).deep.eq([{icon: 'Microbe', text: '−1'}]);
      expect(model.viewerImpact?.attacker).eq('red');
      // The line that names the CARD survives: it is not a restatement of the
      // band (the chip says how much, only this says off WHAT).
      expect((model.summaryLines ?? []).map((l) => l.message))
        .contains('${0} removed ${1} resource(s) from ${2}\'s ${3}');
      // The seat is in `affects`, so the personal feed mode shows the card.
      expect(model.affects).contains('blue');
    });

    it('falls back to the bot\'s own impact pills when the viewer was untouched', () => {
      const t: MarsBotTurn = {...turn(1), steps: turn(1).steps.filter((s) =>
        s.kind !== 'impact' || s.impact.targetIsBot)};
      const [entry] = recordBotTurnsFromView(PREV, botView({lastTurn: t}));
      const model = buildBotTurnNotification(entry, {viewerColor: 'blue' as Color, createdAt: 5, autoExpand: false});
      expect(model.pills).deep.eq([{icon: 'megacredits', text: '+5'}]);
      expect(model.sign).eq('neutral');
      expect(model.importance).eq('ambient');
      expect(model.viewerImpact).eq(undefined);
      // …and a neutral turn keeps the short compact lifetime.
      expect(model.ttl).eq(BOT_TURN_TTL);
    });

    it('a summary line restating the VIEWER\'s own delta is dropped when the band leads (one fact, one voice)', () => {
      const viewerLine = {message: '${0} gained 1 heat', data: [{type: 2 /* PLAYER */, value: 'blue'}]} as never;
      const botLine = {message: '${0} placed a city', data: [{type: 2 /* PLAYER */, value: 'red'}]} as never;
      const t = turn(1, {extraSteps: [
        {kind: 'log', message: viewerLine},
        {kind: 'log', message: botLine},
      ]});
      const [entry] = recordBotTurnsFromView(PREV, botView({lastTurn: t}));
      const model = buildBotTurnNotification(entry, {viewerColor: 'blue' as Color, createdAt: 5, autoExpand: false});
      expect(model.viewerImpact, 'the band leads').is.not.eq(undefined);
      const lines = (model.summaryLines ?? []).map((l) => l.message);
      expect(lines).not.contains('${0} gained 1 heat');
      // The bot's own line stays — only the band's restatement is folded.
      expect(lines).contains('${0} placed a city');
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
      // The attack ON THE VIEWER («removed plants») restates the band and is
      // dropped STRUCTURALLY (step.attack.target === viewer) — whatever its
      // message template looks like. The remaining key lines all fit the cap.
      expect(model.summaryLines?.map((l) => l.message)).deep.eq([
        'placed a city', 'failed action money', 'raised the temperature',
      ]);
      expect(model.summaryLines).lengthOf(BOT_TURN_SUMMARY_CAP);
      expect(model.summaryOverflow).eq(undefined);
      // Internal automa bookkeeping (tags / track advances) is NOT in the
      // compact summary — it lives in the detailed inspect.
      expect(model.detailCount).eq(t.steps.length);
    });

    // ── THE P0 REGRESSION CASE (the destroyed bonus card, «−5 растений») ─────
    it('a bonus-card attack builds ATOMICALLY: negative at frame one, victim line dropped, headline names the card', () => {
      const playedLine = {message: '${0} played the bonus card ${1}', data: [
        {type: 2 /* PLAYER */, value: 'red'}, {type: 0 /* STRING */, value: 'Meteor Shower'},
      ]} as never;
      const victimLine = {message: '${0} lost ${1} ${2} because of ${3}', data: [
        {type: 2 /* PLAYER */, value: 'blue'}, {type: 1, value: '5'}, {type: 15, value: 'plants'}, {type: 2, value: 'red'},
      ]} as never;
      const fateLine = logLine('MarsBot bonus card ${0} was destroyed and removed from the game');
      const t: MarsBotTurn = {
        id: 3, generation: 2, correlationId: 41,
        steps: [
          {kind: 'reveal', card: {kind: 'bonus', id: 'B01' as never}, message: playedLine, resolution: {fate: 'destroyed'}},
          // The loss lives ONLY here — the end-of-turn snapshot suppressed it
          // (the server's coveredByAttack de-dup), which is exactly what made
          // the old impact-only reading build this card NEUTRAL.
          {kind: 'attack', attack: {target: 'blue' as never, resource: 'plants' as never, demanded: 5, removed: 5, before: 508, after: 503, outcome: 'hit'}, message: victimLine, cause: {kind: 'bonus'}},
          {kind: 'log', message: fateLine, cause: {kind: 'bonus'}},
          {kind: 'impact', impact: {target: 'red' as Color, targetIsBot: true, changes: [
            {resource: 'megacredits' as never, scope: 'stock', before: 10, after: 12},
          ]}},
        ],
      };
      const [entry] = recordBotTurnsFromView(PREV, botView({lastTurn: t}));
      const model = buildBotTurnNotification(entry, {viewerColor: 'blue' as Color, createdAt: 5, autoExpand: false});
      // 1) The FIRST build already carries the full hostile semantics — no
      //    later enrichment may ever change them (visible cards are frozen).
      expect(model.sign).eq('negative');
      expect(model.importance).eq('critical');
      expect(model.viewerImpact?.losses).deep.eq([{icon: 'plants', text: '−5'}]);
      expect(model.viewerImpact?.attacker).eq('red');
      // 2) The headline IS the causal statement — it names the bonus card
      //    (the STRING token survives the one-shot card leaving the game).
      expect(model.header).eq(playedLine);
      // 3) The victim's own line is dropped (the band owns that fact); the
      //    card's FATE line stays — with the band leading, the story reads
      //    hero → played card → destroyed.
      const lines = (model.summaryLines ?? []).map((l) => l.message);
      expect(lines).not.contains('${0} lost ${1} ${2} because of ${3}');
      expect(lines).contains('MarsBot bonus card ${0} was destroyed and removed from the game');
      // 4) One story, one card: the bot pipeline is the only producer for an
      //    automa turn (diffNegativeNotifications skips automa chains), and
      //    this model is complete at birth.
      expect(model.id).eq('bot:red:2:3');
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
      // The viewer's own loss leads the card as its band, never as a pill.
      expect(card.viewerImpact?.losses).deep.eq([{icon: 'plants', text: '−2'}]);
      expect(card.pills.some((c) => c.icon === 'plants')).eq(false);
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
      revealViewerState.open = true;
      await nextTick(); // the blocked transition is observed
      presentFreshBotTurns(PREV, botView({lastTurn: turn(1)}));
      expect(notificationState.transient).lengthOf(0);
      expect(notificationState.queue.map((n) => n.id)).deep.eq(['bot:red:1:1']);
      expect(isMandatoryPromptsHeld()).eq(false); // queued ≠ holding

      closeRevealViewer();
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

  describe('staged-commit liveness (no deadlock when reviewing a batch via navigation)', () => {
    // Reproduces the reported deadlock: the player passes, the server resolves a
    // BATCH of bot turns + the between-generation draft in ONE response. The
    // client STAGES it (buffers the draft view, presents the turns one card at a
    // time). Opening the first card's review then RB-navigating through the rest
    // used to dismiss the QUEUED cards without ever delivering the last turn, so
    // the buffer never committed and the draft never arrived → hard hang.
    it('RB-navigating through every staged turn commits the buffered draft view', async () => {
      let committed = false;
      const next = botView({turnHistory: [turn(1), turn(2), turn(3)], lastTurn: turn(3)});
      const staged = presentFreshBotTurns(PREV, next, {commitLatest: () => {
        committed = true;
      }});
      expect(staged).eq(true); // staging owns the commit — the caller must NOT commit
      expect(isBotStagingActive()).eq(true);
      await nextTick(); // the first card is delivered (its footprint applies)
      expect(notificationState.transient.map((n) => n.botTurnKey)).deep.eq(['red:1:1']);

      openBotTurnReviewByKey('red:1:1'); // open the first turn's review (X)
      stepBotTurnReview(1); // RB → red:1:2
      expect(committed).eq(false); // not the last turn yet
      stepBotTurnReview(1); // RB → red:1:3 (the LAST) → commits the buffer
      expect(committed).eq(true);
      expect(isBotStagingActive()).eq(false);
    });

    it('the liveness backstop commits when every staged card leaves WITHOUT delivering the last turn', async () => {
      let committed = false;
      const next = botView({turnHistory: [turn(1), turn(2), turn(3)], lastTurn: turn(3)});
      presentFreshBotTurns(PREV, next, {commitLatest: () => {
        committed = true;
      }});
      await nextTick();
      openBotTurnReviewByKey('red:1:1'); // review open → delivery is blocked
      // The middle + last cards are dismissed WITHOUT navigation (evicted / TTL /
      // drained). The last turn is never delivered — only the reactive liveness
      // watch can rescue the window.
      dismiss(botTurnNotificationId('red:1:2'));
      dismiss(botTurnNotificationId('red:1:3'));
      await nextTick(); // the card-set change fires the liveness watch
      expect(committed).eq(true);
      expect(isBotStagingActive()).eq(false);
    });
  });

  describe('a LONE turn never waits on its own card («бот думает 5 секунд»)', () => {
    /*
     * THE REPORT: on a LOCAL server MarsBot's turn regularly took ~5 s. The
     * server was measured resolving a turn in under a millisecond — the wait was
     * here. Every response with a fresh turn opened a staging window, which
     * BUFFERS the authoritative view (the player's own next prompt with it) until
     * the turn's compact card is DELIVERED. Delivery waits behind the feed's
     * silencing gates — and the player's own action cinematic is running at
     * exactly that moment, every single turn.
     *
     * Sequencing is for a BURST. One turn has nothing to sequence.
     */
    it('commits IMMEDIATELY while the feed is silenced by a live cinematic', () => {
      const hold = beginAnimationHold('probe-cinematic');
      try {
        let committed = false;
        const staged = presentFreshBotTurns(PREV, botView({lastTurn: turn(1)}), {
          commitLatest: () => {
            committed = true;
          },
        });
        // The CALLER commits (that is what `false` means) — nothing is buffered.
        expect(staged).eq(false);
        expect(isBotStagingActive()).eq(false);
        expect(committed).eq(false); // ...the caller does it, not us
        // The card still rides the ordinary feed and waits its turn there. That
        // is a TOAST waiting, not the game.
        expect(notificationState.queue.map((n) => n.botTurnKey)).deep.eq(['red:1:1']);
      } finally {
        hold.release();
      }
    });

    it('the diagnostic reports the single-turn path with a ~0 ms commit', () => {
      resetBotTurnTiming();
      presentFreshBotTurns(PREV, botView({lastTurn: turn(1)}), {commitLatest: () => {}});
      expect(botTurnCommitLag('red:1:1')).to.be.lessThan(SLOW_TURN_WARN_MS);
    });

    it('SEVERAL turns in ONE response still sequence (the pass-through burst)', async () => {
      let committed = false;
      const next = botView({turnHistory: [turn(1), turn(2)], lastTurn: turn(2)});
      expect(presentFreshBotTurns(PREV, next, {commitLatest: () => {
        committed = true;
      }})).eq(true);
      expect(isBotStagingActive()).eq(true);
      await nextTick();
      expect(committed).eq(false); // the second turn's card has not been read yet
    });

    it('a turn that does NOT hand control back sequences — the run has more coming', () => {
      // The bot is mid-run (the player passed): no prompt in this view, so
      // buffering costs the player nothing and keeps the run in order.
      const next = botView({lastTurn: turn(1), waitingFor: undefined});
      expect(presentFreshBotTurns(PREV, next, {commitLatest: () => {}})).eq(true);
      expect(isBotStagingActive()).eq(true);
    });

    it('a turn arriving while a window is OPEN joins it — order is never broken', () => {
      presentFreshBotTurns(PREV, botView({turnHistory: [turn(1), turn(2)], lastTurn: turn(2)}), {commitLatest: () => {}});
      expect(isBotStagingActive()).eq(true);
      const joined = presentFreshBotTurns(PREV, botView({turnHistory: [turn(1), turn(2), turn(3)], lastTurn: turn(3)}), {
        commitLatest: () => {},
      });
      expect(joined).eq(true);
      expect(isBotStagingActive()).eq(true);
    });
  });

  /** A turn that touches NOBODY but the bot — the trimmable «бот походил» noise. */
  function neutralTurn(id: number): MarsBotTurn {
    const t = turn(id);
    return {...t, steps: t.steps.filter((s) => s.kind !== 'impact' || s.impact.targetIsBot)};
  }

  describe('B on a bot-turn card collapses the whole AI-turn backlog', () => {
    it('acks, delivers every queued turn and commits — the player gets their prompt back', async () => {
      let committed = false;
      const next = botView({turnHistory: [neutralTurn(1), neutralTurn(2), neutralTurn(3)], lastTurn: neutralTurn(3)});
      presentFreshBotTurns(PREV, next, {commitLatest: () => {
        committed = true;
      }});
      await nextTick();
      expect(notificationState.transient.map((n) => n.botTurnKey)).deep.eq(['red:1:1']);
      // Only ONE waits behind the visible card (`MAX_QUEUED_BOT_CARDS`): a
      // backlog of toasts is a backlog on the player, so the middle turn was
      // already drained to the journal when the third arrived.
      expect(notificationState.queue.map((n) => n.botTurnKey)).deep.eq(['red:1:3']);

      skipBotTurnPresentation('red:1:1'); // ← the player's B

      expect(committed).eq(true);
      expect(isBotStagingActive()).eq(false);
      expect(notificationState.transient.filter((n) => n.botTurnKey !== undefined)).lengthOf(0);
      expect(notificationState.queue.filter((n) => n.botTurnKey !== undefined)).lengthOf(0);
      // Nothing is lost: every turn stays replayable from the journal.
      expect(archivedTurnByKey('red:1:3')).is.not.undefined;
    });

    it('a turn that COST the viewer something is NEVER trimmed unseen (hostile exempt)', async () => {
      // Three loss-carrying turns: the cap would drain the middle one for
      // neutral noise, but a loss is not noise — every hostile card keeps its
      // place in the FIFO and presents. (The player's own explicit B still
      // collapses everything — the test above.)
      const next = botView({turnHistory: [turn(1), turn(2), turn(3)], lastTurn: turn(3)});
      presentFreshBotTurns(PREV, next, {commitLatest: () => {}});
      await nextTick();
      expect(notificationState.transient.map((n) => n.botTurnKey)).deep.eq(['red:1:1']);
      expect(notificationState.queue.map((n) => n.botTurnKey)).deep.eq(['red:1:2', 'red:1:3']);
    });

    it('leaves ORDINARY queued notifications alone — it is the AI-turn feed only', async () => {
      presentFreshBotTurns(PREV, botView({turnHistory: [turn(1), turn(2)], lastTurn: turn(2)}), {commitLatest: () => {}});
      await nextTick();
      notificationState.queue.push({
        id: 'plain', kind: 'normal', variant: 'event', priority: 5, typeLabelKey: 'x',
        pills: [], detailCount: 0, generation: 1, ttl: 6800, persistent: false, createdAt: Date.now(),
      } as never);
      skipBotTurnPresentation('red:1:1');
      // It survives — the freed slot simply promotes it, which is the ordinary
      // feed doing its job. What must never happen is it being dropped.
      expect([...notificationState.transient, ...notificationState.queue].map((n) => n.id)).deep.eq(['plain']);
    });
  });

  describe('turn navigation (LB / RB across archived turns)', () => {
    it('adjacentArchivedTurn / archivedTurnsInOrder walk turns in (generation, id) order', () => {
      recordBotTurnsFromView(undefined, botView({turnHistory: [
        turn(1, {generation: 1}), turn(2, {generation: 1}), turn(1, {generation: 2}),
      ]}));
      expect(archivedTurnsInOrder('red' as Color).map((e) => e.key)).deep.eq(['red:1:1', 'red:1:2', 'red:2:1']);
      expect(adjacentArchivedTurn('red:1:2', 1)?.key).eq('red:2:1');
      expect(adjacentArchivedTurn('red:1:2', -1)?.key).eq('red:1:1');
      // Boundaries + an unknown anchor → undefined.
      expect(adjacentArchivedTurn('red:1:1', -1)).is.undefined;
      expect(adjacentArchivedTurn('red:2:1', 1)).is.undefined;
      expect(adjacentArchivedTurn('red:9:9', 1)).is.undefined;
    });

    it('RB steps to the next turn, LB steps back — the review re-points to that turn', () => {
      recordBotTurnsFromView(undefined, botView({turnHistory: [turn(1), turn(2), turn(3)]}));
      openBotTurnReviewByKey('red:1:1');
      expect(botTurnReviewState.key).eq('red:1:1');

      expect(stepBotTurnReview(1)).eq('ok');
      expect(botTurnReviewState.key).eq('red:1:2');
      expect(stepBotTurnReview(1)).eq('ok');
      expect(botTurnReviewState.key).eq('red:1:3');

      expect(stepBotTurnReview(-1)).eq('ok');
      expect(botTurnReviewState.key).eq('red:1:2');
      // No stray boundary notice while navigation is valid.
      expect(botTurnReviewState.edge).eq('');
    });

    it('a boundary flashes the review-local edge notice, never navigates', () => {
      recordBotTurnsFromView(undefined, botView({turnHistory: [turn(1), turn(2)]}));
      openBotTurnReviewByKey('red:1:2');

      // At the last turn RB → "next turn not made yet".
      expect(stepBotTurnReview(1)).eq('no-next');
      expect(botTurnReviewState.key).eq('red:1:2'); // unchanged
      expect(botTurnReviewState.edge).eq('no-next');
      const firstNonce = botTurnReviewState.edgeNonce;

      // A repeated press re-arms the toast (bumps the nonce so the surface
      // replays its pop animation).
      expect(stepBotTurnReview(1)).eq('no-next');
      expect(botTurnReviewState.edgeNonce).eq(firstNonce + 1);

      // Back to the first turn, then LB → "previous turn unavailable".
      stepBotTurnReview(-1);
      expect(botTurnReviewState.key).eq('red:1:1');
      expect(stepBotTurnReview(-1)).eq('no-prev');
      expect(botTurnReviewState.key).eq('red:1:1');
      expect(botTurnReviewState.edge).eq('no-prev');
    });

    it('botReviewHasAdjacentTurn drives the desktop button enabled-state', () => {
      recordBotTurnsFromView(undefined, botView({turnHistory: [turn(1), turn(2)]}));
      // Closed review → no adjacency.
      expect(botReviewHasAdjacentTurn(1)).eq(false);
      openBotTurnReviewByKey('red:1:1');
      expect(botReviewHasAdjacentTurn(-1)).eq(false); // first turn
      expect(botReviewHasAdjacentTurn(1)).eq(true);
      openBotTurnReviewByKey('red:1:2');
      expect(botReviewHasAdjacentTurn(-1)).eq(true);
      expect(botReviewHasAdjacentTurn(1)).eq(false); // last turn
    });

    it('a closed review swallows a step as a boundary (no throw)', () => {
      expect(botTurnReviewState.open).eq(false);
      expect(stepBotTurnReview(1)).eq('no-next');
      expect(stepBotTurnReview(-1)).eq('no-prev');
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
        revealViewerState.open = true; // result modal open — even auto-theater waits
        await nextTick(); // the blocked transition is observed
        presentFreshBotTurns(PREV, botView({lastTurn: turn(1)}));
        await nextTick();
        expect(botTurnReviewState.open).eq(false);
        expect(notificationState.queue).lengthOf(1);

        closeRevealViewer();
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
