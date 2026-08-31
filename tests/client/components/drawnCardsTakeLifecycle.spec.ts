import {expect} from 'chai';
import {
  currentRevealEvent, dismissEvent, drawnCardsState, isEventFullyTaken, markAllTaken,
  markCardTaken, markRevealPresented, reconcileDrawnCards, revealPresented,
  untakenNameMultiset,
} from '@/client/components/drawnCards/drawnCardsState';
import {CardName} from '@/common/cards/CardName';

/**
 * THE TAKE LIFECYCLE — and the one property every take path has to respect.
 *
 * `currentRevealEvent()` is what the console shell derives the drawn reveal's
 * existence from (`rawDrawnRevealPending` → `consoleRevealMode` → the overlay
 * mounts). It is keyed on «are any cards still untaken», which makes marking
 * the LAST card taken the same event as the reveal ENDING.
 *
 * That is a real trap, and it cost a shipped bug: taking cards one by one
 * marked the final card and then started the collection flight — but the mark
 * had already dropped the event, the overlay unmounted ~2 ms later, and the
 * flight found nothing to collect (measured on the device: `LAST-CARD` →
 * `beforeUnmount` → `collectTaken:NO-EVENT`). «Взять всё» never hit it because
 * it marks NOTHING up front — its `markAllTaken` runs inside the hand intake's
 * staged commit, once the proxies already stand over the cards.
 *
 * So these specs pin the property rather than the symptom: the reveal survives
 * exactly as long as one card is untaken, and the commit that ends it is the
 * one that must be deferred to the flight's staged seam.
 */
describe('drawnCards — the take lifecycle behind the reveal surface', () => {
  const A = CardName.ANTS;
  const B = CardName.BIRDS;

  function twoCardBatch(): void {
    drawnCardsState.events = [];
    reconcileDrawnCards([{
      id: 1,
      cards: [{name: A}, {name: B}],
    } as never]);
  }

  afterEach(() => {
    // Module state is BUNDLE-SHARED under mochapack — a leaked batch would
    // keep every later spec's reveal alive.
    drawnCardsState.events = [];
    drawnCardsState.fullscreen = null;
  });

  it('the reveal exists while ANY card is untaken', () => {
    twoCardBatch();
    expect(currentRevealEvent()?.id).to.eq(1);
    markCardTaken(1, 0);
    expect(currentRevealEvent()?.id, 'one card left → still on screen').to.eq(1);
  });

  it('⚠️ marking the LAST card is what ENDS the reveal — not a separate close', () => {
    // This is the whole hazard in one assertion: the surface disappears as a
    // DIRECT consequence of the mark, so anything that still needs the surface
    // (measuring its slots, flying its cards) must run BEFORE it.
    twoCardBatch();
    markCardTaken(1, 0);
    markCardTaken(1, 1);
    expect(currentRevealEvent(), 'the event is gone the moment nothing is untaken').to.eq(undefined);
    // …even though the entry is still in the store and not dismissed.
    expect(drawnCardsState.events).to.have.length(1);
    expect(drawnCardsState.events[0].dismissed).to.eq(false);
    expect(isEventFullyTaken(1)).to.eq(true);
  });

  it('markAllTaken ends it too — which is why it belongs in the STAGED commit', () => {
    // The take-all path's commit. Running it at the intake's staged seam (the
    // frame the proxies already cover the cards) is what makes the surface
    // safe to lose: by then nothing on it is needed any more.
    twoCardBatch();
    markAllTaken(1);
    expect(currentRevealEvent()).to.eq(undefined);
  });

  it('untaken cards are withheld from the hand until they are taken', () => {
    // The dock subtracts these, so an early mark also ticks the «КАРТЫ»
    // counter before the cards have physically arrived.
    twoCardBatch();
    expect(untakenNameMultiset().get(A)).to.eq(1);
    expect(untakenNameMultiset().get(B)).to.eq(1);
    markCardTaken(1, 0);
    expect(untakenNameMultiset().get(A), 'a taken card is released to the hand at once').to.eq(undefined);
    expect(untakenNameMultiset().get(B)).to.eq(1);
  });

  it('a batch of one is the same rule — the single take ends the reveal', () => {
    drawnCardsState.events = [];
    reconcileDrawnCards([{id: 2, cards: [{name: A}]} as never]);
    expect(currentRevealEvent()?.id).to.eq(2);
    markCardTaken(2, 0);
    expect(currentRevealEvent()).to.eq(undefined);
  });

  /**
   * THE PRESENTED LATCH — the scene-exit barrier's one-directional witness.
   * A batch that has NOT presented yet waits out the previous card stage's
   * exit (the deck pick's commit beats, the dock flights); a batch that IS
   * presenting starts flights of its own with every take, and those must
   * never re-raise the barrier under it. Presentation is decided once per
   * batch and only ever hardens; the latch dies with the batch, never
   * mid-life.
   */
  it('the presented latch hardens per batch and dies with the batch', () => {
    twoCardBatch();
    expect(revealPresented(1), 'assembling — not on the scene yet').to.eq(false);
    markRevealPresented(1);
    expect(revealPresented(1)).to.eq(true);
    // Take flights of its own cannot un-present it.
    markCardTaken(1, 0);
    expect(revealPresented(1)).to.eq(true);
    // The server dropping the batch is the latch's only end.
    reconcileDrawnCards([]);
    expect(revealPresented(1)).to.eq(false);
  });

  /**
   * NO SILENT LOSS ACROSS A GROWING BATCH.
   *
   * `dismissed` is a CLIENT latch, set the instant the last card is taken so
   * the modal closes before the server ack round-trips. A trade-tagged batch
   * can legitimately GROW on the server (same-trade draws merge), and a batch
   * that gained a card while wearing that latch would be a card drawn and
   * never shown. Growth un-dismisses; the take progress rides along, so only
   * the NEW card is owed. (The server additionally SEALS a batch whose payout
   * owes a mandatory answer — this is the client's half of the same law.)
   */
  it('a batch that GREW comes back — a dismissed one included', () => {
    twoCardBatch();
    markAllTaken(1);
    dismissEvent(1);
    expect(currentRevealEvent(), 'a fully taken batch is off screen').to.eq(undefined);

    reconcileDrawnCards([{id: 1, cards: [{name: A}, {name: B}, {name: CardName.MOSS}]} as never]);
    const live = currentRevealEvent();
    expect(live?.id, 'the appended card re-opens the batch').to.eq(1);
    expect(live?.takenIndices.size, 'the earlier takes survive the append').to.eq(2);
    expect(isEventFullyTaken(1)).to.eq(false);
  });

  it('a later batch presents on its own latch — the previous one says nothing about it', () => {
    twoCardBatch();
    markRevealPresented(1);
    reconcileDrawnCards([
      {id: 1, cards: [{name: A}, {name: B}]} as never,
      {id: 2, cards: [{name: A}]} as never,
    ]);
    expect(revealPresented(1)).to.eq(true);
    expect(revealPresented(2), 'the queued batch has not taken the scene').to.eq(false);
  });
});
