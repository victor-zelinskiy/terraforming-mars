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
    // A STEP IN A FLOW's ZONE is seen as its host: the host painting is the step served…
    expect(ownerLookVerdict(serves('external-draw', 'parliament'), ['parliament'], 'agree:host')).to.eq('agree');
    expect(ownerLookVerdict(serves('external-draw', 'parliament'), ['hand'], 'held:reveal')).to.eq('MISS:held:reveal');
    // …but a step the FUNCTION holds is held while its host paints (the sitting's ask waiting for the field to open).
    expect(ownerLookVerdict({...held('task', 'claim', 'parliament'), host: 'parliament'} as Ownership, ['parliament'], 'agree:host')).to.eq('held:claim');
    // …and THE BOARD IS ALWAYS THERE — a held board is held as said, whatever paints.
    expect(ownerLookVerdict(held('board', 'aside', 'the player set it aside'), ['board', 'awards'], 'agree:row')).to.eq('held:aside');
  });

  it('every look is counted by its shape; a disagreement is kept ONCE per its own picture', () => {
    for (let i = 0; i < 5; i++) {
      noteServingOwnerLook('payment', serves('task'), ['task'], 'agree');
    }
    for (let i = 0; i < 3; i++) {
      noteServingOwnerLook('payment', serves('task', 'card-actions'), ['card-actions'], 'beat');
    }
    noteServingOwnerLook('colony', held('colonies', 'aside', 'the player set it aside'), [], 'held');
    // ONE look of a disagreement, then it is gone — a surface mounting across a look: unsettled, kept nowhere.
    noteServingOwnerLook('payment', serves('task', 'card-actions'), ['hand'], 'misserved');
    expect(servingOwnerLog.looks).to.eq(10);
    // THE FUNCTION IS HELD TO SETTLED LOOKS: the first look of a disagreement is `unsettled`; the same picture on the
    // very next look is the disagreement (three looks in a row → one unsettled, two counted).
    expect(servingOwnerLog.rows).to.deep.eq({
      payment: {'agree': 5, 'unsettled': 2, 'MISS:beat': 2},
      colony: {'held:aside': 1},
    });
    expect(servingOwnerLog.disagreements.map((d) => `${d.shape}|${d.verdict}|${d.owner}@${d.host}|${d.present.join(',')}`)).to.deep.eq([
      'payment|MISS:beat|task@card-actions|card-actions',
    ]);
    // …and a disagreement that comes back after an agreeing look starts unsettled again.
    noteServingOwnerLook('payment', serves('task'), ['task'], 'agree');
    noteServingOwnerLook('payment', serves('task', 'card-actions'), ['card-actions'], 'beat');
    expect(servingOwnerLog.rows.payment).to.deep.eq({'agree': 6, 'unsettled': 3, 'MISS:beat': 2});
  });
});
