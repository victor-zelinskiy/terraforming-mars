import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {GameEvent} from '@/common/events/GameEvent';
import {EventImpact} from '@/common/events/EventImpact';
import {MarsBotTurn} from '@/common/automa/MarsBotTurn';
import {impactChips, JournalImpactChip} from '@/client/components/journal/journalEventChild';

/**
 * VIEWER-CENTRIC notification semantics — the pure layer that answers, from the
 * TYPED event stream only (never from a localised string):
 *
 *   1. what changed FOR THE VIEWER of this notification (their own deltas,
 *      split into gains and losses),
 *   2. whether that is positive / negative / neutral / MIXED for them,
 *   3. how important the event is (an independent axis — a positive event is
 *      not automatically important, a negative one not automatically critical),
 *   4. who caused it (the cross-player attacker, when there is one).
 *
 * The sign is always relative to the RECIPIENT of the notification, never to
 * the actor or to the action "in general". The two axes ride every
 * `NotificationModel` (`sign` + `importance`) so presentation reads them as
 * data; nothing downstream re-derives meaning from text.
 *
 * PURE: no Vue / DOM / i18n / clock — unit-testable next to the other mappers.
 */

/** The viewer-relative SIGN of an event — one of the two semantic axes. */
export type ImpactSign = 'positive' | 'negative' | 'neutral' | 'mixed';

/**
 * The INFORMATIONAL importance of a notification — the second axis, independent
 * of the sign:
 *  - `ambient`   — background table activity (an opponent's ordinary move);
 *  - `notable`   — worth a glance (a viewer gain, a milestone, a reveal-hand);
 *  - `critical`  — must not be missed (a viewer loss, VP pressure, the
 *                  terraforming completion);
 *  - `attention` — the game is waiting on the player (turn prompts, problems).
 */
export type NotificationImportance = 'ambient' | 'notable' | 'critical' | 'attention';

/** Where a viewer loss came from — the stock, future production, or VP score. */
export type ViewerImpactScope = 'stock' | 'production' | 'vp';

/**
 * Everything the card needs to lead with "what changed FOR YOU": the viewer's
 * own merged deltas, the sign, and — for a cross-player loss — who took it and
 * with what. Built once by the producers; the presentation only renders it.
 */
export type ViewerImpactMeta = {
  sign: ImpactSign;
  /** The viewer's own positive deltas (merged net, non-zero). */
  gains: ReadonlyArray<JournalImpactChip>;
  /** The viewer's own negative deltas (merged net, non-zero, never `saved`). */
  losses: ReadonlyArray<JournalImpactChip>;
  /** The player who caused a loss (cross-player attack), when there is one. */
  attacker?: Color;
  /**
   * The card / corp behind the viewer's change: the attacker's card for a
   * LOSS, and — for a pure GAIN inside somebody else's action — the card of
   * the viewer's OWN that paid them (Social Heating on another player's
   * Hydronetwork move). Without it the cause line falls back to the ROOT card
   * of the chain, which for a passive payout is the thing that MOVED, not the
   * thing that paid: «+3 тепла · Гидросеть» instead of «… · Социальное
   * отопление», and the player cannot tell WHICH of their cards is
   * earning them anything.
   */
  sourceCard?: CardName;
  /**
   * True when `sourceCard` belongs to the VIEWER (a passive payout of their
   * own card inside somebody else's action), false/absent when it is the
   * actor's (an attack). The cause line reads differently either way —
   * «Причина: Красный · Социальное отопление» otherwise says the
   * opponent holds the card.
   */
  ownSource?: boolean;
  /** True when a lost resource MOVED to the attacker (steal / prod transfer). */
  transfer?: boolean;
  /** Dominant scope of the losses — drives the «из запаса»/«доход» marker. */
  scope?: ViewerImpactScope;
};

const NEUTRAL_IMPACT: ViewerImpactMeta = {sign: 'neutral', gains: [], losses: []};

function chipAmount(text: string): number {
  const n = Number.parseInt(text.replace(/−/g, '-'), 10);
  return Number.isNaN(n) ? 0 : n;
}

/** Merge chips sharing icon + production flag, summing amounts; drop zero nets. */
function mergeNet(chips: ReadonlyArray<JournalImpactChip>): Array<JournalImpactChip> {
  const order: Array<string> = [];
  const byKey = new Map<string, {chip: JournalImpactChip; sum: number}>();
  for (const c of chips) {
    const key = `${c.icon}|${c.production === true ? 1 : 0}`;
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, {chip: c, sum: chipAmount(c.text)});
      order.push(key);
    } else {
      existing.sum += chipAmount(c.text);
    }
  }
  const out: Array<JournalImpactChip> = [];
  for (const key of order) {
    const m = byKey.get(key);
    if (m === undefined || m.sum === 0) {
      continue;
    }
    const text = m.sum > 0 ? `+${m.sum}` : `−${Math.abs(m.sum)}`;
    out.push({icon: m.chip.icon, text, ...(m.chip.production === true ? {production: true} : {})});
  }
  return out;
}

