/**
 * THE CRUMB'S TAIL AFTER A PICK IS ANSWERED — handed ON, never retracted (FLAKE ZERO's recorder found it, 2026-11-15).
 *
 * A pick an effect sends the player into («СБРОС КАРТЫ» — Mars University's discard, an album that IS the decision)
 * names the hand's tail while it stands. When it is answered, the tail goes to what the answer BUYS (the card the
 * discard draws — `nextStage`); when nothing follows (a refusal — RT in the album — or an answer with no next stage),
 * the effect is OVER and the flow concludes: the tail must STAND on the stage it last named until the claim ends.
 * Writing it empty instead let the line fall back to the still-standing batch's «ДОБОР КАРТ» for the conclusion's
 * frames — a step BACKWARDS through a flow that only moves forward (the hand's tail reads `phaseKey` as monotone by
 * construction — `handController` § the outcome stage). It stood ~75 ms on a slow frame; a sampler never saw it.
 *
 * Returns the phase to write, or `undefined` to leave the tail as it stands. Only the pick's OWN key is ever replaced:
 * by the answer the claim may already be naming something else.
 */
export function tailAfterPickAnswer(phaseKey: string, pickStage: string, nextStage: string): string | undefined {
  if (pickStage === '' || phaseKey !== pickStage) {
    return undefined;
  }
  return nextStage !== '' ? nextStage : undefined;
}
