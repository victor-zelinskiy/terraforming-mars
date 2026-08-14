import {expect} from 'chai';
import {
  abortDeckDraw, armDeckDraw, deckDrawHolds, deckDrawHoldingSingleZoom, deckDrawState,
  deckDrawVerdict, deckDrawZoomOriginEl, endDeckDraw, isDeckDrawActive, isDeckDrawForeign,
  isDeckDrawSource, isDeckDrawStaged, markDeckCardDrawn, markDeckDrawDiscarded,
  markDeckDrawZoomReady, noteDeckDrawForeign, registerDeckDrawHandle, registerDeckDrawZoomOrigin,
  resetDeckDraw, setDeckDrawPhase,
} from '@/client/console/deckDraw/consoleDeckDraw';
import {displayedDeckSize, isDeckDisplayHeld} from '@/client/console/consoleDeckDisplay';

/**
 * The deck-draw controller: the gates the scene rests on. The two that must
 * never break are (1) the reveal modal cannot exist while cards are still
 * coming off the deck, and (2) every exit — clean or aborted — releases every
 * gate, so a stalled animation can never strand the reveal.
 */
describe('consoleDeckDraw', () => {
  const arm = (id = 1, hasDiscards = true, preDraw = 180) =>
    armDeckDraw(id, {hasDiscards, preDrawSize: preDraw, reducedMotion: false});

  afterEach(() => {
    resetDeckDraw();
  });

  describe('source ownership — the two scenes can never claim one batch', () => {
    it('claims the batches whose cards came off the deck', () => {
      expect(isDeckDrawSource({type: 'card', cardName: 'Acquired Space Agency' as never})).to.eq(true);
      expect(isDeckDrawSource({type: 'colony', colonyName: 'Luna' as never})).to.eq(true);
      expect(isDeckDrawSource({type: 'other'})).to.eq(true);
      expect(isDeckDrawSource(undefined)).to.eq(true);
    });

    it('leaves the board card-bonus sources alone (that cover lifts off a cell / a marker)', () => {
      expect(isDeckDrawSource({type: 'tile'})).to.eq(false);
      expect(isDeckDrawSource({type: 'globalParameter', parameter: 'venus' as never})).to.eq(false);
    });
  });

  describe('arm', () => {
    it('closes the gates synchronously and claims the batch', () => {
      expect(arm(7)).to.eq(true);
      expect(isDeckDrawActive()).to.eq(true);
      expect(deckDrawState.phase).to.eq('search');
      expect(isDeckDrawStaged(7)).to.eq(true);
      expect(isDeckDrawStaged(8)).to.eq(false);
    });

    it('holds the deck counter at the PRE-DRAW size — the server already dropped it', () => {
      arm(1, true, 180);
      expect(isDeckDisplayHeld()).to.eq(true);
      // The authoritative value is already 176; the player still sees 180.
      expect(displayedDeckSize(176)).to.eq(180);
    });

    it('one scene at a time — a second batch never interrupts a live one', () => {
      expect(arm(1)).to.eq(true);
      expect(arm(2)).to.eq(false);
      expect(isDeckDrawStaged(1)).to.eq(true);
    });
  });

  describe('the reveal-mount hold', () => {
    it('withholds the modal while cards are coming off the deck', () => {
      arm();
      expect(deckDrawHolds()).to.eq(true);
      setDeckDrawPhase('settle');
      expect(deckDrawHolds()).to.eq(true);
    });

    it('releases it at assemble — the modal mounts veiled so its slots can be measured', () => {
      arm();
      setDeckDrawPhase('assemble');
      expect(deckDrawHolds()).to.eq(false);
      setDeckDrawPhase('frame');
      expect(deckDrawHolds()).to.eq(false);
      setDeckDrawPhase('handoff');
      expect(deckDrawHolds()).to.eq(false);
    });

    it('never holds while idle (desktop / no scene)', () => {
      expect(deckDrawHolds()).to.eq(false);
    });
  });

  describe('the counter ticks with the cards physically leaving', () => {
    it('follows each peel-off, then releases to the server truth at the end', () => {
      arm(1, true, 180);
      markDeckCardDrawn(179);
      expect(displayedDeckSize(176)).to.eq(179);
      markDeckCardDrawn(178);
      expect(displayedDeckSize(176)).to.eq(178);
      endDeckDraw();
      expect(isDeckDisplayHeld()).to.eq(false);
      expect(displayedDeckSize(176)).to.eq(176);
    });

    it('a dead scene can never move the counter (zombie-safe)', () => {
      arm(1, true, 180);
      endDeckDraw();
      markDeckCardDrawn(10);
      expect(isDeckDisplayHeld()).to.eq(false);
    });
  });

  describe('the tray count', () => {
    it('grows one card at a time, as each lands', () => {
      arm();
      expect(deckDrawState.trayCount).to.eq(0);
      markDeckDrawDiscarded();
      markDeckDrawDiscarded();
      expect(deckDrawState.trayCount).to.eq(2);
    });

    it('a plain draw has no discards to tray', () => {
      arm(1, false);
      expect(deckDrawState.hasDiscards).to.eq(false);
    });

    it('a dead scene never grows the tray', () => {
      arm();
      endDeckDraw();
      markDeckDrawDiscarded();
      expect(deckDrawState.trayCount).to.eq(0);
    });
  });

  describe('single-card handoff — the viewer lifts the card that flew', () => {
    it('holds the fullscreen auto-open while the card is still travelling', () => {
      arm(3);
      expect(deckDrawHoldingSingleZoom(3)).to.eq(true);
      // Another batch's reveal is never held by our scene.
      expect(deckDrawHoldingSingleZoom(4)).to.eq(false);
    });

    it('releases it the moment the card stands in the hold zone', () => {
      arm(3);
      markDeckDrawZoomReady();
      expect(deckDrawHoldingSingleZoom(3)).to.eq(false);
    });

    it('resolves the flown proxy as the viewer\'s physical origin', () => {
      const proxy = {} as HTMLElement;
      registerDeckDrawZoomOrigin(() => proxy);
      expect(deckDrawZoomOriginEl()).to.eq(proxy);
      registerDeckDrawZoomOrigin(undefined);
      expect(deckDrawZoomOriginEl()).to.eq(null);
    });

    it('an abort releases the held auto-open — the reveal can never be stranded', () => {
      arm(3);
      abortDeckDraw();
      expect(deckDrawHoldingSingleZoom(3)).to.eq(false);
      expect(deckDrawZoomOriginEl()).to.eq(null);
    });

    it('a fresh scene re-arms the hold', () => {
      arm(3);
      markDeckDrawZoomReady();
      endDeckDraw();
      arm(4);
      expect(deckDrawHoldingSingleZoom(4)).to.eq(true);
    });
  });

  describe('exits always release every gate', () => {
    it('a clean end keeps the staged id — the modal must not replay its entrance', () => {
      arm(5);
      endDeckDraw();
      expect(isDeckDrawActive()).to.eq(false);
      expect(deckDrawHolds()).to.eq(false);
      expect(isDeckDrawStaged(5)).to.eq(true);
    });

    it('an abort unveils the reveal immediately — it can never be left invisible', () => {
      arm(5);
      abortDeckDraw();
      expect(isDeckDrawActive()).to.eq(false);
      expect(deckDrawHolds()).to.eq(false);
      // Staging dropped → the overlay stops suppressing itself and shows.
      expect(isDeckDrawStaged(5)).to.eq(false);
      expect(isDeckDisplayHeld()).to.eq(false);
    });

    it('an abort tears the live scene down through the registered handle', () => {
      let aborted = 0;
      arm();
      registerDeckDrawHandle({abort: () => aborted++});
      abortDeckDraw();
      expect(aborted).to.eq(1);
    });

    it('abort is idempotent and safe with no scene', () => {
      abortDeckDraw();
      arm();
      abortDeckDraw();
      abortDeckDraw();
      expect(isDeckDrawActive()).to.eq(false);
    });

    it('a phase change after the scene died is ignored', () => {
      arm();
      abortDeckDraw();
      setDeckDrawPhase('frame');
      expect(deckDrawState.phase).to.eq('idle');
    });

    it('a fresh arm supersedes the previous batch memory', () => {
      arm(1);
      endDeckDraw();
      expect(isDeckDrawStaged(1)).to.eq(true);
      arm(2);
      expect(isDeckDrawStaged(2)).to.eq(true);
      expect(isDeckDrawStaged(1)).to.eq(false);
    });
  });

  /**
   * WHOSE ARRIVAL IS IT — the entry decision, and the one property that makes
   * it safe: ownership is decided ONCE PER BATCH and can only harden.
   *
   * THE BUG THIS EXISTS FOR. Every «not ours» answer is derived from something
   * LIVE, and a reveal batch outlives all of them — it stays
   * `currentRevealEvent()` until the last card has been taken, while the
   * workspace that owns it deliberately drops its claim ONE TICK EARLIER
   * (`result-detached`: the card lifts, the frame folds under it). In that one
   * window a batch that had already been dealt, landed and read looked unowned
   * — so the scene dealt it again: the HUD counter jumped back up to the
   * pre-draw number, a second «−1» chip fired, and a ghost card flew off the
   * pile across the take that was already in the air.
   */
  describe('ownership is decided once and only hardens', () => {
    const own = (eventId: number, foreign: boolean, waiting = false) =>
      deckDrawVerdict({eventId, foreign, waiting});

    it('claims a batch nobody else is flying', () => {
      expect(own(9, false)).to.deep.eq({kind: 'claim', eventId: 9});
    });

    it('hands a foreign batch back — and REMEMBERS it, so an owner letting go cannot re-open the door', () => {
      // The workspace's own execution beat is flying batch 9.
      expect(own(9, true)).to.deep.eq({kind: 'foreign', eventId: 9});
      noteDeckDrawForeign(9);
      expect(isDeckDrawForeign(9)).to.eq(true);
      // The take: the claim is released one tick before the batch is dismissed.
      // The live answer is now «nobody owns it» — the memory is what holds.
      expect(own(9, false)).to.deep.eq({kind: 'foreign', eventId: 9});
      // …and only for THAT batch: the next draw is still ours.
      expect(own(10, false)).to.deep.eq({kind: 'claim', eventId: 10});
    });

    it('never remembers a WAITING batch — «not yet» must stay re-askable', () => {
      // A foreign trade's owner bonus behind its mandatory announce.
      expect(own(11, false, true)).to.eq(undefined);
      expect(isDeckDrawForeign(11)).to.eq(false);
      // The door opened — the scene serves it.
      expect(own(11, false)).to.deep.eq({kind: 'claim', eventId: 11});
    });

    it('decides ownership BEFORE «are we busy» — a batch arriving mid-scene is still recorded as theirs', () => {
      arm(1);
      expect(own(2, true)).to.deep.eq({kind: 'foreign', eventId: 2});
      noteDeckDrawForeign(2);
      endDeckDraw();
      // The scene is free now, and the claim that made batch 2 foreign is gone.
      expect(own(2, false)).to.deep.eq({kind: 'foreign', eventId: 2});
    });

    it('one scene at a time, and a finished scene never re-arms its own batch', () => {
      arm(3);
      expect(own(4, false)).to.eq(undefined);
      endDeckDraw();
      // 3 is this scene's own, finished batch — the reveal is still on screen.
      expect(own(3, false)).to.eq(undefined);
      expect(own(4, false)).to.deep.eq({kind: 'claim', eventId: 4});
    });

    it('nothing on screen is nothing to do', () => {
      expect(deckDrawVerdict(undefined)).to.eq(undefined);
    });

    it('the memory is bounded and survives every exit but a full reset', () => {
      for (let id = 100; id < 120; id++) {
        noteDeckDrawForeign(id);
      }
      // Only the recent batches are kept — the old ones can no longer be asked
      // about (their reveals are long gone).
      expect(isDeckDrawForeign(119)).to.eq(true);
      expect(isDeckDrawForeign(100)).to.eq(false);
      arm(119);
      abortDeckDraw();
      expect(isDeckDrawForeign(119)).to.eq(true);
      resetDeckDraw();
      expect(isDeckDrawForeign(119)).to.eq(false);
    });
  });
});
