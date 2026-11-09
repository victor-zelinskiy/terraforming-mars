// Campaign «ТЕНДЕРЫ» — THE TENDER DOOR, the pure half (docs/CAMPAIGN_CONCESSIONS_DESIGN.md §16 · §19).
//
// ONE reader for the two places a tender can speak — the START of the finale (the wizard's deal pages) and the
// THRESHOLD before it (the carryover picker's album) — and, since the «ДВЕРЬ» iteration (the owner, 2026-11-09), for
// WHERE ON THAT PLACE it speaks: a tender executes on the page whose cards it changes, and only there («давать
// пересбросить прологи ДО того как увидел раздачу — бред»). Every holding of the viewer, with
//   · its PAGE (`tenderPageOf`) — the prelude step, the project step, the corporation step, any selection step (the
//     restructuring rewrites the lineage the dock shows on every page), the legacy album;
//   · its STATE on the page the player stands on: `ready` (it executes HERE) · `elsewhere` (held, its page is another —
//     the note names it) · `blocked` (the server's reason, invariant 2) · `executed` · `cashed`;
//   · the READING — WHAT THIS TENDER GIVES HERE, in live numbers («Preludes in the deal: 4 → 6»), so the player knows
//     what they get BEFORE the press (the owner, 2026-11-08);
//   · the NOTE under a certificate that cannot go here — WHY, in words (never a dim alone).
// The door's list is ordered «ready first, then the others with their reasons, then the done ones» (`tenderDoorList`).
// The hosts render and route; nothing here touches the DOM or the wire.

import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {tenderDef, TenderId, tenderNameKey, TenderStatus, TenderWindow, TENDER_BROAD_PORTFOLIO_PROJECTS, TENDER_OPEN_CALL_PRELUDES, TENDER_RESTRUCTURING_CANDIDATES, TENDER_TARGETED_REQUEST_CARDS} from '@/common/campaign/tenders';
import {TenderResponse} from '@/common/inputs/InputResponse';
import {TenderInSelectionModel} from '@/common/models/PlayerInputModel';
import {CarryoverTenderModel} from '@/common/campaign/CampaignModel';
import {TenderCardState, tenderMeta} from './tenderMeta';

export type TenderPlace = 'start' | 'threshold';

/** HOW a start-window tender executes: a CONFIRM of a previewed effect · an EXCHANGE on its deal · the restructuring's two answers · a TAG named on the project step. */
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

/**
 * THE PAGE A TENDER SPEAKS ON — the screen whose cards it changes (a static fact of the catalog, never an
 * availability: the server still says whether it CAN go). `any` = every deal page of the start (the restructuring
 * rewrites the lineage the dock carries on every page); `legacy` = the threshold's album.
 */
export type TenderPage = 'corp' | 'prelude' | 'projects' | 'any' | 'legacy';

export function tenderPageOf(id: TenderId): TenderPage {
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
  case 'gambleCorporations':
    return 'corp';
  case 'restructuring':
    return 'any';
  default:
    return tenderDef(id).window === 'legacy' ? 'legacy' : 'any';
  }
}

/** The page the player stands on: a start wizard page (or its summary) — the threshold has one page, the album. */
export type TenderStandingPage = 'corp' | 'prelude' | 'ceo' | 'projects' | 'summary' | 'legacy';

/** Does a tender of this page speak on the page the player stands on? */
export function tenderSpeaksOnPage(page: TenderPage, here: TenderStandingPage): boolean {
  switch (page) {
  case 'any':
    return here === 'corp' || here === 'prelude' || here === 'ceo' || here === 'projects';
  default:
    return page === here;
  }
}

/** The certificate's state on THIS page. */
export type TenderPortfolioState = 'ready' | 'elsewhere' | 'blocked' | 'executed' | 'cashed';

export type TenderReading = {key: string, params: ReadonlyArray<string>};

export type TenderPortfolioEntry = {
  instance: string;
  id: TenderId;
  status: TenderStatus;
  window: TenderWindow;
  page: TenderPage;
  state: TenderPortfolioState;
  /** WHY it cannot go HERE (an i18n key: the server's reason, or the page it speaks on) — absent when it can / is done. */
  note?: string;
  /** WHAT THIS TENDER GIVES HERE, in live numbers — the line of the focused certificate. */
  reading: TenderReading;
};

