/*
 * THE TRADE'S SECOND DOOR — a colony trade entered from a CARD ACTION.
 *
 * «Хочу торговать» and «хочу использовать Летающую платформу» are two ways of
 * starting the SAME move, and after the door they must be one flow: one server
 * command, one payment model, one colony workspace, one resolution. What is
 * allowed to differ is only the entry CONTEXT — which is what this module is.
 *
 * It exists because the alternative (submitting the card action first, then
 * answering a colony picker) cannot satisfy the flow at all: `playActionCard`
 * marks the card used SYNCHRONOUSLY at the branch pick, so by the time the
 * colony question arrives the floater is committed, the action is spent and B
 * has nothing to go back to. So the card entry submits NOTHING: it walks the
 * player to the trade the server is already offering, with this card's own
 * payment path locked, and the one confirm at the end is the ordinary trade.
 *
 * Everything here is pure or plain reactive state — no DOM, no Vue components —
 * so it runs under the server test runner.
 */

import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {DisabledOptionModel, SelectOptionModel} from '@/common/models/PlayerInputModel';
import {Message} from '@/common/logs/Message';

export type ColonyTradeEntryState = {
  /**
   * The card whose action opened this trade. `''` = the player came through
   * «Колонии», where every payment path is theirs to choose.
   */
  card: CardName | '';
};

export const colonyTradeEntryState: ColonyTradeEntryState = reactive({card: ''});

/** The player pressed «Выбрать колонию» on a card's trade branch. */
export function beginCardColonyTrade(card: CardName): void {
  colonyTradeEntryState.card = card;
}

/** The entry is over — B walked out, or the trade committed and concluded. */
export function clearCardColonyTrade(): void {
  colonyTradeEntryState.card = '';
}

/** The card this trade was entered from, `''` for the ordinary Colonies entry. */
export function cardColonyTradeCard(): CardName | '' {
  return colonyTradeEntryState.card;
}

/**
 * The payment path the entry LOCKS to, or `-1`.
 *
 * Matched on the option's own `metadata.card` — never on its label. The label
 * is translated in place on render, so a text match stops matching after the
 * first paint; and it would not say WHICH card powers the path anyway.
 */
export function lockedTradePaymentIndex(
  options: ReadonlyArray<SelectOptionModel>,
  card: CardName | '',
): number {
  if (card === '') {
    return -1;
  }
  return options.findIndex((o) => o.metadata?.card === card);
}

/**
 * Why the locked path is not on offer — the SERVER's own reason for that
 * disabled option («на этой карте нет аэростатов», «действие карты уже
 * использовано»). `undefined` when the path is live, or when the server did
 * not offer it at all (nothing honest to say).
 */
export function lockedTradePaymentReason(
  disabled: ReadonlyArray<DisabledOptionModel>,
  card: CardName | '',
): string | Message | undefined {
  if (card === '') {
    return undefined;
  }
  return disabled.find((d) => d.metadata?.card === card)?.reason;
}

/**
 * THE CRUMB TAIL of a colony step hosted by another workspace.
 *
 * Inside «ДЕЙСТВИЯ КАРТ › ЛЕТАЮЩАЯ ПЛАТФОРМА › …» the subject slot is already
 * spent on the card, so the colony folds INTO the stage: «ГАНИМЕД · ТОРГОВЛЯ»,
 * «ПЛУТОН · ДОБОР КАРТ». Before a colony is chosen there is only the stage.
 * Returns the parts in order; the caller translates and joins them, because
 * a colony name and a stage key are both i18n keys and neither is prose.
 */
export function colonyStepCrumbParts(colony: string, stage: string): ReadonlyArray<string> {
  return [colony, stage].filter((part) => part !== '');
}
