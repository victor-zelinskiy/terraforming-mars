/*
 * THE HAND PICK — ONE answer to «is this a card picked FROM THE HAND?», at every depth of every surface.
 *
 * THE OWNER'S HARD RULE (2026-10-13, after a TV photo of «Марсианский университет»: the composer listed the hand as a
 * column of card NAMES under «ВЫБЕРИТЕ КАРТУ, ЧТОБЫ СБРОСИТЬ»): a card the player chooses from their hand is chosen IN
 * THE HAND — the premium album entered as a step of the asking surface (`consoleHandPick` bridge, or the server's
 * `handSelect` task the hand section serves) — and NEVER from a flat list, whatever the pick is nested in: a composer's
 * own card step, an option of an `or` step (Mars University's «discard a card to draw one» beside «do nothing»), a
 * table question the play wakes (TR51 — `ActionPreviewStep.reaction`), or a live effect decision.
 *
 * The question used to be asked in THREE hand-written copies (`consoleHandPick.isHandCardSelection`, the effect
 * decision's private `isHandPick`, the play composer's own candidates test) and the `or` branch of the composers asked
 * it NOWHERE — that is how the table question reached the screen as a list. Every surface asks here now.
 */
import {PlayerInputModel, SelectCardModel} from '@/common/models/PlayerInputModel';

/**
 * A card selection whose EVERY candidate (selectable and disabled alike) is one of the named cards, with at least one
 * selectable — the shared ownership test (hand / «Разыграно»).
 */
export function isCardSelectionWithin(model: SelectCardModel, names: ReadonlySet<string>): boolean {
  const candidates = [...model.cards, ...(model.disabledCards ?? [])];
  return model.cards.length > 0 && candidates.every((c) => names.has(c.name));
}

/**
 * IS THIS CARD PICK A PICK FROM THE HAND?
 *
 * Every candidate is in the hand — or the server SAID so: a pick carrying the DISCARD marker (`discardPrompt`) throws
 * cards away FROM THE HAND by construction (the marker is set only on hand discards), so it goes to the hand even when
 * the preview's candidate list was built over a hand the client does not hold yet.
 *
 * `playedCardName` — the card being PLAYED is still in `cardsInHand` while its preview is open. A pick that offers it as
 * a SELECTABLE candidate is a pick over the TABLE it is about to land on (Titan Floating Launch-pad's own floaters), not
 * a hand pick; listed only as DISABLED («эта карта разыгрывается» — Sponsored Academies) it changes nothing.
 */
export function isHandPick(model: SelectCardModel, handNames: ReadonlySet<string>, playedCardName?: string): boolean {
  if (model.cards.length === 0) {
    return false;
  }
  if (model.discardPrompt !== undefined) {
    return true;
  }
  const selfSelectable = playedCardName !== undefined && model.cards.some((c) => c.name === playedCardName);
  if (selfSelectable) {
    return false;
  }
  return isCardSelectionWithin(model, handNames);
}

/** The same question about any input: a `card` input that is a hand pick. */
export function isHandPickInput(input: PlayerInputModel | undefined, handNames: ReadonlySet<string>, playedCardName?: string): input is SelectCardModel {
  return input?.type === 'card' && isHandPick(input as SelectCardModel, handNames, playedCardName);
}

/**
 * WHERE AN `or` OPTION'S OWN QUESTION IS ANSWERED — the door A on that option opens:
 *  · `hand`  — a pick from the hand → the hand album (the bridge), never a list of names;
 *  · `table` — a pick over cards already ON THE TABLE → the embedded target step;
 *  · `list`  — anything else (a player, an amount, cards the console has no shelf for) → the composer's own list.
 * Both composers descend through this ONE verdict; a composer that tests the option by itself is how the hand pick
 * inside Mars University's `or` reached the TV as a column of names.
 */
export type OrOptionDoor = 'hand' | 'table' | 'list';

export function orOptionDoor(
  nested: PlayerInputModel | undefined,
  handNames: ReadonlySet<string>,
  playedNames: ReadonlySet<string>,
  playedCardName?: string,
): OrOptionDoor {
  if (nested?.type !== 'card') {
    return 'list';
  }
  const model = nested as SelectCardModel;
  if (isHandPick(model, handNames, playedCardName)) {
    return 'hand';
  }
  return isCardSelectionWithin(model, playedNames) ? 'table' : 'list';
}

/**
 * THE HAND PICK INSIDE AN `or`: the option whose own input is a hand pick (Mars University: option 0, the discard), so
 * the surface that shows the `or` makes that option a DOOR into the hand and wraps the answer back into its index. One
 * level deep — the shape the server builds; the first such option (an `or` never offers two hand picks).
 */
export function orHandPickOption(
  input: PlayerInputModel | undefined,
  handNames: ReadonlySet<string>,
  playedCardName?: string,
): {index: number, select: SelectCardModel} | undefined {
  if (input?.type !== 'or') {
    return undefined;
  }
  for (let index = 0; index < input.options.length; index++) {
    const option = input.options[index];
    if (isHandPickInput(option, handNames, playedCardName)) {
      return {index, select: option};
    }
  }
  return undefined;
}
