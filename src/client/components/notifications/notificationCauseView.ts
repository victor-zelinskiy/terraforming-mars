import {TileType, tileTypeToString} from '@/common/TileType';
import {GlobalParameter} from '@/common/GlobalParameter';
import {EventTrigger, JournalActionCategory} from '@/common/events/GameEvent';
import {bonusCardInfo} from '@/common/automa/BonusCardData';
import {JournalImpactChip, parliamentSourceLabel} from '@/client/components/journal/journalEventChild';
import {ViewerImpactCause, ViewerImpactMeta} from './notificationSemantics';
import {resolutionName} from '@/client/parliament/ClientParliamentManifest';

/**
 * The PURE presentation mapping of the «почему»-layer: `ViewerImpactCause`
 * groups → renderable cause lines. One grammar for every family — gains,
 * losses, attacks, placement bonuses, passive payouts — so the player learns
 * ONE place and one reading:
 *
 *   [chips]  ИСТОЧНИК  <Name>  · <detail>  · <trigger tail>
 *
 * The chips prefix appears only when the card carries SEVERAL causes (the
 * honest breakdown of a multi-source total); a single cause lets the band's
 * own numbers stand. Everything here is i18n KEYS + structural data — no
 * Vue / DOM / $t, unit-testable under the client runner.
 *
 * EXHAUSTIVE over the origin kinds by construction (the `never` guard below):
 * a new `EventSource` kind cannot compile without deciding how it reads.
 * A cause that genuinely cannot be named (an unattributed delta with no root
 * category) yields NO line — the layer's dev diagnostic + the corpus guard
 * spec (`notificationCauseCoverage`) exist precisely so that stays a bug you
 * see in CI, never a «Игровой эффект» placeholder the player reads.
 */

export type NotificationCauseLine = {
  /**
   * The dim anchor label — the stable word the player learns to look for. The
   * OWN labels name what of the VIEWER's paid them (TR59 «ИСТОЧНИК — ТО, ЧТО
   * ЗАПЛАТИЛО ВАМ»): their card, their corporation, their TILE on Mars (an Ares
   * neighbour's payout), their COLONY (a trade's colony bonus); «Источник» is
   * for what is not theirs (an attack, a law, a party).
   */
  labelKey: 'Source' | 'Your card' | 'Your corporation' | 'Your tile' | 'Your colony';
  /** The accent voice — the concrete origin (an i18n key: a card / colony /
   *  bonus-card name or a semantic label like 'Cell bonus'). */
  nameKey: string;
  /** A dim qualifier after the name (the colony of a trade income, …). */
  detailKey?: string;
  /** The trigger tail — an i18n template, possibly with a `${0}` slot. */
  triggerKey?: string;
  /** The `${0}` of the trigger tail — itself an i18n key (tile / card name). */
  triggerParamKey?: string;
  /**
   * The ACTOR's move that fired the cause (TR59) — an i18n template with ONE
   * `${0}` slot («ход: ${0}») and its param, itself an i18n key (the card the
   * actor played, the bot's bonus card). The actor is NOT named here — the
   * head's chip is the one identity statement.
   */
  viaKey?: string;
  viaParamKey?: string;
  /** Per-cause delta chips — present only on a multi-cause card. */
  chips?: ReadonlyArray<JournalImpactChip>;
};

const PARAM_LABEL: Readonly<Record<GlobalParameter, string>> = {
  [GlobalParameter.TEMPERATURE]: 'Temperature',
  [GlobalParameter.OXYGEN]: 'Oxygen',
  [GlobalParameter.OCEANS]: 'Oceans',
  [GlobalParameter.VENUS]: 'Venus',
  [GlobalParameter.MOON_HABITAT_RATE]: 'Global parameter',
  [GlobalParameter.MOON_MINING_RATE]: 'Global parameter',
  [GlobalParameter.MOON_LOGISTIC_RATE]: 'Global parameter',
};

/** Root-action categories that ARE a meaningful cause on their own (the rule
 *  that moved the delta), for chains whose events carried no finer source. */
const ACTION_CATEGORY_LABEL: Partial<Record<JournalActionCategory, string>> = {
  'solar-phase': 'Solar phase',
  'planetary-event': 'Planetary event',
  'colony': 'Colony',
  'standard-project': 'Standard project',
  'milestone': 'Achievement',
  'award': 'Award',
  'delta-project': 'Hydronetwork',
  'vp-pressure': 'VP loss',
  'parliament': 'Parliament',
  'political-phase': 'Mars Parliament',
  // A share of a bot turn's GAIN the event join could not attribute (TR59): the turn is its honest name, the card
  // the bot acted with rides the via tail — never «the bot's card paid you».
  'automa-turn': 'MarsBot turn',
  // The production phase's income (TR61) — never a toast of its own (the generation scene is its telling); named
  // here for the one case a share of it reaches a rival's cause line (a card's `onProductionPhase` paying across).
  'production': 'Production phase',
};

