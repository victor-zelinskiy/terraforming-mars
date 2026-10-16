import {Color} from '@/common/Color';
import {JournalImpactChip} from '@/client/components/journal/journalEventChild';
import {NotificationContentMode} from './notificationContentMode';
import {NotificationModel, NotificationPillGroup, NotificationSkippedLine, NotificationSummaryLine} from './notificationTypes';

/**
 * THE NOTIFICATION CONTENT POLICY (TR59 «ОДИН ВЗГЛЯД») — what a presented toast CARRIES, decided once, as the card
 * leaves the queue (`notificationState` — never on a visible card: ITERATION 3, what is on screen does not change in
 * place).
 *
 * A toast lives a few seconds and is read at a glance. It answers THREE questions — what changed for YOU, WHY (your
 * card / tile / colony, or the attacker's card), WHOSE turn — and everything else is the journal's (hold X). The
 * owner's report (2026-10-16): an actor's own bookkeeping, a «Марс» cluster restating the HUD, a bot's three lines of
 * track arithmetic under the viewer's +1 M€ took half the card and buried the answer.
 *
 * PURE and STRUCTURAL: every decision reads typed fields (the band, pill-group scopes and owners, skipped owners, the
 * bot lines' producer-stamped kind / target / fate) — never a rendered string.
 *
 * ⛔ NEVER FILTERED, by any mode (the contract — `notificationContentPolicy.spec` pins every row):
 *   · the viewer's band — gains AND losses — and its causes («почему»);
 *   · the actor chip (the head's one identity statement);
 *   · a skipped effect of the VIEWER's («Пропущено» — no silent loss);
 *   · an attack on the viewer (an attack line aimed at them, «защищён / нечего терять» included);
 *   · warnings, the turn prompts and the terraforming-complete announcement (their kinds pass untouched);
 *   · the reveal line, a passive effect's source / law line, a burst's «События: N» (the event IS the card).
 *
 * WHAT EACH MODE CUTS:
 *   · both — the `planet` cluster (the HUD shows every global parameter), the TR49 requirement-eased line and the
 *     actor's own skipped effect (both about the actor's play — the journal row says it), a bot's bookkeeping lines
 *     under a viewer band (the band + the cause carry the story; the turn review is X);
 *   · `brief` — the actor keeps ONE quiet line of ≤ 2 chips; a third player keeps one line of ≤ 2 chips and one
 *     skipped line; a bot card with no band keeps ≤ 2 outcome lines (+ the honest «ещё N»);
 *   · `mine` — no actor line, no third player, no outcome line that is not an attack on the viewer.
 */

/** How many chips the actor's quiet line keeps («● Rival · [M€ −25] [prod +1]»). */
export const ACTOR_CHIPS_BRIEF = 2;
/** How many outcome lines a bot card with no viewer band keeps in `brief`. */
export const BOT_LINES_BRIEF = 2;

function hasBand(model: NotificationModel): boolean {
  return model.viewerImpact !== undefined && model.viewerImpact.sign !== 'neutral';
}

/** The kinds whose whole content IS the message — warnings, the turn prompts — pass untouched. */
function untouchable(model: NotificationModel): boolean {
  return model.kind === 'warning' || model.kind === 'your-turn' || model.kind === 'action-required';
}

function clusters(model: NotificationModel, mode: NotificationContentMode): ReadonlyArray<NotificationPillGroup> | undefined {
  const groups = model.pillGroups;
  if (groups === undefined) {
    return undefined;
  }
  const out: Array<NotificationPillGroup> = [];
  let othersKept = 0;
  for (const group of groups) {
    if (group.scope === 'planet' || mode === 'mine') {
      continue;
    }
    if (group.scope === 'others') {
      if (othersKept >= 1) {
        continue;
      }
      othersKept++;
    }
    out.push({...group, chips: group.chips.slice(0, ACTOR_CHIPS_BRIEF)});
  }
  return out.length > 0 ? out : undefined;
}

