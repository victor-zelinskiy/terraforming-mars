import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {beginAnimationHold, expireAnimationHoldNow} from '@/client/components/presentation/animationHold';
import {holdWaitNodes} from '@/client/console/waitGraph/waitGraphSources';

/*
 * THE WAIT GRAPH's SOURCES BY CONSTRUCTION (Э4): a hold is a node the moment it stands — its label, its scope, since
 * when, its ceiling as the bound and `hold-expire` as the door — and that door ends it through the owner's own recovery.
 */
describe('waitGraphSources — the registries enter the graph by construction', () => {
  it('a hold is a node with its ceiling as the bound; the door ends it through its owner\'s expire, once', () => {
    let expired = 0;
    const hold = beginAnimationHold('wg-test-hold', {maxHoldMs: 7_000, scope: 'notification-only', expire: () => {
      expired++;
    }});
    try {
      const node = holdWaitNodes().find((n) => n.id === 'hold:wg-test-hold');
      expect(node).to.include({family: 'hold', boundMs: 7_000, recovery: 'hold-expire', detail: 'notification-only'});
      expect(expireAnimationHoldNow('wg-test-hold')).eq(true);
      expect(expired).eq(1);
      expect(holdWaitNodes().some((n) => n.id === 'hold:wg-test-hold'), 'gone with its wait').eq(false);
      expect(expireAnimationHoldNow('wg-test-hold'), 'nothing left to end').eq(false);
    } finally {
      hold.release();
    }
  });
});

/*
 * ONE READING OF «IS THIS FRAME IN A BEAT» (`wait-graph/dead-end/surface:card-actions — held by beat` under a green
 * `console-draw-one-batch-sealed-ledger`, CI 2026-11-22). The card-actions workspace derives its phase inside the
 * component and REPORTS its beat (`reportSurfaceBeat`) — its stack frame stays `browse`. The arbiter judged the
 * reported beat (the pad absorbed), the graph's surface node read the frame: «the player browses — B leaves», a wait
 * for a press no surface could take. A node that describes a wait nobody has is a false finding by construction.
 */
describe('the standing frame\'s node reads the frame\'s beat as the arbiter judges it', () => {
  const supervisor = fs.readFileSync(path.resolve(__dirname, '../../src/client/console/supervisor/supervisorController.ts'), 'utf8');

  it('the node\'s beat is the frame\'s own transient phase, else the surface\'s report — the arbiter\'s two sources', () => {
    // The arbiter's reading…
    expect(supervisor).to.match(/function judgedTransientBeat\(\): string \| undefined \{[\s\S]{0,500}isTransientBeat\(top\.phase\)[\s\S]{0,200}transientSurfaceBeats\(\)\.find\(\(\[kind\]\) => kind === top\.kind\)/);
    // …and the node's — the same two, in the same order.
    expect(supervisor).to.contain('const beatPhase = isTransientBeat(top.phase) ? top.phase : transientSurfaceBeats().find(([kind]) => kind === top.kind)?.[1];');
    const node = supervisor.slice(supervisor.indexOf('const beatPhase = '), supervisor.indexOf('// A HELD / OWED CONCLUSION'));
    expect(node.length, 'the node\'s body is read').to.be.greaterThan(600);
    // Nothing in the node asks the frame's raw phase «is it a beat» any more: a reported beat would be missed again.
    expect(node.slice(node.indexOf('const inBeat')), 'the raw phase decides nothing past the one reading').to.not.contain('isTransientBeat(top.phase)');
    // A frame in a beat never says «the player browses»; a reveal over the beat is the player's take, accepted by itself.
    expect(node).to.contain('const reversible = !inBeat && top.phase !== \'committed\';');
    expect(node).to.match(/revealOverBeat \? \[\{kind: 'player', what: 'take the revealed cards', accepts: true\}\] :\s+inBeat \? \[\{kind: 'motion', what: `\$\{top\.kind\}:\$\{beatPhase\}`\}\]/);
    // …and the node's age and word are the BEAT's (a reported beat re-stamps it, as a frame's phase change does).
    expect(node).to.contain('const phaseKey = `${top.kind}:${beatPhase ?? top.phase}`;');
    expect(node).to.contain('detail: beatPhase ?? top.phase,');
  });
});
