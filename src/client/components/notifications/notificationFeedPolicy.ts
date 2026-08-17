import {Color} from '@/common/Color';
import {GameEvent} from '@/common/events/GameEvent';
import {EventImpact} from '@/common/events/EventImpact';
import {MarsBotTurn} from '@/common/automa/MarsBotTurn';
import {NotificationFeedMode} from './notificationFeedMode';
import {NotificationKind, NotificationModel, NotificationVariant} from './notificationTypes';

/**
 * THE quick-notification feed FILTER POLICY — the single source of «does this
 * toast present under the current feed mode?». Applied in exactly one place
 * (`notificationState.pushTransient`); no component carries its own `if`.
 *
 * PURE (no Vue / DOM / i18n / clock) and STRUCTURAL: every decision reads the
 * model's typed fields (`kind` / `variant` / `actor` / `affects`) — NEVER the
 * rendered text, a player name or a localised string, so the answer is
 * identical in every locale (i18n mutates `Message.message` in place, which is
 * exactly why text can never be an input here).
 *
 * Relevance vocabulary:
 *  - `exempt`   — the setting never touches this family. Hostile losses the
 *    viewer suffered, warnings/errors, the turn prompts and game-completion
 *    announcements always present (the setting filters NOISE, not signal the
 *    player cannot afford to miss).
 *  - `involves` — presents in 'personal' mode only when the viewer is DIRECTLY
 *    involved: they are the acting player, or they appear in the model's
 *    structured `affects` list (built by the producers from the typed event
 *    chain / bot-turn script — see the helpers below).
 *
 * This is PRESENTATION metadata only: a filtered toast changes nothing about
 * the authoritative event, its journal record, its visual commit or its FIFO
 * position — the model simply never enters the toast feed (and therefore never
 * starts an auto-close lifetime and never holds a mandatory surface).
 */

export type FeedRelevance = 'exempt' | 'involves';

/**
 * Exhaustive per-variant classification. `Record` keeps it total at compile
 * time — a NEW variant does not build until it declares its relevance here
 * (and the spec enumerates this table, so the classification is test-guarded).
 */
export const VARIANT_RELEVANCE: Readonly<Record<NotificationVariant, FeedRelevance>> = {
  // ── Exempt: the viewer's own losses (they are the victim by construction),
  //    problems, turn prompts, and the game-completion announcement. ─────────
  'destroy': 'exempt',
  'steal': 'exempt',
  'production-reduction': 'exempt',
  'production-transfer': 'exempt',
  'vp-loss': 'exempt', // Vermin in effect — every player's VP calculation drops
  'warning': 'exempt',
  'your-turn': 'exempt',
  'action-required': 'exempt',
  'terraforming-complete': 'exempt', // the game-end condition — never noise
  // ── Involves: another participant's activity — presents only when the
  //    structured data says the viewer is directly in it. ────────────────────
  'bot-turn': 'involves',
  'play-card': 'involves',
  'blue-action': 'involves',
  'passive-effect': 'involves',
  'standard-project': 'involves',
  'colony': 'involves',
  'hydronetwork': 'involves',
  'planetary-event': 'involves',
  'milestone': 'involves',
  'award': 'involves',
  'threat': 'involves', // a future threat (Vermin played) — the DAMAGE later is exempt
  'reveal-deck': 'involves',
  'reveal-hand': 'involves',
  'generation': 'involves',
  'pass': 'involves',
  'event': 'involves',
};

/**
 * Kind-level exemptions — behavioural families the setting never filters,
 * whatever their variant: the singleton turn prompts (mandatory signals),
 * warnings (errors / system problems) and hostile losses (`negative` models
 * are BUILT for the victim-viewer, so they are personal by construction).
 */
const EXEMPT_KINDS: ReadonlySet<NotificationKind> = new Set<NotificationKind>([
  'action-required', 'your-turn', 'warning', 'negative',
]);

/** Variants already diagnosed as unclassified this session (warn once each). */
const warnedVariants = new Set<string>();

