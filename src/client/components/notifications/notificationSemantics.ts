import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {TileType} from '@/common/TileType';
import {EventTrigger, GameEvent, JournalActionCategory} from '@/common/events/GameEvent';
import {EventImpact} from '@/common/events/EventImpact';
import {EventSource, sourceKey} from '@/common/events/EventSource';
import {MarsBotImpactCause, MarsBotTurn, MarsBotTurnStep} from '@/common/automa/MarsBotTurn';
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

/** Where a viewer loss came from — the stock, future production, the VP
 *  score, or the Hydronetwork track position (Corporate Espionage). */
export type ViewerImpactScope = 'stock' | 'production' | 'vp' | 'track';

/**
 * The typed ORIGIN of one slice of the viewer's deltas — the answer to
 * «почему», never a guess from text. Reuses the server's own `EventSource`
 * vocabulary (a card, a corporation, a cell bonus, a colony benefit, a bonus
 * card, …) plus ONE client-side fallback: the root ACTION itself, for a delta
 * whose recording event carried no finer source (a solar-phase ocean, a
 * planetary event — the category names the rule that moved it).
 */
export type ViewerCauseOrigin =
  | EventSource
  | {kind: 'action'; category?: JournalActionCategory; card?: CardName};

/**
 * One CAUSE GROUP of the viewer's own deltas: the origin, whether it is the
 * viewer's OWN engine piece (their corp paid them inside somebody else's
 * action), the trigger that fired a passive origin, and the SIGNED chips this
 * cause contributed. A card with several causes renders each group's chips so
 * a multi-source total can never claim one origin for everything.
 */
export type ViewerImpactCause = {
  origin: ViewerCauseOrigin;
  /** True when the origin is the VIEWER's own card / corporation. */
  own?: boolean;
  /** What fired a passive origin (the effect-triggered parent's trigger). */
  trigger?: EventTrigger;
  /** For a 'tile-placed' trigger: the ONE tile the chain placed, when unambiguous. */
  triggerTile?: TileType;
  /** For a 'card-played*' trigger: the played card, when known. */
  triggerCard?: CardName;
  gains: ReadonlyArray<JournalImpactChip>;
  losses: ReadonlyArray<JournalImpactChip>;
};

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
  /**
   * The typed cause groups — REQUIRED (empty only on a neutral impact), so a
   * producer cannot mint a personal gain/loss without deciding its «почему».
   * Loss-carrying causes lead (mirroring the band); order is otherwise the
   * chain's own chronology.
   */
  causes: ReadonlyArray<ViewerImpactCause>;
};

const NEUTRAL_IMPACT: ViewerImpactMeta = {sign: 'neutral', gains: [], losses: [], causes: []};

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

/**
 * The typed cause of ONE viewer event inside a chain — the recording event's
 * own source, else the nearest `effect-triggered` ancestor's, else the chain
 * ROOT's (the acting card / colony / standard project), else the root ACTION
 * itself (its category names the rule: solar phase, planetary event, …).
 * A 'system' source is folded into the action fallback for the same reason —
 * «system» is not an answer, the action's category is.
 */
function causeOfEvent(e: GameEvent, byId: ReadonlyMap<number, GameEvent>, root: GameEvent | undefined, viewer: Color):
  {origin: ViewerCauseOrigin; own?: boolean; trigger?: EventTrigger; key: string} {
  // The nearest effect-triggered ancestor — the WHY of a passive payout.
  let marker: GameEvent | undefined;
  let cursor: GameEvent | undefined = e;
  for (let depth = 0; cursor !== undefined && depth < 8; depth++) {
    if (cursor.type === 'effect-triggered') {
      marker = cursor;
      break;
    }
    cursor = cursor.parentId === undefined ? undefined : byId.get(cursor.parentId);
  }
  let source = e.source ?? marker?.source;
  if (source === undefined || source.kind === 'system' || source.kind === 'payment') {
    const rootSource = root?.source;
    if (rootSource !== undefined && rootSource.kind !== 'system' && rootSource.kind !== 'payment') {
      source = rootSource;
    } else {
      const origin: ViewerCauseOrigin = {kind: 'action', ...(root?.category !== undefined ? {category: root.category} : {})};
      return {origin, key: `action#${root?.category ?? ''}`};
    }
  }
  // The trigger belongs to the cause only when the cause IS that effect's own
  // source — a delta nested under an unrelated marker must not inherit it.
  const trigger = marker !== undefined && marker.source !== undefined &&
    sourceKey(marker.source) === sourceKey(source) ? marker.trigger : undefined;
  const own = (source.kind === 'card' || source.kind === 'corporation') && source.owner === viewer;
  const benefit = source.kind === 'colony' ? source.benefit : undefined;
  return {
    origin: source,
    ...(own ? {own: true} : {}),
    ...(trigger !== undefined ? {trigger} : {}),
    key: `${sourceKey(source)}#${benefit ?? ''}#${trigger ?? ''}#${own ? 1 : 0}`,
  };
}

