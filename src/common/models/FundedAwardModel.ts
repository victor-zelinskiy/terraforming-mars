import {Color} from '../Color';
import {AwardName} from '../ma/AwardName';
import {CardName} from '../cards/CardName';

export type AwardScore = {
  color: Color;
  score: number;
}

export type FundedAwardModel = {
  name: AwardName;
  playerName: string | undefined;
  color: Color | undefined;
  scores: Array<AwardScore>;
  /**
   * PC01 · GO — what a FUNDED slot went for, a server fact published to every seat: `slot` its place in FUNDING
   * order (0-based — the model lists the awards in board order), `paid` the M€ it cost the sponsor, `waivedBy` the card
   * that made that 0 (Nirgal Enterprises). A save that predates the facts publishes no `paid` / `waivedBy`: the ladder
   * then prints the rules' price of the slot, as it always did.
   */
  slot?: number;
  paid?: number;
  waivedBy?: CardName;
}
