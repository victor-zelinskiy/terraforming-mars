import {DisabledOptionModel, OptionMetadata} from '../../common/models/PlayerInputModel';
import {ActionEffect} from '../../common/models/ActionPreviewModel';
import {Resource} from '../../common/Resource';
import {CardResource} from '../../common/CardResource';
import {Message} from '../../common/logs/Message';
import {message} from '../logs/MessageBuilder';
import {IPlayer} from '../IPlayer';
import {computeTargetImpact, computeCardResourceTargetImpact} from './targetImpact';

/**
 * Factory helpers for the OPTIONAL `OptionMetadata` attached to a SelectOption
 * (see `SelectOption.withMetadata`). They keep card code free of boilerplate —
 * a card describes WHAT the option does and the helper produces the structured
 * metadata the premium client (ModernOptionPicker) renders as a rich choice
 * card (icon + player chip + current → resulting preview). Everything is
 * optional: an option with no metadata still renders via the text fallback.
 *
 * Add a new factory here for each recurring pattern rather than hand-building
 * metadata at the call site.
 */

// Standard resources map 1:1 to a client resource icon key.
const RESOURCE_ICON: Record<Resource, string> = {
  megacredits: 'megacredits',
  steel: 'steel',
  titanium: 'titanium',
  plants: 'plants',
  energy: 'energy',
  heat: 'heat',
};

/** "Remove N <resource> from <player>" — destructive, target preview. The
 *  SERVER-computed `changes` render the ACTUAL loss (a MarsBot drops M€, not the
 *  named resource); `current`/`resulting` stay as the client fallback. */
export function removeResourceFromPlayer(target: IPlayer, resource: Resource, amount: number, current: number): OptionMetadata {
  return {
    kind: 'resourceRemoval',
    icon: RESOURCE_ICON[resource],
    amount,
    player: {color: target.color, current, resulting: Math.max(0, current - amount),
      changes: computeTargetImpact(target, resource, amount, 'stock').changes},
  };
}

/** "Steal N <resource> from <player>" — like removal but tagged as a steal. */
export function stealResourceFromPlayer(target: IPlayer, resource: Resource, amount: number, current: number): OptionMetadata {
  return {
    kind: 'steal',
    icon: RESOURCE_ICON[resource],
    amount,
    player: {color: target.color, current, resulting: Math.max(0, current - amount),
      changes: computeTargetImpact(target, resource, amount, 'stock').changes},
  };
}

/** "Gain N <resource>". */
export function gainResource(resource: Resource, amount: number): OptionMetadata {
  return {kind: 'resourceGain', icon: RESOURCE_ICON[resource], amount};
}

/**
 * "Gain N PRODUCTION of <resource>" — a self production increase. Shows the
 * resource icon as the lead anchor + a mint production chip with the viewer's
 * current → resulting production (note 'production'), so a "pick which production
 * to raise" choice (e.g. the Mining Area / Mining Rights placement bonus that can
 * land on a cell carrying BOTH a steel and a titanium bonus) reads premium —
 * icons + before/after — instead of a bare resource name.
 */
export function gainProduction(player: IPlayer, resource: Resource, amount: number): OptionMetadata {
  const current = player.production.get(resource);
  return {
    kind: 'resourceGain',
    icon: RESOURCE_ICON[resource],
    amount,
    effects: [{
      direction: 'gain',
      icon: RESOURCE_ICON[resource],
      amount,
      current,
      resulting: current + amount,
      note: 'production',
    }],
  };
}

/** Raise a global parameter — `icon` is 'temperature' | 'venus' | 'oxygen' | 'oceans'. */
export function globalParameter(icon: string, steps: number, current: number, resulting: number, unit?: string): OptionMetadata {
  return {kind: 'globalParameter', icon, amount: steps, global: {current, resulting, unit}};
}

