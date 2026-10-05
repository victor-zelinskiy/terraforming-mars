import {ColonyName} from '../colonies/ColonyName';
import {CardName} from '../cards/CardName';
import {CardResource} from '../CardResource';
import {SelectCardModel, SelectPaymentModel} from './PlayerInputModel';
import type {ActionEffect, VictoryPointsDelta} from './ActionPreviewModel';
import type {EffectForecastFact} from './EffectForecastModel';

/**
 * A NOTE follow-up: something the trade will require / trigger AFTER the
 * confirm that the modal cannot pre-collect (an opponent pick, a card draw
 * reveal, a board placement, …). The client renders these as honest
 * "after confirming" lines — the confirm is never mute about what comes next.
 */
export type ColonyTradeNoteKind =
  | 'steal'
  | 'opponentDiscard'
  | 'drawAndKeep'
  | 'drawAndBuy'
  | 'copyTrade'
  | 'placeOcean'
  | 'placeDelegates'
  /** Turmoil Redux: the delegates go onto a RESOLUTION (the Parliament's vote step opens after the confirm). */
  | 'placeDelegatesOnResolution'
  | 'placeHazard'
  | 'wgt';

/**
 * Which act of the colony the follow-up belongs to: the colony's TRADE reward,
 * the trading player's OWN built-colony bonus on this tile, or the PLACEMENT
 * bonus a new settlement here would pay.
 *
 * `buildBonus` rides the same model on purpose — «положи 3 аэростата на карту»
 * is the same decision whichever act raised it, so it is pre-collected by the
 * same step and answered in the same batch instead of arriving as a detached
 * prompt after the cube has already landed.
 */
export type ColonyTradeFollowUpRole = 'tradeReward' | 'colonyBonus' | 'buildBonus';

/**
 * One follow-up prompt the TRADING player will face after submitting the
 * trade, in live-queue order. `cardTarget` follow-ups are PRE-COLLECTABLE:
 * the trade modal hosts the pick and the whole decision submits as ONE batch
 * (`PlayerInputBatch`) — the pre-select philosophy shared with the card-play
 * and blue-card action modals.
 */
export type ColonyTradeFollowUpModel =
  | {
      /** The IncreaseColonyTrack prompt (an `ask` colony + a trade offset). */
      kind: 'trackChoice',
      /** Max steps the track may advance (the prompt offers steps…minSteps, + "don't" when minSteps is 0). */
      steps: number,
      /**
       * The FEWEST steps the player may choose. Above 0 when the colony
       * refuses this player its income at the lower positions (the Turmoil
       * Redux Pluto: data with no card to hold it) — the prompt then offers
       * no «don't increase» and lists the refused steps disabled with the
       * colony's reason. Absent = 0 (older servers).
       */
      minSteps?: number,
    }
  | {
      /** An "add N resources to a card" reward needing a target card. */
      kind: 'cardTarget',
      role: ColonyTradeFollowUpRole,
      /** The card resource added; undefined = any resource (Venus-card reward) OR several kinds (see `resources`). */
      resource: CardResource | undefined,
      /**
       * SEVERAL kinds, one pick (the Redux Vesta: «mechs, asteroids or
       * fighters»): the candidates are the holders of ANY of them, and the
       * unit each candidate takes is its own `resourceType` — the pick's
       * `cardResourceByCard` marker names it per card. Absent for one kind.
       */
      resources?: ReadonlyArray<CardResource>,
      amount: number,
      /** ≥2 candidates → the live SelectCard prompt (pre-collect this pick). */
      pick?: SelectCardModel,
      /** Exactly 1 candidate → the server auto-applies; shown explicitly. */
      auto?: CardName,
      /**
       * Each candidate's own victory points after k of the units have landed
       * (k = 1…amount, index k − 1) — the server's per-unit reading, for a
       * scene that ticks the points on each touchdown (a fleet dock's reward,
       * TR27). Absent where no reader asked, and for a card whose points never
       * respond. The client derives no rule from it.
       */
      vpSteps?: Partial<Record<CardName, ReadonlyArray<VictoryPointsDelta>>>,
      /** No eligible card — the resource is NOT added (honest warning). */
      lost: boolean,
    }
  | {kind: 'note', role: ColonyTradeFollowUpRole, note: ColonyTradeNoteKind};

/**
 * Read-only preview of ONE colony trade for the trading player — the shared
 * source of truth behind the desktop trade modal and the console trade
 * composer ("what exactly happens if I trade here, and which choices can I
 * make BEFORE confirming?"). Built server-side by `buildColonyTradePreview`
 * (reuses the REAL trade rules; never mutates), served by
 * `GET /api/game/colony-trade-preview`.
 */
/**
 * WHAT THE FEE OF A TRADE WILL ASK, whatever the trade's destination — the two
 * payment paths that can raise a prompt of their own. One builder
 * (`tradePaymentPreview`) feeds both previews, so a colony's and a dock's
 * composer pre-collect the same question from the same fact.
 */
