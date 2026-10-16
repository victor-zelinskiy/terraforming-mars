/*
 * @console-shared LIVE — THE ACTION TILE'S READING (TR60, decision 6a: «одна разметка — два хоста»).
 *
 * The «Действия карт» tile is drawn in two places now: the workspace that ACTS (ConsoleCardActions) and the
 * Information workspace's «Действия» zone that only READS (`ConsoleActionGroupView` in `readonly`). Everything a
 * tile SAYS — its verdict, its status chip, its diagnostics line, its caption, a source's uses — is read here, once,
 * from the tile model (`buildConsoleActionsModel`), so the two hosts can never word one action two ways.
 *
 * PURE: no DOM, no Vue (labels are i18n keys; the translated lines go through the one i18n door).
 */
import {ActionStatus} from '@/client/components/actions/actionPlayability';
import {actionRuleText} from '@/client/components/actions/actionDescription';
import {reasonParams} from '@/client/cards/tagLabel';
import {translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {cardPickAskKey} from '@/client/console/consoleActionComposer';
import {
  ConsoleActionReason, ConsoleActionTile, isResolutionActionSource, ParliamentActionSource,
} from '@/client/console/consoleCardActions';

/** What the slot's status chip and the dossier's heading read — the server's status, with «changes nothing» on top. */
export type TileVerdict = ActionStatus | 'futile';

export const TILE_STATUS_HEADING: Readonly<Record<TileVerdict, string>> = {
  available: 'Can perform',
  rules: 'Action unavailable',
  soft: 'Not available right now',
  activated: 'Already activated this generation',
  futile: 'Available, but changes nothing now',
};
export const TILE_STATUS_LABEL: Readonly<Record<TileVerdict, string>> = {
  available: 'Available',
  rules: 'Unavailable',
  soft: 'Not now',
  activated: 'Activated',
  futile: 'No effect now',
};
export const TILE_VERDICT_MARK: Readonly<Record<TileVerdict, string>> = {available: '✦', rules: '✕', soft: '⏳', activated: '✓', futile: '○'};

const CHOICE_KIND_LABEL: Readonly<Record<'card' | 'player' | 'or' | 'payment' | 'spendHeat', string>> = {
  card: 'Choose a card',
  player: 'Choose a player',
  or: 'Choose an option',
  payment: 'Payment',
  spendHeat: 'Heat sources',
};

/** The slot is a LIVE verb that would change nothing right now (the quiet paint, the bottom band). */
export function tileFutile(tile: ConsoleActionTile): boolean {
  return tile.futile !== undefined && (tile.status === 'available' || tile.status === 'soft');
}

export function tileVerdict(tile: ConsoleActionTile): TileVerdict {
  return tile.status === 'available' && tile.futile !== undefined ? 'futile' : tile.status;
}

/**
 * The verdict a READ-ONLY host shows (the Information zone): the turn is the commit's gate, never a reason
 * («МОГ БЫ ≠ МОГУ ПРЯМО СЕЙЧАС») — so «not now» reads as the rules allow it (no chip), and another seat's card says
 * nothing beyond «used» (its availability is that seat's server verdict, invariant 2).
 */
export function readonlyTileVerdict(tile: ConsoleActionTile): TileVerdict {
  const verdict = tileVerdict(tile);
  return verdict === 'soft' ? (tile.futile !== undefined ? 'futile' : 'available') : verdict;
}

export function actionReasonText(reason: ConsoleActionReason | undefined): string {
  if (reason === undefined) {
    return '';
  }
  return typeof reason.message === 'string' ?
    translateTextWithParams(reason.message, reasonParams(reason.params, reason.tag)) :
    translateMessage(reason.message);
}

export function tileReasonText(tile: ConsoleActionTile): string {
  return actionReasonText(tile.reason);
}

/**
 * The slot's DESCRIPTION — what the action does, beside its canvas. Silent only for a TEXT-drawn action: its canvas
 * already IS that sentence. The profile owns the line budget.
 */
export function slotRuleText(tile: ConsoleActionTile): string {
  if (tile.rules === undefined || (tile.node.actionNode === undefined && tile.node.renderRoot === undefined)) {
    return '';
  }
  return actionRuleText(tile.rules.summary);
}

export function choiceKindsLabel(tile: ConsoleActionTile): string {
  return tile.choiceKinds.map((k) => translateText(k === 'card' ? cardPickAskKey(tile.cardPickAmount) : CHOICE_KIND_LABEL[k])).join(' · ');
}

export type SlotMeta = {kind: 'validation' | 'futile' | 'continuation' | 'none', text: string, tone: 'warning' | 'danger'};

/**
 * The slot's STATE line — one of two semantic kinds, resolved from two DIFFERENT model fields, never from styling:
 *  · `validation`   — the rules block this variant (`reason`), the decision-critical line, so it outranks;
 *  · `continuation` — the branch names a next step the graphic cannot draw (`choiceKinds`: payment, a card pick, …).
 * Nothing else may enter this zone. A READ-ONLY host passes `readonly`: a turn gate is no line there (see
 * `readonlyTileVerdict`), and a continuation is a next step nobody takes from it.
 */
export function slotMeta(tile: ConsoleActionTile, readonly = false): SlotMeta {
  if (tile.status !== 'available' && !(readonly && tile.status === 'soft')) {
    const reason = tileReasonText(tile);
    if (reason !== '') {
      return {kind: 'validation', text: reason, tone: tile.blocker?.tone ?? 'danger'};
    }
  }
  // AVAILABLE and changing nothing: what the press would do is the slot's news, before the steps it would ask.
  if (tile.futile !== undefined) {
    return {kind: 'futile', text: translateText(tile.futile.reason), tone: 'warning'};
  }
  if (!readonly && tile.choiceKinds.length > 0) {
    return {kind: 'continuation', text: choiceKindsLabel(tile), tone: 'danger'};
  }
  return {kind: 'none', text: '', tone: 'danger'};
}

/** A Parliament source's uses this generation («1 из 1 в этом поколении») — empty for a card tile. */
export function sourceUsesText(tile: ConsoleActionTile, sources: ReadonlyArray<ParliamentActionSource>): string {
  const source = sources.find((s) => isResolutionActionSource(s) ?
    s.resolution === tile.resolutionAction : (tile.resolutionAction === undefined && s.party === tile.party));
  if (source === undefined) {
    return '';
  }
  return translateTextWithParams('${0} of ${1} this generation', [String(source.usesLeft), String(source.usesPerGeneration)]);
}
