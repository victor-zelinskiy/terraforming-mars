import {CardResource} from '../CardResource';
import {Color} from '../Color';
import {ColonyBenefit} from '../colonies/ColonyBenefit';
import {ColonyName} from '../colonies/ColonyName';
import {Resource} from '../Resource';

/**
 * One PLANNED grant of a colony trade, read straight off the colony's
 * authoritative metadata at the moment the trade resolved (`handleTrade`):
 * the benefit kind, the per-position quantity and the per-position resource.
 *
 * "Planned" because interactive follow-ups (a card-resource target pick, a
 * deck that runs short of cards) resolve AFTER the manifest is built — the
 * client must treat card COUNTS from the reveal batches (`tradeSegments`) as
 * the actual truth for drawn cards, and its own pre-collected target picks as
 * the truth for card-resource destinations. Resource/production grants never
 * fail, so for them planned == actual.
 */
export type ColonyTradeGrantModel = {
  benefit: ColonyBenefit;
  quantity: number;
  /** Resolved per-position resource for stock/production benefits. */
  resource?: Resource;
  /** The colony's card resource for the ADD_RESOURCES_TO_CARD family. */
  cardResource?: CardResource;
};

/** One colony-cube owner receiving the per-cube colony bonus for this trade. */
export type ColonyTradeBonusRecipientModel = {
  color: Color;
  /** How many colony-bonus grants (cubes) this owner receives. */
  cubes: number;
};

/**
 * The ATOMIC reward manifest of ONE colony trade — everything the premium
 * client orchestration needs to present the trade as a single transaction:
 * trade income read at the PRE-reset track position, the per-cube colony
 * bonuses with their recipients, and the track positions before/after the
 * reset. 100% server-authoritative; the client never re-derives amounts from
 * DOM or its own rules tables.
 *
 * Self-only + transient (never serialized to the database): lives on the
 * TRADING player and is serialized only into their own PlayerViewModel. It is
 * NOT cleared in `Player.process()` — a batched trade replays several inputs
 * through `process()` before the response is built, so an input-scoped clear
 * would wipe it mid-trade. Instead it stays until the player's next trade
 * overwrites it; the client de-duplicates by `tradeId` and only ever plays a
 * manifest it explicitly ARMED at its own confirm press (a reload/reconnect
 * therefore never replays a finished trade).
 */
export type ColonyTradeManifestModel = {
  /** Unique per trade: `${colony}:g${generation}:a${gameAge}`. */
  tradeId: string;
  colonyName: ColonyName;
  trader: Color;
  generation: number;
  /**
   * The track position the trade income was read at — AFTER any trade-offset
   * increase (Trade Envoys / the player's track choice), BEFORE the reset.
   */
  preTradeTrackPosition: number;
  /**
   * Where the white marker lands after the trade: the number of built
   * colonies (Colonies rules), or `preTradeTrackPosition` unchanged when the
   * trade doesn't reset the track (`decreaseTrackAfterTrade: false`). Equal
   * positions mean "no visual movement" — the client plays a confirm pulse
   * instead of a glide.
   */
  postTradeTrackPosition: number;
  tradeIncome: ColonyTradeGrantModel;
  /**
   * The per-cube colony bonus grant, present when colony bonuses are given
   * and at least one cube is on the tile.
   */
  colonyBonus?: ColonyTradeGrantModel;
  /**
   * Cube owners in slot order (aggregated per owner). A selfish trade
   * (Coordinated Raid) redirects every cube to the trader.
   */
  bonusRecipients: ReadonlyArray<ColonyTradeBonusRecipientModel>;
};
