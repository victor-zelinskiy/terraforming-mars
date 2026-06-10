import {IPlayer} from '../IPlayer';
import {ICard} from '../cards/ICard';
import {IProjectCard} from '../cards/IProjectCard';
import {Behavior, TitledBehavior} from '../behavior/Behavior';
import {CardType} from '../../common/cards/CardType';
import {ActionPreview, ActionPreviewBranch} from '../../common/models/ActionPreviewModel';
import {effectsForBehavior, stepsForBehavior, subAvailability} from './actionPreview';

/**
 * READ-ONLY preview of PLAYING a project card — the analog of `actionPreview`
 * (`src/server/models/actionPreview.ts`) but for a card's ON-PLAY behavior
 * (`card.behavior`) instead of its repeatable action (`card.actionBehavior`). It
 * lets the play modal (`HandCardPaymentContent.vue`) show the on-play effects
 * (resource / production / global-parameter / TR / draw chips) and host the
 * interactive target choices BEFORE the card is submitted, then submit the play
 * + the choices as ONE batch request (no follow-up modal spam).
 *
 * Strategy mirrors actionPreview's bespoke → declarative → dynamic split:
 *   1. BESPOKE cards supply it via the co-located `ICard.cardPlayPreview?(player)`
 *      hook (built from the shared `actionPreviews.ts` builders).
 *   2. DECLARATIVE cards auto-derive from `card.behavior` using the SAME generic
 *      `effectsForBehavior` / `stepsForBehavior` walkers the action preview uses
 *      (no parallel system).
 *   3. Otherwise (a bespoke `bespokePlay` with no hook and no behavior) → a single
 *      confirm-only branch; the card's own prompts ride the post-batch follow-up
 *      routing (the existing premium modal / PlacementBanner / overlay surfaces).
 *
 * NOTHING here mutates game state. It never calls `Executor.execute`/`canExecute`
 * — only read-only checks + pure model construction (each step uses a deferred
 * action's read-only `previewSelect*`).
 */
export function cardPlayPreview(player: IPlayer, card: ICard & IProjectCard): ActionPreview {
  if (card.cardPlayPreview !== undefined) {
    return card.cardPlayPreview(player);
  }

  const base = {
    card: card.name,
    isCorporation: card.type === CardType.CORPORATION,
    cardResource: card.resourceType !== undefined ? {type: card.resourceType, count: card.resourceCount} : undefined,
  };

  const behavior = card.behavior;
  if (behavior !== undefined) {
    return {...base, kind: 'declarative', branches: deriveCardPlayBranches(player, card, behavior)};
  }

  // Bespoke `bespokePlay` with no hook: a single confirm-only branch. Whatever
  // prompts the card produces flow through the existing post-batch routing.
  return {
    ...base,
    kind: 'dynamic',
    branches: [{index: -1, title: '', available: true, renderKeys: [], effects: [], steps: []}],
  };
}

function deriveCardPlayBranches(player: IPlayer, card: ICard & IProjectCard, behavior: Behavior): ReadonlyArray<ActionPreviewBranch> {
  // On-play `behavior.or` → one branch per sub-behavior (uncommon for project
  // cards; the live path defers an OrOptions after play). The runtime OrOptions
  // index is the position among EXECUTABLE subs (Executor.execute filters then
  // maps); when `autoSelect` collapses a lone executable sub, that branch is
  // resolved WITHOUT an OrOptions, so it gets index -1.
  if (behavior.or !== undefined) {
    const subs: ReadonlyArray<TitledBehavior> = behavior.or.behaviors;
    const availabilities = subs.map((sub) => subAvailability(player, card, sub));
    const availableCount = availabilities.filter((a) => a.available).length;
    const autoResolve = behavior.or.autoSelect === true && availableCount === 1;
    let runtimeIdx = 0;
    return subs.map((sub, i): ActionPreviewBranch => {
      const a = availabilities[i];
      const index = (a.available && !autoResolve) ? runtimeIdx : -1;
      if (a.available) {
        runtimeIdx++;
      }
      return {
        index,
        title: sub.title,
        available: a.available,
        unavailableReason: a.reason?.message,
        renderKeys: [String(i)],
        effects: effectsForBehavior(player, card, sub),
        steps: a.available ? stepsForBehavior(player, card, sub) : [],
      };
    });
  }

  // The common case: the whole on-play behavior is ONE branch (no pick). The card
  // is already in getPlayableCards() (the route gate), so it's available; the
  // play itself is response[0], assembled client-side (not part of this preview).
  return [{
    index: -1,
    title: '',
    available: true,
    renderKeys: [],
    effects: effectsForBehavior(player, card, behavior),
    steps: stepsForBehavior(player, card, behavior),
  }];
}
