import {expect} from 'chai';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {isIActionCard, ICard, IActionCard} from '../../src/server/cards/ICard';
import {GameModule} from '../../src/common/cards/GameModule';
import {testGame} from '../TestGame';
import {actionPreview} from '../../src/server/models/actionPreview';

const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude']);

/**
 * Every in-scope action card must produce a VALID, NON-THROWING preview (the
 * read-only data the confirmation modal + overlay split consume). Catches a bad
 * hook (a wrong helper call, a missing import resolved at runtime, a malformed
 * branch) across the whole scope in one shot.
 */
describe('action-preview coverage', () => {
  it('every in-scope action card produces a valid, non-throwing preview', () => {
    const failures: Array<string> = [];
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
          const [/* game */, player] = testGame(2);
          player.playedCards.push(card);
          try {
            const preview = actionPreview(player, card as ICard & IActionCard);
            if (preview.branches.length === 0) {
              failures.push(`${card.name} [${manifest.module}]: no branches`);
              continue;
            }
            for (const b of preview.branches) {
              if (typeof b.index !== 'number' || typeof b.available !== 'boolean' || b.effects === undefined || b.steps === undefined) {
                failures.push(`${card.name} [${manifest.module}]: malformed branch`);
                break;
              }
            }
          } catch (e) {
            failures.push(`${card.name} [${manifest.module}]: threw ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }
    }
    expect(failures, `cards with a broken preview:\n  ${failures.join('\n  ')}`).to.have.length(0);
  });
});
