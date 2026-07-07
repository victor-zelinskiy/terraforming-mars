import {ColonyName} from '../colonies/ColonyName';
import {CardName} from '../cards/CardName';
import {CardResource} from '../CardResource';
import {SelectCardModel, SelectPaymentModel} from './PlayerInputModel';

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
  | 'placeHazard'
  | 'wgt';

/** Whether a follow-up comes from the colony's TRADE reward or from the
 *  trading player's OWN built-colony bonus on this tile. */
export type ColonyTradeFollowUpRole = 'tradeReward' | 'colonyBonus';

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
      /** Max steps the track may advance (the prompt offers steps…1 + "don't"). */
      steps: number,
    }
  | {
      /** An "add N resources to a card" reward needing a target card. */
      kind: 'cardTarget',
      role: ColonyTradeFollowUpRole,
      /** The card resource added; undefined = any resource (Venus-card reward). */
      resource: CardResource | undefined,
      amount: number,
      /** ≥2 candidates → the live SelectCard prompt (pre-collect this pick). */
      pick?: SelectCardModel,
      /** Exactly 1 candidate → the server auto-applies; shown explicitly. */
      auto?: CardName,
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
export type ColonyTradePreviewModel = {
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
  /**
   * The payment prompt an M€ trade would raise (heat / alt-resource payers),
   * or undefined when M€ pays automatically. Applies ONLY when the player
   * picks the M€ payment path; the other follow-ups apply to every path.
   */
  megacreditsPayment?: SelectPaymentModel;
  /** Every other follow-up, in live prompt order. */
  followUps: ReadonlyArray<ColonyTradeFollowUpModel>;
  /**
   * Flat card-effect modifiers applied to EVERY trade (Venus Trade Hub's
   * +3 M€) — shown in the outcome so the numbers add up visibly.
   */
  flatBonuses?: ReadonlyArray<{card: CardName, resource: string, amount: number}>;
};
