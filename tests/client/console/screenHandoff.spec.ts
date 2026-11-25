import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {
  PARLIAMENT_DOOR_REASONS, SCREEN_HANDOFF_MAX_MS, screenHandoffOwed, screenHandoffReasons, waitScreenHandoff,
} from '@/client/console/screenHandoff';
import {beginAnimationHold, resetAnimationHoldsForTest} from '@/client/components/presentation/animationHold';
import {drawnCardsState} from '@/client/components/drawnCards/drawnCardsState';
import {handDeliveryState} from '@/client/console/handDock/handDeliveryState';
import {abortRemotePlacements, remoteLandingOwed, remotePlacementState, stageRemotePlacements} from '@/client/console/tilePlacement/consoleRemotePlacement';
import {clearRemoteRevealHolds, isRemoteRevealHeld} from '@/client/console/tilePlacement/remoteRevealHold';
import {enterWorkspace, resetWorkspaceStack} from '@/client/console/consoleWorkspaceStack';
import {SpaceModel} from '@/common/models/SpaceModel';
import {TileType} from '@/common/TileType';
import {presentationLedgerSnapshot, resetPresentationLedger} from '@/client/console/presentationLedger';
import {PARLIAMENT_DOOR} from '@/client/console/parliament/parliamentDoorHandoff';
import {openRulingChangePark, resetRulingChangeDraw} from '@/client/console/parliament/rulingChangeDraw';
import {noteDeferredGenerationFlipEnd, oweDeferredGenerationFlip, resetDeferredGenerationFlip} from '@/client/console/generationScene/deferredGenerationFlip';
import {AgendaBonusOwed, parliamentRewardState, resetParliamentRewards} from '@/client/console/parliament/parliamentRewardBeat';

/*
 * THE SCREEN HANDOFF (state delivery, 2026-10-28): ONE question every automatic screen-taking transition asks — what
 * is the player still OWED on this screen? — answered from the live presentation facts, waited out bounded and named.
 */
function reset(): void {
  resetAnimationHoldsForTest();
  drawnCardsState.events = [];
  handDeliveryState.inFlight = [];
  handDeliveryState.flights = [];
  remotePlacementState.queued = 0;
  remotePlacementState.active = false;
  remotePlacementState.waitingForBoard = false;
  resetPresentationLedger();
  resetDeferredGenerationFlip();
}