/** The trigger tail templates — exhaustive over `EventTrigger`, so a new
 *  trigger kind cannot compile without deciding how it reads. */
const TRIGGER_LABEL: Readonly<Record<EventTrigger, string>> = {
  'card-played': 'for a played card',
  'card-played-by-any': 'for a played card',
  'tile-placed': 'for a placed tile',
  'tile-adjacency': 'for a tile placed next to it',
  'production-gain': 'for gained production',
  'tr-increase': 'for a TR increase',
  'colony-added': 'for a built colony',
  'global-parameter': 'for a global parameter step',
  'standard-project': 'for a standard project',
  'resource-added': 'for an added resource',
  'tag-added': 'for a played tag',
  'cards-not-bought': 'for cards not bought',
  'insurance-claim': 'insurance payout',
  'delta-advance': 'for a Hydronetwork advance',
  'delegates-discarded': 'for delegates discarded off an unenacted resolution',
  'ruling-party-changed': 'for a change of the ruling party',
  'resolution-won': 'for a resolution won',
  'terraforming-diverted': 'for a replaced terraforming step',
  'rating-vetoed': 'for a vetoed terraform rating',
  'automa-corporation': 'MarsBot corporation effect',
};

/** Trigger templates that take a `${0}` — the concrete thing that fired. */
const TRIGGER_WITH_PARAM: Partial<Record<EventTrigger, string>> = {
  'tile-placed': 'for placing: ${0}',
  'tile-adjacency': 'for a tile next to it: ${0}',
  'card-played': 'for playing: ${0}',
  'card-played-by-any': 'for playing: ${0}',
};

/** The three base tiles read as complete phrases (clean declension in RU —
 *  «за размещение города», never «за размещение: город»); a special tile's
 *  name is a CardName and rides the `${0}` template instead. */
/** A scale step names ITS scale (PL-051): «за шаг Венеры», never «за шаг глобального параметра». */
const PARAM_STEP_TRIGGER: Partial<Record<GlobalParameter, string>> = {
  [GlobalParameter.VENUS]: 'for a Venus step',
  [GlobalParameter.TEMPERATURE]: 'for a temperature step',
  [GlobalParameter.OXYGEN]: 'for an oxygen step',
  [GlobalParameter.OCEANS]: 'for an ocean step',
};

const BASE_TILE_TRIGGER: Partial<Record<TileType, string>> = {
  [TileType.CITY]: 'for a placed city',
  [TileType.GREENERY]: 'for a placed greenery',
  [TileType.OCEAN]: 'for a placed ocean',
};

/** …and the same three beside the viewer's own tile (an Ares neighbour, TR59): «за город рядом». */
const ADJACENT_TILE_TRIGGER: Partial<Record<TileType, string>> = {
  [TileType.CITY]: 'for a city next to it',
  [TileType.GREENERY]: 'for a greenery next to it',
  [TileType.OCEAN]: 'for an ocean next to it',
};

/** The via tail: «ход: ‹что сделал актор›» — the param is an i18n key (a card / bonus-card / colony name). */
function viaOf(cause: ViewerImpactCause): {viaKey?: string; viaParamKey?: string} {
  const via = cause.via;
  if (via === undefined) {
    return {};
  }
  switch (via.kind) {
  case 'card':
  case 'standardProject':
    return {viaKey: 'move: ${0}', viaParamKey: via.card};
  case 'bonusCard':
    return {viaKey: 'move: ${0}', viaParamKey: bonusCardInfo(via.bonusCard).name};
  case 'trade':
    return {viaKey: 'move: ${0}', viaParamKey: 'trade'};
  default: {
    const exhaustive: never = via;
    throw new Error(`Unhandled cause via ${JSON.stringify(exhaustive)}`);
  }
  }
}

function triggerOf(cause: ViewerImpactCause, nameKey: string): {triggerKey?: string; triggerParamKey?: string} {
  const trigger = cause.trigger;
  if (trigger === undefined) {
    return {};
  }
  if (trigger === 'tile-adjacency' && cause.triggerTile !== undefined) {
    const base = ADJACENT_TILE_TRIGGER[cause.triggerTile];
    if (base !== undefined) {
      return {triggerKey: base};
    }
    return {triggerKey: TRIGGER_WITH_PARAM[trigger], triggerParamKey: tileTypeToString[cause.triggerTile]};
  }
  if (trigger === 'tile-placed' && cause.triggerTile !== undefined) {
    const base = BASE_TILE_TRIGGER[cause.triggerTile];
    if (base !== undefined) {
      return {triggerKey: base};
    }
    return {triggerKey: TRIGGER_WITH_PARAM[trigger], triggerParamKey: tileTypeToString[cause.triggerTile]};
  }
  if (trigger === 'global-parameter' && cause.triggerParameter !== undefined) {
    const step = PARAM_STEP_TRIGGER[cause.triggerParameter];
    if (step !== undefined) {
      return {triggerKey: step};
    }
  }
  // «за розыгрыш: X» where X is the very card already named as the source
  // says nothing twice — the generic tail reads better.
  if ((trigger === 'card-played' || trigger === 'card-played-by-any') &&
      cause.triggerCard !== undefined && cause.triggerCard !== nameKey) {
    return {triggerKey: TRIGGER_WITH_PARAM[trigger], triggerParamKey: cause.triggerCard};
  }
  return {triggerKey: TRIGGER_LABEL[trigger]};
}

