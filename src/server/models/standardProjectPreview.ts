/**
 * READ-ONLY: the guaranteed-result preview of a standard project, attached to
 * its CardModel in the standard-projects menu (`ModelUtils.cardsToModel`).
 *
 * Standard projects are bespoke (`actionEssence`, no declarative `behavior`),
 * so `effectsForBehavior` cannot auto-derive them — but almost everything a
 * project guarantees is already declared on the card in rule-source form:
 * the adjusted cost, the reserve units and the `tr` bump (`canPlayOptions` is
 * the very request `canAct` checks). This module turns THOSE into the shared
 * `ActionEffect` chips; anything beyond them (a production step) comes from
 * the co-located `standardProjectPreviewEffects` hook in the card file.
 *
 * Deliberately NOT here: target-dependent consequences (cell bonuses, ocean
 * adjacency, a colony's grant). They belong to the target step's own preview
 * surfaces (board cell preview / colony focus stage) — guessing them before a
 * target exists would be exactly the dishonesty the preview rules forbid.
 *
 * Never mutates game state (test-guarded, like every preview builder).
 */
import {IPlayer} from '../IPlayer';
import {IStandardProjectCard} from '../cards/IStandardProjectCard';
import {ActionEffect} from '../../common/models/ActionPreviewModel';
import {StandardProjectPreviewModel} from '../../common/models/CardModel';
import {Resource} from '../../common/Resource';
import {MAX_OCEAN_TILES} from '../../common/constants';
import * as preview from '../cards/actionPreviews';

/** The `tr.oceans` chip: `globalGain` covers the three scales, oceans count
 *  their own tiles. Clamped exactly like the scales — a maxed board renders
 *  the chip's own honest «no effect» (current === resulting). */
function oceanGain(player: IPlayer, amount: number): ActionEffect {
  const current = player.game.board.getOceanSpaces().length;
  return {
    direction: 'gain', icon: 'oceans', amount,
    current,
    resulting: Math.min(MAX_OCEAN_TILES, current + amount),
  };
}

/**
 * Build the guaranteed preview for one standard project.
 *
 * `calculatedCost` is the SAME number the menu row shows (including a
 * `PlayCardMetadata.overriddenCost` — Standard Technology's rebate path), so
 * the cost chip can never disagree with the price beside it.
 */
export function buildStandardProjectPreview(
  player: IPlayer,
  card: IStandardProjectCard,
  calculatedCost: number,
): StandardProjectPreviewModel {
  const effects: Array<ActionEffect> = [];
  if (calculatedCost > 0) {
    effects.push(preview.stockCost(player, Resource.MEGACREDITS, calculatedCost));
  }
  // Reserve units the project consumes during execution (Moon tiles): a real
  // cost beside the M€ one, from the same request `canAct` checks.
  const reserveUnits = card.canPlayOptions(player).reserveUnits;
  if (reserveUnits !== undefined) {
    if (reserveUnits.steel > 0) {
      effects.push(preview.stockCost(player, Resource.STEEL, reserveUnits.steel));
    }
    if (reserveUnits.titanium > 0) {
      effects.push(preview.stockCost(player, Resource.TITANIUM, reserveUnits.titanium));
    }
  }
  // The card's own `tr` bump — the SAME declaration `canAct` prices TR floods
  // against. Clamps come from the shared builders, so a maxed scale renders
  // the chip's own «no effect» instead of a fake gain.
  const tr = card.tr;
  if (tr !== undefined) {
    if (tr.temperature !== undefined && tr.temperature !== 0) {
      effects.push(preview.globalGain(player, 'temperature', tr.temperature));
    }
    if (tr.oxygen !== undefined && tr.oxygen !== 0) {
      effects.push(preview.globalGain(player, 'oxygen', tr.oxygen));
    }
    if (tr.venus !== undefined && tr.venus !== 0) {
      effects.push(preview.globalGain(player, 'venus', tr.venus));
    }
    if (tr.oceans !== undefined && tr.oceans !== 0) {
      effects.push(oceanGain(player, tr.oceans));
    }
    if (tr.tr !== undefined && tr.tr !== 0) {
      effects.push(preview.trGain(player, tr.tr));
    }
  }
  const extras = card.standardProjectPreviewEffects?.(player);
  if (extras !== undefined) {
    effects.push(...extras);
  }
  const model: StandardProjectPreviewModel = {effects};
  const target = card.standardProjectTarget?.(player);
  if (target !== undefined) {
    model.target = target;
  }
  return model;
}
