import {CardName} from '../cards/CardName';
import {CardResource} from '../CardResource';
import {Tag} from '../cards/Tag';
import {Color} from '../Color';
import {Message} from '../logs/Message';
import {EventSource} from '../events/EventSource';
import {EventTrigger} from '../events/GameEvent';
import {ActionEffect} from './ActionPreviewModel';

/**
 * THE EFFECT FORECAST — what the TABLE answers to a card play / a card action,
 * over and above the card's own printed result.
 *
 * Rides INSIDE the existing `ActionPreview` (`forecast?`) of both the
 * card-play preview and the action preview — same route, same cache, same
 * `gameStateVersion` key, zero new requests. Computed on the SERVER by
 * `src/server/models/effectForecast.ts`, which mirrors the real
 * `Player.onCardPlayed` fan-out and asks each card's CO-LOCATED read-only
 * forecast hook (`ICard.cardPlayedForecast` / `grantForecast` /
 * `tilePlacedForecast`, `MarsBotCorp.humanCardPlayedForecast`). The client
 * derives nothing: every fact already answers the FIVE QUESTIONS —
 * WHAT (`effects`), WHY (`reason`), UNDER WHAT CONDITION (`condition`),
 * TO WHOM (`recipient`), WHEN (`timing`).
 *
 * Honesty is structural: a card with a live combat hook but no forecast hook
 * arrives as `certainty: 'unknown'` (never silence), a hook whose condition
 * almost holds answers `'no'` with the reason, and `coverage` says whether
 * anything on the table stayed uncomputed.
 */

/**
 * How sure the forecast is about one fact:
 *  - `exact`       — the condition holds on the card being played / activated
 *                    and the result is deterministic;
 *  - `asks`        — it fires and opens a QUESTION (the first outcome is in
 *                    `effects`, the other in `alternatives`);
 *  - `conditional` — depends on the branch / target chosen in THIS composer
 *                    (lives in `byBranch`, never in `facts`);
 *  - `deferred`    — fires LATER: after the tile lands, when the cards are
 *                    drawn;
 *  - `unknown`     — a combat hook exists but no forecast describes it (or a
 *                    module out of scope — a party policy, Pathfinders);
 *  - `skipped`     — it would fire, but there is nowhere to apply it;
 *  - `no`          — an «almost»: the tag matches, the condition does not.
 */
export type EffectForecastCertainty = 'exact' | 'asks' | 'conditional' | 'deferred' | 'unknown' | 'skipped' | 'no';

/** WHO receives the fact's effect. The viewer collapses to `you`. */
export type EffectForecastRecipient =
  | {kind: 'you'}
  | {kind: 'player', color: Color}
  | {kind: 'bot', color: Color};

/** WHEN the effect lands, relative to the play / activation. */
export type EffectForecastTiming =
  | 'immediate'
  | 'before-card-choices'
  | 'after-card'
  | 'after-placement'
  | 'on-draw'
  | 'unknown';

/**
 * WHERE the reacting rule lives. `rule` is the ONE cardless source — an
 * out-of-scope module the engine names honestly instead of staying silent (a
 * ruling party's policy, the Pathfinders track); its `name` is an i18n key.
 */
export type EffectForecastSourceKind = 'card' | 'corporation' | 'automa-corporation' | 'rule'
  /** A Turmoil Redux PARTY EFFECT the seat holds (`name` is the PartyName; cardless, like a rule). */
  | 'party';

/**
 * A source with NO card behind it — a rule, a party effect. Every reader that
 * used to ask `kind === 'rule'` to mean «no card to show / no card name to
 * resolve» asks this instead, so a new cardless kind cannot be cast to a
 * CardName by omission.
 */
export function forecastSourceIsCardless(source: {kind: EffectForecastSourceKind}): boolean {
  return source.kind === 'rule' || source.kind === 'party';
}

export type EffectForecastSource = {
  kind: EffectForecastSourceKind;
  /** The reacting card (for a MarsBot corporation: the human twin's name; for
   *  a `rule` source: the rule's i18n key). */
  name: CardName | string;
  /** The seat holding it. */
  owner: Color;
  /** The channel the LIVE hook fires on — the same `EventTrigger` the event
   *  stream records, so a forecast fact and an `effect-triggered` event can be
   *  matched one-to-one (the parity guard) and attributed to the printed effect
   *  block through the effects explorer's channel plan. */
  channel: EventTrigger;
  /**
   * WHICH printed effect block of the source this fact belongs to (the index
   * in the card's rendered effect list), declared by the CARD FILE when its
   * blocks share one live channel and the channel plan cannot tell them apart
   * (Pharmacy Union: the microbe half and the science half both fire on
   * `card-played-by-any`). The tile draws that block's graphic; absent, the
   * client attributes through the channel plan or falls back to the honest
   * «эффект этой карты». Never a statistics split — the event stream cannot
   * separate the two halves, so their stats stay card-scoped.
   */
  printedEffect?: number;
};

