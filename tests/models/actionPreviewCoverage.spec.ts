import {expect} from 'chai';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {isIActionCard, ICard, IActionCard} from '../../src/server/cards/ICard';
import {GameModule} from '../../src/common/cards/GameModule';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {CardName} from '../../src/common/cards/CardName';
import {ActionPreviewBranch} from '../../src/common/models/ActionPreviewModel';
import {testGame} from '../TestGame';
import {fakeCard} from '../TestingUtils';
import {actionPreview} from '../../src/server/models/actionPreview';

const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares']);

/** Iterate every constructable in-scope action card. */
function forEachActionCard(fn: (card: ICard & IActionCard, module: GameModule) => void): void {
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
        if (isIActionCard(card)) {
          fn(card as ICard & IActionCard, manifest.module);
        }
      }
    }
  }
}

/**
 * A MUTE branch is one that would render as a bare "Confirm to perform" with NO
 * premium info in the console composer / desktop confirm — the exact failure the
 * console iteration must eliminate: an AVAILABLE branch with no cost/gain chips,
 * no interactive step, no direct input, no reveal, AND no descriptive title. A
 * note-only branch (a board / colony follow-up) has a `note` step → not mute; a
 * branch with a MEANINGFUL TITLE (e.g. AstroDrill's "Gain a standard resource",
 * whose resource type is a post-submit nested OrOptions — desktop-parity thin) is
 * NOT mute (the composer renders the title). An UNAVAILABLE branch is exempt.
 */
function isMuteBranch(b: ActionPreviewBranch): boolean {
  const title = typeof b.title === 'string' ? b.title : b.title.message;
  return b.available === true &&
    title === '' &&
    b.effects.length === 0 &&
    b.steps.length === 0 &&
    b.optionInput === undefined &&
    b.reveal === undefined &&
    b.mergeCardSteps === undefined;
}

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

  /**
   * PREMIUM RENDER GUARD (the console iteration's contract): with the player
   * given resources so every branch that CAN be available is, NO in-scope action
   * card may produce a MUTE branch — every activatable variant must carry premium
   * content (cost/gain chips, an interactive step, a direct input, or a reveal),
   * so the console composer + desktop confirm always show icons + before→after,
   * never a bare "Confirm to perform". Catches a `dynamic` card that should have
   * a hook (JovianLanterns / BioengineeringEnclosure regressions) or a thin hook.
   */
  it('every in-scope action card renders PREMIUM (no mute branch)', () => {
    const mute: Array<string> = [];
    forEachActionCard((card, module) => {
      const [/* game */, player] = testGame(2);
      // Resource the player so branches gated on affordability / stock become
      // available (a fresh player leaves most branches unavailable → exempt).
      for (const r of [Resource.MEGACREDITS, Resource.STEEL, Resource.TITANIUM, Resource.PLANTS, Resource.ENERGY, Resource.HEAT]) {
        player.stock.add(r, 50);
        player.production.add(r, 8);
      }
      // Give the player tags of every kind, so a per-tag variable effect
      // (OrbitalCleanup "gain 1 M€ per science tag", …) computes NON-zero and
      // emits its chip — otherwise it reads mute ONLY because of the empty test
      // board, not by design.
      for (let i = 0; i < 3; i++) {
        player.playedCards.push(fakeCard({
          name: `Tag Bearer ${i}` as CardName,
          tags: [Tag.SCIENCE, Tag.SPACE, Tag.JOVIAN, Tag.EARTH, Tag.VENUS, Tag.BUILDING, Tag.MICROBE, Tag.PLANT, Tag.ANIMAL, Tag.CITY, Tag.POWER, Tag.MOON, Tag.WILD],
        }));
      }
      player.playedCards.push(card);
      if (card.resourceType !== undefined) {
        (card as {resourceCount: number}).resourceCount = 6;
      }
      let preview;
      try {
        preview = actionPreview(player, card);
      } catch {
        return; // the non-throwing guard above owns preview errors
      }
      for (const b of preview.branches) {
        if (isMuteBranch(b)) {
          mute.push(`${card.name} [${module}] branch#${b.index}`);
        }
      }
    });
    expect(mute, `MUTE branches (would render a bare confirm — add a hook / effects):\n  ${mute.join('\n  ')}`).to.have.length(0);
  });
});
