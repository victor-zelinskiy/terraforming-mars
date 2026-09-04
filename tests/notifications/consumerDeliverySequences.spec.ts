import {expect} from 'chai';
import {testGame} from '../TestGame';
import {cast} from '../../src/common/utils/utils';
import {Payment} from '../../src/common/inputs/Payment';
import {Color} from '../../src/common/Color';
import {CardName} from '../../src/common/cards/CardName';
import {TileType} from '../../src/common/TileType';
import {Server} from '../../src/server/models/ServerModel';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {ResearchOutpost} from '../../src/server/cards/base/ResearchOutpost';
import {RoverConstruction} from '../../src/server/cards/base/RoverConstruction';
import {TharsisRepublic} from '../../src/server/cards/corporation/TharsisRepublic';
import {replayBatch, drainBatchTail} from '../../src/server/inputs/deferredInputBatch';
import {notificationState, PREPARING_MAX_MS} from '../../src/client/components/notifications/notificationState';
import {resetDeliveryLedgersForTesting} from '../../src/client/components/notifications/notificationDeliveryLedger';

/**
 * CONSUMER DELIVERY SEQUENCES — the other half of the cross-player delivery
 * contract, and the half every previous audit stopped short of.
 *
 * The corpus specs (crossPlayerDeliveryAudit) prove the SERVER records the
 * event and `diffRootNotifications` builds the right model from the final
 * streams. But the live console never sees "the final streams" as one atomic
 * payload: the NotificationLayer ingests a SEQUENCE of fetched diffs, each
 * paired with whatever `playerView` the transport has applied by then — and
 * the poller's stream fetch legitimately RACES the transport's view apply.
 * The 2026-09-03 Research Outpost report lived entirely in that seam: the
 * server half was provably green while the viewer's console never presented
 * the band.
 *
 * Every scenario here drives the REAL game through the REAL doors
 * (takeAction → replayBatch → process/drainBatchTail — byte-identical to the
 * console submit routes), captures REAL `Server.getPlayerModel` snapshots and
 * REAL route payloads at each moment in time, and feeds them to the REAL
 * ingest module (`applyNotificationDiff` — the code NotificationLayer runs).
 * Nothing in the delivery path is mocked or re-implemented.
 */

import {consumerSnapshot as snapshot, ingest, presented, freshConsumer, logsPayload} from './consumerHarness';

/** The full recipient-semantics battery for the ONE delivered Tharsis band. */
function assertTharsisBand(rootId: number, ownerColor: Color, actorColor: Color): void {
  const bands = presented().filter((m) => m.correlationId === rootId);
  expect(bands.length,
    `exactly ONE notification for the builder's action reached the owner's consumer ` +
    `(transient: ${notificationState.transient.map((m) => m.id).join(',') || 'none'}; ` +
    `queue: ${notificationState.queue.map((m) => m.id).join(',') || 'none'}; ` +
    `preparing: ${[...notificationState.preparing.keys()].join(',') || 'none'})`).eq(1);
  const band = bands[0];
  expect(band.sign, 'the owner reads it as a personal gain').eq('positive');
  expect(band.actor, 'the actor is the builder').eq(actorColor);
  expect(band.affects, 'the owner is in the structured affects list').contains(ownerColor);
  expect(band.viewerImpact?.gains, 'the delta is exactly +1 M€ production').deep.eq(
    [{icon: 'megacredits', text: '+1', production: true}]);
  expect(band.viewerImpact?.losses ?? []).deep.eq([]);
  const cause = band.viewerImpact?.causes[0];
  expect(cause?.origin, 'the «почему» names the owner\'s Tharsis Republic').deep.include({card: CardName.THARSIS_REPUBLIC});
  expect(cause?.own, 'the corp is the VIEWER\'s own').eq(true);
  expect(cause?.trigger).eq('tile-placed');
  expect(cause?.triggerTile).eq(TileType.CITY);
  // No hostile twin, no duplicate in any channel.
  expect(presented().filter((m) => m.kind === 'negative').length).eq(0);
}

