import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {continueIntakeAssembly, holdIntakeGuest, registerIntakeContinuation, releaseIntakeGuest, resetIntakeAssembly} from '../../src/client/console/cardIntake/intakeAssembly';
import {DrawnCardEntry} from '../../src/client/components/drawnCards/drawnCardsState';

/**
 * ONE HANDOFF FOR THE WHOLE ROW (the owner's TV, 2026-11-01: «вторая карта в момент приземления мигнула»). A merged
 * batch rooted on the board is dealt by TWO layers: the board card-bonus scene flies the cell's run, the deck layer
 * plays the trigger runs as its GUEST. The real cards stay HELD until the cover scene's handoff — so a guest that
 * dissolved its flyers on landing left its slot empty for the host's frame beat, and the card vanished and came back.
 * The guest's flyers now hover until the host releases them, in the host's own handoff frame.
 */
const entry = {id: 7, cards: [{name: 'A'}, {name: 'B'}]} as unknown as DrawnCardEntry;

describe('intakeAssembly — the guest hovers until the host hands off', () => {
  afterEach(() => resetIntakeAssembly());

  it('the guest parks its dissolve; the host releases it ONCE, idempotently', () => {
    let released = 0;
    let done = 0;
    registerIntakeContinuation((_e, _from, onDone) => {
      holdIntakeGuest(() => released++);
      onDone();
    });
    continueIntakeAssembly(entry, 1, () => done++);
    expect(done, 'the host hears «landed» at once').eq(1);
    expect(released, 'nothing dissolved on landing').eq(0);
    releaseIntakeGuest();
    releaseIntakeGuest();
    expect(released, 'the host\'s handoff dissolves the guest once').eq(1);
  });

  it('no guest standing: the release is a no-op; nobody registered: the continuation resolves at once', () => {
    releaseIntakeGuest();
    let done = 0;
    continueIntakeAssembly(entry, 1, () => done++);
    expect(done).eq(1);
  });

  it('both layers keep the contract: the guest never dissolves on its own landing, the host releases it at its handoff and at every end', () => {
    const root = path.resolve(__dirname, '../../src/client/components/console');
    const deck = fs.readFileSync(path.join(root, 'deckDraw/ConsoleDeckDrawLayer.vue'), 'utf-8');
    const guest = deck.slice(deck.indexOf('playGuestAssembly(e: DrawnCardEntry'), deck.indexOf('endGuestRun(): void'));
    expect(guest, 'the guest parks its flyers for the host').contains('holdIntakeGuest(release)');
    expect(guest.indexOf('holdIntakeGuest(release)'), 'parked BEFORE it reports landed').lessThan(guest.lastIndexOf('onDone();'));
    const host = fs.readFileSync(path.join(root, 'boardCardBonus/ConsoleBoardCardBonusLayer.vue'), 'utf-8');
    const handoff = host.indexOf('setBoardCardBonusPhase(\'handoff\');');
    expect(handoff).greaterThan(0);
    expect(host.slice(handoff, handoff + 400), 'released in the handoff frame').contains('releaseIntakeGuest();');
    // The end-of-scene funnel, by its declaration in the `<script setup>` form — and both anchors must STAND: a
    // missing end would widen the slice to the rest of the file and find the release somewhere else.
    const clearFrom = host.indexOf('function clearSceneDom(): void');
    const clearTo = host.indexOf('function teardownVisuals(): void');
    expect(clearFrom, '`clearSceneDom` is declared').greaterThan(0);
    expect(clearTo, '`teardownVisuals` is declared after it').greaterThan(clearFrom);
    const clear = host.slice(clearFrom, clearTo);
    expect(clear, 'and at every end of the host scene').contains('releaseIntakeGuest();');
  });
});
