import {expect} from 'chai';
import {nextTick} from 'vue';
import {Color} from '@/common/Color';
import {TileType} from '@/common/TileType';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {MarsBotTurn} from '@/common/automa/MarsBotTurn';
import {
  presentFreshBotTurns,
  ensureBotPresentationLiveness,
  setMarsBotPresentationMode,
} from '@/client/components/marsbot/marsBotPresentation';
import {
  botStagingState,
  applyTurnVisual,
  deliverBotTurnVisual,
  isBotStagingActive,
  resetBotStaging,
} from '@/client/components/marsbot/marsBotStagedCommits';
import {shouldHoldForOwnerCubePlacement} from '@/client/components/board/cubeDropState';
import {resetMarsBotArchive} from '@/client/components/marsbot/marsBotTurnArchive';
import {closeBotTurnReview, resetBotTurnReview} from '@/client/components/marsbot/botTurnReviewState';
import {notificationState, resetNotifications, setNotificationViewer, dismiss} from '@/client/components/notifications/notificationState';
import {setNotificationFeedMode} from '@/client/components/notifications/notificationFeedMode';
import {setBotAckViewer, resetBotTurnAckForTesting} from '@/client/components/marsbot/botTurnAck';
import {resetPresentationLeases} from '@/client/components/presentation/presentationFlow';
import {revealResultState, dismissReveal} from '@/client/components/actions/revealResultState';
import {drawnCardsState} from '@/client/components/drawnCards/drawnCardsState';

/**
 * STAGED VISUAL COMMITS — the FIFO visual timeline of bot turns.
 * The player must never see the consequences of turn N before turn N's own
 * compact notification, and after the drain the presented state must equal
 * the latest authoritative state.
 */

function turnWithVisual(id: number, opts: {spaceId?: string, markerSpaceId?: string, temperature?: [number, number], mc?: [number, number], attackBlue?: boolean} = {}): MarsBotTurn {
  return {
    id,
    generation: 1,
    visual: {
      ...(opts.spaceId !== undefined ? {tiles: [{spaceId: opts.spaceId as never, tileType: TileType.CITY, color: 'red' as Color}]} : {}),
      ...(opts.markerSpaceId !== undefined ? {markers: [{spaceId: opts.markerSpaceId as never, color: 'red' as Color}]} : {}),
      ...(opts.temperature !== undefined ? {temperature: {before: opts.temperature[0], after: opts.temperature[1]}} : {}),
    },
    steps: [
      {kind: 'reveal', card: {kind: 'project', name: 'Birds' as never}, message: {message: '${0} revealed ${1}', data: []} as never},
      ...(opts.mc !== undefined ? [{
        kind: 'impact' as const,
        impact: {target: 'red' as Color, targetIsBot: true, changes: [
          {resource: 'megacredits' as never, scope: 'stock' as const, before: opts.mc[0], after: opts.mc[1]},
        ]},
      }] : []),
      // A direct attack on the viewer — the structured involvement signal the
      // personal feed mode reads (a zero-outcome attack still involves them).
      ...(opts.attackBlue === true ? [{
        kind: 'attack' as const,
        attack: {target: 'blue' as Color, resource: 'plants' as never, demanded: 2, removed: 0, outcome: 'protected' as const},
      }] : []),
    ],
  };
}

type ViewOpts = {
  turns?: ReadonlyArray<MarsBotTurn>,
  temperature?: number,
  botMc?: number,
  tiles?: Record<string, TileType>,
  waitingFor?: unknown,
};

function makeView(opts: ViewOpts = {}): PlayerViewModel {
  const spaces = ['03', '05', '08'].map((id) => ({
    id,
    ...(opts.tiles?.[id] !== undefined ? {tileType: opts.tiles[id], color: 'red'} : {}),
  }));
  const turns = opts.turns ?? [];
  return {
    thisPlayer: {color: 'blue', name: 'Вы', megacredits: 10},
    waitingFor: opts.waitingFor,
    players: [
      {color: 'red', name: 'Бот', isMarsBot: true, megacredits: opts.botMc ?? 0},
      {color: 'blue', name: 'Вы', megacredits: 10},
    ],
    game: {
      spaces,
      temperature: opts.temperature ?? -30,
      oxygenLevel: 0,
      oceans: 0,
      venusScaleLevel: 0,
      automa: {
        tracks: [],
        ...(turns.length > 0 ? {lastTurn: turns[turns.length - 1], turnHistory: turns} : {}),
      },
      gameOptions: {expansions: {venus: false, colonies: false}},
    },
  } as unknown as PlayerViewModel;
}

