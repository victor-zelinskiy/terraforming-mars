import {reactive} from 'vue';
import {Message} from '@/common/logs/Message';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';

/**
 * Module-level reactive state for the MANDATORY "play a standard project"
 * prompt (server `SelectStandardProjectToPlay` — EstablishedMethods). Sibling
 * of `handPlayState`, but routed to the STANDARD PROJECTS overlay
 * (`StandardProjectsOverlay`) instead of the hand overlay: the candidates are
 * standard-project cards, not hand cards.
 *
 * Like the action-menu standard-projects flow, the player picks a project and
 * the existing payment path runs — the only difference is this is a TOP-LEVEL
 * `projectCard` prompt, so the response is the BARE {type:'projectCard', card,
 * payment} (empty response path), and the overlay is forced open + can only be
 * minimized (not dismissed) until a project is chosen.
 *
 * The discriminator from hand-play: a top-level `projectCard` whose candidates
 * are NOT all in hand (those are standard projects).
 */

type StandardProjectPlayState = {
  active: boolean;
  minimized: boolean;
  title: string | Message;
  signature: string;
};

export const standardProjectPlayState: StandardProjectPlayState = reactive({
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
 * The top-level `projectCard` prompt IF it's a "play a standard project"
 * prompt — i.e. a top-level projectCard whose candidates are NOT all in the
 * player's hand (hand-play handles the in-hand case; the action menu's own
 * standard-projects option is nested, never top-level).
 */
export function standardProjectPlayPrompt(view: PlayerViewModel): SelectProjectCardToPlayModel | undefined {
  const wf = view.waitingFor;
  if (wf === undefined || wf.type !== 'projectCard') {
    return undefined;
  }
  if (wf.cards.length === 0) {
    return undefined;
  }
  const hand = new Set(view.cardsInHand.map((c) => c.name));
  // All-in-hand → that's the hand-play case, not this one.
  if (wf.cards.every((c) => hand.has(c.name))) {
    return undefined;
  }
  return wf;
}

export function standardProjectPlaySignature(input: SelectProjectCardToPlayModel): string {
  return `${titleText(input.title)}|${input.cards.map((c) => c.name).join(',')}`;
}

export function enterStandardProjectPlay(input: SelectProjectCardToPlayModel): void {
  standardProjectPlayState.active = true;
  standardProjectPlayState.minimized = false;
  standardProjectPlayState.title = input.title;
  standardProjectPlayState.signature = standardProjectPlaySignature(input);
}

export function exitStandardProjectPlay(): void {
  standardProjectPlayState.active = false;
  standardProjectPlayState.minimized = false;
  standardProjectPlayState.signature = '';
}
