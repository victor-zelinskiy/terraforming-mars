// Campaign «ТЕНДЕРЫ» — THE PORTFOLIO, the pure half (docs/CAMPAIGN_CONCESSIONS_DESIGN.md §16).
//
// ONE reader for the two places a tender can speak — the START of the finale (the wizard's first step) and the
// THRESHOLD before it (the carryover picker's first stage): every holding of the viewer, in acquisition order, with
//   · its STATE on this place (ready · step · blocked · executed · cashed) — the server names why a held one cannot
//     go (`blocked`, invariant 2: availability is never re-derived here);
//   · the VERB A performs;
//   · the READING under the row — WHAT THIS TENDER GIVES HERE, in live numbers («Prelude picks: 2 → 3 of 4»), so the
//     player knows what they get BEFORE the activation (the owner, 2026-11-08);
//   · a CONFIRM when the press is worth a second look (a gamble over live picks, a legacy seat with nothing to fill).
// The hosts render and route; nothing here touches the DOM or the wire.

import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {isGambleTender, tenderDef, TenderId, tenderNameKey, TenderStatus, TenderWindow, TENDER_BROAD_PORTFOLIO_PROJECTS, TENDER_COMPENSATION_MC, TENDER_OPEN_CALL_PRELUDES, TENDER_RESTRUCTURING_CANDIDATES, TENDER_TARGETED_REQUEST_CARDS} from '@/common/campaign/tenders';
import {TenderResponse} from '@/common/inputs/InputResponse';
import {TenderInSelectionModel} from '@/common/models/PlayerInputModel';
import {CarryoverTenderModel} from '@/common/campaign/CampaignModel';
import {TenderCardState, tenderMeta} from './tenderMeta';

export type TenderPlace = 'start' | 'threshold';

/** HOW a start-window tender executes: in one press · a KEEP step on its deal · the restructuring's two answers · a TAG named on the project step. */
export type TenderExecution = 'simple' | 'keep-preludes' | 'keep-projects' | 'restructure' | 'choose-tag' | 'legacy';

export function tenderExecutionOf(id: TenderId): TenderExecution {
  switch (id) {
  case 'preludeReview': return 'keep-preludes';
  case 'projectReview': return 'keep-projects';
  case 'restructuring': return 'restructure';
  case 'targetedRequest': return 'choose-tag';
  case 'programExtension':
  case 'extendedLegacy':
    return 'legacy';
  default:
    return 'simple';
  }
}

/** The portfolio certificate's state on THIS place. */
export type TenderPortfolioState = 'ready' | 'step' | 'blocked' | 'executed' | 'cashed';

export type TenderReading = {key: string, params: ReadonlyArray<string>};

export type TenderPortfolioEntry = {
  instance: string;
  id: TenderId;
  status: TenderStatus;
  window: TenderWindow;
  state: TenderPortfolioState;
  /** The verb A performs (an i18n key) — '' when A does nothing here. */
  verb: string;
  /** The server's reason while `blocked` (an i18n key). */
  reason?: string;
  /** WHAT THIS TENDER GIVES HERE, in live numbers — the line under the row. */
  reading: TenderReading;
  /** The press asks for a SECOND press first (the line names why). */
  confirm?: TenderReading;
  /** The WIZARD step the execution lands on (the start) — the scene travels there before the scene plays. */
  landsOn?: 'corp' | 'prelude' | 'projects';
};

export type StartPortfolioContext = {
  place: 'start';
  tenders: ReadonlyArray<TenderInSelectionModel>;
  /** The live deal of the prelude step and its pick ceiling (0 / 0 without the expansion). */
  preludesDealt: number;
  preludePick: number;
  /** The live deal of the project step and its purchase ceiling. */
  projectsDealt: number;
  projectsMax: number;
  /** The price of ONE starting-hand card after every executed «Субсидия». */
  cardCost: number;
  /** The corporations the finale deploys (the lineage, overrides applied). */
  lineage: ReadonlyArray<CardName>;
  /** The finale's corporation DRAFT offer (0 when the finale deploys the whole lineage) — what «Авантюра: корпорации» redeals. */
  corporationsDealt: number;
  /** The player has picks on the deal (a gamble would clear them). */
  picksLive: boolean;
};

export type ThresholdPortfolioContext = {
  place: 'threshold';
  tenders: ReadonlyArray<CarryoverTenderModel>;
  /** The seat's current legacy limit (the base + the activated seats) and how many cards the hand holds. */
  limit: number;
  handSize: number;
  /** The played preludes of the source mission and the current prelude allowance. */
  playedPreludes: number;
  preludeLimit: number;
};

export type TenderPortfolioContext = StartPortfolioContext | ThresholdPortfolioContext;

const n = (v: number) => String(v);

