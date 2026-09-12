/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 *
 * EFFECT RULE TEXT — the ONE resolver for «what does THIS effect do?», the
 * effects-explorer twin of `actions/actionDescription.ts`.
 *
 * The explorer's tile shows a CAPTION beside the printed formula; the dossier
 * shows the FULL rule. The caption is the card's curated short (`infoText`,
 * `kind: 'effect-short'`) when the full rule is too long to read as a calm
 * one/two-line sentence, and the full rule itself when that already reads
 * well — never a truncation (a sentence that stops mid-thought is the defect
 * this file exists to remove).
 *
 * Sources, neither re-implemented here:
 *  1. `metadata.information` — the generated per-graphic-block card text;
 *     every passive effect gets its OWN group keyed by the effect's graphic
 *     id, and `applyEffectShorts` rides the curated caption on its block.
 *  2. The render node's co-located DSL description (`EffectEntry.description`)
 *     — universal and index-exact by construction, covering modules the
 *     information generator has not been widened to yet.
 *
 * Addressing is by CONTENT (the graphic token of the node the caller points
 * at), then text identity, then a same-count ordinal — the actionDescription
 * ladder verbatim. Pure: no Vue, no DOM; `text` values are English i18n keys.
 */

import {CardName} from '@/common/cards/CardName';
import {CardInfoGroup} from '@/common/cards/CardInformation';
import {ICardRenderEffect} from '@/common/cards/render/Types';
import {getCard} from '@/client/cards/ClientCardManifest';
import {nodeGraphicToken} from '@/common/cards/render/cardGraphicIds';
import {stripKindPrefix} from '@/client/components/cardAnnotations/annotationModel';
import {translateText} from '@/client/directives/i18n';

/** A rule line of ONE effect. `text` is an English i18n key. */
export type EffectRuleLine = {
  /** `rule` — what the effect does; `note` — its printed fine print. */
  kind: 'rule' | 'note';
  text: string;
};

export type EffectRules = {
  lines: ReadonlyArray<EffectRuleLine>;
  /**
   * The CAPTION a compact host shows (the explorer's tile): the card's
   * curated short for this effect, or the full rule itself when that already
   * reads as a calm caption. Never a truncation.
   */
  summary: string;
  /** True when `summary` is the card's own curated caption, not the rule. */
  curated: boolean;
};

/**
 * Translate + strip the co-located `Effect: ` / `Эффект: ` prefix (the tile
 * carries its kind as the family chip) + read as a sentence. The one
 * formatter for every host of effect rule text.
 */
export function effectRuleText(key: string): string {
  const text = stripKindPrefix(translateText(key));
  return text.length > 0 ? text[0].toLocaleUpperCase() + text.slice(1) : text;
}

/** The information groups that describe EFFECTS of this card, in card order. */
function effectInfoGroups(cardName: CardName): ReadonlyArray<CardInfoGroup> {
  const groups = getCard(cardName)?.metadata.information?.groups;
  return groups === undefined ? [] : groups.filter((g) => g.kind === 'effect');
}

/**
 * The information group describing THIS effect. Graded, most exact first —
 * the `actionDescription.infoGroupForNode` ladder:
 *  1. the node's own graphic token (`g:<token>`, `~N` for twins);
 *  2. text identity (a generated effect block IS the node's DSL description);
 *  3. the ordinal, and only when the two enumerations agree on the count —
 *     which is what makes an AUTHORED effect (renderWhole overrides, corp
 *     frames whose text differs from the printed one) reachable.
 */
function infoGroupForEffect(
  cardName: CardName,
  effectNode: ICardRenderEffect | undefined,
  description: string | undefined,
  effectIndex: number,
  effectCount: number): CardInfoGroup | undefined {
  const groups = effectInfoGroups(cardName);
  if (groups.length === 0) {
    return undefined;
  }
  const token = effectNode === undefined ? undefined : nodeGraphicToken(effectNode);
  if (token !== undefined) {
    const byToken = groups.filter((g) => g.id === `g:${token}` || g.id.startsWith(`g:${token}~`));
    if (byToken.length === 1) {
      return byToken[0];
    }
    // Several identical effect rows: keep the reading order between them.
    if (byToken.length > 1) {
      return byToken[Math.min(effectIndex, byToken.length - 1)];
    }
  }
  if (description !== undefined && description !== '') {
    const byText = groups.find((g) => g.blocks.some((b) => b.text === description));
    if (byText !== undefined) {
      return byText;
    }
  }
  return groups.length === effectCount ? groups[effectIndex] : undefined;
}

/** The curated caption of this effect, when the card authored one. */
function shortOf(group: CardInfoGroup): string | undefined {
  for (const block of group.blocks) {
    if (block.kind === 'effect' && block.short !== undefined && block.short !== '') {
      return block.short;
    }
  }
  return undefined;
}

/** The lines an effect's rule block should speak (rule first, notes after). */
function linesOf(group: CardInfoGroup): Array<EffectRuleLine> {
  const lines: Array<EffectRuleLine> = [];
  const seen = new Set<string>();
  const push = (kind: EffectRuleLine['kind'], text: string) => {
    if (text !== '' && !seen.has(text)) {
      seen.add(text);
      lines.push({kind, text});
    }
  };
  for (const block of group.blocks) {
    if (block.kind === 'effect') {
      push('rule', block.text);
    }
  }
  for (const block of group.blocks) {
    if (block.kind === 'note') {
      push('note', block.text);
    }
  }
  return lines;
}

/** The slice of `effectExtraction.EffectEntry` this resolver reads. */
export type EffectRulesInput = {
  cardName: CardName;
  effectIndex: number;
  effectNode: ICardRenderEffect | undefined;
  /** The per-effect DSL description (still `Effect: `-prefixed). */
  description: string | undefined;
  /** A text-only override's whole text (its own rule statement). */
  text: string | undefined;
};

/**
 * The rule text of ONE effect of a card — the effect the caller is pointing
 * at, never the card as a whole.
 *
 * @param entry        the extracted effect (`playerEffects` entry slice)
 * @param effectCount  how many effects the card yields (the ordinal net)
 */
export function effectRules(entry: EffectRulesInput, effectCount: number): EffectRules | undefined {
  const info = infoGroupForEffect(entry.cardName, entry.effectNode, entry.description, entry.effectIndex, effectCount);
  const lines = info === undefined ? [] : linesOf(info);
  if (lines.length === 0) {
    const printed = entry.description ?? entry.text ?? '';
    if (printed !== '') {
      lines.push({kind: 'rule', text: printed});
    }
  }
  if (lines.length === 0) {
    return undefined;
  }
  const curated = info === undefined ? undefined : shortOf(info);
  return {
    lines,
    summary: curated ?? lines[0].text,
    curated: curated !== undefined,
  };
}
