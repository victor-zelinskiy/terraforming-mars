import {ActionPreview, ActionPreviewBranch, ActionPreviewStep} from '../../common/models/ActionPreviewModel';
import {ChoiceContextSource, PlayerInputModel} from '../../common/models/PlayerInputModel';
import {AddressableInput, PreselectAddress, promptAddressOf} from '../../common/inputs/preselectAddress';

/**
 * THE PRE-SELECT ADDRESS OF EVERY STEP — the ONE exit pass of a preview family
 * (the card play, the blue action, the corporation's first action). Every
 * answer a composer collects for a step carries the step's `for`
 * (`addressed(response, step.for)` in the client's response orderers), and the
 * server's batch replay lands that answer ONLY on a prompt with the same
 * address (`server/inputs/deferredInputBatch.ts`, `common/inputs/
 * preselectAddress.ts`) — a question of another asker in front of it waits,
 * untried. Stamped HERE, once, never by each builder: a bespoke hook and a
 * declaration are addressed alike, and a new step builder cannot forget.
 *
 * The address of a step is its input model's ROLE (the input type, `discard`
 * for a marked discard) and the SOURCE the model names — or, when it names
 * none (a nested model carries no `choiceContext`), the card the preview is
 * for: the play's own prompts and the shared steps it queues are marked with
 * that card as their cause (`cardEffect(card)`, `cause: cardSource(card)`), a
 * colony payout routed by it names it as `via`. A step a hook addressed
 * itself (`selectCardStep({for})` — a discard the step model cannot say) keeps
 * its own.
 *
 * NOT stamped: a placement-shaped step (`space` / `party` / `colony`) — those
 * are addressed by the staged flows (`stagedFor`, the server's own
 * `sourceCard` / `choiceContext`), and a guessed card source there would park
 * an answer forever behind its own anonymous prompt.
 */
const NOT_STAMPED: ReadonlySet<string> = new Set(['space', 'party', 'colony', 'deckPick']);

function stepAddress(model: PlayerInputModel, source: ChoiceContextSource): PreselectAddress | undefined {
  const address = promptAddressOf(model as unknown as AddressableInput);
  if (NOT_STAMPED.has(address.role)) {
    return undefined;
  }
  return {role: address.role, source: address.source ?? source};
}

function stampStep(step: ActionPreviewStep, source: ChoiceContextSource): ActionPreviewStep {
  if (step.kind === 'input' || step.kind === 'spendHeat') {
    if (step.for !== undefined) {
      return step;
    }
    const address = stepAddress(step.input, source);
    return address === undefined ? step : {...step, for: address};
  }
  if (step.kind === 'tabbedTargets') {
    // The tab's answer is a top-level `or` response of the card's own prompt.
    return step.for !== undefined ? step : {...step, for: {role: 'or', source}};
  }
  return step;
}

function stampBranch(branch: ActionPreviewBranch, source: ChoiceContextSource): ActionPreviewBranch {
  let address = branch.for;
  if (address === undefined) {
    if (branch.index >= 0) {
      // The branch pick — the `{type:'or', index}` answer to the card's own OrOptions.
      address = {role: 'or', source};
    } else if (branch.optionInput !== undefined) {
      // A lone branch answered by its direct input, bare (the collapsed OrOptions).
      address = stepAddress(branch.optionInput, source);
    }
  }
  return {
    ...branch,
    ...(address !== undefined ? {for: address} : {}),
    steps: branch.steps.map((step) => stampStep(step, source)),
  };
}

/** The source a preview's own prompts name — the card it is for. */
export function previewSource(preview: ActionPreview): ChoiceContextSource {
  return {kind: preview.isCorporation ? 'corporation' : 'card', card: preview.card};
}

/** Stamp every step, pre-step and branch slot of `preview` with its pre-select address. */
export function withPreselectAddresses(preview: ActionPreview): ActionPreview {
  const source = previewSource(preview);
  return {
    ...preview,
    branches: preview.branches.map((branch) => stampBranch(branch, source)),
    ...(preview.preSteps !== undefined ? {preSteps: preview.preSteps.map((step) => stampStep(step, source))} : {}),
  };
}
