import {expect} from 'chai';
import {branchOutcomeClaimPlan} from '@/client/console/actionPreviewStore';
import {ActionPreview} from '@/common/models/ActionPreviewModel';

/*
 * THE CLAIM SIZES THE TABLE THE CARDS LIE ON — `expectedCards` is what leaves the DECK.
 *
 * The action composer prepares one slot per promised card before anything moves (the batch flies straight into its
 * final rects). A LOOK («all the data → as many cards off the deck, keep 1» — TR46 Research Startups) turns over
 * `revealed` cards and keeps `amount`; sized by the kept count the stage dealt ONE slot, read «Вскрываем карту», and on
 * an answer slower than the launch flew one card before the pick laid out five (the stall iteration, 2026-10-14).
 */
describe('branchOutcomeClaimPlan — the prepared arrival is sized by the cards that leave the deck', () => {
  const preview = (effects: Array<Record<string, unknown>>) => ({
    branches: [{index: 0, effects}],
  } as unknown as ActionPreview);

  it('a plain draw of N prepares N', () => {
    const plan = branchOutcomeClaimPlan(preview([{direction: 'gain', icon: 'cards', amount: 2}]), 0);
    expect(plan.expectedCards).eq(2);
    expect(plan.kinds).deep.eq(['draw', 'pick']);
  });

  it('a LOOK prepares every card it turns over, not the one it keeps', () => {
    const plan = branchOutcomeClaimPlan(preview([{direction: 'gain', icon: 'cards', amount: 1, look: {revealed: 5, keep: 1}}]), 0);
    expect(plan.expectedCards).eq(5);
  });

  it('no cards gained → no draw claim', () => {
    const plan = branchOutcomeClaimPlan(preview([{direction: 'gain', icon: 'megacredits', amount: 3}]), 0);
    expect(plan.expectedCards).eq(0);
    expect(plan.kinds).deep.eq([]);
  });

  it('a SPLIT REVEAL (P88) claims draw + pick and prepares every card it turns over — never a deck-check', () => {
    const split = {branches: [{index: -1, effects: [], revealSplit: {deck: 'project', count: 2, check: {tag: 'venus', label: 'Venus tag'},
      match: {destination: 'hand', free: true}, miss: {kind: 'buy', cardCost: 3, affordable: 1}, deckSize: 40}}]} as unknown as ActionPreview;
    const plan = branchOutcomeClaimPlan(split, -1);
    expect(plan.expectedCards).eq(2);
    expect(plan.kinds).deep.eq(['draw', 'pick']);
  });

  it('a Venus step that earns the alternative board’s bonus claims the step (P89 · EE); a plain one claims nothing', () => {
    const bonus = {direction: 'gain', icon: 'venus', amount: 2, current: 16, resulting: 18, altVenusBonus: {standard: 1, wild: false, from: 16, to: 18}};
    expect(branchOutcomeClaimPlan(preview([bonus]) as unknown as ActionPreview, 0).kinds).deep.eq(['venus-bonus']);
    expect(branchOutcomeClaimPlan(preview([{...bonus, altVenusBonus: undefined}]) as unknown as ActionPreview, 0).kinds).deep.eq([]);
    // …beside a draw: both — the draw's stage hosts the bonus too.
    const both = branchOutcomeClaimPlan(preview([bonus, {direction: 'gain', icon: 'cards', amount: 1}]) as unknown as ActionPreview, 0);
    expect(both.kinds).deep.eq(['draw', 'pick', 'venus-bonus']);
  });

  it('a bonus the composer PRE-SELECTED (the branch\'s own `venusBonus` step) claims no stage — no prompt will stand (P89 · EL)', () => {
    const bonus = {direction: 'gain', icon: 'venus', amount: 2, current: 16, resulting: 18, altVenusBonus: {standard: 1, wild: false, from: 16, to: 18}};
    const withStep = {branches: [{index: 0, effects: [bonus], steps: [{kind: 'venusBonus', input: {type: 'and'}}]}]};
    expect(branchOutcomeClaimPlan(withStep as unknown as ActionPreview, 0).kinds).deep.eq([]);
  });
});
