import {expect} from 'chai';
import {drawnRevealCommandRun} from '@/client/console/consoleRevealCommands';

function labels(cmds: ReadonlyArray<{control: string, label: string}>): Array<string> {
  return cmds.map((c) => `${c.control}:${c.label}`);
}

describe('drawnRevealCommandRun — ONE contract for both hosts', () => {
  it('the plain batch: A takes, X inspects, B takes all — B is never an exit (a draw is not cancellable)', () => {
    const run = drawnRevealCommandRun({hasCardSource: false, hasDiscards: false});
    expect(labels(run)).to.deep.eq(['confirm:Take card', 'secondary:Inspect', 'back:Take all cards']);
  });

  /**
   * L3 = the SOURCE, in BOTH hosts — one console-wide grammar: X inspects the
   * CURRENT object, L3 the source that produced it. Embedded, the source hero
   * does stand beside the result, but past the commit X belongs to the RESULT,
   * so dropping L3 there would leave the source with no inspect verb at all.
   */
  it('a CARD source always offers L3 — the two hosts never differ in what a button means', () => {
    const run = drawnRevealCommandRun({hasCardSource: true, hasDiscards: false});
    expect(labels(run)).to.deep.eq([
      'confirm:Take card', 'secondary:Inspect', 'stickL:Source', 'back:Take all cards',
    ]);
  });

  it('no card source → no L3 (nothing to point at)', () => {
    const run = drawnRevealCommandRun({hasCardSource: false, hasDiscards: false});
    expect(labels(run)).to.not.contain('stickL:Source');
  });

  /**
   * The BUY-PARITY bar grammar: with several takeable cards the run LEADS
   * with the ◄► navigation hint — the same slot the buy pick's bar puts it
   * in. One structural grid for both stages; a single card only DROPS the
   * hint (there is genuinely nothing to navigate), it never re-orders.
   */
  it('multi leads with the ◄► nav hint in the buy bar\'s slot; single drops it without re-ordering', () => {
    const multi = drawnRevealCommandRun({hasCardSource: true, hasDiscards: false, multi: true});
    expect(labels(multi)).to.deep.eq([
      'dpadH:Navigate', 'confirm:Take card', 'secondary:Inspect', 'stickL:Source', 'back:Take all cards',
    ]);
    const single = drawnRevealCommandRun({hasCardSource: true, hasDiscards: false, multi: false});
    expect(labels(single)).to.deep.eq([
      'confirm:Take card', 'secondary:Inspect', 'stickL:Source', 'back:Take all cards',
    ]);
  });

  it('a READY closer suppresses the nav hint with the rest of the take verbs', () => {
    const run = drawnRevealCommandRun({
      hasCardSource: false,
      hasDiscards: false,
      multi: true,
      closer: {index: 1, total: 1, label: 'Discard a card', ready: true} as never,
    });
    expect(labels(run)).to.not.contain('dpadH:Navigate');
  });

  it('a conditional search offers the discard pile on R3', () => {
    const run = drawnRevealCommandRun({hasCardSource: false, hasDiscards: true});
    expect(labels(run)).to.contain('stickR:Discarded pile');
  });

  it('a READY closing step takes over A and REMOVES take-all — the mandatory step cannot be skipped', () => {
    const run = drawnRevealCommandRun({
      hasCardSource: true,
      hasDiscards: false,
      closer: {index: 1, total: 1, label: 'Discard a card', ready: true} as never,
    });
    expect(labels(run)).to.contain('confirm:Discard a card');
    expect(labels(run).some((l) => l.startsWith('back:'))).to.eq(false);
  });

  it('a NOT-ready closer leaves A on «take» and keeps the take-all shortcut', () => {
    const run = drawnRevealCommandRun({
      hasCardSource: false,
      hasDiscards: false,
      closer: {index: 1, total: 1, label: 'Discard a card', ready: false} as never,
    });
    expect(labels(run)).to.contain('confirm:Take card');
    expect(labels(run)).to.contain('back:Take all cards');
  });
});
