import {expect} from 'chai';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {isIActionCard, ICard} from '../../src/server/cards/ICard';
import {GameModule} from '../../src/common/cards/GameModule';

const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares']);

// A card whose canAct is literally `return true` can never be unavailable, so it
// never needs a reason. Detect by source (despaced) ending in `return true}`.
function alwaysActs(card: ICard & {canAct: (...a: Array<unknown>) => boolean}): boolean {
  return card.canAct.toString().replace(/\s/g, '').endsWith('returntrue}');
}

describe('action-reason coverage', () => {
  it('every in-scope action card that can be unavailable has a SPECIFIC reason source', () => {
    const gaps: Array<string> = [];
    for (const manifest of ALL_MODULE_MANIFESTS) {
      if (!SCOPE.has(manifest.module)) {
        continue;
      }
      for (const group of [manifest.projectCards, manifest.corporationCards, manifest.preludeCards]) {
        for (const name of Object.keys(group)) {
          const Factory = (group as Record<string, {Factory: new () => ICard}>)[name]?.Factory;
          if (Factory === undefined) {
            continue;
          }
          let card: ICard;
          try {
            card = new Factory();
          } catch {
            continue;
          }
          if (!isIActionCard(card)) {
            continue;
          }
          const declarative = (card as {actionBehavior?: unknown}).actionBehavior !== undefined;
          const hasHook = typeof (card as {actionUnavailableReason?: unknown}).actionUnavailableReason === 'function';
          // A declarative behavior scan OR a co-located `actionUnavailableReason`
          // hook counts as a specific reason source. Always-acts cards are exempt
          // (they can never be unavailable).
          const covered = declarative || hasHook ||
            alwaysActs(card as ICard & {canAct: (...a: Array<unknown>) => boolean});
          if (!covered) {
            gaps.push(`${card.name} [${manifest.module}]`);
          }
        }
      }
    }
    expect(gaps, `action cards with only the generic fallback:\n  ${gaps.join('\n  ')}`).to.have.length(0);
  });
});
