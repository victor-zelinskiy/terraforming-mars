import {CardModel} from '@/common/models/CardModel';
import {MarsBotModel} from '@/common/models/MarsBotModel';
import {additionalResourceGroups} from '@/client/components/additionalResources/additionalResources';
import {marsBotExtraGroups, MarsBotExtrasContext} from '@/client/components/console/marsBotRailModel';
import {cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';

/**
 * The ДОП.РЕСУРСЫ satellite chips of the INSPECTED seat, as the summary
 * focus ring sees them: `key` matches the satellite cell's own
 * `data-exr-type` (the extras explorer's type key), `label` is the
 * resource-type name (an English i18n key — «Asteroids», «Floaters», …).
 *
 * SAME derivation as the rail satellite (`ConsoleResourcePanel.auxCells`)
 * over the SAME sources (`additionalResourceGroups` / `marsBotExtraGroups`
 * with the game-shape context), so the ring's chip order and the painted
 * column can never disagree. Used by the shell (per-chip cursor navigation,
 * the semantic-focus preservation across LB/RB and the A route) and by the
 * Information host (the «A Открыть: <ресурс>» bar hint).
 */
export type InfoExtrasChip = {key: string, label: string};

export function infoExtrasChips(
  viewed: {tableau: ReadonlyArray<CardModel>, isMarsBot?: boolean},
  automa: MarsBotModel | undefined,
  ctx?: MarsBotExtrasContext,
): ReadonlyArray<InfoExtrasChip> {
  if (viewed.isMarsBot === true && automa !== undefined) {
    return marsBotExtraGroups(automa, ctx).map((g) => ({key: g.key, label: g.label}));
  }
  return additionalResourceGroups(viewed.tableau)
    .map((g) => ({key: cardResourceKey(g.resource), label: g.resource}));
}