/**
 * Chips of the deltas `impactChips` deliberately leaves out of the journal rows
 * but that ARE a personal change worth leading with: a forced discard and a
 * direct VP move. (`vp` has no sprite — the card renders its unit as text.)
 */
function extraViewerChips(impact: EventImpact): Array<JournalImpactChip> {
  const chips: Array<JournalImpactChip> = [];
  if (impact.cardsDiscarded !== undefined && impact.cardsDiscarded !== 0) {
    chips.push({icon: 'cards', text: `−${Math.abs(impact.cardsDiscarded)}`});
  }
  if (impact.vp !== undefined && impact.vp !== 0) {
    chips.push({icon: 'vp', text: impact.vp > 0 ? `+${impact.vp}` : `−${Math.abs(impact.vp)}`});
  }
  return chips;
}

/** The cross-player beneficiary/causer behind a viewer event, if any. */
function attackerOf(e: GameEvent, viewer: Color): Color | undefined {
  if (e.target?.player !== undefined && e.target.player !== viewer) {
    return e.target.player;
  }
  const s = e.source;
  if (s !== undefined && (s.kind === 'card' || s.kind === 'corporation') && s.owner !== undefined && s.owner !== viewer) {
    return s.owner;
  }
  return undefined;
}

/** The event's source card WHEN IT BELONGS TO `viewer` — what makes a gain
 *  inside a foreign action attributable to the viewer's own tableau. */
function ownCardSource(e: GameEvent, viewer: Color): CardName | undefined {
  const s = e.source;
  if (s !== undefined && (s.kind === 'card' || s.kind === 'corporation') && s.owner === viewer) {
    return s.card;
  }
  return undefined;
}

/** The card / corp / standard project behind an event, if any. */
function sourceCardOf(e: GameEvent | undefined): CardName | undefined {
  const s = e?.source;
  if (s !== undefined && (s.kind === 'card' || s.kind === 'corporation' || s.kind === 'standardProject')) {
    return s.card;
  }
  return undefined;
}

export function signOf(gains: ReadonlyArray<JournalImpactChip>, losses: ReadonlyArray<JournalImpactChip>): ImpactSign {
  if (gains.length > 0 && losses.length > 0) {
    return 'mixed';
  }
  if (losses.length > 0) {
    return 'negative';
  }
  if (gains.length > 0) {
    return 'positive';
  }
  return 'neutral';
}

/**
 * The VIEWER's own impact inside one correlation chain — the heart of the
 * "notification is about the viewer" hierarchy. Only meaningful when the viewer
 * is NOT the acting player (their own actions are either self-suppressed or
 * presented action-first); the caller passes the chain actor to enforce that.
 *
 * Losses classify their cause exactly like the hostile detector: a loss with a
 * cross-player `target.player` (the `stealing` flag) or a source card owned by
 * another player is an ATTACK (`attacker` set); the viewer's own spends inside
 * a foreign chain (payments, own-card costs) are NOT counted as losses caused
 * by the actor — structurally they carry no foreign attacker and no foreign
 * source, so they simply do not arise here.
 */
export function viewerImpactOfChain(chain: ReadonlyArray<GameEvent>, viewer: Color | undefined, actor: Color | undefined): ViewerImpactMeta {
  if (viewer === undefined || actor === undefined || actor === viewer) {
    return NEUTRAL_IMPACT;
  }
  const rawGains: Array<JournalImpactChip> = [];
  const rawLosses: Array<JournalImpactChip> = [];
  let attacker: Color | undefined;
  let lossSource: GameEvent | undefined;
  let gainSource: GameEvent | undefined;
  let transfer = false;
  let production = false;
  let vp = false;
  for (const e of chain) {
    if (e.player !== viewer) {
      continue;
    }
    const chips = [...impactChips(e.impact), ...extraViewerChips(e.impact)];
    for (const c of chips) {
      if (c.saved === true || c.neutral === true) {
        continue; // a discount / neutral readout is not a personal gain or loss
      }
      if (c.text.startsWith('−')) {
        rawLosses.push(c);
        production = production || c.production === true;
        vp = vp || c.icon === 'vp';
        attacker = attacker ?? attackerOf(e, viewer);
        lossSource = lossSource ?? e;
        transfer = transfer || (e.target?.player !== undefined && e.target.player !== viewer);
      } else {
        rawGains.push(c);
        // The FIRST gain that names a card of the viewer's own is the honest
        // cause of a passive payout (a gain sourced to the ACTOR's card — a
        // trade bonus they handed out — is theirs, and is left to the root).
        if (gainSource === undefined && ownCardSource(e, viewer) !== undefined) {
          gainSource = e;
        }
      }
    }
  }
  const gains = mergeNet(rawGains);
  const losses = mergeNet(rawLosses);
  if (gains.length === 0 && losses.length === 0) {
    return NEUTRAL_IMPACT;
  }
  const scope: ViewerImpactScope | undefined =
    losses.length === 0 ? undefined : (vp ? 'vp' : (production ? 'production' : 'stock'));
  return {
    sign: signOf(gains, losses),
    gains,
    losses,
    attacker,
    sourceCard: sourceCardOf(lossSource ?? gainSource),
    ...(lossSource === undefined && gainSource !== undefined ? {ownSource: true} : {}),
    transfer: losses.length > 0 ? transfer : undefined,
    scope,
  };
}

