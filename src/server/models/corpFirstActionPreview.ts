import {IPlayer} from '../IPlayer';
import {CardName} from '../../common/cards/CardName';
import {ICorporationCard} from '../cards/corporation/ICorporationCard';
import {ActionPreview} from '../../common/models/ActionPreviewModel';
import {effectsForBehavior, stepsForBehavior} from './actionPreview';

/**
 * READ-ONLY preview of a corporation's MANDATORY FIRST ACTION — the
 * first-action analog of `cardPlayPreview` (`src/server/models/cardPlayPreview.ts`).
 * It lets the console's dedicated first-action confirm modal show WHAT the
 * mandatory action grants (resource / draw / global chips) and WHAT follows
 * confirming (a board placement, a colony-tile pick, an award pick) BEFORE the
 * `corporationInitialAction` OrOptions option is submitted.
 *
 * Strategy mirrors the established bespoke → declarative → dynamic split:
 *   1. BESPOKE `initialAction` overrides supply it via the co-located
 *      `ICorporationCard.firstActionPreview?(player)` hook (built from the
 *      shared `actionPreviews.ts` builders — `firstActionBranch` + notes/chips).
 *   2. DECLARATIVE corps (`firstAction` behavior) auto-derive from the SAME
 *      generic `effectsForBehavior` / `stepsForBehavior` walkers the play
 *      preview uses (no parallel system) — a draw shows its `+N cards` chip, a
 *      city/greenery/colony placement its honest post-confirm step.
 *   3. Otherwise → a single confirm-only branch (honest fallback; the action's
 *      own prompts ride the native follow-up routing). The coverage guard
 *      (`tests/models/corpFirstActionPreview.spec.ts`) fails on any in-scope
 *      corp that lands here, so this stays an out-of-scope escape hatch.
 *
 * NOTHING here mutates game state — only read-only checks + model construction.
 */

/**
 * WHICH corporation may have its first action previewed right now: one the
 * player still OWES the action for (`pendingInitialActions` — the same list the
 * `corporationInitialAction` OrOptions is built from). Everything else →
 * undefined (the route answers notFound). Read-only.
 */
export function previewableFirstActionCorp(player: IPlayer, name: CardName): ICorporationCard | undefined {
  return player.pendingInitialActions.find((corp) => corp.name === name);
}

export function corpFirstActionPreview(player: IPlayer, corp: ICorporationCard): ActionPreview {
  if (corp.firstActionPreview !== undefined) {
    return corp.firstActionPreview(player);
  }

  const base = {
    card: corp.name,
    isCorporation: true,
    cardResource: corp.resourceType !== undefined ? {type: corp.resourceType, count: corp.resourceCount} : undefined,
  };

  const behavior = corp.firstAction;
  if (behavior !== undefined) {
    // The mandatory action is ALWAYS available (the prompt exists because the
    // player owes it) — a single branch, no availability gate.
    return {
      ...base,
      kind: 'declarative',
      branches: [{
        index: -1,
        title: '',
        available: true,
        renderKeys: [],
        effects: effectsForBehavior(player, corp, behavior),
        steps: stepsForBehavior(player, corp, behavior),
      }],
    };
  }

  // Bespoke initialAction with no hook: a single confirm-only branch. The
  // action's own prompts flow through the existing follow-up routing.
  return {
    ...base,
    kind: 'dynamic',
    branches: [{index: -1, title: '', available: true, renderKeys: [], effects: [], steps: []}],
  };
}
