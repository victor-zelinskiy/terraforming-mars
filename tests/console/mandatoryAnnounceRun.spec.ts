import {expect} from 'chai';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {dumpFlowTree} from '@/client/console/kernel/flowScope';
import {ANNOUNCE_PENDING_MAX_MS} from '@/client/console/consoleMandatoryAnnounce';
import {
  acknowledgeMandatoryBeat, forceMandatoryBeacon, isMandatoryBeaconForced, isMandatoryBeatHeld, isMandatoryBeatPresented,
  mandatoryGateState, markMandatoryBeatPresented, noteMandatoryBeatIdentity, registerAnnounceDoor, resetMandatoryGate,
} from '@/client/console/consoleMandatoryGate';

const beat = (key: string) => ({key, taskKind: 'handSelect' as const});
const runOf = (key: string) => dumpFlowTree().find((line) => line.includes(`announce:${key}#`));

/**
 * THE ANNOUNCE PLATE'S RUN (architecture v2, lifecycle 3) — one machine per beat key. The latches keep their meaning
 * (`consoleMandatoryGate.spec.ts`, client runner, pins them); what the run adds is TIME: `pending` is a beat with a
 * bound, and a beat's run ends with its identity.
 */
describe('mandatory gate · the beat\'s run', () => {
  let clock: ManualFlowClock;
  let warn: typeof console.warn;
  let warned: Array<string>;
  let doors: Array<string>;

  beforeEach(() => {
    resetMandatoryGate();
    clock = createManualClock(0);
    setFlowClock(clock);
    warned = [];
    warn = console.warn;
    console.warn = (...args: Array<unknown>) => {
      warned.push(String(args[0]));
    };
    doors = [];
    registerAnnounceDoor((key) => doors.push(key));
  });
  afterEach(() => {
    resetMandatoryGate();
    registerAnnounceDoor(undefined);
    setFlowClock(undefined);
    console.warn = warn;
  });

  it('a beat\'s identity starts its run — pending', () => {
    noteMandatoryBeatIdentity('task:discard#7');
    expect(runOf('task:discard#7')).to.contain('pending');
    expect(isMandatoryBeatHeld(beat('task:discard#7'))).to.eq(true);
    expect(isMandatoryBeatPresented(beat('task:discard#7'))).to.eq(false);
  });

  it('presented → acknowledged: the run follows the latches in the same call', () => {
    noteMandatoryBeatIdentity('draft:gen3');
    markMandatoryBeatPresented('draft:gen3');
    expect(runOf('draft:gen3')).to.contain('presented');
    acknowledgeMandatoryBeat('draft:gen3');
    expect(runOf('draft:gen3')).to.contain('acknowledged');
    expect(isMandatoryBeatHeld(beat('draft:gen3'))).to.eq(false);
    expect(clock.pending(), 'nothing is timed once the player has met it').to.eq(0);
  });

  it('A GATE STUCK PENDING IS BOUNDED (inventory A1): at the bound the plate\'s door is run — once', () => {
    noteMandatoryBeatIdentity('task:discard#7');
    clock.advance(ANNOUNCE_PENDING_MAX_MS - 1);
    expect(doors).to.deep.eq([]);
    clock.advance(1);
    expect(doors).to.deep.eq(['task:discard#7']);
    expect(runOf('task:discard#7')).to.contain('late');
    expect(warned.some((line) => line.includes('[mandatory-gate] the first presentation of «task:discard#7» did not come in its bound'))).to.eq(true);
    clock.advance(ANNOUNCE_PENDING_MAX_MS * 4);
    expect(doors, 'once').to.deep.eq(['task:discard#7']);
    // The latches are untouched by the bound itself — what happens next is the door's doing (or the player's).
    expect(isMandatoryBeatPresented(beat('task:discard#7'))).to.eq(false);
    expect(isMandatoryBeatHeld(beat('task:discard#7'))).to.eq(true);
  });

  it('the door acknowledging in place ends the wait', () => {
    registerAnnounceDoor((key) => acknowledgeMandatoryBeat(key));
    noteMandatoryBeatIdentity('task:discard#7');
    clock.advance(ANNOUNCE_PENDING_MAX_MS);
    expect(runOf('task:discard#7')).to.contain('acknowledged');
    expect(isMandatoryBeatHeld(beat('task:discard#7'))).to.eq(false);
  });

  it('a presentation in time disarms the bound — the door is never run', () => {
    noteMandatoryBeatIdentity('task:discard#7');
    clock.advance(1500);
    markMandatoryBeatPresented('task:discard#7');
    clock.advance(ANNOUNCE_PENDING_MAX_MS * 4);
    expect(doors).to.deep.eq([]);
    expect(clock.pending()).to.eq(0);
  });

  it('a late presentation is still a presentation', () => {
    noteMandatoryBeatIdentity('task:discard#7');
    clock.advance(ANNOUNCE_PENDING_MAX_MS);
    markMandatoryBeatPresented('task:discard#7');
    expect(runOf('task:discard#7')).to.contain('presented');
  });

  it('THE RUN DIES WITH ITS BEAT: a new identity ends it (its bound with it) and starts a fresh pending one', () => {
    noteMandatoryBeatIdentity('task:a#1');
    markMandatoryBeatPresented('task:a#1');
    noteMandatoryBeatIdentity('task:b#2');
    expect(runOf('task:a#1')).to.eq(undefined);
    expect(runOf('task:b#2')).to.contain('pending');
    expect(isMandatoryBeatPresented(beat('task:b#2'))).to.eq(false);
    noteMandatoryBeatIdentity(undefined);
    expect(runOf('task:b#2')).to.eq(undefined);
    expect(clock.pending(), 'no bound outlives its beat').to.eq(0);
    expect(doors).to.deep.eq([]);
  });

  it('the SAME key arising again is a new run — announced again, never silently pre-acknowledged', () => {
    noteMandatoryBeatIdentity('draft:gen3');
    acknowledgeMandatoryBeat('draft:gen3');
    noteMandatoryBeatIdentity(undefined);
    noteMandatoryBeatIdentity('draft:gen3');
    expect(runOf('draft:gen3')).to.contain('pending');
    expect(isMandatoryBeatHeld(beat('draft:gen3'))).to.eq(true);
  });

  it('a beat acknowledged BEFORE it became the current one is born open (a scene that opens the next flow itself)', () => {
    noteMandatoryBeatIdentity('task:a#1');
    acknowledgeMandatoryBeat('parliament:gen4');
    noteMandatoryBeatIdentity('parliament:gen4');
    expect(runOf('parliament:gen4')).to.contain('acknowledged');
    expect(isMandatoryBeatHeld(beat('parliament:gen4'))).to.eq(false);
    clock.advance(ANNOUNCE_PENDING_MAX_MS * 2);
    expect(doors).to.deep.eq([]);
  });

  it('the forced beacon belongs to its beat', () => {
    noteMandatoryBeatIdentity('task:a#1');
    markMandatoryBeatPresented('task:a#1');
    forceMandatoryBeacon('task:a#1');
    expect(isMandatoryBeaconForced(beat('task:a#1'))).to.eq(true);
    noteMandatoryBeatIdentity('task:b#2');
    expect(mandatoryGateState.beaconKey).to.eq('');
  });

  it('the same identity noted again changes nothing (the run keeps its clock)', () => {
    noteMandatoryBeatIdentity('task:a#1');
    clock.advance(ANNOUNCE_PENDING_MAX_MS - 10);
    noteMandatoryBeatIdentity('task:a#1');
    clock.advance(10);
    expect(doors).to.deep.eq(['task:a#1']);
  });

  it('a reset ends the run', () => {
    noteMandatoryBeatIdentity('task:a#1');
    resetMandatoryGate();
    expect(runOf('task:a#1')).to.eq(undefined);
    expect(clock.pending()).to.eq(0);
  });
});
