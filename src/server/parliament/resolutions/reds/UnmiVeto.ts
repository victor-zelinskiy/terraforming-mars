/*
 * UNMI VETO (the Reds) — Turmoil Redux resolution RX42, the last card of the
 * owner's set of 42, and the SECOND law of the REPLACING kind (the first is
 * Diverted Research, RX35). Where that law takes the whole terraforming unit
 * (the scale does not move, the tile is not seated) and puts data in its
 * place after a question, this one takes ONLY THE RATING and puts NOTHING in
 * its place and asks NOTHING: the scale step moves, the tile is seated, the
 * bonuses of the track and the cell arrive — the rating step alone is refused
 * (docs/TURMOIL_REDUX_UNMI_VETO.md).
 *
 * Printed: «When enacted: Draw cards equal to your influence. Effect: The
 * player(s) with the highest TR ignore any TR they would gain.» Chairman
 * quest: play 2 Mars tags.
 *
 * THE READINGS FIXED HERE:
 *  · THE DRAW AT THE ENACTMENT: 1 card × the seat's influence through the
 *    shared intake — Open IP Trade's step, now the family's shared
 *    `influenceDrawStep` (RX24 and RX40 stand on it too). Influence 0 is a
 *    NAMED zero.
 *  · WHO IS UNDER THE VETO — LIVE, at every gain (decision Р2): every player
 *    whose rating equals the maximum among EVERY player of the game, MarsBot
 *    included in the comparison (Р3); a tie at the top binds every one of
 *    them. Nothing is fixed at the enactment and nothing is serialized —
 *    `ratingLeaders(game)` is read at every event and at every model build,
 *    the ONE source of truth the funnel, the previews, the model and the
 *    readings share.
 *  · THE UNIT IS ONE EVENT OF THE FUNNEL (Р2): `increaseTerraformRating(n)`
 *    is judged whole at the moment of the call — all n or none. A seat one
 *    below the top with «+3» gains all three and is first by rating from then
 *    on (its next gain is refused). Inside ONE action the events are
 *    independent and come in the engine's own order: «+2 temperature» is one
 *    event; the 0 °C ocean a second; a greenery is two (the oxygen's rating,
 *    the Redux tile's rating); Giant Ice Asteroid three. The exit pass of the
 *    previews projects the same sequence («promised in the order performed»).
 *  · EVERYTHING THAT GOES THROUGH THE FUNNEL AS A GAIN is refused: a card's
 *    `tr` and a bespoke raise, the scale steps and the ocean, the Venus track
 *    bonus, the Redux greenery's rating, the Agenda track's step (the winner's
 *    step of the NEXT sitting included, while this law still stands), a
 *    colony's rating, Ares' cleanup, the UNMI corporation's own action (3 M€
 *    for a rating the seat first by rating does not get — by the letter), the
 *    final greenery of the last generation. NOT refused: a LOWERING (the law
 *    says «gain»), the World Government's move (nobody gains a rating there),
 *    a seat outside the parliament, a zero.
 *  · WHAT FOLLOWS A REFUSED RATING NEVER HAPPENS — by the funnel's own order,
 *    nothing is undone here: no `trThisGeneration`, no «raised this
 *    generation» (the UNMI corporation stays closed; Pristar is paid as «not
 *    raised» — by the letter), no `tr-changed`, no Greens' M€, no any-player
 *    reactor, no endgame point. The scale step, the tile, the track's bonus,
 *    the cell's bonus, `global-parameter-changed`, `tile-placed` — all as
 *    printed, upstream of the funnel.
 *  · THE LOSS IS NAMED, WITH ITS MAGNITUDE — always (invariant 4): one journal
 *    line with the number and the law, one `effect-skipped` record under the
 *    law's own scope (channel `rating-vetoed`) — the journal's row, the
 *    actor's law card, the rival's line, the stats' count.
 *  · THE STATUS MOVES AND THE MOVE IS NAMED: every raise and every lowering
 *    of any rating is watched while the law stands (`withRatingVetoWatch`) —
 *    a seat that enters or leaves the top is told (`rating-veto-changed`).
 *  · MARSBOT IS UNDER THE VETO AND IN THE COMPARISON (Р3 — the `restriction`
 *    aspect, a bot's under `'politics'`): a bot first by rating gains no
 *    rating through the same funnel, by not one branch of its own.
 *  · THE NEXT LAW'S WINNER PART is never refused by THIS law: the enactment
 *    puts the new card in the slot BEFORE its steps run, so Mohole Contest
 *    after UNMI Veto pays its winner the rating.
 *  · THE QUEST («play 2 Mars tags») counts the seat's own played Mars tags —
 *    Mars First Budget's goal and key; the enactment's draw never counts.
 *  · THE FORECAST TWIN is the family's one exit pass over every preview
 *    (`models/vetoedRating.ts`, right after the implied-rating pass): every
 *    rating chip the funnel would refuse is STRUCK (`ActionEffect.vetoed`),
 *    the law's own fact reads the sum (`ctx.vetoed`), and the «no effect»
 *    verdict names the law where the rating was the action's whole result
 *    (Р5). The owner's requirement is that no surface promises «+N TR» to a
 *    seat the law will refuse — the sweep guard proves the promise and the
 *    refusal agree number for number.
 *  · No `compatibility`: the card needs nothing beyond the Redux table.
 *
 * THE STEP CONTRACT (IResolution.ts): the one step ASKS (the take) and never
 * mutates outside the intake; a reload inside the take re-derives the prompt.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Tag} from '../../../../common/cards/Tag';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect} from '../../../../common/parliament/influenceScaling';
import {ActionEffect} from '../../../../common/models/ActionPreviewModel';
import {recordSkippedEffect} from '../../../deferredActions/skippedEffect';
import {ResolutionDefinition} from '../IResolution';
import {influenceDrawStep} from '../ResolutionInfluenceDraw';

export const UNMI_VETO_ID: ResolutionId = 'RDX_REDS_UNMI_VETO';
export const UNMI_VETO_CODE: ResolutionCode = 'RX42';
/** The printed «2 [Mars tag]» — the chairman quest's count (Mars First Budget's goal). */
export const UNMI_VETO_QUEST_MARS_TAGS = 2;

