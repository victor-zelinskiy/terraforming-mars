/*
 * JOVIAN TAX RIGHTS (Unity) — Turmoil Redux resolution RX17: two finished
 * halves in one card, and the SIXTH kind of counted term — a count over the
 * player's COLONIES (docs/TURMOIL_REDUX_JOVIAN_TAX_RIGHTS.md).
 *
 * Printed: «When enacted: Gain titanium equal to your Influence. Increase your
 * M€ production 1 step for each colony you have. (Max. 5)» Chairman quest:
 * play 2 Jovian tags. Colonies are mandatory in Redux, so the card declares
 * no compatibility (Colony Contest's reading — the colony symbol in the scan's
 * field is the original edition's marker, not this fork's gate).
 *
 * THE READINGS FIXED HERE:
 *  · TITANIUM = influence, for EVERY participant — Colony Contest's step, word
 *    for word: into the supply (`stock.add`), never production, no cap;
 *    influence 0 → nothing, NAMED («No influence»), no question.
 *  · M€ PRODUCTION = 1 step per COLONY, at most 5 — a cap on the PRODUCTION
 *    part alone (the face prints «(Max. 5)» under the production formula, the
 *    catalog reads «+1 пр. M€ за колонию (max 5)»); the titanium is unbounded.
 *    Influence does NOT enter this part (`perInfluence: 0` — the card prints
 *    no influence beside the colony), unlike Architecture Award's «+ Influence».
 *  · A COLONY IS A CUBE of the player's on a colony tile, never the tile: two
 *    cubes on two tiles are 2, and two cubes on ONE tile (where the rules let
 *    that happen) are 2 as well. THE NUMBER IS THE ENGINE'S: the shared
 *    `ColoniesHandler.coloniesOf` — the very reading the behavior counter
 *    (`Counter`, «colonies» countables) and `Player.getColoniesCount` stand
 *    on — read through the count family's reader (`resolutionCount` →
 *    `countColoniesToward`); nothing here walks the colony table itself, and
 *    the LIST of tiles rides the model and the record so the number can be
 *    explained tile by tile.
 *  · ZERO COLONIES is the rule working, not a failure: the titanium comes,
 *    the production does not rise, and the record NAMES it («No colonies») —
 *    a skip distinct from the titanium's «No influence»: the card can pay one
 *    part and skip the other.
 *  · THE ORDER OF THE GENERATION: the sitting runs AFTER the production
 *    phase (`Game.gotoProductionPhase` → the colonies' end-of-generation step →
 *    `ParliamentPhase.start`), so the titanium is spendable next generation
 *    while the production first PAYS in the next generation — the readings
 *    name that horizon (Industrialist Budget's mechanism) and never sum the
 *    two. The colonies' own end-of-generation step moves tracks and returns
 *    fleets; it builds no colony, so it cannot move the count — pinned by spec.
 *  · MarsBot takes no seat: never paid, and its cubes count for nobody.
 *
 * THE STEP CONTRACT (IResolution.ts): both steps MUTATE (nothing here asks),
 * and each reports exactly once — the skips included.
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

export const JOVIAN_TAX_RIGHTS_ID: ResolutionId = 'RDX_UNITY_JOVIAN_TAX_RIGHTS';
export const JOVIAN_TAX_RIGHTS_CODE: ResolutionCode = 'RX17';
/** The printed «(Max. 5)» — a bound on the production increase alone; the titanium is not capped. */
export const JOVIAN_TAX_RIGHTS_CAP = 5;

/** THE TITANIUM: 1 per point of influence, for every participant — no count, no cap (Colony Contest's formula). */
export const JOVIAN_TAX_RIGHTS_TITANIUM: InfluenceScaledEffect = {
  id: 'titanium',
  unit: {kind: 'stock', resource: Resource.TITANIUM},
  perInfluence: 1,
  recipient: 'each',
};

/** THE PRODUCTION: +1 M€ production per colony, at most +5, for every participant — influence does not enter. */
export const JOVIAN_TAX_RIGHTS_PRODUCTION: InfluenceScaledEffect = {
  id: 'production',
  unit: {kind: 'production', resource: Resource.MEGACREDITS},
  perInfluence: 0,
  count: {id: 'colonies', per: 1},
  cap: JOVIAN_TAX_RIGHTS_CAP,
  recipient: 'each',
};

/** The production skip's reason when the seat has no colony — an English key; the stage plate translates it. */
export const NO_COLONIES = 'No colonies';

