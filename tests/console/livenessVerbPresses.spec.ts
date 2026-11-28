import {expect} from 'chai';
import {dispatchConsoleIntent, registerConsoleIntentHandler} from '@/client/console/consoleRouter';
import {inputEchoSnapshot, inputTrailLine, noteUnreceivedPress, recordInputTrail, resetInputEchoForTest, setPressPictureProbe} from '@/client/console/inputEcho';
import {nextTick} from 'vue';
import {noteInputAbsorbed} from '@/client/console/inputAbsorb';

/**
 * THE PRESSES THE LIVENESS ARBITER COUNTS (2026-10-31): A and B — the two verbs every live surface must answer — from
 * ANY device (the router both the key bridge and the gamepad layer go through). An optional verb with nothing to do (X
 * on the pass-confirm panel) or a direction against a ring's wall is an honest no-op, never the wedge signature.
 */
describe('liveness · the presses it counts', () => {
  afterEach(() => resetInputEchoForTest());

  it('counts A and B, never an optional verb, a direction or a release', () => {
    resetInputEchoForTest();
    dispatchConsoleIntent({kind: 'press', button: 'secondary'});
    dispatchConsoleIntent({kind: 'press', button: 'inspect'});
    dispatchConsoleIntent({kind: 'nav', dir: 'left', repeat: false});
    dispatchConsoleIntent({kind: 'release', button: 'confirm'});
    expect(inputEchoSnapshot().verbPresses).to.equal(0);
    dispatchConsoleIntent({kind: 'press', button: 'confirm'});
    dispatchConsoleIntent({kind: 'press', button: 'back'});
    expect(inputEchoSnapshot().verbPresses).to.equal(2);
  });

  it('a press the shell consumed FOR A SURFACE THAT WAS NOT THERE is dropped, not taken (the router does not vouch for it)', () => {
    resetInputEchoForTest();
    // The shell's router decides who owns the pad and hands the intent over; `noteUnreceivedPress` is what it says
    // when that surface is not mounted. It still CONSUMES the intent — nothing may act under an owned pad.
    let mounted = false;
    const off = registerConsoleIntentHandler(() => {
      if (!mounted) {
        noteUnreceivedPress('cardActions');
      }
      return true;
    });
    try {
      expect(dispatchConsoleIntent({kind: 'press', button: 'confirm'}), 'consumed all the same').to.equal(true);
      expect(inputEchoSnapshot().verbDropped, 'nobody received it').to.equal(1);
      // A note left by an intent that is not a verb never taints the next press.
      dispatchConsoleIntent({kind: 'nav', dir: 'left', repeat: false});
      mounted = true;
      dispatchConsoleIntent({kind: 'press', button: 'back'});
      const echo = inputEchoSnapshot();
      expect(echo.verbPresses).to.equal(2);
      expect(echo.verbDropped).to.equal(1);
      expect(echo.backTaken).to.equal(1);
    } finally {
      off();
    }
  });

  /*
   * A TAKEN B IS JUDGED BY WHAT IT DID (the box's game 45, 2026-11-28): a colony step past its commit, the player taking
   * a colony with A and letting it go with «B Назад» inside the second — the 1 Hz look landed on the same state every
   * time and called three working B presses «no effect». The picture the B found against the picture after its render.
   */
  it('a taken B that moved the picture is no dead press; one that moved nothing is', async () => {
    resetInputEchoForTest();
    let picture = 'colony picked';
    setPressPictureProbe(() => picture);
    const off = registerConsoleIntentHandler((intent) => {
      if (intent.kind === 'press' && intent.button === 'back' && picture === 'colony picked') {
        picture = 'colony let go';
      }
      return true;
    });
    try {
      dispatchConsoleIntent({kind: 'press', button: 'back'});
      await nextTick();
      expect(inputEchoSnapshot().backTaken).to.equal(1);
      expect(inputEchoSnapshot().backUnmoved, 'the B let the pick go — it moved the picture').to.equal(0);
      dispatchConsoleIntent({kind: 'press', button: 'back'});
      await nextTick();
      expect(inputEchoSnapshot().backTaken).to.equal(2);
      expect(inputEchoSnapshot().backUnmoved, 'the second B found nothing to undo — a dead press').to.equal(1);
      setPressPictureProbe(undefined);
      dispatchConsoleIntent({kind: 'press', button: 'back'});
      expect(inputEchoSnapshot().backUnmoved, 'with no probe every taken B counts, as before').to.equal(2);
    } finally {
      off();
      setPressPictureProbe(undefined);
    }
  });

  /*
   * THE TRAIL (FREEZE ZERO · part A): a freeze is read by WHICH presses led to it, in what order and how fast — the
   * chairmanship wedged on «A, then A again 0.9 s later», found only by bisecting presses by hand because the event
   * carried a count. The router notes every press edge of every device with what became of it; a defect's evidence
   * prints the last of them (`stallEvidence.ts` → `input`).
   */
  it('THE TRAIL: every press edge and direction, oldest first, with its age and what became of it', () => {
    resetInputEchoForTest();
    let mounted = true;
    const off = registerConsoleIntentHandler((intent) => {
      if (intent.kind === 'press' && intent.button === 'secondary') {
        noteInputAbsorbed('decision-settle');
        return true;
      }
      if (!mounted) {
        noteUnreceivedPress('cardActions');
        return true;
      }
      return intent.kind === 'press' && intent.button === 'confirm';
    });
    try {
      dispatchConsoleIntent({kind: 'press', button: 'confirm'}); // taken
      dispatchConsoleIntent({kind: 'release', button: 'confirm'}); // a release is not an edge of the trail
      dispatchConsoleIntent({kind: 'nav', dir: 'down', repeat: false}); // nobody took it
      dispatchConsoleIntent({kind: 'nav', dir: 'down', repeat: true}); // a held direction is ONE press
      dispatchConsoleIntent({kind: 'press', button: 'secondary'}); // a deliberate gate took it, by name
      mounted = false;
      dispatchConsoleIntent({kind: 'press', button: 'confirm'}); // consumed for a surface that is not there
    } finally {
      off();
    }
    expect(inputTrailLine(Date.now()).replace(/−\d+\.\ds/g, '−Ns'))
      .to.equal('confirm −Ns · nav:down −Ns (dropped) · secondary −Ns (absorbed by decision-settle) · confirm −Ns (dropped)');
  });

  it('the trail is bounded, and forgets what is older than its window — another story\'s presses are not this one\'s', () => {
    resetInputEchoForTest();
    for (let i = 0; i < 40; i++) {
      recordInputTrail(`p${i}`, 'taken', 1_000 + i * 1_000);
    }
    const line = inputTrailLine(41_000);
    expect(line.split(' · '), 'the newest two dozen').to.have.length(24);
    expect(line.startsWith('p16 −24.0s · p17 −23.0s')).to.equal(true);
    expect(line.endsWith('p39 −1.0s')).to.equal(true);
    expect(inputTrailLine(41_000 + 200_000), 'two minutes later they are history').to.equal('');
    recordInputTrail('confirm', 'taken', 500_000);
    expect(inputTrailLine(500_300)).to.equal('confirm −0.3s');
  });

  it('counts the B presses a handler TOOK apart (the arbiter judges them on a frame past its commit)', () => {
    resetInputEchoForTest();
    dispatchConsoleIntent({kind: 'press', button: 'back'});
    dispatchConsoleIntent({kind: 'press', button: 'confirm'});
    const echo = inputEchoSnapshot();
    // No handler is registered here: both are DROPPED, so neither is a taken B.
    expect(echo.verbDropped).to.equal(2);
    expect(echo.backTaken).to.equal(0);
  });
});