/** Structural context for the trigger phrase: the ONE tile the chain placed /
 *  the root card that was played — only when unambiguous. */
function triggerContextOf(cause: {trigger?: EventTrigger}, chain: ReadonlyArray<GameEvent>, root: GameEvent | undefined):
  {triggerTile?: TileType; triggerCard?: CardName} {
  if (cause.trigger === 'tile-placed') {
    const tiles = chain.filter((e) => e.type === 'tile-placed' && e.tile !== undefined);
    if (tiles.length === 1) {
      return {triggerTile: tiles[0].tile};
    }
    return {};
  }
  if (cause.trigger === 'card-played' || cause.trigger === 'card-played-by-any') {
    const s = root?.source;
    if (s !== undefined && (s.kind === 'card' || s.kind === 'corporation')) {
      return {triggerCard: s.card};
    }
  }
  return {};
}

/** Loss-carrying causes lead (mirroring the band's losses-first reading);
 *  chronological order is preserved within each half. */
function orderCauses(causes: ReadonlyArray<ViewerImpactCause>): Array<ViewerImpactCause> {
  return [...causes.filter((c) => c.losses.length > 0), ...causes.filter((c) => c.losses.length === 0)];
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
  const byId = new Map<number, GameEvent>();
  for (const e of chain) {
    byId.set(e.id, e);
  }
  const root = chain.find((e) => e.id === e.correlationId);
  const rawGains: Array<JournalImpactChip> = [];
  const rawLosses: Array<JournalImpactChip> = [];
  let attacker: Color | undefined;
  let lossSource: GameEvent | undefined;
  let gainSource: GameEvent | undefined;
  let transfer = false;
  let production = false;
  let vp = false;
  // Track retreats bypass `mergeNet` (their text is a POSITION reading, not a
  // summable amount) and lead the losses.
  const trackLosses: Array<JournalImpactChip> = [];
  // The typed CAUSE GROUPS — one accumulator per engine piece, first
  // occurrence order. Every chip lands in exactly one group, so «почему»
  // covers the whole band by construction.
  type CauseAcc = {cause: Omit<ViewerImpactCause, 'gains' | 'losses'>; rawGains: Array<JournalImpactChip>; rawLosses: Array<JournalImpactChip>; trackLosses: Array<JournalImpactChip>};
  const causeOrder: Array<string> = [];
  const causesByKey = new Map<string, CauseAcc>();
  const causeAccOf = (e: GameEvent): CauseAcc => {
    const {key, ...cause} = causeOfEvent(e, byId, root, viewer);
    let acc = causesByKey.get(key);
    if (acc === undefined) {
      acc = {cause: {...cause, ...triggerContextOf(cause, chain, root)}, rawGains: [], rawLosses: [], trackLosses: []};
      causesByKey.set(key, acc);
      causeOrder.push(key);
    }
    return acc;
  };
  for (const e of chain) {
    if (e.player !== viewer) {
      continue;
    }
    // A BACKWARD Hydronetwork move of the viewer's marker (Corporate
    // Espionage) — the canonical `delta-position-changed` fact. A loss row
    // of its own: the positions ARE the reading («1 → 0»), the scope line
    // names the track, and the attacker classifies exactly like a stock
    // steal. A forward move needs no row here (the mover is the actor, and
    // an actor's own chain never reaches this function).
    const dp = e.impact.deltaPosition;
    if (dp !== undefined && dp.steps < 0) {
      trackLosses.push({icon: '', text: `${dp.from} → ${dp.to}`});
      attacker = attacker ?? attackerOf(e, viewer);
      lossSource = lossSource ?? e;
      causeAccOf(e).trackLosses.push({icon: '', text: `${dp.from} → ${dp.to}`});
    }
    // A MODULAR FLOODGATES blockade DEPLOYED against the viewer — the
    // canonical `delta-blockade-changed` fact. No number moved: the loss is
    // the standing ban itself, so the chip is a WORDED unit (the card's
    // UNIT_LABEL carries the phrase + duration) and the attacker classifies
    // exactly like a track retreat. The quiet 'expired' phase is a journal
    // fact, never a band.
    const db = e.impact.deltaBlockade;
    if (db !== undefined && db.phase === 'placed') {
      trackLosses.push({icon: 'hydro-blockade', text: ''});
      attacker = attacker ?? attackerOf(e, viewer);
      lossSource = lossSource ?? e;
      causeAccOf(e).trackLosses.push({icon: 'hydro-blockade', text: ''});
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
        causeAccOf(e).rawLosses.push(c);
      } else {
        rawGains.push(c);
        // The FIRST gain that names a card of the viewer's own is the honest
        // cause of a passive payout (a gain sourced to the ACTOR's card — a
        // trade bonus they handed out — is theirs, and is left to the root).
        if (gainSource === undefined && ownCardSource(e, viewer) !== undefined) {
          gainSource = e;
        }
        causeAccOf(e).rawGains.push(c);
      }
    }
  }
  const gains = mergeNet(rawGains);
  const losses = [...trackLosses, ...mergeNet(rawLosses)];
  if (gains.length === 0 && losses.length === 0) {
    return NEUTRAL_IMPACT;
  }
  const causes: Array<ViewerImpactCause> = [];
  for (const key of causeOrder) {
    const acc = causesByKey.get(key);
    if (acc === undefined) {
      continue;
    }
    const causeGains = mergeNet(acc.rawGains);
    const causeLosses = [...acc.trackLosses, ...mergeNet(acc.rawLosses)];
    if (causeGains.length === 0 && causeLosses.length === 0) {
      continue; // this cause's deltas washed out — nothing of it survives the net
    }
    causes.push({...acc.cause, gains: causeGains, losses: causeLosses});
  }
  const scope: ViewerImpactScope | undefined =
    losses.length === 0 ? undefined : (trackLosses.length > 0 ? 'track' : (vp ? 'vp' : (production ? 'production' : 'stock')));
  return {
    sign: signOf(gains, losses),
    gains,
    losses,
    attacker,
    sourceCard: sourceCardOf(lossSource ?? gainSource),
    ...(lossSource === undefined && gainSource !== undefined ? {ownSource: true} : {}),
    transfer: losses.length > 0 ? transfer : undefined,
    scope,
    causes: orderCauses(causes),
  };
}

