import {ActionPreviewStep} from '../../src/common/models/ActionPreviewModel';
import {PlayerInputModel, SelectAmountModel} from '../../src/common/models/PlayerInputModel';

/**
 * A BARE amount dial: a `SelectAmount` the player is asked to set with NO
 * statement of what it costs or produces (`conversion` / `amountResult` /
 * `amountCost` all absent). Every surface can then draw only a number and a
 * range, so the player dials blind — the "maximum information before submit"
 * rule the whole confirm flow exists for. Energy Market shipped exactly this:
 * «выберите количество энергии» with no word of the 2 M€ per step it charges.
 *
 * Shared by the ACTION preview guard and its CARD-PLAY twin so the two can't
 * drift apart on what counts as informative.
 */
export function bareAmountDials(branch: {optionInput?: PlayerInputModel, steps: ReadonlyArray<ActionPreviewStep>}): number {
  const models: Array<SelectAmountModel> = [];
  // A dial nested INSIDE an `and` (the upstream «amount + resource» pair) is a dial too — it must not slip past.
  const collect = (model: PlayerInputModel | undefined): void => {
    if (model?.type === 'amount') {
      models.push(model as SelectAmountModel);
    } else if (model?.type === 'and') {
      for (const part of (model as {options?: ReadonlyArray<PlayerInputModel>}).options ?? []) {
        collect(part);
      }
    }
  };
  collect(branch.optionInput);
  for (const step of branch.steps) {
    if (step.kind === 'input') {
      collect(step.input);
    }
  }
  return models.filter((m) => m.conversion === undefined && m.amountResult === undefined && m.amountCost === undefined).length;
}
