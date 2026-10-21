/*
 * THE DRAW BY INFLUENCE (Turmoil Redux) — the ONE executor of a flat `cards`
 * part paid to every participant: «draw 1 card per point of your influence».
 * Open IP Trade (RX24) wrote it, Sponsored Projects (RX40) copied it word for
 * word, UNMI Veto (RX42) would have been the third copy — so the step is
 * shared, and the two earlier laws stand on it byte for byte (their specs are
 * the proof: not one line of them moved).
 *
 * WHAT THE STEP FIXES:
 *  · THE SHARED INTAKE (`ExternalDrawIntake`): the project deck, the standard
 *    exhaustion behaviour, the cards withheld from the hand until TAKEN, the
 *    mandatory take prompt re-derivable from the intake.
 *  · RE-ENTRY (a reload inside the take): the cards already left the deck and
 *    sit in the intake — game state. Nothing is drawn again; the prompt is
 *    re-derived from the intake remembered in `ctx.state` (the same key every
 *    copy used, so a save written under a copy resumes under the step).
 *  · THE NAMED ZEROS: influence 0 draws nothing and says so («No influence»);
 *    a deck (and its discard) with nothing left records the skip with its own
 *    reason; a short deck names how many of the owed cards were left.
 *  · THE RECORD — `kind: 'cards'` with the amount owed, the cards drawn and
 *    the intake the take rides.
 */
import {ResolutionId} from '../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../common/parliament/influenceScaling';
import {ExternalDrawIntake} from '../../deferredActions/ExternalDrawIntake';
import {EnactStep} from './IResolution';

/** The state key the step keeps its intake under — the proof it already drew (the Climate Research pattern). */
const INTAKE_KEY = 'drawIntake';

/**
 * The shared step for `effect` — a flat `cards` unit by influence, for every
 * participant. Refuses any other declaration: the step and its unit are one
 * thing (a counted or a level draw has its own executor).
 */
export function influenceDrawStep(resolution: ResolutionId, effect: InfluenceScaledEffect): EnactStep {
  if (effect.unit.kind !== 'cards' || effect.count !== undefined || effect.level !== undefined || effect.sequel !== undefined || effect.recipient !== 'each') {
    throw new Error(`${resolution}: influenceDrawStep takes a flat cards-by-influence part for every participant, got ${JSON.stringify(effect)}`);
  }
  return {
    key: effect.id,
    run(ctx) {
      const player = ctx.player;
      // RE-ENTRY (a reload inside the take): the cards already left the deck and
      // sit in the intake — game state. Nothing is drawn again; the mandatory
      // prompt is re-derived from the intake.
      const remembered = ctx.state[INTAKE_KEY];
      if (typeof remembered === 'number') {
        const pending = ExternalDrawIntake.pendingOf(player, remembered);
        return pending === undefined ? undefined : ExternalDrawIntake.takePromptFor(player, pending);
      }
      const influence = ctx.influence;
      const owed = scaledAmount(effect, influence);
      if (owed <= 0) {
        ctx.game.log('${0} has no influence — no cards from ${1}', (b) => b.player(player).resolution(resolution));
        ctx.report({kind: 'skipped', effect: effect.id, amount: 0, influence, reason: 'No influence'});
        return undefined;
      }
      // THE SHARED INTAKE: the project deck, the standard exhaustion behaviour,
      // the cards withheld from the hand until taken, the prompt re-derivable.
      const intake = ExternalDrawIntake.open(player, owed, {kind: 'resolution', resolution, effect: effect.id});
      if (intake === undefined) {
        // The deck (and its discard) had nothing left — named, never silent.
        ctx.report({kind: 'skipped', effect: effect.id, amount: owed, drawn: 0, influence, reason: 'The project deck is empty'});
        return undefined;
      }
      ctx.state[INTAKE_KEY] = intake.id;
      ctx.game.log('${0} draws ${1} card(s) from ${2}: 1 per point of influence, influence ${3}', (b) =>
        b.player(player).number(intake.count).resolution(resolution).number(influence));
      if (intake.count < owed) {
        ctx.game.log('Only ${0} of ${1} card(s) were left in the deck for ${2}', (b) =>
          b.number(intake.count).number(owed).player(player));
      }
      ctx.report({kind: 'cards', effect: effect.id, amount: owed, drawn: intake.count, intake: intake.id, influence});
      return ExternalDrawIntake.takePromptFor(player, intake);
    },
  };
}
