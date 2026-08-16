/*
 * cardAvailability — the ONE presentation model for "how available is this
 * card in the current game", shared by the draft workspace's status block,
 * the hand's verdict bar and the fullscreen viewer's availability panel, so
 * the three surfaces can never disagree about severity, wording, order or
 * de-duplication (cross-cutting parity — the same input MUST render the same
 * reasons everywhere).
 *
 * It derives NO game rule. The input is the server's own `unplayableReasons`
 * (built from the real `CardRequirement.satisfies` / affordability / behavior
 * checks, with every requirement modifier already folded in), plus — in the
 * play context — the shell's already-decided turn reason. This module only
 * chooses the VOICE per context:
 *
 *   'draft' — the card is being taken FOR LATER (a draft pick, a research
 *     buy). Only PRINTED REQUIREMENTS speak (`requirement: true`); money,
 *     targets and placement are about THIS moment and will have changed.
 *     Severity is the requirement's own trajectory: still reachable →
 *     'pending' («Требование пока не выполнено», amber), provably lost →
 *     'missed' («Требование уже не выполнить», red — only when the server
 *     could PROVE it via `unattainable`). Never blocks the pick.
 *
 *   'play' — the player is deciding whether to play the card RIGHT NOW, so
 *     every real blocker is equally red under one «Нельзя разыграть»
 *     headline; the pending/missed split adds nothing to this decision. The
 *     turn window is NOT a defect of the card (AvailabilityBlocker semantics)
 *     — it stays a separate amber note and only becomes the headline when it
 *     is the ONLY thing in the way.
 *
 * Pure and unit-tested (tests/client/components/console/cardAvailability.spec.ts).
 */
import {UnplayableReason, UnplayableReasonType} from '@/common/cards/UnplayableReason';
import {blockerForReason} from '@/common/availability/AvailabilityBlocker';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {reasonUnit, unplayableReasonLine} from '@/client/components/handCards/unplayableReasonFormat';

export type CardAvailabilityContext = 'draft' | 'play';

export type CardAvailabilitySeverity =
  /** Draft voice: the requirement is not met YET, but the game can still get there. */
  | 'pending'
  /** Draft voice: the server proved the requirement can never be met again. */
  | 'missed'
  /** Play voice: real rule blockers — the card cannot be played right now. */
  | 'blocked'
  /** Play voice: nothing wrong with the card, only the action window blocks. */
  | 'waiting';

/** The visual register a severity paints (perf-safe colours, never the only signal). */
export type CardAvailabilityTone = 'warning' | 'danger';

export interface CardAvailabilityReasonView {
  /** Stable render/dedupe key. */
  key: string;
  /** The server reason's structural type ('turn' for the client-added window note). */
  type: UnplayableReasonType;
  /** The full translated line, e.g. «Требуется температура 0°C · Сейчас: -22°C». */
  text: string;
  /** This individual reason's own voice (a turn note stays amber under a red headline). */
  severity: CardAvailabilitySeverity;
  tone: CardAvailabilityTone;
  /**
   * Translated modifier note when the player's requirement bonuses stretch
   * the printed bound but still fall short («С учётом ваших модификаторов: N»).
   */
  modifiers?: string;
  /**
   * The rules block this reason fully restates (`UnplayableReason.requirementKey`),
   * when it does. Collected into the view's `coveredRequirementIds`.
   */
  requirementKey?: string;
}

export interface CardAvailabilityView {
  context: CardAvailabilityContext;
  severity: CardAvailabilitySeverity;
  tone: CardAvailabilityTone;
  /** Translated headline («Требование пока не выполнено» / «Нельзя разыграть» / …). */
  title: string;
  /** The text marker that accompanies the colour (never colour alone). */
  icon: string;
  /** Every relevant reason, ordered: the decisive ones first, the turn note last. */
  reasons: ReadonlyArray<CardAvailabilityReasonView>;
  /** The one line a compact surface shows. */
  primary: CardAvailabilityReasonView | undefined;
  /** How many more reasons the compact surface is not showing. */
  extraCount: number;
  /**
   * `CardInfoBlock.id`s of the RULES blocks these reasons fully restate (the
   * server's `requirementKey`s — see UnplayableReason). A surface that shows
   * this view NEXT TO the rules panel passes them on, and that panel hides
   * exactly those blocks: the requirement then appears once, in the richer
   * voice that also carries the current value. Empty for every reason that
   * is situational, partial, or not a printed requirement at all — a blocked
   * EFFECT never hides the effect's own rule.
   */
  coveredRequirementIds: ReadonlyArray<string>;
}

const ICONS: Readonly<Record<CardAvailabilitySeverity, string>> = {
  pending: '◈',
  missed: '✕',
  blocked: '✕',
  waiting: '⏳',
};

const TONES: Readonly<Record<CardAvailabilitySeverity, CardAvailabilityTone>> = {
  pending: 'warning',
  missed: 'danger',
  blocked: 'danger',
  waiting: 'warning',
};

/** English i18n keys (the text IS the key). */
const TITLES = {
  pendingOne: 'Requirement not met yet',
  pendingMany: 'Requirements not met yet',
  missedOne: 'Requirement can no longer be met',
  missedMany: 'Requirements can no longer be met',
  blocked: 'Unplayable now',
} as const;

