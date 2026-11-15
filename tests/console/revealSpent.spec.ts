import {expect} from 'chai';
import {embeddedBatchOrphanedSpent, OrphanFacts} from '../../src/client/console/revealSpent';

/**
 * A batch that stood EMBEDDED and lost its host with nothing left to take keeps its embedded dress and paints nothing
 * — never the full-bleed band for the task between the host's leave and its own end (caught by the FLAKE ZERO recorder:
 * 2–6 ms of a standalone band on every such teardown). A card still to take keeps the band; a batch that never stood
 * embedded is the band's own.
 */
describe('embeddedBatchOrphanedSpent', () => {
  const orphan: OrphanFacts = {embedded: false, batchId: 7, embeddedBatchId: 7, untaken: 0};

  it('the spent batch that stood embedded, its host gone, is no band', () => {
    expect(embeddedBatchOrphanedSpent(orphan)).to.equal(true);
  });

  it('a card still to take keeps the band — the result outlives its surface', () => {
    expect(embeddedBatchOrphanedSpent({...orphan, untaken: 1})).to.equal(false);
  });

  it('still embedded — the host stands, nothing to decide', () => {
    expect(embeddedBatchOrphanedSpent({...orphan, embedded: true})).to.equal(false);
  });

  it('a batch that never stood embedded (another batch, or none) is the band\'s own', () => {
    expect(embeddedBatchOrphanedSpent({...orphan, batchId: 8})).to.equal(false);
    expect(embeddedBatchOrphanedSpent({...orphan, embeddedBatchId: undefined})).to.equal(false);
    expect(embeddedBatchOrphanedSpent({...orphan, batchId: undefined})).to.equal(false);
  });
});
