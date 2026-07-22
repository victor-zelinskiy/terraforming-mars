import {expect} from 'chai';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {Units} from '@/common/Units';
import {buildActionInspectHistory} from '@/client/components/actions/actionInspectHistory';
import {ActionBranchScope} from '@/client/components/actions/actionUsageSummary';

const noUnits = (): Units => ({megacredits: 0, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0});

function stat(over: Partial<EffectOverlayStat>): EffectOverlayStat {
  return {
    sourceKey: 'card:X',
    kind: 'card',
    card: 'X' as never,
    triggerCount: 0,
    megacreditsSaved: 0,
    cardsDrawn: 0,
    stock: noUnits(),
    production: noUnits(),
    cardResources: {},
    paymentResources: {},
    paymentValueBonus: {} as never,
    colonyTrack: {} as never,
    tradeDiscount: {} as never,
    greeneryDiscount: {} as never,
    tr: 0,
    globalParameterSteps: {},
    vp: 0,
    ...over,
  };
}

describe('buildActionInspectHistory (fullscreen inspect ИСТОРИЯ)', () => {
  it('splits card-wide facts from the action footprint', () => {
    const h = buildActionInspectHistory(
      stat({triggerCount: 3, tr: 2, lastTrigger: {generation: 5, impact: {} as never}}),
      undefined,
      {icon: 'floaters', count: 2},
      {index: 1, total: 2},
    );
    // Card block: activation total + last generation + the stored resource.
    expect(h.card.hasAny).to.be.true;
    expect(h.card.activations).to.eq(3);
    expect(h.card.lastGeneration).to.eq(5);
    expect(h.card.stored).to.deep.eq({icon: 'floaters', count: 2});
    // Action block: the selected option's own footprint (the +2 TR line).
    expect(h.action.empty).to.be.false;
    expect(h.action.lines.some((l) => l.label === 'TR' && l.value === '+2')).to.be.true;
    // The option context (variant 2/2) is carried for multi-action cards.
    expect(h.option).to.deep.eq({index: 1, total: 2});
  });

  it('a card with NO stat and NO stored resource has no history', () => {
    const h = buildActionInspectHistory(undefined, undefined, undefined, {index: 0, total: 1});
    expect(h.card.hasAny).to.be.false;
    expect(h.card.activations).to.eq(0);
    expect(h.card.lastGeneration).to.be.undefined;
    expect(h.card.stored).to.be.undefined;
    // The action block reads "not used yet" — never a dead state.
    expect(h.action.empty).to.be.true;
    expect(h.action.note).to.be.a('string');
  });

  it('a resource-less card that fired shows card history but no stored line', () => {
    const h = buildActionInspectHistory(
      stat({triggerCount: 1, stock: {...noUnits(), plants: 3}, lastTrigger: {generation: 2, impact: {} as never}}),
      undefined,
      undefined,
      {index: 0, total: 1},
    );
    expect(h.card.hasAny).to.be.true;
    expect(h.card.stored).to.be.undefined;
    expect(h.card.activations).to.eq(1);
    expect(h.action.lines.some((l) => l.label === 'Gained' && l.value === '+3')).to.be.true;
  });

  it('a card that stores a resource but never fired: card history via the stored count', () => {
    const h = buildActionInspectHistory(undefined, undefined, {icon: 'microbes', count: 4}, {index: 0, total: 1});
    expect(h.card.hasAny).to.be.true; // the stored resource IS card history
    expect(h.card.activations).to.eq(0);
    expect(h.card.stored).to.deep.eq({icon: 'microbes', count: 4});
    expect(h.action.empty).to.be.true;
  });

  it('a single-action card carries no option context (no «Вариант N/M»)', () => {
    const h = buildActionInspectHistory(stat({triggerCount: 1}), undefined, undefined, {index: 0, total: 1});
    expect(h.option).to.be.undefined;
  });

  it('a multi-branch action scopes the footprint but keeps card-level activations', () => {
    // A card whose aggregate holds BOTH branches' outcomes (floaters added +
    // cards drawn); scoping to the "add floater" branch drops the draw line,
    // but the activation total stays card-level (cardScoped caption).
    const scope: ActionBranchScope = {mineTokens: ['cardres:floaters'], siblingTokens: ['cards']};
    const h = buildActionInspectHistory(
      stat({triggerCount: 4, cardsDrawn: 2, cardResources: {Floater: 5} as never}),
      scope,
      {icon: 'floaters', count: 5},
      {index: 0, total: 2},
    );
    expect(h.card.activations).to.eq(4); // card total, never split
    expect(h.action.cardScoped).to.be.true;
    // The sibling "Cards drawn" line is filtered out of this branch.
    expect(h.action.lines.some((l) => l.label === 'Cards drawn')).to.be.false;
    expect(h.action.lines.some((l) => l.label === 'Added')).to.be.true;
  });
});