/** THE DRAW: 1 card per point of influence, for every participant — Open IP Trade's part, word for word. */
export const UNMI_VETO_DRAW: InfluenceScaledEffect = {
  id: 'draw',
  unit: {kind: 'cards'},
  perInfluence: 1,
  recipient: 'each',
};

/**
 * WHY the rating did not come — the ONE reason every surface prints: the
 * named skip's reason, the «no effect» verdict's reason, the forecast's note.
 * No parameter: the law is named by the scope / the chip's hint, the sentence
 * stands on its own on a tile.
 */
export const UNMI_VETO_REASON = 'Your terraform rating is the highest — the enacted resolution ignores the gain';
/** The skipped effect's label — the shared name of the rating (the board dossier's). */
export const UNMI_VETO_SKIPPED_LABEL = 'Terraform rating';
/** The forecast fact's title (the law's own sentence in the «Сработает» row). */
export const UNMI_VETO_FORECAST_TITLE = 'UNMI Veto: your terraform rating is the highest — the rating is not gained';

export const UNMI_VETO: ResolutionDefinition = {
  id: UNMI_VETO_ID,
  code: UNMI_VETO_CODE,
  module: 'turmoilRedux',
  party: PartyName.REDS,
  copies: 1,
  // THE FACE, as printed: the per-influence formula on its own row («[card] /
  // [influence]»), then the passive as ONE rule — «[TR with «>» inside] :
  // [TR struck]» — the highest rating (the «>» inside the rating icon, the
  // DSL's `text` option) and the rating it does not gain (Pristar's own
  // struck rating — `cancelled`).
  renderData: CardRenderer.builder((b) => {
    b.cards(1).slash().influence().br;
    b.effect(undefined, (eb) => {
      eb.tr(1, {text: '>'}).startEffect.tr(1, {cancelled: true});
    });
  }),
  text: {
    name: 'UNMI Veto',
    // Open IP Trade's key — the same part, the same sentence.
    effect: 'Draw 1 card per influence.',
    // The block label says WHEN («Эффект, пока принята»); the sentence says WHAT.
    passive: 'The player(s) with the highest terraform rating ignore any rating they would gain.',
    // Mars First Budget's key — the same goal.
    quest: 'Play 2 Mars tags',
  },
  quest: {goal: {kind: 'tag', tag: Tag.MARS}, count: UNMI_VETO_QUEST_MARS_TAGS},
  scaled: [UNMI_VETO_DRAW],
  immediateSteps: [influenceDrawStep(UNMI_VETO_ID, UNMI_VETO_DRAW)],
  passive: {
    // THE VETO — inside the dispatcher's scope (the gate and the law's event
    // source are its): the loss is JOURNALED with its magnitude and RECORDED
    // as the named skip; `true` tells the funnel to grant nothing. Nothing
    // stands in the rating's place.
    vetoRating(player, gain) {
      player.game.log('${0} does not gain ${1} ${2}: ${3} — the highest rating', (b) =>
        b.player(player).number(gain.steps).tr().resolution(UNMI_VETO_ID));
      recordSkippedEffect(player, UNMI_VETO_REASON,
        {label: UNMI_VETO_SKIPPED_LABEL, effect: {direction: 'gain', icon: 'tr', amount: gain.steps}}, {log: false});
      return true;
    },
    // THE FORECAST TWIN reads the family's exit pass (`ctx.vetoed` — the sum
    // of the rating chips the pass struck), on the channel the live marker
    // fires on: a SKIPPED fact — «−N [TR] not gained» — never an exact one.
    forecast(ctx) {
      const steps = ctx.vetoed.steps;
      if (steps <= 0) {
        return [];
      }
      const chip: ActionEffect = {direction: 'gain', icon: 'tr', amount: steps};
      return [ctx.skipped(ctx.source('rating-vetoed'), [chip], UNMI_VETO_FORECAST_TITLE, {id: 'unmi-veto-rating', note: UNMI_VETO_REASON})];
    },
  },
};
