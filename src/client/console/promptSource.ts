/*
 * PROMPT SOURCE — the ONE place that turns "who asked for this decision?" into
 * something a console surface can render.
 *
 * WHY: the server names a prompt's origin through FOUR unrelated shapes —
 * `choiceContext.source`, `placementContext.source`, `discardPrompt.source`
 * (all `ChoiceContextSource`) and `SelectProductionToLoseModel.source` (its own
 * `ProductionLossSource`). Each console surface used to read whichever one it
 * happened to know about, and each drew its own answer: a full premium card
 * here, a text chip with a ◈ there, nothing at all somewhere else. The player
 * met the same question — «почему это пришло ко мне?» — in three different
 * visual languages, and one of those languages was "silence".
 *
 * This module normalizes all four into ONE `PromptSourceView`, which
 * `ConsoleSourceDock.vue` renders in ONE way:
 *   - the source IS a card  → the real premium card face (+ fullscreen on L3);
 *   - the source is NOT a card (a colony bonus, a hazard, a standard project,
 *     a game rule) → the SAME dock slot with a text plate naming it, so the
 *     grammar and the position never move.
 *
 * PURITY: no Vue, no DOM, no i18n — it emits English i18n KEYS and passes the
 * server's own `string | Message` through untouched, exactly like
 * `consoleTaskSummary` (which consumes it). That is what lets the guard spec
 * run under the fast server runner.
 */

import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {ChoiceContextSource, PlayerInputModel, SelectProductionToLoseModel} from '@/common/models/PlayerInputModel';
import {ProductionLossSource} from '@/common/models/ProductionLossSource';

export interface PromptSourceView {
  /** The premium card face to render — set exactly when the source IS a card. */
  card?: CardName;
  /** WHAT KIND of source it is — an English i18n KEY, always present. */
  kindKey: string;
  /**
   * The concrete name of a NON-card source, when the server sent one (which
   * colony, which standard project). Never set for a card: the card face
   * already IS its name, and repeating it under the art reads as a caption.
   */
  name?: string | Message;
  /** Only a card can be opened fullscreen — a rule has nothing to show. */
  inspectable: boolean;
  /** A short explanation of the RULE behind a non-card source, when one helps. */
  ruleKey?: string;
  /** A PENALTY reads in the board's own hazard accent, not the calm card one. */
  tone?: 'hazard';
}

/**
 * The kind chip for a source that carries a card. A standard project / action
 * IS a card (it has a `CardName` and a real face) but calling it «Карта» would
 * misfile it — the player picked it from the projects sheet, not from hand.
 */
function cardKindKey(kind: ChoiceContextSource['kind']): string {
  switch (kind) {
  case 'corporation': return 'Corporation';
  case 'standardProject': return 'Standard project';
  case 'colony': return 'Colony';
  default: return 'Card';
  }
}

/** `ChoiceContextSource` — the shape `choiceContext` / `placementContext` /
 *  `discardPrompt` / `deckPickPrompt` all share. */
export function choiceSourceView(source: ChoiceContextSource | undefined): PromptSourceView | undefined {
  if (source === undefined) {
    return undefined;
  }
  if (source.card === CardName.DELTA_PROJECT) {
    // The fork presents the Hydronetwork as a SYSTEMIC module — the lore
    // «Delta Project» card is never dealt and never shown as a card face
    // (the JournalCardChip precedent). Its prompts attribute to the module
    // by name, with nothing to open fullscreen.
    return {kindKey: 'Mars Hydronetwork', inspectable: false};
  }
  if (source.card !== undefined) {
    return {card: source.card, kindKey: cardKindKey(source.kind), inspectable: true};
  }
  switch (source.kind) {
  case 'colony':
    return {kindKey: 'Colony', name: source.name, inspectable: false};
  case 'standardProject':
    return {kindKey: 'Standard project', name: source.name, inspectable: false};
  case 'card':
  case 'corporation':
    // Marked as a card source but WITHOUT a name — the server knows a card
    // asked and not which one. Say that honestly rather than drawing a blank
    // card frame or dropping the attribution altogether.
    return {kindKey: cardKindKey(source.kind), name: source.name, inspectable: false};
  case 'system':
  default:
    return {kindKey: 'Game rule', name: source.name, inspectable: false};
  }
}

/** `ProductionLossSource` — the parallel typed field on `SelectProductionToLose`. */
export function productionLossSourceView(source: ProductionLossSource | undefined): PromptSourceView | undefined {
  switch (source?.type) {
  case 'card':
    return {card: source.card, kindKey: 'Card', inspectable: true};
  case 'hazard':
    return {
      kindKey: 'Hazard zone',
      inspectable: false,
      ruleKey: 'Placing a tile next to a hazard zone forces you to reduce production.',
      tone: 'hazard',
    };
  case 'other':
  default:
    return undefined;
  }
}

/**
 * The source of the given prompt, whichever marker the server used.
 *
 * Order is by SPECIFICITY, not by preference: a prompt carries at most one of
 * these in practice, and `productionToLose` is checked first because its own
 * typed field is strictly richer than a generic context would be (it can say
 * "a hazard zone", which `ChoiceContextSource` has no vocabulary for).
 */
export function promptSourceView(wf: PlayerInputModel | undefined): PromptSourceView | undefined {
  if (wf === undefined) {
    return undefined;
  }
  if (wf.type === 'productionToLose') {
    const view = productionLossSourceView((wf as SelectProductionToLoseModel).source);
    if (view !== undefined) {
      return view;
    }
  }
  return choiceSourceView(
    wf.choiceContext?.source ?? wf.placementContext?.source ??
    wf.discardPrompt?.source ?? wf.deckPickPrompt?.source);
}

/** The source CARD of a prompt, when there is one — the narrow read most
 *  callers want (a dock, a zoom origin, the deferred band's source line). */
export function promptSourceCard(wf: PlayerInputModel | undefined): CardName | undefined {
  return promptSourceView(wf)?.card;
}