describe('consumer delivery sequences (real ingest across real update boundaries)', () => {
  afterEach(() => {
    freshConsumer();
    resetDeliveryLedgersForTesting();
  });

  /**
   * The reported production scenario, end to end: player B plays
   * «Исследовательская станция» (Research Outpost, base #020) through the real
   * console door; the city placement rides the real deferred SelectSpace; the
   * owner's Tharsis Republic hook defers the +1 M€ production. Returns the
   * game plus the captured moments.
   */
  function researchOutpostScenario() {
    const [game, actorB, ownerA] = testGame(2);
    ownerA.playedCards.push(new TharsisRepublic());
    ownerA.production.override({megacredits: 0});

    const outpost = new ResearchOutpost();
    actorB.cardsInHand = [outpost];
    actorB.megaCredits = 30;

    // The owner's console session is live from before the play.
    const preplay = snapshot(game, ownerA);

    actorB.takeAction();
    const menu = cast(actorB.getWaitingFor(), OrOptions);
    const idx = menu.options.findIndex((o) => o.title === 'Play project card');
    expect(idx, 'the play-project-card option exists').greaterThan(-1);
    // The REAL console play door (submitBatch → replayBatch).
    replayBatch(actorB, [{
      type: 'or',
      index: idx,
      response: {type: 'projectCard', card: outpost.name, payment: Payment.of({megacredits: actorB.getCardCost(outpost)})},
    }]);

    const rootId = game.events.events.find((e) =>
      e.type === 'action' && e.source !== undefined && 'card' in e.source && e.source.card === CardName.RESEARCH_OUTPOST)?.correlationId;
    expect(rootId, 'the play rooted an action chain').is.not.undefined;

    // B is now choosing the isolated cell — the owner's client observes this
    // OPEN moment (view + streams agree: the chain is open).
    const midPrompt = snapshot(game, ownerA);
    expect(midPrompt.view.game.openEventCorrelations, 'the pending placement keeps the chain open').contains(rootId);

    // B commits the cell through the REAL single-input route (process +
    // drainBatchTail — exactly ApiPlayerInput).
    const placement = cast(actorB.getWaitingFor(), SelectSpace);
    actorB.process({type: 'space', spaceId: placement.spaces[0].id});
    drainBatchTail(actorB);

    // The mutation is real: city placed, the owner's production rose by 1.
    expect(game.board.spaces.some((s) => s.tile?.tileType === TileType.CITY && s.player?.id === actorB.id), 'the city stands').eq(true);
    expect(ownerA.production.megacredits, 'Tharsis paid exactly +1 M€ production').eq(1);

    const settled = snapshot(game, ownerA);
    expect(settled.view.game.openEventCorrelations, 'the chain closed with the placement').does.not.contain(rootId);

    return {game, actorB, ownerA, rootId: rootId!, preplay, midPrompt, settled};
  }

  it('R1 — THE PRODUCTION SEQUENCE: a stream fetch that races the view apply must not freeze the band in PREPARING', () => {
    const {actorB, ownerA, rootId, preplay, midPrompt, settled} = researchOutpostScenario();
    freshConsumer();
    let now = 1_000;

    // The owner's session has been running since before the play.
    ingest(preplay.view, preplay, now); // initial silent seed (empty streams)
    ingest(midPrompt.view, midPrompt, now += 1_000); // the play arrives; chain open → atomic gate holds
    expect(presented().filter((m) => m.correlationId === rootId).length,
      'the atomic gate holds the half-story while B picks the cell').eq(0);
    expect(notificationState.preparing.has(rootId), 'the model waits in PREPARING').eq(true);

    // ⚡ The race the live console hits on every foreign placement: the WS wake
    // fires the layer's poller, which fetches the CLOSED streams while the
    // transport has not yet applied the new playerView — fresh streams, stale
    // open-correlations.
    ingest(midPrompt.view, settled, now += 1_000);

    // A beat later the transport applies the fresh view; the streams have not
    // changed since the race pass (same lengths ⇒ same ingest signature).
    ingest(settled.view, settled, now += 1_000);

    // THE CONTRACT: the chain is closed, the streams are complete — the owner
    // must now hold exactly one complete positive band.
    assertTharsisBand(rootId, ownerA.color, actorB.color);
  });

  it('R2 — the PREPARING ceiling must be honoured even when the streams stay quiet (degraded mode: no meta open-set)', () => {
    const {rootId, preplay, midPrompt, settled} = researchOutpostScenario();
    freshConsumer();
    let now = 1_000;
    ingest(preplay.view, preplay, now);
    ingest(midPrompt.view, midPrompt, now += 1_000);
    // DEGRADED MODE: an older server without the coherent meta open-set — the
    // layer falls back to the playerView's copy, which is stale-open here, so
    // the race pass stashes a complete model.
    const degraded = {messages: settled.messages, events: settled.events};
    ingest(midPrompt.view, degraded, now += 1_000);
    expect(notificationState.preparing.has(rootId)).eq(true);

    // The game goes quiet (B is thinking); the poller keeps re-fetching the
    // SAME streams with the SAME stale view far past the bounded ceiling. A
    // held chain must never be swallowed forever.
    ingest(midPrompt.view, degraded, now += PREPARING_MAX_MS + 1_000);
    expect(presented().filter((m) => m.correlationId === rootId).length,
      'the bounded PREPARING ceiling released the band').eq(1);
  });

  it('R3 — a RECONNECT while the actor picks the cell must not swallow the payout that lands after the seed', () => {
    const {actorB, ownerA, rootId, midPrompt, settled} = researchOutpostScenario();
    freshConsumer();
    let now = 1_000;

    // The owner's console (re)connects mid-prompt: the first seed observes the
    // OPEN chain. Its already-recorded part is old news; its FUTURE impacts —
    // the Tharsis payout that has not happened yet — are not.
    ingest(midPrompt.view, midPrompt, now); // first seed
    expect(presented().length, 'the seed itself presents nothing').eq(0);

    // B places; the owner's client observes the settled state.
    ingest(settled.view, settled, now += 1_000);

    assertTharsisBand(rootId, ownerA.color, actorB.color);
  });

  it('R4 — the clean sequence (view and streams advance together) delivers exactly one band', () => {
    const {actorB, ownerA, rootId, preplay, midPrompt, settled} = researchOutpostScenario();
    freshConsumer();
    let now = 1_000;
    ingest(preplay.view, preplay, now);
    ingest(midPrompt.view, midPrompt, now += 1_000);
    ingest(settled.view, settled, now += 1_000);
    assertTharsisBand(rootId, ownerA.color, actorB.color);
    // Re-ingesting the same settled state never duplicates.
    ingest(settled.view, settled, now += 1_000);
    expect(presented().filter((m) => m.correlationId === rootId).length).eq(1);
  });

  it('R5 — the ACTOR\'s own consumer never hears the foreign corp\'s payout as its own gain', () => {
    const {game, actorB, rootId, settled} = researchOutpostScenario();
    freshConsumer();
    let now = 1_000;
    // B's own console across the same moments (B's view of the same game).
    const settledB = {view: Server.getPlayerModel(actorB), messages: logsPayload(game, actorB, settled.view.game.generation), events: settled.events};
    ingest(settledB.view, settledB, now); // first seed
    ingest(settledB.view, settledB, now += 1_000);
    expect(presented().filter((m) => m.correlationId === rootId).length,
      'the actor\'s own ordinary action never presents on their screen').eq(0);
  });

  /**
   * THE SECOND PRODUCTION REPORT (2026-09-04): player A opens the game with
   * «Rover Construction» («Создание вездехода»); player B's Tharsis Republic
   * owes its MANDATORY FIRST ACTION (place a city) and performs it on their
   * first turn. Same born-open chain topology as a card play — the chain roots
   * at the first-action pick and stays open across the SelectSpace — but a
   * DIFFERENT door (`Player.takeAction`'s pendingInitialActions branch,
   * category 'corporation-action'), which no scenario had ever driven: the
   * door census's proof string even claimed «corp actions in scope are
   * self-only today». The Rover payout (+2 M€ to A) is the counter-example.
   */
  function corpFirstActionScenario() {
    const [game, ownerA, actorB] = testGame(2);
    ownerA.megaCredits = 10;
    ownerA.playCard(new RoverConstruction()); // A's own first play (real door)

    const tharsis = new TharsisRepublic();
    actorB.playedCards.push(tharsis);
    actorB.pendingInitialActions.push(tharsis);

    const preplay = snapshot(game, ownerA);

    // B's first turn: the REAL mandatory first-action prompt.
    actorB.takeAction();
    const menu = cast(actorB.getWaitingFor(), OrOptions);
    expect(menu.startGamePrompt?.kind).eq('corporationInitialAction');
    actorB.process({type: 'or', index: 0, response: {type: 'option'}});

    const rootId = game.events.events.find((e) =>
      e.type === 'action' && e.category === 'corporation-action')?.correlationId;
    expect(rootId, 'the first action rooted a scoped chain').is.not.undefined;

    const midPrompt = snapshot(game, ownerA);
    expect(midPrompt.view.game.openEventCorrelations, 'the placement keeps the chain open').contains(rootId);

    const placement = cast(actorB.getWaitingFor(), SelectSpace);
    actorB.process({type: 'space', spaceId: placement.spaces[0].id});
    drainBatchTail(actorB);

    expect(ownerA.megaCredits, 'Rover Construction paid A exactly +2 M€').eq(12);
    const settled = snapshot(game, ownerA);
    expect(settled.view.game.openEventCorrelations).does.not.contain(rootId);
    return {game, ownerA, actorB, rootId: rootId!, preplay, midPrompt, settled};
  }

  function assertRoverBand(rootId: number, ownerColor: Color, actorColor: Color): void {
    const bands = presented().filter((m) => m.correlationId === rootId);
    expect(bands.length,
      `exactly ONE notification for the first action reached the Rover owner ` +
      `(preparing: ${[...notificationState.preparing.keys()].join(',') || 'none'})`).eq(1);
    const band = bands[0];
    expect(band.sign).eq('positive');
    expect(band.actor, 'the actor is the corp owner performing the first action').eq(actorColor);
    expect(band.affects).contains(ownerColor);
    expect(band.viewerImpact?.gains).deep.eq([{icon: 'megacredits', text: '+2'}]);
    const cause = band.viewerImpact?.causes[0];
    expect(cause?.origin, 'the «почему» names the viewer\'s own Rover Construction').deep.include({card: CardName.ROVER_CONSTRUCTION});
    expect(cause?.own).eq(true);
    expect(cause?.trigger).eq('tile-placed');
    expect(cause?.triggerTile).eq(TileType.CITY);
  }

  it('F1 — corp FIRST ACTION city (clean sequence): the Rover owner hears the +2 M€', () => {
    const {ownerA, actorB, rootId, preplay, midPrompt, settled} = corpFirstActionScenario();
    freshConsumer();
    let now = 1_000;
    ingest(preplay.view, preplay, now);
    ingest(midPrompt.view, midPrompt, now += 1_000);
    ingest(settled.view, settled, now += 1_000);
    assertRoverBand(rootId, ownerA.color, actorB.color);
  });

  it('F2 — corp FIRST ACTION city through the RACE boundary (fresh streams, stale view) still delivers', () => {
    const {ownerA, actorB, rootId, preplay, midPrompt, settled} = corpFirstActionScenario();
    freshConsumer();
    let now = 1_000;
    ingest(preplay.view, preplay, now);
    ingest(midPrompt.view, midPrompt, now += 1_000);
    ingest(midPrompt.view, settled, now += 1_000); // poller beats the transport
    ingest(settled.view, settled, now += 1_000); // same signature — must still release
    assertRoverBand(rootId, ownerA.color, actorB.color);
  });

  it('F3 — a RECONNECT while the corp owner picks the first-action cell must not swallow the Rover payout', () => {
    const {ownerA, actorB, rootId, midPrompt, settled} = corpFirstActionScenario();
    freshConsumer();
    let now = 1_000;
    ingest(midPrompt.view, midPrompt, now); // first seed observes the OPEN chain
    ingest(settled.view, settled, now += 1_000);
    assertRoverBand(rootId, ownerA.color, actorB.color);
  });

  /**
   * G — THE THREE-SOURCE COHERENCE FAMILY (the 2026-09-04 second report on a
   * FIXED build). The layer's inputs come from THREE independent moments: the
   * logs fetch, the events fetch (two concurrent HTTP requests that can land
   * on either side of a server transaction) and `openEventCorrelations` off
   * the transport's playerView. A skewed triple used to release a NEUTRAL
   * band prematurely: the chain's journal header was present, its events (or
   * the open-set entry) were not, the model froze on presentation — and the
   * gain that arrived one transaction later had no channel left (the queued-
   * upgrade net only touches the QUEUE; the standalone fallback diff is
   * loss-only). A LOSS survived that skew; a GAIN vanished.
   */
  it('G1 — logs AHEAD of events (header without chain): the band must wait, not release neutral', () => {
    const {ownerA, actorB, rootId, preplay, midPrompt, settled} = corpFirstActionScenario();
    freshConsumer();
    let now = 1_000;
    ingest(preplay.view, preplay, now);
    // The skewed fetch pair: the LOGS response was handled after B's pick
    // (the «took the first action» header is in), the EVENTS response before
    // it (no chain events, and the open-set coherent with them has no Y).
    ingest(preplay.view, {messages: midPrompt.messages, events: preplay.events, openEventCorrelations: preplay.openEventCorrelations}, now += 1_000);
    ingest(settled.view, settled, now += 1_000);
    assertRoverBand(rootId, ownerA.color, actorB.color);
  });

  it('G2 — a STALE view open-set with fresh streams must not bypass the atomic gate (the open-set rides the events read)', () => {
    const {ownerA, actorB, rootId, preplay, midPrompt, settled} = corpFirstActionScenario();
    freshConsumer();
    let now = 1_000;
    ingest(preplay.view, preplay, now);
    // The transport's view is from BEFORE the pick (its open-set has no Y),
    // while the streams are mid-prompt. The open-set that gates the release
    // must be the one captured WITH the events — never the older view's.
    ingest(preplay.view, midPrompt, now += 1_000);
    ingest(settled.view, settled, now += 1_000);
    assertRoverBand(rootId, ownerA.color, actorB.color);
  });

  it('G3 — an app RESTART after the chain closed (before the band presented) must not turn the payout into «old news»', () => {
    const {ownerA, actorB, rootId, preplay, midPrompt, settled} = corpFirstActionScenario();
    freshConsumer();
    const ledgerKey = ownerA.id;
    let now = 1_000;
    ingest(preplay.view, preplay, now, false, ledgerKey);
    ingest(midPrompt.view, midPrompt, now += 1_000, false, ledgerKey); // stashed, not yet presented
    // The device sleeps / the app restarts: all in-memory consumer state is
    // gone. The persistent delivery ledger is what must survive.
    freshConsumer();
    ingest(settled.view, settled, now += 60_000, false, ledgerKey); // first seed of the new session
    assertRoverBand(rootId, ownerA.color, actorB.color);
  });

  it('G4 — «show ordinary notifications» OFF must not silence a PERSONAL gain (losses are already exempt)', () => {
    const {ownerA, actorB, rootId, preplay, midPrompt, settled} = corpFirstActionScenario();
    freshConsumer();
    notificationState.settings.showNormal = false;
    try {
      let now = 1_000;
      ingest(preplay.view, preplay, now);
      ingest(midPrompt.view, midPrompt, now += 1_000);
      ingest(settled.view, settled, now += 1_000);
      assertRoverBand(rootId, ownerA.color, actorB.color);
    } finally {
      notificationState.settings.showNormal = true;
    }
  });
});