export type EffectForecastCondition = {
  /** English i18n key (or a `Message`) naming the condition. */
  text: string | Message;
  /** `met` — holds on the played card; `depends` — decided by a choice in this
   *  composer; `unmet` — the «almost» case. */
  state: 'met' | 'depends' | 'unmet';
  /** For `depends`: the POSITION of the branch in `ActionPreview.branches`
   *  this fact is tied to (the same index the composer's cursor uses). */
  branchPos?: number;
};

export type EffectForecastAlternative = {
  /** English i18n key (or a `Message`) — the option's label. */
  label: string | Message;
  effects: ReadonlyArray<ActionEffect>;
};

export type EffectForecastFact = {
  /** Stable, unique within one forecast (`<owner>-<card>-<n>`). */
  id: string;
  source: EffectForecastSource;
  certainty: EffectForecastCertainty;
  recipient: EffectForecastRecipient;
  timing: EffectForecastTiming;
  /**
   * The deferred-queue priority the LIVE hook declares (`Priority` enum
   * value), present ONLY when the hook states it honestly. The «ПОРЯДОК» band
   * renders only when every `asks` / `deferred` fact carries one.
   */
  sequence?: number;
  /**
   * WHAT: the chips. `current → resulting` is filled ONLY for pools the card
   * being played does not touch itself (otherwise the delta stands alone and
   * the UI notes «сверх собственного эффекта карты»). For another recipient
   * the chip is written from THEIR point of view (`direction` = what THEY
   * gain / lose).
   */
  effects: ReadonlyArray<ActionEffect>;
  /** For `asks`: the OTHER outcomes of the question. */
  alternatives?: ReadonlyArray<EffectForecastAlternative>;
  /** WHY: the hook's English i18n key (params through `Message` / `reasonTag`). */
  reason: string | Message;
  /** The tag the reason is about — rendered as its icon + name. */
  reasonTag?: Tag;
  /** UNDER WHAT CONDITION. */
  condition?: EffectForecastCondition;
  /** A quiet note («Ответ прямо в этом розыгрыше», «подробности покажет досье клетки»). */
  note?: string | Message;
};

export type EffectForecastDiscountItem = {
  source: EventSource;
  amount: number;
};

export type EffectForecastDiscounts = {
  /** The printed cost. */
  base: number;
  /** What the player actually pays. */
  final: number;
  /** Per-source discounts (cards / corporations / a party). */
  items: ReadonlyArray<EffectForecastDiscountItem>;
  /** The remainder `base − final − Σitems` — a colony / rule discount with no
   *  card source (clamped at 0). */
  other: number;
};

export type EffectForecastPaymentValue = {
  source: EventSource;
  resource: CardResource;
  /** M€ one unit is worth on THIS play. */
  value: number;
  /** Units the player holds right now. */
  count: number;
};

export type EffectForecast = {
  /** Facts that do not depend on the composer's branch choice. */
  facts: ReadonlyArray<EffectForecastFact>;
  /**
   * Facts that depend on WHICH branch the player picks, keyed by the branch's
   * POSITION in `ActionPreview.branches` (the composer's own cursor index —
   * never the runtime OrOptions index, which is `-1` for every unavailable or
   * auto-resolved branch and so cannot be a key).
   */
  byBranch?: Readonly<Record<number, ReadonlyArray<EffectForecastFact>>>;
  discounts: EffectForecastDiscounts;
  paymentValues: ReadonlyArray<EffectForecastPaymentValue>;
  /** `partial` when at least one live hook stayed uncomputed (an `unknown`). */
  coverage: 'complete' | 'partial';
};

/** The empty forecast — nothing reacts, nothing discounts. */
export function emptyEffectForecast(base = 0): EffectForecast {
  return {
    facts: [],
    discounts: {base, final: base, items: [], other: 0},
    paymentValues: [],
    coverage: 'complete',
  };
}

/** Every fact of a forecast, branch-tied ones included (in order). */
export function allForecastFacts(forecast: EffectForecast): Array<EffectForecastFact> {
  const out = [...forecast.facts];
  for (const list of Object.values(forecast.byBranch ?? {})) {
    out.push(...list);
  }
  return out;
}

/** True when the forecast has NOTHING to say (no facts, no discount, no payment value). */
export function forecastIsEmpty(forecast: EffectForecast | undefined): boolean {
  if (forecast === undefined) {
    return true;
  }
  return allForecastFacts(forecast).length === 0 &&
    forecast.discounts.final >= forecast.discounts.base &&
    forecast.paymentValues.length === 0;
}
