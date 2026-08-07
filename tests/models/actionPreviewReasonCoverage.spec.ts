import {expect} from 'chai';
import {testGame} from '../TestGame';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {isIActionCard, ICard, IActionCard} from '../../src/server/cards/ICard';
import {GameModule} from '../../src/common/cards/GameModule';
import {actionPreview} from '../../src/server/models/actionPreview';

const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares']);

/**
 * The BEHAVIOURAL guard for preview-branch reasons: for every in-scope action
 * card, any branch the server marks `available: false` MUST carry a
 * `unavailableReason`.
 *
 * Why behavioural and not a source sniff: the surfaces that render these branches
 * (the repeat picker, the action confirm modal, the console action composer)
 * deliberately IGNORE the card-level `actionReasons` and show the BRANCH reason
 * only — so a blank branch is a blank screen. 18 `singleBranch` callers had a
 * co-located `actionUnavailableReason` hook and simply never threaded it; the
 * fallback now lives inside `singleBranch` / `dynamic` / the declarative
 * single-action path, and this spec is what keeps it there.
 *
 * The fixture is a fresh 2-player game with an empty tableau and 0 M€ — the state
 * in which the most cards are blocked, so the most branches are exercised.
 */
describe('action-preview reason coverage', () => {
  it('every unavailable preview BRANCH carries a reason', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 0;
    const gaps: Array<string> = [];
    let blockedBranches = 0;
    let cardsWalked = 0;
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
          let preview;
          try {
            preview = actionPreview(player, card as ICard & IActionCard);
          } catch {
            // A card whose preview needs richer state than this bare fixture
            // (an expansion object, a played tableau) — out of this guard's reach.
            continue;
          }
          cardsWalked++;
          for (const branch of preview.branches) {
            if (branch.available) {
              continue;
            }
            blockedBranches++;
            const reason = branch.unavailableReason;
            const empty = reason === undefined ||
              (typeof reason === 'string' && reason.trim() === '');
            if (empty) {
              gaps.push(`${card.name} [${manifest.module}] branch "${branch.title || '(single)'}"`);
            }
          }
        }
      }
    }
    // Anti-vacuous floors: this guard is worthless if it walked nothing or found
    // nothing blocked. Both counts are what make a green run mean something.
    expect(cardsWalked, 'no action cards previewed — the manifest walk broke?').is.greaterThan(50);
    expect(blockedBranches, 'no blocked branches found — the fixture stopped blocking?').is.greaterThan(20);
    expect(gaps, `unavailable branches with NO reason (the client can only print a generic there):\n  ${gaps.join('\n  ')}`)
      .to.have.length(0);
  });
});