export type StartPortfolioContext = {
  place: 'start';
  tenders: ReadonlyArray<TenderInSelectionModel>;
  /** The page the player stands on. */
  page: TenderStandingPage;
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

/** The note of a held certificate whose page is another one — WHERE it executes, in words. */
export function tenderPageNoteKey(page: TenderPage): string {
  switch (page) {
  case 'prelude': return 'Executes on the prelude step';
  case 'projects': return 'Executes on the project step';
  case 'corp': return 'Executes on the corporation step';
  case 'legacy': return 'Executes on the legacy step before the finale';
  default: return 'Executes on any selection step';
  }
}

function stateOf(status: TenderStatus, blocked: string | undefined, here: boolean): TenderPortfolioState {
  if (status === 'executed') {
    return 'executed';
  }
  if (status === 'cashed') {
    return 'cashed';
  }
  if (blocked !== undefined) {
    return 'blocked';
  }
  return here ? 'ready' : 'elsewhere';
}

/** The generic reading of a tender that does not speak here: its printed rule. */
function ruleReading(id: TenderId): TenderReading {
  return {key: tenderMeta(id).ruleKey, params: []};
}

/** WHAT A START TENDER GIVES, in the deal's own numbers. */
export function startTenderReading(ctx: Omit<StartPortfolioContext, 'place' | 'tenders' | 'page'>, id: TenderId, offer?: ReadonlyArray<CardName>): TenderReading {
  switch (id) {
  case 'openCall':
    return {key: 'Preludes in the deal: ${0} → ${1}', params: [n(ctx.preludesDealt), n(ctx.preludesDealt + TENDER_OPEN_CALL_PRELUDES)]};
  case 'broadPortfolio':
    return {key: 'Projects in the deal: ${0} → ${1} · buy up to ${2}', params: [n(ctx.projectsDealt), n(ctx.projectsDealt + TENDER_BROAD_PORTFOLIO_PROJECTS), n(ctx.projectsMax)]};
  case 'targetedRequest':
    return {key: 'Name a tag: ${0} project cards with it join the deal', params: [n(TENDER_TARGETED_REQUEST_CARDS)]};
  case 'researchSubsidy':
    return {key: 'A starting-hand card: ${0} → ${1} M€', params: [n(ctx.cardCost), n(Math.max(1, ctx.cardCost - 1))]};
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
    return offer === undefined ?
      {key: '${0} corporations are dealt — one may take the place of any in the lineage (${1})', params: [n(TENDER_RESTRUCTURING_CANDIDATES), n(ctx.lineage.length)]} :
      {key: 'The candidates are dealt — choose one and the lineage corporation it replaces', params: []};
  default:
    return ruleReading(id);
  }
}

function startEntry(ctx: StartPortfolioContext, t: TenderInSelectionModel): TenderPortfolioEntry {
  const id = t.id as TenderId;
  const page = tenderPageOf(id);
  const done = t.status !== 'held';
  const blocked = done ? undefined : t.blocked;
  const here = tenderSpeaksOnPage(page, ctx.page);
  const state = stateOf(t.status, blocked, here);
  const note = state === 'blocked' ? blocked : state === 'elsewhere' ? tenderPageNoteKey(page) : undefined;
  return {
    instance: t.instance, id, status: t.status, window: t.window, page, state,
    ...(note !== undefined ? {note} : {}),
    reading: startTenderReading(ctx, id, t.offer),
  };
}

/** WHAT A LEGACY TENDER GIVES on the threshold, in the seat's own numbers. */
export function thresholdTenderReading(ctx: Omit<ThresholdPortfolioContext, 'place' | 'tenders'>, id: TenderId): TenderReading {
  switch (id) {
  case 'extendedLegacy':
    return {key: 'Legacy seats: ${0} → ${1} · ${2} card(s) in hand', params: [n(ctx.limit), n(ctx.limit + 1), n(ctx.handSize)]};
  case 'programExtension':
    return {key: 'Preludes into the finale: ${0} → ${1} of the ${2} you played', params: [n(ctx.preludeLimit), n(ctx.preludeLimit + 1), n(ctx.playedPreludes)]};
  default:
    return ruleReading(id);
  }
}

function thresholdEntry(ctx: ThresholdPortfolioContext, t: CarryoverTenderModel): TenderPortfolioEntry {
  const id = t.id;
  const page = tenderPageOf(id);
  const done = t.status !== 'held';
  const blocked = done ? undefined : t.blocked;
  const state = stateOf(t.status, blocked, page === 'legacy');
  const note = state === 'blocked' ? blocked : state === 'elsewhere' ? tenderPageNoteKey(page) : undefined;
  return {
    instance: t.instance, id, status: t.status, window: t.window, page, state,
    ...(note !== undefined ? {note} : {}),
    reading: thresholdTenderReading(ctx, id),
  };
}

/** EVERY holding of the viewer on this place, in acquisition order (the dock's stable row). */
export function tenderPortfolio(ctx: TenderPortfolioContext): Array<TenderPortfolioEntry> {
  return ctx.place === 'start' ?
    ctx.tenders.map((t) => startEntry(ctx, t)) :
    ctx.tenders.map((t) => thresholdEntry(ctx, t));
}

const DOOR_ORDER: Record<TenderPortfolioState, number> = {ready: 0, elsewhere: 1, blocked: 2, executed: 3, cashed: 4};

/**
 * THE DOOR's LIST (the owner, 2026-11-09): «сначала те, что можно активировать, а дальше те, что нельзя — с причиной
 * на каждом». A STABLE sort by the state's rank (acquisition order within a rank), so the d-pad never meets a reshuffle
 * while the page stands.
 */
export function tenderDoorList(entries: ReadonlyArray<TenderPortfolioEntry>): Array<TenderPortfolioEntry> {
  return entries
    .map((e, i) => ({e, i}))
    .sort((a, b) => (DOOR_ORDER[a.e.state] - DOOR_ORDER[b.e.state]) || (a.i - b.i))
    .map(({e}) => e);
}

/** How many certificates execute on THIS page — the door lights («можно исполнить») only when > 0. */
export function tenderReadyHere(entries: ReadonlyArray<Pick<TenderPortfolioEntry, 'state'>>): number {
  return entries.filter((e) => e.state === 'ready').length;
}

/** The portfolio's headline counts — «исполнено k из n» (the dock's tally, the summary row). */
export function tenderPortfolioCounts(entries: ReadonlyArray<Pick<TenderPortfolioEntry, 'state'>>): {executed: number, open: number, total: number} {
  const executed = entries.filter((e) => e.state === 'executed').length;
  const open = entries.filter((e) => e.state === 'ready' || e.state === 'elsewhere').length;
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

/**
 * THE RESTRUCTURING resolved with the lineage KEPT: the candidates go back to the deck, the tender is executed — the
 * cards were drawn, the decision was made (the owner, 2026-11-09: there is no decline once they are dealt).
 */
export function tenderRestructureKeep(instance: string): TenderResponse {
  return {type: 'tender', instance, keep: true};
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
