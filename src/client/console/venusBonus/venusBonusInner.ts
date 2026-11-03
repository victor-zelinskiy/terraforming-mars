/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE VENUS BONUS — THE INNER PRE-SELECT (P89 · ledger EM — the owner, 2026-11-02: «сам pre-select надо доработать
 * внутренним шагом, иначе он слишком много забирает места … все бонусы агрегировать внутри одного внутреннего
 * pre-select, сначала OR-выбор касательно финального бонуса (показывается только если он реально здесь забирается) и в
 * зависимости от него ниже отображается раздел «положить на карту» либо просто добавляется ещё один выбор ресурса. Саму
 * зону выбора ресурса сделать фиксированной 2 ряда по 3 ресурса с грамотной навигацией по d-pad»).
 *
 * The composer keeps ONE row for the whole bonus (its answer read back in chips); A on it enters this inner step — a
 * level of the composer (`sub`), never a modal — and its own confirm leaves it. The PURE half: the zones, the 2-D cursor,
 * what every verb does and what the bar says. Every host (the play sheet, the blue action's setup, the colony trade's
 * stage) stands on it, so the three can never walk the bonus differently.
 *
 * Zones, top to bottom — each a ROW of the cursor's grid:
 *  · `wild`  — the 30 % finish's OR (only when the step really reaches 30 % AND a card can hold the wild; with no such
 *              card the wild is simply one more standard resource): «on a card» | «one more standard resource»;
 *  · `card`  — «Put it on a card»: the candidates (only while the wild goes onto a card);
 *  · `lane`  — the six standard resources, a FIXED grid of 2 rows × 3 (`VENUS_GRID_COLS`): ↑↓ change the row, ←→ the
 *              column, LB/RB one unit, RT the rest. The grid never reflows — a lane keeps its place whatever is placed.
 * A is the verb of the zone: choose the option · choose the card · on a lane «+1 here» until the bonus is laid out, then
 * «Подтвердить» (leaves the step). B leaves the step with the draft kept (a pre-select — nothing was sent).
 *
 * ⚠ Since P43 (ledger EO, 2026-11-02) this file is the VENUS ADAPTER of the shared wild-resource choice
 * (`console/wildChoice/wildChoiceInner.ts` — the zones, the cursor, the verbs, the bar for every «a standard resource OR
 * a resource on a card»): it states the bonus as a specification (`venusWildSpec`) and keeps its historical names, so
 * the three hosts and the preselect spec read it unchanged. The Venus specifics stay HERE and in `venusBonusPreselect.ts`:
 * the base laid out always, +1 folding into the grid, the OR only at the 30 % finish with a holder.
 */
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {VenusBonusPromptMeta} from '@/common/models/PlayerInputModel';
import {SpreadState} from '@/client/console/cardResourceDistribution';
import {venusWildTargets} from '@/client/console/compositePrompts';
import {VenusBonusParts, venusSpreadAmount, venusWildAsks} from '@/client/console/venusBonus/venusBonusPreselect';
import {
  WILD_GRID_COLS, WILD_OPTIONS, WildBar, WildChoiceSpec, WildCommand, WildFocus, WildResult, WildVerb, WildZone,
  trimWildSpread, wildAnswered, wildBar, wildBlocked, wildCards, wildClamp, wildComplete, wildFootHints, wildLeft, wildNav,
  wildOpen, wildPress,
} from '@/client/console/wildChoice/wildChoiceInner';

/** The resource grid: 2 rows × 3 columns, in the server's lane order (M€ · steel · titanium / plants · energy · heat). */
export const VENUS_GRID_COLS = WILD_GRID_COLS;

export type VenusInnerZone = WildZone;

/** The cursor of the inner step. `index` — the option (0 on a card · 1 a standard resource), the candidate, the lane. */
export type VenusInnerFocus = WildFocus;

/** The verbs the inner step answers — the composer's own `ConsoleAction` names. */
export type VenusInnerVerb = WildVerb;

/** What a press did: the new draft, the new cursor, and whether the step is left (`confirm` · `back`). */
export type VenusInnerResult = {parts: VenusBonusParts, focus: VenusInnerFocus, exit?: 'confirm' | 'back'};

/** The two options of the 30 % wild, in the server's branch order. */
export const VENUS_WILD_OPTIONS = WILD_OPTIONS;

/** The bar's two «still open» reasons of the bonus — its own words. */
const VENUS_BLOCK_KEYS = {chooseWild: 'Choose where the 30 % bonus goes', chooseCard: 'Choose a card for the wild resource'};

/**
 * THE BONUS AS A WILD-CHOICE SPECIFICATION: the OR only at the 30 % finish with a holder (`venusWildAsks`), the grid
 * ALWAYS there (not exclusive) as a DIAL over `venusSpreadAmount` (the base, +1 when the wild joins it).
 */
