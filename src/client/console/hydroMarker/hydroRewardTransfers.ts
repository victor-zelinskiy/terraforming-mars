/*
 * HYDRO REWARD TRANSFERS — map a computed Гидросеть reward view into the
 * resource-transfer specs that fly to the left panel when the marker locks
 * on its stage (Part 2 of the hydro polish). The engineering sibling of the
 * tile-placement reward beat: same shared framework, same delayed-visual
 * commit (the panel reward hold), only the source is the freshly-reached
 * track stop instead of a placed tile.
 *
 * Only GAINS that land in the ALWAYS-VISIBLE resource panel become chips:
 *   - a standard resource gain  → a stock chip (steel / plants);
 *   - a production gain         → a production chip (M€/titanium/energy/heat);
 *   - the pos-9 animals reward  → a card-resource chip onto the pre-chosen
 *     host card (falls back to the additional-resources satellite / no flight
 *     if it isn't on screen — the framework degrades honestly).
 * A Jovian TAG (pos 8) is a tag, VP (pos 10/11) is endgame, and the flow
 * rewards (draw-4-keep-2 / reuse-action) resolve in their own premium beat —
 * none of those has a panel metric, so they ride the ordinary commit with no
 * chip (their delta chips, if any, fire normally).
 *
 * PURE — no Vue / DOM / i18n; unit-tested by hydroRewardTransfers.spec.ts.
 */
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {
  ResourceTransferSpec, cardResourceKey, mergeTransferSpecs,
} from '@/client/console/resourceTransfer/resourceTransferModel';
import {HydroRewardView} from '@/client/components/hydronetwork/hydroReward';

/**
 * The specs the reward wave should fly for the granted reward. The view is
 * already resolved (the choice for pos 1/2 and the animal target for pos 9 are
 * baked in by buildRewardView), so the specs are EXACTLY what the commit
 * grants — never a speculation.
 */
export function hydroRewardTransfers(view: HydroRewardView): Array<ResourceTransferSpec> {
  const specs: Array<ResourceTransferSpec> = [];
  for (const line of view.lines) {
    if (line.delta <= 0) {
      continue;
    }
    if (line.special === 'animals') {
      // The animal target card was pre-selected in the action zone; without a
      // named card there is nowhere honest to land, so no chip.
      if (line.cardName !== undefined) {
        specs.push({
          channel: 'card-resource',
          resource: cardResourceKey(CardResource.ANIMAL),
          amount: line.delta,
          targetCard: line.cardName as CardName,
        });
      }
      continue;
    }
    if (line.special === 'jovian-tag') {
      continue; // a tag — no panel metric to fly to
    }
    if (line.resource !== undefined) {
      specs.push({
        channel: line.production === true ? 'production' : 'stock',
        resource: line.resource,
        amount: line.delta,
      });
    }
  }
  return mergeTransferSpecs(specs);
}
