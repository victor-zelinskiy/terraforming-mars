/*
 * consoleCardRules — the PURE half of the fullscreen rules panel: which of a
 * card's structured rule blocks are visible right now.
 *
 * It lives outside the SFC on purpose. The fullscreen prints a requirement
 * ONCE: when the availability panel beside the rules already states it (with
 * the current value, which is strictly more useful), that one block is hidden
 * here — addressed by the stable `req:<type>[:<qualifier>]` id the SERVER
 * sends as `UnplayableReason.requirementKey`, the very address the build-time
 * card-information generator gave the block. Never a text comparison, never a
 * per-card case.
 */
import {CardName} from '@/common/cards/CardName';
import {getCard} from '@/client/cards/ClientCardManifest';
import {buildCardAnnotations, CardAnnotation} from '@/client/components/cardAnnotations/annotationModel';

/**
 * Drop the rows an availability panel already restates, and any group left
 * empty by that — no orphan chip, no reserved height, no gap for a section
 * that is not there.
 */
export function visibleAnnotations(
  annotations: ReadonlyArray<CardAnnotation>,
  suppressIds: ReadonlyArray<string>,
): Array<CardAnnotation> {
  if (suppressIds.length === 0) {
    return [...annotations];
  }
  const hidden = new Set(suppressIds);
  const out: Array<CardAnnotation> = [];
  for (const group of annotations) {
    const rows = group.rows.filter((row) => !hidden.has(row.id));
    if (rows.length > 0) {
      out.push(rows.length === group.rows.length ? group : {...group, rows});
    }
  }
  return out;
}

/** The card's rule blocks, minus whatever the availability panel restates. */
export function cardRuleAnnotations(cardName: CardName, suppressIds: ReadonlyArray<string> = []): Array<CardAnnotation> {
  const card = getCard(cardName);
  return card === undefined ? [] : visibleAnnotations(buildCardAnnotations(card), suppressIds);
}

/**
 * Does this card carry any structured rules to show? (The shell gates the
 * side slot — and the viewer's width reservation — on this.) Asked WITH the
 * suppression, so a card whose only block is that one requirement renders no
 * empty panel.
 */
export function cardHasRules(cardName: string | undefined, suppressIds: ReadonlyArray<string> = []): boolean {
  if (cardName === undefined) {
    return false;
  }
  return cardRuleAnnotations(cardName as CardName, suppressIds).length > 0;
}
