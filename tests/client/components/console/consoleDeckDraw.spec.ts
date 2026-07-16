import {expect} from 'chai';
import {
  abortDeckDraw, armDeckDraw, deckDrawHolds, deckDrawHoldingSingleZoom, deckDrawState,
  deckDrawZoomOriginEl, endDeckDraw, isDeckDrawActive, isDeckDrawSource, isDeckDrawStaged,
  markDeckCardDrawn, markDeckDrawDiscarded, markDeckDrawZoomReady, registerDeckDrawHandle,
  registerDeckDrawZoomOrigin, resetDeckDraw, setDeckDrawPhase,
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
});
