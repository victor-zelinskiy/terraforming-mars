import {expect} from 'chai';
import {testGame} from '../TestGame';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {ICard} from '../../src/server/cards/ICard';
import {GameModule} from '../../src/common/cards/GameModule';
import {unplayableReasons} from '../../src/server/models/unplayableReasons';
import {CEOsFavoriteProject} from '../../src/server/cards/base/CEOsFavoriteProject';

const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares']);

/**
 * True when the card's OWN class prototype defines `method` (a per-card override),
 * as opposed to inheriting it from a framework base (`Card` / `ActionCard` /
 * `CorporationCard` / `ActivePreludeCard`, all of which run `canExecute(...)`).
 * Robust to WHICH base the card extends — we only care whether the card itself
 * replaced the method.
 */
function definesOwnMethod(card: object, method: string): boolean {
  return Object.prototype.hasOwnProperty.call(Object.getPrototypeOf(card), method);
}

function eachScopeCard(fn: (card: ICard, module: GameModule) => void): void {
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
        fn(card, manifest.module);
      }
    }
  }
}

describe('card unavailability reason consistency', () => {
  // The invariant that keeps the reason mirrors honest. `unplayableReasons` /
  // `actionUnavailableReasons` derive the shown reason by WALKING a card's
  // DECLARATIVE behavior (`behavior` / `actionBehavior`) and mirroring the
  // executor's checks. That is only truthful because `Card.canPlay` = requirements
  // AND `canExecute(behavior)` AND `bespokeCanPlay`, and `ActionCard.canAct` =
  // `canExecute(action)` AND `bespokeCanAct` — the declarative check is ALWAYS a
  // necessary condition, so a reason derived from it is always a real blocker.
  //
  // A card that DEFINES ITS OWN full `canPlay` / `canAct` (instead of the
  // `bespokeCanPlay` / `bespokeCanAct` hooks) could SKIP or RELAX the
  // `canExecute(behavior/action)` check while STILL declaring the behavior — then
  // the mirror could surface a reason that isn't the real blocker (the exact class
  // of bug the placement 'occupied'→adjacency fix addressed). Declarative-behavior
  // cards must customize availability via the bespoke hooks; a genuinely bespoke
  // card must drop the declarative property and provide an `unplayableReason` /
  // `actionUnavailableReason` hook instead. This guard fails if that invariant is
  // ever broken (a new card or an upstream merge), so the mirror can't silently lie.
  it('no in-scope card overrides canPlay/canAct while declaring a declarative behavior/action', () => {
    const violations: Array<string> = [];
    eachScopeCard((card, module) => {
      if (card.behavior !== undefined && definesOwnMethod(card, 'canPlay')) {
        violations.push(`${card.name} [${module}] — declares \`behavior\` AND overrides \`canPlay\` (use bespokeCanPlay, or drop the behavior + add an unplayableReason hook)`);
      }
      if (card.actionBehavior !== undefined && definesOwnMethod(card, 'canAct')) {
        violations.push(`${card.name} [${module}] — declares \`action\` AND overrides \`canAct\` (use bespokeCanAct, or drop the action + add an actionUnavailableReason hook)`);
      }
    });
    expect(violations, `cards whose reason mirror could surface a wrong reason:\n  ${violations.join('\n  ')}`).to.have.length(0);
  });

  // Regression: a PLAY card that MUST add a card-resource to some card
  // (mustHaveCard) is unplayable when no owned card can hold it. `unplayableReasons`
  // now mirrors that executor check, so the reason is the specific target one, NOT
  // the generic "unmet conditions" fallback.
  it('CEO\'s Favorite Project surfaces the specific "no card" target reason (not the generic fallback)', () => {
    const [/* game */, player] = testGame(2);
    const card = new CEOsFavoriteProject();
    player.megaCredits = 5; // affordable (cost 1) — so affordability is not the blocker

    // No resource-holding card in play → nowhere to add the resource → unplayable.
    expect(player.canPlay(card), 'card is genuinely unplayable').is.false;

    const reasons = unplayableReasons(player, card);
    expect(reasons.some((r) => r.type === 'target' && r.message === 'No card to add the resource to'),
      'shows the specific target reason').is.true;
    expect(reasons.some((r) => r.message === 'Card is unavailable due to unmet conditions'),
      'does not fall back to the generic reason').is.false;
  });
});