function spaceOf(view: PlayerViewModel, id: string) {
  return view.game.spaces.find((s) => s.id === (id as never))!;
}

function botMcOf(view: PlayerViewModel): number {
  return (view.players.find((p) => (p as {isMarsBot?: boolean}).isMarsBot) as {megacredits: number}).megacredits;
}

const PREV = makeView();

describe('marsBotStagedCommits (the staged FIFO visual timeline)', () => {
  let committed: number;
  const commitLatest = () => committed++;

  beforeEach(() => {
    committed = 0;
    resetBotStaging();
    resetMarsBotArchive();
    resetBotTurnReview();
    resetNotifications();
    resetPresentationLeases();
    dismissReveal();
    drawnCardsState.events = [];
    setMarsBotPresentationMode('notification');
    notificationState.seeded = true;
  });

  afterEach(() => {
    closeBotTurnReview();
    resetBotStaging();
    // Module state is BUNDLE-SHARED in mochapack: the LAST test's leftovers
    // walk out of this file. A flow-holding bot-turn card left visible keeps
    // `notificationFlowHoldSupplier` true, so `isMandatoryPromptsHeld()` reads
    // true in EVERY later spec (animationHold's release assertions failed on
    // exactly this whenever no intermediate spec happened to reset the store).
    resetNotifications();
    resetPresentationLeases();
  });

  it('a batch of bot turns is NOT committed on arrival — no tiles/params/prompt from the future', async () => {
    const presented = makeView({waitingFor: {type: 'or'}});
    const t1 = turnWithVisual(1, {spaceId: '03', temperature: [-30, -28], mc: [0, 5]});
    const t2 = turnWithVisual(2, {spaceId: '05', temperature: [-28, -26], mc: [5, 10]});
    const latest = makeView({
      turns: [t1, t2],
      temperature: -26, botMc: 10,
      tiles: {'03': TileType.CITY, '05': TileType.CITY},
      waitingFor: {type: 'card'}, // the prompt raised AFTER the batch
    });

    const staged = presentFreshBotTurns(presented, latest, {commitLatest});
    expect(staged).eq(true);
    expect(committed, 'the latest snapshot must NOT commit on arrival').eq(0);
    expect(isBotStagingActive()).eq(true);
    // The presented board shows NOTHING of the batch yet…
    expect(spaceOf(presented, '03').tileType).is.undefined;
    expect(presented.game.temperature).eq(-30);
    expect(botMcOf(presented)).eq(0);
    // …and the stale prompt is cleared (no acting on a stale runId).
    expect(presented.waitingFor).is.undefined;

    // Card 1 is DELIVERED (visible) → ONLY turn 1's footprint applies.
    await nextTick();
    expect(notificationState.transient.map((n) => n.id)).deep.eq(['bot:red:1:1']);
    expect(spaceOf(presented, '03').tileType).eq(TileType.CITY);
    expect(spaceOf(presented, '05').tileType, 'turn 2 must stay invisible').is.undefined;
    expect(presented.game.temperature).eq(-28);
    expect(botMcOf(presented)).eq(5);
    expect(committed).eq(0);
    expect(botStagingState.pendingCount).eq(1);
  });

  it('closing card 1 delivers card 2 — the LAST turn performs the full authoritative commit', async () => {
    const presented = makeView();
    const t1 = turnWithVisual(1, {spaceId: '03', temperature: [-30, -28]});
    const t2 = turnWithVisual(2, {spaceId: '05', temperature: [-28, -26]});
    const latest = makeView({turns: [t1, t2], temperature: -26, tiles: {'03': TileType.CITY, '05': TileType.CITY}});

    presentFreshBotTurns(presented, latest, {commitLatest});
    await nextTick(); // card 1 delivered → turn 1 applied

    dismiss('bot:red:1:1'); // B / auto-timeout — advance the queue
    await nextTick(); // card 2 delivered → the LAST pending turn → full commit
    expect(committed).eq(1);
    expect(isBotStagingActive()).eq(false);
  });

  it('a SINGLE fresh turn does NOT stage — the caller commits on the spot', async () => {
    /*
     * This spec used to assert the opposite («commits on its own card
     * delivery, human latency unchanged») and that assumption was the bug: the
     * delivery it waited for sits behind the feed's silencing gates, so the
     * player's own next prompt was withheld for as long as their action
     * cinematic ran — the reported «MarsBot думает ~5 секунд». One turn has
     * nothing to sequence, so nothing is buffered.
     */
    const presented = makeView();
    const latest = makeView({
      turns: [turnWithVisual(1, {spaceId: '03'})],
      tiles: {'03': TileType.CITY},
      waitingFor: {type: 'or'}, // control is back with the player
    });
    expect(presentFreshBotTurns(presented, latest, {commitLatest})).eq(false);
    expect(isBotStagingActive()).eq(false);
    // The card is still enqueued — the toast waits its turn, the GAME does not.
    expect([...notificationState.transient, ...notificationState.queue].map((n) => n.id)).deep.eq(['bot:red:1:1']);
    await nextTick();
    expect(isBotStagingActive()).eq(false);
  });

  it('no fresh turns + no window → false (human actions commit immediately)', () => {
    expect(presentFreshBotTurns(PREV, makeView(), {commitLatest})).eq(false);
    expect(committed).eq(0);
  });

  it('a poll during an open window only refreshes the buffered latest — never commits under the sequence', async () => {
    const presented = makeView();
    const t1 = turnWithVisual(1, {spaceId: '03'});
    const t2 = turnWithVisual(2, {spaceId: '05'});
    const latest = makeView({turns: [t1, t2], tiles: {'03': TileType.CITY, '05': TileType.CITY}});
    presentFreshBotTurns(presented, latest, {commitLatest});
    await nextTick();

    let pollCommitted = 0;
    const rePoll = makeView({turns: [t1, t2], tiles: {'03': TileType.CITY, '05': TileType.CITY}});
    expect(presentFreshBotTurns(presented, rePoll, {commitLatest: () => pollCommitted++})).eq(true);
    expect(pollCommitted).eq(0);

    dismiss('bot:red:1:1');
    await nextTick();
    // The drain commits through the FRESHEST closure (the re-poll's).
    expect(pollCommitted).eq(1);
    expect(committed).eq(0);
  });

  it('a blocked foreground queues the CARDS, and the run still walks the board at its own tempo', async () => {
    /*
     * The cards wait behind the modal (the feed is silenced) — but the RUN does
     * not. Gating the board's advance on the cards is what held the player for
     * a measured 92 s while the bot played out a round; a modal covers the
     * board anyway, so pausing the walk buys nobody anything and costs the
     * player their own next prompt. What must still hold is ORDER: turn 1's
     * footprint before turn 2's, and the authoritative commit last.
     */
    revealResultState.active = true; // a result modal owns the screen
    await nextTick();
    const presented = makeView();
    const t1 = turnWithVisual(1, {spaceId: '03'});
    const t2 = turnWithVisual(2, {spaceId: '05'});
    const latest = makeView({turns: [t1, t2], tiles: {'03': TileType.CITY, '05': TileType.CITY}});
    presentFreshBotTurns(presented, latest, {commitLatest});
    await nextTick();
    expect(spaceOf(presented, '03').tileType, 'no card has presented yet').is.undefined;
    expect(committed).eq(0);

    dismissReveal();
    await nextTick(); // card 1 delivered
    expect(spaceOf(presented, '03').tileType).eq(TileType.CITY);
    expect(spaceOf(presented, '05').tileType).is.undefined;
    dismiss('bot:red:1:1');
    await nextTick();
    expect(committed).eq(1);
  });

  it('re-delivering an already-presented turn is a no-op (no double application)', async () => {
    const presented = makeView();
    const t1 = turnWithVisual(1, {spaceId: '03'});
    const t2 = turnWithVisual(2, {spaceId: '05'});
    presentFreshBotTurns(presented, makeView({turns: [t1, t2], tiles: {'03': TileType.CITY, '05': TileType.CITY}}), {commitLatest});
    await nextTick();
    expect(deliverBotTurnVisual('red:1:1')).eq('none'); // already presented by the watcher
    expect(committed).eq(0);
  });

  it('self-heal: notifications disabled → the sequence cannot present → immediate authoritative commit', () => {
    notificationState.settings.enabled = false;
    try {
      const presented = makeView();
      // A BURST (the only shape that still stages) with no way to present it.
      const latest = makeView({
        turns: [turnWithVisual(1, {spaceId: '03'}), turnWithVisual(2, {spaceId: '05'})],
        tiles: {'03': TileType.CITY, '05': TileType.CITY},
      });
      expect(presentFreshBotTurns(presented, latest, {commitLatest})).eq(true);
      expect(committed).eq(1);
      expect(isBotStagingActive()).eq(false);
    } finally {
      notificationState.settings.enabled = true;
    }
  });

  it('self-heal liveness: pending cards vanished from the presentation → commit on the next poll tick', async () => {
    const presented = makeView();
    const t1 = turnWithVisual(1, {spaceId: '03'});
    const t2 = turnWithVisual(2, {spaceId: '05'});
    presentFreshBotTurns(presented, makeView({turns: [t1, t2]}), {commitLatest});
    await nextTick();
    // Both cards leave the presentation without a delivery of the last one.
    dismiss('bot:red:1:2'); // dropped straight from the queue
    dismiss('bot:red:1:1');
    await nextTick();
    ensureBotPresentationLiveness(); // NotificationLayer's poll self-heal
    expect(committed).eq(1);
    expect(isBotStagingActive()).eq(false);
  });

  describe('a CLAIM (C18 Arcadian Communities / B22 Settlers)', () => {
    /*
     * OWNER REQUIREMENT: the marker the bot claims must land with the SAME
     * premium cube drop a human Arcadian's community lands with. That drop is
     * `cubeDropState` — driven by a COLOUR-ONLY diff on a TILE-LESS cell — so
     * the staged per-turn commit has to produce exactly that diff and nothing
     * tile-shaped. These two assertions are the contract.
     */
    it('paints the owner colour WITHOUT a tile, which is what the cube framework reads', () => {
      const presented = makeView();
      const before = presented.game.spaces.map((sp) => ({...sp})) as never;

      applyTurnVisual(presented, turnWithVisual(1, {markerSpaceId: '05'}));

      const claimed = spaceOf(presented, '05');
      expect(claimed.color, 'the claim painted the bot colour').eq('red');
      expect((claimed as {tileType?: TileType}).tileType, 'a claim is not a tile').is.undefined;
      // The SHARED framework recognises it — the same predicate App.vue uses to
      // arm the drop for a human Arcadian's community.
      expect(shouldHoldForOwnerCubePlacement(before, presented.game.spaces as never),
        'the owner-cube framework sees a fresh claim').is.true;
    });

    it('a BUILD is not mistaken for a claim — it rides the tile entrance', () => {
      const presented = makeView();
      const before = presented.game.spaces.map((sp) => ({...sp})) as never;

      applyTurnVisual(presented, turnWithVisual(1, {spaceId: '03'}));

      expect(spaceOf(presented, '03').color).eq('red');
      expect(shouldHoldForOwnerCubePlacement(before, presented.game.spaces as never),
        'a build rides the TILE entrance, which drops the cube itself').is.false;
    });

    it('a claim on a cell that already has a tile is ignored (defensive)', () => {
      const presented = makeView({tiles: {'05': TileType.CITY}});
      applyTurnVisual(presented, turnWithVisual(1, {markerSpaceId: '05'}));
      expect(spaceOf(presented, '05').color, 'the tile already owns the cell').eq('red');
    });
  });

  describe('personal feed mode («Только связанные со мной»)', () => {
    let originalFetch: typeof global.fetch;
    let ackUrls: Array<string>;

    beforeEach(() => {
      setNotificationViewer('blue' as Color);
      setNotificationFeedMode('personal');
      originalFetch = global.fetch;
      ackUrls = [];
      global.fetch = ((url: string) => {
        ackUrls.push(String(url));
        return Promise.resolve({ok: true} as Response);
      }) as typeof fetch;
      setBotAckViewer('viewer-1');
    });

    afterEach(() => {
      global.fetch = originalFetch;
      resetBotTurnAckForTesting();
      setNotificationFeedMode('all');
      setNotificationViewer(undefined);
    });

    it('a fully-ambient batch cannot present → immediate commit, applied exactly once, every turn acked', () => {
      const presented = makeView({waitingFor: {type: 'or'}});
      const latest = makeView({
        turns: [turnWithVisual(1, {spaceId: '03'}), turnWithVisual(2, {spaceId: '05'})],
        tiles: {'03': TileType.CITY, '05': TileType.CITY},
        waitingFor: {type: 'card'},
      });
      expect(presentFreshBotTurns(presented, latest, {commitLatest})).eq(true);
      // Nothing to show and nothing to animate → the queue continues at once:
      // the full authoritative commit lands synchronously, exactly once, and
      // no toast exists to start a five-second auto-close wait.
      expect(committed).eq(1);
      expect(isBotStagingActive()).eq(false);
      expect(notificationState.transient.length + notificationState.queue.length).eq(0);
      // The turns are soft-acked (no card will ever finish to ack them).
      expect(ackUrls.filter((u) => u.includes('key=red%3A1%3A1'))).to.have.length(1);
      expect(ackUrls.filter((u) => u.includes('key=red%3A1%3A2'))).to.have.length(1);
    });

    it('a partial batch keeps strict FIFO: filtered leaders apply at the front, the tail waits for the shown card', async () => {
      const presented = makeView();
      const t1 = turnWithVisual(1, {spaceId: '03', temperature: [-30, -28]});
      const t2 = turnWithVisual(2, {spaceId: '05', temperature: [-28, -26], attackBlue: true});
      const t3 = turnWithVisual(3, {spaceId: '08', temperature: [-26, -24]});
      const latest = makeView({
        turns: [t1, t2, t3], temperature: -24,
        tiles: {'03': TileType.CITY, '05': TileType.CITY, '08': TileType.CITY},
      });
      presentFreshBotTurns(presented, latest, {commitLatest});
      // Turn 1 (ambient, no card) sits at the FRONT — its footprint applies
      // immediately; turn 2 (the attack on the viewer) HAS a card, so the walk
      // stops there: nothing later may appear yet.
      expect(spaceOf(presented, '03').tileType).eq(TileType.CITY);
      expect(presented.game.temperature).eq(-28);
      expect(spaceOf(presented, '05').tileType).is.undefined;
      expect(spaceOf(presented, '08').tileType).is.undefined;
      expect(committed).eq(0);

      await nextTick(); // the viewer-involving card is DELIVERED (visible)
      expect(notificationState.transient.map((n) => n.id)).deep.eq(['bot:red:1:2']);
      expect(spaceOf(presented, '05').tileType).eq(TileType.CITY);
      expect(presented.game.temperature).eq(-26);
      expect(spaceOf(presented, '08').tileType, 'turn 3 must wait behind the shown card').is.undefined;
      expect(committed).eq(0);

      dismiss('bot:red:1:2'); // the player closed the attack card
      await nextTick();
      // The filtered tail commits exactly once, in its own position.
      expect(committed).eq(1);
      expect(isBotStagingActive()).eq(false);
    });

    it('switching to personal mid-queue acks the dropped bot cards and drains the timeline in order', async () => {
      setNotificationFeedMode('all');
      const presented = makeView();
      const t1 = turnWithVisual(1, {spaceId: '03'});
      const t2 = turnWithVisual(2, {spaceId: '05'});
      presentFreshBotTurns(presented, makeView({
        turns: [t1, t2], tiles: {'03': TileType.CITY, '05': TileType.CITY},
      }), {commitLatest});
      await nextTick(); // card 1 visible + delivered; card 2 queued
      expect(spaceOf(presented, '03').tileType).eq(TileType.CITY);
      expect(committed).eq(0);

      setNotificationFeedMode('personal');
      await nextTick();
      await nextTick(); // mode reconcile → queue change → liveness walk
      // The queued ambient card is gone, acked, and its turn committed the
      // buffer; the visible card finishes its own lifecycle untouched.
      expect(notificationState.queue).to.have.length(0);
      expect(notificationState.transient.map((n) => n.id)).deep.eq(['bot:red:1:1']);
      expect(committed).eq(1);
      expect(isBotStagingActive()).eq(false);
      expect(ackUrls.filter((u) => u.includes('key=red%3A1%3A2'))).to.have.length(1);
    });
  });
});
