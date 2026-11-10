/*
 * @console-shared LIVE — console native stands on this file.
 *
 * WHAT MORE THAN ONE SHELL CONTROLLER NAMES (architecture v2 — the shell slices): the types, constants and pure
 * functions that were module-level declarations of ConsoleShell.vue and are read by more than one of the domains
 * taken out of it. Lifted by `scripts/shell-extract.mjs lift`. A declaration ONE domain reads lives in that domain's
 * controller; shared mutable state lives in `shellFlowState.ts`, with its owner named.
 */
import type {PreselectAddress} from '@/common/inputs/preselectAddress';
import {CardName} from '@/common/cards/CardName';
import {SelectCardModel, SelectPaymentModel, SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {ChoiceSeriesKey} from '@/client/console/promptSeries';
import {InputResponse} from '@/common/inputs/InputResponse';
import {EffectDecisionViewModel} from '@/client/console/effectDecision/effectDecisionModel';
import {ConsoleTask} from '@/client/console/consoleTaskRouter';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {STAGED_STEP_RELEASE_MS} from '@/client/console/stagedPlay';

/** PC04 · GS — the answered member of a series, on the surface that answered it (`noteSeriesAnswer`). */
export type SeriesVisit = {key: ChoiceSeriesKey, surface: 'host' | 'decision', task: ConsoleTask, input: PlayerInputModel, vm?: EffectDecisionViewModel};

export type PendingPlayCard = {
  cardName: CardName;
  input: SelectProjectCardToPlayModel;
  /** The serial of the prompt the composer was opened on — its batch is stamped with it, and a view past it releases
   *  a composer nothing else owns (`playComposerLifetime.ts`). */
  promptId?: number;
};

/** The CLIENT-built standard-project payment, hosted NATIVELY by the task
 * host via `promptOverride` (T3) — nothing committed until confirm; B = Cancel. */
export type PendingClientPayment = {
  cardName: CardName;
  input: SelectPaymentModel;
};

/**
 * A CLIENT-HOSTED PICK — a pre-collected step the server's preview promised for a one-press door (Turmoil Redux
 * RX35: the «where» of the data a replacing law turns the heat / plant conversion's step or the standard project's
 * unit into — `OptionMetadata.steps` / `StandardProjectPreviewModel.steps`). Hosted NATIVELY by the task host via
 * `promptOverride` (the standard-project payment's precedent), teleported into the door's own zone; nothing is sent
 * until its answer, which the door folds into ONE batch beside its own response. B = Cancel, one level back.
 */
export type PendingClientPick = {
  /** The door that owns the zone (and whose own B cancels it). */
  host: 'confirm' | 'standard-projects' | 'finale';
  input: SelectCardModel;
  /** The pre-select address the answer carries (`addressed`). */
  address: PreselectAddress | undefined;
  zone: string;
  onAnswer: (response: InputResponse) => void;
  onCancel: () => void;
  /** The door's own close, once the answer's scene has let go (`clientPickSceneLive`'s falling edge) — or at once when no scene was armed. */
  onSettled?: () => void;
  /** ANSWERED: the batch is on the wire and the receive scene is owed — the pick stands sealed, input absorbed, until the scene ends. */
  answered?: true;
};

/** The synthetic host task for a client-built payment prompt. */
export const CLIENT_PAYMENT_TASK: ConsoleTask = {kind: 'payment'};

/** The synthetic host task of a client-hosted card pick. */
export const CLIENT_PICK_TASK: ConsoleTask = {kind: 'cardSelect', mode: 'target'};

/** The staged vote's RELEASE: the landing scene (the «Разыграно» stage + the landed card's proxy) lets go in place while the Parliament rises — the ONE release beat every staged host shares (`stagedPlay.ts`). */
export const STAGED_VOTE_RELEASE_MS = STAGED_STEP_RELEASE_MS;

/**
 * THE PARLIAMENT'S LEAVE NET (v3 В1): the director's section dissolve is ~170 ms and reports back when it
 * lands; this bounds «it never did». A latched surface may never outlive its own leave by more than a
 * beat — every hold in this console is bounded and named.
 */
export const PARLIAMENT_LEAVE_NET_MS = 900;

/** A HOSTED Parliament step's leave — a dissolve in place inside its host's zone (the embed contract strips the band phrase). */
export const PARLIAMENT_STEP_LEAVE_MS = 240;