function reasonKey(r: UnplayableReason): string {
  return `${r.type}|${r.message}|${r.tag ?? ''}|${r.resource ?? ''}`;
}

/**
 * The translated «with your modifiers the bound is N» note — only when the
 * server reported an effective bound different from the printed one (i.e. the
 * player HOLDS a requirement bonus and it still isn't enough).
 */
function modifierNote(r: UnplayableReason): string | undefined {
  if (r.effectiveCount === undefined) {
    return undefined;
  }
  return translateTextWithParams('With your modifiers: ${0}', [`${r.effectiveCount}${reasonUnit(r)}`]);
}

function reasonView(r: UnplayableReason, severity: CardAvailabilitySeverity): CardAvailabilityReasonView {
  const view: CardAvailabilityReasonView = {
    key: reasonKey(r),
    type: r.type,
    text: unplayableReasonLine(r),
    severity,
    tone: TONES[severity],
  };
  const modifiers = modifierNote(r);
  if (modifiers !== undefined) {
    view.modifiers = modifiers;
  }
  if (r.requirementKey !== undefined) {
    view.requirementKey = r.requirementKey;
  }
  return view;
}

/** De-dupe by rendered text — the same requirement must never appear twice in two wordings. */
function dedupe(views: ReadonlyArray<CardAvailabilityReasonView>): Array<CardAvailabilityReasonView> {
  const seen = new Set<string>();
  const out: Array<CardAvailabilityReasonView> = [];
  for (const v of views) {
    const key = `${v.key}|${v.text}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}

function assemble(
  context: CardAvailabilityContext,
  severity: CardAvailabilitySeverity,
  title: string,
  reasons: Array<CardAvailabilityReasonView>,
): CardAvailabilityView {
  return {
    context,
    severity,
    tone: TONES[severity],
    title,
    icon: ICONS[severity],
    reasons,
    primary: reasons[0],
    extraCount: Math.max(0, reasons.length - 1),
    // Only the reasons that ARE rendered can license hiding their rule — a
    // reason filtered out of this view (a situational block in the draft
    // voice) must never silence anything.
    coveredRequirementIds: reasons
      .map((r) => r.requirementKey)
      .filter((id): id is string => id !== undefined),
  };
}

export type CardAvailabilityInput = {
  /** The server's structured reasons (`CardModel.unplayableReasons`). */
  reasons: ReadonlyArray<UnplayableReason> | undefined;
  /**
   * Play context only: the shell's already-decided action-window reason
   * (`offTurnReason` / `actionBlockedReason` — an English i18n key), present
   * exactly when the window is closed. The model never re-derives turn state
   * (console rule: a surface never computes a turn reason of its own).
   */
  turnReason?: string;
};

/**
 * Build the availability view for one card in one context.
 * `undefined` = nothing to say — the surface renders NO panel (a met
 * requirement set in draft, a playable card in an open window).
 */
export function buildCardAvailability(
  input: CardAvailabilityInput,
  context: CardAvailabilityContext,
): CardAvailabilityView | undefined {
  const all = input.reasons ?? [];
  if (context === 'draft') {
    // The card is being evaluated for LATER: only printed requirements speak.
    const requirements = all.filter((r) => r.requirement === true);
    if (requirements.length === 0) {
      return undefined;
    }
    const missed = requirements.filter((r) => r.unattainable === true);
    const pending = requirements.filter((r) => r.unattainable !== true);
    // The decisive verdict leads: a provably-lost requirement outranks a
    // still-open one, both in the headline and in the list order.
    const reasons = dedupe([
      ...missed.map((r) => reasonView(r, 'missed')),
      ...pending.map((r) => reasonView(r, 'pending')),
    ]);
    const severity: CardAvailabilitySeverity = missed.length > 0 ? 'missed' : 'pending';
    const title = severity === 'missed' ?
      translateText(missed.length > 1 ? TITLES.missedMany : TITLES.missedOne) :
      translateText(pending.length > 1 ? TITLES.pendingMany : TITLES.pendingOne);
    return assemble(context, severity, title, reasons);
  }

  // Play context. The server's list describes the CARD; turn/phase entries
  // (client-added, execution gates by AvailabilityBlocker semantics) are not
  // card defects — split them out so they can never masquerade as one.
  const domain = all.filter((r) => blockerForReason(r).affectsPotentialCount);
  const gates = all.filter((r) => !blockerForReason(r).affectsPotentialCount);
  const turnNotes: Array<CardAvailabilityReasonView> = dedupe([
    ...gates.map((r) => reasonView(r, 'waiting')),
    ...(input.turnReason !== undefined && input.turnReason !== '' ?
      [{key: `turn|${input.turnReason}`, type: 'turn' as const, text: translateText(input.turnReason), severity: 'waiting' as const, tone: TONES.waiting}] :
      []),
  ]);
  if (domain.length > 0) {
    // Real blockers make the verdict red; the turn note keeps its own amber
    // voice at the END of the list — context, not a reason.
    const reasons = [...dedupe(domain.map((r) => reasonView(r, 'blocked'))), ...turnNotes];
    return assemble(context, 'blocked', translateText(TITLES.blocked), reasons);
  }
  if (turnNotes.length > 0) {
    // Nothing wrong with the card — only the action window. The note IS the
    // headline; no reason list beneath repeats it.
    return assemble(context, 'waiting', turnNotes[0].text, turnNotes.slice(1));
  }
  return undefined;
}
