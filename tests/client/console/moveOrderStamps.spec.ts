import {expect} from 'chai';
import {
  cellLandedSeq, cellVacatedNonce, clearCellVacated, clearRemoteRevealHolds, markCellLanded, markCellVacated,
} from '@/client/console/tilePlacement/remoteRevealHold';

/*
 * THE ORDER OF A MOVE, ON THE BOARD ITSELF (CI #151 — `console-re-settlement`: two poses a starved runner painted in
 * one frame read `1402 < 1402`). The vacate and the landing are stamped on ONE clock, so the order the scene made is a
 * fact the board's cells state (`data-vacated-seq` / `data-landed-seq`), whatever the frame rate.
 */
describe('remoteRevealHold — a move\'s vacate and landing on one clock', () => {
  afterEach(() => {
    clearCellVacated('05');
    clearRemoteRevealHolds();
  });

  it('the landing is stamped AFTER the vacate it follows — strictly, never on the same tick', () => {
    markCellVacated('05');
    markCellLanded('06');
    expect(cellVacatedNonce('05')).to.be.a('number');
    expect(cellLandedSeq('06')!, 'the landing comes after the vacate').to.be.greaterThan(cellVacatedNonce('05')!);
  });

  it('the session\'s end forgets the landings', () => {
    markCellLanded('06');
    clearRemoteRevealHolds();
    expect(cellLandedSeq('06')).to.equal(undefined);
  });
});
