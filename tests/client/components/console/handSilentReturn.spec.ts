import {expect} from 'chai';
import {
  handBodiesState, setHandBodiesOracle, setHandBodyMode, HandBodiesOracle,
} from '@/client/console/handDock/handBodies';
import {handRevealState} from '@/client/console/handDock/handRevealState';
import {
  holdHandBodiesForAlbum, resetHandReveal, settleHandHome,
} from '@/client/console/handDock/handRevealDirector';

/*
 * THE RETURN THAT NEVER FLIES — «карты летят непонятно откуда рывком в док».
 *
 * A gather is a flight FROM WHERE THE PLAYER LAST SAW THE CARDS, so it is only
 * ever honest while the album is on screen (B out of it, «свернуть» from it).
 * A PLAY does not end there: its descent parks the shelf the moment the
 * composer opens, and the cards are not on screen again. Returning them with a
 * flight measured off that parked grid is what shipped — the pack's bodies
 * materialized over the board a beat AFTER the workspace had dissolved and
 * darted into the tray from nowhere.
 *
 * The contract this file guards is therefore one sentence: on every
 * non-choreographed path, a body that was AWAY FROM THE PACK comes home by
 * being SEATED (`resettle` — one write, zero travel), never by being tweened
 * (`reconcile` — right for a pose change of a few px, catastrophic for an
 * album→dock delta). The oracle is a spy: under test is which verb is used.
 */

type Calls = {reconcile: number, resettle: Array<ReadonlyArray<string>>, shelved: Array<string>};

function spyOracle(names: ReadonlyArray<string>): Calls {
  const calls: Calls = {reconcile: 0, resettle: [], shelved: []};
  const oracle: HandBodiesOracle = {
    poseFor: () => undefined,
    poseForCopy: () => undefined,
    reconcile: () => {
      calls.reconcile++;
    },
    seatNew: () => undefined,
    resettle: (n) => {
      calls.resettle.push([...n]);
    },
    names: () => names,
  };
  setHandBodiesOracle(oracle);
  return calls;
}

/** The state an OPEN album leaves behind: page cards shelved, the rest parked
 *  as page packets, the layer clipped to the stage window. */
function openAlbum(page: ReadonlyArray<string>, packets: ReadonlyArray<string>): void {
  handRevealState.phase = 'open';
  handRevealState.stageClip = {left: 100, right: 900};
  page.forEach((n) => setHandBodyMode(n, 'shelf'));
  packets.forEach((n) => setHandBodyMode(n, 'packet'));
}

describe('the hand comes home WITHOUT a flight', () => {
  afterEach(() => {
    setHandBodiesOracle(undefined);
    handBodiesState.modes = {};
    handBodiesState.flying = [];
    handRevealState.phase = 'docked';
    handRevealState.holdSlots = false;
    handRevealState.stageClip = undefined;
  });

  it('settleHandHome SEATS every body that was away from the pack', () => {
    const calls = spyOracle(['a', 'b', 'c']);
    openAlbum(['a', 'b'], ['c']);

    expect(settleHandHome()).to.eq(true);

    expect(calls.reconcile).to.eq(0); // the tween is the defect
    expect(calls.resettle).to.have.length(1);
    expect([...calls.resettle[0]].sort()).to.deep.eq(['a', 'b', 'c']);
    // …and the album's presentation is gone with it: no held slots, no stage
    // window keeping the packets erased over a board that is coming back.
    expect(handRevealState.phase).to.eq('docked');
    expect(handRevealState.holdSlots).to.eq(false);
    expect(handRevealState.stageClip).to.eq(undefined);
    expect(handBodiesState.modes).to.deep.eq({});
  });

  it('is idempotent — a pack already home is not re-seated', () => {
    const calls = spyOracle(['a']);

    expect(settleHandHome()).to.eq(false);
    expect(calls.resettle).to.have.length(0);
    expect(calls.reconcile).to.eq(0);
  });

  it('leaves behind the cards a cinematic is carrying the other way', () => {
    const calls = spyOracle(['a', 'b']);
    openAlbum(['a', 'b'], []);

    settleHandHome(new Set(['b'])); // 'b' is mid-discard on its own layer

    expect(calls.resettle[0]).to.deep.eq(['a']);
    // …and it stays SHELVED (invisible) rather than being docked into a pack
    // it is on its way out of — the close episode's own exclusion contract.
    expect(handBodiesState.modes).to.deep.eq({b: 'shelf'});
  });

  it('resetHandReveal seats the returners too — it never plays a flight', () => {
    const calls = spyOracle(['a', 'b']);
    openAlbum(['a'], ['b']);

    resetHandReveal();

    expect(calls.reconcile).to.eq(0);
    expect([...calls.resettle[0]].sort()).to.deep.eq(['a', 'b']);
    expect(handRevealState.phase).to.eq('docked');
  });

  it('…but a pack that never left keeps the soft pose heal', () => {
    const calls = spyOracle(['a', 'b']);

    resetHandReveal();

    expect(calls.resettle).to.have.length(0);
    expect(calls.reconcile).to.eq(1);
  });

  it('holdHandBodiesForAlbum hands the cards back to the shelf, silently', () => {
    spyOracle(['a', 'b']);
    settleHandHome(); // nothing to do — but the mirror must still be safe
    handRevealState.phase = 'docked';

    holdHandBodiesForAlbum();

    expect(handRevealState.phase).to.eq('open');
    expect(handRevealState.holdSlots).to.eq(false); // the slots render the cards
    expect(handBodiesState.modes).to.deep.eq({a: 'shelf', b: 'shelf'});
  });

  it('the mirror never fires over an album that is already showing', () => {
    spyOracle(['a']);
    openAlbum(['a'], []);

    holdHandBodiesForAlbum();

    expect(handBodiesState.modes).to.deep.eq({a: 'shelf'}); // untouched
    expect(handRevealState.stageClip).to.not.eq(undefined); // no state clobbered
  });
});