/**
 * Does this toast PRESENT under `mode` for `viewer`?
 *
 * Fail-open by design: an unknown viewer, an unclassified variant (impossible
 * while the Record above compiles, but a runtime model is still checked) or an
 * absent `affects` list on an `involves` variant with a viewer actor all lean
 * toward SHOWING — losing a real event silently is strictly worse than one
 * extra toast. In development the unclassified case names itself once, so a
 * future variant that skips the table is found, not shipped.
 */
export function quickToastAllowed(
  model: NotificationModel,
  mode: NotificationFeedMode,
  viewer: Color | undefined,
): boolean {
  if (mode === 'all') {
    return true;
  }
  if (EXEMPT_KINDS.has(model.kind)) {
    return true;
  }
  const relevance = VARIANT_RELEVANCE[model.variant] as FeedRelevance | undefined;
  if (relevance === undefined) {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production' && !warnedVariants.has(model.variant)) {
      warnedVariants.add(model.variant);
      console.warn(
        `[notifications] variant '${model.variant}' has no feed-relevance classification — ` +
        'presenting fail-open. Add it to VARIANT_RELEVANCE (notificationFeedPolicy.ts).');
    }
    return true;
  }
  if (relevance === 'exempt') {
    return true;
  }
  if (viewer === undefined) {
    return true; // no identity to compare against — fail-open
  }
  return model.actor === viewer || model.affects?.includes(viewer) === true;
}

// ── Structured relevance derivation (the producers' helpers) ────────────────
// The `affects` list is PRESENTATION metadata computed from data the events
// already carry — never from text, and never a per-player copy of the event.

/**
 * Does this impact represent a PERSONAL delta for the event's owner — their
 * stock / production / card resources / TR / cards / VP moved? Board-level
 * facts (global parameters, tiles) are deliberately NOT personal: strategic
 * importance is not direct involvement (the journal keeps the full story).
 */
export function impactTouchesOwner(impact: EventImpact): boolean {
  const stockMoved = impact.stock !== undefined && Object.values(impact.stock).some((v) => v !== undefined && v !== 0);
  const productionMoved = impact.production !== undefined && Object.values(impact.production).some((v) => v !== undefined && v !== 0);
  const cardResourcesMoved = impact.cardResources !== undefined && impact.cardResources.some((cr) => cr.amount !== 0);
  return stockMoved || productionMoved || cardResourcesMoved ||
    (impact.tr !== undefined && impact.tr !== 0) ||
    (impact.cardsDrawn !== undefined && impact.cardsDrawn !== 0) ||
    (impact.cardsDiscarded !== undefined && impact.cardsDiscarded !== 0) ||
    (impact.vp !== undefined && impact.vp !== 0) ||
    (impact.megacreditsPaid !== undefined && impact.megacreditsPaid !== 0);
}

/**
 * The players a journal root event's chain DIRECTLY touches: every event owner
 * whose personal state moved, plus explicit cross-player targets (the attacker
 * a steal moved resources to). First-occurrence order, no duplicates.
 */
export function affectedPlayersOfChain(chain: ReadonlyArray<GameEvent>): Array<Color> {
  const out: Array<Color> = [];
  const add = (color: Color | undefined): void => {
    if (color !== undefined && !out.includes(color)) {
      out.push(color);
    }
  };
  for (const e of chain) {
    if (e.player !== undefined && impactTouchesOwner(e.impact)) {
      add(e.player);
    }
    add(e.target?.player);
  }
  return out;
}

/**
 * The players a MarsBot turn DIRECTLY touches, from the turn's own typed
 * script: attack targets (an attack is direct even when nothing was lost —
 * being targeted is involvement) and non-bot impact targets (the snapshot-
 * diffed before → after entries).
 */
export function affectedPlayersOfBotTurn(turn: MarsBotTurn): Array<Color> {
  const out: Array<Color> = [];
  const add = (color: Color | undefined): void => {
    if (color !== undefined && !out.includes(color)) {
      out.push(color);
    }
  };
  for (const step of turn.steps) {
    if (step.kind === 'attack') {
      add(step.attack.target);
    } else if (step.kind === 'impact' && !step.impact.targetIsBot) {
      add(step.impact.target);
    }
  }
  return out;
}

/** Test seam: forget the once-per-variant diagnostics. */
export function resetFeedPolicyDiagnosticsForTesting(): void {
  warnedVariants.clear();
}
