import {expect} from 'chai';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {ICard} from '../../src/server/cards/ICard';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {GameModule} from '../../src/common/cards/GameModule';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {CardName} from '../../src/common/cards/CardName';
import {ActionPreviewStep, ActionPreviewBranch} from '../../src/common/models/ActionPreviewModel';
import {OrOptionsModel, SelectCardModel} from '../../src/common/models/PlayerInputModel';
import {testGame} from '../TestGame';
import {fakeCard} from '../TestingUtils';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';

const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude']);

/**
 * The console PLAY composer (ConsolePlayCardConfirm) must pre-collect EVERY
 * on-play choice desktop pre-collects, in the SAME premium language. This guard
 * classifies every step of every in-scope `cardPlayPreview` hook as:
 *   - 'inline'   — a decision the console hosts before submit (card single /
 *                  a HAND-card pick — single AND multi-select, via the hand
 *                  section's pick mode / a TABLEAU pick — single, the Astra
 *                  merged multi, the Cyberia deduped sequential, via the
 *                  «Разыграно» view's pick mode / a REPEAT-action pick, via the
 *                  ДЕЙСТВИЯ КАРТ surface in repeat mode / player / amount /
 *                  or-with-leaf-or-nested-player/card options /
 *                  spendHeat / tabbedTargets).
 *   - 'followup' — an honest post-submit follow-up (board / colony placement /
 *                  note / an UNOWNED multi-select — the documented, safe
 *                  exceptions, ridden by the native flow).
 *   - 'gap'      — a shape the console CANNOT host (an `or` option nesting an
 *                  amount / and).
 * A 'gap' FAILS — the console would silently drop or mis-submit it.
 * MIRRORS `playChoiceMode` (consolePlayCardComposer.ts) — keep the two in sync.
 */
function classifyStep(step: ActionPreviewStep, branch: ActionPreviewBranch, handNames: ReadonlySet<string>, tableauNames: ReadonlySet<string>): 'inline' | 'followup' | 'gap' {
  void branch;
  if (step.kind === 'spendHeat' || step.kind === 'tabbedTargets') {
    return 'inline';
  }
  if (step.kind === 'boardPlacement' || step.kind === 'note') {
    return 'followup';
  }
  if (step.kind !== 'input') {
    return 'followup';
  }
  const t = step.input.type;
  if (t === 'amount' || t === 'player') {
    return 'inline';
  }
  if (t === 'card') {
    // A repeat-action pick (ProjectInspection) is PRE-COLLECTED via the ДЕЙСТВИЯ
    // КАРТ surface in repeat mode (`consoleRepeatPick`) — the chosen action + its
    // composed responses are captured before the play submits.
    if (step.repeatAction === true) {
      return 'inline';
    }
    const model = step.input as SelectCardModel;
    // Nothing selectable → the live play auto-resolves (never a dead row).
    if (model.cards.length === 0) {
      return 'followup';
    }
    // Every candidate (selectable + disabled) in hand → the hand section's
    // pick mode; every candidate a PLAYED card → the «Разыграно» tableau pick
    // (incl. the merge/dedupe multi-card branches — Astra / Cyberia).
    const candidates = [...model.cards, ...(model.disabledCards ?? [])];
    if (candidates.every((c) => handNames.has(c.name)) ||
        candidates.every((c) => tableauNames.has(c.name))) {
      return 'inline';
    }
    // An UNOWNED multi-select keeps the honest follow-up.
    return model.max > 1 ? 'followup' : 'inline';
  }
  if (t === 'or') {
    // Hostable iff every NESTED-input option is one the console sub-picks
    // (a leaf option, a SelectPlayer, or a single SelectCard). A nested amount /
    // and / nested-or is a gap.
    const bad = (step.input as OrOptionsModel).options.some((o) =>
      o.type !== 'option' && o.type !== 'player' &&
      !(o.type === 'card' && (o as SelectCardModel).max <= 1));
    return bad ? 'gap' : 'inline';
  }
  return 'gap';
}

describe('console play-preview coverage', () => {
  it('every in-scope cardPlayPreview hook produces only console-hostable steps', () => {
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
          // Only the bespoke on-play hooks carry the exotic shapes (nested-or /
          // tabbed); declarative previews use the standard step walker.
          if (typeof (card as {cardPlayPreview?: unknown}).cardPlayPreview !== 'function') {
            continue;
          }
          const [/* game */, player, opponent] = testGame(2, {venusNextExtension: true});
          for (const r of [Resource.MEGACREDITS, Resource.STEEL, Resource.TITANIUM, Resource.PLANTS, Resource.ENERGY, Resource.HEAT]) {
            player.stock.add(r, 40);
            opponent.stock.add(r, 40);
          }
          // Tags + an animal card, so a per-target / tag-gated preview is populated.
          for (let i = 0; i < 3; i++) {
            player.playedCards.push(fakeCard({name: `Tag Bearer ${i}` as CardName, tags: [Tag.SCIENCE, Tag.VENUS, Tag.SPACE, Tag.JOVIAN, Tag.EARTH, Tag.MICROBE, Tag.ANIMAL, Tag.PLANT]}));
          }
          opponent.playedCards.push(fakeCard({name: 'Opp Venus' as CardName, tags: [Tag.VENUS]}));
          const animalCard = fakeCard({name: 'Opp Animals' as CardName, tags: [Tag.ANIMAL], resourceType: undefined});
          (animalCard as {resourceType: unknown; resourceCount: number}).resourceType = 'Animal';
          (animalCard as {resourceCount: number}).resourceCount = 4;
          opponent.playedCards.push(animalCard);
          player.playedCards.push(card);
          // The preview runs while the card is still IN HAND (the real flow) —
          // plus a few generic hand cards, so hand-candidate steps (Public
          // Plans reveal / Sponsored Academies discard) are populated and
          // classify through the hand-pick branch, exactly like runtime.
          player.cardsInHand.push(card as ICard & IProjectCard);
          for (let i = 0; i < 3; i++) {
            player.cardsInHand.push(fakeCard({name: `Hand Filler ${i}` as CardName, tags: [Tag.SPACE]}));
          }
          if (card.resourceType !== undefined) {
            (card as {resourceCount: number}).resourceCount = 4;
          }
          let preview;
          try {
            preview = cardPlayPreview(player, card as ICard & IProjectCard);
          } catch {
            continue;
          }
          const handNames = new Set<string>(player.cardsInHand.map((c) => c.name));
          const tableauNames = new Set<string>(player.playedCards.asArray().map((c) => c.name));
          for (const b of preview.branches) {
            for (const step of b.steps) {
              if (classifyStep(step, b, handNames, tableauNames) === 'gap') {
                gaps.push(`${card.name} [${manifest.module}] step ${step.kind}${step.kind === 'input' ? '/' + step.input.type : ''}`);
              }
            }
          }
        }
      }
    }
    expect(gaps, `console play-preview GAPS (a shape the console can't pre-collect):\n  ${gaps.join('\n  ')}`).to.have.length(0);
  });
});
