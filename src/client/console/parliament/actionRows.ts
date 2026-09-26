import {ICardRenderRoot, ItemType, isICardRenderEffect} from '@/common/cards/render/Types';
import {effectKindOf} from '@/client/components/premiumCard/mechanicsModel';

/** A `b.action(...)` box — the `→` delimiter; a `b.effect(...)` box draws `:`. */
function isActionBox(item: ItemType): boolean {
  return isICardRenderEffect(item) && effectKindOf(item) === 'action';
}

/**
 * THE ACTION OF A PRINTED FACE, ALONE — what an action tile (the action
 * menu's canvas) and the stand's action graphic draw.
 *
 * A row is kept only when it carries an `→` box, and inside it the `:` boxes
 * of a STANDING effect are cut out: the DSL appends `b.effect` and `b.action`
 * to ONE row unless a `br` parts them, so R&D Funding's «: + [science] /
 * [influence]» stood beside its «→ [replay]» on the tile — the enactment's
 * rule inside a button that only repeats an action. A bare enactment row
 * (Open IP Trade's «[card] / [influence]») has no `→` box and is dropped
 * whole. A face with no action row keeps its whole formula: an honest
 * fallback, never a blank canvas.
 */
export function actionRowsOf(root: ICardRenderRoot): ICardRenderRoot {
  const rows = root.rows
    .filter((row) => row.some(isActionBox))
    .map((row) => row.filter((item) => !isICardRenderEffect(item) || effectKindOf(item) === 'action'));
  return rows.length === 0 ? root : {...root, rows};
}
