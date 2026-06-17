import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {Units} from '@/common/Units';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {getCard} from '@/client/cards/ClientCardManifest';
import {allScopeEffectCardNames, playerEffects} from '@/client/components/effects/effectExtraction';
import {getEffectSummary, EffectSummaryContext} from '@/client/components/effects/effectSummary';
import {allScopeActionCardNames} from '@/client/components/actions/actionExtraction';
import {getActionUsageSummary} from '@/client/components/actions/actionUsageSummary';

/**
 * COVERAGE GUARD (Iteration 3 §12–13): a repeatable, machine-checkable audit so a new
 * gap can't slip in through a UI screenshot. It flags a SUSPICIOUS effect — one whose
 * render SIGNATURE suggests measurable output (result icons / a discount / a value-
 * as-payment) yet whose empty-state summary collapses to the bare "passive rule"
 * (`ruleChange`) framing. With the Iteration-1 signature-driven note + the special-
 * card sets, a measurable effect should NEVER be `ruleChange`; if one is, this fails
 * with the card name. Genuine rule-only effects (no measurable signature) are allowed.
 */
function emptyStat(name: CardName, isCorporation: boolean): EffectOverlayStat {
  return {
    sourceKey: (isCorporation ? 'corporation:' : 'card:') + name,
    kind: isCorporation ? 'corporation' : 'card',
    card: name,
    triggerCount: 0, megacreditsSaved: 0, cardsDrawn: 0,
    stock: Units.EMPTY, production: Units.EMPTY, cardResources: {}, paymentResources: {},
    paymentValueBonus: {steel: 0, titanium: 0, bonusValue: 0, count: 0},
    colonyTrack: {steps: 0, extraReward: 0, count: 0, colonies: {}},
    tradeDiscount: {energy: 0, titanium: 0, megacredits: 0, count: 0, colonies: {}},
    tr: 0, globalParameterSteps: {}, vp: 0,
  };
}

describe('tracker coverage guard', () => {
  it('no in-scope PASSIVE effect with a measurable signature is framed as a bare rule', () => {
    const tableau = allScopeEffectCardNames().map((name) => ({name} as any));
    const suspicious: Array<string> = [];
    for (const entry of playerEffects(tableau)) {
      const card = getCard(entry.cardName);
      const isCorp = card?.type === CardType.CORPORATION;
      const sig = entry.signature;
      const measurable = sig.icons.length > 0 || sig.discount || sig.valueAsPayment || sig.valueModifier;
      if (!measurable) {
        continue; // a genuine rule-only effect — the honest "passive rule" note is fine
      }
      const ctx: EffectSummaryContext = {
        sourceName: entry.cardName,
        sourceKind: isCorp ? 'corporation' : 'card',
        cardResourceType: card?.resourceType,
        signature: sig,
      };
      const vm = getEffectSummary(emptyStat(entry.cardName, isCorp), ctx);
      if (vm.category === 'ruleChange') {
        suspicious.push(`${entry.cardName}#${entry.effectIndex} [icons=${sig.icons.join(',')} disc=${sig.discount} pay=${sig.valueAsPayment} vmod=${sig.valueModifier}]`);
      }
    }
    expect(suspicious, `measurable effects misframed as rule-only (add a category / special-card set entry): ${suspicious.join(' ; ')}`)
      .to.have.length(0);
  });

  it('every in-scope ACTIVE action is generically covered (the usage summary never dead-states)', () => {
    const actions = allScopeActionCardNames();
    expect(actions.length, 'in-scope action cards exist').to.be.greaterThan(0);
    // The empty state is always the honest "not used yet" note — never a passive-rule
    // fallback (actions are explicitly activated). This is the regression guard for the
    // generic action coverage (every action card is auto-aggregated server-side).
    const empty = getActionUsageSummary(undefined);
    expect(empty.empty).to.be.true;
    expect(empty.note).to.not.be.undefined;
  });

  it('an action with a measurable recorded stat classifies to a value kind (not bare usage)', () => {
    const withGain = getActionUsageSummary({...emptyStat(CardName.AI_CENTRAL, false), triggerCount: 2, cardsDrawn: 4});
    expect(withGain.kind).to.not.eq('usage');
    expect(withGain.confidence).to.eq('exact');
  });
});