/**
 * Icon-key (client `card-resource-<key>` suffix) for a card resource. The
 * generic transform (lowercase, spaces→hyphens) matches every in-scope card
 * resource; only the out-of-scope fan card RESOURCE_CUBE differs (drops the
 * 'resource' word) — mirror `cardResourceCSS` if you ever need it.
 */
function cardResourceIconKey(cardResource: CardResource): string {
  return cardResource.toLowerCase().replace(/ /g, '-');
}

/** "Add N <cardResource> to a card." */
export function addResourceToCard(cardResource: CardResource, amount: number = 1): OptionMetadata {
  return {kind: 'resourceGain', icon: cardResourceIconKey(cardResource), amount};
}

/** "Remove N <cardResource> from a card" (often to gain something else). */
export function removeResourceFromCard(cardResource: CardResource, amount: number = 1): OptionMetadata {
  return {kind: 'resourceRemoval', icon: cardResourceIconKey(cardResource), amount};
}

/**
 * "Remove N <cardResource> from <player>" as a PLAYER-target — the card-resource
 * analog of `removeResourceFromPlayer`. Only MarsBot is ever a card-resource
 * player-target (a human's live on cards): the SERVER-computed `changes` render
 * the ACTUAL loss (its Colonies storage of the type, e.g. Enceladus microbes,
 * then the M€-supply proxy), exactly like a standard-resource attack. `current`
 * is the bot's attackable stock (storage + supply) for the client fallback.
 */
export function removeCardResourceFromPlayer(target: IPlayer, cardResource: CardResource, amount: number, current: number): OptionMetadata {
  return {
    kind: 'resourceRemoval',
    icon: cardResourceIconKey(cardResource),
    amount,
    player: {color: target.color, current, resulting: Math.max(0, current - amount),
      changes: computeCardResourceTargetImpact(target, cardResource, amount).changes},
  };
}

/** A "do nothing / skip" option. */
export function skip(): OptionMetadata {
  return {kind: 'skip'};
}

/**
 * A single RESULT/COST chip for an option's premium preview (reuses the
 * `ActionEffect` shape so the client renders it with the shared `ActionEffectChip`).
 * `icon` is an icon-key (a standard resource, a global parameter, a card resource,
 * or the pseudo-keys `tr` / `cards`). Pass `current`/`resulting` for a
 * `current → resulting` preview, `unit` (`'°C'`/`'%'`) for parameters.
 */
export function chip(direction: 'gain' | 'cost', icon: string, amount: number, extra?: Partial<ActionEffect>): ActionEffect {
  return {direction, icon, amount, ...extra};
}

/** A "+N TR" gain chip. */
export function trChip(amount: number): ActionEffect {
  return {direction: 'gain', icon: 'tr', amount};
}

/**
 * Build OPTION metadata that shows premium RESULT chips (+ an optional non-numeric
 * `tradeoff` downside line and a clarifying `description`). The flagship use is an
 * apply-or-skip choice with a real cost (Pharmacy Union: gain 3 TR BUT flip the
 * card face down).
 */
export function optionResult(opts: {
  kind?: OptionMetadata['kind'],
  effects?: ReadonlyArray<ActionEffect>,
  tradeoff?: string | Message,
  description?: string | Message,
  icon?: string,
  amount?: number,
}): OptionMetadata {
  return {
    kind: opts.kind ?? 'resourceGain',
    icon: opts.icon,
    amount: opts.amount,
    effects: opts.effects,
    tradeoff: opts.tradeoff,
    description: opts.description,
  };
}

/**
 * An informational, non-selectable OrOptions entry for a player target that's
 * relevant but unavailable right now (e.g. an opponent with no plants). Renders
 * as a greyed twin of a real target card: player chip + (greyed) icon + reason.
 * `icon` is optional (omit when no single resource applies, e.g. Sabotage).
 */
export function disabledPlayerTarget(target: IPlayer, icon: string | undefined, reason: string | Message): DisabledOptionModel {
  return {
    title: message('${0}', (b) => b.player(target)),
    metadata: {kind: 'playerTarget', icon, player: {color: target.color}},
    reason,
  };
}