/**
 * The flat pills: with groups they are what the kept groups hold (the card's fallback must never resurrect a cut
 * cluster); without (a burst summary) they ARE the actor's line, under the same budget.
 */
function flatPills(model: NotificationModel, mode: NotificationContentMode, kept: ReadonlyArray<NotificationPillGroup> | undefined): ReadonlyArray<JournalImpactChip> {
  if (model.pillGroups !== undefined && model.pillGroups.length > 0) {
    return (kept ?? []).flatMap((g) => g.chips);
  }
  return mode === 'mine' ? [] : model.pills.slice(0, ACTOR_CHIPS_BRIEF);
}

/** Whose skipped effect: the viewer's (never cut), the actor's (the journal's), a third player's. */
function skippedKept(model: NotificationModel, mode: NotificationContentMode, viewer: Color | undefined): ReadonlyArray<NotificationSkippedLine> | undefined {
  const lines = model.skipped;
  if (lines === undefined) {
    return undefined;
  }
  const out: Array<NotificationSkippedLine> = [];
  let thirdKept = 0;
  for (const line of lines) {
    // A line with no owner is the ACTOR's own effect (`skippedLinesOf` names the owner only when it is not).
    const viewers = line.owner !== undefined ? line.owner === viewer : model.actor === viewer && viewer !== undefined;
    if (viewers) {
      out.push(line);
      continue;
    }
    if (mode === 'brief' && line.owner !== undefined && thirdKept < 1) {
      thirdKept++;
      out.push(line);
    }
  }
  return out.length > 0 ? out : undefined;
}

/** The bot card's outcome lines, by the producer's own typing. */
function summaryKept(model: NotificationModel, mode: NotificationContentMode, viewer: Color | undefined):
  {lines?: ReadonlyArray<NotificationSummaryLine>; overflow?: number} {
  const lines = model.summaryLines;
  if (lines === undefined) {
    return {};
  }
  const atViewer = (line: NotificationSummaryLine) => line.kind === 'attack' && viewer !== undefined && line.target === viewer;
  let kept: Array<NotificationSummaryLine>;
  if (hasBand(model) || mode === 'mine') {
    // Under a band an attack on the viewer is already the band's (the producer drops it); without one, `mine`
    // keeps exactly the attack lines aimed at the viewer — a zero-outcome attack is still an attack.
    kept = lines.filter(atViewer);
  } else {
    // `brief`: the viewer's attack lines first, then the rest, up to the budget.
    kept = [...lines.filter(atViewer), ...lines.filter((l) => !atViewer(l))].slice(0, Math.max(BOT_LINES_BRIEF, lines.filter(atViewer).length));
  }
  const cut = lines.length - kept.length;
  const overflow = (model.summaryOverflow ?? 0) + (hasBand(model) || mode === 'mine' ? 0 : cut);
  return {
    ...(kept.length > 0 ? {lines: kept} : {}),
    ...(kept.length > 0 && overflow > 0 ? {overflow} : {}),
  };
}

/**
 * The model a toast PRESENTS under `mode` for `viewer`. Never mutates its input; returns the input itself for a kind
 * the policy does not touch. Fields the policy owns are restated (absent, never `undefined`-valued — deep-equality).
 */
export function presentedContent(model: NotificationModel, mode: NotificationContentMode, viewer: Color | undefined): NotificationModel {
  if (untouchable(model)) {
    return model;
  }
  const pillGroups = clusters(model, mode);
  const skipped = skippedKept(model, mode, viewer);
  const summary = summaryKept(model, mode, viewer);
  const out: NotificationModel = {...model, pills: flatPills(model, mode, pillGroups)};
  delete out.pillGroups;
  delete out.skipped;
  delete out.eased;
  delete out.summaryLines;
  delete out.summaryOverflow;
  return {
    ...out,
    ...(pillGroups !== undefined ? {pillGroups} : {}),
    ...(skipped !== undefined ? {skipped} : {}),
    ...(summary.lines !== undefined ? {summaryLines: summary.lines} : {}),
    ...(summary.overflow !== undefined ? {summaryOverflow: summary.overflow} : {}),
  };
}
