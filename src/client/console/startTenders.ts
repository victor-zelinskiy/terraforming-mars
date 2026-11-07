// CAMPAIGN «ТЕНДЕРЫ» — the START window, read by the Game Start Workspace's «НАСЛЕДИЕ» stage
// (docs/CAMPAIGN_CONCESSIONS_DESIGN.md §7–§8). Every tender of the start window is EXECUTED from the finale's initial
// selection through a `tender` answer on the very `initialCards` prompt: the server lands the effect on the deal and
// serves the SAME selection again. The pure half lives here — what a tender's execution asks of the player (nothing,
// a KEEP of at most one card, or the restructuring's two picks), the exact wire response of each step, the bar's verb
// — so the scene renders and routes, never decides.

import {CardName} from '@/common/cards/CardName';
import {TenderResponse} from '@/common/inputs/InputResponse';
import {TenderInSelectionModel} from '@/common/models/PlayerInputModel';
import {TenderId, tenderDef, tenderNameKey} from '@/common/campaign/tenders';
import {TenderCardState} from '@/client/console/campaign/tenderMeta';

/** HOW a tender executes from the start: in one press, through a KEEP step, through the restructuring's picks — or never here. */
export type TenderExecution = 'simple' | 'keep-preludes' | 'keep-projects' | 'restructure' | 'legacy';

export function tenderExecutionOf(id: TenderId): TenderExecution {
  switch (id) {
  case 'preludeReview': return 'keep-preludes';
  case 'projectReview': return 'keep-projects';
  case 'restructuring': return 'restructure';
  case 'programExtension':
  case 'extendedLegacy':
    return 'legacy';
  default:
    return tenderDef(id).window === 'start' ? 'simple' : 'legacy';
  }
}

/** The step a tender opens INSIDE the «НАСЛЕДИЕ» stage before its answer goes to the server. */
export type StartTenderStep =
  | {kind: 'keep', instance: string, id: TenderId, pool: 'prelude' | 'projects', keep: CardName | undefined}
  | {kind: 'restructure', instance: string, id: TenderId, offer: ReadonlyArray<CardName>, take: CardName | undefined, replace: CardName | undefined};

/** The step a held tender opens on A — `undefined` for a tender that executes in one press or never from here. */
export function tenderStepFor(entry: TenderInSelectionModel): StartTenderStep | undefined {
  const id = entry.id as TenderId;
  switch (tenderExecutionOf(id)) {
  case 'keep-preludes':
    return {kind: 'keep', instance: entry.instance, id, pool: 'prelude', keep: undefined};
  case 'keep-projects':
    return {kind: 'keep', instance: entry.instance, id, pool: 'projects', keep: undefined};
  case 'restructure':
    // The candidates are dealt by the FIRST answer; the step opens once the server names them (`offer`).
    return entry.offer === undefined ? undefined :
      {kind: 'restructure', instance: entry.instance, id, offer: [...entry.offer], take: undefined, replace: undefined};
  default:
    return undefined;
  }
}

/** The ONE-PRESS answer of a tender (a simple kind, or the restructuring's first answer that deals the candidates). */
export function tenderPressResponse(entry: TenderInSelectionModel): TenderResponse | undefined {
  const id = entry.id as TenderId;
  const execution = tenderExecutionOf(id);
  if (execution === 'simple' || (execution === 'restructure' && entry.offer === undefined)) {
    return {type: 'tender', instance: entry.instance};
  }
  return undefined;
}

/** The step's COMMIT answer — `undefined` while the step is not complete (the bar's RT dims). */
export function tenderStepCommit(step: StartTenderStep): TenderResponse | undefined {
  if (step.kind === 'keep') {
    return {type: 'tender', instance: step.instance, keep: step.keep === undefined ? [] : [step.keep]};
  }
  if (step.take === undefined || step.replace === undefined) {
    return undefined;
  }
  return {type: 'tender', instance: step.instance, take: step.take, replace: step.replace};
}

/** The restructuring's DECLINE — the candidates go back, the tender stays held (the compensation buys it back). */
export function tenderStepDecline(step: StartTenderStep): TenderResponse | undefined {
  return step.kind === 'restructure' ? {type: 'tender', instance: step.instance, decline: true} : undefined;
}

/** A KEEP step's toggle: the same card again lets it go; another card takes the one place. */
export function toggleKeep(step: StartTenderStep, name: CardName): StartTenderStep {
  if (step.kind !== 'keep') {
    return step;
  }
  return {...step, keep: step.keep === name ? undefined : name};
}

/** The restructuring's pick: a candidate sets `take`, a lineage corporation sets `replace` — the same key, by zone. */
export function pickRestructure(step: StartTenderStep, name: CardName, zone: 'offer' | 'lineage'): StartTenderStep {
  if (step.kind !== 'restructure') {
    return step;
  }
  if (zone === 'offer') {
    return {...step, take: step.take === name ? undefined : name};
  }
  return {...step, replace: step.replace === name ? undefined : name};
}

/** The certificate's state on the stage — the holding's status in the face's own words. */
export function tenderCardStateOf(status: TenderInSelectionModel['status']): TenderCardState {
  switch (status) {
  case 'executed': return 'executed';
  case 'cashed': return 'cashed';
  default: return 'held';
  }
}

export type StartTenderVerb = {label: string, enabled: boolean, reason?: string};

/**
 * The A verb for the FOCUSED tender on the stage — «Исполнить» for a held start-window tender (a restructuring with
 * its candidates dealt opens its step instead), a disabled, named status for everything else; `undefined` = no A.
 */
export function startTenderVerb(entry: TenderInSelectionModel, busy: boolean): StartTenderVerb | undefined {
  if (entry.status !== 'held') {
    return undefined;
  }
  const execution = tenderExecutionOf(entry.id as TenderId);
  if (execution === 'legacy') {
    return {label: 'Execute', enabled: false, reason: 'Realized on the carryover step'};
  }
  if (busy) {
    return {label: 'Executing…', enabled: false};
  }
  if (execution === 'restructure' && entry.offer !== undefined) {
    return {label: 'Continue the restructuring', enabled: true};
  }
  return {label: 'Execute', enabled: true};
}

/** The step's one-line ASK (an English i18n key). */
export function tenderStepAskKey(step: StartTenderStep): string {
  if (step.kind === 'keep') {
    return step.pool === 'prelude' ?
      'Keep at most one prelude — the rest are redealt once' :
      'Keep at most one project card — the rest are redealt once';
  }
  return 'Take one of the dealt corporations in place of one of yours — or decline';
}

/** The step's status line (an English i18n key + params). */
export function tenderStepStatus(step: StartTenderStep, translateCard: (name: CardName) => string): {key: string, params: ReadonlyArray<string>} {
  if (step.kind === 'keep') {
    return step.keep === undefined ?
      {key: 'Nothing kept — the whole deal is redealt', params: []} :
      {key: 'Kept: ${0} — the rest are redealt', params: [translateCard(step.keep)]};
  }
  if (step.take !== undefined && step.replace !== undefined) {
    return {key: '${0} replaces ${1}', params: [translateCard(step.take), translateCard(step.replace)]};
  }
  if (step.take !== undefined) {
    return {key: 'Taking ${0} — choose the corporation it replaces', params: [translateCard(step.take)]};
  }
  return {key: 'Choose a dealt corporation, then the one it replaces', params: []};
}

/** The tender's printed name (an i18n key). */
export function startTenderName(id: TenderId): string {
  return tenderNameKey(id);
}
