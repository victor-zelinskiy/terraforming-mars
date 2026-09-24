/*
 * CENTRAL POWER GRID (the Industrialists) — Turmoil Redux resolution RX04: the
 * SECOND card of the «counter + influence → capped result» family Architecture
 * Award opened (docs/TURMOIL_REDUX_CENTRAL_POWER_GRID.md). The mechanism is
 * shared to the letter — the declaration (`InfluenceScaledEffect` with a count
 * term and a cap), the one arithmetic (`scaledAmount` / `uncappedAmount`), the
 * standard production change, the recorded outcome, the driver's idempotency.
 * What differs is WHAT IS COUNTED, and that difference is the whole point:
 *
 *   Architecture Award counts CARDS (one card is one unit, whatever it prints);
 *   Central Power Grid counts TAGS — one card contributes EVERY power tag it
 *   prints, so a two-power-tag card is worth 2.
 *
 * Printed: «When enacted: Increase your M€ production 1 step for each Power tag
 * you have + Influence. (Max. 5)» Chairman quest: play 2 power tags.
 *
 * THE READINGS FIXED HERE:
 *  · The amount is min(5, P + I) for EVERY participant — voters or not, with
 *    the Industrialists' effect or not, and a neutral winner cancels nothing.
 *    There is NO winner-only part: nothing of Aquifer Contest's ocean or
 *    Biodome Contest's greenery belongs on this card.
 *  · P = the player's POWER TAGS in play, through the project's canonical tag
 *    counter in the enactment's context (`RESOLUTION_TAG_COUNTING_MODE` —
 *    `'raw'`): every source the counter knows (played projects, the
 *    corporation(s) in play, preludes, CEOs, permanent modifiers) and nothing
 *    else. The hand, the discard and a rival's tableau are not in play at all;
 *    a played event lies face down, so its tags are out of play unless Odyssey.
 *    NO VP icon is involved (Architecture Award's filter is that card's rule,
 *    not the family's), and neither the energy RESOURCE nor energy PRODUCTION
 *    is: a card that raises energy production without printing a power tag
 *    counts 0, a card with a power tag and −2 VP counts in full.
 *  · A WILD TAG IS NOT A POWER TAG. An enactment is not the player's own
 *    action, so the «typical when performing an action» substitution — a
 *    printed wild tag, the Scientists' granted one — never applies, however
 *    the viewer's own turn happens to be counting tags beside the card at the
 *    moment they look. Server, model, forecast and playground read the one
 *    mode; a PRINTED power tag keeps counting either way.
 *  · I = the player's influence through the Redux ledger (`ctx.influence`,
 *    read AFTER the winner's Agenda step of the phase — rulebook p.10).
 *  · «Max. 5» caps the INCREASE (P + I), never the resulting production:
 *    production 8 becomes 13. A negative production rises the ordinary way
 *    (−3 with +4 becomes 1).
 *  · It is a PRODUCTION increase through `production.add` (its events, the
 *    party reactions, the recorder) — never the same amount in cash, never
 *    energy production, never a field write; free, and it spends no action.
 *  · ONCE, at the enactment: the driver's idempotency key
 *    (`effect:<generation>:<instance>:<player>:production`) makes a reload or
 *    a repeated handler call pay nothing twice; a later tag, a later influence
 *    and a change of government never recompute it (the outcome freezes P, I,
 *    the counted cards WITH their own contributions, the sum before the cap
 *    and the value before and after); a LATER enactment of the card is a new
 *    generation's key — a new application by the table as it stands then.
 *  · A result of 0 (no power tag, no influence) is NAMED — a journal line and
 *    a `skipped` outcome — and changes nothing: no flight, no empty prompt.
 *
 * THE STEP MUTATES (IResolution.ts): no question is asked, so `run` applies
 * the increase and reports it; the driver marks the key applied before
 * anything else can run.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Resource} from '../../../../common/Resource';
import {Tag} from '../../../../common/cards/Tag';
import {Size} from '../../../../common/cards/render/Size';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount, uncappedAmount} from '../../../../common/parliament/influenceScaling';
import {EnactStep, ResolutionDefinition} from '../IResolution';
import {resolutionCount} from '../ResolutionCounts';

export const CENTRAL_POWER_GRID_ID: ResolutionId = 'RDX_INDUSTRIALISTS_CENTRAL_POWER_GRID';
export const CENTRAL_POWER_GRID_CODE: ResolutionCode = 'RX04';
/** The printed «(Max. 5)» — a bound on the increase. */
export const CENTRAL_POWER_GRID_CAP = 5;