export function venusWildSpec(meta: VenusBonusPromptMeta): WildChoiceSpec {
  const asks = venusWildAsks(meta);
  return {
    ...(asks ? {or: {}} : {}),
    holders: asks ? venusWildTargets(meta) : [],
    amount: (wild) => venusSpreadAmount(meta, wild === undefined ? {} : {wild: {wild}}),
    exclusive: false,
    lanes: 'dial',
    // «On a card» is a level of its own (the owner, 2026-11-03): the 30 % finish's holders get the whole column.
    nestedPick: true,
  };
}

/** Is the wild's OR asked HERE (the 30 % finish, a card able to hold it)? */
export function venusInnerWildShown(meta: VenusBonusPromptMeta): boolean {
  return venusWildAsks(meta);
}

/** The candidates of «Put it on a card» — shown only while the wild goes onto a card. */
export function venusInnerCards(meta: VenusBonusPromptMeta, parts: VenusBonusParts): ReadonlyArray<CardName> {
  return wildCards(venusWildSpec(meta), parts);
}

/** Is the wild answered — the option chosen, and on a card the card too? */
export function venusInnerWildAnswered(meta: VenusBonusPromptMeta, parts: VenusBonusParts): boolean {
  return wildAnswered(venusWildSpec(meta), parts);
}

/** The whole bonus answered (the composer's commit may go) — the ONE answer exists. */
export function venusInnerComplete(meta: VenusBonusPromptMeta, parts: VenusBonusParts): boolean {
  return wildComplete(venusWildSpec(meta), parts);
}

/** The units still to lay out on the grid. */
export function venusInnerLeft(meta: VenusBonusPromptMeta, parts: VenusBonusParts): number {
  return wildLeft(venusWildSpec(meta), parts);
}

/** WHERE THE STEP OPENS: the first question still open — the wild's option, its card, then the grid. */
export function venusInnerOpen(meta: VenusBonusPromptMeta, parts: VenusBonusParts): VenusInnerFocus {
  return wildOpen(venusWildSpec(meta), parts);
}

/** A cursor that still points at something (a zone that went away — the cards after «a standard resource» — falls to the grid). */
export function venusInnerClamp(meta: VenusBonusPromptMeta, parts: VenusBonusParts, focus: VenusInnerFocus): VenusInnerFocus {
  return wildClamp(venusWildSpec(meta), parts, focus);
}

/** THE D-PAD — a 2-D walk over the grid's rows: ↑↓ change the row keeping the column, ←→ move within the row (no wrap). */
export function venusInnerNav(meta: VenusBonusPromptMeta, parts: VenusBonusParts, focus: VenusInnerFocus, dir: 'up' | 'down' | 'left' | 'right'): VenusInnerFocus {
  return wildNav(venusWildSpec(meta), parts, focus, dir);
}

/** The spread cut down to a smaller sum (the wild moved from «a standard resource» onto a card) — the LAST lanes give way. */
export function trimVenusSpread(spread: SpreadState, amount: number): SpreadState {
  return trimWildSpread(spread, amount);
}

/**
 * WHAT A PRESS DOES — pure; the host writes `parts` back and leaves the step on `exit`. In the nested card pick
 * (`pick`) the host hands in the selector's focused, choosable card (`ConsoleVenusBonusStep.pickFocused`).
 */
export function venusInnerPress(
  meta: VenusBonusPromptMeta, parts: VenusBonusParts, focus: VenusInnerFocus, verb: VenusInnerVerb, picked?: CardName,
): VenusInnerResult {
  const result: WildResult = wildPress(venusWildSpec(meta), parts, focus, verb, picked);
  return result;
}

/** The crumb's tail of the inner step — one level deeper while the card pick stands («… › БОНУС ВЕНЕРЫ · КАРТА»). */
export function venusInnerStageKey(focus: VenusInnerFocus): string {
  return focus.zone === 'pick' ? 'Venus bonus · card' : 'Venus bonus';
}

/** The bar of the inner step — ONE reading for every host (labels are i18n keys). */
export type VenusInnerBar = WildBar;

export function venusInnerBlocked(meta: VenusBonusPromptMeta, parts: VenusBonusParts): VenusInnerBar['blocked'] {
  return wildBlocked(venusWildSpec(meta), parts, VENUS_BLOCK_KEYS);
}

export function venusInnerBar(meta: VenusBonusPromptMeta, parts: VenusBonusParts, focus: VenusInnerFocus): VenusInnerBar {
  return wildBar(venusWildSpec(meta), parts, focus, VENUS_BLOCK_KEYS);
}

/** The candidates' live models, in the server's order — the card zone's faces and their «current → resulting». */
export function venusWildCardModels(cards: ReadonlyArray<CardName>, candidates: ReadonlyArray<CardModel> | undefined): Array<CardModel | undefined> {
  return cards.map((name) => candidates?.find((c) => c.name === name));
}

/** One command of the inner step's bar — the shape both composers' bars take (`FootHint` / `ConsoleCommand`). */
export type VenusInnerCommand = WildCommand;

/** THE INNER STEP'S BAR — ONE list for every host (`wildFootHints`). */
export function venusInnerFootHints(bar: VenusInnerBar): Array<VenusInnerCommand> {
  return wildFootHints(bar);
}
