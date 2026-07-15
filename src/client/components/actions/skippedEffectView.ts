import {ActionEffect, ActionPreviewStep} from '@/common/models/ActionPreviewModel';
import {Message} from '@/common/logs/Message';

/**
 * The rendered shape of a `warning` note — "this effect of the card will be
 * SKIPPED". ONE pure derivation shared by every surface that shows it (the
 * desktop play modal, the action details/confirm notice, the console play +
 * action composers) so they can never diverge on what a warning says.
 *
 * The premium contract: a warning names WHICH effect is lost (`title`) and HOW
 * MUCH (`effect`, a muted chip), not just THAT something is lost (`reason`).
 * A card commonly has several effects, and a skipped attack has no chip in the
 * branch's `effects` (it changes an OPPONENT's pool, not the player's), so this
 * block is the only place the lost effect is ever mentioned.
 */
export type SkippedEffectView = {
  /** i18n key NAMING the skipped effect ('' when the producer named none —
   *  a legacy warning degrades to the reason line alone). */
  title: string;
  /** i18n key of WHY it is skipped ("No valid target — this effect is skipped."). */
  reason: string;
  /** The chip the effect WOULD have applied, rendered muted/struck. Absent when
   *  no single magnitude is honest (an either/or attack) — the title still names it. */
  effect?: ActionEffect;
  /** Fallback icon key when there's no chip (the lost card-resource), '' when none. */
  icon: string;
};

/** The reason shown when a producer emitted a bare warning with no text. */
const DEFAULT_REASON = 'No valid target — this effect is skipped.';

function textOf(m: string | Message | undefined): string {
  if (m === undefined) {
    return '';
  }
  return typeof m === 'string' ? m : m.message;
}

/** True for a `warning` note — the steps that route to the skipped-effect block. */
export function isSkippedWarning(step: ActionPreviewStep): boolean {
  return step.kind === 'note' && step.noteKind === 'warning';
}

/**
 * Derive the display shape of one `warning` step. Never throws and never returns
 * an empty reason — an un-annotated legacy warning still renders honestly.
 */
export function skippedEffectView(step: ActionPreviewStep): SkippedEffectView {
  const note = step as {text?: string | Message, resource?: string, skipped?: {label: string | Message, effect?: ActionEffect}};
  const reason = textOf(note.text);
  return {
    title: textOf(note.skipped?.label),
    reason: reason !== '' ? reason : DEFAULT_REASON,
    effect: note.skipped?.effect,
    // Prefer the chip's icon (it carries the amount too); fall back to the bare
    // lost-resource icon so a chip-less warning still shows WHAT is lost.
    icon: note.skipped?.effect?.icon ?? note.resource ?? '',
  };
}

/** The `warning` steps of a branch, as display shapes — in emission order. */
export function skippedEffectViews(steps: ReadonlyArray<ActionPreviewStep> | undefined): ReadonlyArray<SkippedEffectView> {
  return (steps ?? []).filter(isSkippedWarning).map(skippedEffectView);
}
