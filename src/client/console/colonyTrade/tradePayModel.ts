/*
 * THE PAYMENT PATHS OF A TRADE — the PURE row model behind «СПОСОБ ОПЛАТЫ».
 *
 * A trade is paid the same way whatever it is made with: the trade action's
 * inner «Pay trade fee» OrOptions is one list for a colony tile and for a
 * fleet-dock card alike (`server/colonies/ITradeDestination.ts`). So the two
 * stages that compose a trade — the colony focus stage and the fleet-dock
 * stage — read ONE model and draw ONE row (`ConsoleTradePayRows.vue`); a second
 * copy of either is how the two would drift.
 *
 * `translate` is injected (no i18n import here), so the module runs under the
 * server test runner.
 */

import {Message} from '@/common/logs/Message';
import {DisabledOptionModel, SelectOptionModel} from '@/common/models/PlayerInputModel';

/** One USABLE payment path as the row draws it. */
export type TradePayEntry = {
  title: string,
  iconClass: string,
  /** The server's own `current → resulting` of the path's resource ('' when it carries none). */
  preview: string,
  /** The Delta Works mix PINNED at the commit boundary — the held row keeps
   *  showing the composition the move was actually paid with. */
  mix?: {energy: number, steel: number},
};

/** One REFUSED path: its name (with what the player holds), and the server's reason. */
export type TradePayDisabledEntry = {title: string, iconClass: string, reason: string};

/** A usable path with the SERVER's option index — a filtered list never renumbers. */
export type TradePayRow = TradePayEntry & {index: number};

export type TradePayText = (value: string | Message | undefined) => string;
export type TradePayIcon = (icon: string) => string;

/** The usable paths, in the server's option order. */
export function tradePayEntries(options: ReadonlyArray<SelectOptionModel>, text: TradePayText, iconClass: TradePayIcon): Array<TradePayEntry> {
  return options.map((option) => {
    const meta = option.metadata;
    const resource = meta?.resource;
    return {
      title: text(option.title),
      iconClass: meta?.icon !== undefined ? iconClass(meta.icon) : '',
      preview: resource !== undefined ? `${resource.current} → ${resource.resulting}` : '',
    };
  });
}

/** The refused paths, each with the server's reason. */
export function tradePayDisabledEntries(disabled: ReadonlyArray<DisabledOptionModel>, text: TradePayText, iconClass: TradePayIcon): Array<TradePayDisabledEntry> {
  return disabled.map((option) => {
    const record = option as {title?: string | Message, label?: string | Message, reason?: string | Message, metadata?: {icon?: string, resource?: {current: number}}};
    const current = record.metadata?.resource?.current;
    const title = text(record.title ?? record.label);
    return {
      title: current !== undefined ? `${title} · ${current}` : title,
      iconClass: record.metadata?.icon !== undefined ? iconClass(record.metadata.icon) : '',
      reason: text(record.reason),
    };
  });
}

/**
 * THE PATHS THE PLAYER CAN ACTUALLY TAKE. With the fee fixed by the entry (a
 * card's own action, the Unity party action) there is exactly one, and the
 * rest are unreachable — filtered out, never dimmed: a menu whose every other
 * item refuses the press is furniture. Past the commit there is no list at all
 * (the chosen path alone stands as the receipt). The original index rides
 * along: the cursor, the selection and the submit all speak the server's order.
 */
export function visibleTradePayRows(entries: ReadonlyArray<TradePayEntry>, lockedIndex: number, pinned: boolean): Array<TradePayRow> {
  if (pinned) {
    return [];
  }
  const rows = entries.map((entry, index) => ({...entry, index}));
  return lockedIndex >= 0 ? rows.filter((row) => row.index === lockedIndex) : rows;
}

/** …and a refused path is equally irrelevant once the fee is fixed or the move is made. */
export function visibleTradePayDisabled(disabled: ReadonlyArray<TradePayDisabledEntry>, lockedIndex: number, pinned: boolean): ReadonlyArray<TradePayDisabledEntry> {
  return lockedIndex >= 0 || pinned ? [] : disabled;
}

