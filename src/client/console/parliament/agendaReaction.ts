/*
 * @console-shared LIVE — console native stands on this file.
 *
 * «ИСТРЕБИТЕЛЬ» — THE TABLE ANSWERS A WALK OF THE CAREER (Turmoil Redux — TR78 Arwind Inc.: «whenever you advance your
 * Agenda marker 1 step, add 1 fighter to ANY card»; docs/TURMOIL_REDUX_ARWIND_INC.md). The PURE half: which prompt is
 * such an answer, which surface HOSTS it, the word its stage publishes, and — for the sitting — whether the server's
 * chain is PAUSED on it between the winner's step of the Career and the support. The stage itself — the asker's face
 * on the hero, the picker / the receipt in its zone — is `tableAnswerBeat.ts` + `ConsoleParliamentTableAnswer`.
 *
 * ONE QUESTION (the family's pick, or its LAYOUT when a walk of several steps meets several holders), THREE HOSTS —
 * read off the server's structural marker `agendaWalkPrompt` (never a title):
 *  · `card`       — a card's own walk (TR04 …): the play's composer pre-collects it (a table question, addressed to the
 *                   corporation); a live one is the HAND's — the play's own workspace;
 *  · `quest`      — the chairman's quest: a step of the «ПРЕДСЕДАТЕЛЬСТВО» flow, hosted in the quest's own stage zone
 *                   after the step's bonus has landed (`chairmanQuestDirector` holds for it);
 *  · `phase`      — the sitting's winner step: the server's chain WAITS on it (`phase.pending` — the support and the
 *                   enactment are still ahead), the walk stops after ПОВЕСТКА and the stage's zone hosts it on the
 *                   enactment page; the answer continues the SAME sitting from ПОДДЕРЖКА;
 *  · `resolution` — a law's step of the Career (RX39): a question of the law's seat step, hosted where every question
 *                   of the law is — the reward page's zone (`sittingAskResolution`).
 *
 * The pick itself is the family's: the task host's card target step (`ConsolePlayedTargetStep`) with the corporation in
 * its dock, and its answer is the live pick's receive scene (`cardReceive/promptReceive.ts`, family `plate`) — the
 * fighter leaves the corporation's PRINTED icon for the chosen card's capsule. Pure: no DOM, no timers.
 */
import {reactive} from 'vue';
import {AgendaWalkPromptMeta, PlayerInputModel} from '@/common/models/PlayerInputModel';
import {AGENDA_REACTION_PENDING_KEY, ParliamentPhaseModel} from '@/common/models/ParliamentModel';

export type AgendaReactionHost = 'hand' | 'parliament';

/** The step of the Career this prompt answers, by the server's own marker — undefined for every other prompt. */
export function agendaReactionOf(wf: PlayerInputModel | undefined): AgendaWalkPromptMeta | undefined {
  return wf?.agendaWalkPrompt;
}

/** WHO hosts the answer: a card's walk is its play's (the hand); every walk the Parliament runs is the Parliament's. */
export function agendaReactionHost(meta: AgendaWalkPromptMeta): AgendaReactionHost {
  return meta.reason === 'card' ? 'hand' : 'parliament';
}

/** The answer of the CHAIRMAN'S QUEST's step — a step of the quest's flow. */
export function questReactionOf(wf: PlayerInputModel | undefined): AgendaWalkPromptMeta | undefined {
  const meta = agendaReactionOf(wf);
  return meta?.reason === 'quest' ? meta : undefined;
}

/** The answer of the SITTING's winner step — the chain waits on it. */
export function sittingReactionOf(wf: PlayerInputModel | undefined): AgendaWalkPromptMeta | undefined {
  const meta = agendaReactionOf(wf);
  return meta?.reason === 'phase' ? meta : undefined;
}

/**
 * THE STAGE'S WORD — the unit the answer puts on a card («ИСТРЕБИТЕЛЬ»), read off the question's own reading: the
 * pick's `resourceGainPrompt.cardResource` or the layout's `cardResourceDistributionPrompt.cardResource` — the icon
 * key, whose capitalised form is the resource's i18n key (`fighter` → «Fighter»). Never «ВЫБОР» / «РАСКЛАДКА»: the
 * stage says WHAT is being put down.
 */
export function agendaReactionStageKey(wf: PlayerInputModel | undefined): string {
  const w = wf as {resourceGainPrompt?: {cardResource?: string}, cardResourceDistributionPrompt?: {cardResource?: string}} | undefined;
  const icon = w?.resourceGainPrompt?.cardResource ?? w?.cardResourceDistributionPrompt?.cardResource;
  return icon === undefined || icon === '' ? 'Choice' : icon[0].toUpperCase() + icon.slice(1);
}

/** The unit's word for a RECEIPT on the stage (no prompt — the record's own kind): `fighter` → «Fighter». */
export function agendaReactionResourceKey(resource: string): string {
  return resource === '' ? 'Choice' : resource[0].toUpperCase() + resource.slice(1);
}

/** Is the server's chain PAUSED on a table's answer to the winner's step of the Career (any seat)? */
export function careerPausedAt(phase: ParliamentPhaseModel | undefined): boolean {
  return phase?.pending?.key === AGENDA_REACTION_PENDING_KEY;
}

/**
 * THE SITTING'S PAUSE AT THE CAREER, as the walk has played it — per sitting (`generation:seq`):
 *  · `told`    — the enactment page has played its ПОВЕСТКА while the chain waited (the zone may open now);
 *  · `resumed` — the page's ПОДДЕРЖКА and ПРИНЯТИЕ have played after the answer (the pause is over for the walk).
 * Presentation memory only (the server's position is the truth: `careerPausedAt`); a reload has none, and lands where
 * the position puts it.
 */
export const careerPause = reactive({
  told: '' as string,
  resumed: '' as string,
});

/** The enactment page played its ПОВЕСТКА for `key` while the chain was paused at the Career. */
export function noteCareerAgendaTold(key: string): void {
  careerPause.told = key;
}

/** The page's remaining beats have played after the answer. */
export function noteCareerResumed(key: string): void {
  careerPause.resumed = key;
}

/** Has the ПОВЕСТКА of `key` already played under a pause (the resumed page skips it)? */
export function careerAgendaTold(key: string): boolean {
  return key !== '' && careerPause.told === key;
}

/** Does the walk OWE the enactment page its ПОДДЕРЖКА / ПРИНЯТИЕ — the pause is over on the server, not yet on screen? */
export function careerResumeOwed(key: string, phase: ParliamentPhaseModel | undefined): boolean {
  return careerAgendaTold(key) && careerPause.resumed !== key && !careerPausedAt(phase);
}

export function resetCareerPause(): void {
  careerPause.told = '';
  careerPause.resumed = '';
}
