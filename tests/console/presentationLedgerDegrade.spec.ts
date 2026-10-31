import {expect} from 'chai';
import {
  degradePresentationStories,
  owePresentation,
  presentationLedgerSnapshot,
  resetPresentationLedger,
} from '@/client/console/presentationLedger';
import {livenessLadder, runLivenessRung} from '@/client/console/consoleLiveness';

/**
 * THE LEDGER'S RUNG of the liveness ladder (rank 0 — truth before story): every owed story degrades NOW through its
 * owner's own honest release, named; the book is empty afterwards.
 */
describe('presentationLedger · the liveness rung', () => {
  afterEach(() => resetPresentationLedger());

  it('registers itself as the ladder\'s first rung', () => {
    const first = livenessLadder()[0];
    expect(first?.name).to.equal('presentation-ledger');
    expect(first?.rank).to.equal(0);
  });

  it('degrades every owed story at once, through the owner\'s degrade, and names them with their age', () => {
    const released: Array<string> = [];
    owePresentation({id: 'park', ready: () => false, redrive: () => {}, dueMs: 30_000, degrade: () => released.push('park')});
    owePresentation({id: 'rating', ready: () => false, redrive: () => {}, dueMs: 30_000, degrade: () => released.push('rating')});
    expect(presentationLedgerSnapshot().stories.map((s) => s.id)).to.deep.equal(['park', 'rating']);
    const what = degradePresentationStories('a test');
    expect(released).to.deep.equal(['park', 'rating']);
    expect(what).to.match(/^park@\d+s, rating@\d+s$/);
    expect(presentationLedgerSnapshot().stories).to.deep.equal([]);
    // Nothing owed → the rung says so.
    expect(degradePresentationStories('again')).to.equal('');
  });

  it('a degrade that throws is contained — the other stories still release', () => {
    const released: Array<string> = [];
    owePresentation({id: 'bad', ready: () => false, redrive: () => {}, dueMs: 30_000, degrade: () => {
      throw new Error('x');
    }});
    owePresentation({id: 'good', ready: () => false, redrive: () => {}, dueMs: 30_000, degrade: () => released.push('good')});
    degradePresentationStories('a test');
    expect(released).to.deep.equal(['good']);
    expect(presentationLedgerSnapshot().stories).to.deep.equal([]);
  });

  it('the ladder runs the rung by rank', () => {
    const released: Array<string> = [];
    owePresentation({id: 'owed', ready: () => false, redrive: () => {}, dueMs: 30_000, degrade: () => released.push('owed')});
    expect(runLivenessRung(0)).to.match(/^presentation-ledger: owed@/);
    expect(released).to.deep.equal(['owed']);
  });
});
