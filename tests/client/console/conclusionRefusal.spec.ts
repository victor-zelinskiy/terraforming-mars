import {expect} from 'chai';
import {conclusionRefusal, conclusionRefusalOf, resetConclusionRefusal} from '@/client/console/shell/shellFlowState';

/*
 * EACH WORKSPACE's OWN REFUSAL (FREEZE ZERO, CI #148 — game 1125): one slot for every kind meant the hand's refused
 * conclusion overwrote the card centre's, and the card centre's debt read «held: unknown» — no edge in the hold table,
 * the motion bound on a step with no clock, «overdue … standing 33 s». A kind's reason is its own until ITS conclusion.
 */
describe('conclusionRefusal — each workspace keeps the hold its own conclusion was refused on', () => {
  afterEach(() => {
    resetConclusionRefusal();
  });

  it('two workspaces owe at once: each reads its own reason, never the other\'s', () => {
    conclusionRefusal.byKind.set('card-actions', {reason: 'nested-step', at: 1});
    conclusionRefusal.byKind.set('hand', {reason: 'owed-step', at: 2});
    conclusionRefusal.last = {kind: 'hand', reason: 'owed-step', at: 2};
    expect(conclusionRefusalOf('card-actions'), 'the card centre still holds on its nested step').to.eq('nested-step');
    expect(conclusionRefusalOf('hand')).to.eq('owed-step');
    expect(conclusionRefusalOf('colonies'), 'a workspace that never refused').to.eq('unknown');
  });

  it('the session\'s end forgets every refusal', () => {
    conclusionRefusal.byKind.set('parliament', {reason: 'live-outcome', at: 3});
    conclusionRefusal.last = {kind: 'parliament', reason: 'live-outcome', at: 3};
    resetConclusionRefusal();
    expect(conclusionRefusalOf('parliament')).to.eq('unknown');
    expect(conclusionRefusal.last).to.eq(undefined);
  });
});