/**
 * Cause groups for a set of the viewer's LOSS events (the standalone hostile
 * fallback card — a loss that recorded after its root was seen, or one inside
 * the viewer's own suppressed action). Same derivation as the chain path, so
 * the two hostile presentations can never disagree about «почему».
 */
export function lossCausesOf(chain: ReadonlyArray<GameEvent>, negs: ReadonlyArray<GameEvent>, viewer: Color): Array<ViewerImpactCause> {
  const byId = new Map<number, GameEvent>();
  for (const e of chain) {
    byId.set(e.id, e);
  }
  const root = chain.find((e) => e.id === e.correlationId);
  const order: Array<string> = [];
  const byKey = new Map<string, {cause: Omit<ViewerImpactCause, 'gains' | 'losses'>; raw: Array<JournalImpactChip>}>();
  for (const e of negs) {
    const chips = impactChips(e.impact).filter((c) => c.saved !== true && c.neutral !== true && c.text.startsWith('−'));
    if (chips.length === 0) {
      continue;
    }
    const {key, ...cause} = causeOfEvent(e, byId, root, viewer);
    let acc = byKey.get(key);
    if (acc === undefined) {
      acc = {cause: {...cause, ...triggerContextOf(cause, chain, root)}, raw: []};
      byKey.set(key, acc);
      order.push(key);
    }
    acc.raw.push(...chips);
  }
  const causes: Array<ViewerImpactCause> = [];
  for (const key of order) {
    const acc = byKey.get(key);
    if (acc === undefined) {
      continue;
    }
    const causeLosses = mergeNet(acc.raw);
    if (causeLosses.length > 0) {
      causes.push({...acc.cause, gains: [], losses: causeLosses});
    }
  }
  return causes;
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
 * A composite 'cube' demand still waiting on its target's pick is likewise no
 * loss yet; one the bot RESOLVED on the spot (a single candidate — no choice to
 * take) is, and it keys on the cube that actually left, so its chip carries the
 * real sprite instead of the demand's two.
 */
export function viewerImpactOfBotTurn(turn: MarsBotTurn, viewer: Color | undefined, botColor: Color | undefined): ViewerImpactMeta {
  if (viewer === undefined) {
    return NEUTRAL_IMPACT;
  }
  /**
   * Removed from the viewer by explicit attack steps, per resource. A cube
   * keys on its CARD resource ('Animal' / 'Microbe' — `iconClassFor` takes the
   * raw enum value), which is never a `Resource`, so it can only ever add its
   * own chip: the snapshot back-out below reads standard stock resources.
   */
  const attackLoss = new Map<string, number>();
  for (const step of turn.steps) {
    if (step.kind === 'attack' && step.attack.target === viewer && step.attack.removed > 0) {
      const key = step.attack.resource === 'cube' ? step.attack.cardResource : step.attack.resource;
      if (key === undefined) {
        continue; // a cube demand whose target still has to pick — nothing left yet
      }
      attackLoss.set(key, (attackLoss.get(key) ?? 0) + step.attack.removed);
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
    causes: botTurnCauses(turn, viewer, gains, losses),
  };
}

/** One server-attributed cause → the viewer's typed cause group. */
function botCauseToViewer(c: MarsBotImpactCause, viewer: Color, turn: MarsBotTurn): ViewerImpactCause {
  const causeGains: Array<JournalImpactChip> = [];
  const causeLosses: Array<JournalImpactChip> = [];
  for (const change of c.changes) {
    const chip: JournalImpactChip = {
      icon: change.resource === 'tr' ? 'tr' : change.resource,
      text: change.amount > 0 ? `+${change.amount}` : `−${Math.abs(change.amount)}`,
      ...(change.scope === 'production' ? {production: true} : {}),
    };
    (change.amount < 0 ? causeLosses : causeGains).push(chip);
  }
  const own = (c.source.kind === 'card' || c.source.kind === 'corporation') && c.source.owner === viewer;
  const tiles = turn.visual?.tiles;
  const triggerTile = c.trigger === 'tile-placed' && tiles !== undefined && tiles.length === 1 ? tiles[0].tileType : undefined;
  return {
    origin: c.source,
    ...(own ? {own: true} : {}),
    ...(c.trigger !== undefined ? {trigger: c.trigger} : {}),
    ...(triggerTile !== undefined ? {triggerTile} : {}),
    gains: mergeNet(causeGains),
    losses: mergeNet(causeLosses),
  };
}

/** The card the bot ACTED with this turn — the honest fallback origin for a
 *  delta the event join could not attribute finer (and for old scripts that
 *  carry no attribution at all). */
function botTurnFallbackOrigin(turn: MarsBotTurn): ViewerCauseOrigin {
  for (const step of turn.steps) {
    if (step.kind === 'reveal') {
      return step.card.kind === 'project' ?
        {kind: 'card', card: step.card.name} :
        {kind: 'bonusCard', bonusCard: step.card.id};
    }
  }
  return {kind: 'action', category: 'automa-turn'};
}

/**
 * The «почему» groups of a bot-turn band: the server-attributed causes joined
 * from the turn's own event chain (each with its per-resource chips), plus ONE
 * honest residual group — whatever share of the band's totals the attribution
 * did not cover keys on the card the bot actually played (a cube attack, an
 * old save's script). The residual is computed against the BAND's merged
 * totals, so the groups always add up to what the band states.
 */
function botTurnCauses(turn: MarsBotTurn, viewer: Color, gains: ReadonlyArray<JournalImpactChip>, losses: ReadonlyArray<JournalImpactChip>): Array<ViewerImpactCause> {
  const impactStep = turn.steps.find(
    (s): s is Extract<MarsBotTurnStep, {kind: 'impact'}> => s.kind === 'impact' && !s.impact.targetIsBot && s.impact.target === viewer);
  const causes = (impactStep?.impact.causes ?? []).map((c) => botCauseToViewer(c, viewer, turn))
    .filter((c) => c.gains.length > 0 || c.losses.length > 0);
  // Residual per (icon, production, direction): the band total minus what the
  // named causes claimed. Never negative — an over-claim (gained then spent
  // back) is already a wash the cause conversion dropped.
  const residualOf = (total: ReadonlyArray<JournalImpactChip>, claimed: (c: ViewerImpactCause) => ReadonlyArray<JournalImpactChip>): Array<JournalImpactChip> => {
    const out: Array<JournalImpactChip> = [];
    for (const chip of total) {
      const key = (c: JournalImpactChip) => `${c.icon}|${c.production === true ? 1 : 0}`;
      const claimedSum = causes.reduce((sum, c) =>
        sum + claimed(c).filter((cc) => key(cc) === key(chip)).reduce((s, cc) => s + Math.abs(chipAmount(cc.text)), 0), 0);
      const totalAbs = Math.abs(chipAmount(chip.text));
      if (totalAbs > claimedSum) {
        const rest = totalAbs - claimedSum;
        out.push({...chip, text: chip.text.startsWith('−') ? `−${rest}` : `+${rest}`});
      }
    }
    return out;
  };
  const residualGains = residualOf(gains, (c) => c.gains);
  const residualLosses = residualOf(losses, (c) => c.losses);
  if (residualGains.length > 0 || residualLosses.length > 0) {
    causes.push({origin: botTurnFallbackOrigin(turn), gains: residualGains, losses: residualLosses});
  }
  return orderCauses(causes);
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