function stateOf(status: TenderStatus, blocked: string | undefined, needsStep: boolean): TenderPortfolioState {
  if (status === 'executed') {
    return 'executed';
  }
  if (status === 'cashed') {
    return 'cashed';
  }
  if (blocked !== undefined) {
    return 'blocked';
  }
  return needsStep ? 'step' : 'ready';
}

/** The generic reading of a tender that does not speak here: its printed rule. */
function ruleReading(id: TenderId): TenderReading {
  return {key: tenderMeta(id).ruleKey, params: []};
}

function startEntry(ctx: StartPortfolioContext, t: TenderInSelectionModel): TenderPortfolioEntry {
  const id = t.id as TenderId;
  const execution = tenderExecutionOf(id);
  const base = {instance: t.instance, id, status: t.status, window: t.window};
  const done = t.status !== 'held';
  const blocked = done ? undefined : t.blocked;
  const needsStep = execution === 'keep-preludes' || execution === 'keep-projects' || execution === 'restructure' || execution === 'choose-tag';
  const state = stateOf(t.status, blocked, needsStep);
  const verbOf = (): string => {
    if (state === 'executed' || state === 'cashed') {
      return '';
    }
    switch (execution) {
    case 'keep-preludes':
    case 'keep-projects':
      return 'Choose the cards to exchange';
    case 'restructure':
      return t.offer === undefined ? 'Deal the candidates' : 'Continue the restructuring';
    case 'choose-tag':
      return 'Name a tag';
    case 'legacy':
      return '';
    default:
      return 'Execute';
    }
  };
  const reading = ((): TenderReading => {
    switch (id) {
    case 'openCall':
      return {key: 'Preludes in the deal: ${0} → ${1}', params: [n(ctx.preludesDealt), n(ctx.preludesDealt + TENDER_OPEN_CALL_PRELUDES)]};
    case 'broadPortfolio':
      return {key: 'Projects in the deal: ${0} → ${1} · buy up to ${2}', params: [n(ctx.projectsDealt), n(ctx.projectsDealt + TENDER_BROAD_PORTFOLIO_PROJECTS), n(ctx.projectsMax)]};
    case 'targetedRequest':
      return {key: 'Name a tag: ${0} project cards with it join the deal', params: [n(TENDER_TARGETED_REQUEST_CARDS)]};
    case 'researchSubsidy':
      return {key: 'A starting-hand card: ${0} → ${1} M€', params: [n(ctx.cardCost), n(Math.max(0, ctx.cardCost - 1))]};
    case 'preludeReview':
      return {key: 'Return any of the ${0} preludes — as many fresh ones come in their place', params: [n(ctx.preludesDealt)]};
    case 'projectReview':
      return {key: 'Return any of the ${0} projects — as many fresh ones come in their place', params: [n(ctx.projectsDealt)]};
    case 'gamblePreludes':
      return {key: 'Redeal all ${0} preludes', params: [n(ctx.preludesDealt)]};
    case 'gambleProjects':
      return {key: 'Redeal all ${0} projects', params: [n(ctx.projectsDealt)]};
    case 'gambleCorporations':
      return {key: 'Redeal the ${0} corporations offered', params: [n(ctx.corporationsDealt)]};
    case 'restructuring':
      return t.offer === undefined ?
        {key: '${0} corporations are dealt — one may take the place of any in the lineage (${1})', params: [n(TENDER_RESTRUCTURING_CANDIDATES), n(ctx.lineage.length)]} :
        {key: 'The candidates are dealt — choose one and the lineage corporation it replaces', params: []};
    default:
      return ruleReading(id);
    }
  })();
  const landsOn = ((): TenderPortfolioEntry['landsOn'] => {
    switch (id) {
    case 'openCall':
    case 'preludeReview':
    case 'gamblePreludes':
      return 'prelude';
    case 'broadPortfolio':
    case 'researchSubsidy':
    case 'projectReview':
    case 'targetedRequest':
    case 'gambleProjects':
      return 'projects';
    case 'restructuring':
    case 'gambleCorporations':
      return 'corp';
    default:
      return undefined;
    }
  })();
  // A GAMBLE over live picks asks for a second press — the redeal clears whatever was chosen on that step.
  const confirm = isGambleTender(id) && state === 'ready' && ctx.picksLive ?
    {key: 'Your picks on the deal will be cleared — press again to redeal everything', params: []} : undefined;
  return {...base, state, verb: verbOf(), ...(blocked !== undefined ? {reason: blocked} : {}), reading, ...(confirm !== undefined ? {confirm} : {}), ...(landsOn !== undefined ? {landsOn} : {})};
}

