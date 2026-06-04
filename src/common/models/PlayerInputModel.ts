import {CardModel} from './CardModel';
import {ColonyModel} from './ColonyModel';
import {Color, ColorWithNeutral} from '../Color';
import {PayProductionModel} from './PayProductionUnitsModel';
import {AresData} from '../ares/AresData';
import {Message} from '../logs/Message';
import {PartyName} from '../turmoil/PartyName';
import {SpaceId} from '../Types';
import {PaymentOptions} from '../inputs/Payment';
import {GlobalEventName} from '../turmoil/globalEvents/GlobalEventName';
import {Warning} from '../cards/Warning';
import {Units} from '../Units';
import {ClaimedToken} from '../underworld/UnderworldPlayerData';

export type BaseInputModel = {
  title: string | Message;
  warning?: string | Message;
  buttonLabel: string;
}

export type AndOptionsModel = BaseInputModel & {
  type: 'and';
  options: Array<PlayerInputModel>;
}

export type OrOptionsModel = BaseInputModel & {
  type: 'or';
  options: Array<PlayerInputModel>;
  // When set, initialIdx represents the option within `options` that should be
  // shows as the default selection.
  initialIdx?: number;
  // OPTIONAL informational-only entries the premium client renders as DISABLED
  // (greyed, non-selectable) cards alongside the real options, each with a
  // user-facing reason. Lets a card surface "this target exists but you can't
  // pick it right now (no plants / protected / …)" instead of silently
  // dropping it. Never submitted — purely for clarity. See `DisabledOptionModel`.
  disabledOptions?: ReadonlyArray<DisabledOptionModel>;
}

/** An informational, non-selectable option shown in a premium OrOptions modal. */
export type DisabledOptionModel = {
  title: string | Message;
  // Same rich-render metadata as a real option (player chip + icon), so a
  // disabled target looks like a greyed twin of a selectable one.
  metadata?: OptionMetadata;
  // User-facing reason it can't be picked (already localized key/template).
  reason?: string | Message;
}

export type SelectInitialCardsModel = BaseInputModel & {
  type: 'initialCards';
  options: Array<PlayerInputModel>;
}

/**
 * OPTIONAL structured UI metadata attached to a SelectOption so the premium
 * client can render a rich choice card (icon + player chip + impact preview)
 * instead of a text-only row. Everything is optional and backward-compatible:
 * an option WITHOUT metadata still renders via the text fallback. The server
 * fills it for in-scope cards via the `option-metadata.ts` helpers; the client
 * (ModernOptionPicker) reads it and a dev playground flags options that are
 * still on the fallback path.
 */
export type OptionMetadata = {
  /** Semantic kind — drives accent/icon defaults + playground status. */
  kind?: 'resourceRemoval' | 'resourceGain' | 'steal' | 'globalParameter' | 'playerTarget' | 'skip' | 'confirm' | 'generic';
  /** Icon key (a resource or global-parameter token), e.g. 'plants',
   *  'megacredits', 'steel', 'titanium', 'energy', 'heat', 'microbe',
   *  'animal', 'floater', 'temperature', 'venus', 'oxygen', 'oceans'. */
  icon?: string;
  /** Magnitude involved (plants removed, M€ stolen, parameter steps…). */
  amount?: number;
  /** Player-target context (remove / steal from a player) for the preview. */
  player?: {color: Color, current?: number, resulting?: number};
  /** Global-parameter context for the preview. */
  global?: {current?: number, resulting?: number, unit?: string};
};

export type SelectOptionModel = BaseInputModel & {
  type: 'option';
  warnings?: ReadonlyArray<Warning>;
  metadata?: OptionMetadata;
}

export type SelectProjectCardToPlayModel = BaseInputModel & {
  type: 'projectCard';
  cards: ReadonlyArray<CardModel>;
  paymentOptions: Partial<PaymentOptions>,
  microbes: number;
  floaters: number;
  lunaArchivesScience: number;
  seeds: number;
  graphene: number;
  kuiperAsteroids: number;
  auroraiData: number;
  spireScience: number;
}

export type SelectCardModel = BaseInputModel & {
  type: 'card';
  cards: ReadonlyArray<CardModel>;
  max: number;
  min: number;
  showOnlyInLearnerMode: boolean;
  selectBlueCardAction: boolean;
  showOwner: boolean;
  showSelectAll: boolean;
  // OPTIONAL relevant-but-unpickable candidates shown DISABLED (greyed, with a
  // reason on each card's `disabledReason`) — separate from the selectable
  // `cards` so the server never validates/accepts them. The premium picker
  // merges them for display behind an All/Available/Unavailable filter.
  disabledCards?: ReadonlyArray<CardModel>;
}

