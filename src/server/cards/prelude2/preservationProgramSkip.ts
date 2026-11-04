/*
 * P57 PRESERVATION PROGRAM — THE LIVE HALF OF THE STANDING SKIP («skip the
 * first TR you gain in each generation's action phase»). The rule itself
 * stays where upstream put it — ONE branch of the ONE rating funnel
 * (`Player.increaseTerraformRating`: the flag, the action phase, the first
 * rating of the generation) — and this light module is what that branch
 * calls to NAME the refusal (invariant 4): the upstream log line, plus the
 * structured `effect-skipped` fact UNDER THE CARD's own effect scope on the
 * channel `rating-skipped` — so the journal draws «Пропущено · Рейтинг
 * терраформирования · [РТ] +1» as the card's child, the feed and the
 * notifications name the card, and the reaction record carries a `skip`
 * impact (the console's reactor rises and pulses its printed struck icon —
 * no token is born: nothing was gained).
 *
 * The words are shared with the preview family's exit pass
 * (`models/skippedRating.ts`), so the promise and the record read alike.
 */
import {CardName} from '../../../common/cards/CardName';
import {Phase} from '../../../common/Phase';
import {IPlayer} from '../../IPlayer';
import {recordSkippedEffect} from '../../deferredActions/skippedEffect';

/** The card whose standing effect skips the rating. */
export const RATING_SKIP_CARD = CardName.PRESERVATION_PROGRAM;

/** WHY the step is not gained — the live record's reason, the futility's, the forecast fact's note (one sentence). */
export const RATING_SKIP_REASON = 'Preservation Program skips the first TR you gain in each generation\'s action phase';

/** What is skipped — the journal row's label (the RX42 key: the same unit, the same word). */
export const RATING_SKIP_LABEL = 'Terraform rating';

/** The forecast fact's title. */
export const RATING_SKIP_FORECAST_TITLE = 'Preservation Program: the first TR of this generation is not gained';

/**
 * WILL THE FUNNEL SKIP THE SEAT'S NEXT RATING? — the flag armed, the action phase, nothing gained in it this
 * generation (the funnel's own three terms, `Player.increaseTerraformRating`). Outside the action phase the flag may
 * stand armed (it re-arms at the generation's start) but eats nothing: a prelude's, a research's, a production
 * phase's rating is gained whole.
 */
export function ratingSkipArmed(player: IPlayer): boolean {
  return player.preservationProgram === true && player.game.phase === Phase.ACTION && player.trThisGeneration === 0;
}

/**
 * NAME THE SKIPPED STEP — called by the funnel at the moment it eats it (the flag already down). Runs under the
 * card's effect scope so every reader attributes it to the card; a game without a recorder logs alone.
 */
export function recordRatingSkipped(player: IPlayer): void {
  const record = () => {
    player.game.log('${0} for ${1} is blocking 1 TR', (b) => b.cardName(RATING_SKIP_CARD).player(player));
    recordSkippedEffect(player, RATING_SKIP_REASON,
      {label: RATING_SKIP_LABEL, effect: {direction: 'gain', icon: 'tr', amount: 1}}, {log: false});
  };
  const events = player.game.events;
  if (events === undefined) {
    record();
    return;
  }
  events.withEffectSource(player, {kind: 'card', card: RATING_SKIP_CARD, owner: player.color}, 'rating-skipped', record);
}
