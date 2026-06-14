import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {Units} from '@/common/Units';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {getCard} from '@/client/cards/ClientCardManifest';
import {allScopeEffectCardNames} from '@/client/components/effects/effectExtraction';
import {getEffectSummary, EffectSummaryContext} from '@/client/components/effects/effectSummary';

/**
 * Coverage guard (mirrors `actionReasonCoverage` / `cardPlayPreviewCoverage`): for
 * EVERY in-scope effect card, the summary in its WORST case (no events recorded
 * yet) must NOT be a dead empty state — it must carry a headline, an impact line,
 * or a thematic note. This is the machine-checkable version of the audit: a new
 * expansion card that resolves to nothing FAILS here with its name in the list.
 */
function emptyStat(name: CardName, isCorporation: boolean): EffectOverlayStat {
  return {
    sourceKey: (isCorporation ? 'corporation:' : 'card:') + name,
    kind: isCorporation ? 'corporation' : 'card',
    card: name,
    triggerCount: 0,
    megacreditsSaved: 0,
    cardsDrawn: 0,
    stock: Units.EMPTY,
    production: Units.EMPTY,
    cardResources: {},
    paymentResources: {},
    tr: 0,
    globalParameterSteps: {},
    vp: 0,
  };
}

describe('effect summary coverage', () => {
  it('every in-scope effect card resolves to a non-dead summary (headline / lines / note)', () => {
    const dead: Array<CardName> = [];
    for (const name of allScopeEffectCardNames()) {
      const card = getCard(name);
      const isCorporation = card?.type === CardType.CORPORATION;
      const ctx: EffectSummaryContext = {
        sourceName: name,
        sourceKind: isCorporation ? 'corporation' : 'card',
        cardResourceType: card?.resourceType,
      };
      const vm = getEffectSummary(emptyStat(name, isCorporation), ctx);
      const usable = vm.headline !== undefined || vm.lines.length > 0 || vm.note !== undefined;
      if (!usable) {
        dead.push(name);
      }
    }
    expect(dead, `effects with a dead summary (add a CARD_HEADLINE / EFFECT_SUMMARY_NOTES or a provider): ${dead.join(', ')}`)
      .to.have.length(0);
  });

  it('an empty effect always carries a thematic note (never a bare panel)', () => {
    for (const name of allScopeEffectCardNames()) {
      const card = getCard(name);
      const isCorporation = card?.type === CardType.CORPORATION;
      const vm = getEffectSummary(emptyStat(name, isCorporation), {
        sourceName: name,
        sourceKind: isCorporation ? 'corporation' : 'card',
        cardResourceType: card?.resourceType,
      });
      // With no events the stat is empty, so the note must be present.
      expect(vm.empty, `${name} should be empty with no events`).to.be.true;
      expect(vm.note, `${name} is missing a thematic note`).to.not.be.undefined;
    }
  });
});