export type TradePaymentPreviewModel = {
  /**
   * The payment prompt an M€ trade would raise (heat / alt-resource payers),
   * or undefined when M€ pays automatically. Applies ONLY when the player
   * picks the M€ payment path; the other follow-ups apply to every path.
   */
  megacreditsPayment?: SelectPaymentModel;
  /**
   * The ENERGY path's source mix (Delta Works: 1 steel = 1 energy) — present
   * whenever the substitution is live, regardless of whether it changes
   * anything. When `minSteel < maxSteel` the server defers ONE linked
   * SelectAmount (the steel share; energy is the remainder) exactly like the
   * M€ path defers its payment prompt, so the composer pre-collects it in the
   * same batch. `minSteel === maxSteel` = a single valid mix: shown, never
   * asked. Applies ONLY when the player picks the energy payment path.
   */
  energyMix?: {
    /** Energy-equivalent fee of the energy path (discounts applied). */
    cost: number;
    energyAvailable: number;
    /** Steel usable 1:1 (the card is in the tableau; the amount is live stock). */
    steelAvailable: number;
    /** Steel needed at minimum (the energy deficit). */
    minSteel: number;
    /** Steel usable at most (min of stock and cost). */
    maxSteel: number;
    /** The substitution's source card (Delta Works) — the mix row's badge. */
    card: CardName;
  };
};

/**
 * Read-only preview of ONE trade whose destination is a CARD — a fleet dock
 * (Turmoil Redux TR06 Water Hauling and its sisters; `server/colonies/
 * FleetDock.ts`). Deliberately the colony preview's shape minus the colony:
 * the same payment part, the reward as `current → resulting` chips, and the
 * same follow-up list — so a dock whose reward ASKS (TR27: the Venus card the
 * floaters go to) is pre-collected by the very step a colony's card target
 * uses. Built by `buildFleetDockPreview`, served by the same route
 * (`GET /api/game/colony-trade-preview?dock=<card>`).
 */
export type FleetDockPreviewModel = TradePaymentPreviewModel & {
  card: CardName;
  /** The server's verdict for THIS player right now — the dock's own gate (the berth, the reward). */
  available: boolean;
  /** The ONE blocker when unavailable (an English i18n key). */
  reason?: string;
  /** What the trade pays (oceans `current → resulting`, the TR step, …). */
  effects: ReadonlyArray<ActionEffect>;
  /** What the reward asks / triggers after the confirm, in live order. */
  followUps: ReadonlyArray<ColonyTradeFollowUpModel>;
  /** The flat every-trade card modifiers this trade pays too (Venus Trade Hub's +3 M€). */
  flatBonuses?: ReadonlyArray<{card: CardName, resource: string, amount: number}>;
  /**
   * WHAT THE TABLE ANSWERS to the reward — the forecast engine's own facts for
   * the grants of `effects` (the ruling Greens' «+2 M€» on a TR step, a card
   * that pays on a rating step, …), computed by the very twins the composers'
   * «Сработает» row reads (`effectForecast.rewardReactionFacts`). Read BEFORE
   * the press — an answer that only shows up after it is a surprise — and
   * pinned at the commit boundary as the size of what follows the reward.
   * Absent = nothing reacts. The client derives no rule from it.
   */
  reactions?: ReadonlyArray<EffectForecastFact>;
};

export type ColonyTradePreviewModel = TradePaymentPreviewModel & {
  colonyName: ColonyName;
  track: {
    /** The marker position right now. */
    current: number;
    /** The position the reward is read at after the (auto) trade offset. */
    effective: number;
    /** Steps the track advances before the trade (0 = none). */
    steps: number;
    /** True = the server ASKS how far to advance (IncreaseColonyTrack). */
    willAsk: boolean;
  };
  /** Trade reward quantity at the effective position (type/resource/icons
   *  come from the shared colony manifest on the client). */
  rewardQuantity: number;
  /** Every other follow-up (the fee's own two ride {@link TradePaymentPreviewModel}), in live prompt order. */
  followUps: ReadonlyArray<ColonyTradeFollowUpModel>;
  /**
   * What BUILDING here would ask this player — the placement bonus of the NEXT
   * free slot (absent when the colony is full or its bonus asks nothing).
   *
   * It rides the trade preview because the two are one screen: the focus stage
   * fetches ONE preview per colony and the player's intent (trade / build)
   * decides which list it composes. Same shape, same pre-collect, same batch —
   * so a Titan build no longer drops «выберите карту» on the player AFTER the
   * cube has landed.
   */
  buildFollowUps?: ReadonlyArray<ColonyTradeFollowUpModel>;
  /**
   * Flat card-effect modifiers applied to EVERY trade (Venus Trade Hub's
   * +3 M€) — shown in the outcome so the numbers add up visibly.
   */
  flatBonuses?: ReadonlyArray<{card: CardName, resource: string, amount: number}>;
};
