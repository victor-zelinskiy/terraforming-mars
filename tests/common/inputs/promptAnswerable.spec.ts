import {expect} from 'chai';
import {unanswerableReason} from '../../../src/common/inputs/promptAnswerable';
import {PlayerInputModel} from '../../../src/common/models/PlayerInputModel';

/**
 * A QUESTION NOBODY CAN ANSWER (docs/claude/console/freeze-zero/PLAN.md §4 — `src/common/inputs/promptAnswerable.ts`):
 * the one freeze no net of the console sees — the surface stands, the pad is taken, and there is no answer. The judge
 * is conservative: only what is unanswerable by construction.
 */
describe('promptAnswerable — a question nobody can answer', () => {
  const base = {title: 'x', buttonLabel: 'ok'};
  const card = (cards: number, min: number, extra: object = {}) => ({...base, type: 'card', cards: Array.from({length: cards}, (_, i) => ({name: `c${i}`})), min, max: Math.max(min, 1), ...extra}) as unknown as PlayerInputModel;
  const option = () => ({...base, type: 'option'}) as unknown as PlayerInputModel;
  const or = (...options: Array<PlayerInputModel>) => ({...base, type: 'or', options}) as unknown as PlayerInputModel;
  const and = (...options: Array<PlayerInputModel>) => ({...base, type: 'and', options}) as unknown as PlayerInputModel;
  const space = (spaces: number, cancellable?: boolean) =>
    ({...base, type: 'space', spaces: Array.from({length: spaces}, (_, i) => String(i)), ...(cancellable === undefined ? {} : {placementContext: {cancellable}})}) as unknown as PlayerInputModel;

  it('an ordinary question is answerable — and nothing asked is nothing to judge', () => {
    expect(unanswerableReason(undefined)).to.eq(undefined);
    expect(unanswerableReason(card(3, 1))).to.eq(undefined);
    expect(unanswerableReason(option())).to.eq(undefined);
    expect(unanswerableReason(space(4))).to.eq(undefined);
    expect(unanswerableReason(or(option(), card(0, 1))), 'one live branch is an answer').to.eq(undefined);
  });

  it('«pick N cards» of fewer than N — and «pick up to N» of none is still an answer (the empty one)', () => {
    expect(unanswerableReason(card(0, 1))).to.eq('1 card(s) asked of 0');
    expect(unanswerableReason(card(1, 2))).to.eq('2 card(s) asked of 1');
    expect(unanswerableReason(card(0, 0)), 'min 0: «none» is an answer').to.eq(undefined);
    expect(unanswerableReason({...base, type: 'projectCard', cards: []} as unknown as PlayerInputModel)).to.match(/empty list/);
  });

  it('a cell with no legal cell — unless the placement may be cancelled', () => {
    expect(unanswerableReason(space(0))).to.eq('a cell asked with no legal cell');
    expect(unanswerableReason(space(0, false))).to.eq('a cell asked with no legal cell');
    expect(unanswerableReason(space(0, true)), 'the cancel is the answer').to.eq(undefined);
  });

  it('nobody / nothing to choose, an impossible amount', () => {
    expect(unanswerableReason({...base, type: 'player', players: []} as unknown as PlayerInputModel)).to.match(/nobody/);
    expect(unanswerableReason({...base, type: 'party', parties: []} as unknown as PlayerInputModel)).to.match(/none to choose/);
    expect(unanswerableReason({...base, type: 'amount', min: 2, max: 1} as unknown as PlayerInputModel)).to.eq('an amount asked between 2 and 1');
    expect(unanswerableReason({...base, type: 'amount', min: 0, max: 0} as unknown as PlayerInputModel), '«zero» is an answer').to.eq(undefined);
  });

  it('an OR is dead only when EVERY branch is; an AND when ANY part is', () => {
    expect(unanswerableReason(or())).to.eq('an OR with no branch');
    expect(unanswerableReason(or(card(0, 1), space(0)))).to.match(/^every branch of the OR is unanswerable/);
    expect(unanswerableReason(and(option(), card(0, 1)))).to.match(/^a part of the AND is unanswerable \(1 card\(s\) asked of 0\)/);
    expect(unanswerableReason(and(option(), card(2, 1)))).to.eq(undefined);
    // …nested: an AND whose one part is an OR with a live branch is alive.
    expect(unanswerableReason(and(or(card(0, 1), option()), card(1, 1)))).to.eq(undefined);
  });

  it('an OPTIONAL prompt is never judged — the page does not wait on it', () => {
    expect(unanswerableReason(card(0, 1, {optional: true}))).to.eq(undefined);
  });

  it('a kind the judge does not know is never called dead', () => {
    expect(unanswerableReason({...base, type: 'payment', amount: 5} as unknown as PlayerInputModel)).to.eq(undefined);
    expect(unanswerableReason({...base, type: 'colony', coloniesModel: []} as unknown as PlayerInputModel)).to.eq(undefined);
  });
});