const TITANIUM_STEP: EnactStep = {
  key: 'titanium',
  run(ctx) {
    const player = ctx.player;
    const effect = JOVIAN_TAX_RIGHTS_TITANIUM;
    const influence = ctx.influence;
    const amount = scaledAmount(effect, influence);
    if (amount <= 0) {
      ctx.game.log('${0} has no influence — no titanium from ${1}', (b) => b.player(player).resolution(JOVIAN_TAX_RIGHTS_ID));
      ctx.report({kind: 'skipped', effect: effect.id, stock: Resource.TITANIUM, amount: 0, influence, reason: 'No influence'});
      return undefined;
    }
    const before = player.titanium;
    // The standard gain: its event carries this resolution as the source (the
    // journal chip, the notification's «why», the recorder). The ONE journal
    // line below carries the whole calculation, so the add itself stays silent.
    player.stock.add(Resource.TITANIUM, amount, {log: false, from: {resolution: JOVIAN_TAX_RIGHTS_ID}});
    const after = player.titanium;
    ctx.game.log('${0} gained ${1} ${2} from ${3}: 1 per point of influence, influence ${4} (${5} → ${6})', (b) =>
      b.player(player).number(amount).resource(Resource.TITANIUM).resolution(JOVIAN_TAX_RIGHTS_ID).number(influence).number(before).number(after));
    ctx.report({kind: 'stock', effect: effect.id, stock: Resource.TITANIUM, amount, influence, before, after});
    return undefined;
  },
};

const PRODUCTION_STEP: EnactStep = {
  key: 'production',
  run(ctx) {
    const player = ctx.player;
    const effect = JOVIAN_TAX_RIGHTS_PRODUCTION;
    // THE ENGINE's own list of the seat's colonies (one per cube), through the
    // family's shared reader — with the LIST of tiles that explains it.
    const counted = resolutionCount(player, 'colonies');
    const influence = ctx.influence;
    const uncapped = uncappedAmount(effect, influence, counted.count);
    const amount = scaledAmount(effect, influence, counted.count);
    const recorded = {
      effect: effect.id,
      production: Resource.MEGACREDITS,
      influence,
      count: counted.count,
      counted: [...counted.cards],
      countedColonies: [...(counted.colonies ?? [])],
      uncapped,
    };
    if (amount <= 0) {
      // Zero colonies — the rule working: named, nothing changes. (Influence
      // is not an input here, so this skip never says «no influence».)
      ctx.game.log('${0} has no colonies — no ${1} production from ${2}', (b) =>
        b.player(player).resource(Resource.MEGACREDITS).resolution(JOVIAN_TAX_RIGHTS_ID));
      ctx.report({kind: 'skipped', ...recorded, amount: 0, reason: NO_COLONIES});
      return undefined;
    }
    const before = player.production.megacredits;
    // The standard increase: its events, the party reactions and the
    // recorder see it under this resolution's source. The ONE journal line
    // below carries the whole calculation, so the add itself stays silent.
    player.production.add(Resource.MEGACREDITS, amount, {log: false, from: {resolution: JOVIAN_TAX_RIGHTS_ID}});
    const after = player.production.megacredits;
    if (uncapped > amount) {
      ctx.game.log('${0} gained ${1} ${2} production from ${3}: 1 per colony, ${4} colony(-ies) = ${5}, limited to the maximum of ${1} (${6} → ${7})', (b) =>
        b.player(player).number(amount).resource(Resource.MEGACREDITS).resolution(JOVIAN_TAX_RIGHTS_ID)
          .number(counted.count).number(uncapped).number(before).number(after));
    } else {
      ctx.game.log('${0} gained ${1} ${2} production from ${3}: 1 per colony, ${4} colony(-ies) (${5} → ${6})', (b) =>
        b.player(player).number(amount).resource(Resource.MEGACREDITS).resolution(JOVIAN_TAX_RIGHTS_ID)
          .number(counted.count).number(before).number(after));
    }
    ctx.report({kind: 'production', ...recorded, amount, before, after});
    return undefined;
  },
};

export const JOVIAN_TAX_RIGHTS: ResolutionDefinition = {
  id: JOVIAN_TAX_RIGHTS_ID,
  code: JOVIAN_TAX_RIGHTS_CODE,
  module: 'turmoilRedux',
  party: PartyName.UNITY,
  copies: 1,
  // THE FACE, as printed: the two formulas side by side on one row — «[titanium]
  // / [influence]» (the RESOURCE, as on Colony Contest) and «[1 M€ production]
  // / [colony]» (the counted object is the COLONY TILE symbol the game prints for
  // a colony; a cube would read as a resource, a card as another rule) — and the
  // cap on the next, under the production formula it bounds.
  renderData: CardRenderer.builder((b) => {
    b.titanium(1).slash().influence().nbsp.nbsp.production((pb) => pb.megacredits(1)).slash().colonies(1).br;
    b.text('max 5', Size.SMALL, true);
  }),
  text: {
    name: 'Jovian Tax Rights',
    effect: 'Gain 1 titanium for every point of your influence. Raise your M€ production 1 step per colony you have. Max 5.',
    quest: 'Play 2 Jovian tags',
  },
  quest: {goal: {kind: 'tag', tag: Tag.JOVIAN}, count: 2},
  scaled: [JOVIAN_TAX_RIGHTS_TITANIUM, JOVIAN_TAX_RIGHTS_PRODUCTION],
  // THE PRINTED ORDER: the titanium first, the production second.
  immediateSteps: [TITANIUM_STEP, PRODUCTION_STEP],
};
