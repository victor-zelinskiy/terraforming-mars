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
  deliverBotTurnVisual,
  isBotStagingActive,
  resetBotStaging,
} from '@/client/components/marsbot/marsBotStagedCommits';
import {resetMarsBotArchive} from '@/client/components/marsbot/marsBotTurnArchive';
import {closeBotTurnReview, resetBotTurnReview} from '@/client/components/marsbot/botTurnReviewState';
import {notificationState, resetNotifications, dismiss} from '@/client/components/notifications/notificationState';
import {resetPresentationLeases} from '@/client/components/presentation/presentationFlow';
import {revealResultState, dismissReveal} from '@/client/components/actions/revealResultState';
import {drawnCardsState} from '@/client/components/drawnCards/drawnCardsState';

/**
 * STAGED VISUAL COMMITS — the FIFO visual timeline of bot turns.
 * The player must never see the consequences of turn N before turn N's own
 * compact notification, and after the drain the presented state must equal
 * the latest authoritative state.
 */

function turnWithVisual(id: number, opts: {spaceId?: string, temperature?: [number, number], mc?: [number, number]} = {}): MarsBotTurn {
  return {
    id,
    generation: 1,
    visual: {
      ...(opts.spaceId !== undefined ? {tiles: [{spaceId: opts.spaceId as never, tileType: TileType.CITY, color: 'red' as Color}]} : {}),
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

  it('a SINGLE fresh turn commits on its own card delivery (human latency unchanged)', async () => {
    const presented = makeView();
    const latest = makeView({turns: [turnWithVisual(1, {spaceId: '03'})], tiles: {'03': TileType.CITY}});
    expect(presentFreshBotTurns(presented, latest, {commitLatest})).eq(true);
    expect(committed).eq(0);
    await nextTick();
    expect(committed).eq(1);
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

  it('a blocked foreground queues the cards — nothing applies until they present, then strict FIFO', async () => {
    revealResultState.active = true; // a result modal owns the screen
    await nextTick();
    const presented = makeView();
    const t1 = turnWithVisual(1, {spaceId: '03'});
    const t2 = turnWithVisual(2, {spaceId: '05'});
    const latest = makeView({turns: [t1, t2], tiles: {'03': TileType.CITY, '05': TileType.CITY}});
    presentFreshBotTurns(presented, latest, {commitLatest});
    await nextTick();
    expect(spaceOf(presented, '03').tileType, 'nothing presents behind the modal').is.undefined;
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
      const latest = makeView({turns: [turnWithVisual(1, {spaceId: '03'})], tiles: {'03': TileType.CITY}});
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
});