/** THE FORMULA: +1 M€ production per power tag + 1 per influence, at most +5, for every participant. */
export const CENTRAL_POWER_GRID_PRODUCTION: InfluenceScaledEffect = {
  id: 'production',
  unit: {kind: 'production', resource: Resource.MEGACREDITS},
  perInfluence: 1,
  count: {id: 'powerTags', per: 1},
  cap: CENTRAL_POWER_GRID_CAP,
  recipient: 'each',
};

const PRODUCTION_STEP: EnactStep = {
  key: 'production',
  run(ctx) {
    const player = ctx.player;
    const effect = CENTRAL_POWER_GRID_PRODUCTION;
    // The canonical tag count in the enactment's own context, with the cards
    // that made it — see `ResolutionCounts.ts`.
    const counted = resolutionCount(player, 'powerTags');
    const influence = ctx.influence;
    const uncapped = uncappedAmount(effect, influence, counted.count);
    const amount = scaledAmount(effect, influence, counted.count);
    const recorded = {
      effect: effect.id,
      production: Resource.MEGACREDITS,
      influence,
      count: counted.count,
      counted: [...counted.cards],
      ...(counted.units === undefined ? {} : {countedUnits: [...counted.units]}),
      uncapped,
    };
    if (amount <= 0) {
      ctx.game.log('${0} has no power tag and no influence — no ${1} production from ${2}', (b) =>
        b.player(player).resource(Resource.MEGACREDITS).resolution(CENTRAL_POWER_GRID_ID));
      ctx.report({kind: 'skipped', ...recorded, amount: 0, reason: 'No power tags and no influence'});
      return undefined;
    }
    const before = player.production.megacredits;
    // The standard increase: its events, the party reactions and the
    // recorder see it under this resolution's source. The ONE journal line
    // below carries the whole calculation, so the add itself stays silent.
    player.production.add(Resource.MEGACREDITS, amount, {log: false, from: {resolution: CENTRAL_POWER_GRID_ID}});
    const after = player.production.megacredits;
    if (uncapped > amount) {
      ctx.game.log('${0} gained ${1} ${2} production from ${3}: ${4} power tag(s) + ${5} influence = ${6}, limited to the maximum of ${1} (${7} → ${8})', (b) =>
        b.player(player).number(amount).resource(Resource.MEGACREDITS).resolution(CENTRAL_POWER_GRID_ID)
          .number(counted.count).number(influence).number(uncapped).number(before).number(after));
    } else {
      ctx.game.log('${0} gained ${1} ${2} production from ${3}: ${4} power tag(s) + ${5} influence (${6} → ${7})', (b) =>
        b.player(player).number(amount).resource(Resource.MEGACREDITS).resolution(CENTRAL_POWER_GRID_ID)
          .number(counted.count).number(influence).number(before).number(after));
    }
    ctx.report({kind: 'production', ...recorded, amount, before, after});
    return undefined;
  },
};

export const CENTRAL_POWER_GRID: ResolutionDefinition = {
  id: CENTRAL_POWER_GRID_ID,
  code: CENTRAL_POWER_GRID_CODE,
  module: 'turmoilRedux',
  party: PartyName.INDUSTRIALISTS,
  copies: 1,
  // THE FACE: «1 [M€ production] / [power tag] + [influence]» on one row, the
  // cap on the next — the counted object is the printed TAG medallion (the
  // card counts tags, not cards, so Architecture Award's card glyph would
  // read as a different rule). The tag medallion is never the energy CUBE:
  // the resource plays no part in this formula.
  renderData: CardRenderer.builder((b) => {
    b.production((pb) => pb.megacredits(1)).slash().tag(Tag.POWER).plus().influence().br;
    b.text('max 5', Size.SMALL, true);
  }),
  text: {
    name: 'Central Power Grid',
    effect: 'Raise your M€ production 1 step per power tag you have, plus 1 per influence. Max 5.',
    quest: 'Play 2 power tags',
  },
  quest: {goal: {kind: 'tag', tag: Tag.POWER}, count: 2},
  scaled: [CENTRAL_POWER_GRID_PRODUCTION],
  immediateSteps: [PRODUCTION_STEP],
};
