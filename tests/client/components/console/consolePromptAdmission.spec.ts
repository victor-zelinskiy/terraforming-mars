import {expect} from 'chai';
import {
  AdmissionBlock,
  AdmissionSignals,
  PromptSurface,
  isPromptAdmitted,
  promptAdmissionBlock,
  setConsolePlacementHeld,
  isConsolePlacementHeld,
  resetPromptAdmission,
} from '@/client/console/consolePromptAdmission';

/** Nothing is happening — every surface is admitted. */
function idle(): AdmissionSignals {
  return {
    revealOpen: false,
    revealPending: false,
    playedHero: false,
    tileHero: false,
    cardArrival: false,
    boardBonus: false,
    cardDiscard: false,
    presentation: false,
    announceGate: false,
    anyAnimation: false,
  };
}

const SURFACES: ReadonlyArray<PromptSurface> = ['host', 'section', 'standaloneModal', 'scene', 'placement'];

describe('consolePromptAdmission (the one prompt-surface admission gate)', () => {
  beforeEach(() => resetPromptAdmission());
  afterEach(() => resetPromptAdmission());

  it('admits every surface when nothing is running', () => {
    for (const surface of SURFACES) {
      expect(promptAdmissionBlock(surface, idle()), surface).to.be.undefined;
      expect(isPromptAdmitted(surface, idle()), surface).to.be.true;
    }
  });

  describe('THE BUG: a draw and a placement arriving in ONE response', () => {
    /*
     * Experimental Forest — the executor draws synchronously and only DEFERS the
     * greenery, so one payload carries the drawn-cards reveal AND the SelectSpace.
     * The board must NOT go live while the reveal is up.
     */
    it('holds the placement while the drawn-cards reveal owns the foreground', () => {
      const s = {...idle(), revealOpen: true, revealPending: true};
      expect(promptAdmissionBlock('placement', s)).to.equal('reveal');
      expect(isPromptAdmitted('placement', s)).to.be.false;
    });

    it('holds the placement for the WHOLE draw beat, link by link', () => {
      // 1. The deck-draw search: cards are still peeling off the deck, the
      //    reveal has not assembled yet.
      expect(promptAdmissionBlock('placement', {...idle(), cardArrival: true})).to.equal('card-arrival');
      // 2. The reveal batch is pending even before its overlay mounts.
      expect(promptAdmissionBlock('placement', {...idle(), revealPending: true})).to.equal('reveal');
      // 3. The overlay is up and the player is taking cards.
      expect(promptAdmissionBlock('placement', {...idle(), revealOpen: true})).to.equal('reveal');
      // 4. The reveal is answered but the last card is still flying to the dock —
      //    the intake flight keeps `cardArrival` raised. THIS is the link that
      //    made "the prompt ends when the last card lands" true rather than
      //    "when the modal closes".
      expect(promptAdmissionBlock('placement', {...idle(), cardArrival: true})).to.equal('card-arrival');
      // 5. Everything landed → the board finally comes alive.
      expect(isPromptAdmitted('placement', idle())).to.be.true;
    });

    it('holds the placement behind every other foreground cinematic too', () => {
      const cases: ReadonlyArray<[keyof AdmissionSignals, AdmissionBlock]> = [
        ['playedHero', 'played-hero'],
        ['tileHero', 'tile-hero'],
        ['cardDiscard', 'card-discard'],
        ['presentation', 'presentation'],
      ];
      for (const [signal, block] of cases) {
        expect(promptAdmissionBlock('placement', {...idle(), [signal]: true}), signal).to.equal(block);
      }
    });
  });

  describe('the per-family policy differences are deliberate', () => {
    /*
     * The hydro draw lands its cards INSIDE a section pick and the card deal
     * plays inside the host — holding a section for an arrival would unmount the
     * very stage the cinematic runs on.
     */
    it('a section is NOT held by a card arrival, the host and placement are', () => {
      const s = {...idle(), cardArrival: true};
      expect(isPromptAdmitted('section', s)).to.be.true;
      expect(isPromptAdmitted('host', s)).to.be.false;
      expect(isPromptAdmitted('placement', s)).to.be.false;
    });

    /*
     * The board card-bonus cover lift is armed BY a placement's own confirm (A on
     * the cell, before the POST). Folding it into `cardArrival` would make a
     * placement cancel ITSELF the instant the player pressed A.
     */
    it('the board card-bonus lift holds the host but NEVER the placement that arms it', () => {
      const s = {...idle(), boardBonus: true};
      expect(promptAdmissionBlock('host', s)).to.equal('board-bonus');
      expect(isPromptAdmitted('placement', s)).to.be.true;
    });

    /*
     * The corp first-action confirm hosts none of the running cinematics, so it
     * alone also waits out the 'notification-only' holds (intake / card deal).
     */
    it('only the standalone modal waits out a notification-only animation hold', () => {
      const s = {...idle(), anyAnimation: true};
      expect(promptAdmissionBlock('standaloneModal', s)).to.equal('animation');
      for (const surface of ['host', 'section', 'scene', 'placement'] as const) {
        expect(isPromptAdmitted(surface, s), surface).to.be.true;
      }
    });

    it('the opening scene yields only to a reveal or a blocking presentation', () => {
      expect(promptAdmissionBlock('scene', {...idle(), revealPending: true})).to.equal('reveal');
      expect(promptAdmissionBlock('scene', {...idle(), presentation: true})).to.equal('presentation');
      for (const signal of ['playedHero', 'tileHero', 'cardArrival', 'cardDiscard', 'announceGate'] as const) {
        expect(isPromptAdmitted('scene', {...idle(), [signal]: true}), signal).to.be.true;
      }
    });

    it('the announce gate holds every task family but not the opening scene', () => {
      const s = {...idle(), announceGate: true};
      for (const surface of ['host', 'section', 'standaloneModal', 'placement'] as const) {
        expect(isPromptAdmitted(surface, s), surface).to.be.false;
      }
      expect(isPromptAdmitted('scene', s)).to.be.true;
    });
  });

  it('reports the most foreground reason when several are raised', () => {
    // A reveal outranks the ambient holds — the reason feeds the ?gpDebug readout,
    // so it must be deterministic rather than "whichever was checked first".
    const s = {...idle(), revealOpen: true, presentation: true, cardArrival: true};
    expect(promptAdmissionBlock('placement', s)).to.equal('reveal');
    expect(promptAdmissionBlock('host', {...idle(), presentation: true, cardArrival: true})).to.equal('card-arrival');
  });

  describe('the placement mirror (read by the legacy WaitingFor)', () => {
    it('is false by default, so DESKTOP mode is a no-op', () => {
      expect(isConsolePlacementHeld()).to.be.false;
    });

    it('round-trips the shell verdict and is cleared by the reset', () => {
      setConsolePlacementHeld(true);
      expect(isConsolePlacementHeld()).to.be.true;
      setConsolePlacementHeld(false);
      expect(isConsolePlacementHeld()).to.be.false;
      setConsolePlacementHeld(true);
      resetPromptAdmission(); // the shell's unmount path
      expect(isConsolePlacementHeld()).to.be.false;
    });
  });
});
