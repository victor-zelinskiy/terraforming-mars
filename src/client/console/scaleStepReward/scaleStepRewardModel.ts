/*
 * «ШАГ ШКАЛЫ ПЛАТИТ» — the pure half of the scene of a card that answers EACH
 * STEP OF A SCALE, whoever made it (Turmoil Redux TR24 Venusian Census: +2 data
 * per Venus step; Aphrodite: +2 M€; docs/TURMOIL_REDUX_VENUSIAN_CENSUS.md).
 *
 * THE GRAMMAR: the step is the CAUSE, the payout its CONSEQUENCE. The scale's
 * marker glides to the division the step reached (the board's own beat — the
 * board-beat park's drain when the board was covered), and only once it has
 * ARRIVED are the tokens born at its rim — one physical token per unit of a
 * card resource, one chip per step of a stock payment — and they land where
 * the owner's resource lives (the viewer's own: the «ДОП. РЕСУРСЫ» satellite's
 * cell / the rail's row; another seat's: their chip in the status strip). The
 * counter ticks on each TOUCHDOWN, never before.
 *
 * Everything here is pure (no DOM, no Vue): which records are new in a
 * response (the SERVER's ring, `GameModel.scaleStepRewards`, consumed once by
 * `seq`), the tokens of a record, the panel hold a record seeds, and where the
 * tokens are born around the marker.
 */
import {GlobalParameter} from '@/common/GlobalParameter';
import {ScaleStepRewardModel} from '@/common/models/ScaleStepRewardModel';
import {ScaleMarkerAccent} from '@/client/components/board/scaleMarkerArrival';
import {ResourceTransferSpec, TransferPoint, cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';

/** The board's marker accent of a scale (`undefined` for a parameter with no dial cursor of its own). */
export function scaleAccentOf(parameter: GlobalParameter): ScaleMarkerAccent | undefined {
  switch (parameter) {
  case GlobalParameter.VENUS: return 'venus';
  case GlobalParameter.OXYGEN: return 'oxygen';
  case GlobalParameter.TEMPERATURE: return 'temperature';
  default: return undefined;
  }
}

/** The park's key of a scale's PRESENTED value (`HeldGlobalParams`). */
export function scaleParamKeyOf(parameter: GlobalParameter): 'venusScaleLevel' | 'oxygenLevel' | 'temperature' | undefined {
  switch (parameter) {
  case GlobalParameter.VENUS: return 'venusScaleLevel';
  case GlobalParameter.OXYGEN: return 'oxygenLevel';
  case GlobalParameter.TEMPERATURE: return 'temperature';
  default: return undefined;
  }
}

/**
 * The records NEW in this response: in the applied ring and not in the one
 * before it, oldest first (the ring's own order — the engine's payout order).
 * A first view (a reload) has no «before» and claims nothing: the ring is a
 * memory of the server's last moves, never a script to replay.
 */
export function freshScaleStepRewards(
  before: ReadonlyArray<ScaleStepRewardModel> | undefined,
  after: ReadonlyArray<ScaleStepRewardModel> | undefined,
  hadBefore: boolean,
): Array<ScaleStepRewardModel> {
  if (!hadBefore || after === undefined || after.length === 0) {
    return [];
  }
  const known = new Set((before ?? []).map((r) => r.seq));
  return after.filter((r) => !known.has(r.seq) && r.gain.amount > 0).sort((a, b) => a.seq - b.seq);
}

/** The owner's panel hold for a record — the whole gain, released token by token on the touchdowns. */
export function scaleStepHoldSpec(record: ScaleStepRewardModel): ResourceTransferSpec {
  return record.gain.kind === 'cardResource' ?
    {channel: 'card-resource', resource: cardResourceKey(record.gain.resource), amount: record.gain.amount} :
    {channel: 'stock', resource: record.gain.resource, amount: record.gain.amount};
}

/**
 * THE TOKENS of a record, in the order they leave the marker: a card resource
 * is counted, so ONE TOKEN PER UNIT (Venusian Census: 2 data per step → two
 * tokens a step); a stock payment is money, so ONE CHIP PER STEP carrying that
 * step's amount (Aphrodite: «+2» per Venus step) — a step that does not divide
 * evenly flies as one chip of the whole.
 */
export function scaleStepTokenSpecs(record: ScaleStepRewardModel): Array<ResourceTransferSpec> {
  const gain = record.gain;
  if (gain.kind === 'cardResource') {
    const resource = cardResourceKey(gain.resource);
    return Array.from({length: gain.amount}, () => ({channel: 'card-resource' as const, resource, amount: 1}));
  }
  const steps = Math.max(1, record.steps);
  if (gain.amount % steps !== 0) {
    return [{channel: 'stock', resource: gain.resource, amount: gain.amount}];
  }
  return Array.from({length: steps}, () => ({channel: 'stock' as const, resource: gain.resource, amount: gain.amount / steps}));
}

export type MarkerRect = {x: number, y: number, w: number, h: number};

/**
 * Where each token is BORN: on the marker's own rim, inside its box (a token's
 * first painted frame is in the marker), fanned evenly over the rim's upper
 * half — the side that faces the HUD the tokens fly to — so two tokens never
 * sit on one another.
 */
export function scaleStepTokenOrigins(marker: MarkerRect, n: number): Array<TransferPoint> {
  const cx = marker.x + marker.w / 2;
  const cy = marker.y + marker.h / 2;
  const r = Math.min(marker.w, marker.h) * 0.3;
  if (n <= 1) {
    return [{x: cx, y: cy - r}];
  }
  const out: Array<TransferPoint> = [];
  for (let i = 0; i < n; i++) {
    // From the upper-left to the upper-right of the rim (−150° … −30°).
    const a = (-150 + (120 * i) / (n - 1)) * Math.PI / 180;
    out.push({x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r});
  }
  return out;
}

/** The breath between the marker's arrival and the first token — the settle accent's own beat, never a lag. */
export const SCALE_STEP_BREATH_MS = 140;
/**
 * The longest a record waits for its stage (the board watchable, the park's
 * value released, the marker arrived) before it degrades honestly — the
 * counters tick, nothing flies. Past the park's own 30 s safety, so a park
 * that releases without the show is answered first.
 */
export const SCALE_STEP_STAGE_DUE_MS = 32_000;
