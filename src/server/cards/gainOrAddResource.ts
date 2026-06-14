import {IPlayer} from '../IPlayer';
import {ICard} from './ICard';
import {OrOptions} from '../inputs/OrOptions';
import {SelectOption} from '../inputs/SelectOption';
import {PlayerInput} from '../PlayerInput';
import {Resource} from '../../common/Resource';
import {CardResource} from '../../common/CardResource';
import {Priority} from '../deferredActions/Priority';
import {AddResourcesToCard} from '../deferredActions/AddResourcesToCard';
import {ActionPreview, ActionEffect} from '../../common/models/ActionPreviewModel';
import {effectsForBehavior, stepsForBehavior} from '../models/actionPreview';
import * as actionPreviews from './actionPreviews';

/*
 * Shared, DRIFT-FREE builder for the on-play "gain <fallback resource> OR add
 * <card-resource> to ANOTHER card" choice (Imported Hydrogen, Large Convoy, Local
 * Heat Trapping). It produces BOTH halves from one spec so the live OrOptions and
 * the read-only play-modal preview can never disagree:
 *   - `gainOrAddResourceChoice` — the LIVE OrOptions `bespokePlay` presents.
 *   - `gainOrAddResourceBranches` — the matching `orBranches` preview the play
 *      modal renders (every alternative shown, the ones with no target card shown
 *      DISABLED with a clear reason — the fork's no-hidden-autoselect rule).
 *
 * The point of this whole change: when the player has no card to hold animals /
 * microbes, the play modal used to silently auto-gain the fallback and hide the
 * alternatives. Now it shows all of them, disabled-with-reason, and the result of
 * each — while the available choice is still pre-collected in the modal.
 */

/** "Gain N <resource>" fallback (always available) — the stock-gain branch. */
export type GainSpec = {resource: Resource, amount: number};
/** "Add N <card-resource> to ANOTHER card" alternative — available only when the
 *  player holds a card that can store that resource. */
export type AddSpec = {resource: CardResource, amount: number};

// Count-free titles/labels (v-i18n keys): the COUNT rides the effect chip / picker
// impact, so one key per resource avoids per-count Russian declension.
const GAIN_TITLE: Partial<Record<Resource, string>> = {
  [Resource.PLANTS]: 'Gain plants',
};
const ADD_TITLE: Partial<Record<CardResource, string>> = {
  [CardResource.MICROBE]: 'Add microbes to a card',
  [CardResource.ANIMAL]: 'Add animals to a card',
  [CardResource.FLOATER]: 'Add floaters to a card',
};
const ADD_LABEL: Partial<Record<CardResource, string>> = {
  [CardResource.MICROBE]: 'Add microbes',
  [CardResource.ANIMAL]: 'Add animals',
  [CardResource.FLOATER]: 'Add floaters',
};
const NO_TARGET_REASON: Partial<Record<CardResource, string>> = {
  [CardResource.MICROBE]: 'You have no card that can store microbes',
  [CardResource.ANIMAL]: 'You have no card that can store animals',
  [CardResource.FLOATER]: 'You have no card that can store floaters',
};

function gainTitle(resource: Resource): string {
  return GAIN_TITLE[resource] ?? 'Gain resources';
}
function addTitle(resource: CardResource): string {
  return ADD_TITLE[resource] ?? 'Add resources to a card';
}
function addLabel(resource: CardResource): string {
  return ADD_LABEL[resource] ?? 'Add resources';
}
function noTargetReason(resource: CardResource): string {
  return NO_TARGET_REASON[resource] ?? 'You have no card that can store this resource';
}

/** Whether ANY add-alternative currently has a valid target card. When false the
 *  card should gain the fallback directly (no choice). */
export function hasAddTarget(player: IPlayer, adds: ReadonlyArray<AddSpec>): boolean {
  return adds.some((a) => player.getResourceCards(a.resource).length > 0);
}

