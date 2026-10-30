import {PARLIAMENT_DOOR_REASONS, ScreenHandoffOptions} from '@/client/console/screenHandoff';
import {parliamentParksReveal} from './parliamentRewardBeat';
import {rulingChangeParksReveal} from './rulingChangeDraw';

/**
 * THE ONE HANDOFF A DOOR INTO THE SITTING ASKS (`screenHandoff.ts`): the player's own owed objects only
 * (`PARLIAMENT_DOOR_REASONS` — a reveal not taken, a card on its way into the dock, tokens in the air), and among the
 * reveals only those the sitting does NOT deliver itself — a batch it PARKED for its own beat (a card's answer to a
 * change of power, an Agenda card step) is the sitting's to tell, never owed at its door (the 2026-10-30 deadlocks).
 *
 * ONE constant for every door — the plate's (`enterWorkspaceAfterHandoff`) and the generation scene's rise
 * (`registerGenerationSceneHandoff`): two hand-written option objects are how the foreign-landing half was fixed in one
 * and missed in the other.
 */
export const PARLIAMENT_DOOR: ScreenHandoffOptions = {
  only: PARLIAMENT_DOOR_REASONS,
  ownedReveal: (source) => rulingChangeParksReveal(source) || parliamentParksReveal(source),
};
