import {expect} from 'chai';
import {testGame} from '../TestGame';
import {Resource} from '../../src/common/Resource';

/**
 * THE POLITICAL-PHASE SCOPE of the event recorder (the sitting rework, Э1):
 * a root with no actor, nested actions that JOIN it instead of rooting their
 * own journal group (the automa-turn rule, generalised), and a REJOINED
 * context — how a resumable driver gets back into the same group after an
 * input boundary or a reload.
 */
describe('EventRecorder — the political-phase scope', () => {
  it('a root with NO actor: the sitting itself is the root and its first log the group\'s header', () => {
    const [game] = testGame(2);
    game.events.beginAction(undefined, {kind: 'parliament'}, {category: 'political-phase'});
    const rootId = game.events.captureContext()!.rootId!;
    game.log('convene line');
    game.events.endScope();
    const root = game.events.events.find((e) => e.id === rootId)!;
    expect(root.type).eq('action');
    expect(root.player).is.undefined;
    expect(root.category).eq('political-phase');
    expect(root.correlationId).eq(rootId);
    const line = game.gameLog.find((m) => m.message === 'convene line')!;
    expect(line.role).eq('root-action');
    expect(line.category).eq('political-phase');
    expect(line.correlationId).eq(rootId);
  });

  it('a nested action inside the scope JOINS the sitting\'s group — its logs are details, its events share the root, no second root', () => {
    const [game, p1] = testGame(2);
    game.events.beginAction(undefined, {kind: 'parliament'}, {category: 'political-phase'});
    const rootId = game.events.captureContext()!.rootId!;
    game.log('header');
    game.events.beginAction(p1, {kind: 'resolution', id: 'RDX_X', owner: p1.color}, {category: 'political-phase'});
    game.log('step line', (b) => b.player(p1));
    p1.stock.add(Resource.MEGACREDITS, 3);
    game.events.endScope();
    game.events.endScope();
    const step = game.gameLog.find((m) => m.message === 'step line')!;
    expect(step.correlationId).eq(rootId);
    expect(step.role).eq('detail');
    const marker = game.events.events.find((e) => e.type === 'action' && e.source?.kind === 'resolution')!;
    expect(marker.correlationId).eq(rootId);
    expect(marker.parentId).eq(rootId);
    const gain = game.events.events.find((e) => e.type === 'resource-changed' && e.impact.stock?.megacredits === 3)!;
    expect(gain.correlationId).eq(rootId);
    expect(game.gameLog.filter((m) => m.correlationId === rootId && m.role === 'root-action')).has.length(1);
  });

  it('a REJOINED context (a continuation after an input boundary or a reload) records into the same group, and a nested action still coalesces', () => {
    const [game, p1] = testGame(2);
    game.events.beginAction(undefined, {kind: 'parliament'}, {category: 'political-phase'});
    const rootId = game.events.captureContext()!.rootId!;
    game.log('header');
    game.events.endScope();
    // Later — the live scope is long gone (another request, a reload): rejoin by the root's id.
    game.events.runWithContext(game.events.rejoinAction(rootId, {kind: 'parliament'}, 'political-phase'), () => {
      game.log('later line');
      game.events.beginAction(p1, {kind: 'resolution', id: 'RDX_X', owner: p1.color}, {category: 'political-phase'});
      game.log('later step');
      game.events.endScope();
    });
    for (const text of ['later line', 'later step']) {
      const line = game.gameLog.find((m) => m.message === text)!;
      expect(line.correlationId, text).eq(rootId);
      expect(line.role, text).eq('detail');
    }
    expect(game.gameLog.filter((m) => m.correlationId === rootId && m.role === 'root-action')).has.length(1);
    // Outside the rejoined context nothing joins.
    game.log('unrelated');
    expect(game.gameLog.find((m) => m.message === 'unrelated')!.correlationId).is.undefined;
  });
});