/**
 * The LIVE choice: a "gain <fallback>" option + one "add <resource> to a card"
 * option per alternative whose target exists. Each add option defers an
 * `AddResourcesToCard` (autoSelect:false → ALWAYS ask which card, even a single
 * candidate) at `PLAY_CARD_RESOURCE_CHOICE`, so the pick lands BEFORE any tile
 * placement the card also queues and the play modal can pre-collect it. SIDE-
 * EFFECT FREE to BUILD (mutations are in the andThen callbacks), shared with the
 * preview. The CALLER defers/returns it (Imported Hydrogen / Large Convoy defer it
 * at `PLAY_CARD_RESOURCE_CHOICE`; Local Heat Trapping returns it through spendHeat).
 */
export function gainOrAddResourceChoice(player: IPlayer, gain: GainSpec, adds: ReadonlyArray<AddSpec>): OrOptions {
  const options: Array<PlayerInput> = [];
  options.push(new SelectOption(gainTitle(gain.resource), gainTitle(gain.resource)).andThen(() => {
    player.stock.add(gain.resource, gain.amount, {log: true});
    return undefined;
  }));
  for (const add of adds) {
    if (player.getResourceCards(add.resource).length === 0) {
      continue;
    }
    options.push(new SelectOption(addTitle(add.resource), addLabel(add.resource)).andThen(() => {
      // Defer the target pick AT the play-choice priority (ahead of any tile the
      // card queues) — overriding AddResourcesToCard's default GAIN priority, which
      // would otherwise land AFTER the ocean and break the modal's batched pick.
      const action = new AddResourcesToCard(player, add.resource, {count: add.amount, autoSelect: false, log: true});
      action.priority = Priority.PLAY_CARD_RESOURCE_CHOICE;
      player.game.defer(action);
      return undefined;
    }));
  }
  return new OrOptions(...options);
}

/**
 * The READ-ONLY preview branches the play modal renders: the "gain" branch (always
 * available) + one branch per add-alternative, shown DISABLED with a reason when no
 * target card exists. `prefixEffects` (e.g. Local Heat Trapping's −5 heat) and the
 * card's declarative `behavior` effect chips (Large Convoy's draw 2) prepend to
 * every branch; the behavior's board-placement steps (the ocean note) append, so
 * each option reads as its COMPLETE outcome. The runtime OR indices are computed by
 * `orBranches` to match `gainOrAddResourceChoice` exactly: the gain is option 0 and
 * each available add follows in order (a lone-available gain auto-resolves to index
 * -1 — the no-target case, where `bespokePlay` gains the fallback with no OrOptions).
 */
export function gainOrAddResourceBranches(
  player: IPlayer,
  card: ICard,
  gain: GainSpec,
  adds: ReadonlyArray<AddSpec>,
  opts: {prefixEffects?: ReadonlyArray<ActionEffect>} = {},
): ActionPreview {
  const behaviorEffects = card.behavior !== undefined ? effectsForBehavior(player, card, card.behavior) : [];
  const behaviorSteps = card.behavior !== undefined ? stepsForBehavior(player, card, card.behavior) : [];
  const prefix = [...(opts.prefixEffects ?? []), ...behaviorEffects];

  const specs: Array<actionPreviews.BranchSpec> = [];
  specs.push({
    available: true,
    title: gainTitle(gain.resource),
    effects: [...prefix, actionPreviews.stockGain(player, gain.resource, gain.amount)],
    steps: [...behaviorSteps],
  });
  for (const add of adds) {
    const available = player.getResourceCards(add.resource).length > 0;
    specs.push({
      available,
      title: addTitle(add.resource),
      effects: [...prefix, actionPreviews.cardResourceGain(add.resource, add.amount)],
      unavailableReason: available ? undefined : noTargetReason(add.resource),
      // The target picker (the AddResourcesToCard SelectCard) FIRST, then the
      // shared board-placement note — matching the live prompt order (the pick is
      // deferred at PLAY_CARD_RESOURCE_CHOICE, before the ocean).
      steps: available ? [actionPreviews.addToCardStep(player, add.resource, {count: add.amount}), ...behaviorSteps] : [],
    });
  }
  return actionPreviews.orBranches(card, specs);
}
