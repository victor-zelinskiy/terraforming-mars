import {IPlayer} from '../IPlayer';
import {IProjectCard} from '../cards/IProjectCard';
import {CardRequirements} from '../cards/requirements/CardRequirements';
import {GlobalParameterRequirement} from '../cards/requirements/GlobalParameterRequirement';
import {EventSource} from '../../common/events/EventSource';
import {RequirementEasingModel, RequirementEasingSourceModel} from '../../common/models/ArmedPlayEffectModel';
import {requirementBlockId} from './unplayableReasons';

/**
 * «REQUIREMENT UNDER A MODIFIER» — the ONE reading, per card, of how this
 * player's modifiers bend each printed GLOBAL-PARAMETER requirement of `card`
 * (TR49 class): printed → effective, the modifiers NAMED off the engine's own
 * breakdown (`IPlayer.requirementBonusBreakdown` — whose sum IS the bonus the
 * real `satisfies` folds in, and the bound `unplayableReasons` prints as
 * `effectiveCount`) or the waiver (`IPlayer.globalRequirementWaiver`), and
 * whether the card is playable only THANKS TO them (`decisive`).
 *
 * A requirement no modifier touches is absent; a card with none returns `[]`.
 * When a waiver stands, it alone is named — a shift beside it changes nothing
 * for this play. Read-only: it never calls `satisfies` (whose Think Tank /
 * Aeron bridge stamps `additionalProjectCosts`) and never mutates state.
 *
 * Read by `cardsToModel` (`CardModel.requirementEasing` — the viewer's own
 * hand / draft / reveals) and by `Player.playCard` for the
 * `requirement-eased` event (the play's own record of WHO let it through).
 */
export function requirementEasingOf(player: IPlayer, card: IProjectCard): Array<RequirementEasingModel> {
  const compiled = CardRequirements.compile([...card.requirements]);
  const out: Array<RequirementEasingModel> = [];
  // The per-TYPE ordinal over EVERY requirement — the address the rules block
  // and the reasons share (`requirementBlockId`).
  const seen = new Map<string, number>();
  compiled.requirements.forEach((req, index) => {
    const ordinal = (seen.get(req.type) ?? 0) + 1;
    seen.set(req.type, ordinal);
    if (!(req instanceof GlobalParameterRequirement)) {
      return;
    }
    const parameter = req.globalParameter;
    const waiver = player.globalRequirementWaiver(parameter);
    const breakdown = player.requirementBonusBreakdown(parameter);
    if (waiver === undefined && breakdown.length === 0) {
      return;
    }
    const steps = breakdown.reduce((sum, entry) => sum + entry.steps, 0);
    const current = req.getGlobalValue(player);
    const metRaw = req.meetsWithBonus(current, 0);
    const met = waiver !== undefined || req.meetsWithBonus(current, steps);
    const sources: Array<RequirementEasingSourceModel> = waiver !== undefined ?
      [{source: waiver, kind: 'waive', oneShot: waiverIsOneShot(player, waiver)}] :
      breakdown.map((entry) => ({source: entry.source, kind: 'shift', steps: entry.steps, oneShot: entry.oneShot}));
    out.push({
      key: requirementBlockId(req, ordinal) ?? `req:${req.type}`,
      index,
      type: req.type,
      parameter,
      max: req.max,
      printed: req.count,
      effective: waiver !== undefined ? 'waived' : req.thresholdWithBonus(steps),
      current,
      sources,
      met,
      decisive: met && !metRaw,
    });
  });
  return out;
}

/** A waiver is spent by the next play when its declaration says `nextCardOnly` (the probe's always is). */
function waiverIsOneShot(player: IPlayer, source: EventSource): boolean {
  if (source.kind !== 'card' && source.kind !== 'corporation') {
    return false;
  }
  const card = player.tableau.get(source.card) ?? player.removedFromPlayCards.find((c) => c.name === source.card);
  // Not on the table: the Ecology Experts probe naming itself (`temporaryGlobalRequirementWaiver`).
  return card === undefined || card.globalParameterRequirementBonus?.nextCardOnly === true;
}
