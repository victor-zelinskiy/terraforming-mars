import {expect} from 'chai';
import {Ownership} from '../../src/client/console/servingOwner';
import {noteServingOwnerLook, ownerLookVerdict, resetServingOwnerLog, servingOwnerLog} from '../../src/client/console/servingOwnerMeasure';

/*
 * THE MEASURE OF THE ONE FUNCTION (FREEZE ZERO, stage 2, step ①): `servingOwnerOf` is compared with what PAINTS on
 * every look of the leak detector's pass — counted, never judged. A disagreement is a bug of the function or an
 * ambiguity of today's shell; this is how each is found.
 */
describe('servingOwnerMeasure — the function against the screen, counted', () => {
  const serves = (owner: string, host?: string): Ownership => ({asked: true, owner, basis: 'row', ...(host !== undefined ? {host} : {})} as Ownership);
  const held = (owner: string, kind: 'aside' | 'scene' | 'claim' | 'admission', by: string): Ownership => ({asked: true, owner, basis: 'row', hold: {kind, by}} as Ownership);

  beforeEach(() => resetServingOwnerLog());
  after(() => resetServingOwnerLog());

  it('how a look reads: the owner paints · it waits as said · it is missing · it paints under a hold', () => {
    expect(ownerLookVerdict({asked: false}, ['hand'], 'none')).to.eq('free');
    expect(ownerLookVerdict(serves('task'), ['card-actions', 'task'], 'agree')).to.eq('agree');
    expect(ownerLookVerdict(held('task', 'admission', 'reveal'), [], 'beat')).to.eq('held:admission');
    // The function says it serves and it does not paint: what the screen shadow made of the same look rides along.
    expect(ownerLookVerdict(serves('task'), ['parliament'], 'beat')).to.eq('MISS:beat');
    expect(ownerLookVerdict(serves('colonies'), [], 'unserved')).to.eq('MISS:unserved');
    // The function names a hold and the surface stands all the same.
    expect(ownerLookVerdict(held('decision', 'claim', 'hand'), ['decision'], 'agree')).to.eq('EXTRA:claim');
  });

  it('every look is counted by its shape; a disagreement is kept ONCE per its own picture', () => {
    for (let i = 0; i < 5; i++) {
      noteServingOwnerLook('payment', serves('task'), ['task'], 'agree');
    }
    for (let i = 0; i < 3; i++) {
      noteServingOwnerLook('payment', serves('task', 'card-actions'), ['card-actions'], 'beat');
    }
    noteServingOwnerLook('colony', held('colonies', 'aside', 'the player set it aside'), [], 'held');
    noteServingOwnerLook('payment', serves('task', 'card-actions'), ['hand'], 'misserved');
    expect(servingOwnerLog.looks).to.eq(10);
    expect(servingOwnerLog.rows).to.deep.eq({
      payment: {'agree': 5, 'MISS:beat': 3, 'MISS:misserved': 1},
      colony: {'held:aside': 1},
    });
    expect(servingOwnerLog.disagreements.map((d) => `${d.shape}|${d.verdict}|${d.owner}@${d.host}|${d.present.join(',')}`)).to.deep.eq([
      'payment|MISS:beat|task@card-actions|card-actions',
      'payment|MISS:misserved|task@card-actions|hand',
    ]);
  });
});
