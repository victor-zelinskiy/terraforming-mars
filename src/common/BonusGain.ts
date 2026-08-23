/**
 * A GAIN granted alongside bonus actions whose TIMING the player chooses
 * («Фора» / Head Start: the steel and the M€ may be received before or after
 * the two immediate actions — the official card text makes the order the
 * player's, and the M€ amount depends on WHEN it is claimed).
 *
 * Serialized on the player (`SerializedPlayer.pendingBonusGains`); resolved by
 * `Player.claimPendingBonusGain` at claim time, or automatically when the last
 * bonus action is spent (the gains themselves are mandatory — only their
 * ORDER is a choice).
 */
export type PendingBonusGain = {
  /** A fixed steel amount. */
  steel?: number;
  /** M€ per project card in hand AT CLAIM TIME — claiming before playing a
   *  card from hand is worth more, which is the whole strategic point. */
  megacreditsPerCardInHand?: number;
}