function thresholdEntry(ctx: ThresholdPortfolioContext, t: CarryoverTenderModel): TenderPortfolioEntry {
  const id = t.id;
  const base = {instance: t.instance, id, status: t.status, window: t.window};
  const done = t.status !== 'held';
  const blocked = done ? undefined : t.blocked;
  const state = stateOf(t.status, blocked, false);
  const verb = state === 'ready' ? 'Execute' : '';
  const reading = ((): TenderReading => {
    switch (id) {
    case 'extendedLegacy':
      return {key: 'Legacy seats: ${0} → ${1} · ${2} card(s) in hand', params: [n(ctx.limit), n(ctx.limit + 1), n(ctx.handSize)]};
    case 'programExtension':
      return {key: 'A played prelude comes along: ${0} → ${1} of the ${2} you played', params: [n(ctx.preludeLimit), n(ctx.preludeLimit + 1), n(ctx.playedPreludes)]};
    default:
      return ruleReading(id);
    }
  })();
  // THE FOOL-PROOF (the owner, 2026-11-08): a seat nothing can fill is opened only on a second press — the
  // compensation would have paid 3 M€ for the same certificate.
  const confirm = id === 'extendedLegacy' && state === 'ready' && ctx.handSize <= ctx.limit ?
    {key: 'Only ${0} card(s) in hand — the new seat would stay empty; press again to execute anyway (unexecuted it pays ${1} M€)', params: [n(ctx.handSize), n(TENDER_COMPENSATION_MC)]} : undefined;
  return {...base, state, verb, ...(blocked !== undefined ? {reason: blocked} : {}), reading, ...(confirm !== undefined ? {confirm} : {})};
}

/** EVERY holding of the viewer on this place, in acquisition order (stable under the d-pad). */
export function tenderPortfolio(ctx: TenderPortfolioContext): Array<TenderPortfolioEntry> {
  return ctx.place === 'start' ?
    ctx.tenders.map((t) => startEntry(ctx, t)) :
    ctx.tenders.map((t) => thresholdEntry(ctx, t));
}

/** The portfolio's headline counts — «исполнено k из n» (the dock pile, the summary row). */
export function tenderPortfolioCounts(entries: ReadonlyArray<Pick<TenderPortfolioEntry, 'state'>>): {executed: number, open: number, total: number} {
  const executed = entries.filter((e) => e.state === 'executed').length;
  const open = entries.filter((e) => e.state === 'ready' || e.state === 'step').length;
  return {executed, open, total: entries.length};
}

/** The certificate face's state for a holding's status (the portfolio shows the holder's own cards). */
export function tenderCardStateOf(status: TenderStatus): TenderCardState {
  return status;
}

// ── THE START's answers on the wire (`{type: 'tender'}` on the same `initialCards` prompt) ──────────────────────

/** The ONE-PRESS answer: a simple kind, or the restructuring's first answer (the deal of the candidates). */
export function tenderPressResponse(entry: Pick<TenderPortfolioEntry, 'instance' | 'id'> & {offer?: ReadonlyArray<CardName>}): TenderResponse | undefined {
  const execution = tenderExecutionOf(entry.id);
  if (execution === 'simple' || (execution === 'restructure' && entry.offer === undefined)) {
    return {type: 'tender', instance: entry.instance};
  }
  return undefined;
}

/** An EXCHANGE's answer: the dealt cards returned to the deck (as many fresh ones come in their place). */
export function tenderExchangeResponse(instance: string, release: ReadonlyArray<CardName>): TenderResponse {
  return {type: 'tender', instance, release: [...release]};
}

/** THE RESTRUCTURING's second answer: the candidate taken in place of a lineage corporation. */
export function tenderRestructureResponse(instance: string, take: CardName, replace: CardName): TenderResponse {
  return {type: 'tender', instance, take, replace};
}

/** THE RESTRUCTURING declined: the candidates go back to the deck, the tender stays held. */
export function tenderRestructureDecline(instance: string): TenderResponse {
  return {type: 'tender', instance, decline: true};
}

/** The crumb's stage while a step mode stands on a deal step (an i18n key). */
export function tenderModeStageKey(mode: 'review' | 'restructure' | 'tag'): string {
  switch (mode) {
  case 'review': return 'Card exchange';
  case 'restructure': return 'Restructuring';
  default: return 'Tag';
  }
}

/** «Целевой запрос»: the named tag on the wire. */
export function tenderTagResponse(instance: string, tag: Tag): TenderResponse {
  return {type: 'tender', instance, tag};
}

export function tenderPortfolioName(id: TenderId): string {
  return tenderNameKey(id);
}

/** The owner's law: «они не исполняются здесь» — the places a tender speaks on, by its window. */
export function tenderSpeaksAt(id: TenderId, place: TenderPlace): boolean {
  return tenderDef(id).window === (place === 'start' ? 'start' : 'legacy');
}
