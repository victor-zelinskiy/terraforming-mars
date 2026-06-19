import {Units} from '@/common/Units';
import {CardName} from '@/common/cards/CardName';
import {InputResponse, AndOptionsResponse, SelectAmountResponse} from '@/common/inputs/InputResponse';

/**
 * PURE response-building for the Venus alt-track bonus modal (VenusBonusContent).
 * Extracted from the component so the exact InputResponse shapes the client
 * submits are unit-testable without a DOM (runs under the server test runner).
 *
 * The shapes mirror the restructured `GrantVenusAltTrackBonusDeferred`:
 *   - standard:        {type:'and', responses:[6 amounts]}
 *   - final/standard:  {type:'or', index:1, response:{and 6 amounts (base + wild)}}
 *   - final/card:      {type:'or', index:0, response:{and [{card}, {and base}]}}
 */

export type VenusWildChoice =
  | {kind: 'standard', resource: keyof Units}
  | {kind: 'card', card: CardName};

/** A GainResources (AndOptions of 6 SelectAmount) response, in unit order. */
export function venusAmountsResponse(units: Units): AndOptionsResponse {
  const responses: Array<SelectAmountResponse> = Units.keys.map((k) => ({type: 'amount', amount: units[k]}));
  return {type: 'and', responses};
}

export function buildVenusBonusResponse(
  isFinal: boolean,
  base: Units,
  wild: VenusWildChoice | undefined,
): InputResponse {
  if (!isFinal) {
    return venusAmountsResponse(base);
  }
  if (wild?.kind === 'standard') {
    // The wild standard resource is indistinguishable from a base standard
    // resource, so fold it into the base distribution (branch 1 = base + 1).
    const combined = Units.of(base);
    combined[wild.resource] += 1;
    return {type: 'or', index: 1, response: venusAmountsResponse(combined)};
  }
  if (wild?.kind === 'card') {
    return {
      type: 'or',
      index: 0,
      response: {type: 'and', responses: [{type: 'card', cards: [wild.card]}, venusAmountsResponse(base)]},
    };
  }
  // Unreachable when confirm is gated on a complete wild choice; submit base only.
  return venusAmountsResponse(base);
}
