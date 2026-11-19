import {expect} from 'chai';
import {Ownership} from '../../src/client/console/servingOwner';
import {
  measurePadPress, notePadRung, noteServingOwnerLook, ownerLookVerdict, padRungVerdict, registerOwnerNowProbe, resetServingOwnerLog, servingOwnerLog,
} from '../../src/client/console/servingOwnerMeasure';

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

/*
 * THE PAD AGAINST THE FUNCTION (stage 2 ② — measured before it is wired): every press says which rung of the pad's
 * ladder took it, and that is read against who the function says serves — on the facts as they stood BEFORE the press.
 */
describe('servingOwnerMeasure — the pad\'s rung against the function, counted', () => {
  const serves = (owner: string, host?: string): Ownership => ({asked: true, owner, basis: 'row', ...(host !== undefined ? {host} : {})} as Ownership);
  const held = (owner: string, kind: 'aside' | 'scene' | 'claim' | 'admission', by: string): Ownership => ({asked: true, owner, basis: 'row', hold: {kind, by}} as Ownership);

  beforeEach(() => resetServingOwnerLog());
  after(() => resetServingOwnerLog());

  it('how a press reads: the owner\'s own rung · its section or sheet · its host\'s · a hold · another rung · nothing asked', () => {
    expect(padRungVerdict({asked: false}, 'section:board')).to.eq('pad-free');
    expect(padRungVerdict(serves('task'), 'taskHost')).to.eq('pad-agree');
    expect(padRungVerdict(serves('lanes'), 'venusBonus')).to.eq('pad-agree');
    expect(padRungVerdict(serves('parliament'), 'section:parliament')).to.eq('pad-agree');
    expect(padRungVerdict(serves('card-actions'), 'sheet:cardActions')).to.eq('pad-agree');
    expect(padRungVerdict(serves('standard-projects'), 'sheet:standardProjects')).to.eq('pad-agree');
    // A step in a flow's zone: its own rung, or its host's (which hands it the press).
    expect(padRungVerdict(serves('task', 'hand'), 'taskHost')).to.eq('pad-agree');
    expect(padRungVerdict(serves('task', 'hand'), 'section:hand')).to.eq('pad-agree');
    // A hold is not judged by the rung — it has its own, or the press is absorbed.
    expect(padRungVerdict(held('task', 'claim', 'parliament'), 'section:parliament')).to.eq('pad-held:claim');
    // The function says X serves and another rung took the press: a fact the ladder knows and the function does not.
    expect(padRungVerdict(serves('task'), 'section:board')).to.eq('pad-MISS:section:board');
    // …but the ladder's upper half is not the question's: a view the PLAYER opened over it, a beat that absorbs.
    expect(padRungVerdict(serves('task'), 'info')).to.eq('pad-look:info');
    expect(padRungVerdict(serves('draft'), 'zoom')).to.eq('pad-look:zoom');
    expect(padRungVerdict(serves('task'), 'cinematic')).to.eq('pad-beat:cinematic');
    expect(padRungVerdict(serves('task'), 'settle')).to.eq('pad-beat:settle');
    expect(padRungVerdict(serves('task'), '')).to.eq('pad-MISS:unnamed');
  });

  it('a press is asked BEFORE it is routed, counted under `pad:<shape>`, and a disagreement is kept once with its facts', () => {
    let asked = 0;
    registerOwnerNowProbe(() => {
      asked++;
      return {shape: 'payment', ownership: serves('task'), facts: () => 'frames [] · host hand'};
    });
    const route = (rung: string) => measurePadPress(() => {
      expect(asked, 'the function was asked before the ladder ran').to.be.greaterThan(0);
      notePadRung(rung);
      return true;
    });
    expect(route('taskHost')).to.eq(true);
    route('taskHost');
    route('section:board');
    route('section:board');
    route('info');
    expect(asked).to.eq(5);
    expect(servingOwnerLog.rows['pad:payment']).to.deep.eq({'pad-agree': 2, 'pad-MISS:section:board': 2, 'pad-look:info': 1});
    expect(servingOwnerLog.disagreements.map((d) => `${d.shape}|${d.verdict}|${d.owner}|${d.present.join(',')}|${d.facts}`)).to.deep.eq([
      'pad:payment|pad-MISS:section:board|task|section:board|frames [] · host hand',
    ]);
    // No probe (no shell stands): the press is routed and nothing is counted.
    registerOwnerNowProbe(undefined);
    expect(measurePadPress(() => 7)).to.eq(7);
    expect(servingOwnerLog.rows['pad:payment']).to.deep.eq({'pad-agree': 2, 'pad-MISS:section:board': 2, 'pad-look:info': 1});
    // …and a probe that throws never breaks the press it rides.
    registerOwnerNowProbe(() => {
      throw new Error('a fact that could not be read');
    });
    expect(measurePadPress(() => 'routed')).to.eq('routed');
  });
});