export type SelectColonyModel = BaseInputModel & {
  type: 'colony';
  coloniesModel: ReadonlyArray<ColonyModel>;
}

export type SelectPaymentModel = BaseInputModel & {
  type: 'payment';
  amount: number;
  paymentOptions: Partial<PaymentOptions>;
  seeds: number;
  auroraiData: number;
  kuiperAsteroids: number;
  spireScience: number;
  reserveUnits: Readonly<Units> | undefined; // Built to support the Merchant milestone.

  floaters: 0,
  microbes: 0,
  graphene: 0,
}

export type SelectPlayerModel = BaseInputModel & {
  type: 'player';
  players: ReadonlyArray<Color>;
  // OPTIONAL premium-UI hint describing the action applied to the chosen player
  // (constant across candidates, e.g. "remove 4 M€"): `icon` is an icon-key and
  // `amount` the magnitude. Backward-compatible — omit for a bare player list.
  icon?: string;
  amount?: number;
  // Whether `icon`/`amount` affect the player's resource STOCK (e.g. spend M€)
  // or their PRODUCTION rate (e.g. decrease energy production). Lets the premium
  // picker read the right per-target value and frame the icon accordingly.
  // Defaults to 'stock' when omitted.
  scope?: 'stock' | 'production';
  // OPTIONAL informational-only targets the premium picker renders as DISABLED
  // (greyed, non-selectable) cards with a reason — players who are potentially
  // relevant but can't be chosen right now (production at minimum, protected,
  // no Venus tag, …). The selectable `players` list is unchanged (and is what
  // the server validates against); these never get submitted.
  disabledPlayers?: ReadonlyArray<{color: Color, reason?: string | Message}>;
}

export type SelectSpaceModel = BaseInputModel & {
  type: 'space';
  spaces: ReadonlyArray<SpaceId>;
  /**
   * Per-cell illegality reasons for the cells NOT in `spaces`. Optional
   * because not every SelectSpace caller derives them (small custom paths
   * may pass nothing). The client falls back to no tooltip when absent.
   * See `PlacementIllegalReason.ts` for the value space.
   */
  illegalSpaces?: ReadonlyArray<import('../inputs/PlacementIllegalReason').PlacementIllegalSpace>;
}

export type SelectAmountModel = BaseInputModel & {
  type: 'amount';
  min: number;
  max: number;
  maxByDefault: boolean;
  // OPTIONAL premium-UI hints. `icon` is an icon-key (a standard resource like
  // 'heat'/'energy', a global parameter, or a card resource) shown beside the
  // amount; `unit` is a short suffix ('°C', '%') for parameter-style amounts.
  // Both fall back cleanly — a model without them renders a bare stepper.
  icon?: string;
  unit?: string;
}

export type DeltaProjectInputModel = BaseInputModel & {
  type: 'deltaProject';
  validSteps: ReadonlyArray<number>;
}

export type SelectDelegateModel = BaseInputModel & {
  type: 'delegate';
  players: Array<ColorWithNeutral>;
}

export type SelectPartyModel = BaseInputModel & {
  type: 'party';
  parties: Array<PartyName>;
}

export type SelectProductionToLoseModel = BaseInputModel & {
  type: 'productionToLose';
  payProduction: PayProductionModel;
}

export type ShiftAresGlobalParametersModel = BaseInputModel & {
  type: 'aresGlobalParameters';
  aresData: AresData;
}

export type SelectGlobalEventModel = BaseInputModel & {
  type: 'globalEvent';
  globalEventNames: Array<GlobalEventName>;
}

export type SelectResourceModel = BaseInputModel & {
  type: 'resource';
  include: ReadonlyArray<keyof Units>;
}

export type SelectResourcesModel = BaseInputModel & {
  type: 'resources';
  count: number;
}

export type SelectClaimedUndergroundTokenModel = BaseInputModel & {
  type: 'claimedUndergroundToken';
  max: number;
  min: number;
  tokens: ReadonlyArray<ClaimedToken>;
}

export type PlayerInputModel =
  AndOptionsModel |
  OrOptionsModel |
  SelectInitialCardsModel |
  SelectOptionModel |
  SelectProjectCardToPlayModel |
  SelectCardModel |
  SelectAmountModel |
  SelectCardModel |
  SelectColonyModel |
  SelectDelegateModel |
  SelectPartyModel |
  SelectPaymentModel |
  SelectPlayerModel |
  SelectProductionToLoseModel |
  SelectProjectCardToPlayModel |
  SelectSpaceModel |
  ShiftAresGlobalParametersModel |
  SelectGlobalEventModel |
  SelectResourceModel |
  SelectResourcesModel |
  SelectClaimedUndergroundTokenModel |
  DeltaProjectInputModel;
