import {reactive} from 'vue';
import {Message} from '@/common/logs/Message';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';

/**
 * Module-level reactive state for the MANDATORY "play a card from your hand"
 * prompt hosted by the КАРТЫ В РУКЕ overlay. Sibling of `handSelectState`.
 *
 * Some cards (EccentricSponsor, EcologyExperts — via the `PlayProjectCard`
 * deferred action) make the server send a TOP-LEVEL `projectCard`
 * (`SelectProjectCardToPlay`) prompt whose candidates are PLAYABLE CARDS FROM
 * HAND. Instead of the legacy play-a-card form, we route those to the premium
 * hand overlay in its normal PLAY mode (РАЗЫГРАТЬ → payment → submit), reusing
 * the exact same flow as the action-menu "Play project card" — the only
 * difference is the action has an EMPTY response path (it's the top-level
 * waitingFor, not a nested action-menu option), and the overlay is forced open
 * + can only be minimized (not dismissed) until a card is played.
 *
 * "Play a standard project" prompts (EstablishedMethods via
 * `SelectStandardProjectToPlay`) are ALSO `projectCard`, but their candidates
 * are standard-project cards (NOT in hand) — those are excluded here and keep
 * the modal route.
 */

type HandPlayState = {
  active: boolean;
  minimized: boolean;
  title: string | Message;
  signature: string;
};

export const handPlayState: HandPlayState = reactive({
  active: false,
  minimized: false,
  title: '',
  signature: '',
});

function titleText(title: string | Message | undefined): string {
  if (title === undefined) {
    return '';
  }
  return typeof title === 'string' ? title : title.message;
}

/**
 * The top-level `projectCard` prompt IF it's a "play a card FROM HAND" prompt
 * (every candidate is in the player's hand). Returns undefined for the
 * action-menu (top-level is `or`, not `projectCard`) and for "play a standard
 * project" prompts (candidates aren't in hand).
 */
export function handPlayPrompt(view: PlayerViewModel): SelectProjectCardToPlayModel | undefined {
  const wf = view.waitingFor;
  if (wf === undefined || wf.type !== 'projectCard') {
    return undefined;
  }
  if (wf.cards.length === 0) {
    return undefined;
  }
  const hand = new Set(view.cardsInHand.map((c) => c.name));
  return wf.cards.every((c) => hand.has(c.name)) ? wf : undefined;
}

export function handPlaySignature(input: SelectProjectCardToPlayModel): string {
  return `${titleText(input.title)}|${input.cards.map((c) => c.name).join(',')}`;
}

export function enterHandPlay(input: SelectProjectCardToPlayModel): void {
  handPlayState.active = true;
  handPlayState.minimized = false;
  handPlayState.title = input.title;
  handPlayState.signature = handPlaySignature(input);
}

export function exitHandPlay(): void {
  handPlayState.active = false;
  handPlayState.minimized = false;
  handPlayState.signature = '';
}
