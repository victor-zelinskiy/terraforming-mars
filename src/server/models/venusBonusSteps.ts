import {ActionPreview, ActionPreviewBranch, ActionPreviewStep} from '../../common/models/ActionPreviewModel';
import {ChoiceContextSource, OptionMetadata, OrOptionsModel} from '../../common/models/PlayerInputModel';
import {AltVenusBonus, altVenusBonusFor} from '../../common/venus/altVenusBonus';
import {IPlayer} from '../IPlayer';
import {ICard} from '../cards/ICard';
import {GrantVenusAltTrackBonusDeferred} from '../venusNext/GrantVenusAltTrackBonusDeferred';
import {previewSource} from './preselectAddresses';

/**
 * THE VENUS BONUS IS PRE-SELECTED (P89 · ledger EL — the owner, 2026-11-02: «для розыгрыша карт либо активации
 * действий синих карт реализовать полноценный pre-select на бонус шкалы Венеры»). ONE exit pass of the preview
 * families that a composer answers before its commit (the card play, the blue action — a repeat of that action reads
 * the copied card's own preview): every branch whose Venus chip earns the alternative board's bonus
 * (`ActionEffect.altVenusBonus`, stamped from the engine's ONE arithmetic) gains a `venusBonus` step carrying the VERY
 * prompt the server will ask — built by the engine's own builder (`GrantVenusAltTrackBonusDeferred.prompt`), never a
 * second model — and its address: the role `venusBonus` and the card that raises the scale (the live prompt names the
 * same card off the event scope, `Game.venusBonusSource`). The answer then lands on that bonus and on no other; a state
 * that moved between the preview and the commit is refused by the prompt and asked live (the hosted step, P89 · EE —
 * the fallback, never removed).
 *
 * The PLAYED card is a holder the live wild will offer (it lands before the bonus is asked) — `pendingHolders`.
 * Read-only: the builder constructs inputs and asks nothing; a step is appended after the branch's own steps (the
 * bonus is deferred at `GAIN_RESOURCE_OR_PRODUCTION`, behind the card's own questions — and addressed, so the order
 * could not misland it anyway).
 */
export function withVenusBonusSteps(player: IPlayer, preview: ActionPreview, played?: ICard): ActionPreview {
  if (player.game.gameOptions.altVenusBoard !== true || player.isMarsBot === true) {
    return preview;
  }
  const source = previewSource(preview);
  return {
    ...preview,
    branches: preview.branches.map((branch) => withBranchBonus(player, branch, source, played)),
  };
}

function withBranchBonus(player: IPlayer, branch: ActionPreviewBranch, source: ChoiceContextSource, played: ICard | undefined): ActionPreviewBranch {
  if (!branch.available || branch.steps.some((step) => step.kind === 'venusBonus')) {
    return branch;
  }
  const marks: Array<{mark: AltVenusBonus, when?: {step: number, option: number}}> =
    branch.effects.flatMap((effect) => effect.altVenusBonus === undefined ? [] : [{mark: effect.altVenusBonus}]);
  marks.push(...optionMarks(branch.steps, player.game.max.venus));
  if (marks.length === 0) {
    return branch;
  }
  const steps: Array<ActionPreviewStep> = marks.map(({mark, when}) => {
    const input = GrantVenusAltTrackBonusDeferred.prompt(player, mark.standard, mark.wild, {from: mark.from, to: mark.to}, source,
      played === undefined ? [] : [played]);
    const model = input.toModel(player);
    // `toModel` leaves the markers to the central serializer (`ServerModel.getWaitingFor`) — a step model carries its own.
    model.venusBonusPrompt = input.venusBonusPrompt;
    return {kind: 'venusBonus', input: model, for: {role: 'venusBonus', source}, ...(when !== undefined ? {when} : {})};
  });
  return {...branch, steps: [...branch.steps, ...steps]};
}

/**
 * A VENUS RAISE THAT IS ONE ANSWER OF AN `or` STEP (PL-1505 — Atmoscoop: «raise the temperature 2 steps OR Venus 2
 * steps»): the option's own `globalParameter` metadata (`optionMetadata.globalParameter('venus', steps, current, …)` —
 * the same reading the option card prints) names the raise, the engine's ONE arithmetic (`altVenusBonusFor`) the
 * bonus it earns. The step it adds is CONDITIONAL — `when` the step is answered with that option.
 */
function optionMarks(steps: ReadonlyArray<ActionPreviewStep>, maxVenus: number): Array<{mark: AltVenusBonus, when: {step: number, option: number}}> {
  const out: Array<{mark: AltVenusBonus, when: {step: number, option: number}}> = [];
  steps.forEach((step, i) => {
    if (step.kind !== 'input' || step.input.type !== 'or') {
      return;
    }
    (step.input as OrOptionsModel).options.forEach((option, k) => {
      const meta = (option as {metadata?: OptionMetadata}).metadata;
      if (meta?.kind !== 'globalParameter' || meta.icon !== 'venus' || meta.global?.current === undefined || meta.amount === undefined) {
        return;
      }
      const mark = altVenusBonusFor(meta.global.current, meta.amount, maxVenus);
      if (mark !== undefined) {
        out.push({mark, when: {step: i, option: k}});
      }
    });
  });
  return out;
}
