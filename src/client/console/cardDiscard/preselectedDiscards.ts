import {CardName} from '@/common/cards/CardName';
import {ActionPreviewStep} from '@/common/models/ActionPreviewModel';
import {DiscardPromptMeta, SelectCardModel} from '@/common/models/PlayerInputModel';

/** One discard a composer answered BEFORE the press: the cards it names and the step's own server marker. */
export type PreselectedDiscard = {names: ReadonlyArray<CardName>, meta: DiscardPromptMeta};

/**
 * THE DISCARDS A COMPOSER PRE-SELECTED — read off each step's SERVER marker (`discardPrompt` on a card step), never a
 * title, paired with the answer the composer captured for that step (`{type: 'card', cards}`). ONE reader for both
 * doors that pre-collect a discard: the card ACTION (P68 Ceres Tech Market — `ConsoleActionComposer`) and the card PLAY
 * (P86 Unexpected Application, Sponsored Academies, Strategic Shift — `ConsolePlayCardConfirm` → the shell). The cards
 * leave at the COMMIT, from the dock (`armPreselectedDiscard`); an empty answer arms nothing.
 */
export function preselectedDiscardsOf(
  steps: ReadonlyArray<ActionPreviewStep>,
  captured: Readonly<Record<number, unknown>>,
): Array<PreselectedDiscard> {
  const out: Array<PreselectedDiscard> = [];
  steps.forEach((step, i) => {
    const meta = step.kind === 'input' && step.input.type === 'card' ? (step.input as SelectCardModel).discardPrompt : undefined;
    const answer = captured[i] as {type?: string, cards?: ReadonlyArray<CardName>} | undefined;
    if (meta !== undefined && answer?.type === 'card' && answer.cards !== undefined && answer.cards.length > 0) {
      out.push({names: [...answer.cards], meta});
    }
  });
  return out;
}