/** One cause group → its renderable line, or undefined when the origin
 *  genuinely cannot be named (guarded as a defect, never masked). */
export function causeLineOf(cause: ViewerImpactCause): NotificationCauseLine | undefined {
  const origin = cause.origin;
  const line = (labelKey: NotificationCauseLine['labelKey'], nameKey: string, detailKey?: string): NotificationCauseLine => ({
    labelKey,
    nameKey,
    ...(detailKey !== undefined ? {detailKey} : {}),
    ...triggerOf(cause, nameKey),
    ...viaOf(cause),
  });
  // The viewer's TILE paid them (an Ares neighbour, TR59): the card that put the tile on Mars is its name.
  const ownTile = cause.own === true && cause.trigger === 'tile-adjacency';
  switch (origin.kind) {
  case 'card':
    return line(ownTile ? 'Your tile' : (cause.own === true ? 'Your card' : 'Source'), origin.card);
  case 'corporation':
    return line(ownTile ? 'Your tile' : (cause.own === true ? 'Your corporation' : 'Source'), origin.card);
  case 'tile':
    return line(cause.own === true ? 'Your tile' : 'Source', tileTypeToString[origin.tileType]);
  case 'standardProject':
    return line('Source', origin.card);
  case 'milestone':
  case 'award':
  case 'globalEvent':
  case 'party':
    return line('Source', origin.name);
  case 'colony':
    // The ROLE reads first (what kind of income this is), the colony after —
    // «ИСТОЧНИК Торговый доход · Европа».
    if (origin.benefit === 'trade') {
      return line('Source', 'Trade income', origin.name);
    }
    // The colony-owner bonus is paid only to whoever has a colony there — it is the VIEWER's colony that paid
    // (TR59): «ВАША КОЛОНИЯ Европа · бонус колонии · ход: торговля».
    if (origin.benefit === 'colonyBonus') {
      return line('Your colony', origin.name, 'Colony bonus');
    }
    return line('Source', origin.name);
  case 'globalParameter':
    return line('Source', PARAM_LABEL[origin.parameter]);
  case 'bonusCard':
    return line('Source', bonusCardInfo(origin.bonusCard).name);
  case 'production':
    return line('Source', origin.part === 'rating' ? 'Terraform rating' : origin.part === 'conversion' ? 'Energy conversion' : 'Production');
  case 'spaceBonus':
    return line('Source', 'Cell bonus');
  case 'oceanBonus':
    return line('Source', 'Ocean bonus');
  case 'payment':
    return line('Source', 'Payment');
  // Turmoil Redux: an enacted resolution names itself (the catalog's name
  // key); the parliament's own rules read as the institution, except the one
  // the player knows by name (the greenery tile's TR — the journal's word).
  case 'resolution':
    return line('Source', resolutionName(origin.id));
  case 'parliament':
    return line('Source', parliamentSourceLabel(origin));
  case 'system':
    // 'system' is folded into the action fallback by the semantics layer —
    // reaching here means an unattributed delta slipped through. No line;
    // the coverage guard + dev diagnostic own this.
    return undefined;
  case 'action': {
    const label = origin.category !== undefined ? ACTION_CATEGORY_LABEL[origin.category] : undefined;
    if (label !== undefined) {
      return line('Source', label);
    }
    if (origin.card !== undefined) {
      return line('Source', origin.card);
    }
    return undefined; // unattributable — a guarded defect, never a placeholder
  }
  default: {
    const exhaustive: never = origin;
    throw new Error(`Unhandled cause origin ${JSON.stringify(exhaustive)}`);
  }
  }
}

/**
 * The card's whole «почему»-zone: one line per cause, chips attached only when
 * SEVERAL causes share the band (the honest multi-source breakdown). Lines
 * that cannot be named are dropped (and counted — the caller may surface a
 * dev diagnostic); an empty result under a non-neutral band is a defect the
 * corpus guard exists to catch.
 */
export function causeLinesOf(meta: ViewerImpactMeta): Array<NotificationCauseLine> {
  const named: Array<{cause: ViewerImpactCause; line: NotificationCauseLine}> = [];
  for (const cause of meta.causes) {
    const line = causeLineOf(cause);
    if (line !== undefined) {
      named.push({cause, line});
    }
  }
  const multi = named.length > 1;
  return named.map(({cause, line}) => multi ?
    {...line, chips: [...cause.losses, ...cause.gains]} : line);
}