/**
 * The VIEWER's own impact inside one MarsBot turn, from the turn's typed
 * script. TWO carriers, both read — this is load-bearing for the ATOMIC
 * presentation contract:
 *
 *  - `attack` steps, recorded AT the attack site. The end-of-turn snapshot
 *    deliberately DROPS a change an attack step already narrated (the server's
 *    `coveredByAttack` de-dup in AutomaTurnLog.finish), so for a bonus-card
 *    attack the attack step is the ONLY carrier of the loss. Reading the
 *    impact steps alone built the card NEUTRAL on its first frame — the red
 *    hero then arrived through the visible-card refresh, which is exactly the
 *    late-upgrade the atomic contract forbids.
 *  - `impact` steps — the whole-turn NET per participant. The attack's own
 *    contribution is BACKED OUT of the net before classifying, so the two
 *    carriers can never double-count one loss, and a mixed result keeps both
 *    directions (−5 plants to the attack, +2 from an unrelated payout).
 *
 * A blocked / empty attack (`removed === 0`) changes nothing and honestly
 * yields a neutral impact — the attack line still names it in the summary.
 * The composite 'cube' demand resolves later via the target's own pick, so it
 * is never a loss at turn time.
 */
export function viewerImpactOfBotTurn(turn: MarsBotTurn, viewer: Color | undefined, botColor: Color | undefined): ViewerImpactMeta {
  if (viewer === undefined) {
    return NEUTRAL_IMPACT;
  }
  /** Stock removed from the viewer by explicit attack steps, per resource. */
  const attackLoss = new Map<string, number>();
  for (const step of turn.steps) {
    if (step.kind === 'attack' && step.attack.target === viewer &&
        step.attack.removed > 0 && step.attack.resource !== 'cube') {
      attackLoss.set(step.attack.resource, (attackLoss.get(step.attack.resource) ?? 0) + step.attack.removed);
    }
  }
  const rawGains: Array<JournalImpactChip> = [];
  const rawLosses: Array<JournalImpactChip> = [];
  let production = false;
  for (const step of turn.steps) {
    if (step.kind !== 'impact' || step.impact.targetIsBot || step.impact.target !== viewer) {
      continue;
    }
    for (const change of step.impact.changes) {
      let delta = change.after - change.before;
      if (change.scope === 'stock' && change.resource !== 'tr') {
        // The snapshot is the whole-turn net — remove the attack steps' share
        // (they present as their own loss chips below).
        delta += attackLoss.get(change.resource) ?? 0;
      }
      if (delta === 0) {
        continue;
      }
      const chip: JournalImpactChip = {
        icon: change.resource === 'tr' ? 'tr' : change.resource,
        text: delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`,
        ...(change.scope === 'production' ? {production: true} : {}),
      };
      if (delta < 0) {
        rawLosses.push(chip);
        production = production || change.scope === 'production';
      } else {
        rawGains.push(chip);
      }
    }
  }
  for (const [resource, removed] of attackLoss) {
    rawLosses.push({icon: resource, text: `−${removed}`});
  }
  const gains = mergeNet(rawGains);
  const losses = mergeNet(rawLosses);
  if (gains.length === 0 && losses.length === 0) {
    return NEUTRAL_IMPACT;
  }
  return {
    sign: signOf(gains, losses),
    gains,
    losses,
    attacker: losses.length > 0 ? botColor : undefined,
    scope: losses.length === 0 ? undefined : (production ? 'production' : 'stock'),
  };
}

/**
 * Importance of a journal-rooted event for THIS viewer. Structural inputs only;
 * deliberately separate from the sign — an opponent's big engine play stays
 * `ambient` for a bystander, a small viewer loss is `critical` regardless of
 * its size (a loss must never be missed), a viewer gain is `notable`.
 */
export function importanceForRoot(opts: {
  viewerLoss: boolean;
  viewerGain: boolean;
  prestige: boolean; // milestone / award
  threat: boolean; // vp-pressure warning family (Vermin play / planetary event)
  vpPressure: boolean; // the vp-loss activation — everyone's score drops
}): NotificationImportance {
  if (opts.viewerLoss || opts.vpPressure) {
    return 'critical';
  }
  if (opts.viewerGain || opts.prestige || opts.threat) {
    return 'notable';
  }
  return 'ambient';
}
