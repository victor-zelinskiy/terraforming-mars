/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SUMMARY PAST THE CEILING («СРАБАТЫВАНИЕ КАРТЫ — ОДИН ФРЕЙМВОРК», PL-1056):
 * a group the chain could not rise under its wall-clock ceiling ticks at once
 * and is NAMED — on the state (`data-reaction-summarized`) and, since this
 * iteration, as ONE feed card: «Эффекты карт», the viewer's deltas leading
 * (the card's own impact grammar), one line per reactor with its card token,
 * «В журнал» as the way to the whole story. Never a card per reactor (that is
 * the burst the ceiling exists to prevent), never a silent tick (invariant 4).
 * Pure: a builder of the notification model, spec'd under the server runner.
 */
import {Color} from '@/common/Color';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageType} from '@/common/logs/LogMessageType';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {JournalImpactChip} from '@/client/components/journal/journalEventChild';
import {ImpactSign, ViewerImpactCause} from '@/client/components/notifications/notificationSemantics';
import {NOTIFICATION_PRIORITY, NOTIFICATION_TTL, NotificationModel} from '@/client/components/notifications/notificationTypes';
import {CardReactionGroup} from '@/client/console/cardReaction/cardReactionModel';

/** The card's type label — an i18n key («Эффекты карт»). */
export const REACTION_SUMMARY_LABEL_KEY = 'Card effects';
/** One line per reactor — an i18n key with the card token («Сработала: …»). */
export const REACTION_SUMMARY_LINE_KEY = '${0} triggered';

const MINUS = '−';

function signed(amount: number): string {
  return amount < 0 ? `${MINUS}${Math.abs(amount)}` : `+${amount}`;
}

/**
 * The viewer's own deltas of the summarized groups, merged per row (the journal's chip grammar: a production step on
 * its frame, the rating as `tr`, a draw as `cards`; a global step is the planet's and is not the viewer's delta).
 */
export function reactionSummaryChips(groups: ReadonlyArray<CardReactionGroup>): Array<JournalImpactChip> {
  const sums = new Map<string, {icon: string, production: boolean, amount: number}>();
  const add = (key: string, icon: string, production: boolean, amount: number): void => {
    const row = sums.get(key);
    if (row === undefined) {
      sums.set(key, {icon, production, amount});
    } else {
      row.amount += amount;
    }
  };
  for (const group of groups) {
    for (const spec of [...group.rail, ...group.cards]) {
      const amount = spec.direction === 'loss' ? -spec.amount : spec.amount;
      const icon = spec.resource === 'rating' ? 'tr' : spec.resource;
      add(`${spec.channel}:${icon}`, icon, spec.channel === 'production', amount);
    }
    for (const impact of group.elsewhere) {
      if (impact.kind === 'draw') {
        add('draw', 'cards', false, impact.amount);
      }
    }
  }
  return [...sums.values()].filter((row) => row.amount !== 0).map((row) => ({
    icon: row.icon, text: signed(row.amount), ...(row.production ? {production: true} : {}),
  }));
}

/** The one feed card for the groups past the ceiling — `undefined` when there is nothing to tell. */
export function buildCardReactionSummaryNotification(
  groups: ReadonlyArray<CardReactionGroup>,
  viewer: Color | undefined,
  createdAt: number,
  generation = 0,
): NotificationModel | undefined {
  if (groups.length === 0) {
    return undefined;
  }
  const chips = reactionSummaryChips(groups);
  const gains = chips.filter((c) => !c.text.startsWith(MINUS));
  const losses = chips.filter((c) => c.text.startsWith(MINUS));
  // One CAUSE per reactor — the card's own grammar («почему»): the viewer's own card, the channel that woke it, its share.
  const causes: Array<ViewerImpactCause> = groups.map((g) => {
    const own = reactionSummaryChips([g]);
    return {
      origin: g.record.kind === 'corporation' ?
        {kind: 'corporation' as const, card: g.card, owner: g.record.owner} :
        {kind: 'card' as const, card: g.card, owner: g.record.owner},
      own: true, trigger: g.record.channel,
      gains: own.filter((c) => !c.text.startsWith(MINUS)), losses: own.filter((c) => c.text.startsWith(MINUS)),
    };
  });
  const sign: ImpactSign = gains.length > 0 && losses.length > 0 ? 'mixed' : losses.length > 0 ? 'negative' : gains.length > 0 ? 'positive' : 'neutral';
  return {
    id: `reaction-summary:${groups.map((g) => g.record.seq).join('.')}`,
    kind: 'normal',
    variant: 'passive-effect',
    priority: NOTIFICATION_PRIORITY['normal'],
    sign,
    importance: 'notable',
    typeLabelKey: REACTION_SUMMARY_LABEL_KEY,
    ...(viewer === undefined ? {} : {actor: viewer}),
    ...(chips.length > 0 ? {viewerImpact: {sign, gains, losses, causes, sourceCard: groups[0].card, ownSource: true}} : {}),
    summaryLines: groups.map((g) => ({
      message: new LogMessage(LogMessageType.DEFAULT, REACTION_SUMMARY_LINE_KEY, [{type: LogMessageDataType.CARD, value: g.card}]),
      kind: 'log' as const,
    })),
    pills: [],
    detailCount: 0,
    generation,
    ttl: NOTIFICATION_TTL['normal'],
    persistent: false,
    cta: {labelKey: 'To journal', action: 'open-journal'},
    createdAt,
  };
}
