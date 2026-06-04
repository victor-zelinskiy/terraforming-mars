import {DisabledOptionModel, OptionMetadata} from '../../common/models/PlayerInputModel';
import {Resource} from '../../common/Resource';
import {CardResource} from '../../common/CardResource';
import {Message} from '../../common/logs/Message';
import {message} from '../logs/MessageBuilder';
import {IPlayer} from '../IPlayer';

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

/** "Remove N <resource> from <player>" — destructive, target preview. */
export function removeResourceFromPlayer(target: IPlayer, resource: Resource, amount: number, current: number): OptionMetadata {
  return {
    kind: 'resourceRemoval',
    icon: RESOURCE_ICON[resource],
    amount,
    player: {color: target.color, current, resulting: Math.max(0, current - amount)},
  };
}

/** "Steal N <resource> from <player>" — like removal but tagged as a steal. */
export function stealResourceFromPlayer(target: IPlayer, resource: Resource, amount: number, current: number): OptionMetadata {
  return {
    kind: 'steal',
    icon: RESOURCE_ICON[resource],
    amount,
    player: {color: target.color, current, resulting: Math.max(0, current - amount)},
  };
}

/** "Gain N <resource>". */
export function gainResource(resource: Resource, amount: number): OptionMetadata {
  return {kind: 'resourceGain', icon: RESOURCE_ICON[resource], amount};
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

/** A "do nothing / skip" option. */
export function skip(): OptionMetadata {
  return {kind: 'skip'};
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
