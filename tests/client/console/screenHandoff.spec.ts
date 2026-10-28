import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {
  PARLIAMENT_DOOR_REASONS, SCREEN_HANDOFF_MAX_MS, screenHandoffOwed, screenHandoffReasons, waitScreenHandoff,
} from '@/client/console/screenHandoff';
import {beginAnimationHold, resetAnimationHoldsForTest} from '@/client/components/presentation/animationHold';
import {drawnCardsState} from '@/client/components/drawnCards/drawnCardsState';
import {handDeliveryState} from '@/client/console/handDock/handDeliveryState';
import {remotePlacementState} from '@/client/console/tilePlacement/consoleRemotePlacement';
import {presentationLedgerSnapshot, resetPresentationLedger} from '@/client/console/presentationLedger';

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
}

describe('screenHandoff — what the player is still owed before the next screen', () => {
  beforeEach(reset);
  afterEach(reset);

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

    remotePlacementState.queued = 1;
    expect(screenHandoffReasons()).to.deep.eq(['remote-landing']);
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
    remotePlacementState.queued = 1;
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
