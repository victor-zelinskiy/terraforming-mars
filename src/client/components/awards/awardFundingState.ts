import {reactive} from 'vue';
import {Message} from '@/common/logs/Message';
import {OrOptionsModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';

/*
 * Module-level reactive state for the "fund an award" overlay mode (currently
 * the FREE sponsorship granted by Vitor's start-of-game action). Lives at module
 * scope — like sellPatentsState / handSelectState / startGameFlowState — so it
 * survives the `<player-home :key="playerkey">` remount on every server
 * response. The AwardsOverlay reuses its existing tiles; this mode only adds the
 * "free sponsorship" framing + a mandatory pill when the overlay is closed.
 */
type AwardFundingStateShape = {
  // Funding mode is live (a free-funding prompt is the top-level waitingFor).
  active: boolean;
  // The overlay was collapsed to the shared mandatory pill (board inspection).
  minimized: boolean;
  // Identity of the current prompt; a NEW prompt re-opens the overlay.
  signature: string;
};

export const awardFundingState: AwardFundingStateShape = reactive({
  active: false,
  minimized: false,
  signature: '',
});

function titleText(title: string | Message | undefined): string {
  if (title === undefined) {
    return '';
  }
  return typeof title === 'string' ? title : (title.message ?? '');
}

/**
 * The top-level FREE award-funding prompt, detected via the EXPLICIT server
 * marker (never the translatable title). Its options are existing game awards
 * (titled with the bare AwardName), so the AwardsOverlay can render them. Returns
 * undefined for the paid Fund-an-award action (nested in the action menu, no
 * marker) and every non-funding prompt.
 */
export function freeAwardFundingPrompt(view: PlayerViewModel | undefined): OrOptionsModel | undefined {
  const wf = view?.waitingFor;
  if (wf === undefined) {
    return undefined;
  }
  if (wf.type === 'or' && wf.awardFundingPrompt?.free === true) {
    return wf;
  }
  return undefined;
}

/** Identity hash of a funding prompt — its offered award option titles. */
export function awardFundingSignature(prompt: OrOptionsModel): string {
  return prompt.options.map((o) => titleText(o.title)).join('|');
}

export function enterAwardFunding(signature: string): void {
  awardFundingState.active = true;
  awardFundingState.minimized = false;
  awardFundingState.signature = signature;
}

export function exitAwardFunding(): void {
  awardFundingState.active = false;
  awardFundingState.minimized = false;
  awardFundingState.signature = '';
}