describe('screenHandoff — what the player is still owed before the next screen', () => {
  beforeEach(reset);
  afterEach(reset);

  it('the counter’s DEFERRED flip is a named debt until the strip says it ended (P89 · EA)', () => {
    oweDeferredGenerationFlip(4);
    expect(screenHandoffReasons()).to.deep.eq(['generation-flip']);
    noteDeferredGenerationFlipEnd(3);
    expect(screenHandoffOwed(), 'a flip to an older generation settles nothing').is.true;
    noteDeferredGenerationFlipEnd(4);
    expect(screenHandoffOwed()).is.false;
  });

  it('a quiet screen is handed over at once', async () => {
    expect(screenHandoffReasons()).to.deep.eq([]);
    expect(screenHandoffOwed()).is.false;
    expect(await waitScreenHandoff('spec')).eq('quiet');
  });

  it('names every reason: a card on its way into the dock, a reveal not taken, a foreign tile owed, a hold', () => {
    handDeliveryState.inFlight = [CardName.ALGAE];
    expect(screenHandoffReasons()).to.deep.eq(['card-arrival']);
    handDeliveryState.inFlight = [];

    drawnCardsState.events = [{
      id: 'r1', actionId: 1, source: {type: 'card', cardName: CardName.ALGAE}, segments: [], sealed: false,
      cards: [{name: CardName.ALGAE}], takenIndices: new Set(), dismissed: false,
    } as unknown as typeof drawnCardsState.events[number]];
    expect(screenHandoffReasons()).to.deep.eq(['reveal']);
    drawnCardsState.events = [];

    // A foreign tile PARKED for a board the player cannot see: owed to the board, holding nothing (the wait is no scene).
    remotePlacementState.queued = 1;
    remotePlacementState.waitingForBoard = true;
    expect(screenHandoffReasons()).to.deep.eq(['remote-landing']);
    // …the same tile ON STAGE: it is also the board's scene and holds the presentation (its supplier, reactive since
    // 2026-10-30 — the plain-array read named this only on the 1 s sweep), so each reader names it in its own term.
    remotePlacementState.waitingForBoard = false;
    expect(screenHandoffReasons()).to.deep.eq(['board-story', 'remote-landing', 'animation']);
    remotePlacementState.queued = 0;

    const hold = beginAnimationHold('spec-scene', {scope: 'notification-only'});
    expect(screenHandoffReasons(), 'every scope counts — a notification-only hold runs inside a surface the next screen would tear down')
      .to.deep.eq(['animation']);
    expect(screenHandoffReasons({ignoreHolds: ['spec-scene']}), 'a caller ignores its OWN hold').to.deep.eq([]);
    hold.release();
  });

  /*
   * A DOOR INTO THE SITTING NEVER WAITS FOR THE BOARD'S STORIES (the field lock of 2026-10-28): a foreign landing
   * parked for the board waits for the sitting to STAND (`boardCovered` ⊃ `sittingRiseOwed`), the sitting's own reward
   * holds are seeded for the beat the standing section plays — a door that waited for either waited for itself.
   */
  it('`only` / `ignoreReasons`: the Parliament door waits for the player own owed objects, never the board stories or the holds', () => {
    // A landing PARKED for the board (the door's deadlock shape: it waits for the sitting to stand).
    remotePlacementState.queued = 1;
    remotePlacementState.waitingForBoard = true;
    const hold = beginAnimationHold('parliament-reward-owed');
    handDeliveryState.inFlight = [CardName.ALGAE];
    expect(screenHandoffReasons()).to.deep.eq(['remote-landing', 'card-arrival', 'animation']);
    expect(screenHandoffReasons({only: PARLIAMENT_DOOR_REASONS}), 'the door: the card on its way only').to.deep.eq(['card-arrival']);
    expect(screenHandoffReasons({ignoreReasons: ['animation']}), 'the yielded return: never the holds').to.deep.eq(['remote-landing', 'card-arrival']);
    handDeliveryState.inFlight = [];
    expect(screenHandoffOwed({only: PARLIAMENT_DOOR_REASONS}), 'a parked landing + a seeded hold owe the door nothing').is.false;
    hold.release();
  });

  it('waits for the owed story and resolves QUIET the moment it is paid', async () => {
    handDeliveryState.inFlight = [CardName.ALGAE];
    let outcome: string | undefined;
    const wait = waitScreenHandoff('spec-wait').then((o) => {
      outcome = o;
    });
    await new Promise((r) => setTimeout(r, 60));
    expect(outcome, 'still waiting while the card flies').is.undefined;
    expect(presentationLedgerSnapshot().stories.some((s) => s.id === 'screen-handoff:spec-wait'), 'the wait is a ledger story').is.true;
    handDeliveryState.inFlight = [];
    await wait;
    expect(outcome).eq('quiet');
    expect(presentationLedgerSnapshot().stories.some((s) => s.id === 'screen-handoff:spec-wait'), 'settled').is.false;
  });

  /*
   * A REVEAL THE SITTING PARKED FOR ITS OWN BEAT IS NEVER OWED AT ITS DOOR (the 2026-10-30 deadlocks): Tharsis Alliance's
   * enactment card (a `ruling-change` batch, parked until the enactment tact) held the door 30 s and then fell out as a
   * standalone reveal; a walked Agenda card step held it to the 45 s ceiling. Every other handoff still waits for them.
   */
  it('PARLIAMENT_DOOR: a batch the sitting PARKED for its own beat does not hold the door — every other handoff still waits for it', () => {
    const batch = (id: string, source: object) => ({
      id, actionId: 1, source, segments: [{source, count: 1}], sealed: false,
      cards: [{name: CardName.ALGAE}], takenIndices: new Set(), dismissed: false,
    } as unknown as typeof drawnCardsState.events[number]);

    drawnCardsState.events = [batch('rc', {type: 'ruling-change'})];
    openRulingChangePark('sitting-1');
    expect(screenHandoffReasons(PARLIAMENT_DOOR), 'the enactment card is the sitting\'s to tell').to.deep.eq([]);
    expect(screenHandoffReasons(), 'the finale / the draft still wait for it').to.deep.eq(['reveal']);
    resetRulingChangeDraw();
    expect(screenHandoffReasons(PARLIAMENT_DOOR), 'once the park is closed it is an ordinary batch the player owes').to.deep.eq(['reveal']);

    drawnCardsState.events = [batch('ag', {type: 'agenda', step: 7})];
    parliamentRewardState.agendaBonuses = [{generation: 1, player: 'blue', step: 7, kind: 'card'} as AgendaBonusOwed];
    expect(screenHandoffReasons(PARLIAMENT_DOOR), 'the walked card step is the sitting\'s to lift').to.deep.eq([]);
    // (…and for the owed bonus's own hold, `parliament-agenda-bonus-owed` — the door leaves holds to the sitting.)
    expect(screenHandoffReasons(), 'the finale still waits for it').to.include('reveal');
    resetParliamentRewards();

    drawnCardsState.events = [batch('own', {type: 'card', cardName: CardName.ALGAE})];
    expect(screenHandoffReasons(PARLIAMENT_DOOR), 'a card the player has not taken still holds the door').to.deep.eq(['reveal']);
  });

  /*
   * THE LANDING LAW (2026-11-25): a tile of another seat that waits behind the player's own screen has no clock — and
   * a transition that takes that screen does not wait for it either. It HANDS IT OVER: the tile shows without its
   * flight now, and the transition waits the queue's own tick, never the landing's twenty seconds.
   */
  describe('a landing behind the screen of the player is handed over, never waited for', function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(10_000);
    const cell = (id: string, over: Partial<SpaceModel> = {}): SpaceModel => ({id, x: 0, y: 0, spaceType: 'land', bonus: [], ...over}) as unknown as SpaceModel;
    const parked = async (): Promise<void> => {
      for (let i = 0; i < 400 && !remotePlacementState.waitingForBoard; i++) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      expect(remotePlacementState.waitingForBoard, 'the landing parked behind the workspace').is.true;
    };
    afterEach(() => {
      resetWorkspaceStack();
      abortRemotePlacements();
      clearRemoteRevealHolds();
    });

    it('the generation scene, the draft, the finale: QUIET in a tick, the tile on the board, nothing said', async () => {
      const warns: Array<string> = [];
      const warn = console.warn;
      console.warn = (...args: Array<unknown>) => warns.push(args.map(String).join(' '));
      try {
        enterWorkspace('hand');
        stageRemotePlacements([cell('51')], [cell('51', {tileType: TileType.GREENERY, color: 'blue'})], {gamePhase: 'action'});
        await parked();
        expect(screenHandoffReasons()).to.deep.eq(['remote-landing']);
        const started = Date.now();
        expect(await waitScreenHandoff('spec:generation')).eq('quiet');
        expect(Date.now() - started, 'a tick of the queue — never the old twenty seconds').to.be.lessThan(5_000);
        expect(isRemoteRevealHeld('51'), 'the tile shows').is.false;
        expect(remoteLandingOwed()).is.false;
        expect(warns.filter((line) => line.includes('[wait-graph] ceiling') || line.includes('[screen-handoff]')), 'no net fired').to.deep.eq([]);
      } finally {
        console.warn = warn;
      }
    });

    it('a door that does not wait for landings does not hand them over — the sitting tells them itself', async () => {
      enterWorkspace('hand');
      stageRemotePlacements([cell('52')], [cell('52', {tileType: TileType.GREENERY, color: 'blue'})], {gamePhase: 'action'});
      await parked();
      expect(await waitScreenHandoff('spec:door', PARLIAMENT_DOOR)).eq('quiet');
      expect(isRemoteRevealHeld('52'), 'the tile is still held for its flight').is.true;
      expect(remotePlacementState.waitingForBoard).is.true;
    });
  });

  it('a superseded transition resolves DEAD and never opens; the ceiling resolves DEGRADED, named', async () => {
    remotePlacementState.queued = 1;
    let alive = true;
    const dead = waitScreenHandoff('spec-dead', {alive: () => alive});
    alive = false;
    expect(await dead).eq('dead');

    const warned: Array<string> = [];
    const original = console.warn;
    console.warn = (msg: string) => {
      warned.push(String(msg));
    };
    try {
      expect(await waitScreenHandoff('spec-cap', {maxMs: 0})).eq('degraded');
    } finally {
      console.warn = original;
    }
    expect(warned.some((w) => w.includes('spec-cap') && w.includes('remote-landing')), warned.join('\n')).is.true;
    expect(SCREEN_HANDOFF_MAX_MS).to.be.greaterThan(30_000); // above the park's own 30 s safety
  });
});
